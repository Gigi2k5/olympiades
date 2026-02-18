"""
Configuration de l'application Flask
"""
import os
from datetime import timedelta
from dotenv import load_dotenv

# Charger le fichier .env (seulement en local)
load_dotenv()

# Chemin absolu du dossier backend
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    """Configuration de base"""
    
    # Clés secrètes depuis les variables d'environnement
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dev-jwt-key-change-in-production')
    
    # Configuration JWT
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRES', 3600)))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(seconds=int(os.environ.get('JWT_REFRESH_TOKEN_EXPIRES', 2592000)))
    
    # Configuration base de données - PostgreSQL par défaut
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'postgresql://olympiades_user:olympiades_pass@localhost:5432/olympiades_ia_dev'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False
    
    # Pool de connexions DB — critique sous charge
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': int(os.environ.get('DB_POOL_SIZE', 10)),
        'max_overflow': int(os.environ.get('DB_MAX_OVERFLOW', 20)),
        'pool_recycle': 300,   # Recycler les connexions toutes les 5 min
        'pool_pre_ping': True, # Vérifier que la connexion est vivante avant de l'utiliser
        'pool_timeout': 30,    # Timeout si le pool est plein
    }
    
    # Configuration CORS - IMPORTANT pour le déploiement
    cors_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3000')
    CORS_ORIGINS = [origin.strip() for origin in cors_origins.split(',') if origin.strip()]
    
    # Configuration uploads
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 Mo max
    ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'avif'}
    ALLOWED_DOC_EXTENSIONS = {'pdf'}
    MAX_IMAGE_SIZE = 5 * 1024 * 1024   # 5 MB
    MAX_DOC_SIZE = 10 * 1024 * 1024    # 10 MB
    
    # Configuration Email Brevo (ex-Sendinblue)
    BREVO_API_KEY = os.environ.get('BREVO_API_KEY')
    BREVO_SENDER_EMAIL = os.environ.get('BREVO_SENDER_EMAIL')
    BREVO_SENDER_NAME = os.environ.get('BREVO_SENDER_NAME', 'Olympiades IA Bénin')
    
    # URL du frontend (pour les liens dans les emails)
    FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
    
    # Configuration stockage fichiers (local ou s3)
    STORAGE_BACKEND = os.environ.get('STORAGE_BACKEND', 'local')  # 'local' ou 's3'
    AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
    AWS_S3_BUCKET = os.environ.get('AWS_S3_BUCKET')
    AWS_S3_REGION = os.environ.get('AWS_S3_REGION', 'eu-west-3')
    AWS_S3_ENDPOINT = os.environ.get('AWS_S3_ENDPOINT')  # Pour MinIO ou compatible
    CDN_URL = os.environ.get('CDN_URL')  # URL CDN devant S3 (optionnel)
    
    # Configuration Redis (rate limiter + blacklist JWT)
    REDIS_URL = os.environ.get('REDIS_URL', '')
    
    # JWT Blacklist
    JWT_BLACKLIST_ENABLED = True
    JWT_BLACKLIST_TOKEN_CHECKS = ['access', 'refresh']


class DevelopmentConfig(Config):
    """Configuration pour le développement"""
    DEBUG = True
    SQLALCHEMY_ECHO = False
    
    # En dev, on peut utiliser SQLite si pas de PostgreSQL
    @staticmethod
    def init_app(app):
        db_url = app.config.get('SQLALCHEMY_DATABASE_URI', '')
        # Corriger postgres:// en postgresql://
        if db_url.startswith('postgres://'):
            app.config['SQLALCHEMY_DATABASE_URI'] = db_url.replace('postgres://', 'postgresql://', 1)


class ProductionConfig(Config):
    """Configuration pour la production"""
    DEBUG = False
    
    # En production, pas de echo SQL
    SQLALCHEMY_ECHO = False
    
    @staticmethod
    def init_app(app):
        # Render utilise postgres:// mais SQLAlchemy 2.x exige postgresql://
        db_url = app.config.get('SQLALCHEMY_DATABASE_URI', '')
        if db_url.startswith('postgres://'):
            app.config['SQLALCHEMY_DATABASE_URI'] = db_url.replace('postgres://', 'postgresql://', 1)


class TestingConfig(Config):
    """Configuration pour les tests"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}