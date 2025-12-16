'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getUserRole } from '@/lib/auth'
import Link from 'next/link'

export default function Objektverwaltung() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [objects, setObjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()

  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    address: '',
    city: '',
    postal_code: '',
    description: '',
    contact_person: '',
    contact_phone: '',
  })

  // Laden von Benutzer, Rolle und Objekten
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

        // Objekte laden
        await loadObjects()
      } catch (err) {
        console.error('Fehler beim Laden:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  // Objekte laden
  const loadObjects = async () => {
    const { data, error } = await supabase
      .from('objects')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error('Fehler beim Laden der Objekte:', error)
      return
    }

    setObjects(data || [])
  }

  // Formular zurücksetzen
  const resetForm = () => {
    setFormData({
      name: '',
      short_name: '',
      address: '',
      city: '',
      postal_code: '',
      description: '',
      contact_person: '',
      contact_phone: '',
    })
    setEditingId(null)
    setShowForm(false)
  }

  // Objekt speichern
  const handleSave = async (e) => {
    e.preventDefault()

    if (!formData.name) {
      alert('Name ist erforderlich')
      return
    }

    try {
      if (editingId) {
        // Update
        const { error } = await supabase
          .from('objects')
          .update({
            name: formData.name,
            short_name: formData.short_name,
            address: formData.address,
            city: formData.city,
            postal_code: formData.postal_code,
            description: formData.description,
            contact_person: formData.contact_person,
            contact_phone: formData.contact_phone,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)

        if (error) throw error

        alert('✅ Objekt aktualisiert!')
      } else {
        // Create
        const { error } = await supabase
          .from('objects')
          .insert([{
            name: formData.name,
            short_name: formData.short_name,
            address: formData.address,
            city: formData.city,
            postal_code: formData.postal_code,
            description: formData.description,
            contact_person: formData.contact_person,
            contact_phone: formData.contact_phone,
          }])

        if (error) throw error

        alert('✅ Objekt hinzugefügt!')
      }

      await loadObjects()
      resetForm()
    } catch (err) {
      console.error('Fehler beim Speichern:', err)
      alert('❌ Fehler beim Speichern: ' + err.message)
    }
  }

  // Objekt löschen
  const handleDelete = async (id, name) => {
    if (!confirm(`Objekt "${name}" wirklich löschen?\n\nAchtung: Alle zugeordneten Mitarbeiter und Schichten werden ebenfalls entfernt!`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('objects')
        .delete()
        .eq('id', id)

      if (error) throw error

      await loadObjects()
      alert('✅ Objekt gelöscht!')
    } catch (err) {
      console.error('Fehler beim Löschen:', err)
      alert('❌ Fehler beim Löschen: ' + err.message)
    }
  }

  // Objekt zum Bearbeiten laden
  const handleEdit = (object) => {
    setFormData({
      name: object.name || '',
      short_name: object.short_name || '',
      address: object.address || '',
      city: object.city || '',
      postal_code: object.postal_code || '',
      description: object.description || '',
      contact_person: object.contact_person || '',
      contact_phone: object.contact_phone || '',
    })
    setEditingId(object.id)
    setShowForm(true)
  }

  // Objekt aktivieren/deaktivieren
  const handleToggleActive = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('objects')
        .update({ is_active: !currentStatus })
        .eq('id', id)

      if (error) throw error

      await loadObjects()
    } catch (err) {
      console.error('Fehler:', err)
      alert('❌ Fehler beim Ändern des Status')
    }
  }

  // Gefilterte Objekte
  const filteredObjects = objects.filter(obj => 
    obj.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    obj.short_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    obj.city?.toLowerCase().includes(searchTerm.toLowerCase())
  )

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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🏢 Objektverwaltung</h1>
            <p className="text-gray-600 mt-1">Standorte und Objekte verwalten</p>
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
        
        {/* Aktionen & Suche */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <button
            onClick={() => {
              resetForm()
              setShowForm(!showForm)
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded font-semibold"
          >
            {showForm && !editingId ? '✕ Abbrechen' : '+ Neues Objekt'}
          </button>
          
          <div className="flex-1">
            <input
              type="text"
              placeholder="🔍 Suchen nach Name, Kürzel oder Stadt..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
            />
          </div>
        </div>

        {/* Formular */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">
              {editingId ? '✏️ Objekt bearbeiten' : '➕ Neues Objekt'}
            </h2>

            <form onSubmit={handleSave}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Name */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                    placeholder="z.B. Hauptgebäude"
                    required
                  />
                </div>

                {/* Kürzel */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Kürzel
                  </label>
                  <input
                    type="text"
                    value={formData.short_name}
                    onChange={(e) => setFormData({ ...formData, short_name: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                    placeholder="z.B. HG"
                    maxLength={10}
                  />
                </div>

                {/* Adresse */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Adresse
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                    placeholder="Straße und Hausnummer"
                  />
                </div>

                {/* PLZ */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    PLZ
                  </label>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                    placeholder="z.B. 10115"
                    maxLength={10}
                  />
                </div>

                {/* Stadt */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Stadt
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                    placeholder="z.B. Berlin"
                  />
                </div>

                {/* Ansprechpartner */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Ansprechpartner
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                    placeholder="Name des Ansprechpartners"
                  />
                </div>

                {/* Telefon */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                    placeholder="z.B. 030 123456"
                  />
                </div>

                {/* Beschreibung */}
                <div className="md:col-span-2 lg:col-span-2">
                  <label className="block text-gray-700 font-semibold mb-2">
                    Beschreibung
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                    placeholder="Zusätzliche Informationen zum Objekt..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 mt-6">
                <button
                  type="submit"
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded font-semibold"
                >
                  {editingId ? '✓ Speichern' : '✓ Hinzufügen'}
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

        {/* Statistik-Karten */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Gesamt</p>
                <p className="text-3xl font-bold text-gray-900">{objects.length}</p>
              </div>
              <span className="text-4xl">🏢</span>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Aktiv</p>
                <p className="text-3xl font-bold text-green-600">
                  {objects.filter(o => o.is_active).length}
                </p>
              </div>
              <span className="text-4xl">✅</span>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Inaktiv</p>
                <p className="text-3xl font-bold text-red-600">
                  {objects.filter(o => !o.is_active).length}
                </p>
              </div>
              <span className="text-4xl">⏸️</span>
            </div>
          </div>
        </div>

        {/* Objekte-Liste */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
            <h2 className="text-xl font-bold text-gray-900">
              Objekte ({filteredObjects.length})
            </h2>
          </div>

          {filteredObjects.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <span className="text-6xl mb-4 block">🏢</span>
              <p className="text-lg">
                {searchTerm ? 'Keine Objekte gefunden' : 'Noch keine Objekte vorhanden'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded font-semibold"
                >
                  + Erstes Objekt anlegen
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {filteredObjects.map((obj) => (
                <div
                  key={obj.id}
                  className={`border-2 rounded-lg p-4 transition hover:shadow-lg ${
                    obj.is_active 
                      ? 'border-green-200 bg-white' 
                      : 'border-gray-300 bg-gray-50 opacity-70'
                  }`}
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{obj.name}</h3>
                      {obj.short_name && (
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded mt-1">
                          {obj.short_name}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleActive(obj.id, obj.is_active)}
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        obj.is_active
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                      title={obj.is_active ? 'Deaktivieren' : 'Aktivieren'}
                    >
                      {obj.is_active ? '✓ Aktiv' : '✕ Inaktiv'}
                    </button>
                  </div>

                  {/* Adresse */}
                  {(obj.address || obj.city) && (
                    <div className="text-sm text-gray-600 mb-3">
                      <span className="mr-1">📍</span>
                      {obj.address && <span>{obj.address}, </span>}
                      {obj.postal_code && <span>{obj.postal_code} </span>}
                      {obj.city && <span>{obj.city}</span>}
                    </div>
                  )}

                  {/* Ansprechpartner */}
                  {obj.contact_person && (
                    <div className="text-sm text-gray-600 mb-3">
                      <span className="mr-1">👤</span>
                      {obj.contact_person}
                      {obj.contact_phone && (
                        <span className="ml-2 text-blue-600">
                          📞 {obj.contact_phone}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Beschreibung */}
                  {obj.description && (
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                      {obj.description}
                    </p>
                  )}

                  {/* Aktionen */}
                  <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => handleEdit(obj)}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-semibold"
                    >
                      ✏️ Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDelete(obj.id, obj.name)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded text-sm font-semibold"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-bold text-gray-900 mb-2">ℹ️ Hinweis</h3>
          <p className="text-gray-700 text-sm">
            Objekte sind Standorte oder Gebäude, in denen Mitarbeiter eingesetzt werden. 
            Nach dem Anlegen können Sie Mitarbeiter in der Personalverwaltung einem Hauptobjekt zuordnen 
            und im Schichtplaner Schichten für die jeweiligen Objekte erstellen.
          </p>
        </div>
      </div>
    </div>
  )
}