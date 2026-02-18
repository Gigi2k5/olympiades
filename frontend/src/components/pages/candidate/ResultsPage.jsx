import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../../store/AuthContext'
import { 
  Trophy, Clock, Target, TrendingUp, Download, Share2, CheckCircle, 
  XCircle, ChevronDown, ChevronUp, BarChart3, AlertTriangle, Eye
} from 'lucide-react'
import api from '../../../services/api'

const difficultyLabels = { easy: 'Facile', medium: 'Moyen', hard: 'Difficile' }
const difficultyColors = { easy: 'text-green-500', medium: 'text-orange-500', hard: 'text-red-500' }
const optionLabels = ['A', 'B', 'C', 'D']

export default function ResultsPage() {
  const { user } = useAuth()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [filterCategory, setFilterCategory] = useState('Toutes')
  const [filterStatus, setFilterStatus] = useState('all') // all, correct, incorrect

  useEffect(() => {
    const loadResults = async () => {
      try {
        const response = await api.get('/qcm/result')
        if (response.data.success) {
          setResult(response.data.data)
        }
      } catch (error) {
        if (user?.candidate?.qcm_score) {
          setResult({
            score: user.candidate.qcm_score,
            correct_count: Math.round(user.candidate.qcm_score / 5),
            total_questions: 20,
            passed: true,
            duration_minutes: null,
            details: [],
            category_stats: {}
          })
        }
      } finally {
        setLoading(false)
      }
    }
    loadResults()
  }, [user])

  const score = result?.score || user?.candidate?.qcm_score || 0
  const details = result?.details || []
  const categoryStats = result?.category_stats || {}
  const categories = ['Toutes', ...Object.keys(categoryStats)]

  // Filtrer les questions
  const filteredDetails = details.filter(d => {
    if (filterCategory !== 'Toutes' && d.category !== filterCategory) return false
    if (filterStatus === 'correct' && !d.is_correct) return false
    if (filterStatus === 'incorrect' && d.is_correct) return false
    return true
  })

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        <p className="text-slate-500">Chargement des résultats...</p>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="card p-8 text-center">
        <Target className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="font-display text-xl font-semibold text-slate-900 mb-2">
          Aucun résultat disponible
        </h2>
        <p className="text-slate-500">
          Vous n'avez pas encore passé le QCM de sélection.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">Mes Résultats</h1>
        <p className="text-slate-500">Détails de votre performance au QCM de sélection.</p>
      </motion.div>

      {/* Score principal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="card p-8 text-center relative overflow-hidden"
      >
        <div className="absolute inset-0 pattern-dots opacity-10" />
        <div className="relative">
          <Trophy className="w-12 h-12 text-primary-600 mx-auto mb-4" />
          <h2 className="text-xl text-slate-500 mb-2">Votre score</h2>
          <div className="text-7xl font-display font-bold text-gradient mb-4">
            {score.toFixed(0)}%
          </div>
          <p className={`text-lg ${score >= 60 ? 'text-green-400' : 'text-orange-400'}`}>
            {score >= 80 ? '🏆 Excellent !' : score >= 60 ? '✅ Bon travail !' : '📚 À améliorer'}
          </p>
        </div>
      </motion.div>

      {/* Stats détaillées */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Target, label: 'Bonnes réponses', value: `${result.correct_count || 0}/${result.total_questions || 0}` },
          { icon: Clock, label: 'Temps utilisé', value: result.duration_minutes ? `${Math.floor(result.duration_minutes)} min` : '--' },
          { icon: TrendingUp, label: 'Statut', value: result.passed ? 'Réussi ✓' : 'Non réussi' },
          { icon: BarChart3, label: 'Seuil requis', value: `${result.passing_score || 50}%` },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="card p-4 text-center"
          >
            <stat.icon className="w-6 h-6 text-primary-600 mx-auto mb-2" />
            <div className="text-xl font-display font-bold text-slate-900">{stat.value}</div>
            <div className="text-xs text-slate-400">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Avertissements anti-triche */}
      {(result.tab_switches > 0 || result.fullscreen_exits > 0 || result.is_flagged) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={`p-4 rounded-xl border ${result.is_flagged ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${result.is_flagged ? 'text-red-500' : 'text-amber-500'}`} />
            <div className="text-sm">
              <span className="font-medium">{result.is_flagged ? 'Test marqué comme suspect' : 'Incidents détectés'}</span>
              <span className="text-slate-500 ml-2">
                {result.tab_switches > 0 && `${result.tab_switches} changement(s) d'onglet`}
                {result.tab_switches > 0 && result.fullscreen_exits > 0 && ' • '}
                {result.fullscreen_exits > 0 && `${result.fullscreen_exits} sortie(s) plein écran`}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Performance par catégorie */}
      {Object.keys(categoryStats).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="card p-6"
        >
          <h3 className="font-display text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-600" />
            Performance par catégorie
          </h3>
          <div className="space-y-3">
            {Object.entries(categoryStats).map(([cat, stats]) => {
              const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-700 font-medium">{cat}</span>
                    <span className="text-slate-500">{stats.correct}/{stats.total} ({pct}%)</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.8, duration: 0.5 }}
                      className={`h-full rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-orange-500' : 'bg-red-500'}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Détails question par question */}
      {details.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="card overflow-hidden"
        >
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <h3 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary-600" />
              Détails question par question
            </h3>
            {showDetails ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Filtres */}
                <div className="px-6 pb-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-500/20"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="flex gap-1">
                    {[
                      { key: 'all', label: 'Toutes' },
                      { key: 'correct', label: '✓ Correctes' },
                      { key: 'incorrect', label: '✗ Incorrectes' },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setFilterStatus(f.key)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          filterStatus === f.key 
                            ? 'bg-primary-600 text-white' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-sm text-slate-400 self-center ml-auto">
                    {filteredDetails.length} question(s)
                  </span>
                </div>

                {/* Liste des questions */}
                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                  {filteredDetails.map((d, idx) => (
                    <div key={idx} className={`p-6 ${d.is_correct ? '' : 'bg-red-50/30'}`}>
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          d.is_correct ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {d.is_correct 
                            ? <CheckCircle className="w-4 h-4 text-green-600" /> 
                            : <XCircle className="w-4 h-4 text-red-600" />
                          }
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-medium text-slate-400">Q{d.question_index}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{d.category}</span>
                            <span className={`text-xs ${difficultyColors[d.difficulty]}`}>{difficultyLabels[d.difficulty]}</span>
                          </div>
                          <p className="text-slate-900 font-medium">{d.text}</p>
                        </div>
                      </div>

                      {/* Options */}
                      <div className="ml-10 space-y-1.5">
                        {d.options.map((opt, optIdx) => {
                          const isUserAnswer = d.user_answer === optIdx
                          const isCorrectAnswer = d.correct_answer === optIdx
                          const wasWrong = isUserAnswer && !isCorrectAnswer
                          
                          let bg = 'bg-white border-slate-200'
                          if (isCorrectAnswer) bg = 'bg-green-50 border-green-300'
                          if (wasWrong) bg = 'bg-red-50 border-red-300'

                          return (
                            <div
                              key={optIdx}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm ${bg}`}
                            >
                              <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                isCorrectAnswer ? 'bg-green-500 text-white' : 
                                wasWrong ? 'bg-red-500 text-white' : 
                                'bg-slate-100 text-slate-400'
                              }`}>
                                {optionLabels[optIdx]}
                              </span>
                              <span className={`flex-1 ${isCorrectAnswer ? 'text-green-700 font-medium' : wasWrong ? 'text-red-700' : 'text-slate-600'}`}>
                                {opt}
                              </span>
                              {isCorrectAnswer && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                              {wasWrong && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                              {isUserAnswer && !wasWrong && !isCorrectAnswer && (
                                <span className="text-xs text-slate-400">Votre réponse</span>
                              )}
                            </div>
                          )
                        })}
                        {d.user_answer === -1 && (
                          <p className="text-xs text-slate-400 italic mt-1">Pas de réponse donnée</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
