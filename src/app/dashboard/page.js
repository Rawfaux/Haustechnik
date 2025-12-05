'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getUserRole } from '@/lib/auth'
import Link from 'next/link'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

// DEBUG: Rolle ausgeben
useEffect(() => {
  console.log('DEBUG - User:', user?.email)
  console.log('DEBUG - Role:', role)
}, [user, role])

  useEffect(() => {
    // Benutzer laden
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        // Nicht angemeldet → zur Login-Seite
        router.push('/')
      } else {
        setUser(session.user)
        
        // Rolle laden
        const userRole = await getUserRole(session.user.id)
        setRole(userRole)
      }
      setLoading(false)
    }

    checkUser()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Lädt...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">Willkommen, {user?.email}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Angemeldet als</p>
                <p className="font-semibold text-gray-900">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded font-semibold transition transform hover:scale-105"
              >
                🚪 Abmelden
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-3xl font-bold mb-4 text-gray-900">Willkommen!</h2>
          <p className="text-gray-700 mb-4 text-lg">
            Du bist angemeldet als: <strong className="text-gray-900">{user?.email}</strong>
          </p>
          <p className="text-gray-700 mb-6 text-lg">
            Deine Rolle: <strong className="text-gray-900 capitalize">{role}</strong>
          </p>
          
          {/* Module Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            <div className="bg-blue-50 border border-blue-200 rounded p-4 hover:shadow-lg transition">
              <h3 className="font-bold text-lg mb-2 text-gray-900">👥 Personalverwaltung</h3>
              <p className="text-gray-700 text-sm mb-4">Mitarbeiter verwalten</p>
              <div>
                <Link href="/dashboard/personalverwaltung">
                  <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold w-full">
                    Öffnen
                  </button>
                </Link>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded p-4 hover:shadow-lg transition">
               <h3 className="font-bold text-lg mb-2 text-gray-900">🚗 Fahrtenbuch</h3>
               <p className="text-gray-700 text-sm mb-4">Fahrten erfassen</p>
             <div>
               <Link href="/dashboard/fahrtenbuch">
                 <button className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-semibold w-full">
                  Öffnen
                 </button>
               </Link>
             </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded p-4 hover:shadow-lg transition">
              <h3 className="font-bold text-lg mb-2 text-gray-900">📅 Schichtplaner</h3>
              <p className="text-gray-700 text-sm mb-4">Schichten planen</p>
              <div>
                <button className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded text-sm font-semibold w-full">
                  Öffnen
                </button>
              </div>
            </div>



            {role === 'admin' && (
              <div className="bg-red-50 border border-red-200 rounded p-4 hover:shadow-lg transition">
                <h3 className="font-bold text-lg mb-2 text-gray-900">⚙️ Admin Panel</h3>
                <p className="text-gray-700 text-sm mb-4">Benutzer verwalten</p>
                <div>
                  <Link href="/dashboard/admin">
                    <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-semibold w-full">
                      Öffnen
                    </button>
                  </Link>
                </div>
              </div>
            )}
            
            {role === 'admin' && (
              <div className="bg-orange-50 border border-orange-200 rounded p-4 hover:shadow-lg transition">
                <h3 className="font-bold text-lg mb-2 text-gray-900">🚗 Fahrzeugverwaltung</h3>
                <p className="text-gray-700 text-sm mb-4">Fahrzeuge & KM verwalten</p>
                <div>
                  <Link href="/dashboard/fahrzeugverwaltung">
                    <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded text-sm font-semibold w-full">
                      Öffnen
                    </button>
                  </Link>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}