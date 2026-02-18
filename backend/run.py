"""
Point d'entrée pour lancer l'application
- Production : gunicorn run:app
- Développement : python run.py
"""
import os
from app import create_app, db

# ── Déterminer l'environnement ────────────────────────────
env = os.environ.get('FLASK_ENV', 'production')

# ── Créer l'application ──────────────────────────────────
# En production → ProductionConfig, sinon → DevelopmentConfig
config_name = 'production' if env == 'production' else 'development'
app = create_app(config_name)


def _init_database():
    """
    Initialise la base de données :
    - Crée toutes les tables manquantes (safe même si elles existent déjà)
    - Crée l'admin par défaut si aucun n'existe
    - Crée les paramètres QCM par défaut

    db.create_all() est idempotent : il ne touche pas aux tables existantes.
    """
    from app.models import User, QCMSettings

    db.create_all()

    # Admin par défaut
    admin = User.query.filter_by(role='admin').first()
    if not admin:
        admin = User(
            email=os.environ.get('ADMIN_EMAIL', 'admin@olympiades-ia.bj'),
            role='admin',
            is_active=True,
            is_verified=True
        )
        admin.set_password(os.environ.get('ADMIN_PASSWORD', 'OlympiadesIA2026!'))
        db.session.add(admin)
        db.session.commit()
        print("✓ Admin par défaut créé")

    # Paramètres QCM par défaut
    if not QCMSettings.query.first():
        settings = QCMSettings(
            total_questions=30,
            duration_minutes=45,
            passing_score=50,
            easy_count=5,
            medium_count=15,
            hard_count=10,
            randomize_questions=True,
            randomize_options=True,
            show_score_immediately=True
        )
        db.session.add(settings)
        db.session.commit()
        print("✓ Paramètres QCM créés")


# ── Initialiser la DB au démarrage ────────────────────────
# Exécuté quand gunicorn importe ce module OU quand on lance python run.py
with app.app_context():
    try:
        _init_database()
    except Exception as e:
        print(f"⚠ Erreur init DB (normal au 1er déploiement si DB pas encore prête): {e}")


# ── Lancement direct (dev uniquement) ────────────────────
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = env != 'production'

    print(f"""
    ╔═══════════════════════════════════════════════════════════╗
    ║           🏆 Olympiades IA Bénin - API Backend            ║
    ╠═══════════════════════════════════════════════════════════╣
    ║  Environment : {env:<42} ║
    ║  Config      : {config_name:<42} ║
    ║  Port        : {port:<42} ║
    ║  Debug       : {str(debug):<42} ║
    ║  URL         : http://localhost:{port:<36} ║
    ╚═══════════════════════════════════════════════════════════╝
    """)

    app.run(host='0.0.0.0', port=port, debug=debug)
