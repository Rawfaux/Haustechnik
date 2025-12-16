'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getUserRole } from '@/lib/auth'
import Link from 'next/link'

export default function AdminPanel() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('users')
  
  // Daten
  const [users, setUsers] = useState([])
  const [objects, setObjects] = useState([])
  const [objectAssignments, setObjectAssignments] = useState([])
  const [deputyAssignments, setDeputyAssignments] = useState([])
  const [employees, setEmployees] = useState([])
  
  // Modals
  const [showAssignObjectModal, setShowAssignObjectModal] = useState(null)
  const [showDeputyModal, setShowDeputyModal] = useState(null)
  
  // Forms
  const [selectedObjects, setSelectedObjects] = useState([])
  const [deputyForm, setDeputyForm] = useState({ deputy_id: '', priority: 1 })

  const router = useRouter()

  // Daten laden
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          router.push('/')
          return
        }

        setUser(session.user)

        const userRole = await getUserRole(session.user.id)
        setRole(userRole)

        if (userRole !== 'admin') {
          setTimeout(() => router.push('/dashboard'), 100)
          return
        }

        // Alle Benutzer mit Rollen laden
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('*')
          .order('created_at', { ascending: false })
        setUsers(rolesData || [])

        // Objekte laden
        const { data: objData } = await supabase
          .from('objects')
          .select('*')
          .order('name')
        setObjects(objData || [])

        // Objekt-Zuweisungen laden
        try {
          const { data: assignData } = await supabase
            .from('object_assignments')
            .select('*')
          setObjectAssignments(assignData || [])
        } catch (e) {
          setObjectAssignments([])
        }

        // Vertreter-Zuweisungen laden
        try {
          const { data: deputyData } = await supabase
            .from('deputy_assignments')
            .select('*')
            .order('priority')
          setDeputyAssignments(deputyData || [])
        } catch (e) {
          setDeputyAssignments([])
        }

        // Mitarbeiter laden (fuer Verknuepfung)
        const { data: empData } = await supabase
          .from('employees')
          .select('*')
          .order('nachname')
        setEmployees(empData || [])

      } catch (err) {
        console.error('Fehler beim Laden:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  // Rolle aendern
  const handleRoleChange = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId)

      if (error) throw error

      setUsers(users.map(u => u.user_id === userId ? { ...u, role: newRole } : u))
      alert('Rolle aktualisiert!')
    } catch (err) {
      alert('Fehler: ' + err.message)
    }
  }

  // Objekt-Zuweisungen fuer User
  const getObjectsForUser = (userId) => {
    return objectAssignments
      .filter(a => a.user_id === userId)
      .map(a => objects.find(o => o.id === a.object_id))
      .filter(Boolean)
  }

  // Vertreter fuer User
  const getDeputiesForUser = (userId) => {
    return deputyAssignments
      .filter(d => d.principal_id === userId)
      .sort((a, b) => a.priority - b.priority)
  }

  // User-Email finden
  const getUserEmail = (userId) => {
    const u = users.find(x => x.user_id === userId)
    return u ? (u.user_id.substring(0, 8) + '...') : 'Unbekannt'
  }

  // Objekt-Zuweisung Modal oeffnen
  const openAssignObjectModal = (userRecord) => {
    const currentObjects = objectAssignments
      .filter(a => a.user_id === userRecord.user_id)
      .map(a => a.object_id)
    setSelectedObjects(currentObjects)
    setShowAssignObjectModal(userRecord)
  }

  // Objekt-Zuweisungen speichern
  const handleSaveObjectAssignments = async () => {
    const userId = showAssignObjectModal.user_id
    
    try {
      // Alte Zuweisungen loeschen
      await supabase
        .from('object_assignments')
        .delete()
        .eq('user_id', userId)

      // Neue Zuweisungen erstellen
      if (selectedObjects.length > 0) {
        const newAssignments = selectedObjects.map(objId => ({
          user_id: userId,
          object_id: objId,
          assignment_type: 'objektleiter',
          created_by: user.id
        }))

        const { error } = await supabase
          .from('object_assignments')
          .insert(newAssignments)

        if (error) throw error
      }

      // Neu laden
      const { data } = await supabase.from('object_assignments').select('*')
      setObjectAssignments(data || [])

      setShowAssignObjectModal(null)
      alert('Objekt-Zuweisungen gespeichert!')
    } catch (err) {
      alert('Fehler: ' + err.message)
    }
  }

  // Objekt-Checkbox toggle
  const toggleObject = (objectId) => {
    if (selectedObjects.includes(objectId)) {
      setSelectedObjects(selectedObjects.filter(id => id !== objectId))
    } else {
      setSelectedObjects([...selectedObjects, objectId])
    }
  }

  // Vertreter Modal oeffnen
  const openDeputyModal = (userRecord) => {
    setDeputyForm({ deputy_id: '', priority: 1 })
    setShowDeputyModal(userRecord)
  }

  // Vertreter hinzufuegen
  const handleAddDeputy = async (e) => {
    e.preventDefault()
    
    if (!deputyForm.deputy_id) {
      alert('Bitte Vertreter auswaehlen')
      return
    }

    if (deputyForm.deputy_id === showDeputyModal.user_id) {
      alert('Ein Benutzer kann nicht sein eigener Vertreter sein')
      return
    }

    try {
      const { error } = await supabase
        .from('deputy_assignments')
        .insert([{
          principal_id: showDeputyModal.user_id,
          deputy_id: deputyForm.deputy_id,
          priority: deputyForm.priority,
          status: 'pending',
          created_by: user.id
        }])
      
      // Benachrichtigung an Vertreter senden
      await supabase.from('notifications').insert([{
        user_id: deputyForm.deputy_id,
        type: 'deputy_request',
        title: 'Neue Vertreter-Anfrage',
        message: 'Sie wurden als Vertreter angefragt.',
        link: '/dashboard/antraege'
      }])

      if (error) throw error

      // Neu laden
      const { data } = await supabase
        .from('deputy_assignments')
        .select('*')
        .order('priority')
      setDeputyAssignments(data || [])

      setDeputyForm({ deputy_id: '', priority: 1 })
      alert('Vertreter hinzugefuegt!')
    } catch (err) {
      if (err.message.includes('duplicate')) {
        alert('Dieser Vertreter ist bereits zugewiesen')
      } else {
        alert('Fehler: ' + err.message)
      }
    }
  }

  // Vertreter loeschen
  const handleDeleteDeputy = async (deputyAssignmentId) => {
    if (!confirm('Vertreter wirklich entfernen?')) return

    try {
      await supabase
        .from('deputy_assignments')
        .delete()
        .eq('id', deputyAssignmentId)

      setDeputyAssignments(deputyAssignments.filter(d => d.id !== deputyAssignmentId))
      alert('Vertreter entfernt!')
    } catch (err) {
      alert('Fehler: ' + err.message)
    }
  }

  // Objektleiter filtern
  const objektleiter = users.filter(u => u.role === 'objektleiter')

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Laedt...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-600 mt-1">Benutzer, Rollen & Objektleiter verwalten</p>
          </div>
          <Link href="/dashboard">
            <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold">
              ← Zurueck
            </button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded font-semibold ${
              activeTab === 'users'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            👥 Benutzer & Rollen
          </button>
          <button
            onClick={() => setActiveTab('objektleiter')}
            className={`px-4 py-2 rounded font-semibold ${
              activeTab === 'objektleiter'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            🏢 Objektleiter-Zuweisung
          </button>
          <button
            onClick={() => setActiveTab('vertreter')}
            className={`px-4 py-2 rounded font-semibold ${
              activeTab === 'vertreter'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            🔄 Vertreter-Regelung
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        
        {/* TAB: Benutzer & Rollen */}
        {activeTab === 'users' && (
          <div className="bg-white rounded shadow overflow-hidden">
            <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">
                Benutzer ({users.length})
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Benutzer ID</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Aktuelle Rolle</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Erstellt am</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Rolle aendern</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                        Keine Benutzer vorhanden
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="px-6 py-3 text-gray-900 text-sm font-mono">
                          {u.user_id.substring(0, 8)}...
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`px-3 py-1 rounded text-sm font-semibold ${
                              u.role === 'admin'
                                ? 'bg-red-100 text-red-800'
                                : u.role === 'objektleiter'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-gray-900 text-sm">
                          {new Date(u.created_at).toLocaleDateString('de-DE')}
                        </td>
                        <td className="px-6 py-3">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.user_id, e.target.value)}
                            className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                          >
                            <option value="haustechniker">Haustechniker</option>
                            <option value="objektleiter">Objektleiter</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: Objektleiter-Zuweisung */}
        {activeTab === 'objektleiter' && (
          <div className="space-y-6">
            {objektleiter.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-6 text-center">
                <p className="text-yellow-800 font-semibold mb-2">Keine Objektleiter vorhanden</p>
                <p className="text-yellow-700 text-sm">
                  Weisen Sie zuerst einem Benutzer die Rolle "Objektleiter" zu.
                </p>
              </div>
            ) : (
              objektleiter.map((ol) => {
                const assignedObjects = getObjectsForUser(ol.user_id)
                
                return (
                  <div key={ol.id} className="bg-white rounded shadow overflow-hidden">
                    <div className="bg-orange-50 border-b border-orange-200 px-6 py-4 flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          Objektleiter: {ol.user_id.substring(0, 8)}...
                        </h3>
                        <p className="text-gray-600 text-sm">
                          {assignedObjects.length} Objekt(e) zugewiesen
                        </p>
                      </div>
                      <button
                        onClick={() => openAssignObjectModal(ol)}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded font-semibold"
                      >
                        🏢 Objekte zuweisen
                      </button>
                    </div>
                    
                    <div className="p-4">
                      {assignedObjects.length === 0 ? (
                        <p className="text-gray-500 italic">Keine Objekte zugewiesen</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {assignedObjects.map(obj => (
                            <span
                              key={obj.id}
                              className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold"
                            >
                              {obj.short_name || obj.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}

            {/* Info-Box */}
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <h4 className="font-bold text-gray-900 mb-2">ℹ️ So funktioniert es</h4>
              <ul className="text-gray-700 text-sm space-y-1">
                <li>• Objektleiter sehen nur Antraege von Mitarbeitern ihrer zugewiesenen Objekte</li>
                <li>• Ein Objektleiter kann fuer mehrere Objekte zustaendig sein</li>
                <li>• Mitarbeiter werden ueber ihr Haupt-Objekt dem Objektleiter zugeordnet</li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB: Vertreter-Regelung */}
        {activeTab === 'vertreter' && (
          <div className="space-y-6">
            {objektleiter.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-6 text-center">
                <p className="text-yellow-800 font-semibold mb-2">Keine Objektleiter vorhanden</p>
                <p className="text-yellow-700 text-sm">
                  Vertreter koennen nur fuer Objektleiter konfiguriert werden.
                </p>
              </div>
            ) : (
              objektleiter.map((ol) => {
                const deputies = getDeputiesForUser(ol.user_id)
                
                return (
                  <div key={ol.id} className="bg-white rounded shadow overflow-hidden">
                    <div className="bg-purple-50 border-b border-purple-200 px-6 py-4 flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {ol.user_id.substring(0, 8)}...
                        </h3>
                        <p className="text-gray-600 text-sm">
                          {deputies.length} Vertreter konfiguriert
                        </p>
                      </div>
                      <button
                        onClick={() => openDeputyModal(ol)}
                        className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded font-semibold"
                      >
                        + Vertreter hinzufuegen
                      </button>
                    </div>
                    
                    <div className="p-4">
                      {deputies.length === 0 ? (
                        <p className="text-gray-500 italic">Keine Vertreter konfiguriert</p>
                      ) : (
                        <div className="space-y-2">
                          {deputies.map((deputy, idx) => {
                            const deputyUser = users.find(u => u.user_id === deputy.deputy_id)
                            const statusColor = deputy.status === 'accepted' 
                              ? 'bg-green-100 text-green-800' 
                              : deputy.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                            const statusLabel = deputy.status === 'accepted' 
                              ? 'Bestaetigt' 
                              : deputy.status === 'rejected'
                              ? 'Abgelehnt'
                              : 'Ausstehend'
                            return (
                              <div
                                key={deputy.id}
                                className={`flex items-center justify-between p-3 rounded ${
                                  deputy.status === 'accepted' ? 'bg-green-50' :
                                  deputy.status === 'rejected' ? 'bg-red-50' : 'bg-yellow-50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="bg-purple-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">
                                    {deputy.priority}
                                  </span>
                                  <span className="font-semibold text-gray-900">
                                    {deputy.deputy_id.substring(0, 8)}...
                                  </span>
                                  {deputyUser && (
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      deputyUser.role === 'admin'
                                        ? 'bg-red-100 text-red-800'
                                        : deputyUser.role === 'objektleiter'
                                        ? 'bg-orange-100 text-orange-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}>
                                      {deputyUser.role}
                                    </span>
                                  )}
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusColor}`}>
                                    {statusLabel}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleDeleteDeputy(deputy.id)}
                                  className="text-red-500 hover:text-red-700 font-semibold text-sm"
                                >
                                  Entfernen
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}

            {/* Info-Box */}
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <h4 className="font-bold text-gray-900 mb-2">ℹ️ Vertreter-Regelung</h4>
              <ul className="text-gray-700 text-sm space-y-1">
                <li>• Wenn ein Objektleiter abwesend ist, wird der Antrag an seinen Vertreter weitergeleitet</li>
                <li>• Prioritaet 1 = erster Vertreter, Prioritaet 2 = zweiter Vertreter (Fallback)</li>
                <li>• Als Vertreter kann ein anderer Objektleiter oder ein Admin eingesetzt werden</li>
              </ul>
            </div>
          </div>
        )}

        {/* Rollen-Übersicht (immer sichtbar unten) */}
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded p-4">
          <h3 className="font-bold text-gray-900 mb-3">📋 Rollenuebersicht</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="font-semibold text-blue-800">Haustechniker</p>
              <ul className="text-blue-700 text-sm mt-2 space-y-1">
                <li>• Eigene Antraege stellen</li>
                <li>• Sich selbst krankmelden</li>
                <li>• Schichtplan einsehen</li>
              </ul>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded p-3">
              <p className="font-semibold text-orange-800">Objektleiter</p>
              <ul className="text-orange-700 text-sm mt-2 space-y-1">
                <li>• Alles von Haustechniker</li>
                <li>• Antraege genehmigen/ablehnen</li>
                <li>• Schichten seiner Objekte verwalten</li>
              </ul>
            </div>
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="font-semibold text-red-800">Admin</p>
              <ul className="text-red-700 text-sm mt-2 space-y-1">
                <li>• Voller Zugriff</li>
                <li>• Rollen & Objekte verwalten</li>
                <li>• Urlaubskonten bearbeiten</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Objekte zuweisen */}
      {showAssignObjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="bg-orange-500 text-white p-4 rounded-t-lg">
              <h2 className="text-xl font-bold">🏢 Objekte zuweisen</h2>
              <p className="text-orange-100 text-sm">
                {showAssignObjectModal.user_id.substring(0, 8)}...
              </p>
            </div>
            
            <div className="p-4 max-h-[50vh] overflow-y-auto">
              {objects.length === 0 ? (
                <p className="text-gray-500">Keine Objekte vorhanden</p>
              ) : (
                <div className="space-y-2">
                  {objects.map(obj => (
                    <label
                      key={obj.id}
                      className={`flex items-center gap-3 p-3 rounded cursor-pointer transition ${
                        selectedObjects.includes(obj.id)
                          ? 'bg-orange-100 border-2 border-orange-400'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedObjects.includes(obj.id)}
                        onChange={() => toggleObject(obj.id)}
                        className="w-5 h-5 text-orange-500"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">{obj.name}</p>
                        {obj.short_name && (
                          <p className="text-gray-600 text-sm">{obj.short_name}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t flex gap-2">
              <button
                onClick={handleSaveObjectAssignments}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded font-semibold"
              >
                Speichern ({selectedObjects.length} ausgewaehlt)
              </button>
              <button
                onClick={() => setShowAssignObjectModal(null)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Vertreter hinzufuegen */}
      {showDeputyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="bg-purple-500 text-white p-4 rounded-t-lg">
              <h2 className="text-xl font-bold">🔄 Vertreter hinzufuegen</h2>
              <p className="text-purple-100 text-sm">
                Fuer: {showDeputyModal.user_id.substring(0, 8)}...
              </p>
            </div>
            
            <form onSubmit={handleAddDeputy} className="p-4 space-y-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Vertreter *</label>
                <select
                  value={deputyForm.deputy_id}
                  onChange={(e) => setDeputyForm({ ...deputyForm, deputy_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                  required
                >
                  <option value="">-- Auswaehlen --</option>
                  {users
                    .filter(u => u.user_id !== showDeputyModal.user_id)
                    .filter(u => u.role === 'objektleiter' || u.role === 'admin')
                    .map(u => (
                      <option key={u.id} value={u.user_id}>
                        {u.user_id.substring(0, 8)}... ({u.role})
                      </option>
                    ))
                  }
                </select>
                <p className="text-gray-500 text-xs mt-1">
                  Nur Objektleiter und Admins koennen Vertreter sein
                </p>
              </div>
              
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Prioritaet</label>
                <select
                  value={deputyForm.priority}
                  onChange={(e) => setDeputyForm({ ...deputyForm, priority: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                >
                  <option value="1">1 (Erster Vertreter)</option>
                  <option value="2">2 (Zweiter Vertreter)</option>
                  <option value="3">3 (Dritter Vertreter)</option>
                </select>
              </div>
              
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded font-semibold"
                >
                  Hinzufuegen
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeputyModal(null)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
                >
                  Abbrechen
                </button>
              </div>
            </form>

            {/* Aktuelle Vertreter anzeigen */}
            {getDeputiesForUser(showDeputyModal.user_id).length > 0 && (
              <div className="p-4 border-t bg-gray-50">
                <p className="font-semibold text-gray-700 mb-2">Aktuelle Vertreter:</p>
                <div className="space-y-1">
                  {getDeputiesForUser(showDeputyModal.user_id).map(d => (
                    <div key={d.id} className="flex items-center justify-between text-sm">
                      <span>
                        <span className="font-mono">{d.deputy_id.substring(0, 8)}...</span>
                        <span className="text-gray-500 ml-2">(Prio {d.priority})</span>
                      </span>
                      <button
                        onClick={() => handleDeleteDeputy(d.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}