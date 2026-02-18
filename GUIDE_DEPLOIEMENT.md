# 🚀 Guide de Déploiement — Olympiades IA Bénin

## Architecture de déploiement

```
┌──────────────────────┐          ┌──────────────────────────┐
│   VERCEL (Frontend)  │  HTTPS   │   RENDER (Backend API)   │
│                      │ ───────► │                          │
│  React + Vite        │          │  Flask + Gunicorn        │
│  olympiades-ia       │          │  olympiades-ia-api       │
│  .vercel.app         │          │  .onrender.com           │
└──────────────────────┘          └────────┬─────────────────┘
                                           │
                                  ┌────────▼─────────────────┐
                                  │  RENDER PostgreSQL (Free) │
                                  │  olympiades-db            │
                                  └──────────────────────────┘
```

---

## ÉTAPE 1 : Préparer le code

### 1.1 — Structure des repos Git

Tu as deux options :

**Option A — Monorepo (1 seul repo)** ← Recommandé
```
olympiades-ia/
├── backend/
│   ├── app/
│   ├── run.py
│   ├── config.py
│   ├── requirements.txt
│   └── ...
└── frontend/
    ├── src/
    ├── package.json
    └── ...
```

**Option B — Deux repos séparés**
```
olympiades-ia-api/     → tout le contenu de backend/
olympiades-ia-front/   → tout le contenu de frontend/
```

### 1.2 — Vérifier les fichiers modifiés

Assure-toi d'avoir ces fichiers à jour (fournis dans ce package) :

| Fichier | Ce qui a changé |
|---------|----------------|
| `backend/run.py` | Fonctionne en prod ET en dev, init DB toujours |
| `backend/config.py` | ProductionConfig correcte |
| `backend/app/__init__.py` | CORS robuste avec max_age |
| `backend/render.yaml` | PostgreSQL, bonnes variables |
| `backend/Procfile` | Commande gunicorn correcte |
| `backend/runtime.txt` | Python 3.11.7 |
| `frontend/.env.production` | URL API Render |
| `frontend/vercel.json` | SPA rewrites + headers sécurité |
| `frontend/src/services/api.js` | Timeout 30s, gestion erreurs réseau |

---

## ÉTAPE 2 : Déployer le Backend sur Render

### 2.1 — Créer la base de données PostgreSQL

