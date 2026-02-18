import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../store/AuthContext'
import { 
  Clock, AlertTriangle, CheckCircle, ArrowRight, ArrowLeft, Send, Brain, Target,
  Shield, Maximize, Eye, XCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'

const TOTAL_TIME = 30 * 60 // 30 minutes en secondes (fallback)

export default function QCMPage() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState('loading') // loading, intro, warning, quiz, result
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME)
  const [score, setScore] = useState(null)
  const [questions, setQuestions] = useState([])
  const [attemptId, setAttemptId] = useState(null)
  const [qcmSettings, setQcmSettings] = useState(null)
  const [qcmStatus, setQcmStatus] = useState(null)
  
  // Anti-triche states
  const [rulesAccepted, setRulesAccepted] = useState(false)
  const [tabSwitchCount, setTabSwitchCount] = useState(0)
  const [fullscreenExits, setFullscreenExits] = useState(0)
  const isSubmittingRef = useRef(false)

  // Charger le statut du QCM au démarrage
  useEffect(() => {
    const loadQCMStatus = async () => {
      try {
        const [statusRes, settingsRes] = await Promise.all([
          api.get('/qcm/status'),
          api.get('/qcm/settings')
        ])
        
        if (statusRes.data.success) {
          setQcmStatus(statusRes.data.data)
          
          // Si QCM déjà complété, aller directement aux résultats
          if (statusRes.data.data.status === 'completed') {
            setScore(statusRes.data.data.score)
            setStep('result')
            return
          }
          
          // Si QCM en cours, reprendre
          if (statusRes.data.data.status === 'in_progress') {
            await resumeQCM(statusRes.data.data.attempt_id)
            return
          }
        }
        
        if (settingsRes.data.success) {
          setQcmSettings(settingsRes.data.data)
        }
        
        setStep('intro')
      } catch (error) {
        console.error('Erreur chargement QCM:', error)
        toast.error('Erreur lors du chargement du QCM')
        setStep('intro')
      }
    }
    
    loadQCMStatus()
  }, [])

  // Reprendre un QCM en cours
  const resumeQCM = async (existingAttemptId) => {
    try {
      const response = await api.post('/qcm/start')
      if (response.data.success) {
        const data = response.data.data
        setAttemptId(data.attempt_id)
        setQuestions(data.questions)
        setTimeLeft(data.time_remaining_seconds)
        
        // Restaurer les réponses
        const savedAnswers = {}
        data.answers?.forEach((ans, idx) => {
          if (ans !== -1 && data.questions[idx]) {
            savedAnswers[data.questions[idx].id] = ['A', 'B', 'C', 'D'][ans]
          }
        })
        setAnswers(savedAnswers)
        
        // Restaurer les compteurs anti-triche
        if (data.tab_switches) setTabSwitchCount(data.tab_switches)
        if (data.fullscreen_exits) setFullscreenExits(data.fullscreen_exits)
        
        setStep('quiz')
        
        // Tenter de passer en plein écran
        requestFullscreen()
      }
    } catch (error) {
      console.error('Erreur reprise QCM:', error)
      toast.error('Erreur lors de la reprise du QCM')
    }
  }

  // Anti-triche: Listeners
  useEffect(() => {
    if (step !== 'quiz') return

    // Détection changement d'onglet
    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmittingRef.current) {
        const newCount = tabSwitchCount + 1
        setTabSwitchCount(newCount)
        
        // Reporter l'événement au backend
        if (attemptId) {
          api.post('/qcm/report-event', {
            attempt_id: attemptId,
            event_type: 'tab_switch',
            timestamp: new Date().toISOString()
          }).catch(console.error)
        }
        
        if (newCount === 1) {
          toast.error('⚠️ Avertissement 1/3 : Ne changez pas d\'onglet !', { duration: 5000 })
        } else if (newCount === 2) {
          toast.error('⚠️ Avertissement 2/3 : Prochain changement = soumission automatique !', { duration: 5000 })
        } else if (newCount >= 3) {
          toast.error('Test soumis automatiquement pour comportement suspect.', { duration: 5000 })
          handleSubmit()
        }
      }
    }

    // Détection sortie plein écran
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !isSubmittingRef.current) {
        setFullscreenExits(prev => prev + 1)
        
        // Reporter l'événement au backend
        if (attemptId) {
          api.post('/qcm/report-event', {
            attempt_id: attemptId,
            event_type: 'fullscreen_exit',
            timestamp: new Date().toISOString()
          }).catch(console.error)
        }
        
        toast.error('Veuillez rester en mode plein écran.', { duration: 3000 })
        
        // Tenter de repasser en plein écran
        setTimeout(() => {
          requestFullscreen()
        }, 500)
      }
    }

    // Bloquer clic droit
    const preventContextMenu = (e) => {
      e.preventDefault()
      toast.error('Clic droit désactivé pendant le test.', { duration: 2000 })
    }

    // Bloquer copier/coller
    const preventCopy = (e) => {
      e.preventDefault()
      toast.error('Copier/coller désactivé pendant le test.', { duration: 2000 })
    }

    // Ajouter les listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('contextmenu', preventContextMenu)
    document.addEventListener('copy', preventCopy)
    document.addEventListener('paste', preventCopy)
    document.addEventListener('cut', preventCopy)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('contextmenu', preventContextMenu)
      document.removeEventListener('copy', preventCopy)
      document.removeEventListener('paste', preventCopy)
      document.removeEventListener('cut', preventCopy)
    }
  }, [step, tabSwitchCount, attemptId])

  // Fonction pour demander le plein écran
  const requestFullscreen = () => {
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {})
      } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen()
      } else if (document.documentElement.msRequestFullscreen) {
        document.documentElement.msRequestFullscreen()
      }
    } catch (error) {
      console.log('Fullscreen not supported')
    }
  }

  // Fonction pour quitter le plein écran
  const exitFullscreen = () => {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen()
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen()
      }
    } catch (error) {
      console.log('Exit fullscreen error')
    }
  }

  // Timer
  useEffect(() => {
    if (step !== 'quiz') return
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [step])

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleAnswer = async (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
    
    // Sauvegarder la réponse en temps réel
    if (attemptId) {
      try {
        const answerIndex = ['A', 'B', 'C', 'D'].indexOf(answer)
        await api.post('/qcm/answer', {
          attempt_id: attemptId,
          question_index: currentQuestion,
          answer_index: answerIndex
        })
      } catch (error) {
        console.error('Erreur sauvegarde réponse:', error)
      }
    }
  }

  const startQCM = async () => {
    try {
      // Passer en plein écran
      requestFullscreen()
      
      const response = await api.post('/qcm/start')
      if (response.data.success) {
        const data = response.data.data
        setAttemptId(data.attempt_id)
        setQuestions(data.questions)
        setTimeLeft(data.time_remaining_seconds)
        setStep('quiz')
      } else {
        toast.error(response.data.error || 'Impossible de démarrer le QCM')
      }
    } catch (error) {
      console.error('Erreur démarrage QCM:', error)
      toast.error(error.response?.data?.error || 'Erreur lors du démarrage du QCM')
    }
  }

  const handleSubmit = useCallback(async () => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    
    // Quitter le plein écran
    exitFullscreen()
    
    if (!attemptId) {
      // Mode fallback avec questions mock si pas d'attemptId
      const mockQuestions = questions.length > 0 ? questions : []
      let correct = 0
      mockQuestions.forEach(q => {
        const answerIndex = ['A', 'B', 'C', 'D'].indexOf(answers[q.id])
        if (answerIndex === q.correct_answer) correct++
      })
      const finalScore = mockQuestions.length > 0 ? (correct / mockQuestions.length) * 100 : 0
      setScore(finalScore)
      setStep('result')
      toast.success('QCM soumis avec succès !')
      return
    }
    
    try {
      const response = await api.post('/qcm/submit', { attempt_id: attemptId })
      
      if (response.data.success) {
        const result = response.data.data
        setScore(result.score)
        
        updateUser({
          candidate: {
            ...user.candidate,
            qcm_score: result.score,
            qcm_passed: true
          }
        })
        
        setStep('result')
        toast.success('QCM soumis avec succès !')
      } else {
        toast.error(response.data.error || 'Erreur lors de la soumission')
        isSubmittingRef.current = false
      }
    } catch (error) {
      console.error('Erreur soumission QCM:', error)
      toast.error(error.response?.data?.error || 'Erreur lors de la soumission du QCM')
      isSubmittingRef.current = false
    }
  }, [answers, user, updateUser, attemptId, questions])

  const question = questions[currentQuestion]

  // Couleur du bandeau d'avertissement
  const getWarningBannerColor = () => {
    if (tabSwitchCount === 0) return null
    if (tabSwitchCount === 1) return 'bg-amber-50 border-amber-200 text-amber-700'
    if (tabSwitchCount === 2) return 'bg-orange-50 border-orange-200 text-orange-700'
    return 'bg-red-50 border-red-200 text-red-700'
  }

  // Loading state
  if (step === 'loading') {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-[#206080]/20 border-t-[#206080] rounded-full animate-spin" />
          <p className="text-slate-500">Chargement du QCM...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
      <AnimatePresence mode="wait">
        {/* INTRO */}
        {step === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl border border-slate-200 p-8 text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#206080] to-[#208080] 
                          flex items-center justify-center shadow-lg">
              <Brain className="w-10 h-10 text-white" />
            </div>
            
            <h1 className="font-display text-2xl font-bold text-slate-900 mb-4">
              QCM de Sélection
            </h1>
            <p className="text-slate-500 mb-8 max-w-md mx-auto">
              Ce test évalue vos capacités de raisonnement logique. 
              Vous avez {qcmSettings?.duration_minutes || 30} minutes pour répondre à {qcmSettings?.total_questions || 20} questions.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {[
                { icon: Target, label: `${qcmSettings?.total_questions || 20} questions`, value: 'Logique & Math' },
                { icon: Clock, label: `${qcmSettings?.duration_minutes || 30} minutes`, value: 'Temps limité' },
                { icon: AlertTriangle, label: 'Une seule', value: 'Tentative' },
              ].map((item) => (
                <div key={item.label} className="p-4 rounded-xl bg-slate-50">
                  <item.icon className="w-6 h-6 text-[#206080] mx-auto mb-2" />
                  <div className="font-semibold text-slate-900">{item.label}</div>
                  <div className="text-xs text-slate-400">{item.value}</div>
                </div>
              ))}
            </div>

            {qcmStatus && !qcmStatus.can_start && qcmStatus.message && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 mb-8 text-left">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-700 font-medium">Information</p>
                    <p className="text-sm text-slate-600">{qcmStatus.message}</p>
                  </div>
                </div>
              </div>
            )}

            {(!qcmStatus || qcmStatus.can_start) && (
              <motion.button
                onClick={() => setStep('warning')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-3 bg-[#206080] text-white font-semibold rounded-xl hover:bg-[#185068] transition-colors"
              >
                Continuer
              </motion.button>
            )}
          </motion.div>
        )}

        {/* WARNING - Écran d'avertissement anti-triche */}
        {step === 'warning' && (
          <motion.div
            key="warning"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl border border-slate-200 p-8"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-100 flex items-center justify-center">
                <Shield className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Règles du test
              </h2>
            </div>

            <div className="space-y-4 mb-8">
              {[
                { icon: Maximize, text: 'Le test se déroule en mode plein écran' },
                { icon: Eye, text: 'Ne changez pas d\'onglet pendant le test' },
                { icon: XCircle, text: 'Le copier-coller est désactivé' },
                { icon: AlertTriangle, text: '3 changements d\'onglet = soumission automatique' },
                { icon: Shield, text: 'Votre comportement est enregistré' },
              ].map((rule, idx) => (
                <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                    <rule.icon className="w-5 h-5 text-slate-600" />
                  </div>
                  <p className="text-slate-700">{rule.text}</p>
                </div>
              ))}
            </div>

            <label className="flex items-start gap-3 p-4 bg-[#206080]/5 border border-[#206080]/20 rounded-xl cursor-pointer mb-6">
              <input
                type="checkbox"
                checked={rulesAccepted}
                onChange={(e) => setRulesAccepted(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-slate-300 text-[#206080] focus:ring-[#206080]"
              />
              <span className="text-slate-700">
                J'ai lu et j'accepte les règles du test. Je comprends que tout comportement suspect 
                entraînera la soumission automatique de mon test.
              </span>
            </label>

            <div className="flex gap-4">
              <button
                onClick={() => setStep('intro')}
                className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Retour
              </button>
              <motion.button
                onClick={startQCM}
                disabled={!rulesAccepted}
                whileHover={rulesAccepted ? { scale: 1.02 } : {}}
                whileTap={rulesAccepted ? { scale: 0.98 } : {}}
                className={`flex-1 px-6 py-3 bg-[#206080] text-white font-semibold rounded-xl transition-colors
                  ${rulesAccepted ? 'hover:bg-[#185068]' : 'opacity-50 cursor-not-allowed'}`}
              >
                Commencer le test
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* QUIZ */}
        {step === 'quiz' && question && (
          <motion.div
            key="quiz"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* Bandeau d'avertissements */}
            {tabSwitchCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-4 p-3 rounded-xl border flex items-center justify-between ${getWarningBannerColor()}`}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Avertissements : {tabSwitchCount}/3</span>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full ${
                        i <= tabSwitchCount ? 'bg-current' : 'bg-current/30'
                      }`}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Timer & Progress */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <span className="text-slate-500">Question {currentQuestion + 1}/{questions.length}</span>
                <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#206080] transition-all duration-300"
                    style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full 
                ${timeLeft < 300 ? 'bg-red-100 text-red-600' : 'bg-[#206080]/10 text-[#206080]'}`}>
                <Clock className="w-4 h-4" />
                <span className="font-mono font-semibold">{formatTime(timeLeft)}</span>
              </div>
            </div>

            {/* Question */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-8">{question.text}</h2>

              <div className="space-y-3">
                {question.options.map((option, idx) => {
                  const key = ['A', 'B', 'C', 'D'][idx]
                  return (
                    <motion.button
                      key={key}
                      onClick={() => handleAnswer(question.id, key)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-4
                        ${answers[question.id] === key 
                          ? 'bg-[#206080]/10 border-2 border-[#206080]' 
                          : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold
                        ${answers[question.id] === key ? 'bg-[#206080] text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {key}
                      </div>
                      <span className="text-slate-900">{option}</span>
                    </motion.button>
                  )
                })}
              </div>

              {/* Navigation */}
              <div className="flex justify-between mt-8">
                <button
                  onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestion === 0}
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Précédent
                </button>

                {currentQuestion === questions.length - 1 ? (
                  <motion.button
                    onClick={handleSubmit}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 px-6 py-2 bg-[#206080] text-white font-medium rounded-lg hover:bg-[#185068] transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    Soumettre
                  </motion.button>
                ) : (
                  <button
                    onClick={() => setCurrentQuestion(prev => prev + 1)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Suivant
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Question dots */}
            <div className="flex justify-center gap-2 mt-6 flex-wrap">
              {questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentQuestion(i)}
                  className={`w-3 h-3 rounded-full transition-all
                    ${i === currentQuestion ? 'bg-[#206080] scale-125' : 
                      answers[q.id] ? 'bg-green-500' : 'bg-slate-200'}`}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* RESULT */}
        {step === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-200 p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center
                ${score >= 50 ? 'bg-green-100' : 'bg-amber-100'}`}
            >
              <CheckCircle className={`w-12 h-12 ${score >= 50 ? 'text-green-500' : 'text-amber-500'}`} />
            </motion.div>

            <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">
              Test terminé !
            </h1>
            <p className="text-slate-500 mb-8">Voici votre résultat</p>

            <div className="text-6xl font-display font-bold text-[#206080] mb-2">
              {score?.toFixed(0)}%
            </div>
            <p className="text-slate-400 mb-8">
              {score >= 70 ? 'Excellent travail ! Vous êtes sélectionné.' : 
               score >= 50 ? 'Bon travail !' : 'Continuez à vous entraîner !'}
            </p>

            <motion.button
              onClick={() => navigate('/resultats')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3 bg-[#206080] text-white font-semibold rounded-xl hover:bg-[#185068] transition-colors"
            >
              Voir mes résultats détaillés
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}