"""
Service de gestion des fichiers uploadés

Supporte deux backends de stockage :
  - LOCAL : stockage sur disque (dev uniquement)
  - S3 : stockage sur Amazon S3 / compatible (production)

Le backend est déterminé par la variable d'env STORAGE_BACKEND ('local' ou 's3').
En mode S3, les variables AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, 
AWS_S3_BUCKET et optionnellement AWS_S3_REGION / AWS_S3_ENDPOINT doivent être définies.
"""
import os
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import current_app


class FileService:
    """Gère l'upload et la suppression des fichiers"""
    
    ALLOWED_IMAGE_EXT = {'jpg', 'jpeg', 'png', 'webp', 'avif'}
    ALLOWED_DOC_EXT = {'pdf'}
    MAX_IMAGE_SIZE = 5 * 1024 * 1024   # 5 MB
    MAX_DOC_SIZE = 10 * 1024 * 1024    # 10 MB
    
    # ─── Helpers ──────────────────────────────────────────
    
    @staticmethod
    def _use_s3():
        """Vérifie si le stockage S3 est activé"""
        return current_app.config.get('STORAGE_BACKEND', 'local') == 's3'
    
    @staticmethod
    def _get_s3_client():
        """Crée un client boto3 S3 (lazy import pour ne pas casser si boto3 absent en dev)"""
        import boto3
        endpoint = current_app.config.get('AWS_S3_ENDPOINT')
        kwargs = {
            'aws_access_key_id': current_app.config['AWS_ACCESS_KEY_ID'],
            'aws_secret_access_key': current_app.config['AWS_SECRET_ACCESS_KEY'],
            'region_name': current_app.config.get('AWS_S3_REGION', 'eu-west-3'),
        }
        if endpoint:
            kwargs['endpoint_url'] = endpoint
        return boto3.client('s3', **kwargs)
    
    @staticmethod
    def _get_s3_bucket():
        return current_app.config['AWS_S3_BUCKET']
    
    @staticmethod
    def get_upload_folder():
        """Retourne le dossier d'upload (mode local uniquement)"""
        return current_app.config.get('UPLOAD_FOLDER', 'uploads')
    
    @staticmethod
    def allowed_file(filename, allowed_extensions):
        """Vérifie si l'extension est autorisée"""
        if '.' not in filename:
            return False
        ext = filename.rsplit('.', 1)[1].lower()
        return ext in allowed_extensions
    
    @staticmethod
    def get_extension(filename):
        """Extrait l'extension du fichier"""
        if '.' not in filename:
            return ''
        return filename.rsplit('.', 1)[1].lower()
    
    @staticmethod
    def generate_unique_filename(original_filename):
        """Génère un nom de fichier unique"""
        ext = FileService.get_extension(original_filename)
        unique_id = uuid.uuid4().hex[:12]
        timestamp = datetime.utcnow().strftime('%Y%m%d')
        return f"{timestamp}_{unique_id}.{ext}"
    
    # ─── Upload vers S3 ──────────────────────────────────
    
    @staticmethod
    def _upload_to_s3(file, relative_path, content_type=None):
        """Upload un fichier vers S3, retourne (relative_path, error)"""
        try:
            s3 = FileService._get_s3_client()
            bucket = FileService._get_s3_bucket()
            
            extra_args = {}
            if content_type:
                extra_args['ContentType'] = content_type
            
            s3.upload_fileobj(file, bucket, relative_path, ExtraArgs=extra_args)
            return relative_path, None
        except Exception as e:
            return None, f"Erreur upload S3: {str(e)}"
    
    @staticmethod
    def _delete_from_s3(relative_path):
        """Supprime un fichier de S3"""
        try:
            s3 = FileService._get_s3_client()
            bucket = FileService._get_s3_bucket()
            s3.delete_object(Bucket=bucket, Key=relative_path)
            return True
        except Exception as e:
            print(f"Erreur suppression S3: {e}")
            return False
    
    # ─── Upload générique ─────────────────────────────────
    
    @staticmethod
    def save_image(file, subfolder='photos'):
        """
        Sauvegarde une image (local ou S3)
        
        Args:
            file: FileStorage object
            subfolder: sous-dossier (photos, bulletins)
            
        Returns:
            tuple: (relative_path, error_message)
        """
        if not file or not file.filename:
            return None, "Aucun fichier fourni"
        
        # Vérifier l'extension
        if not FileService.allowed_file(file.filename, FileService.ALLOWED_IMAGE_EXT):
            return None, f"Extension non autorisée. Formats acceptés: {', '.join(FileService.ALLOWED_IMAGE_EXT)}"
        
        # Vérifier la taille
        file.seek(0, 2)  # Aller à la fin
        size = file.tell()
        file.seek(0)  # Revenir au début
        
        if size > FileService.MAX_IMAGE_SIZE:
            return None, f"Fichier trop volumineux. Maximum: {FileService.MAX_IMAGE_SIZE // (1024*1024)} MB"
        
        # Générer le nom unique
        filename = FileService.generate_unique_filename(file.filename)
        relative_path = f"{subfolder}/{filename}"
        
        # Upload S3 ou local
        if FileService._use_s3():
            ext = FileService.get_extension(file.filename)
            content_types = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp', 'avif': 'image/avif'}
            return FileService._upload_to_s3(file, relative_path, content_types.get(ext))
        
        # Mode local
        upload_folder = FileService.get_upload_folder()
        target_folder = os.path.join(upload_folder, subfolder)
        os.makedirs(target_folder, exist_ok=True)
        filepath = os.path.join(target_folder, filename)
        file.save(filepath)
        
        return relative_path, None
    
    @staticmethod
    def save_document(file, subfolder='bulletins'):
        """
        Sauvegarde un document PDF (local ou S3)
        
        Args:
            file: FileStorage object
            subfolder: sous-dossier
            
        Returns:
            tuple: (relative_path, error_message)
        """
        if not file or not file.filename:
            return None, "Aucun fichier fourni"
        
        # Vérifier l'extension
        if not FileService.allowed_file(file.filename, FileService.ALLOWED_DOC_EXT):
            return None, f"Extension non autorisée. Formats acceptés: {', '.join(FileService.ALLOWED_DOC_EXT)}"
        
        # Vérifier la taille
        file.seek(0, 2)
        size = file.tell()
        file.seek(0)
        
        if size > FileService.MAX_DOC_SIZE:
            return None, f"Fichier trop volumineux. Maximum: {FileService.MAX_DOC_SIZE // (1024*1024)} MB"
        
        # Générer le nom unique
        filename = FileService.generate_unique_filename(file.filename)
        relative_path = f"{subfolder}/{filename}"
        
        # Upload S3 ou local
        if FileService._use_s3():
            return FileService._upload_to_s3(file, relative_path, 'application/pdf')
        
        # Mode local
        upload_folder = FileService.get_upload_folder()
        target_folder = os.path.join(upload_folder, subfolder)
        os.makedirs(target_folder, exist_ok=True)
        filepath = os.path.join(target_folder, filename)
        file.save(filepath)
        
        return relative_path, None
    
    @staticmethod
    def delete_file(relative_path):
        """
        Supprime un fichier (local ou S3)
        
        Args:
            relative_path: chemin relatif (ex: photos/20240101_abc123.jpg)
            
        Returns:
            bool: True si supprimé, False sinon
        """
        if not relative_path:
            return False
        
        if FileService._use_s3():
            return FileService._delete_from_s3(relative_path)
        
        upload_folder = FileService.get_upload_folder()
        filepath = os.path.join(upload_folder, relative_path)
        
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
                return True
        except Exception as e:
            print(f"Erreur suppression fichier: {e}")
        
        return False
    
    @staticmethod
    def get_file_url(relative_path):
        """
        Retourne l'URL publique d'un fichier
        
        Args:
            relative_path: chemin relatif
            
        Returns:
            str: URL complète
        """
        if not relative_path:
            return None
        
        if FileService._use_s3():
            # URL publique S3 ou CDN
            cdn_url = current_app.config.get('CDN_URL')
            if cdn_url:
                return f"{cdn_url}/{relative_path}"
            bucket = FileService._get_s3_bucket()
            region = current_app.config.get('AWS_S3_REGION', 'eu-west-3')
            return f"https://{bucket}.s3.{region}.amazonaws.com/{relative_path}"
        
        return f"/uploads/{relative_path}"
    
    @staticmethod
    def file_exists(relative_path):
        """Vérifie si un fichier existe"""
        if not relative_path:
            return False
        
        if FileService._use_s3():
            try:
                s3 = FileService._get_s3_client()
                bucket = FileService._get_s3_bucket()
                s3.head_object(Bucket=bucket, Key=relative_path)
                return True
            except Exception:
                return False
        
        upload_folder = FileService.get_upload_folder()
        filepath = os.path.join(upload_folder, relative_path)
        return os.path.exists(filepath)