1. Va sur [render.com](https://render.com) → **Dashboard**
2. Clique **New +** → **PostgreSQL**
3. Remplis :
   - **Name** : `olympiades-db`
   - **Region** : `Frankfurt (EU)` (le plus proche de l'Afrique)
   - **Plan** : Free
4. Clique **Create Database**
5. Attends que le statut passe à "Available"
6. **COPIE** l'**Internal Database URL** (tu en auras besoin)
   - Ça ressemble à : `postgres://olympiades_user:xxxxx@dpg-xxxxx/olympiades_ia`

### 2.2 — Créer le Web Service

1. **New +** → **Web Service**
2. Connecte ton repo Git
3. Si monorepo, dans **Root Directory** mets : `backend`
4. Configure :

| Champ | Valeur |
|-------|--------|
| **Name** | `olympiades-ia-api` |
| **Region** | `Frankfurt (EU)` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 --preload run:app` |
| **Plan** | Free |

### 2.3 — Variables d'environnement (CRITIQUE ⚠️)

Dans l'onglet **Environment** du Web Service, ajoute ces variables **une par une** :

```
FLASK_ENV=production

DATABASE_URL=postgres://olympiades_user:xxxxx@dpg-xxxxx/olympiades_ia
↑ Colle l'Internal Database URL copiée à l'étape 2.1

SECRET_KEY=<générer avec : python -c "import secrets; print(secrets.token_hex(32))">
JWT_SECRET_KEY=<générer avec : python -c "import secrets; print(secrets.token_hex(32))">

CORS_ORIGINS=https://ton-app.vercel.app
↑ Tu mettras la vraie URL après le déploiement frontend

FRONTEND_URL=https://ton-app.vercel.app

ADMIN_EMAIL=admin@olympiades-ia.bj
ADMIN_PASSWORD=<un mot de passe fort>

BREVO_API_KEY=xkeysib-xxxxx
BREVO_SENDER_EMAIL=charbelnoukon@gmail.com
BREVO_SENDER_NAME=Olympiades IA Bénin

STORAGE_BACKEND=local
```

### 2.4 — Déployer

1. Clique **Create Web Service**
2. Attends le build (2-3 minutes)
3. Vérifie les logs — tu dois voir :
   ```
   ✓ Admin par défaut créé
   ✓ Paramètres QCM créés
   ```
4. Teste l'URL : `https://olympiades-ia-api.onrender.com/health`
   - Tu dois voir : `{"status": "healthy", ...}`

### 2.5 — Note sur le Cold Start (plan Free)

Le plan Free de Render **éteint le service après 15min d'inactivité**.
La première requête après un cold start prend **30-50 secondes**.
C'est pour ça qu'on a mis `timeout: 30000` dans api.js.

---

## ÉTAPE 3 : Déployer le Frontend sur Vercel

### 3.1 — Configurer `.env.production`

Avant de push, modifie `frontend/.env.production` :
```
VITE_API_URL=https://olympiades-ia-api.onrender.com/api/v1
```
↑ Remplace par l'URL réelle de ton backend Render.

### 3.2 — Déployer sur Vercel

1. Va sur [vercel.com](https://vercel.com) → **Add New Project**
2. Importe ton repo Git
3. Configure :

| Champ | Valeur |
|-------|--------|
| **Framework Preset** | Vite |
| **Root Directory** | `frontend` (si monorepo) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

4. Dans **Environment Variables**, ajoute :
```
VITE_API_URL=https://olympiades-ia-api.onrender.com/api/v1
```
> Note : Vercel utilise cette variable au **build time**. Si tu la changes, il faut redéployer.

5. Clique **Deploy**

### 3.3 — Récupérer l'URL Vercel

Après déploiement, Vercel te donne une URL :
```
https://olympiades-ia-xxxx.vercel.app
```

Si tu as un domaine personnalisé, configure-le dans **Settings → Domains**.

---

## ÉTAPE 4 : Connecter Frontend ↔ Backend (CORS)

**C'est ici que la plupart des problèmes arrivent.**

### 4.1 — Mettre à jour CORS_ORIGINS sur Render

1. Va sur Render → ton Web Service → **Environment**
2. Modifie `CORS_ORIGINS` avec l'URL exacte de ton frontend Vercel :
   ```
   CORS_ORIGINS=https://olympiades-ia-xxxx.vercel.app
   ```
   
   **ATTENTION** :
   - Pas de `/` à la fin
   - `https://` obligatoire
   - L'URL doit être **exacte** (pas de wildcard en production)
   
   Si tu as un domaine custom + l'URL Vercel :
   ```
   CORS_ORIGINS=https://olympiades-ia.bj,https://olympiades-ia-xxxx.vercel.app
   ```

3. Modifie aussi `FRONTEND_URL` avec la même URL
4. Clique **Save Changes** → Render redéploie automatiquement

### 4.2 — Vérifier que CORS fonctionne

Ouvre la console du navigateur (F12) sur ton frontend et vérifie :
- ✅ Pas d'erreur `CORS policy` en rouge
- ✅ Les requêtes vers l'API retournent bien des données
- ✅ Le login fonctionne

Si tu vois une erreur CORS :
1. Vérifie que `CORS_ORIGINS` est exactement l'URL de ton frontend
2. Vérifie que le backend a bien redémarré après le changement
3. Vide le cache du navigateur (Ctrl+Shift+R)

---

## ÉTAPE 5 : Vérifications post-déploiement

### Checklist

- [ ] `https://ton-backend.onrender.com/health` retourne `{"status": "healthy"}`
- [ ] La page d'accueil du frontend s'affiche
- [ ] L'inscription fonctionne
- [ ] Le login fonctionne
- [ ] Le profil candidat se charge
- [ ] L'admin peut se connecter avec `admin@olympiades-ia.bj`
- [ ] Le dashboard admin affiche les stats
- [ ] Upload de photo fonctionne
- [ ] Upload de bulletin fonctionne
- [ ] Le QCM démarre (si des questions existent)

---

## Dépannage

### Erreur : "Application error" sur Render
→ Vérifie les **Logs** dans le dashboard Render
→ Cause fréquente : `DATABASE_URL` non configurée ou invalide

### Erreur : CORS bloqué dans la console
→ Vérifie `CORS_ORIGINS` dans les variables Render
→ L'URL doit être EXACTE, sans slash final

### Erreur : "Network Error" dans le frontend
→ Le backend est en cold start (attends 30s et réessaie)
→ Ou `VITE_API_URL` est encore sur `localhost`

### Erreur : les tables n'existent pas
→ Le nouveau `run.py` crée les tables automatiquement
→ Vérifie les logs Render pour voir si l'init s'est bien passée

### Erreur : "Token expiré" en boucle
→ Le frontend fait bien un refresh automatique
→ Vérifie que `JWT_SECRET_KEY` n'a pas changé entre deux déploiements

### Les uploads disparaissent après redéploiement
→ C'est normal avec `STORAGE_BACKEND=local` sur Render free
→ Solution : passer à S3 (voir section suivante)

---

## Bonus : Configurer S3 pour les uploads persistants

Pour éviter de perdre les fichiers à chaque redéploiement :

1. Crée un bucket S3 (AWS, Cloudflare R2, ou MinIO)
2. Ajoute ces variables sur Render :
   ```
   STORAGE_BACKEND=s3
   AWS_ACCESS_KEY_ID=xxx
   AWS_SECRET_ACCESS_KEY=xxx
   AWS_S3_BUCKET=olympiades-ia-uploads
   AWS_S3_REGION=eu-west-3
   ```
3. Le code gère déjà S3 dans `file_service.py` — rien à changer !

---

## Résumé des URLs

| Service | URL |
|---------|-----|
| Frontend | `https://ton-app.vercel.app` |
| Backend API | `https://olympiades-ia-api.onrender.com` |
| Health check | `https://olympiades-ia-api.onrender.com/health` |
| API base | `https://olympiades-ia-api.onrender.com/api/v1` |
| PostgreSQL | Interne à Render (pas d'accès externe sur le free tier) |
