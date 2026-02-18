"""
Service d'authentification
"""
import secrets
import random
from datetime import datetime, timedelta
from flask_jwt_extended import create_access_token, create_refresh_token
from flask import current_app
from app import db
from app.models import User, Candidate, AuditLog


class AuthService:
    """Gère l'authentification des utilisateurs"""
    
    @staticmethod
    def register(email, password, first_name, last_name):
        """
        Inscrit un nouveau candidat
        
        Returns:
            tuple: (user, error_message)
        """
        # Vérifier si l'email existe déjà
        if User.query.filter_by(email=email.lower()).first():
            return None, "Cet email est déjà utilisé"
        
        # Créer l'utilisateur
        user = User(
            email=email.lower(),
            role='candidate',
            is_active=True,
            is_verified=False
        )
        user.set_password(password)
        
        db.session.add(user)
        db.session.flush()  # Pour obtenir l'ID
        
        # Créer le profil candidat
        candidate = Candidate(
            user_id=user.id,
            first_name=first_name,
            last_name=last_name,
            birth_date=None,
            status='draft'
        )
        db.session.add(candidate)
        
        # Log
        AuditLog.log(
            user_id=user.id,
            action='register',
            entity_type='user',
            entity_id=user.id,
            details=f"Inscription: {email}"
        )
        
        db.session.commit()
        
        return user, None
    
    @staticmethod
    def login(email, password, ip_address=None, user_agent=None):
        """
        Connecte un utilisateur
        
        Returns:
            tuple: (tokens_dict, error_message)
        """
        user = User.query.filter_by(email=email.lower()).first()
        
        if not user or not user.check_password(password):
            return None, "Email ou mot de passe incorrect"
        
        if not user.is_active:
            return None, "Ce compte a été désactivé"
        
        # Mettre à jour last_login
        user.last_login = datetime.utcnow()
        
        # Créer les tokens
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={
                'email': user.email,
                'role': user.role
            }
        )
        refresh_token = create_refresh_token(identity=str(user.id))
        
        # Log
        AuditLog.log(
            user_id=user.id,
            action='login',
            entity_type='user',
            entity_id=user.id,
            ip=ip_address,
            ua=user_agent
        )
        
        db.session.commit()
        
        # Préparer les données utilisateur
        user_data = user.to_dict()
        
        # Ajouter les infos candidat si applicable
        if user.role == 'candidate' and user.candidate:
            user_data['candidate'] = user.candidate.to_dict()
        
        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user_data
        }, None
    
    @staticmethod
    def refresh(user_id):
        """
        Rafraîchit le token d'accès
        
        Returns:
            tuple: (new_access_token, error_message)
        """
        user = User.query.get(user_id)
        
        if not user or not user.is_active:
            return None, "Utilisateur invalide"
        
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={
                'email': user.email,
                'role': user.role
            }
        )
        
        return access_token, None
    
    @staticmethod
    def get_current_user(user_id):
        """
        Récupère l'utilisateur courant avec son profil
        
        Returns:
            tuple: (user_data, error_message)
        """
        user = User.query.get(user_id)
        
        if not user:
            return None, "Utilisateur non trouvé"
        
        user_data = user.to_dict()
        
        if user.role == 'candidate' and user.candidate:
            user_data['candidate'] = user.candidate.to_dict(include_private=True)
        
        return user_data, None
    
    @staticmethod
    def change_password(user_id, current_password, new_password):
        """
        Change le mot de passe
        
        Returns:
            tuple: (success, error_message)
        """
        user = User.query.get(user_id)
        
        if not user:
            return False, "Utilisateur non trouvé"
        
        if not user.check_password(current_password):
            return False, "Mot de passe actuel incorrect"
        
        user.set_password(new_password)
        
        AuditLog.log(
            user_id=user.id,
            action='change_password',
            entity_type='user',
            entity_id=user.id
        )
        
        db.session.commit()
        
        return True, None
    
    @staticmethod
    def verify_email(user_id):
        """Marque l'email comme vérifié"""
        user = User.query.get(user_id)
        if user:
            user.is_verified = True
            db.session.commit()
            return True
        return False
    
    # === RÉCUPÉRATION DE MOT DE PASSE ===
    
    @staticmethod
    def request_password_reset(email):
        """
        Demande une réinitialisation de mot de passe
        
        Le token envoyé est au format: {user_id}:{random_token}
        Seul le random_token est hashé en base. Le user_id permet de cibler
        directement le bon utilisateur sans charger tous les users.
        
        Returns:
            tuple: (success, token_or_none)
            En dev, retourne le token pour test. En prod, envoie un email.
        """
        from app.services.email_service import EmailService
        
        user = User.query.filter_by(email=email.lower()).first()
        
        if not user:
            # Ne pas révéler si l'email existe
            return True, None
        
        # Générer un token sécurisé
        random_part = secrets.token_urlsafe(32)
        # Le token complet inclut le user_id pour lookup direct
        full_token = f"{user.id}:{random_part}"
        
        # Stocker seulement la partie aléatoire hashée
        user.set_reset_token(random_part)
        user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
        
        AuditLog.log(
            user_id=user.id,
            action='request_password_reset',
            entity_type='user',
            entity_id=user.id
        )
        
        db.session.commit()
        
        # Récupérer le prénom si candidat
        first_name = None
        if user.candidate:
            first_name = user.candidate.first_name
        
        # Envoyer l'email avec le lien de reset
        email_sent, email_error = EmailService.send_password_reset_email(user.email, full_token, first_name)
        
        if not email_sent:
            import logging
            logging.warning(f"Erreur envoi email reset: {email_error}")
        
        # En dev, retourner aussi le token pour les tests
        is_dev = current_app.config.get('DEBUG', False)
        
        return True, full_token if is_dev else None
    
    @staticmethod
    def reset_password(token, new_password):
        """
        Réinitialise le mot de passe avec un token
        
        Le token est au format {user_id}:{random_token}.
        On cible directement le user par son ID, puis on vérifie le hash.
        → O(1) au lieu de O(n) avec bcrypt.
        
        Returns:
            tuple: (success, error_message)
        """
        if not token or ':' not in token:
            return False, "Token invalide"
        
        # Extraire user_id et la partie aléatoire
        parts = token.split(':', 1)
        if len(parts) != 2:
            return False, "Token invalide"
        
        try:
            user_id = int(parts[0])
        except (ValueError, TypeError):
            return False, "Token invalide"
        
        random_part = parts[1]
        if len(random_part) < 20:
            return False, "Token invalide"
        
        # Lookup direct par ID — une seule requête SQL
        target_user = User.query.filter(
            User.id == user_id,
            User.reset_token.isnot(None),
            User.reset_token_expires > datetime.utcnow()
        ).first()
        
        if not target_user:
            return False, "Token invalide ou expiré"
        
        # Vérifier le hash — un seul bcrypt.check au lieu de N
        if not target_user.check_reset_token(random_part):
            return False, "Token invalide ou expiré"
        
        # Mettre à jour le mot de passe
        target_user.set_password(new_password)
        target_user.clear_reset_token()
        
        AuditLog.log(
            user_id=target_user.id,
            action='reset_password',
            entity_type='user',
            entity_id=target_user.id
        )
        
        db.session.commit()
        
        return True, None
    
    # === VÉRIFICATION PAR OTP ===
    
    @staticmethod
    def generate_otp(user_id):
        """
        Génère et envoie un code OTP à 6 chiffres
        
        Returns:
            tuple: (success, code_or_error)
            En dev, retourne aussi le code pour test.
        """
        from app.services.email_service import EmailService
        
        user = User.query.get(user_id)
        
        if not user:
            return False, "Utilisateur non trouvé"
        
        if user.is_verified:
            return False, "Email déjà vérifié"
        
        # Générer un code à 6 chiffres
        code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
        
        # Stocker hashé avec expiration 15min
        user.set_otp(code)
        user.otp_expires = datetime.utcnow() + timedelta(minutes=15)
        
        db.session.commit()
        
        # Récupérer le prénom si candidat
        first_name = None
        if user.candidate:
            first_name = user.candidate.first_name
        
        # Envoyer l'email avec le code OTP
        email_sent, email_error = EmailService.send_otp_email(user.email, code, first_name)
        
        if not email_sent:
            # Log l'erreur mais ne bloque pas (pour compatibilité dev)
            import logging
            logging.warning(f"Erreur envoi OTP email: {email_error}")
        
        # En dev, retourner aussi le code pour les tests
        is_dev = current_app.config.get('DEBUG', False)
        
        if email_sent:
            return True, code if is_dev else "Code envoyé par email"
        else:
            # Même si l'email échoue, retourner le code en dev
            return True, code if is_dev else "Code généré (erreur envoi email)"
    
    @staticmethod
    def verify_otp(user_id, code):
        """
        Vérifie le code OTP
        
        Returns:
            tuple: (success, error_message)
        """
        user = User.query.get(user_id)
        
        if not user:
            return False, "Utilisateur non trouvé"
        
        if user.is_verified:
            return True, None  # Déjà vérifié
        
        # Vérifier si un code existe et n'est pas expiré
        if not user.otp_code or not user.otp_expires:
            return False, "Aucun code en attente. Demandez un nouveau code."
        
        if user.otp_expires < datetime.utcnow():
            user.clear_otp()
            db.session.commit()
            return False, "Code expiré. Demandez un nouveau code."
        
        # Vérifier les tentatives
        if (user.otp_attempts or 0) >= 3:
            user.clear_otp()
            db.session.commit()
            return False, "Trop de tentatives. Demandez un nouveau code."
        
        # Vérifier le code
        if not user.check_otp(code):
            user.otp_attempts = (user.otp_attempts or 0) + 1
            db.session.commit()
            remaining = 3 - user.otp_attempts
            return False, f"Code incorrect. {remaining} tentative(s) restante(s)."
        
        # Code correct - marquer comme vérifié
        user.is_verified = True
        user.clear_otp()
        
        AuditLog.log(
            user_id=user.id,
            action='verify_email_otp',
            entity_type='user',
            entity_id=user.id
        )
        
        db.session.commit()
        
        # Envoyer l'email de bienvenue
        if user.candidate:
            from app.services.email_service import EmailService
            EmailService.send_welcome_email(user.email, user.candidate.first_name)
        
        return True, None
