'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getUserRole } from '@/lib/auth'
import Link from 'next/link'

export default function Zeiterfassung() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Stempeluhr State
  const [todayEntry, setTodayEntry] = useState(null)
  const [isWorking, setIsWorking] = useState(false)
  const [isOnBreak, setIsOnBreak] = useState(false)
  const [workDuration, setWorkDuration] = useState(0)
  const [breakDuration, setBreakDuration] = useState(0)
  
  // History
  const [timeEntries, setTimeEntries] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [monthSummary, setMonthSummary] = useState(null)
  
  // Tabs
  const [activeTab, setActiveTab] = useState('stempeluhr')
  
  // Admin: Alle Mitarbeiter
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [allTodayEntries, setAllTodayEntries] = useState([])
  
  // Korrektur Modal
  const [showCorrectionModal, setShowCorrectionModal] = useState(null)
  const [correctionForm, setCorrectionForm] = useState({
    clock_in: '',
    clock_out: '',
    break_minutes: 0,
    reason: ''
  })

  const router = useRouter()

  // Live-Uhr
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Arbeitsdauer berechnen
  useEffect(() => {
    if (todayEntry && todayEntry.clock_in && !todayEntry.clock_out) {
      const timer = setInterval(() => {
        const start = new Date(todayEntry.clock_in)
        const now = new Date()
        let diffMs = now - start
        
        // Pause abziehen
        if (todayEntry.break_start && !todayEntry.break_end) {
          // Aktuell in Pause
          const breakStart = new Date(todayEntry.break_start)
          const breakMs = now - breakStart
          setBreakDuration(Math.floor(breakMs / 1000 / 60) + (todayEntry.break_minutes || 0))
        } else {
          setBreakDuration(todayEntry.break_minutes || 0)
        }
        
        // Gesamte bisherige Pausenzeit abziehen
        diffMs -= (todayEntry.break_minutes || 0) * 60 * 1000
        
        // Falls gerade in Pause, aktuelle Pause auch abziehen
        if (todayEntry.break_start && !todayEntry.break_end) {
          const breakStart = new Date(todayEntry.break_start)
          diffMs -= (now - breakStart)
        }
        
        setWorkDuration(Math.max(0, Math.floor(diffMs / 1000 / 60)))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [todayEntry])

  // Daten laden
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/'); return }
        
        setUser(session.user)
        const userRole = await getUserRole(session.user.id)
        setRole(userRole)

        // Eigenen Mitarbeiter finden
        const { data: empData } = await supabase
          .from('employees')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
        
        if (empData) {
          setEmployee(empData)
          await loadTodayEntry(empData.id)
          await loadTimeEntries(empData.id)
        }

        // Admin: Alle Mitarbeiter laden
        if (userRole === 'admin' || userRole === 'objektleiter') {
          const { data: allEmp } = await supabase
            .from('employees')
            .select('*')
            .eq('status', 'active')
            .order('nachname')
          setEmployees(allEmp || [])
          
          await loadAllTodayEntries()
        }
      } catch (err) {
        console.error('Fehler:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

  // Heutigen Eintrag laden
  const loadTodayEntry = async (employeeId) => {
    const today = formatDateLocal(new Date())
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('work_date', today)
      .single()
    
    if (data) {
      setTodayEntry(data)
      setIsWorking(data.clock_in && !data.clock_out)
      setIsOnBreak(data.break_start && !data.break_end)
    } else {
      setTodayEntry(null)
      setIsWorking(false)
      setIsOnBreak(false)
    }
  }

  // Alle heutigen Einträge laden (Admin)
  const loadAllTodayEntries = async () => {
    const today = formatDateLocal(new Date())
    const { data } = await supabase
      .from('time_entries')
      .select('*, employees(vorname, nachname, personal_nr)')
      .eq('work_date', today)
      .order('clock_in', { ascending: false })
    setAllTodayEntries(data || [])
  }

  // Zeiteinträge laden (Monat)
  const loadTimeEntries = async (employeeId) => {
    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth()
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0)
    
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('work_date', formatDateLocal(startDate))
      .lte('work_date', formatDateLocal(endDate))
      .order('work_date', { ascending: false })
    
    setTimeEntries(data || [])
    calculateMonthSummary(data || [])
  }

  // Monatszusammenfassung berechnen
  const calculateMonthSummary = (entries) => {
    const totalWorked = entries.reduce((sum, e) => sum + (e.worked_minutes || 0), 0)
    const totalOvertime = entries.reduce((sum, e) => sum + (e.overtime_minutes || 0), 0)
    const totalBreak = entries.reduce((sum, e) => sum + (e.break_minutes || 0), 0)
    const workdays = entries.filter(e => e.clock_in && e.clock_out).length
    
    // Soll-Stunden (angenommen 8h pro Tag)
    const targetMinutes = workdays * 480
    
    setMonthSummary({
      totalWorked,
      totalOvertime,
      totalBreak,
      workdays,
      targetMinutes
    })
  }

  // Hilfsfunktionen
  const formatDateLocal = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const formatTime = (date) => {
    if (!date) return '--:--'
    const d = new Date(date)
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDuration = (minutes) => {
    if (!minutes && minutes !== 0) return '--:--'
    const h = Math.floor(Math.abs(minutes) / 60)
    const m = Math.abs(minutes) % 60
    const sign = minutes < 0 ? '-' : ''
    return `${sign}${h}:${String(m).padStart(2, '0')}`
  }

  const getMonthName = (date) => {
    return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  }

  // === STEMPELUHR AKTIONEN ===

  // Kommen
  const handleClockIn = async () => {
    if (!employee) {
      alert('Kein Mitarbeiter-Profil gefunden!')
      return
    }

    const now = new Date()
    const today = formatDateLocal(now)

    try {
      const { data, error } = await supabase
        .from('time_entries')
        .insert([{
          employee_id: employee.id,
          work_date: today,
          clock_in: now.toISOString(),
          status: 'open'
        }])
        .select()
        .single()

      if (error) throw error

      setTodayEntry(data)
      setIsWorking(true)
      setWorkDuration(0)
      await loadAllTodayEntries()
      
    } catch (err) {
      console.error('Fehler:', err)
      alert('Fehler beim Einstempeln: ' + err.message)
    }
  }

  // Gehen
  const handleClockOut = async () => {
    if (!todayEntry) return

    // Falls noch in Pause, erst Pause beenden
    if (isOnBreak) {
      await handleBreakEnd()
    }

    const now = new Date()
    const clockIn = new Date(todayEntry.clock_in)
    
    // Arbeitszeit berechnen
    let workedMs = now - clockIn
    const breakMs = (todayEntry.break_minutes || 0) * 60 * 1000
    workedMs -= breakMs
    const workedMinutes = Math.floor(workedMs / 1000 / 60)
    
    // Überstunden (8h = 480min als Standard)
    const targetMinutes = 480
    const overtimeMinutes = workedMinutes - targetMinutes

    try {
      const { error } = await supabase
        .from('time_entries')
        .update({
          clock_out: now.toISOString(),
          worked_minutes: workedMinutes,
          overtime_minutes: overtimeMinutes,
          status: 'completed',
          updated_at: now.toISOString()
        })
        .eq('id', todayEntry.id)

      if (error) throw error

      // Überstundenkonto aktualisieren
      if (employee) {
        const newOvertime = (employee.ueberstunden_konto || 0) + (overtimeMinutes / 60)
        await supabase
          .from('employees')
          .update({ ueberstunden_konto: newOvertime })
          .eq('id', employee.id)
      }

      await loadTodayEntry(employee.id)
      await loadTimeEntries(employee.id)
      await loadAllTodayEntries()
      
      alert(`Ausstempeln erfolgreich!\nArbeitszeit: ${formatDuration(workedMinutes)}\nÜberstunden: ${formatDuration(overtimeMinutes)}`)
      
    } catch (err) {
      console.error('Fehler:', err)
      alert('Fehler beim Ausstempeln: ' + err.message)
    }
  }

  // Pause Start
  const handleBreakStart = async () => {
    if (!todayEntry || !isWorking) return

    const now = new Date()

    try {
      const { error } = await supabase
        .from('time_entries')
        .update({
          break_start: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', todayEntry.id)

      if (error) throw error

      setTodayEntry({ ...todayEntry, break_start: now.toISOString() })
      setIsOnBreak(true)
      
    } catch (err) {
      console.error('Fehler:', err)
      alert('Fehler: ' + err.message)
    }
  }

  // Pause Ende
  const handleBreakEnd = async () => {
    if (!todayEntry || !todayEntry.break_start) return

    const now = new Date()
    const breakStart = new Date(todayEntry.break_start)
    const breakMs = now - breakStart
    const newBreakMinutes = Math.floor(breakMs / 1000 / 60)
    const totalBreakMinutes = (todayEntry.break_minutes || 0) + newBreakMinutes

    try {
      const { error } = await supabase
        .from('time_entries')
        .update({
          break_end: now.toISOString(),
          break_minutes: totalBreakMinutes,
          break_start: null,
          updated_at: now.toISOString()
        })
        .eq('id', todayEntry.id)

      if (error) throw error

      setTodayEntry({ 
        ...todayEntry, 
        break_end: now.toISOString(), 
        break_minutes: totalBreakMinutes,
        break_start: null 
      })
      setIsOnBreak(false)
      setBreakDuration(totalBreakMinutes)
      
    } catch (err) {
      console.error('Fehler:', err)
      alert('Fehler: ' + err.message)
    }
  }

  // Korrektur speichern
  const handleSaveCorrection = async () => {
    if (!showCorrectionModal || !correctionForm.reason) {
      alert('Bitte Korrekturgrund angeben!')
      return
    }

    const entry = showCorrectionModal
    const clockIn = correctionForm.clock_in ? new Date(`${entry.work_date}T${correctionForm.clock_in}`) : null
    const clockOut = correctionForm.clock_out ? new Date(`${entry.work_date}T${correctionForm.clock_out}`) : null
    
    let workedMinutes = 0
    if (clockIn && clockOut) {
      workedMinutes = Math.floor((clockOut - clockIn) / 1000 / 60) - (correctionForm.break_minutes || 0)
    }
    const overtimeMinutes = workedMinutes - 480

    try {
      const { error } = await supabase
        .from('time_entries')
        .update({
          original_clock_in: entry.clock_in,
          original_clock_out: entry.clock_out,
          clock_in: clockIn?.toISOString(),
          clock_out: clockOut?.toISOString(),
          break_minutes: correctionForm.break_minutes,
          worked_minutes: workedMinutes,
          overtime_minutes: overtimeMinutes,
          correction_reason: correctionForm.reason,
          corrected_by: user.id,
          corrected_at: new Date().toISOString(),
          status: 'corrected',
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.id)

      if (error) throw error

      setShowCorrectionModal(null)
      setCorrectionForm({ clock_in: '', clock_out: '', break_minutes: 0, reason: '' })
      
      if (employee) {
        await loadTimeEntries(employee.id)
      }
      await loadAllTodayEntries()
      
      alert('Korrektur gespeichert!')
      
    } catch (err) {
      console.error('Fehler:', err)
      alert('Fehler: ' + err.message)
    }
  }

  // Monat wechseln
  const navigateMonth = (direction) => {
    const newDate = new Date(selectedMonth)
    newDate.setMonth(newDate.getMonth() + direction)
    setSelectedMonth(newDate)
    if (employee) {
      setTimeout(() => loadTimeEntries(employee.id), 100)
    }
  }

  // PDF Export
  const exportMonthPDF = async () => {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    
    const doc = new jsPDF()
    const monthName = getMonthName(selectedMonth)
    
    // Header
    doc.setFontSize(18)
    doc.setFont(undefined, 'bold')
    doc.text('Arbeitszeitnachweis', 105, 20, { align: 'center' })
    
    doc.setFontSize(12)
    doc.setFont(undefined, 'normal')
    doc.text(`${employee?.vorname} ${employee?.nachname}`, 105, 28, { align: 'center' })
    doc.text(monthName, 105, 35, { align: 'center' })
    
    // Tabelle
    const tableData = timeEntries
      .sort((a, b) => new Date(a.work_date) - new Date(b.work_date))
      .map(entry => [
        new Date(entry.work_date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        formatTime(entry.clock_in),
        formatTime(entry.clock_out),
        `${entry.break_minutes || 0} min`,
        formatDuration(entry.worked_minutes),
        formatDuration(entry.overtime_minutes),
        entry.status === 'corrected' ? 'Korr.' : ''
      ])
    
    autoTable(doc, {
      startY: 45,
      head: [['Datum', 'Kommen', 'Gehen', 'Pause', 'Arbeitszeit', 'Überstd.', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202] },
      styles: { fontSize: 9 }
    })
    
    // Zusammenfassung
    const finalY = doc.lastAutoTable.finalY + 10
    doc.setFontSize(10)
    doc.setFont(undefined, 'bold')
    doc.text('Zusammenfassung:', 14, finalY)
    doc.setFont(undefined, 'normal')
    doc.text(`Arbeitstage: ${monthSummary?.workdays || 0}`, 14, finalY + 7)
    doc.text(`Gesamt-Arbeitszeit: ${formatDuration(monthSummary?.totalWorked || 0)}`, 14, finalY + 14)
    doc.text(`Überstunden: ${formatDuration(monthSummary?.totalOvertime || 0)}`, 14, finalY + 21)
    doc.text(`Pausenzeit gesamt: ${formatDuration(monthSummary?.totalBreak || 0)}`, 14, finalY + 28)
    
    // Unterschrift
    doc.text('_________________________', 14, finalY + 50)
    doc.text('Unterschrift Mitarbeiter', 14, finalY + 55)
    doc.text('_________________________', 120, finalY + 50)
    doc.text('Unterschrift Vorgesetzter', 120, finalY + 55)
    
    // Footer
    doc.setFontSize(8)
    doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 105, 285, { align: 'center' })
    
    doc.save(`Arbeitszeit_${employee?.nachname}_${monthName.replace(' ', '_')}.pdf`)
  }

  // === RENDER ===

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Lädt...</p>
        </div>
      </div>
    )
  }

  const isAdmin = role === 'admin' || role === 'objektleiter'

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🕐 Zeiterfassung</h1>
              <p className="text-gray-600">
                {employee ? `${employee.vorname} ${employee.nachname}` : 'Kein Profil'}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard">
                <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold">
                  ← Zurück
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 mt-4">
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab('stempeluhr')}
            className={`px-4 py-2 font-semibold ${
              activeTab === 'stempeluhr'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🕐 Stempeluhr
          </button>
          <button
            onClick={() => setActiveTab('uebersicht')}
            className={`px-4 py-2 font-semibold ${
              activeTab === 'uebersicht'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 Meine Zeiten
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-2 font-semibold ${
                activeTab === 'admin'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              👥 Übersicht (Admin)
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        
        {/* TAB: STEMPELUHR */}
        {activeTab === 'stempeluhr' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Stempeluhr */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="text-center mb-6">
                <div className="text-6xl font-mono font-bold text-gray-900 mb-2">
                  {currentTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="text-gray-500">
                  {currentTime.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>

              {!employee ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-red-700 font-semibold">⚠️ Kein Mitarbeiter-Profil</p>
                  <p className="text-red-600 text-sm">Bitte Admin kontaktieren</p>
                </div>
              ) : !isWorking ? (
                /* Noch nicht eingestempelt */
                <div className="text-center">
                  <button
                    onClick={handleClockIn}
                    className="bg-green-500 hover:bg-green-600 text-white text-2xl font-bold px-12 py-6 rounded-lg shadow-lg transform hover:scale-105 transition"
                  >
                    ▶ KOMMEN
                  </button>
                  <p className="text-gray-500 mt-4">Klicken um einzustempeln</p>
                </div>
              ) : (
                /* Eingestempelt */
                <div className="space-y-4">
                  {/* Status */}
                  <div className={`text-center p-4 rounded-lg ${isOnBreak ? 'bg-yellow-100' : 'bg-green-100'}`}>
                    <p className={`text-lg font-bold ${isOnBreak ? 'text-yellow-700' : 'text-green-700'}`}>
                      {isOnBreak ? '☕ IN PAUSE' : '✓ EINGESTEMPELT'}
                    </p>
                    <p className="text-gray-600 text-sm">
                      seit {formatTime(todayEntry?.clock_in)}
                    </p>
                  </div>

                  {/* Arbeitszeit */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <p className="text-gray-600 text-sm">Arbeitszeit</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatDuration(workDuration)}
                      </p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <p className="text-gray-600 text-sm">Pause</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {formatDuration(breakDuration)}
                      </p>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    {!isOnBreak ? (
                      <button
                        onClick={handleBreakStart}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 rounded-lg"
                      >
                        ☕ PAUSE
                      </button>
                    ) : (
                      <button
                        onClick={handleBreakEnd}
                        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-lg"
                      >
                        ▶ WEITER
                      </button>
                    )}
                    <button
                      onClick={handleClockOut}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-lg"
                    >
                      ⏹ GEHEN
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Heutige Info */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Heute</h3>
              
              {todayEntry ? (
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Kommen:</span>
                    <span className="font-semibold text-gray-900">{formatTime(todayEntry.clock_in)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Gehen:</span>
                    <span className="font-semibold text-gray-900">{formatTime(todayEntry.clock_out) || '---'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Pause:</span>
                    <span className="font-semibold text-gray-900">{todayEntry.break_minutes || 0} min</span>
                  </div>
                  {todayEntry.clock_out && (
                    <>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Arbeitszeit:</span>
                        <span className="font-semibold text-blue-600">{formatDuration(todayEntry.worked_minutes)}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-gray-600">Überstunden:</span>
                        <span className={`font-semibold ${todayEntry.overtime_minutes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatDuration(todayEntry.overtime_minutes)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Noch nicht eingestempelt</p>
                </div>
              )}

              {/* Überstundenkonto */}
              {employee && (
                <div className="mt-6 bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600 text-sm">Überstundenkonto gesamt</p>
                  <p className={`text-2xl font-bold ${(employee.ueberstunden_konto || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {((employee.ueberstunden_konto || 0) >= 0 ? '+' : '')}{(employee.ueberstunden_konto || 0).toFixed(1)} Std
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: ÜBERSICHT */}
        {activeTab === 'uebersicht' && (
          <div className="bg-white rounded-lg shadow-lg">
            {/* Header mit Monatswahl */}
            <div className="border-b p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded font-bold"
                >
                  ◀
                </button>
                <h3 className="text-lg font-bold text-gray-900">
                  {getMonthName(selectedMonth)}
                </h3>
                <button
                  onClick={() => navigateMonth(1)}
                  className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded font-bold"
                >
                  ▶
                </button>
              </div>
              <button
                onClick={exportMonthPDF}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-semibold"
              >
                📄 PDF Export
              </button>
            </div>

            {/* Zusammenfassung */}
            {monthSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 border-b">
                <div className="text-center">
                  <p className="text-gray-600 text-sm">Arbeitstage</p>
                  <p className="text-xl font-bold text-gray-900">{monthSummary.workdays}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 text-sm">Arbeitszeit</p>
                  <p className="text-xl font-bold text-blue-600">{formatDuration(monthSummary.totalWorked)}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 text-sm">Überstunden</p>
                  <p className={`text-xl font-bold ${monthSummary.totalOvertime >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatDuration(monthSummary.totalOvertime)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 text-sm">Pausen</p>
                  <p className="text-xl font-bold text-orange-600">{formatDuration(monthSummary.totalBreak)}</p>
                </div>
              </div>
            )}

            {/* Tabelle */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Datum</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Kommen</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Gehen</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Pause</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Arbeitszeit</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Überstd.</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    {isAdmin && <th className="px-4 py-3 text-left font-semibold text-gray-700">Aktion</th>}
                  </tr>
                </thead>
                <tbody>
                  {timeEntries.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                        Keine Einträge in diesem Monat
                      </td>
                    </tr>
                  ) : (
                    timeEntries.map(entry => (
                      <tr key={entry.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">
                          {new Date(entry.work_date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-gray-900">{formatTime(entry.clock_in)}</td>
                        <td className="px-4 py-3 text-gray-900">{formatTime(entry.clock_out)}</td>
                        <td className="px-4 py-3 text-gray-900">{entry.break_minutes || 0} min</td>
                        <td className="px-4 py-3 text-blue-600 font-semibold">{formatDuration(entry.worked_minutes)}</td>
                        <td className={`px-4 py-3 font-semibold ${(entry.overtime_minutes || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatDuration(entry.overtime_minutes)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            entry.status === 'completed' ? 'bg-green-100 text-green-800' :
                            entry.status === 'corrected' ? 'bg-yellow-100 text-yellow-800' :
                            entry.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {entry.status === 'completed' ? '✓' : 
                             entry.status === 'corrected' ? '✎' : 
                             entry.status === 'approved' ? '✓✓' : '○'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <button
                              onClick={() => {
                                setShowCorrectionModal(entry)
                                setCorrectionForm({
                                  clock_in: entry.clock_in ? new Date(entry.clock_in).toTimeString().slice(0, 5) : '',
                                  clock_out: entry.clock_out ? new Date(entry.clock_out).toTimeString().slice(0, 5) : '',
                                  break_minutes: entry.break_minutes || 0,
                                  reason: ''
                                })
                              }}
                              className="text-blue-500 hover:text-blue-700 text-sm"
                            >
                              ✎ Korrigieren
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: ADMIN ÜBERSICHT */}
        {activeTab === 'admin' && isAdmin && (
          <div className="bg-white rounded-lg shadow-lg">
            <div className="border-b p-4">
              <h3 className="text-lg font-bold text-gray-900">👥 Heutige Anwesenheit</h3>
              <p className="text-gray-600 text-sm">
                {currentTime.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
              </p>
            </div>

            {/* Schnell-Übersicht */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 border-b">
              <div className="text-center">
                <p className="text-gray-600 text-sm">Anwesend</p>
                <p className="text-2xl font-bold text-green-600">
                  {allTodayEntries.filter(e => e.clock_in && !e.clock_out).length}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-600 text-sm">Gegangen</p>
                <p className="text-2xl font-bold text-gray-600">
                  {allTodayEntries.filter(e => e.clock_out).length}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-600 text-sm">Noch nicht da</p>
                <p className="text-2xl font-bold text-orange-600">
                  {employees.length - allTodayEntries.length}
                </p>
              </div>
            </div>

            {/* Liste */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Mitarbeiter</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Kommen</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Gehen</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Arbeitszeit</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => {
                    const entry = allTodayEntries.find(e => e.employee_id === emp.id)
                    const isHere = entry && entry.clock_in && !entry.clock_out
                    const hasLeft = entry && entry.clock_out
                    
                    return (
                      <tr key={emp.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-semibold">
                          {emp.nachname}, {emp.vorname}
                        </td>
                        <td className="px-4 py-3">
                          {isHere ? (
                            <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                              ✓ Anwesend
                            </span>
                          ) : hasLeft ? (
                            <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                              Gegangen
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-800">
                              Nicht da
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {entry ? formatTime(entry.clock_in) : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {entry?.clock_out ? formatTime(entry.clock_out) : '-'}
                        </td>
                        <td className="px-4 py-3 text-blue-600 font-semibold">
                          {entry?.worked_minutes ? formatDuration(entry.worked_minutes) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Korrektur Modal */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="bg-yellow-500 text-white p-4 rounded-t-lg">
              <h2 className="text-xl font-bold">✎ Zeit korrigieren</h2>
              <p className="text-yellow-100 text-sm">
                {new Date(showCorrectionModal.work_date).toLocaleDateString('de-DE')}
              </p>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Kommen</label>
                  <input
                    type="time"
                    value={correctionForm.clock_in}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, clock_in: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Gehen</label>
                  <input
                    type="time"
                    value={correctionForm.clock_out}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, clock_out: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Pause (Minuten)</label>
                <input
                  type="number"
                  value={correctionForm.break_minutes}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, break_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Korrekturgrund *</label>
                <textarea
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                  rows={3}
                  placeholder="Warum wird korrigiert?"
                  required
                />
              </div>
            </div>
            
            <div className="border-t p-4 flex gap-2">
              <button
                onClick={() => setShowCorrectionModal(null)}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveCorrection}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded font-semibold"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}