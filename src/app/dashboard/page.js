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
  const [openRequests, setOpenRequests] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/')
        return
      }
      
      setUser(session.user)
      
      const userRole = await getUserRole(session.user.id)
      setRole(userRole)

      // Offene Anfragen zaehlen
      let count = 0

      // Vertreter-Anfragen
      try {
        const { data: deputyData } = await supabase
          .from('deputy_assignments')
          .select('id')
          .eq('deputy_id', session.user.id)
          .eq('status', 'pending')
        count += (deputyData || []).length
      } catch (e) {}

      // Antraege zur Genehmigung (nur fuer Objektleiter/Admin)
      if (userRole === 'objektleiter' || userRole === 'admin') {
        try {
          const { data: absenceData } = await supabase
            .from('absences')
            .select('id')
            .eq('status', 'pending')
          count += (absenceData || []).length
        } catch (e) {}
      }

      setOpenRequests(count)
      setLoading(false)
    }

    checkUser()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

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
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 text-sm">Willkommen zurueck!</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <p className="text-sm text-gray-600">{user?.email}</p>
                <p className="text-xs text-gray-400 capitalize">{role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold text-sm"
              >
                Abmelden
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Willkommen Box */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-bold mb-2 text-gray-900">Guten Tag!</h2>
          <p className="text-gray-600">
            Angemeldet als: <strong className="text-gray-900">{user?.email}</strong>
          </p>
          <p className="text-gray-600">
            Rolle: <span className="font-semibold text-blue-600 capitalize">{role}</span>
          </p>
        </div>

        {/* Offene Anfragen Banner */}
        {openRequests > 0 && (
          <Link href="/dashboard/antraege">
            <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 mb-8 cursor-pointer hover:bg-orange-100 transition">
              <div className="flex items-center gap-4">
                <span className="text-3xl">⚠️</span>
                <div>
                  <p className="font-bold text-orange-800 text-lg">
                    {openRequests} offene Anfrage{openRequests > 1 ? 'n' : ''}
                  </p>
                  <p className="text-orange-700 text-sm">
                    Klicken um zu bearbeiten
                  </p>
                </div>
              </div>
            </div>
          </Link>
        )}
        
        {/* Module Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Antraege - NEU */}
          <Link href="/dashboard/antraege">
            <div className="bg-gradient-to-br from-amber-50 to-orange-100 border-2 border-orange-300 rounded-lg p-6 hover:shadow-xl transition transform hover:scale-105 cursor-pointer relative">
              {openRequests > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-sm font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {openRequests}
                </span>
              )}
              <div className="text-4xl mb-3">📝</div>
              <h3 className="font-bold text-xl mb-2 text-gray-900">Antraege</h3>
              <p className="text-gray-600 text-sm">Urlaub, FZA & Krankmeldungen</p>
            </div>
          </Link>

          {/* Personalverwaltung */}
          <Link href="/dashboard/personalverwaltung">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 hover:shadow-xl transition transform hover:scale-105 cursor-pointer">
              <div className="text-4xl mb-3">👥</div>
              <h3 className="font-bold text-xl mb-2 text-gray-900">Personalverwaltung</h3>
              <p className="text-gray-600 text-sm">Mitarbeiter verwalten</p>
            </div>
          </Link>

          {/* Schichtplaner */}
          <Link href="/dashboard/schichtplaner">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 hover:shadow-xl transition transform hover:scale-105 cursor-pointer">
              <div className="text-4xl mb-3">📅</div>
              <h3 className="font-bold text-xl mb-2 text-gray-900">Schichtplaner</h3>
              <p className="text-gray-600 text-sm">Schichten planen & verwalten</p>
            </div>
          </Link>

          {/* Fahrtenbuch */}
          <Link href="/dashboard/fahrtenbuch">
            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-6 hover:shadow-xl transition transform hover:scale-105 cursor-pointer">
              <div className="text-4xl mb-3">🚗</div>
              <h3 className="font-bold text-xl mb-2 text-gray-900">Fahrtenbuch</h3>
              <p className="text-gray-600 text-sm">Fahrten erfassen</p>
            </div>
          </Link>

          {/* Zeiterfassung */}
          <Link href="/dashboard/zeiterfassung">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-lg p-6 hover:shadow-xl transition transform hover:scale-105 cursor-pointer">
              <div className="text-4xl mb-3">🕐</div>
              <h3 className="font-bold text-xl mb-2 text-gray-900">Zeiterfassung</h3>
              <p className="text-gray-600 text-sm">Stempeluhr & Arbeitszeiten</p>
            </div>
          </Link>

          {/* Objektverwaltung */}
          <Link href="/dashboard/objektverwaltung">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 hover:shadow-xl transition transform hover:scale-105 cursor-pointer">
              <div className="text-4xl mb-3">🏢</div>
              <h3 className="font-bold text-xl mb-2 text-gray-900">Objektverwaltung</h3>
              <p className="text-gray-600 text-sm">Objekte & Standorte</p>
            </div>
          </Link>

          {/* Admin Panel - nur fuer Admin */}
          {role === 'admin' && (
            <Link href="/dashboard/admin">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 hover:shadow-xl transition transform hover:scale-105 cursor-pointer">
                <div className="text-4xl mb-3">⚙️</div>
                <h3 className="font-bold text-xl mb-2 text-gray-900">Admin Panel</h3>
                <p className="text-gray-600 text-sm">Benutzer & Rollen verwalten</p>
              </div>
            </Link>
          )}
          
          {/* Fahrzeugverwaltung - nur fuer Admin */}
          {role === 'admin' && (
            <Link href="/dashboard/fahrzeugverwaltung">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 hover:shadow-xl transition transform hover:scale-105 cursor-pointer">
                <div className="text-4xl mb-3">🚙</div>
                <h3 className="font-bold text-xl mb-2 text-gray-900">Fahrzeugverwaltung</h3>
                <p className="text-gray-600 text-sm">Fahrzeuge & KM verwalten</p>
              </div>
            </Link>
          )}

        </div>

        {/* Quick Info */}
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-bold text-gray-900 mb-2">Schnellzugriff</h3>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/antraege">
              <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm cursor-pointer hover:bg-orange-200">
                Urlaub beantragen
              </span>
            </Link>
            <Link href="/dashboard/antraege">
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm cursor-pointer hover:bg-red-200">
                Krank melden
              </span>
            </Link>
            <Link href="/dashboard/schichtplaner">
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm cursor-pointer hover:bg-green-200">
                Schichtplan ansehen
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}