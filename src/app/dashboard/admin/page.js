'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getUserRole } from '@/lib/auth'
import Link from 'next/link'

export default function AdminPanel() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Überprüfe ob Benutzer Admin ist
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          router.push('/')
          return
        }

        setUser(session.user)

        // Rolle laden
        const userRole = await getUserRole(session.user.id)
        setRole(userRole)

        // Nicht-Admin → zurück zum Dashboard
        if (userRole !== 'admin') {
          setTimeout(() => router.push('/dashboard'), 100)
          return
        }

        // Alle Benutzer mit Rollen laden
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('id, user_id, role, created_at')
          .order('created_at', { ascending: false })

        if (rolesError) {
          console.log('Fehler beim Laden der Rollen')
        } else {
          setUsers(rolesData || [])
        }
      } catch (err) {
        console.log('Fehler beim Laden')
      } finally {
        setLoading(false)
      }
    }

    checkAdmin()
  }, [router])

  // Rolle ändern
  const handleRoleChange = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId)

      if (error) {
        alert('Fehler beim Aktualisieren der Rolle')
        return
      }

      // Benutzer aktualisieren
      setUsers(
        users.map(u =>
          u.user_id === userId ? { ...u, role: newRole } : u
        )
      )

      alert('Rolle aktualisiert!')
    } catch (err) {
      alert('Fehler beim Ändern der Rolle')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Lädt...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-600 mt-1">Benutzerverwaltung & Rollen</p>
          </div>
          <Link href="/dashboard">
            <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold">
              ← Zurück
            </button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
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
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">
                    Benutzer ID
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">
                    Aktuelle Rolle
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">
                    Erstellt am
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">
                    Aktion
                  </th>
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
                          onChange={(e) =>
                            handleRoleChange(u.user_id, e.target.value)
                          }
                          className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="haustechniker">Haustechniker</option>
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

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded p-4">
          <h3 className="font-bold text-gray-900 mb-2">ℹ️ Rollenübersicht</h3>
          <p className="text-gray-700 text-sm mb-2">
            <strong>Haustechniker:</strong> Kann Personaldaten nur lesen
          </p>
          <p className="text-gray-700 text-sm">
            <strong>Admin:</strong> Kann Personaldaten bearbeiten und Benutzerrollen verwalten
          </p>
        </div>
      </div>
    </div>
  )
}