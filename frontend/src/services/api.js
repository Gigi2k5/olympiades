import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

// Log l'URL API au démarrage (utile pour debug déploiement)
if (import.meta.env.DEV) {
  console.log('🔗 API URL:', API_URL)
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30s timeout (Render free peut être lent au cold start)
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── Intercepteur requête : ajouter le token ──────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Intercepteur réponse : refresh token + gestion erreurs ──
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // ── Erreur réseau (CORS bloqué, serveur down, etc.) ──
    if (!error.response) {
      console.error('❌ Erreur réseau — vérifier CORS ou que le backend est accessible:', API_URL)
      // Ne pas rediriger, juste remonter l'erreur
      return Promise.reject(error)
    }

    // ── Token expiré → tenter un refresh ──
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {}, {
            headers: { Authorization: `Bearer ${refreshToken}` },
            timeout: 15000,
          })

          if (response.data.success) {
            localStorage.setItem('access_token', response.data.access_token)
            originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`
            return api(originalRequest)
          }
        } catch (refreshError) {
          // Refresh token invalide aussi
          console.warn('🔒 Refresh token invalide, déconnexion')
        }
      }

      // Déconnexion propre
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      window.location.href = '/connexion'
    }

    return Promise.reject(error)
  }
)

export default api
