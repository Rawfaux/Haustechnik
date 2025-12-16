'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getUserRole } from '@/lib/auth'
import Link from 'next/link'

export default function Schichtplaner() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState([])
  const [objects, setObjects] = useState([])
  const [shifts, setShifts] = useState([])
  const [shiftTemplates, setShiftTemplates] = useState([])
  const [handovers, setHandovers] = useState([])
  const [absences, setAbsences] = useState([])
  const [selectedObject, setSelectedObject] = useState('alle')
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // Monatsansicht
  const [showMonthView, setShowMonthView] = useState(false)
  const [monthViewDate, setMonthViewDate] = useState(new Date())
  const [monthShifts, setMonthShifts] = useState([])
  const [monthAbsences, setMonthAbsences] = useState([])
  const [loadingMonth, setLoadingMonth] = useState(false)
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(null)
  const [showAbsenceModal, setShowAbsenceModal] = useState(false)
  const [showAbsenceDetailModal, setShowAbsenceDetailModal] = useState(null)
  const [showHandoverModal, setShowHandoverModal] = useState(null)
  const [showHandoverDetailModal, setShowHandoverDetailModal] = useState(null)
  
  // Forms
  const [addForm, setAddForm] = useState({
    employee_id: '',
    start_date: '',
    end_date: '',
  })
  
  const [handoverForm, setHandoverForm] = useState({
    original_employee_id: '',
    replacement_employee_id: '',
    handover_date: '',
    end_date: '',
    reason: 'krankheit',
    reason_details: '',
  })
  
  const [absenceForm, setAbsenceForm] = useState({
    employee_id: '',
    absence_type: 'urlaub',
    start_date: '',
    end_date: '',
    reason: '',
  })

  const router = useRouter()

  // ===== HILFSFUNKTIONEN =====

  const formatDateLocal = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return y + '-' + m + '-' + d
  }

  const formatDateShort = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  }

  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  }

  const getWeekRange = () => {
    const curr = new Date(currentDate)
    const day = curr.getDay()
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(curr.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return {
      monday,
      sunday,
      startDate: formatDateLocal(monday),
      endDate: formatDateLocal(sunday),
      display: formatDateShort(formatDateLocal(monday)) + ' - ' + formatDateShort(formatDateLocal(sunday))
    }
  }

  const navigateWeek = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setDate(newDate.getDate() + (direction * 7))
      return newDate
    })
  }

  const goToToday = () => setCurrentDate(new Date())

  // Schichten zu Datumsbereichen zusammenfassen
  const groupShiftsToRanges = (shiftsForTemplate) => {
    const byEmployee = {}
    shiftsForTemplate.forEach(shift => {
      const empId = shift.employee_id
      if (!byEmployee[empId]) {
        byEmployee[empId] = { employee: shift.employee, dates: [], shifts: [] }
      }
      byEmployee[empId].dates.push(shift.date)
      byEmployee[empId].shifts.push(shift)
    })

    const result = []
    Object.values(byEmployee).forEach(({ employee, dates, shifts: empShifts }) => {
      const sortedDates = [...dates].sort()
      const sortedShifts = [...empShifts].sort((a, b) => a.date.localeCompare(b.date))
      if (sortedDates.length === 0) return

      let rangeStart = sortedDates[0]
      let rangeEnd = sortedDates[0]
      let rangeShifts = [sortedShifts[0]]

      for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i - 1] + 'T00:00:00')
        const currDate = new Date(sortedDates[i] + 'T00:00:00')
        const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24)

        if (diffDays === 1) {
          rangeEnd = sortedDates[i]
          rangeShifts.push(sortedShifts[i])
        } else {
          result.push({ employee, startDate: rangeStart, endDate: rangeEnd, shifts: rangeShifts })
          rangeStart = sortedDates[i]
          rangeEnd = sortedDates[i]
          rangeShifts = [sortedShifts[i]]
        }
      }
      result.push({ employee, startDate: rangeStart, endDate: rangeEnd, shifts: rangeShifts })
    })

    return result.sort((a, b) => a.startDate.localeCompare(b.startDate))
  }

  // Wechsel fuer Template finden
  const getHandoversForTemplate = (template) => {
    const templateName = template.name?.toLowerCase() || ''
    return handovers.filter(h => {
      const hType = h.shift_type?.toLowerCase() || ''
      if (hType === templateName) return true
      if (templateName.includes('bereit') && hType.includes('bereit')) return true
      if ((templateName.includes('frueh') || templateName.includes('früh')) && 
          (hType.includes('frueh') || hType.includes('früh'))) return true
      if (templateName.includes('tag') && hType.includes('tag')) return true
      if ((templateName.includes('spaet') || templateName.includes('spät')) && 
          (hType.includes('spaet') || hType.includes('spät'))) return true
      if (templateName.includes('nacht') && hType.includes('nacht')) return true
      return false
    })
  }

  // Schichten nach Template gruppieren
  const getShiftsByTemplate = () => {
    const grouped = {}
    shiftTemplates.forEach(template => {
      grouped[template.id] = { template, shifts: [], ranges: [], handovers: [] }
    })

    shifts.forEach(shift => {
      const matchingTemplate = shiftTemplates.find(t => 
        t.start_time?.substring(0, 5) === shift.start_time?.substring(0, 5)
      )
      if (matchingTemplate && grouped[matchingTemplate.id]) {
        grouped[matchingTemplate.id].shifts.push(shift)
      }
    })

    Object.keys(grouped).forEach(templateId => {
      grouped[templateId].ranges = groupShiftsToRanges(grouped[templateId].shifts)
      grouped[templateId].handovers = getHandoversForTemplate(grouped[templateId].template)
    })

    return Object.values(grouped).sort((a, b) => {
      const aIsBereit = a.template.name?.toLowerCase().includes('bereit')
      const bIsBereit = b.template.name?.toLowerCase().includes('bereit')
      if (aIsBereit && !bIsBereit) return -1
      if (!aIsBereit && bIsBereit) return 1
      return (a.template.start_time || '').localeCompare(b.template.start_time || '')
    })
  }

  const getTemplateIcon = (templateName) => {
    const name = templateName?.toLowerCase() || ''
    if (name.includes('bereit')) return '🔴'
    if (name.includes('frueh') || name.includes('früh')) return '🌅'
    if (name.includes('tag')) return '☀️'
    if (name.includes('spaet') || name.includes('spät')) return '🌙'
    if (name.includes('nacht')) return '🌃'
    return '📋'
  }

  const getReasonLabel = (reason) => {
    if (reason === 'krankheit') return 'Krankheit'
    if (reason === 'privat') return 'Privat'
    if (reason === 'tausch') return 'Tausch'
    return reason
  }

  const getEmployeeName = (empId) => {
    const emp = employees.find(e => e.id === empId)
    return emp ? (emp.nachname + ', ' + emp.vorname) : 'Unbekannt'
  }

  // Abwesenheits-Funktionen
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

  const getAbsenceColor = (type) => {
    switch (type) {
      case 'urlaub': return { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-700' }
      case 'krank': return { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-700' }
      case 'fza': return { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700' }
      case 'fortbildung': return { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700' }
      case 'sonderurlaub': return { bg: 'bg-pink-50', border: 'border-pink-400', text: 'text-pink-700' }
      default: return { bg: 'bg-gray-50', border: 'border-gray-400', text: 'text-gray-700' }
    }
  }

  // Abwesenheiten nach Typ gruppieren
  const getAbsencesByType = () => {
    const types = ['urlaub', 'krank', 'fza', 'fortbildung', 'sonderurlaub']
    const grouped = {}
    
    types.forEach(type => {
      grouped[type] = absences.filter(a => a.absence_type === type)
    })
    
    return grouped
  }

  // Pruefen ob MA an einem bestimmten Datum abwesend ist
  const isEmployeeAbsent = (employeeId, dateStr) => {
    return absences.find(a => {
      const startDate = new Date(a.start_date)
      const endDate = new Date(a.end_date)
      const checkDate = new Date(dateStr)
      return a.employee_id === employeeId && checkDate >= startDate && checkDate <= endDate
    })
  }

  // Pruefen ob MA in einem Zeitraum abwesend ist
  const getEmployeeAbsenceInRange = (employeeId, startDateStr, endDateStr) => {
    return absences.find(a => {
      const absStart = new Date(a.start_date)
      const absEnd = new Date(a.end_date)
      const rangeStart = new Date(startDateStr)
      const rangeEnd = new Date(endDateStr)
      // Ueberschneidung pruefen
      return a.employee_id === employeeId && absStart <= rangeEnd && absEnd >= rangeStart
    })
  }

  // ===== DATEN LADEN =====

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/'); return }
        setUser(session.user)
        
        const userRole = await getUserRole(session.user.id)
        setRole(userRole)
        
        const { data: empData } = await supabase
          .from('employees').select('*').eq('status', 'active').order('nachname')
        setEmployees(empData || [])
        
        const { data: objData } = await supabase
          .from('objects').select('*').eq('is_active', true).order('name')
        setObjects(objData || [])
        
        const { data: tempData } = await supabase
          .from('shift_templates').select('*').eq('is_active', true).order('start_time')
        setShiftTemplates(tempData || [])
        
      } catch (err) {
        console.error('Fehler:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

  // Schichten, Wechsel und Abwesenheiten laden
  useEffect(() => {
    const loadAllData = async () => {
      if (!user) return
      
      const { startDate, endDate } = getWeekRange()
      
      // Schichten laden
      let query = supabase
        .from('shifts')
        .select('*, employee:employees!shifts_employee_id_fkey(id, vorname, nachname), object:objects(id, name, short_name)')
        .gte('date', startDate)
        .lte('date', endDate)
        .neq('status', 'cancelled')
        .order('date')
        .order('start_time')
      
      if (selectedObject !== 'alle') {
        query = query.eq('object_id', selectedObject)
      }
      
      const { data: shiftsData, error: shiftsError } = await query
      if (shiftsError) console.error('Shifts error:', shiftsError)
      setShifts(shiftsData || [])
      
      // Wechsel laden
      try {
        const { data: handoversData } = await supabase
          .from('shift_handovers')
          .select('*')
          .gte('handover_date', startDate)
          .lte('handover_date', endDate)
          .eq('status', 'approved')
        setHandovers(handoversData || [])
      } catch (e) {
        setHandovers([])
      }
      
      // Abwesenheiten laden (die in diese Woche fallen)
      try {
        const { data: absencesData } = await supabase
          .from('absences')
          .select('*')
          .lte('start_date', endDate)
          .gte('end_date', startDate)
          .in('status', ['approved', 'confirmed'])
        setAbsences(absencesData || [])
      } catch (e) {
        setAbsences([])
      }
    }
    loadAllData()
  }, [currentDate, selectedObject, user])

  // ===== AKTIONEN =====

  const openAddModal = (template) => {
    const { startDate, endDate } = getWeekRange()
    setAddForm({ employee_id: '', start_date: startDate, end_date: endDate })
    setShowAddModal({ templateId: template.id, templateName: template.name, template })
  }

  const openHandoverModal = (template) => {
    const { startDate, endDate } = getWeekRange()
    setHandoverForm({
      original_employee_id: '', replacement_employee_id: '',
      handover_date: startDate, end_date: endDate,
      reason: 'krankheit', reason_details: '',
    })
    setShowHandoverModal({ template })
  }

  const openAbsenceModal = () => {
    const { startDate, endDate } = getWeekRange()
    setAbsenceForm({
      employee_id: '', absence_type: 'urlaub',
      start_date: startDate, end_date: endDate, reason: '',
    })
    setShowAbsenceModal(true)
  }

  const handleAddShift = async (e) => {
    e.preventDefault()
    if (!addForm.employee_id) { alert('Bitte Mitarbeiter auswaehlen'); return }

    // Pruefen ob MA in diesem Zeitraum abwesend ist
    const absence = getEmployeeAbsenceInRange(addForm.employee_id, addForm.start_date, addForm.end_date)
    if (absence) {
      const empName = getEmployeeName(addForm.employee_id)
      const absType = getAbsenceLabel(absence.absence_type)
      const confirmAdd = confirm(
        `⚠️ ACHTUNG: ${empName} ist in diesem Zeitraum als "${absType}" eingetragen!\n\n` +
        `Abwesenheit: ${formatDateShort(absence.start_date)} - ${formatDateShort(absence.end_date)}\n\n` +
        `Trotzdem Schicht hinzufuegen?`
      )
      if (!confirmAdd) return
    }

    const template = showAddModal.template
    const start = new Date(addForm.start_date + 'T00:00:00')
    const end = new Date(addForm.end_date + 'T00:00:00')
    
    const shiftsToCreate = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      shiftsToCreate.push({
        employee_id: addForm.employee_id,
        object_id: selectedObject !== 'alle' ? selectedObject : objects[0]?.id,
        date: formatDateLocal(d),
        start_time: template.start_time?.substring(0, 5) || '08:00',
        end_time: template.end_time?.substring(0, 5) || '16:00',
        shift_type: template.name?.toLowerCase() || 'regular',
        status: 'scheduled',
        notes: template.name,
        created_by: user.id
      })
    }

    if (shiftsToCreate.length === 0) { alert('Keine Schichten zu erstellen'); return }

    try {
      const { error } = await supabase.from('shifts').insert(shiftsToCreate)
      if (error) throw error

      const { startDate, endDate } = getWeekRange()
      let query = supabase
        .from('shifts')
        .select('*, employee:employees!shifts_employee_id_fkey(id, vorname, nachname), object:objects(id, name, short_name)')
        .gte('date', startDate).lte('date', endDate).neq('status', 'cancelled')
      if (selectedObject !== 'alle') query = query.eq('object_id', selectedObject)
      const { data } = await query
      setShifts(data || [])

      setShowAddModal(null)
      alert(shiftsToCreate.length + ' Schicht(en) erstellt!')
    } catch (err) {
      console.error(err)
      alert('Fehler: ' + err.message)
    }
  }

  const handleAddHandover = async (e) => {
    e.preventDefault()
    
    if (!handoverForm.original_employee_id || !handoverForm.replacement_employee_id) {
      alert('Bitte beide Mitarbeiter auswaehlen'); return
    }
    if (handoverForm.original_employee_id === handoverForm.replacement_employee_id) {
      alert('Mitarbeiter koennen nicht mit sich selbst tauschen'); return
    }

    try {
      const { error } = await supabase.from('shift_handovers').insert([{
        shift_type: showHandoverModal.template.name?.toLowerCase() || 'schicht',
        object_id: selectedObject !== 'alle' ? selectedObject : null,
        original_employee_id: handoverForm.original_employee_id,
        replacement_employee_id: handoverForm.replacement_employee_id,
        handover_date: handoverForm.handover_date,
        end_date: handoverForm.end_date,
        reason: handoverForm.reason,
        reason_details: handoverForm.reason_details,
        status: 'approved',
        created_by: user.id,
        approved_by: user.id,
        approved_at: new Date().toISOString()
      }])

      if (error) throw error

      const { startDate, endDate } = getWeekRange()
      const { data: handoversData } = await supabase
        .from('shift_handovers').select('*')
        .gte('handover_date', startDate).lte('handover_date', endDate)
        .eq('status', 'approved')
      setHandovers(handoversData || [])

      setShowHandoverModal(null)
      alert('Wechsel eingetragen!')
    } catch (err) {
      console.error(err)
      alert('Fehler: ' + err.message)
    }
  }

  const handleAddAbsence = async (e) => {
    e.preventDefault()
    
    if (!absenceForm.employee_id) { alert('Bitte Mitarbeiter auswaehlen'); return }

    try {
      const { error } = await supabase.from('absences').insert([{
        employee_id: absenceForm.employee_id,
        absence_type: absenceForm.absence_type,
        start_date: absenceForm.start_date,
        end_date: absenceForm.end_date,
        reason: absenceForm.reason,
        status: 'approved',
        created_by: user.id,
        approved_by: user.id,
        approved_at: new Date().toISOString()
      }])

      if (error) throw error

      // Neu laden
      const { startDate, endDate } = getWeekRange()
      const { data: absencesData } = await supabase
        .from('absences').select('*')
        .lte('start_date', endDate).gte('end_date', startDate)
        .eq('status', 'approved')
      setAbsences(absencesData || [])

      setShowAbsenceModal(false)
      alert('Abwesenheit eingetragen!')
    } catch (err) {
      console.error(err)
      alert('Fehler: ' + err.message)
    }
  }

  const handleDeleteShift = async (shiftIds) => {
    if (!confirm(shiftIds.length + ' Schicht(en) wirklich loeschen?')) return
    try {
      for (const id of shiftIds) {
        await supabase.from('shifts').delete().eq('id', id)
      }
      setShifts(shifts.filter(s => !shiftIds.includes(s.id)))
      setShowDetailModal(null)
      alert('Geloescht!')
    } catch (err) { console.error(err) }
  }

  const handleDeleteHandover = async (handoverId) => {
    if (!confirm('Wechsel wirklich loeschen?')) return
    try {
      await supabase.from('shift_handovers').delete().eq('id', handoverId)
      setHandovers(handovers.filter(h => h.id !== handoverId))
      setShowHandoverDetailModal(null)
      alert('Wechsel geloescht!')
    } catch (err) { console.error(err) }
  }

  const handleDeleteAbsence = async (absenceId) => {
    if (!confirm('Abwesenheit wirklich loeschen?')) return
    try {
      await supabase.from('absences').delete().eq('id', absenceId)
      setAbsences(absences.filter(a => a.id !== absenceId))
      setShowAbsenceDetailModal(null)
      alert('Abwesenheit geloescht!')
    } catch (err) { console.error(err) }
  }

  // ===== MONATSANSICHT =====

  const openMonthView = async () => {
    setShowMonthView(true)
    setMonthViewDate(new Date(currentDate))
    await loadMonthData(currentDate)
  }

  const loadMonthData = async (date) => {
    setLoadingMonth(true)
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    const startStr = formatDateLocal(firstDay)
    const endStr = formatDateLocal(lastDay)

    try {
      // Schichten laden
      let shiftQuery = supabase
        .from('shifts')
        .select('*, employee:employees!shifts_employee_id_fkey(id, vorname, nachname), object:objects(id, name, short_name)')
        .gte('date', startStr)
        .lte('date', endStr)
        .neq('status', 'cancelled')
      
      if (selectedObject !== 'alle') {
        shiftQuery = shiftQuery.eq('object_id', selectedObject)
      }
      
      const { data: shiftData } = await shiftQuery
      setMonthShifts(shiftData || [])

      // Abwesenheiten laden
      const { data: absData } = await supabase
        .from('absences')
        .select('*')
        .lte('start_date', endStr)
        .gte('end_date', startStr)
        .in('status', ['approved', 'confirmed'])
      setMonthAbsences(absData || [])
    } catch (err) {
      console.error('Fehler beim Laden:', err)
    } finally {
      setLoadingMonth(false)
    }
  }

  const navigateMonth = async (direction) => {
    const newDate = new Date(monthViewDate)
    newDate.setMonth(newDate.getMonth() + direction)
    setMonthViewDate(newDate)
    await loadMonthData(newDate)
  }

  const getMonthDays = () => {
    const year = monthViewDate.getFullYear()
    const month = monthViewDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startWeekday = (firstDay.getDay() + 6) % 7 // Montag = 0

    const days = []
    
    // Leere Tage am Anfang
    for (let i = 0; i < startWeekday; i++) {
      days.push(null)
    }
    
    // Tage des Monats
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d))
    }
    
    return days
  }

  const getShiftsForDay = (date, objectId = null) => {
    if (!date) return []
    const dateStr = formatDateLocal(date)
    return monthShifts.filter(s => {
      const matchDate = s.date === dateStr
      const matchObject = objectId ? s.object_id === objectId : true
      return matchDate && matchObject
    })
  }

  const getAbsencesForDay = (date) => {
    if (!date) return []
    return monthAbsences.filter(a => {
      const startDate = new Date(a.start_date)
      const endDate = new Date(a.end_date)
      return date >= startDate && date <= endDate
    })
  }

  const getMonthName = (date) => {
    return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  }

  const exportMonthToPDF = async () => {
    // Dynamisch jsPDF laden
    const { default: jsPDF } = await import('jspdf')
    
    const objectsToExport = selectedObject !== 'alle' 
      ? objects.filter(o => o.id === selectedObject)
      : objects

    if (objectsToExport.length === 0) {
      alert('Keine Objekte zum Exportieren')
      return
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const monthName = getMonthName(monthViewDate)
    const days = getMonthDays()
    const daysWithDates = days.filter(d => d !== null)

    objectsToExport.forEach((obj, objIndex) => {
      if (objIndex > 0) doc.addPage()

      // Header
      doc.setFontSize(18)
      doc.setFont(undefined, 'bold')
      doc.text(`Schichtplan - ${obj.name}`, 148, 15, { align: 'center' })
      
      doc.setFontSize(14)
      doc.setFont(undefined, 'normal')
      doc.text(monthName, 148, 23, { align: 'center' })

      // Kalender-Tabelle
      const startX = 10
      const startY = 35
      const cellWidth = 38
      const cellHeight = 28
      const headerHeight = 8

      const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

      // Wochentag-Header
      doc.setFontSize(10)
      doc.setFont(undefined, 'bold')
      weekdays.forEach((day, i) => {
        const x = startX + (i * cellWidth)
        doc.setFillColor(66, 139, 202)
        doc.rect(x, startY, cellWidth, headerHeight, 'F')
        doc.setTextColor(255, 255, 255)
        doc.text(day, x + cellWidth / 2, startY + 5.5, { align: 'center' })
      })
      doc.setTextColor(0, 0, 0)

      // Kalender-Zellen
      let currentRow = 0
      let currentCol = 0
      
      days.forEach((date, i) => {
        currentCol = i % 7
        if (i > 0 && currentCol === 0) currentRow++

        const x = startX + (currentCol * cellWidth)
        const y = startY + headerHeight + (currentRow * cellHeight)

        // Zellen-Hintergrund
        if (date) {
          const isWeekend = currentCol >= 5
          if (isWeekend) {
            doc.setFillColor(245, 245, 245)
          } else {
            doc.setFillColor(255, 255, 255)
          }
        } else {
          doc.setFillColor(240, 240, 240)
        }
        doc.rect(x, y, cellWidth, cellHeight, 'FD')

        if (date) {
          // Datum
          doc.setFontSize(8)
          doc.setFont(undefined, 'bold')
          doc.text(date.getDate().toString(), x + 2, y + 5)

          // Schichten fuer dieses Objekt
          const dayShifts = getShiftsForDay(date, obj.id)
          const dayAbsences = getAbsencesForDay(date)
          
          doc.setFontSize(6)
          doc.setFont(undefined, 'normal')
          
          let textY = y + 10
          
          // Schichten anzeigen (max 3)
          dayShifts.slice(0, 3).forEach(shift => {
            const shiftType = shift.shift_type?.substring(0, 3).toUpperCase() || 'SCH'
            const empName = shift.employee ? 
              (shift.employee.nachname?.substring(0, 6) || '') : '?'
            doc.text(`${shiftType}: ${empName}`, x + 2, textY)
            textY += 4
          })

          // Abwesenheiten anzeigen
          dayAbsences.forEach(abs => {
            const emp = employees.find(e => e.id === abs.employee_id)
            if (emp) {
              doc.setTextColor(200, 0, 0)
              const absType = abs.absence_type?.substring(0, 1).toUpperCase() || 'A'
              doc.text(`${absType}: ${emp.nachname?.substring(0, 6) || ''}`, x + 2, textY)
              doc.setTextColor(0, 0, 0)
              textY += 4
            }
          })

          // Warnung wenn keine Schicht
          if (dayShifts.length === 0 && currentCol < 5) {
            doc.setTextColor(255, 100, 100)
            doc.text('(leer)', x + 2, textY)
            doc.setTextColor(0, 0, 0)
          }
        }
      })

      // Legende
      const legendY = startY + headerHeight + ((currentRow + 1) * cellHeight) + 10
      doc.setFontSize(8)
      doc.text('Legende: U=Urlaub, K=Krank, F=FZA | Schichttypen aus Vorlagen', startX, legendY)
      
      // Footer
      doc.setFontSize(8)
      doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')} | Seite ${objIndex + 1} von ${objectsToExport.length}`, 148, 200, { align: 'center' })
    })

    // PDF speichern
    const filename = `Schichtplan_${monthName.replace(' ', '_')}.pdf`
    doc.save(filename)
  }

  // ===== RENDER =====

  const isAdmin = role === 'admin'
  const weekNumber = getWeekNumber(currentDate)
  const { display: weekDisplay } = getWeekRange()
  const groupedShifts = getShiftsByTemplate()
  const absencesByType = getAbsencesByType()
  const hasAbsences = absences.length > 0

  if (loading || !user) {
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
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">KW {weekNumber}</h1>
              <p className="text-gray-600">{weekDisplay}</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <button onClick={() => navigateWeek(-1)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded font-bold">◀</button>
              <button onClick={goToToday} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded font-semibold">Heute</button>
              <button onClick={() => navigateWeek(1)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded font-bold">▶</button>
              <select 
                value={selectedObject} 
                onChange={(e) => setSelectedObject(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
              >
                <option value="alle">Alle Objekte</option>
                {objects.map(obj => (
                  <option key={obj.id} value={obj.id}>{obj.short_name || obj.name}</option>
                ))}
              </select>
              <button 
                onClick={openMonthView}
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded font-semibold"
              >
                📅 Monatsansicht
              </button>
              <Link href="/dashboard">
                <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold">Zurueck</button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Hauptinhalt */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        
        {/* Schicht-Bloecke */}
        {groupedShifts.map(({ template, ranges, handovers: templateHandovers }) => (
          <div key={template.id} className="bg-white rounded-lg shadow overflow-hidden">
            <div 
              className="px-4 py-3 border-b-2"
              style={{ borderBottomColor: template.color || '#6B7280', backgroundColor: (template.color || '#6B7280') + '15' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getTemplateIcon(template.name)}</span>
                  <span className="font-bold text-gray-900 text-lg">{template.name?.toUpperCase()}</span>
                </div>
                <div className="text-sm text-gray-600">
                  {template.start_time?.substring(0, 5)} - {template.end_time?.substring(0, 5)} Uhr
                </div>
              </div>
            </div>

            <div className="p-4">
              {ranges.length === 0 && templateHandovers.length === 0 ? (
                <p className="text-gray-400 text-sm italic">Keine Eintraege</p>
              ) : (
                <div className="space-y-2">
                  {ranges.map((range, idx) => {
                    // Pruefen ob MA in diesem Zeitraum abwesend ist
                    const absence = getEmployeeAbsenceInRange(range.employee?.id, range.startDate, range.endDate)
                    
                    return (
                      <div 
                        key={'range-' + idx}
                        onClick={() => setShowDetailModal(range)}
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition border-l-4 ${
                          absence 
                            ? 'bg-red-50 hover:bg-red-100 border-red-500' 
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                        style={!absence ? { borderLeftColor: template.color || '#6B7280' } : {}}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold ${absence ? 'text-red-700 line-through' : 'text-gray-900'}`}>
                            {range.employee?.nachname}, {range.employee?.vorname}
                          </span>
                          {absence && (
                            <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-semibold">
                              ⚠️ {getAbsenceLabel(absence.absence_type)}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-600 font-mono">
                          {range.startDate === range.endDate 
                            ? formatDateShort(range.startDate)
                            : formatDateShort(range.startDate) + ' - ' + formatDateShort(range.endDate)
                          }
                        </span>
                      </div>
                    )
                  })}
                  
                  {templateHandovers.map((handover, idx) => (
                    <div 
                      key={'handover-' + idx}
                      onClick={() => setShowHandoverDetailModal(handover)}
                      className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 cursor-pointer transition border-l-4 border-yellow-500"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-yellow-600 font-bold">⚡</span>
                        <span className="text-gray-600">{getEmployeeName(handover.original_employee_id)}</span>
                        <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded">{getReasonLabel(handover.reason)}</span>
                        <span className="text-yellow-600 font-bold">→</span>
                        <span className="font-semibold text-gray-900">{getEmployeeName(handover.replacement_employee_id)}</span>
                      </div>
                      <span className="text-sm text-gray-600 font-mono">
                        ab {formatDateShort(handover.handover_date)}
                        {handover.end_date && handover.end_date !== handover.handover_date && ' - ' + formatDateShort(handover.end_date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {isAdmin && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => openAddModal(template)} className="flex-1 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition flex items-center justify-center gap-2">
                    <span>+</span><span>Hinzufuegen</span>
                  </button>
                  <button onClick={() => openHandoverModal(template)} className="py-2 px-4 border-2 border-dashed border-yellow-300 rounded-lg text-yellow-600 hover:border-yellow-400 hover:bg-yellow-50 transition flex items-center justify-center gap-2">
                    <span>⚡</span><span>Wechsel</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Abwesenheiten */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b-2 border-orange-300 bg-orange-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                <span className="font-bold text-gray-900 text-lg">ABWESENHEITEN</span>
              </div>
              <div className="flex items-center gap-2">
                {hasAbsences && (
                  <span className="text-sm text-orange-600 font-semibold">{absences.length} Eintrag/Eintraege</span>
                )}
                <Link href="/dashboard/antraege">
                  <button className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded">
                    Antraege →
                  </button>
                </Link>
              </div>
            </div>
          </div>
          <div className="p-4">
            {!hasAbsences ? (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm italic mb-2">Keine Abwesenheiten in dieser Woche</p>
                <Link href="/dashboard/antraege">
                  <button className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded">
                    Urlaub/Krank beantragen
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Urlaub */}
                {absencesByType.urlaub.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span>🏖️</span>
                      <span className="font-semibold text-amber-700">Urlaub</span>
                    </div>
                    <div className="space-y-1 ml-6">
                      {absencesByType.urlaub.map(absence => (
                        <div 
                          key={absence.id}
                          onClick={() => setShowAbsenceDetailModal(absence)}
                          className="flex items-center justify-between p-2 bg-amber-50 rounded hover:bg-amber-100 cursor-pointer border-l-4 border-amber-400"
                        >
                          <span className="font-medium text-gray-900">{getEmployeeName(absence.employee_id)}</span>
                          <span className="text-sm text-gray-600 font-mono">
                            {formatDateShort(absence.start_date)} - {formatDateShort(absence.end_date)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Krank */}
                {absencesByType.krank.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span>🤒</span>
                      <span className="font-semibold text-red-700">Krank</span>
                    </div>
                    <div className="space-y-1 ml-6">
                      {absencesByType.krank.map(absence => (
                        <div 
                          key={absence.id}
                          onClick={() => setShowAbsenceDetailModal(absence)}
                          className="flex items-center justify-between p-2 bg-red-50 rounded hover:bg-red-100 cursor-pointer border-l-4 border-red-400"
                        >
                          <span className="font-medium text-gray-900">{getEmployeeName(absence.employee_id)}</span>
                          <span className="text-sm text-gray-600 font-mono">
                            {formatDateShort(absence.start_date)} - {formatDateShort(absence.end_date)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* FZA */}
                {absencesByType.fza.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span>⏰</span>
                      <span className="font-semibold text-purple-700">FZA</span>
                    </div>
                    <div className="space-y-1 ml-6">
                      {absencesByType.fza.map(absence => (
                        <div 
                          key={absence.id}
                          onClick={() => setShowAbsenceDetailModal(absence)}
                          className="flex items-center justify-between p-2 bg-purple-50 rounded hover:bg-purple-100 cursor-pointer border-l-4 border-purple-400"
                        >
                          <span className="font-medium text-gray-900">{getEmployeeName(absence.employee_id)}</span>
                          <span className="text-sm text-gray-600 font-mono">
                            {formatDateShort(absence.start_date)} - {formatDateShort(absence.end_date)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Fortbildung */}
                {absencesByType.fortbildung.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span>📚</span>
                      <span className="font-semibold text-blue-700">Fortbildung</span>
                    </div>
                    <div className="space-y-1 ml-6">
                      {absencesByType.fortbildung.map(absence => (
                        <div 
                          key={absence.id}
                          onClick={() => setShowAbsenceDetailModal(absence)}
                          className="flex items-center justify-between p-2 bg-blue-50 rounded hover:bg-blue-100 cursor-pointer border-l-4 border-blue-400"
                        >
                          <span className="font-medium text-gray-900">{getEmployeeName(absence.employee_id)}</span>
                          <span className="text-sm text-gray-600 font-mono">
                            {formatDateShort(absence.start_date)} - {formatDateShort(absence.end_date)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Sonderurlaub */}
                {absencesByType.sonderurlaub.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span>⭐</span>
                      <span className="font-semibold text-pink-700">Sonderurlaub</span>
                    </div>
                    <div className="space-y-1 ml-6">
                      {absencesByType.sonderurlaub.map(absence => (
                        <div 
                          key={absence.id}
                          onClick={() => setShowAbsenceDetailModal(absence)}
                          className="flex items-center justify-between p-2 bg-pink-50 rounded hover:bg-pink-100 cursor-pointer border-l-4 border-pink-400"
                        >
                          <span className="font-medium text-gray-900">{getEmployeeName(absence.employee_id)}</span>
                          <span className="text-sm text-gray-600 font-mono">
                            {formatDateShort(absence.start_date)} - {formatDateShort(absence.end_date)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {isAdmin && (
              <button
                onClick={openAbsenceModal}
                className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50 transition flex items-center justify-center gap-2"
              >
                <span>+</span><span>Abwesenheit melden</span>
              </button>
            )}
          </div>
        </div>

        {/* Statistik */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-500 text-xs">Schichten (KW {weekNumber})</p>
            <p className="text-2xl font-bold text-gray-900">{shifts.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-500 text-xs">Wechsel</p>
            <p className="text-2xl font-bold text-yellow-600">{handovers.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-500 text-xs">Abwesenheiten</p>
            <p className="text-2xl font-bold text-orange-600">{absences.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-500 text-xs">Mitarbeiter</p>
            <p className="text-2xl font-bold text-green-600">{employees.length}</p>
          </div>
        </div>
        
        {/* Legende */}
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Legende:</span>
            <span className="ml-3">⚡ Wechsel</span>
            <span className="ml-3">🏖️ Urlaub</span>
            <span className="ml-3">🤒 Krank</span>
            <span className="ml-3">⏰ FZA</span>
            <span className="ml-3">📚 Fortbildung</span>
            <span className="ml-3">⭐ Sonderurlaub</span>
          </p>
        </div>
      </div>

      {/* Modal: Schicht hinzufuegen */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="bg-blue-500 text-white p-4 rounded-t-lg">
              <h2 className="text-xl font-bold">{showAddModal.templateName} hinzufuegen</h2>
            </div>
            <form onSubmit={handleAddShift} className="p-4 space-y-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Mitarbeiter *</label>
                <select value={addForm.employee_id} onChange={(e) => setAddForm({ ...addForm, employee_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white" required>
                  <option value="">-- Auswaehlen --</option>
                  {employees.map(emp => {
                    const absence = getEmployeeAbsenceInRange(emp.id, addForm.start_date, addForm.end_date)
                    return (
                      <option key={emp.id} value={emp.id} className={absence ? 'text-red-600' : ''}>
                        {emp.nachname}, {emp.vorname}{absence ? ' ⚠️ ' + getAbsenceLabel(absence.absence_type) : ''}
                      </option>
                    )
                  })}
                </select>
                {addForm.employee_id && getEmployeeAbsenceInRange(addForm.employee_id, addForm.start_date, addForm.end_date) && (
                  <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                    ⚠️ Dieser Mitarbeiter ist im gewaehlten Zeitraum abwesend!
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Von *</label>
                  <input type="date" value={addForm.start_date} onChange={(e) => setAddForm({ ...addForm, start_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white" required />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Bis *</label>
                  <input type="date" value={addForm.end_date} onChange={(e) => setAddForm({ ...addForm, end_date: e.target.value })} min={addForm.start_date} className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white" required />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-semibold">Erstellen</button>
                <button type="button" onClick={() => setShowAddModal(null)} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold">Abbrechen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Wechsel eintragen */}
      {showHandoverModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="bg-yellow-500 text-white p-4 rounded-t-lg">
              <h2 className="text-xl font-bold">⚡ Wechsel eintragen</h2>
              <p className="text-yellow-100 text-sm">{showHandoverModal.template.name}</p>
            </div>
            <form onSubmit={handleAddHandover} className="p-4 space-y-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Wer gibt ab *</label>
                <select value={handoverForm.original_employee_id} onChange={(e) => setHandoverForm({ ...handoverForm, original_employee_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white" required>
                  <option value="">-- Auswaehlen --</option>
                  {employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.nachname}, {emp.vorname}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Wer uebernimmt *</label>
                <select value={handoverForm.replacement_employee_id} onChange={(e) => setHandoverForm({ ...handoverForm, replacement_employee_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white" required>
                  <option value="">-- Auswaehlen --</option>
                  {employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.nachname}, {emp.vorname}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Ab *</label>
                  <input type="date" value={handoverForm.handover_date} onChange={(e) => setHandoverForm({ ...handoverForm, handover_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white" required />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Bis</label>
                  <input type="date" value={handoverForm.end_date} onChange={(e) => setHandoverForm({ ...handoverForm, end_date: e.target.value })} min={handoverForm.handover_date} className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Grund *</label>
                <select value={handoverForm.reason} onChange={(e) => setHandoverForm({ ...handoverForm, reason: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white" required>
                  <option value="krankheit">Krankheit</option>
                  <option value="privat">Privat / Persoenlich</option>
                  <option value="tausch">Tausch</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Details (optional)</label>
                <textarea value={handoverForm.reason_details} onChange={(e) => setHandoverForm({ ...handoverForm, reason_details: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white" rows="2" placeholder="Weitere Informationen..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded font-semibold">Wechsel eintragen</button>
                <button type="button" onClick={() => setShowHandoverModal(null)} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold">Abbrechen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Abwesenheit melden */}
      {showAbsenceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="bg-orange-500 text-white p-4 rounded-t-lg">
              <h2 className="text-xl font-bold">📋 Abwesenheit melden</h2>
            </div>
            <form onSubmit={handleAddAbsence} className="p-4 space-y-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Mitarbeiter *</label>
                <select value={absenceForm.employee_id} onChange={(e) => setAbsenceForm({ ...absenceForm, employee_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white" required>
                  <option value="">-- Auswaehlen --</option>
                  {employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.nachname}, {emp.vorname}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Art *</label>
                <select value={absenceForm.absence_type} onChange={(e) => setAbsenceForm({ ...absenceForm, absence_type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white" required>
                  <option value="urlaub">🏖️ Urlaub</option>
                  <option value="krank">🤒 Krank</option>
                  <option value="fza">⏰ FZA (Freizeitausgleich)</option>
                  <option value="fortbildung">📚 Fortbildung</option>
                  <option value="sonderurlaub">⭐ Sonderurlaub</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Von *</label>
                  <input type="date" value={absenceForm.start_date} onChange={(e) => setAbsenceForm({ ...absenceForm, start_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white" required />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Bis *</label>
                  <input type="date" value={absenceForm.end_date} onChange={(e) => setAbsenceForm({ ...absenceForm, end_date: e.target.value })} min={absenceForm.start_date} className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white" required />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Bemerkung (optional)</label>
                <textarea value={absenceForm.reason} onChange={(e) => setAbsenceForm({ ...absenceForm, reason: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white" rows="2" placeholder="z.B. Familienurlaub, Grippe, etc." />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded font-semibold">Abwesenheit eintragen</button>
                <button type="button" onClick={() => setShowAbsenceModal(false)} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold">Abbrechen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Schicht-Details */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="bg-blue-500 text-white p-4 rounded-t-lg">
              <h2 className="text-xl font-bold">Schicht-Details</h2>
            </div>
            <div className="p-4 space-y-3">
              <p className="font-bold text-gray-900 text-lg">{showDetailModal.employee?.nachname}, {showDetailModal.employee?.vorname}</p>
              <div className="bg-gray-50 rounded p-3 space-y-2">
                <p className="text-gray-600"><strong>Zeitraum:</strong> {formatDateShort(showDetailModal.startDate)}{showDetailModal.startDate !== showDetailModal.endDate && ' - ' + formatDateShort(showDetailModal.endDate)}</p>
                <p className="text-gray-600"><strong>Anzahl Tage:</strong> {showDetailModal.shifts?.length || 1}</p>
                {showDetailModal.shifts?.[0]?.object && (<p className="text-gray-600"><strong>Objekt:</strong> {showDetailModal.shifts[0].object.name}</p>)}
              </div>
              {isAdmin && (<button onClick={() => handleDeleteShift(showDetailModal.shifts.map(s => s.id))} className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold">Alle {showDetailModal.shifts?.length} Schicht(en) loeschen</button>)}
            </div>
            <div className="p-4 border-t">
              <button onClick={() => setShowDetailModal(null)} className="w-full bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold">Schliessen</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Wechsel-Details */}
      {showHandoverDetailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="bg-yellow-500 text-white p-4 rounded-t-lg">
              <h2 className="text-xl font-bold">⚡ Wechsel-Details</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                <div className="flex items-center justify-center gap-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Urspruenglich</p>
                    <p className="font-semibold text-gray-700">{getEmployeeName(showHandoverDetailModal.original_employee_id)}</p>
                  </div>
                  <span className="text-2xl text-yellow-500">→</span>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Uebernommen von</p>
                    <p className="font-bold text-gray-900">{getEmployeeName(showHandoverDetailModal.replacement_employee_id)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded p-3 space-y-2">
                <p className="text-gray-600"><strong>Ab:</strong> {formatDateShort(showHandoverDetailModal.handover_date)}</p>
                {showHandoverDetailModal.end_date && (<p className="text-gray-600"><strong>Bis:</strong> {formatDateShort(showHandoverDetailModal.end_date)}</p>)}
                <p className="text-gray-600"><strong>Grund:</strong> {getReasonLabel(showHandoverDetailModal.reason)}</p>
                {showHandoverDetailModal.reason_details && (<p className="text-gray-600"><strong>Details:</strong> {showHandoverDetailModal.reason_details}</p>)}
              </div>
              {isAdmin && (<button onClick={() => handleDeleteHandover(showHandoverDetailModal.id)} className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold">Wechsel loeschen</button>)}
            </div>
            <div className="p-4 border-t">
              <button onClick={() => setShowHandoverDetailModal(null)} className="w-full bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold">Schliessen</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Abwesenheit-Details */}
      {showAbsenceDetailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="bg-orange-500 text-white p-4 rounded-t-lg">
              <h2 className="text-xl font-bold">{getAbsenceIcon(showAbsenceDetailModal.absence_type)} Abwesenheit-Details</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getAbsenceIcon(showAbsenceDetailModal.absence_type)}</span>
                <div>
                  <p className="font-bold text-gray-900 text-lg">{getEmployeeName(showAbsenceDetailModal.employee_id)}</p>
                  <p className="text-gray-600">{getAbsenceLabel(showAbsenceDetailModal.absence_type)}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded p-3 space-y-2">
                <p className="text-gray-600"><strong>Von:</strong> {formatDateShort(showAbsenceDetailModal.start_date)}</p>
                <p className="text-gray-600"><strong>Bis:</strong> {formatDateShort(showAbsenceDetailModal.end_date)}</p>
                {showAbsenceDetailModal.reason && (<p className="text-gray-600"><strong>Bemerkung:</strong> {showAbsenceDetailModal.reason}</p>)}
                <p className="text-gray-500 text-xs mt-2">Eingetragen am: {new Date(showAbsenceDetailModal.created_at).toLocaleString('de-DE')}</p>
              </div>
              {isAdmin && (<button onClick={() => handleDeleteAbsence(showAbsenceDetailModal.id)} className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold">Abwesenheit loeschen</button>)}
            </div>
            <div className="p-4 border-t">
              <button onClick={() => setShowAbsenceDetailModal(null)} className="w-full bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold">Schliessen</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Monatsansicht */}
      {showMonthView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => navigateMonth(-1)} 
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded font-bold"
                  >
                    ◀
                  </button>
                  <h2 className="text-2xl font-bold">
                    📅 {getMonthName(monthViewDate)}
                  </h2>
                  <button 
                    onClick={() => navigateMonth(1)} 
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded font-bold"
                  >
                    ▶
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={exportMonthToPDF}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-semibold flex items-center gap-2"
                  >
                    📄 PDF Export
                  </button>
                  <button 
                    onClick={() => setShowMonthView(false)}
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded font-semibold"
                  >
                    ✕ Schliessen
                  </button>
                </div>
              </div>
              <p className="text-purple-100 mt-1">
                {selectedObject !== 'alle' 
                  ? `Objekt: ${objects.find(o => o.id === selectedObject)?.name || ''}`
                  : 'Alle Objekte'
                }
              </p>
            </div>

            {/* Kalender-Content */}
            <div className="flex-1 overflow-auto p-4">
              {loadingMonth ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Lade Monatsdaten...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Objekt-weise Darstellung */}
                  {(selectedObject !== 'alle' ? objects.filter(o => o.id === selectedObject) : objects).map(obj => (
                    <div key={obj.id} className="mb-8">
                      <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span 
                          className="w-4 h-4 rounded" 
                          style={{ backgroundColor: obj.color || '#6B7280' }}
                        ></span>
                        {obj.name}
                      </h3>
                      
                      {/* Kalender-Grid */}
                      <div className="border rounded-lg overflow-hidden">
                        {/* Wochentag-Header */}
                        <div className="grid grid-cols-7 bg-gray-100 border-b">
                          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                            <div key={day} className="px-2 py-2 text-center font-semibold text-gray-700 text-sm">
                              {day}
                            </div>
                          ))}
                        </div>
                        
                        {/* Kalender-Zellen */}
                        <div className="grid grid-cols-7">
                          {getMonthDays().map((date, idx) => {
                            const dayShifts = getShiftsForDay(date, obj.id)
                            const dayAbsences = date ? getAbsencesForDay(date) : []
                            const isWeekend = idx % 7 >= 5
                            const isEmpty = date && dayShifts.length === 0 && !isWeekend
                            
                            return (
                              <div 
                                key={idx} 
                                className={`min-h-[80px] border-b border-r p-1 ${
                                  !date ? 'bg-gray-50' : 
                                  isWeekend ? 'bg-gray-50' : 
                                  isEmpty ? 'bg-red-50' : 'bg-white'
                                }`}
                              >
                                {date && (
                                  <>
                                    <div className={`text-xs font-bold mb-1 ${isEmpty ? 'text-red-600' : 'text-gray-600'}`}>
                                      {date.getDate()}
                                    </div>
                                    
                                    {/* Schichten */}
                                    {dayShifts.slice(0, 3).map((shift, sIdx) => {
                                      const template = shiftTemplates.find(t => t.id === shift.template_id)
                                      const shiftName = shift.shift_type || template?.name || 'Schicht'
                                      return (
                                        <div 
                                          key={sIdx}
                                          className="text-xs mb-0.5 px-1 py-0.5 rounded truncate"
                                          style={{ 
                                            backgroundColor: (template?.color || '#6B7280') + '30',
                                            color: template?.color || '#6B7280'
                                          }}
                                        >
                                          <span className="font-semibold">{shiftName.substring(0, 3).toUpperCase()}</span>
                                          {': '}
                                          <span>{shift.employee?.nachname?.substring(0, 8) || '?'}</span>
                                        </div>
                                      )
                                    })}
                                    {dayShifts.length > 3 && (
                                      <div className="text-xs text-gray-500">+{dayShifts.length - 3} weitere</div>
                                    )}
                                    
                                    {/* Abwesenheiten */}
                                    {dayAbsences.map((abs, aIdx) => {
                                      const emp = employees.find(e => e.id === abs.employee_id)
                                      if (!emp) return null
                                      return (
                                        <div 
                                          key={`abs-${aIdx}`}
                                          className="text-xs mb-0.5 px-1 py-0.5 rounded truncate bg-red-100 text-red-700"
                                        >
                                          {abs.absence_type === 'urlaub' ? 'U' : 
                                           abs.absence_type === 'krank' ? 'K' : 
                                           abs.absence_type === 'fza' ? 'F' : 'A'}
                                          : {emp.nachname?.substring(0, 8) || ''}
                                        </div>
                                      )
                                    })}
                                    
                                    {/* Warnung */}
                                    {isEmpty && (
                                      <div className="text-xs text-red-500 italic">leer</div>
                                    )}
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Footer/Legende */}
            <div className="border-t p-3 bg-gray-50">
              <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                <span><strong>Legende:</strong></span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-red-100 rounded"></span> U = Urlaub
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-red-100 rounded"></span> K = Krank
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-red-100 rounded"></span> F = FZA
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-red-50 rounded border border-red-200"></span> = Keine Besetzung
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}