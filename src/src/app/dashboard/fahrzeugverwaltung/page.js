'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getUserRole } from '@/lib/auth'
import { getVehicles, createVehicle, updateVehicle, deleteVehicle } from '@/lib/trips'
import Link from 'next/link'

export default function Fahrzeugverwaltung() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const router = useRouter()

  const [formData, setFormData] = useState({
    kennzeichen: '',
    modell: '',
    aktueller_km: '',
  })

  // Laden von Benutzer, Rolle und Fahrzeugen
  useEffect(() => {
    const loadData = async () => {
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

        // Nur Admin darf diese Seite sehen
        if (userRole !== 'admin') {
          router.push('/dashboard')
          return
        }

        // Fahrzeuge laden
        const vehs = await getVehicles()
        setVehicles(vehs)
      } catch (err) {
        console.log('Fehler beim Laden')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  // Formular zurücksetzen
  const resetForm = () => {
    setFormData({
      kennzeichen: '',
      modell: '',
      aktueller_km: '',
    })
    setEditingId(null)
    setShowForm(false)
  }

  // Fahrzeug speichern
  const handleSave = async (e) => {
    e.preventDefault()

    if (!formData.kennzeichen || !formData.modell || formData.aktueller_km === '') {
      alert('Alle Felder erforderlich')
      return
    }

    try {
      if (editingId) {
        // Update
        const updated = await updateVehicle(editingId, {
          kennzeichen: formData.kennzeichen,
          modell: formData.modell,
          aktueller_km: parseFloat(formData.aktueller_km),
        })

        if (updated) {
          setVehicles(vehicles.map(v => v.id === editingId ? updated : v))
          resetForm()
          alert('Fahrzeug aktualisiert!')
        } else {
          alert('Fehler beim Aktualisieren')
        }
      } else {
        // Create
        const newVehicle = await createVehicle(
          user.id,
          formData.kennzeichen,
          formData.modell,
          formData.aktueller_km
        )

        if (newVehicle) {
          setVehicles([...vehicles, newVehicle])
          resetForm()
          alert('Fahrzeug hinzugefügt!')
        } else {
          alert('Fehler beim Hinzufügen')
        }
      }
    } catch (err) {
      alert('Fehler beim Speichern')
    }
  }

  // Fahrzeug löschen
  const handleDelete = async (id) => {
    if (!confirm('Fahrzeug wirklich löschen?')) return

    try {
      const success = await deleteVehicle(id)

      if (success) {
        setVehicles(vehicles.filter(v => v.id !== id))
        alert('Fahrzeug gelöscht!')
      } else {
        alert('Fehler beim Löschen')
      }
    } catch (err) {
      alert('Fehler beim Löschen')
    }
  }

  // Fahrzeug zum Bearbeiten laden
  const handleEdit = (vehicle) => {
    setFormData({
      kennzeichen: vehicle.kennzeichen,
      modell: vehicle.modell,
      aktueller_km: vehicle.aktueller_km,
    })
    setEditingId(vehicle.id)
    setShowForm(true)
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
            <h1 className="text-3xl font-bold text-gray-900">🚗 Fahrzeugverwaltung</h1>
            <p className="text-gray-600 mt-1">Fahrzeuge und KM-Stände verwalten</p>
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
        {/* Add Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded font-semibold"
          >
            {showForm ? '✕ Abbrechen' : '+ Fahrzeug hinzufügen'}
          </button>
        </div>

        {/* Formular */}
        {showForm && (
          <div className="bg-white rounded shadow p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">
              {editingId ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug'}
            </h2>

            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Kennzeichen *</label>
                <input
                  type="text"
                  value={formData.kennzeichen}
                  onChange={(e) => setFormData({ ...formData, kennzeichen: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="z.B. B-AB 1234"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">Modell *</label>
                <input
                  type="text"
                  value={formData.modell}
                  onChange={(e) => setFormData({ ...formData, modell: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="z.B. VW T6"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">Aktueller KM-Stand *</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.aktueller_km}
                  onChange={(e) => setFormData({ ...formData, aktueller_km: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="z.B. 45230.5"
                  required
                />
              </div>

              <div className="md:col-span-2 flex gap-2">
                <button
                  type="submit"
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded font-semibold"
                >
                  Speichern
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded font-semibold"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Fahrzeugliste */}
        <div className="bg-white rounded shadow overflow-hidden">
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
            <h2 className="text-xl font-bold text-gray-900">
              Fahrzeuge ({vehicles.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Kennzeichen</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Modell</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Aktueller KM-Stand</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                      Keine Fahrzeuge vorhanden
                    </td>
                  </tr>
                ) : (
                  vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-900 font-semibold">{vehicle.kennzeichen}</td>
                      <td className="px-6 py-3 text-gray-900">{vehicle.modell}</td>
                      <td className="px-6 py-3 text-gray-900 font-semibold">
                        {vehicle.aktueller_km.toFixed(1)} km
                      </td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => handleEdit(vehicle)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm mr-2"
                        >
                          ✎ Bearbeiten
                        </button>
                        <button
                          onClick={() => handleDelete(vehicle.id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                        >
                          🗑 Löschen
                        </button>
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
          <h3 className="font-bold text-gray-900 mb-2">ℹ️ Wichtig</h3>
          <p className="text-gray-700 text-sm">
            Der aktuelle KM-Stand ist der Ausgangspunkt für alle neuen Fahrten. 
            Nach jeder abgeschlossenen Fahrt wird der KM-Stand automatisch aktualisiert.
          </p>
        </div>
      </div>
    </div>
  )
}