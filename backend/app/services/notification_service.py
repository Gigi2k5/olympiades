"""
Service de notifications
"""
from datetime import datetime
from app import db
from app.models import Notification, User, Candidate


class NotificationService:
    """Gère les notifications utilisateur"""
    
    @staticmethod
    def notify(user_id, title, message, type='info', link=None):
        """
        Crée une notification pour un utilisateur
        
        Args:
            user_id: ID de l'utilisateur
            title: Titre de la notification
            message: Message
            type: Type (info, success, warning, action)
            link: Lien optionnel
            
        Returns:
            Notification: La notification créée
        """
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=type,
            link=link
        )
        db.session.add(notification)
        db.session.commit()
        return notification
    
    @staticmethod
    def notify_candidate_validated(user_id):
        """Notifie qu'une candidature a été validée"""
        return NotificationService.notify(
            user_id=user_id,
            title="Candidature validée ✓",
            message="Votre candidature a été validée ! Vous pouvez maintenant passer le test national QCM.",
            type='success',
            link='/qcm'
        )
    
    @staticmethod
    def notify_candidate_rejected(user_id, reason=None):
        """Notifie qu'une candidature a été rejetée"""
        message = "Votre candidature a été rejetée."
        if reason:
            message += f" Motif : {reason}"
        message += " Vous pouvez modifier votre profil et soumettre à nouveau."
        
        return NotificationService.notify(
            user_id=user_id,
            title="Candidature rejetée",
            message=message,
            type='warning',
            link='/profil'
        )
    
    @staticmethod
    def notify_qcm_result(user_id, score):
        """Notifie le résultat du QCM"""
        score_percent = round(score, 1)
        
        if score >= 70:
            title = f"Excellent résultat : {score_percent}% ! 🎉"
            message = f"Félicitations ! Vous avez obtenu {score_percent}% au test national. Consultez vos résultats détaillés."
            type = 'success'
        elif score >= 50:
            title = f"Résultat QCM : {score_percent}%"
            message = f"Vous avez obtenu {score_percent}% au test national. Consultez vos résultats détaillés."
            type = 'info'
        else:
            title = f"Résultat QCM : {score_percent}%"
            message = f"Vous avez obtenu {score_percent}% au test national. Consultez vos résultats pour voir les axes d'amélioration."
            type = 'info'
        
        return NotificationService.notify(
            user_id=user_id,
            title=title,
            message=message,
            type=type,
            link='/resultats'
        )
    
    @staticmethod
    def notify_profile_reminder(user_id):
        """Rappel pour compléter le profil"""
        return NotificationService.notify(
            user_id=user_id,
            title="Complétez votre profil",
            message="N'oubliez pas de compléter et soumettre votre profil pour participer aux Olympiades IA 2026.",
            type='action',
            link='/profil'
        )
    
    @staticmethod
    def broadcast(title, message, type='info', link=None, filters=None):
        """
        Envoie une notification à plusieurs utilisateurs, par lots de 500
        pour éviter les pics mémoire et les commits SQL massifs.
        
        Args:
            title: Titre
            message: Message
            type: Type
            link: Lien optionnel
            filters: dict avec 'status', 'region', 'role' pour filtrer les destinataires
            
        Returns:
            int: Nombre de notifications envoyées
        """
        BATCH_SIZE = 500
        
        # Query de base : seulement les IDs (léger)
        query = db.session.query(User.id).filter(
            User.is_active == True,
            User.role == 'candidate'
        )
        
        # Appliquer les filtres si présents
        if filters:
            if filters.get('status'):
                query = query.join(Candidate).filter(Candidate.status == filters['status'])
            
            if filters.get('region'):
                # Éviter un double join si déjà jointé
                if not filters.get('status'):
                    query = query.join(Candidate)
                query = query.filter(Candidate.region == filters['region'])
        
        user_ids = [row[0] for row in query.all()]
        total_sent = 0
        
        # Traiter par lots
        for i in range(0, len(user_ids), BATCH_SIZE):
            batch_ids = user_ids[i:i + BATCH_SIZE]
            notifications = []
            
            for uid in batch_ids:
                notif = Notification(
                    user_id=uid,
                    title=title,
                    message=message,
                    type=type,
                    link=link
                )
                notifications.append(notif)
            
            if notifications:
                db.session.add_all(notifications)
                db.session.commit()
                total_sent += len(notifications)
        
        return total_sent
    
    @staticmethod
    def get_user_notifications(user_id, page=1, per_page=20, unread_only=False):
        """
        Récupère les notifications d'un utilisateur
        
        Returns:
            tuple: (notifications, total_count)
        """
        query = Notification.query.filter(Notification.user_id == user_id)
        
        if unread_only:
            query = query.filter(Notification.is_read == False)
        
        query = query.order_by(Notification.created_at.desc())
        
        total = query.count()
        notifications = query.offset((page - 1) * per_page).limit(per_page).all()
        
        return notifications, total
    
    @staticmethod
    def get_unread_count(user_id):
        """Retourne le nombre de notifications non lues"""
        return Notification.query.filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).count()
    
    @staticmethod
    def mark_as_read(notification_id, user_id):
        """
        Marque une notification comme lue
        
        Returns:
            tuple: (success, error_message)
        """
        notification = Notification.query.filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        
        if not notification:
            return False, "Notification non trouvée"
        
        notification.mark_as_read()
        db.session.commit()
        return True, None
    
    @staticmethod
    def mark_all_as_read(user_id):
        """Marque toutes les notifications comme lues"""
        Notification.query.filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).update({
            'is_read': True,
            'read_at': datetime.utcnow()
        })
        db.session.commit()
        return True
    
    @staticmethod
    def delete_notification(notification_id, user_id):
        """Supprime une notification"""
        notification = Notification.query.filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        
        if notification:
            db.session.delete(notification)
            db.session.commit()
            return True
        return False
