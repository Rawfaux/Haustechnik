'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { checkModuleAccess } from '@/lib/permissions'
import { getUserRole } from '@/lib/auth'

/**
 * Hook für Modul-Zugriffsschutz
 * 
 * Verwendung:
 * const { user, role, hasAccess, loading } = useModuleAccess('/dashboard/fahrzeugverwaltung')
 * 
 * if (loading) return <Loading />
 * if (!hasAccess) return null // Wird automatisch umgeleitet
 */
export function useModuleAccess(moduleRoute) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Session prüfen
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          router.push('/')
          return
        }

        setUser(session.user)

        // Rolle laden
        const userRole = await getUserRole(session.user.id)
        setRole(userRole)

        // Deaktivierte Accounts blockieren
        if (!userRole || userRole === 'deaktiviert') {
          await supabase.auth.signOut()
          router.push('/')
          return
        }

        // Modul-Zugriff prüfen
        const canAccess = await checkModuleAccess(session.user.id, moduleRoute)
        
        if (!canAccess) {
          // Kein Zugriff -> zurück zum Dashboard
          console.warn(`⚠️ Kein Zugriff auf ${moduleRoute}`)
          router.push('/dashboard')
          return
        }

        setHasAccess(true)
      } catch (err) {
        console.error('Fehler beim Prüfen der Berechtigung:', err)
        router.push('/dashboard')
      } finally {
        setLoading(false)
      }
    }

    checkAccess()
  }, [moduleRoute, router])

  return { user, role, hasAccess, loading }
}

/**
 * Komponente für Zugriffsverweigerung
 */
export function AccessDenied() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Zugriff verweigert</h1>
        <p className="text-gray-600 mb-6">
          Sie haben keine Berechtigung für dieses Modul.
          Bitte wenden Sie sich an einen Administrator.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded font-semibold"
        >
          Zurück zum Dashboard
        </button>
      </div>
    </div>
  )
}

/**
 * Loading-Komponente
 */
export function ModuleLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Prüfe Berechtigung...</p>
      </div>
    </div>
  )
}