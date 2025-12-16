'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getUserRole } from '@/lib/auth'
import Link from 'next/link'

export default function Personalverwaltung() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [employees, setEmployees] = useState([])
  const [objects, setObjects] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()

  const [formData, setFormData] = useState({
    vorname: '',
    nachname: '',
    firma_telefon: '',
    firma_mail: '',
    telefon_privat: '',
    mail_privat: '',
    einstiegsdatum: '',
    job_titel: '',
    objekt_stelle: '',
    haupt_objekt: '',
    personal_nr: '',
    haupt_object_id: '',
    urlaubstage_jahr: 30,
    urlaubstage_genommen: 0,
    urlaubstage_vorjahr: 0,
    ueberstunden_konto: 0,
    status: 'active',
    user_id: '',
  })

  // Account-Erstellung
  const [createAccount, setCreateAccount] = useState(false)
  const [accountData, setAccountData] = useState({
    email: '',
    password: '',
    role: 'haustechniker',
  })
  const [creatingAccount, setCreatingAccount] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/'); return }
        setUser(session.user)
        const userRole = await getUserRole(session.user.id)
        setRole(userRole)

        const { data: empData } = await supabase.from('employees').select('*').order('nachname')
        setEmployees(empData || [])

        const { data: objData } = await supabase.from('objects').select('*').eq('is_active', true).order('name')
        setObjects(objData || [])

        // Benutzer-Accounts laden (für Zuordnung)
        const { data: usersData } = await supabase.from('user_roles').select('user_id, role')
        setUsers(usersData || [])
      } catch (err) {
        console.error('Fehler:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

  const resetForm = () => {
  const resetForm = () => {
    setFormData({
      vorname: '', nachname: '', firma_telefon: '', firma_mail: '',
      telefon_privat: '', mail_privat: '', einstiegsdatum: '', job_titel: '',
      objekt_stelle: '', haupt_objekt: '', personal_nr: '', haupt_object_id: '',
      urlaubstage_jahr: 30, urlaubstage_genommen: 0, urlaubstage_vorjahr: 0,
      ueberstunden_konto: 0, status: 'active', user_id: '',
    })
    setCreateAccount(false)
    setAccountData({ email: '', password: '', role: 'haustechniker' })
    setEditingId(null)
    setShowForm(false)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!formData.vorname || !formData.nachname) { 
      alert('Vorname und Nachname sind erforderlich')
      return 
    }

    // Validierung Account-Erstellung
    if (createAccount && !editingId) {
      if (!accountData.email || !accountData.password) {
        alert('Email und Passwort sind erforderlich für Account-Erstellung')
        return
      }
      if (accountData.password.length < 6) {
        alert('Passwort muss mindestens 6 Zeichen haben')
        return
      }
    }

    setCreatingAccount(true)

    try {
      let userId = formData.user_id

      // Schritt 1: Account erstellen (wenn gewünscht und Neuanlage)
      if (createAccount && !editingId) {
        const response = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: accountData.email,
            password: accountData.password,
            role: accountData.role,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Fehler beim Erstellen des Accounts')
        }

        userId = result.userId
        alert('✅ Benutzer-Account erfolgreich erstellt!')
      }

      // Schritt 2: Mitarbeiter speichern
      const dataToSave = {
        ...formData,
        haupt_object_id: formData.haupt_object_id || null,
        user_id: userId || null,
        urlaubstage_jahr: parseInt(formData.urlaubstage_jahr) || 30,
        urlaubstage_genommen: parseInt(formData.urlaubstage_genommen) || 0,
        urlaubstage_vorjahr: parseInt(formData.urlaubstage_vorjahr) || 0,
        ueberstunden_konto: parseFloat(formData.ueberstunden_konto) || 0,
      }

      if (editingId) {
        const { error } = await supabase.from('employees').update(dataToSave).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('employees').insert([dataToSave])
        if (error) throw error
      }

      // Schritt 3: Liste aktualisieren
      const { data } = await supabase.from('employees').select('*').order('nachname')
      setEmployees(data || [])
      
      resetForm()
      alert(editingId ? '✅ Mitarbeiter aktualisiert!' : '✅ Mitarbeiter hinzugefügt!')
      
    } catch (err) {
      console.error('Fehler:', err)
      alert('❌ Fehler: ' + err.message)
    } finally {
      setCreatingAccount(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Mitarbeiter wirklich loeschen?')) return
    try {
      const { error } = await supabase.from('employees').delete().eq('id', id)
      if (error) throw error
      setEmployees(employees.filter(emp => emp.id !== id))
      setShowDetailModal(null)
      alert('Mitarbeiter geloescht!')
    } catch (err) {
      alert('Fehler: ' + err.message)
    }
  }

  const handleEdit = (employee) => {
    setFormData({
      vorname: employee.vorname || '', nachname: employee.nachname || '',
      firma_telefon: employee.firma_telefon || '', firma_mail: employee.firma_mail || '',
      telefon_privat: employee.telefon_privat || '', mail_privat: employee.mail_privat || '',
      einstiegsdatum: employee.einstiegsdatum || '', job_titel: employee.job_titel || '',
      objekt_stelle: employee.objekt_stelle || '', haupt_objekt: employee.haupt_objekt || '',
      personal_nr: employee.personal_nr || '', haupt_object_id: employee.haupt_object_id || '',
      urlaubstage_jahr: employee.urlaubstage_jahr || 30,
      urlaubstage_genommen: employee.urlaubstage_genommen || 0,
      urlaubstage_vorjahr: employee.urlaubstage_vorjahr || 0,
      ueberstunden_konto: employee.ueberstunden_konto || 0,
      status: employee.status || 'active',
      user_id: employee.user_id || '',
    })
    setEditingId(employee.id)
    setShowForm(true)
    setShowDetailModal(null)
  }

  // Pruefen ob User bereits einem anderen Mitarbeiter zugewiesen ist
  const isUserAssigned = (userId) => {
    if (!userId) return false
    return employees.some(emp => emp.user_id === userId && emp.id !== editingId)
  }

  const getObjectName = (objectId) => {
    const obj = objects.find(o => o.id === objectId)
    return obj ? (obj.short_name || obj.name) : '-'
  }

  const getResturlaub = (emp) => {
    return (emp.urlaubstage_jahr || 30) + (emp.urlaubstage_vorjahr || 0) - (emp.urlaubstage_genommen || 0)
  }

  const filteredEmployees = employees.filter(emp => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return emp.vorname?.toLowerCase().includes(search) ||
           emp.nachname?.toLowerCase().includes(search) ||
           emp.personal_nr?.toLowerCase().includes(search) ||
           emp.firma_mail?.toLowerCase().includes(search)
  })

  const isAdmin = role === 'admin'

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Laedt...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Personalverwaltung</h1>
            <p className="text-gray-600 mt-1">{employees.length} Mitarbeiter | Rolle: <span className="font-semibold capitalize">{role}</span></p>
          </div>
          <Link href="/dashboard">
            <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold">Zurueck</button>
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-4 mb-6 items-center">
          {isAdmin && (
            <button onClick={() => setShowForm(!showForm)} className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded font-semibold">
              {showForm ? 'Abbrechen' : '+ Mitarbeiter hinzufuegen'}
            </button>
          )}
          <div className="flex-1 max-w-md">
            <input type="text" placeholder="Suchen (Name, Personal-Nr, Email...)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white" />
          </div>
        </div>

        {isAdmin && showForm && (
          <div className="bg-white rounded shadow p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">{editingId ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}</h2>
            <form onSubmit={handleSave}>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">Persoenliche Daten</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="block text-gray-700 font-semibold mb-2">Personal-Nr</label><input type="text" value={formData.personal_nr} onChange={(e) => setFormData({ ...formData, personal_nr: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white" placeholder="z.B. MA-001" /></div>
                  <div><label className="block text-gray-700 font-semibold mb-2">Vorname *</label><input type="text" value={formData.vorname} onChange={(e) => setFormData({ ...formData, vorname: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white" required /></div>
                  <div><label className="block text-gray-700 font-semibold mb-2">Nachname *</label><input type="text" value={formData.nachname} onChange={(e) => setFormData({ ...formData, nachname: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white" required /></div>
                </div>
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">Kontakt (Firma)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-gray-700 font-semibold mb-2">Firmentelefon</label><input type="tel" value={formData.firma_telefon} onChange={(e) => setFormData({ ...formData, firma_telefon: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white" /></div>
                  <div><label className="block text-gray-700 font-semibold mb-2">Firmenmail</label><input type="email" value={formData.firma_mail} onChange={(e) => setFormData({ ...formData, firma_mail: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white" /></div>
                </div>
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">Kontakt (Privat)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-gray-700 font-semibold mb-2">Telefon privat</label><input type="tel" value={formData.telefon_privat} onChange={(e) => setFormData({ ...formData, telefon_privat: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white" /></div>
                  <div><label className="block text-gray-700 font-semibold mb-2">Mail privat</label><input type="email" value={formData.mail_privat} onChange={(e) => setFormData({ ...formData, mail_privat: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white" /></div>
                </div>
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">Anstellung</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="block text-gray-700 font-semibold mb-2">Einstiegsdatum</label><input type="date" value={formData.einstiegsdatum} onChange={(e) => setFormData({ ...formData, einstiegsdatum: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white" /></div>
                  <div><label className="block text-gray-700 font-semibold mb-2">Job Titel</label><input type="text" value={formData.job_titel} onChange={(e) => setFormData({ ...formData, job_titel: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white" placeholder="z.B. Haustechniker" /></div>
                  <div><label className="block text-gray-700 font-semibold mb-2">Status</label><select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white"><option value="active">Aktiv</option><option value="inactive">Inaktiv</option></select></div>
                </div>
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">🔐 System-Zuordnung</h3>
                
                {!editingId ? (
                  /* NEUANLAGE: Account erstellen oder bestehenden zuweisen */
                  <div className="grid grid-cols-1 gap-4">
                    {/* Checkbox: Account erstellen */}
                    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createAccount}
                          onChange={(e) => {
                            setCreateAccount(e.target.checked)
                            if (e.target.checked) {
                              // Email automatisch vorschlagen
                              if (formData.vorname && formData.nachname && !accountData.email) {
                                const suggestedEmail = `${formData.vorname.toLowerCase()}.${formData.nachname.toLowerCase()}@firma.de`
                                setAccountData({ ...accountData, email: suggestedEmail })
                              }
                            }
                          }}
                          className="w-5 h-5 text-blue-600 mr-3"
                        />
                        <div>
                          <span className="text-gray-900 font-bold text-lg">Benutzer-Account erstellen</span>
                          <p className="text-gray-600 text-sm mt-1">
                            Erstellt automatisch einen Login-Account für diesen Mitarbeiter
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Account-Felder (nur wenn Checkbox aktiv) */}
                    {createAccount && (
                      <div className="bg-white border-2 border-blue-300 rounded-lg p-4 space-y-4">
                        <div className="bg-blue-100 rounded p-3 text-blue-800 text-sm">
                          <strong>ℹ️ Info:</strong> Der Mitarbeiter kann sich mit diesen Daten sofort einloggen.
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-gray-700 font-semibold mb-2">
                              Email * (Login-Name)
                            </label>
                            <input
                              type="email"
                              value={accountData.email}
                              onChange={(e) => setAccountData({ ...accountData, email: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                              placeholder="max.mustermann@firma.de"
                              required={createAccount}
                            />
                          </div>

                          <div>
                            <label className="block text-gray-700 font-semibold mb-2">
                              Passwort * (mind. 6 Zeichen)
                            </label>
                            <input
                              type="password"
                              value={accountData.password}
                              onChange={(e) => setAccountData({ ...accountData, password: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                              placeholder="••••••••"
                              minLength={6}
                              required={createAccount}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-gray-700 font-semibold mb-2">
                            Rolle *
                          </label>
                          <select
                            value={accountData.role}
                            onChange={(e) => setAccountData({ ...accountData, role: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                          >
                            <option value="haustechniker">Haustechniker</option>
                            <option value="objektleiter">Objektleiter</option>
                            <option value="admin">Admin</option>
                          </select>
                          <p className="text-gray-500 text-xs mt-1">
                            Legt fest welche Berechtigungen der Mitarbeiter hat
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Alternative: Bestehenden Account zuweisen */}
                    {!createAccount && (
                      <div>
                        <label className="block text-gray-700 font-semibold mb-2">
                          Oder: Bestehenden Account zuweisen
                        </label>
                        <select 
                          value={formData.user_id} 
                          onChange={(e) => setFormData({ ...formData, user_id: e.target.value })} 
                          className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                        >
                          <option value="">-- Kein Account zugewiesen --</option>
                          {users.map(u => {
                            const assigned = isUserAssigned(u.user_id)
                            const assignedTo = assigned ? employees.find(e => e.user_id === u.user_id) : null
                            return (
                              <option key={u.user_id} value={u.user_id} disabled={assigned}>
                                {u.user_id.substring(0, 8)}... ({u.role})
                                {assigned && assignedTo ? ` - bereits: ${assignedTo.vorname} ${assignedTo.nachname}` : ''}
                              </option>
                            )
                          })}
                        </select>
                        <p className="text-gray-500 text-xs mt-1">
                          Falls der Mitarbeiter bereits einen Account hat
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* BEARBEITEN: Nur Account zuweisen */
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">Benutzer-Account</label>
                      <select 
                        value={formData.user_id} 
                        onChange={(e) => setFormData({ ...formData, user_id: e.target.value })} 
                        className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                      >
                        <option value="">-- Kein Account zugewiesen --</option>
                        {users.map(u => {
                          const assigned = isUserAssigned(u.user_id)
                          const assignedTo = assigned ? employees.find(e => e.user_id === u.user_id) : null
                          return (
                            <option key={u.user_id} value={u.user_id} disabled={assigned}>
                              {u.user_id.substring(0, 8)}... ({u.role})
                              {assigned && assignedTo ? ` - bereits: ${assignedTo.vorname} ${assignedTo.nachname}` : ''}
                            </option>
                          )
                        })}
                      </select>
                      <p className="text-gray-500 text-xs mt-1">
                        Verknuepft diesen Mitarbeiter mit einem Login-Account
                      </p>
                      {formData.user_id && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                          ✓ Account zugewiesen
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">Objekt-Zuweisung</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-gray-700 font-semibold mb-2">Haupt-Objekt</label><select value={formData.haupt_object_id} onChange={(e) => setFormData({ ...formData, haupt_object_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white"><option value="">-- Kein Objekt --</option>{objects.map(obj => (<option key={obj.id} value={obj.id}>{obj.name}</option>))}</select><p className="text-gray-500 text-xs mt-1">Bestimmt den zustaendigen Objektleiter</p></div>
                  <div><label className="block text-gray-700 font-semibold mb-2">Objekt/Stelle (Text)</label><input type="text" value={formData.objekt_stelle} onChange={(e) => setFormData({ ...formData, objekt_stelle: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white" placeholder="z.B. Empfang" /></div>
                </div>
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">Urlaubskonto</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div><label className="block text-gray-700 font-semibold mb-2">Urlaubstage/Jahr</label><input type="number" value={formData.urlaubstage_jahr} onChange={(e) => setFormData({ ...formData, urlaubstage_jahr: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white" min="0" /></div>
                  <div><label className="block text-gray-700 font-semibold mb-2">Bereits genommen</label><input type="number" value={formData.urlaubstage_genommen} onChange={(e) => setFormData({ ...formData, urlaubstage_genommen: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white" min="0" /></div>
                  <div><label className="block text-gray-700 font-semibold mb-2">Resturlaub Vorjahr</label><input type="number" value={formData.urlaubstage_vorjahr} onChange={(e) => setFormData({ ...formData, urlaubstage_vorjahr: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white" min="0" /></div>
                  <div className="flex items-end"><div className="w-full p-3 bg-green-100 border border-green-300 rounded text-center"><p className="text-sm text-green-700">Resturlaub</p><p className="text-2xl font-bold text-green-800">{(parseInt(formData.urlaubstage_jahr) || 0) + (parseInt(formData.urlaubstage_vorjahr) || 0) - (parseInt(formData.urlaubstage_genommen) || 0)} Tage</p></div></div>
                </div>
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">Ueberstunden-Konto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-gray-700 font-semibold mb-2">Aktueller Stand (Stunden)</label><input type="number" step="0.5" value={formData.ueberstunden_konto} onChange={(e) => setFormData({ ...formData, ueberstunden_konto: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white" /></div>
                  <div className="flex items-end"><div className={`w-full p-3 rounded text-center border ${parseFloat(formData.ueberstunden_konto) >= 0 ? 'bg-blue-100 border-blue-300' : 'bg-red-100 border-red-300'}`}><p className={`text-sm ${parseFloat(formData.ueberstunden_konto) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>Ueberstunden</p><p className={`text-2xl font-bold ${parseFloat(formData.ueberstunden_konto) >= 0 ? 'text-blue-800' : 'text-red-800'}`}>{parseFloat(formData.ueberstunden_konto) || 0}h</p></div></div>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  type="submit" 
                  disabled={creatingAccount}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingAccount ? '⏳ Erstelle Account...' : 'Speichern'}
                </button>
                <button 
                  type="button" 
                  onClick={resetForm} 
                  disabled={creatingAccount}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded font-semibold disabled:opacity-50"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded shadow overflow-hidden">
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
            <h2 className="text-xl font-bold text-gray-900">Mitarbeiter ({filteredEmployees.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Personal-Nr</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Haupt-Objekt</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Resturlaub</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Ueberstunden</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-500">Keine Mitarbeiter gefunden</td></tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const resturlaub = getResturlaub(emp)
                    const ueberstunden = emp.ueberstunden_konto || 0
                    return (
                      <tr key={emp.id} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-mono text-sm">{emp.personal_nr || '-'}</td>
                        <td className="px-4 py-3"><p className="font-semibold text-gray-900">{emp.nachname}, {emp.vorname}</p><p className="text-gray-600 text-sm">{emp.job_titel || '-'}</p></td>
                        <td className="px-4 py-3 text-gray-900">{emp.haupt_object_id ? getObjectName(emp.haupt_object_id) : '-'}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-sm font-semibold ${resturlaub > 10 ? 'bg-green-100 text-green-800' : resturlaub > 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{resturlaub} Tage</span></td>
                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-sm font-semibold ${ueberstunden >= 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>{ueberstunden}h</span></td>
                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-semibold ${emp.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{emp.status === 'active' ? 'Aktiv' : 'Inaktiv'}</span></td>
                        <td className="px-4 py-3">
                          <button onClick={() => setShowDetailModal(emp)} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm mr-2">Details</button>
                          {isAdmin && (<button onClick={() => handleEdit(emp)} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-sm">Bearbeiten</button>)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded shadow p-4"><p className="text-gray-500 text-sm">Gesamt Mitarbeiter</p><p className="text-2xl font-bold text-gray-900">{employees.length}</p></div>
          <div className="bg-white rounded shadow p-4"><p className="text-gray-500 text-sm">Aktive</p><p className="text-2xl font-bold text-green-600">{employees.filter(e => e.status === 'active').length}</p></div>
          <div className="bg-white rounded shadow p-4"><p className="text-gray-500 text-sm">Durchschn. Resturlaub</p><p className="text-2xl font-bold text-blue-600">{employees.length > 0 ? (employees.reduce((sum, e) => sum + getResturlaub(e), 0) / employees.length).toFixed(1) : 0} Tage</p></div>
          <div className="bg-white rounded shadow p-4"><p className="text-gray-500 text-sm">Gesamt Ueberstunden</p><p className="text-2xl font-bold text-orange-600">{employees.reduce((sum, e) => sum + (e.ueberstunden_konto || 0), 0).toFixed(1)}h</p></div>
        </div>
      </div>

      {showDetailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-blue-500 text-white p-4 rounded-t-lg">
              <h2 className="text-xl font-bold">{showDetailModal.vorname} {showDetailModal.nachname}</h2>
              <p className="text-blue-100">{showDetailModal.personal_nr || 'Keine Personal-Nr'}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded p-4 text-center">
                  <p className="text-green-700 text-sm">Resturlaub</p>
                  <p className="text-3xl font-bold text-green-800">{getResturlaub(showDetailModal)}</p>
                  <p className="text-green-600 text-sm">Tage</p>
                </div>
                <div className={`rounded p-4 text-center border ${(showDetailModal.ueberstunden_konto || 0) >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                  <p className={`text-sm ${(showDetailModal.ueberstunden_konto || 0) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>Ueberstunden</p>
                  <p className={`text-3xl font-bold ${(showDetailModal.ueberstunden_konto || 0) >= 0 ? 'text-blue-800' : 'text-red-800'}`}>{showDetailModal.ueberstunden_konto || 0}</p>
                  <p className={`text-sm ${(showDetailModal.ueberstunden_konto || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Stunden</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded p-4 space-y-2">
                <p><strong>Job:</strong> {showDetailModal.job_titel || '-'}</p>
                <p><strong>Haupt-Objekt:</strong> {showDetailModal.haupt_object_id ? getObjectName(showDetailModal.haupt_object_id) : '-'}</p>
                <p><strong>Firmenmail:</strong> {showDetailModal.firma_mail || '-'}</p>
                <p><strong>Firmentelefon:</strong> {showDetailModal.firma_telefon || '-'}</p>
                <p><strong>Einstiegsdatum:</strong> {showDetailModal.einstiegsdatum ? new Date(showDetailModal.einstiegsdatum).toLocaleDateString('de-DE') : '-'}</p>
              </div>
              <div className="bg-gray-50 rounded p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Urlaubsberechnung</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Jahresurlaub: {showDetailModal.urlaubstage_jahr || 30} Tage</p>
                  <p>+ Resturlaub Vorjahr: {showDetailModal.urlaubstage_vorjahr || 0} Tage</p>
                  <p>- Bereits genommen: {showDetailModal.urlaubstage_genommen || 0} Tage</p>
                  <hr className="my-2" />
                  <p className="font-semibold text-gray-900">= Resturlaub: {getResturlaub(showDetailModal)} Tage</p>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2">
              {isAdmin && (<><button onClick={() => handleEdit(showDetailModal)} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded font-semibold">Bearbeiten</button><button onClick={() => handleDelete(showDetailModal.id)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold">Loeschen</button></>)}
              <button onClick={() => setShowDetailModal(null)} className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold">Schliessen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}