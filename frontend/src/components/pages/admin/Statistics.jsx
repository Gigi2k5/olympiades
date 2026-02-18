import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  BarChart3, PieChart, TrendingUp, Download, Users, MapPin, School, 
  Calendar, Filter, FileText, Award, Target, Clock, CheckCircle, Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'

export default function Statistics() {
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  
  // Données réelles depuis l'API
  const [regionData, setRegionData] = useState([])
  const [schoolData, setSchoolData] = useState([])
  const [genderData, setGenderData] = useState({ male: { count: 0, percentage: 0 }, female: { count: 0, percentage: 0 } })
  const [scoreDistribution, setScoreDistribution] = useState([])
  const [registrationTrend, setRegistrationTrend] = useState([])
  const [dashboard, setDashboard] = useState({ candidates: { total: 0, by_status: {} }, qcm: { completed: 0, average_score: 0, pass_rate: 0 } })

  useEffect(() => {
    fetchAllStats()
  }, [])

  const fetchAllStats = async () => {
    setLoading(true)
    try {
      const [dashRes, regionRes, schoolRes, genderRes, scoreRes, regRes] = await Promise.allSettled([
        api.get('/stats/dashboard'),
        api.get('/stats/regions'),
        api.get('/stats/schools'),
        api.get('/stats/gender'),
        api.get('/stats/qcm/scores'),
        api.get('/stats/registrations'),
      ])

      if (dashRes.status === 'fulfilled' && dashRes.value.data.success)
        setDashboard(dashRes.value.data.data)
      if (regionRes.status === 'fulfilled' && regionRes.value.data.success)
        setRegionData(regionRes.value.data.data || [])
      if (schoolRes.status === 'fulfilled' && schoolRes.value.data.success)
        setSchoolData(schoolRes.value.data.data || [])
      if (genderRes.status === 'fulfilled' && genderRes.value.data.success)
        setGenderData(genderRes.value.data.data)
      if (scoreRes.status === 'fulfilled' && scoreRes.value.data.success)
        setScoreDistribution(scoreRes.value.data.data || [])
      if (regRes.status === 'fulfilled' && regRes.value.data.success)
        setRegistrationTrend(regRes.value.data.data || [])
    } catch (error) {
      console.error('Error fetching stats:', error)
      toast.error('Erreur lors du chargement des statistiques')
    } finally {
      setLoading(false)
    }
  }

  // Calculs dérivés
  const totalInscriptions = dashboard.candidates?.total || 0
  const totalMale = genderData.male?.count || 0
  const totalFemale = genderData.female?.count || 0
  const maxRegion = regionData.length > 0 ? Math.max(...regionData.map(r => r.total)) : 1
  const qcm = dashboard.qcm || {}

  // ─── Export Excel ───────────────────────────
  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const res = await api.get('/stats/report')
      if (!res.data.success) throw new Error('Erreur API')
      
      const report = res.data.data
      
      // Construire un CSV riche
      let csv = '\uFEFF' // BOM pour Excel UTF-8
      csv += 'RAPPORT STATISTIQUES - OLYMPIADES IA BÉNIN 2026\n'
      csv += `Généré le: ${new Date().toLocaleDateString('fr-FR')}\n\n`
      
      csv += 'RÉSUMÉ\n'
      csv += `Total inscrits,${report.summary?.candidates?.total || 0}\n`
      csv += `Brouillons,${report.summary?.candidates?.by_status?.draft || 0}\n`
      csv += `Soumis,${report.summary?.candidates?.by_status?.submitted || 0}\n`
      csv += `Validés,${report.summary?.candidates?.by_status?.validated || 0}\n`
      csv += `Rejetés,${report.summary?.candidates?.by_status?.rejected || 0}\n`
      csv += `QCM complétés,${report.summary?.qcm?.completed || 0}\n`
      csv += `Score moyen,${report.summary?.qcm?.average_score || 0}\n`
      csv += `Taux de réussite,${report.summary?.qcm?.pass_rate || 0}%\n\n`
      
      csv += 'INSCRIPTIONS PAR DÉPARTEMENT\n'
      csv += 'Département,Total,Garçons,Filles\n'
      ;(report.by_region || []).forEach(r => {
        csv += `${r.region},${r.total},${r.male},${r.female}\n`
      })
      csv += '\n'
      
      csv += 'TOP ÉTABLISSEMENTS\n'
      csv += 'Établissement,Département,Inscrits\n'
      ;(report.top_schools || []).forEach(s => {
        csv += `"${s.school}",${s.region},${s.count}\n`
      })
      csv += '\n'
      
      csv += 'DISTRIBUTION DES SCORES QCM\n'
      csv += 'Tranche,Nombre\n'
      ;(report.qcm_score_distribution || []).forEach(d => {
        csv += `${d.range},${d.count}\n`
      })
      csv += '\n'
      
      csv += 'RÉPARTITION PAR GENRE\n'
      csv += `Garçons,${report.gender?.male?.count || 0},${report.gender?.male?.percentage || 0}%\n`
      csv += `Filles,${report.gender?.female?.count || 0},${report.gender?.female?.percentage || 0}%\n`
      
      // Télécharger
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `statistiques_olympiades_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      
      toast.success('Export CSV téléchargé !')
    } catch (error) {
      console.error('Export error:', error)
      toast.error("Erreur lors de l'export")
    } finally {
      setExporting(false)
    }
  }

  // ─── Export PDF (via impression navigateur) ──
  const handleExportPDF = () => {
    toast.success('Préparation du PDF...')
    setTimeout(() => window.print(), 300)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-3" />
          <p className="text-slate-500">Chargement des statistiques...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 mb-1">Statistiques & Rapports</h1>
          <p className="text-slate-500">Analyse détaillée des inscriptions et performances</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExportPDF} className="btn-secondary text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" /> PDF
          </button>
          <button onClick={handleExportExcel} disabled={exporting} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Excel
          </button>
        </div>
      </motion.div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total inscrits', value: totalInscriptions, icon: Users, color: 'gold' },
          { label: 'Taux réussite QCM', value: qcm.completed > 0 ? `${qcm.pass_rate}%` : '—', icon: CheckCircle, color: 'green' },
          { label: 'Score moyen', value: qcm.completed > 0 ? `${qcm.average_score}/100` : '—', icon: Target, color: 'blue' },
          { label: 'QCM complétés', value: qcm.completed || 0, icon: Clock, color: 'purple' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="card p-4 lg:p-6">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center
                ${stat.color === 'gold' ? 'bg-primary-50 text-primary-600' :
                  stat.color === 'green' ? 'bg-green-400/10 text-green-400' :
                  stat.color === 'blue' ? 'bg-blue-400/10 text-blue-400' :
                  'bg-purple-400/10 text-purple-400'}`}>
                <stat.icon className="w-5 h-5 lg:w-6 lg:h-6" />
              </div>
            </div>
            <div className="text-2xl lg:text-3xl font-display font-bold text-slate-900 mb-1">{stat.value}</div>
            <div className="text-xs lg:text-sm text-slate-400">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Graphiques principaux */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Par région */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="card p-6">
          <h3 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <MapPin className="w-5 h-5 text-primary-600" /> Inscriptions par département
          </h3>
          {regionData.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Aucune donnée de région disponible</p>
          ) : (
            <div className="space-y-4">
              {regionData.sort((a, b) => b.total - a.total).map((r, i) => (
                <div key={r.region}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-900/70">{r.region}</span>
                    <span className="text-slate-900 font-medium">{r.total} <span className="text-slate-400 text-xs">({totalInscriptions > 0 ? Math.round(r.total/totalInscriptions*100) : 0}%)</span></span>
                  </div>
                  <div className="h-6 bg-slate-200 rounded-full overflow-hidden flex">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(r.male / maxRegion) * 100}%` }}
                      transition={{ delay: 0.5 + i * 0.05, duration: 0.5 }}
                      className="h-full bg-blue-500"
                      title={`Garçons: ${r.male}`}
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(r.female / maxRegion) * 100}%` }}
                      transition={{ delay: 0.6 + i * 0.05, duration: 0.5 }}
                      className="h-full bg-pink-500"
                      title={`Filles: ${r.female}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-sm text-slate-500">Garçons ({totalMale})</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-pink-500" /><span className="text-sm text-slate-500">Filles ({totalFemale})</span></div>
          </div>
        </motion.div>

        {/* Distribution scores QCM */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="card p-6">
          <h3 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-primary-600" /> Distribution des scores QCM
          </h3>
          {scoreDistribution.length === 0 || scoreDistribution.every(d => d.count === 0) ? (
            <p className="text-slate-400 text-center py-8">Aucun QCM complété pour le moment</p>
          ) : (
            <>
              <div className="h-48 flex items-end justify-between gap-2">
                {scoreDistribution.map((d, i) => {
                  const maxCount = Math.max(...scoreDistribution.map(s => s.count), 1)
                  const height = (d.count / maxCount) * 100
                  const color = i <= 1 ? 'from-red-500/50 to-red-500' : i === 2 ? 'from-orange-500/50 to-orange-500' : 'from-green-500/50 to-green-500'
                  return (
                    <div key={d.range} className="flex-1 flex flex-col items-center group">
                      <div className="text-xs text-slate-400 mb-1 opacity-0 group-hover:opacity-100">{d.count}</div>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ delay: 0.6 + i * 0.1, duration: 0.5 }}
                        className={`w-full bg-gradient-to-t ${color} rounded-t-lg`}
                        style={{ minHeight: d.count > 0 ? '4px' : '0' }}
                      />
                      <span className="text-xs text-slate-400 mt-2">{d.range}</span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4 text-center">
                <div><div className="text-lg font-bold text-slate-900">{qcm.completed || 0}</div><div className="text-xs text-slate-400">Tentatives</div></div>
                <div><div className="text-lg font-bold text-green-400">{qcm.pass_rate || 0}%</div><div className="text-xs text-slate-400">Réussite</div></div>
                <div><div className="text-lg font-bold text-primary-600">{qcm.average_score || 0}</div><div className="text-xs text-slate-400">Score moy.</div></div>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Tableau top établissements */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
        className="card p-6">
        <h3 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
          <School className="w-5 h-5 text-primary-600" /> Top établissements
        </h3>
        {schoolData.length === 0 ? (
          <p className="text-slate-400 text-center py-8">Aucun établissement enregistré</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left p-3 text-sm font-medium text-slate-400">#</th>
                  <th className="text-left p-3 text-sm font-medium text-slate-400">Établissement</th>
                  <th className="text-left p-3 text-sm font-medium text-slate-400">Département</th>
                  <th className="text-right p-3 text-sm font-medium text-slate-400">Inscrits</th>
                  <th className="text-right p-3 text-sm font-medium text-slate-400">%</th>
                </tr>
              </thead>
              <tbody>
                {schoolData.map((s, i) => (
                  <tr key={s.school + i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
                        ${i === 0 ? 'bg-primary-500 text-slate-900' : i === 1 ? 'bg-gray-400 text-slate-900' : i === 2 ? 'bg-orange-600 text-slate-900' : 'bg-slate-200 text-slate-400'}`}>
                        {i + 1}
                      </div>
                    </td>
                    <td className="p-3 font-medium text-slate-900">{s.school}</td>
                    <td className="p-3 text-slate-500">{s.region || '—'}</td>
                    <td className="p-3 text-right font-semibold text-slate-900">{s.count}</td>
                    <td className="p-3 text-right text-slate-400">{totalInscriptions > 0 ? Math.round(s.count/totalInscriptions*100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Répartition genre + Tendance */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="card p-6">
          <h3 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <PieChart className="w-5 h-5 text-primary-600" /> Répartition par genre
          </h3>
          <div className="flex items-center justify-center mb-6">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full -rotate-90">
                <circle cx="80" cy="80" r="70" fill="none" stroke="#1E1B4B" strokeWidth="16" />
                <motion.circle cx="80" cy="80" r="70" fill="none" stroke="#3B82F6" strokeWidth="16" strokeLinecap="round"
                  initial={{ strokeDasharray: "0 440" }}
                  animate={{ strokeDasharray: `${totalInscriptions > 0 ? (totalMale/totalInscriptions)*440 : 0} 440` }}
                  transition={{ delay: 0.8, duration: 1 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-display font-bold text-slate-900">{totalInscriptions}</span>
                <span className="text-xs text-slate-400">Total</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-lg bg-blue-500/10">
              <div className="text-2xl font-bold text-blue-400">{totalMale}</div>
              <div className="text-xs text-slate-400">Garçons ({genderData.male?.percentage || 0}%)</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-pink-500/10">
              <div className="text-2xl font-bold text-pink-400">{totalFemale}</div>
              <div className="text-xs text-slate-400">Filles ({genderData.female?.percentage || 0}%)</div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
          className="lg:col-span-2 card p-6">
          <h3 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-primary-600" /> Inscriptions récentes (30 derniers jours)
          </h3>
          {registrationTrend.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Aucune inscription récente</p>
          ) : (
            <div className="h-48 flex items-end justify-between gap-1">
              {registrationTrend.map((d, i) => {
                const maxCount = Math.max(...registrationTrend.map(r => r.count), 1)
                const height = (d.count / maxCount) * 100
                const dateLabel = d.date ? new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''
                return (
                  <div key={d.date || i} className="flex-1 flex flex-col items-center group" style={{ maxWidth: '40px' }}>
                    <div className="text-xs text-slate-400 mb-1 opacity-0 group-hover:opacity-100">{d.count}</div>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ delay: 0.9 + i * 0.03 }}
                      className="w-full bg-primary-500/60 rounded-t"
                      style={{ minHeight: d.count > 0 ? '4px' : '0' }}
                    />
                    {i % Math.max(1, Math.floor(registrationTrend.length / 6)) === 0 && (
                      <span className="text-[10px] text-slate-400 mt-1 whitespace-nowrap">{dateLabel}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
