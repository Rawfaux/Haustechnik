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
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
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
  })

  // Laden von Benutzer, Rolle und Mitarbeitern
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

        // Mitarbeiter laden
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .eq('user_id', session.user.id)

        if (error) {
          console.log('Mitarbeiter konnten nicht geladen werden')
        } else {
          setEmployees(data || [])
        }
      } catch (err) {
        console.log('Fehler beim Laden der Daten')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  // Formular zurücksetzen
  const resetForm = () => {
    setFormData({
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
    })
    setEditingId(null)
    setShowForm(false)
  }

  // Mitarbeiter speichern
  const handleSave = async (e) => {
    e.preventDefault()

    if (!formData.vorname || !formData.nachname) {
      alert('Vorname und Nachname sind erforderlich')
      return
    }

    try {
      if (editingId) {
        // Update
        const { error } = await supabase
          .from('employees')
          .update(formData)
          .eq('id', editingId)

        if (error) {
          alert('Fehler beim Aktualisieren')
          return
        }
      } else {
        // Create
        const { error } = await supabase
          .from('employees')
          .insert([
            {
              ...formData,
              user_id: user.id,
            },
          ])

        if (error) {
          alert('Fehler beim Hinzufügen')
          return
        }
      }

      // Mitarbeiter neu laden
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)

      setEmployees(data || [])
      resetForm()
      alert(editingId ? 'Mitarbeiter aktualisiert!' : 'Mitarbeiter hinzugefügt!')
    } catch (err) {
      alert('Fehler beim Speichern')
    }
  }

  // Mitarbeiter löschen
  const handleDelete = async (id) => {
    if (!confirm('Wirklich löschen?')) return

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id)

      if (error) {
        alert('Fehler beim Löschen')
        return
      }

      setEmployees(employees.filter(emp => emp.id !== id))
      alert('Mitarbeiter gelöscht!')
    } catch (err) {
      alert('Fehler beim Löschen')
    }
  }

  // Mitarbeiter zum Bearbeiten laden
  const handleEdit = (employee) => {
    setFormData(employee)
    setEditingId(employee.id)
    setShowForm(true)
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Lädt...</div>
  }

  const isAdmin = role === 'admin'

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Personalverwaltung</h1>
            <p className="text-gray-600 mt-1">Rolle: <span className="font-semibold capitalize">{role}</span></p>
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
        {/* Add Button (nur für Admin) */}
        {isAdmin && (
          <div className="mb-6">
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded font-semibold"
            >
              {showForm ? '✕ Abbrechen' : '+ Mitarbeiter hinzufügen'}
            </button>
          </div>
        )}

        {/* Formular */}
        {isAdmin && showForm && (
          <div className="bg-white rounded shadow p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">
              {editingId ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}
            </h2>

            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Vorname *</label>
                <input
                  type="text"
                  value={formData.vorname}
                  onChange={(e) => setFormData({ ...formData, vorname: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">Nachname *</label>
                <input
                  type="text"
                  value={formData.nachname}
                  onChange={(e) => setFormData({ ...formData, nachname: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">Firmentelefon</label>
                <input
                  type="tel"
                  value={formData.firma_telefon}
                  onChange={(e) => setFormData({ ...formData, firma_telefon: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">Firmenmail</label>
                <input
                  type="email"
                  value={formData.firma_mail}
                  onChange={(e) => setFormData({ ...formData, firma_mail: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">Telefon privat</label>
                <input
                  type="tel"
                  value={formData.telefon_privat}
                  onChange={(e) => setFormData({ ...formData, telefon_privat: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">Mail privat</label>
                <input
                  type="email"
                  value={formData.mail_privat}
                  onChange={(e) => setFormData({ ...formData, mail_privat: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">Einstiegsdatum</label>
                <input
                  type="date"
                  value={formData.einstiegsdatum}
                  onChange={(e) => setFormData({ ...formData, einstiegsdatum: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">Job Titel</label>
                <input
                  type="text"
                  value={formData.job_titel}
                  onChange={(e) => setFormData({ ...formData, job_titel: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">Objekt/Stelle</label>
                <input
                  type="text"
                  value={formData.objekt_stelle}
                  onChange={(e) => setFormData({ ...formData, objekt_stelle: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">Haupt-Objekt</label>
                <input
                  type="text"
                  value={formData.haupt_objekt}
                  onChange={(e) => setFormData({ ...formData, haupt_objekt: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="z.B. Objekt A"
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

        {/* Mitarbeiterliste */}
        <div className="bg-white rounded shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Vorname</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Nachname</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Firmenmail</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Firmentelefon</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Einstiegsdatum</th>
                  {isAdmin && <th className="px-4 py-3 text-left font-semibold text-gray-900">Aktionen</th>}
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                      Keine Mitarbeiter vorhanden
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{emp.vorname}</td>
                      <td className="px-4 py-3 text-gray-900">{emp.nachname}</td>
                      <td className="px-4 py-3 text-gray-900">{emp.firma_mail || '-'}</td>
                      <td className="px-4 py-3 text-gray-900">{emp.firma_telefon || '-'}</td>
                      <td className="px-4 py-3 text-gray-900">
                        {emp.einstiegsdatum ? new Date(emp.einstiegsdatum).toLocaleDateString('de-DE') : '-'}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleEdit(emp)}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm mr-2"
                          >
                            ✎ Bearbeiten
                          </button>
                          <button
                            onClick={() => handleDelete(emp.id)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                          >
                            🗑 Löschen
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}