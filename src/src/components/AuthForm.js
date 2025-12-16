'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { createUserRole } from '@/lib/auth'

export default function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Validierung
  const validateForm = () => {
    if (!email || !password) {
      setError('Email und Passwort sind erforderlich')
      return false
    }
    if (email.length < 5 || !email.includes('@')) {
      setError('Gültige Email erforderlich')
      return false
    }
    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein')
      return false
    }
    if (!isLogin && password !== passwordConfirm) {
      setError('Passwörter stimmen nicht überein')
      return false
    }
    return true
  }

  // Login
  const handleLogin = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Erfolgreich angemeldet → zum Dashboard
      router.push('/dashboard')
    } catch (err) {
      setError(err.message || 'Login fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  // Registrierung
  const handleSignUp = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) throw error

      // Neue Rolle als "haustechniker" erstellen
      if (data?.user?.id) {
        await createUserRole(data.user.id, 'haustechniker')
      }

      setError('')
      alert('Registrierung erfolgreich! Bitte überprüfe deine Email.')
      setIsLogin(true)
      setEmail('')
      setPassword('')
      setPasswordConfirm('')
    } catch (err) {
      setError(err.message || 'Registrierung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          {isLogin ? 'Anmelden' : 'Registrieren'}
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={isLogin ? handleLogin : handleSignUp}>
          {/* Email */}
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
              placeholder="deine@email.com"
            />
          </div>

          {/* Passwort */}
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">
              Passwort
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
              placeholder="Mindestens 6 Zeichen"
            />
          </div>

          {/* Passwort wiederholen (nur bei Registrierung) */}
          {!isLogin && (
            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">
                Passwort wiederholen
              </label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                placeholder="Passwort wiederholen"
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition disabled:opacity-50"
          >
            {loading ? 'Lädt...' : isLogin ? 'Anmelden' : 'Registrieren'}
          </button>
        </form>

        {/* Toggle Login/Registrierung */}
        <div className="mt-6 text-center">
          <p className="text-gray-600">
            {isLogin ? 'Noch kein Account?' : 'Bereits registriert?'}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setError('')
              }}
              className="text-blue-500 hover:underline font-semibold ml-1"
            >
              {isLogin ? 'Registrieren' : 'Anmelden'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}