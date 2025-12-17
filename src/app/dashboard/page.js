'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getUserRole } from '@/lib/auth'
import Link from 'next/link'

export default function Berechtigungen() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [systemInstalled, setSystemInstalled] = useState(false)
  const [activeTab, setActiveTab] = useState('rollen')
  
  // Daten
  const [modules, setModules] = useState([])
  const [employees, setEmployees] = useState([])
  const [users, setUsers] = useState([])
  
  // Rollen-Berechtigungen
  const [rolePermissions, setRolePermissions] = useState({
    haustechniker: [],
    objektleiter: [],
    admin: []
  })
  
  // Ausgewählter Mitarbeiter
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [employeePermissions, setEmployeePermissions] = useState([])
  const [employeeRolePermissions, setEmployeeRolePermissions] = useState([])
  
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

        // Nur Admin darf diese Seite sehen
        if (userRole !== 'admin') {
          router.push('/dashboard')
          return
        }

        // Prüfen ob Berechtigungssystem installiert ist
        const { data: testModules, error: testError } = await supabase
          .from('modules')
          .select('id')
          .limit(1)

        if (testError) {
          console.log('Berechtigungssystem nicht installiert:', testError.message)
          setSystemInstalled(false)
          setLoading(false)
          return
        }

        setSystemInstalled(true)

        // Module laden
        const { data: modulesData } = await supabase
          .from('modules')
          .select('*')
          .eq('is_active', true)
          .order('sort_order')
        setModules(modulesData || [])

        // Rollen-Berechtigungen laden
        const { data: htData } = await supabase
          .from('role_permissions')
          .select('module_id')
          .eq('role', 'haustechniker')
        
        const { data: olData } = await supabase
          .from('role_permissions')
          .select('module_id')
          .eq('role', 'objektleiter')
        
        const { data: adminData } = await supabase
          .from('role_permissions')
          .select('module_id')
          .eq('role', 'admin')
        
        setRolePermissions({
          haustechniker: (htData || []).map(p => p.module_id),
          objektleiter: (olData || []).map(p => p.module_id),
          admin: (adminData || []).map(p => p.module_id)
        })

        // Mitarbeiter mit User-Account laden
        const { data: empData } = await supabase
          .from('employees')
          .select('*')
          .not('user_id', 'is', null)
          .neq('status', 'ausgeschieden')
          .order('nachname')
        setEmployees(empData || [])

        // User-Rollen laden
        const { data: usersData } = await supabase
          .from('user_roles')
          .select('user_id, role')
        setUsers(usersData || [])

      } catch (err) {
        console.error('Fehler:', err)
        setSystemInstalled(false)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  // Mitarbeiter auswählen
  const handleSelectEmployee = async (employee) => {
    setSelectedEmployee(employee)
    
    // Individuelle Berechtigungen laden
    const { data: indivData } = await supabase
      .from('user_permissions')
      .select('module_id')
      .eq('user_id', employee.user_id)
    setEmployeePermissions((indivData || []).map(p => p.module_id))
    
    // Rolle des Users finden
    const userRole = users.find(u => u.user_id === employee.user_id)
    if (userRole) {
      setEmployeeRolePermissions(rolePermissions[userRole.role] || [])
    }
  }

  // Rollen-Berechtigung togglen
  const handleToggleRolePermission = async (roleName, moduleId) => {
    const hasPermission = rolePermissions[roleName]?.includes(moduleId)
    
    // Dashboard darf nicht entfernt werden!
    const module = modules.find(m => m.id === moduleId)
    if (module?.name === 'Dashboard') {
      alert('Das Dashboard kann nicht entfernt werden!')
      return
    }
    
    try {
      if (hasPermission) {
        // Entfernen
        await supabase
          .from('role_permissions')
          .delete()
          .eq('role', roleName)
          .eq('module_id', moduleId)
        
        setRolePermissions(prev => ({
          ...prev,
          [roleName]: prev[roleName].filter(id => id !== moduleId)
        }))
      } else {
        // Hinzufügen
        await supabase
          .from('role_permissions')
          .insert([{ role: roleName, module_id: moduleId }])
        
        setRolePermissions(prev => ({
          ...prev,
          [roleName]: [...prev[roleName], moduleId]
        }))
      }
    } catch (err) {
      alert('Fehler: ' + err.message)
    }
  }

  // Individuelle Berechtigung togglen
  const handleToggleUserPermission = async (moduleId) => {
    if (!selectedEmployee) return
    
    const hasPermission = employeePermissions.includes(moduleId)
    const hasRolePermission = employeeRolePermissions.includes(moduleId)
    
    if (hasRolePermission && !hasPermission) {
      alert('Diese Berechtigung hat der Mitarbeiter bereits durch seine Rolle.')
      return
    }
    
    try {
      if (hasPermission) {
        // Entfernen
        await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', selectedEmployee.user_id)
          .eq('module_id', moduleId)
        
        setEmployeePermissions(prev => prev.filter(id => id !== moduleId))
      } else {
        // Hinzufügen
        await supabase
          .from('user_permissions')
          .insert([{
            user_id: selectedEmployee.user_id,
            module_id: moduleId,
            granted_by: user.id
          }])
        
        setEmployeePermissions(prev => [...prev, moduleId])
      }
    } catch (err) {
      alert('Fehler: ' + err.message)
    }
  }

  // Rolle eines Users finden
  const getUserRoleForEmployee = (employee) => {
    const userRole = users.find(u => u.user_id === employee.user_id)
    return userRole?.role || 'unbekannt'
  }

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

  // System nicht installiert - Anleitung zeigen
  if (!systemInstalled) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🔐 Berechtigungen</h1>
              <p className="text-gray-600 mt-1">Modul-Zugriffe verwalten</p>
            </div>
            <Link href="/dashboard">
              <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold">
                ← Zurück
              </button>
            </Link>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-8">
            <div className="text-center">
              <span className="text-6xl mb-4 block">⚠️</span>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Berechtigungssystem nicht installiert
              </h2>
              <p className="text-gray-700 mb-6">
                Die erforderlichen Datenbank-Tabellen wurden noch nicht erstellt.
              </p>
              
              <div className="bg-white rounded-lg p-6 text-left mb-6">
                <h3 className="font-bold text-gray-900 mb-3">📋 Installation:</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Öffne den <strong>Supabase SQL Editor</strong></li>
                  <li>Führe die Datei <code className="bg-gray-100 px-2 py-1 rounded">migration_berechtigungssystem.sql</code> aus</li>
                  <li>Lade diese Seite neu</li>
                </ol>
              </div>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => window.location.reload()}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded font-semibold"
                >
                  🔄 Seite neu laden
                </button>
                <Link href="/dashboard">
                  <button className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded font-semibold">
                    ← Zurück zum Dashboard
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Volles UI wenn System installiert
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🔐 Berechtigungen</h1>
            <p className="text-gray-600 mt-1">Modul-Zugriffe verwalten</p>
          </div>
          <Link href="/dashboard">
            <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold">
              ← Zurück
            </button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('rollen')}
            className={`px-6 py-3 rounded-t-lg font-semibold transition ${
              activeTab === 'rollen'
                ? 'bg-white text-blue-600 border-t-4 border-blue-500'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            👥 Rollen-Berechtigungen
          </button>
          <button
            onClick={() => setActiveTab('mitarbeiter')}
            className={`px-6 py-3 rounded-t-lg font-semibold transition ${
              activeTab === 'mitarbeiter'
                ? 'bg-white text-blue-600 border-t-4 border-blue-500'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            👤 Individuelle Berechtigungen
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        
        {/* TAB: Rollen-Berechtigungen */}
        {activeTab === 'rollen' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Standard-Berechtigungen pro Rolle</h2>
              <p className="text-gray-600 text-sm">
                Diese Berechtigungen gelten automatisch für alle Benutzer mit der entsprechenden Rolle.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Modul</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-900">
                      <div className="flex flex-col items-center">
                        <span>Haustechniker</span>
                        <span className="text-xs text-gray-500 font-normal">Basis</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-900">
                      <div className="flex flex-col items-center">
                        <span>Objektleiter</span>
                        <span className="text-xs text-gray-500 font-normal">Erweitert</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-900">
                      <div className="flex flex-col items-center">
                        <span>Admin</span>
                        <span className="text-xs text-gray-500 font-normal">Vollzugriff</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((module) => (
                    <tr key={module.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{module.icon}</span>
                          <div>
                            <p className="font-semibold text-gray-900">{module.name}</p>
                            <p className="text-xs text-gray-500">{module.description}</p>
                          </div>
                        </div>
                      </td>
                      
                      {/* Haustechniker */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleRolePermission('haustechniker', module.id)}
                          className={`w-10 h-10 rounded-lg font-bold text-lg transition ${
                            rolePermissions.haustechniker?.includes(module.id)
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                          }`}
                        >
                          {rolePermissions.haustechniker?.includes(module.id) ? '✓' : '−'}
                        </button>
                      </td>
                      
                      {/* Objektleiter */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleRolePermission('objektleiter', module.id)}
                          className={`w-10 h-10 rounded-lg font-bold text-lg transition ${
                            rolePermissions.objektleiter?.includes(module.id)
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                          }`}
                        >
                          {rolePermissions.objektleiter?.includes(module.id) ? '✓' : '−'}
                        </button>
                      </td>
                      
                      {/* Admin */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleRolePermission('admin', module.id)}
                          className={`w-10 h-10 rounded-lg font-bold text-lg transition ${
                            rolePermissions.admin?.includes(module.id)
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                          }`}
                        >
                          {rolePermissions.admin?.includes(module.id) ? '✓' : '−'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legende */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">ℹ️ Hinweis</h3>
              <p className="text-gray-700 text-sm">
                Änderungen hier wirken sich auf <strong>alle Benutzer</strong> mit der entsprechenden Rolle aus.
                Für individuelle Anpassungen nutzen Sie den Tab "Individuelle Berechtigungen".
              </p>
            </div>
          </div>
        )}

        {/* TAB: Individuelle Berechtigungen */}
        {activeTab === 'mitarbeiter' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Mitarbeiter-Liste */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Mitarbeiter auswählen</h2>
              
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {employees.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Keine Mitarbeiter mit Account vorhanden
                  </p>
                ) : (
                  employees.map((emp) => {
                    const empRole = getUserRoleForEmployee(emp)
                    return (
                      <button
                        key={emp.id}
                        onClick={() => handleSelectEmployee(emp)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition ${
                          selectedEmployee?.id === emp.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <p className="font-semibold text-gray-900">
                          {emp.nachname}, {emp.vorname}
                        </p>
                        <p className="text-sm text-gray-600">
                          {emp.personal_nr || 'Keine Nr.'} • 
                          <span className={`ml-1 px-2 py-0.5 rounded text-xs font-semibold ${
                            empRole === 'admin' ? 'bg-red-100 text-red-800' :
                            empRole === 'objektleiter' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {empRole}
                          </span>
                        </p>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Berechtigungen des ausgewählten Mitarbeiters */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
              {!selectedEmployee ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <p className="text-4xl mb-4">👈</p>
                    <p>Wählen Sie einen Mitarbeiter aus</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedEmployee.vorname} {selectedEmployee.nachname}
                    </h2>
                    <p className="text-gray-600">
                      Rolle: <span className="font-semibold capitalize">{getUserRoleForEmployee(selectedEmployee)}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {modules.map((module) => {
                      const hasRolePermission = employeeRolePermissions.includes(module.id)
                      const hasIndividualPermission = employeePermissions.includes(module.id)
                      const hasAccess = hasRolePermission || hasIndividualPermission
                      
                      return (
                        <div
                          key={module.id}
                          className={`p-4 rounded-lg border-2 transition ${
                            hasAccess
                              ? 'border-green-300 bg-green-50'
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{module.icon}</span>
                              <div>
                                <p className="font-semibold text-gray-900">{module.name}</p>
                                <p className="text-xs text-gray-500">
                                  {hasRolePermission && '✓ Durch Rolle'}
                                  {hasIndividualPermission && !hasRolePermission && '✓ Individuell'}
                                  {!hasAccess && 'Kein Zugriff'}
                                </p>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => handleToggleUserPermission(module.id)}
                              disabled={hasRolePermission && !hasIndividualPermission}
                              className={`w-12 h-12 rounded-lg font-bold text-lg transition ${
                                hasIndividualPermission
                                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                                  : hasRolePermission
                                  ? 'bg-green-200 text-green-600 cursor-not-allowed'
                                  : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                              }`}
                              title={
                                hasRolePermission && !hasIndividualPermission
                                  ? 'Bereits durch Rolle berechtigt'
                                  : hasIndividualPermission
                                  ? 'Klicken zum Entfernen'
                                  : 'Klicken zum Hinzufügen'
                              }
                            >
                              {hasIndividualPermission ? '★' : hasRolePermission ? '✓' : '+'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Legende */}
                  <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-2">Legende</h3>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-green-200 text-green-600 rounded flex items-center justify-center font-bold">✓</span>
                        Durch Rolle
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-blue-500 text-white rounded flex items-center justify-center font-bold">★</span>
                        Individuell hinzugefügt
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-gray-200 text-gray-400 rounded flex items-center justify-center font-bold">+</span>
                        Kein Zugriff
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}