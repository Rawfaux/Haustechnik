'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getUserRole } from '@/lib/auth'
import Link from 'next/link'

export default function Antraege() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('uebersicht')
  
  // Daten
  const [employee, setEmployee] = useState(null)
  const [myAbsences, setMyAbsences] = useState([])
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [deputyRequests, setDeputyRequests] = useState([])
  const [employees, setEmployees] = useState([])
  
  // Modals
  const [showUrlaubModal, setShowUrlaubModal] = useState(false)
  const [showKrankModal, setShowKrankModal] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(null)
  
  // Forms
  const [urlaubForm, setUrlaubForm] = useState({
    absence_type: 'urlaub',
    start_date: '',
    end_date: '',
    source: 'urlaubstage',
    reason: '',
  })
  
  const [krankForm, setKrankForm] = useState({
    start_date: '',
    end_date: '',
    reason: '',
  })
  
  // Signature
  const [signatureData, setSignatureData] = useState(null)
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const router = useRouter()

  // Daten laden
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/'); return }
        setUser(session.user)
        
        const userRole = await getUserRole(session.user.id)
        setRole(userRole)

        // Eigenen Mitarbeiter-Datensatz finden (über user_id ODER Email)
        let empData = null
        
        // Erst über user_id suchen
        const { data: empByUserId } = await supabase
          .from('employees')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
        
        if (empByUserId) {
          empData = empByUserId
        } else {
          // Fallback: über Email suchen
          const { data: empByEmail } = await supabase
            .from('employees')
            .select('*')
            .eq('firma_mail', session.user.email)
            .single()
          empData = empByEmail
        }
        
        if (empData) {
          setEmployee(empData)
          
          // Eigene Abwesenheiten laden
          const { data: absData } = await supabase
            .from('absences')
            .select('*')
            .eq('employee_id', empData.id)
            .order('created_at', { ascending: false })
          setMyAbsences(absData || [])
        }

        // Alle Mitarbeiter laden (für Admin/Objektleiter)
        const { data: allEmpData } = await supabase
          .from('employees')
          .select('*')
          .eq('status', 'active')
          .order('nachname')
        setEmployees(allEmpData || [])

        // Vertreter-Anfragen laden (an mich gerichtet)
        try {
          const { data: deputyData } = await supabase
            .from('deputy_assignments')
            .select('*')
            .eq('deputy_id', session.user.id)
            .eq('status', 'pending')
          setDeputyRequests(deputyData || [])
        } catch (e) {
          setDeputyRequests([])
        }

        // Zu genehmigende Anträge laden (für Objektleiter/Admin)
        if (userRole === 'objektleiter' || userRole === 'admin') {
          const { data: pendingData } = await supabase
            .from('absences')
            .select('*, employee:employees(*)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
          setPendingApprovals(pendingData || [])
        }

      } catch (err) {
        console.error('Fehler:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

  // Signature Canvas Setup
  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }, [showUrlaubModal])

  // Signature Funktionen
  const startDrawing = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => setIsDrawing(false)

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setSignatureData(null)
  }

  const saveSignature = () => {
    const canvas = canvasRef.current
    setSignatureData(canvas.toDataURL('image/png'))
  }

  // Hilfsfunktionen
  const getResturlaub = () => {
    if (!employee) return 0
    return (employee.urlaubstage_jahr || 30) + (employee.urlaubstage_vorjahr || 0) - (employee.urlaubstage_genommen || 0)
  }

  const calculateDays = (start, end) => {
    if (!start || !end) return 0
    const startDate = new Date(start)
    const endDate = new Date(end)
    let days = 0
    const current = new Date(startDate)
    while (current <= endDate) {
      const dow = current.getDay()
      if (dow !== 0 && dow !== 6) days++
      current.setDate(current.getDate() + 1)
    }
    return days
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Ausstehend' }
      case 'approved': return { bg: 'bg-green-100', text: 'text-green-800', label: 'Genehmigt' }
      case 'rejected': return { bg: 'bg-red-100', text: 'text-red-800', label: 'Abgelehnt' }
      case 'forwarded': return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Weitergeleitet' }
      case 'confirmed': return { bg: 'bg-green-100', text: 'text-green-800', label: 'Bestaetigt' }
      default: return { bg: 'bg-gray-100', text: 'text-gray-800', label: status }
    }
  }

  const getAbsenceIcon = (type) => {
    switch (type) {
      case 'urlaub': return '🏖️'
      case 'krank': return '🤒'
      case 'fza': return '⏰'
      case 'fortbildung': return '📚'
      case 'sonderurlaub': return '⭐'
      default: return '📋'
    }
  }

  const getAbsenceLabel = (type) => {
    switch (type) {
      case 'urlaub': return 'Urlaub'
      case 'krank': return 'Krank'
      case 'fza': return 'FZA'
      case 'fortbildung': return 'Fortbildung'
      case 'sonderurlaub': return 'Sonderurlaub'
      default: return type
    }
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('de-DE')
  }

  const getEmployeeName = (empId) => {
    const emp = employees.find(e => e.id === empId)
    return emp ? (emp.nachname + ', ' + emp.vorname) : 'Unbekannt'
  }

  // Urlaub/FZA beantragen
  const handleSubmitUrlaub = async (e) => {
    e.preventDefault()
    
    if (!urlaubForm.start_date || !urlaubForm.end_date) {
      alert('Bitte Zeitraum auswaehlen')
      return
    }

    if (!signatureData) {
      alert('Bitte unterschreiben Sie den Antrag')
      return
    }

    if (!employee) {
      alert('Kein Mitarbeiter-Profil gefunden. Bitte Admin kontaktieren.')
      return
    }

    const days = calculateDays(urlaubForm.start_date, urlaubForm.end_date)

    try {
      const { error } = await supabase.from('absences').insert([{
        employee_id: employee.id,
        absence_type: urlaubForm.absence_type,
        start_date: urlaubForm.start_date,
        end_date: urlaubForm.end_date,
        source: urlaubForm.source,
        reason: urlaubForm.reason,
        days_count: days,
        status: 'pending',
        signature_employee: signatureData,
        signature_employee_date: new Date().toISOString(),
        created_by: user.id,
      }])

      if (error) throw error

      // Benachrichtigung erstellen (für Objektleiter)
      // TODO: Richtigen Objektleiter finden basierend auf Objekt

      // Neu laden
      const { data: absData } = await supabase
        .from('absences')
        .select('*')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false })
      setMyAbsences(absData || [])

      setShowUrlaubModal(false)
      setUrlaubForm({ absence_type: 'urlaub', start_date: '', end_date: '', source: 'urlaubstage', reason: '' })
      setSignatureData(null)
      alert('Antrag erfolgreich eingereicht!')
    } catch (err) {
      alert('Fehler: ' + err.message)
    }
  }

  // Krankmeldung einreichen
  const handleSubmitKrank = async (e) => {
    e.preventDefault()
    
    if (!krankForm.start_date || !krankForm.end_date) {
      alert('Bitte Zeitraum auswaehlen')
      return
    }

    if (!employee) {
      alert('Kein Mitarbeiter-Profil gefunden. Bitte Admin kontaktieren.')
      return
    }

    const days = calculateDays(krankForm.start_date, krankForm.end_date)

    try {
      const { error } = await supabase.from('absences').insert([{
        employee_id: employee.id,
        absence_type: 'krank',
        start_date: krankForm.start_date,
        end_date: krankForm.end_date,
        reason: krankForm.reason,
        days_count: days,
        status: 'approved', // Krankmeldung sofort aktiv!
        created_by: user.id,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      }])

      if (error) throw error

      // Neu laden
      const { data: absData } = await supabase
        .from('absences')
        .select('*')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false })
      setMyAbsences(absData || [])

      setShowKrankModal(false)
      setKrankForm({ start_date: '', end_date: '', reason: '' })
      alert('Krankmeldung erfolgreich eingetragen!')
    } catch (err) {
      alert('Fehler: ' + err.message)
    }
  }

  // Vertreter-Anfrage beantworten
  const handleDeputyResponse = async (deputyId, accept) => {
    try {
      const { error } = await supabase
        .from('deputy_assignments')
        .update({
          status: accept ? 'accepted' : 'rejected',
          responded_at: new Date().toISOString()
        })
        .eq('id', deputyId)

      if (error) throw error

      setDeputyRequests(deputyRequests.filter(d => d.id !== deputyId))
      alert(accept ? 'Vertretung angenommen!' : 'Vertretung abgelehnt!')
    } catch (err) {
      alert('Fehler: ' + err.message)
    }
  }

  // Antrag genehmigen/ablehnen (Objektleiter)
  const handleApproval = async (absenceId, approve, signature = null) => {
    try {
      const updateData = {
        status: approve ? 'approved' : 'rejected',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      }

      if (signature) {
        updateData.signature_approver = signature
        updateData.signature_approver_date = new Date().toISOString()
      }

      const { error } = await supabase
        .from('absences')
        .update(updateData)
        .eq('id', absenceId)

      if (error) throw error

      // Bei Genehmigung: Urlaubskonto aktualisieren
      if (approve) {
        const absence = pendingApprovals.find(a => a.id === absenceId)
        if (absence && absence.absence_type === 'urlaub' && absence.source === 'urlaubstage') {
          await supabase
            .from('employees')
            .update({
              urlaubstage_genommen: (absence.employee?.urlaubstage_genommen || 0) + absence.days_count
            })
            .eq('id', absence.employee_id)
        }
      }

      // Benachrichtigung an Antragsteller
      const absence = pendingApprovals.find(a => a.id === absenceId)
      if (absence?.employee?.firma_mail) {
        // TODO: User-ID des Mitarbeiters finden und Notification erstellen
      }

      setPendingApprovals(pendingApprovals.filter(a => a.id !== absenceId))
      setShowApprovalModal(null)
      alert(approve ? 'Antrag genehmigt!' : 'Antrag abgelehnt!')
    } catch (err) {
      alert('Fehler: ' + err.message)
    }
  }

  // Anzahl offener Anfragen
  const openRequestsCount = deputyRequests.length + pendingApprovals.length

  const isAdmin = role === 'admin'
  const isObjektleiter = role === 'objektleiter'
  const canApprove = isAdmin || isObjektleiter

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Laedt...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Antraege</h1>
              <p className="text-gray-600 text-sm">Urlaub, FZA & Krankmeldungen</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <p className="text-sm text-gray-600">{user?.email}</p>
                <p className="text-xs text-gray-400 capitalize">{role}</p>
              </div>
              <Link href="/dashboard">
                <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold text-sm">
                  Zurueck
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        
        {/* Offene Anfragen Banner */}
        {openRequestsCount > 0 && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-bold text-orange-800">Offene Anfragen ({openRequestsCount})</p>
                  <p className="text-orange-700 text-sm">
                    {deputyRequests.length > 0 && deputyRequests.length + ' Vertreter-Anfrage(n)'}
                    {deputyRequests.length > 0 && pendingApprovals.length > 0 && ' • '}
                    {pendingApprovals.length > 0 && pendingApprovals.length + ' Antrag/Antraege zur Genehmigung'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('anfragen')}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded font-semibold"
              >
                Anzeigen →
              </button>
            </div>
          </div>
        )}

        {/* Urlaubskonto Karte */}
        {employee && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Resturlaub</p>
                  <p className="text-3xl font-bold text-green-600">{getResturlaub()}</p>
                  <p className="text-gray-400 text-xs">von {employee.urlaubstage_jahr || 30} Tagen</p>
                </div>
                <span className="text-4xl">🏖️</span>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Ueberstunden</p>
                  <p className={`text-3xl font-bold ${(employee.ueberstunden_konto || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {employee.ueberstunden_konto || 0}h
                  </p>
                  <p className="text-gray-400 text-xs">verfuegbar fuer FZA</p>
                </div>
                <span className="text-4xl">⏰</span>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Meine Antraege</p>
                  <p className="text-3xl font-bold text-gray-700">{myAbsences.length}</p>
                  <p className="text-gray-400 text-xs">{myAbsences.filter(a => a.status === 'pending').length} ausstehend</p>
                </div>
                <span className="text-4xl">📋</span>
              </div>
            </div>
          </div>
        )}

        {/* Schnellaktionen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => setShowUrlaubModal(true)}
            className="bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition transform hover:scale-105"
          >
            <span className="text-4xl block mb-2">🏖️</span>
            <span className="font-bold text-lg">Urlaub / FZA</span>
            <span className="block text-sm opacity-90">beantragen</span>
          </button>
          
          <button
            onClick={() => setShowKrankModal(true)}
            className="bg-gradient-to-br from-red-400 to-red-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition transform hover:scale-105"
          >
            <span className="text-4xl block mb-2">🤒</span>
            <span className="font-bold text-lg">Krankmeldung</span>
            <span className="block text-sm opacity-90">eintragen</span>
          </button>
          
          <Link href="/dashboard/schichtplaner">
            <div className="bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition transform hover:scale-105 cursor-pointer h-full">
              <span className="text-4xl block mb-2">📅</span>
              <span className="font-bold text-lg">Schichtplaner</span>
              <span className="block text-sm opacity-90">oeffnen</span>
            </div>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('uebersicht')}
            className={`px-4 py-2 rounded font-semibold ${activeTab === 'uebersicht' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
          >
            📋 Meine Antraege
          </button>
          {canApprove && (
            <button
              onClick={() => setActiveTab('anfragen')}
              className={`px-4 py-2 rounded font-semibold relative ${activeTab === 'anfragen' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              📥 Offene Anfragen
              {openRequestsCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {openRequestsCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Tab: Meine Antraege */}
        {activeTab === 'uebersicht' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">Meine Antraege</h2>
            </div>
            <div className="p-4">
              {myAbsences.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-4xl block mb-2">📭</span>
                  <p>Keine Antraege vorhanden</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myAbsences.map((absence) => {
                    const status = getStatusBadge(absence.status)
                    return (
                      <div
                        key={absence.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-2xl">{getAbsenceIcon(absence.absence_type)}</span>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {getAbsenceLabel(absence.absence_type)}
                            </p>
                            <p className="text-gray-600 text-sm">
                              {formatDate(absence.start_date)} - {formatDate(absence.end_date)}
                              {absence.days_count && ` (${absence.days_count} Tage)`}
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Offene Anfragen */}
        {activeTab === 'anfragen' && canApprove && (
          <div className="space-y-6">
            
            {/* Vertreter-Anfragen */}
            {deputyRequests.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b bg-purple-50">
                  <h2 className="text-xl font-bold text-gray-900">🔄 Vertreter-Anfragen</h2>
                </div>
                <div className="p-4 space-y-3">
                  {deputyRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border-2 border-purple-200"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">
                          Vertreter-Anfrage
                        </p>
                        <p className="text-gray-600 text-sm">
                          Sie wurden als Vertreter angefragt
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeputyResponse(request.id, true)}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-semibold"
                        >
                          ✓ Annehmen
                        </button>
                        <button
                          onClick={() => handleDeputyResponse(request.id, false)}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold"
                        >
                          ✗ Ablehnen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Antraege zur Genehmigung */}
            {pendingApprovals.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b bg-orange-50">
                  <h2 className="text-xl font-bold text-gray-900">📋 Antraege zur Genehmigung</h2>
                </div>
                <div className="p-4 space-y-3">
                  {pendingApprovals.map((absence) => (
                    <div
                      key={absence.id}
                      className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border-2 border-orange-200"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">{getAbsenceIcon(absence.absence_type)}</span>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {absence.employee?.nachname}, {absence.employee?.vorname}
                          </p>
                          <p className="text-gray-600 text-sm">
                            {getAbsenceLabel(absence.absence_type)}: {formatDate(absence.start_date)} - {formatDate(absence.end_date)}
                            {absence.days_count && ` (${absence.days_count} Tage)`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowApprovalModal(absence)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-semibold"
                        >
                          Pruefen →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {deputyRequests.length === 0 && pendingApprovals.length === 0 && (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <span className="text-4xl block mb-2">✅</span>
                <p className="text-gray-500">Keine offenen Anfragen</p>
              </div>
            )}
          </div>
        )}

        {/* Zurueck Button */}
        <div className="mt-6">
          <Link href="/dashboard">
            <button className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded font-semibold">
              ← Zurueck zum Dashboard
            </button>
          </Link>
        </div>
      </div>

      {/* Modal: Urlaub/FZA beantragen */}
      {showUrlaubModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4 rounded-t-lg">
              <h2 className="text-xl font-bold">🏖️ Urlaub / FZA beantragen</h2>
            </div>
            
            <form onSubmit={handleSubmitUrlaub} className="p-4 space-y-4">
              {/* Antragsteller anzeigen */}
              {employee ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-gray-500 text-sm">Antragsteller</p>
                  <p className="font-bold text-gray-900 text-lg">
                    {employee.vorname} {employee.nachname}
                  </p>
                  {employee.personal_nr && (
                    <p className="text-gray-500 text-sm">Personal-Nr: {employee.personal_nr}</p>
                  )}
                </div>
              ) : (
                <div className="bg-red-50 border border-red-300 rounded-lg p-3">
                  <p className="text-red-700 font-semibold">⚠️ Kein Mitarbeiter-Profil gefunden</p>
                  <p className="text-red-600 text-sm">
                    Ihr Benutzer ist noch keinem Mitarbeiter zugeordnet. 
                    Bitte kontaktieren Sie den Administrator.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-gray-700 font-semibold mb-2">Art *</label>
                <select
                  value={urlaubForm.absence_type}
                  onChange={(e) => setUrlaubForm({ ...urlaubForm, absence_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                >
                  <option value="urlaub">🏖️ Urlaub</option>
                  <option value="fza">⏰ FZA (Freizeitausgleich)</option>
                  <option value="sonderurlaub">⭐ Sonderurlaub</option>
                  <option value="fortbildung">📚 Fortbildung</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Von *</label>
                  <input
                    type="date"
                    value={urlaubForm.start_date}
                    onChange={(e) => setUrlaubForm({ ...urlaubForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Bis *</label>
                  <input
                    type="date"
                    value={urlaubForm.end_date}
                    onChange={(e) => setUrlaubForm({ ...urlaubForm, end_date: e.target.value })}
                    min={urlaubForm.start_date}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                    required
                  />
                </div>
              </div>

              {urlaubForm.start_date && urlaubForm.end_date && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-center">
                  <p className="text-blue-700">
                    <strong>{calculateDays(urlaubForm.start_date, urlaubForm.end_date)}</strong> Arbeitstage
                  </p>
                </div>
              )}

              <div>
                <label className="block text-gray-700 font-semibold mb-2">Verrechnung mit *</label>
                <select
                  value={urlaubForm.source}
                  onChange={(e) => setUrlaubForm({ ...urlaubForm, source: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                >
                  <option value="urlaubstage">Urlaubstagen (noch {getResturlaub()} Tage)</option>
                  <option value="ueberstunden">Ueberstunden ({employee?.ueberstunden_konto || 0}h)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">Bemerkung (optional)</label>
                <textarea
                  value={urlaubForm.reason}
                  onChange={(e) => setUrlaubForm({ ...urlaubForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                  rows="2"
                  placeholder="z.B. Familienurlaub"
                />
              </div>

              <div className="border-t pt-4">
                <label className="block text-gray-700 font-semibold mb-2">Unterschrift *</label>
                <div className="border-2 border-gray-300 rounded bg-gray-50">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="w-full cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={clearSignature} className="text-sm text-red-600 hover:text-red-800">
                    Loeschen
                  </button>
                  <button type="button" onClick={saveSignature} className="text-sm text-blue-600 hover:text-blue-800">
                    Unterschrift bestaetigen
                  </button>
                </div>
                {signatureData && (
                  <p className="text-green-600 text-sm mt-1">✓ Unterschrift gespeichert</p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded font-semibold"
                >
                  Antrag einreichen
                </button>
                <button
                  type="button"
                  onClick={() => { setShowUrlaubModal(false); clearSignature(); }}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Krankmeldung */}
      {showKrankModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-red-400 to-red-600 text-white p-4 rounded-t-lg">
              <h2 className="text-xl font-bold">🤒 Krankmeldung</h2>
            </div>
            
            <form onSubmit={handleSubmitKrank} className="p-4 space-y-4">
              {/* Wer meldet sich krank */}
              {employee ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-gray-500 text-sm">Krankmeldung fuer</p>
                  <p className="font-bold text-gray-900 text-lg">
                    {employee.vorname} {employee.nachname}
                  </p>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-300 rounded-lg p-3">
                  <p className="text-red-700 font-semibold">⚠️ Kein Mitarbeiter-Profil gefunden</p>
                  <p className="text-red-600 text-sm">
                    Ihr Benutzer ist noch keinem Mitarbeiter zugeordnet.
                  </p>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-yellow-800 text-sm">
                  ⚠️ Die Krankmeldung wird <strong>sofort</strong> im Schichtplaner uebernommen.
                  Bitte AU-Bescheinigung nachreichen.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Von *</label>
                  <input
                    type="date"
                    value={krankForm.start_date}
                    onChange={(e) => setKrankForm({ ...krankForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Bis *</label>
                  <input
                    type="date"
                    value={krankForm.end_date}
                    onChange={(e) => setKrankForm({ ...krankForm, end_date: e.target.value })}
                    min={krankForm.start_date}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">Bemerkung (optional)</label>
                <textarea
                  value={krankForm.reason}
                  onChange={(e) => setKrankForm({ ...krankForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                  rows="2"
                  placeholder="z.B. Grippe"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold"
                >
                  Krankmeldung senden
                </button>
                <button
                  type="button"
                  onClick={() => setShowKrankModal(false)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Antrag pruefen */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-400 to-blue-600 text-white p-4 rounded-t-lg">
              <h2 className="text-xl font-bold">📋 Antrag pruefen</h2>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <span className="text-3xl">{getAbsenceIcon(showApprovalModal.absence_type)}</span>
                <div>
                  <p className="font-bold text-gray-900 text-lg">
                    {showApprovalModal.employee?.nachname}, {showApprovalModal.employee?.vorname}
                  </p>
                  <p className="text-gray-600">
                    {getAbsenceLabel(showApprovalModal.absence_type)}
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-2">
                <p><strong>Zeitraum:</strong> {formatDate(showApprovalModal.start_date)} - {formatDate(showApprovalModal.end_date)}</p>
                <p><strong>Arbeitstage:</strong> {showApprovalModal.days_count}</p>
                <p><strong>Verrechnung:</strong> {showApprovalModal.source === 'urlaubstage' ? 'Urlaubstage' : 'Ueberstunden'}</p>
                {showApprovalModal.reason && <p><strong>Bemerkung:</strong> {showApprovalModal.reason}</p>}
              </div>

              {showApprovalModal.signature_employee && (
                <div>
                  <p className="font-semibold text-gray-700 mb-2">Unterschrift Antragsteller:</p>
                  <div className="border rounded p-2 bg-gray-50">
                    <img src={showApprovalModal.signature_employee} alt="Unterschrift" className="max-h-20" />
                    <p className="text-xs text-gray-500 mt-1">
                      Signiert am: {new Date(showApprovalModal.signature_employee_date).toLocaleString('de-DE')}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={() => handleApproval(showApprovalModal.id, true)}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-semibold"
                >
                  ✓ Genehmigen
                </button>
                <button
                  onClick={() => handleApproval(showApprovalModal.id, false)}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold"
                >
                  ✗ Ablehnen
                </button>
                <button
                  onClick={() => setShowApprovalModal(null)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
                >
                  Schliessen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}