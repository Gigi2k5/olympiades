"""
Application Factory - Point d'entrée principal
"""
import logging
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from config import config

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Extensions Flask
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

# Le limiter sera initialisé dans create_app avec le bon storage
limiter = None

# Store Redis pour la blacklist JWT (fallback in-memory si pas de Redis)
_jwt_blacklist = set()
_redis_client = None


def _get_redis_client(redis_url):
    """Tente de créer un client Redis, retourne None si indisponible"""
    if not redis_url:
        return None
    try:
        import redis
        client = redis.from_url(redis_url, decode_responses=True, socket_timeout=2)
        client.ping()
        logger.info("✓ Redis connecté pour rate limiter + blacklist JWT")
        return client
    except Exception as e:
        logger.warning(f"⚠ Redis indisponible ({e}), fallback mémoire locale")
        return None


def create_app(config_name='default'):
    """
    Factory pattern pour créer l'application Flask
    """
    global limiter, _redis_client, _jwt_blacklist
    
    app = Flask(__name__)
    
    # Charger la configuration
    app.config.from_object(config[config_name])
    
    # ── Redis ────────────────────────────────────────────
    redis_url = app.config.get('REDIS_URL', '')
    _redis_client = _get_redis_client(redis_url)
    
    # ── Rate Limiter (Redis si dispo, sinon mémoire) ─────
    storage_uri = redis_url if _redis_client else "memory://"
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["200 per hour"],
        storage_uri=storage_uri,
        app=app
    )
    
    # Initialiser les extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    
    # Configurer CORS — critique pour Vercel (frontend) → Render (backend)
    cors_origins = app.config['CORS_ORIGINS']
    
    # Si '*' est dans la liste, autoriser tout (utile pour debug)
    if '*' in cors_origins:
        cors_origins = '*'
    
    CORS(app, 
         origins=cors_origins,
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
         expose_headers=['Content-Type', 'Authorization'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
         max_age=600)  # Cache les preflight 10min
    
    # === Callbacks JWT — Blacklist ===
    
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        """Vérifie si le token est dans la blacklist (Redis ou mémoire)"""
        jti = jwt_payload['jti']
        if _redis_client:
            return _redis_client.get(f"jwt_blacklist:{jti}") is not None
        return jti in _jwt_blacklist
    
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            'success': False,
            'error': 'Token expiré',
            'code': 'TOKEN_EXPIRED'
        }), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        logger.warning(f"Invalid token: {error}")
        return jsonify({
            'success': False,
            'error': 'Token invalide',
            'code': 'TOKEN_INVALID'
        }), 401
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        logger.warning(f"Missing token: {error}")
        return jsonify({
            'success': False,
            'error': 'Token manquant',
            'code': 'TOKEN_MISSING'
        }), 401
    
    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return jsonify({
            'success': False,
            'error': 'Token révoqué',
            'code': 'TOKEN_REVOKED'
        }), 401
    
    # === Error Handlers ===
    
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            'success': False,
            'error': 'Requête invalide'
        }), 400
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'success': False,
            'error': 'Ressource non trouvée'
        }), 404
    
    @app.errorhandler(429)
    def ratelimit_handler(error):
        return jsonify({
            'success': False,
            'error': 'Trop de requêtes. Veuillez réessayer plus tard.',
            'code': 'RATE_LIMITED'
        }), 429
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'Erreur interne du serveur'
        }), 500
    
    # === Routes ===
    
    # Enregistrer les blueprints
    from app.api import api_bp
    app.register_blueprint(api_bp, url_prefix='/api/v1')
    
    # Route de santé (hors API)
    @app.route('/health')
    def health_check():
        return jsonify({
            'status': 'healthy',
            'message': 'Olympiades IA Bénin API v1.0',
            'redis': 'connected' if _redis_client else 'unavailable',
            'storage': app.config.get('STORAGE_BACKEND', 'local')
        })
    
    # Route pour servir les fichiers uploadés (mode local uniquement)
    from flask import send_from_directory
    import os
    
    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        if app.config.get('STORAGE_BACKEND') == 's3':
            # En mode S3, rediriger vers l'URL S3
            from app.services.file_service import FileService
            url = FileService.get_file_url(filename)
            if url:
                from flask import redirect
                return redirect(url)
            return jsonify({'error': 'Fichier non trouvé'}), 404
        upload_folder = app.config.get('UPLOAD_FOLDER', 'uploads')
        return send_from_directory(upload_folder, filename)
    
    # NB: db.create_all() n'est PAS appelé ici.
    # En production, utiliser Flask-Migrate : flask db upgrade
    # En dev, run.py appelle db.create_all() au premier lancement.
    
    return app


def blacklist_token(jti, expires_in_seconds=3600):
    """
    Ajoute un token à la blacklist.
    
    Args:
        jti: identifiant unique du token JWT
        expires_in_seconds: durée de blacklist (doit >= durée de vie du token)
    """
    if _redis_client:
        _redis_client.setex(f"jwt_blacklist:{jti}", expires_in_seconds, "revoked")
    else:
        _jwt_blacklist.add(jti)
