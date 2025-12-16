'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import SignatureCanvas from '@/components/SignatureCanvas'
import PhotoUpload from '@/components/PhotoUpload'
import PhotoViewer from '@/components/PhotoViewer'
import TripDetailModal from '@/components/TripDetailModal'
import { exportAllTripsToPDF } from '@/lib/pdfExport'
import TripStatistics from '@/components/TripStatistics'
import { 
  addTripPhoto,
  getTripPhotos,
  startTrip, 
  endTrip, 
  getActiveTrip, 
  getAllTrips, 
  getDefaultVehicle,
  updateVehicleKmAfterTrip 
} from '@/lib/trips'
import Link from 'next/link'

export default function Fahrtenbuch() {
  // User & Data State
  const [user, setUser] = useState(null)
  const [activeTrip, setActiveTrip] = useState(null)
  const [allTrips, setAllTrips] = useState([])
  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  // UI State
  const [showStartForm, setShowStartForm] = useState(false)
  const [showEndForm, setShowEndForm] = useState(false)
  const [showAllTrips, setShowAllTrips] = useState(false)
  const [showSignature, setShowSignature] = useState(false)
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)
  const [submittingTrip, setSubmittingTrip] = useState(false)
  

  // Form Data
  const [startFormData, setStartFormData] = useState({
    startLocation: '',
    purpose: 'geschaeftlich',
  })
  const [endFormData, setEndFormData] = useState({
    endLocation: '',
    endKm: '',
    changeReason: '',
  })
  
  // Photo & Signature State
  const [signatureData, setSignatureData] = useState(null)
  const [uploadedPhotos, setUploadedPhotos] = useState([])
  
  // Modal State
  const [viewingPhotos, setViewingPhotos] = useState(null)
  const [selectedTripPhotos, setSelectedTripPhotos] = useState([])
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [selectedTripPhotosForModal, setSelectedTripPhotosForModal] = useState([])
  const [showStatistics, setShowStatistics] = useState(false)

  // Filter State
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    purpose: 'alle',
    searchTerm: '',
  })
  const [showFilters, setShowFilters] = useState(false)
  const [filteredTrips, setFilteredTrips] = useState([])

  const router = useRouter()

  // ===== DATA LOADING =====
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          router.push('/')
          return
        }

        setUser(session.user)
        
        // Fahrzeug laden
        const defaultVehicle = await getDefaultVehicle()
        setVehicle(defaultVehicle)

        // Aktive Fahrt laden
        const active = await getActiveTrip(session.user.id)
        setActiveTrip(active)

        // Alle Fahrten laden
        const trips = await getAllTrips(session.user.id)
        setAllTrips(trips)
      } catch (err) {
        console.log('Fehler beim Laden')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  // ===== HANDLERS =====
  
  // Fahrt starten
  const handleStartTrip = async (e) => {
    e.preventDefault()

    if (!startFormData.startLocation) {
      alert('Start-Ort erforderlich')
      return
    }

    const trip = await startTrip(
      user.id,
      startFormData.startLocation,
      startFormData.purpose
    )

    if (trip) {
      setActiveTrip(trip)
      setStartFormData({ startLocation: '', purpose: 'geschaeftlich' })
      setShowStartForm(false)
      alert('Fahrt gestartet!')
    } else {
      alert('Fehler beim Starten der Fahrt')
    }
  }

// Fahrt beenden
  const handleEndTrip = async (e) => {
    e.preventDefault()

    if (submittingTrip) {
      console.log('⚠️ Fahrt wird bereits beendet!')
      return
    }

    if (!endFormData.endLocation || !endFormData.endKm) {
      alert('End-Ort und End-Km erforderlich')
      return
    }

    // Unterschrift erforderlich!
    if (!signatureData) {
      setShowSignature(true)
      return
    }

    const confirmEnd = confirm('Fahrt wirklich abschließen?')
    if (!confirmEnd) return

    console.log('🚗 Starte Fahrt-Abschluss...')
    setSubmittingTrip(true)

    try {
      const trip = await endTrip(
        activeTrip.id,
        endFormData.endLocation,
        endFormData.endKm,
        signatureData,
        endFormData.changeReason
      )

      if (!trip) {
        alert('❌ Fehler beim Beenden der Fahrt. Bitte später erneut versuchen.')
        return
      }

      // Fahrzeug-KM aktualisieren
      if (vehicle) {
        await updateVehicleKmAfterTrip(vehicle.id, endFormData.endKm)
        const updatedVehicle = await getDefaultVehicle()
        setVehicle(updatedVehicle)
      }

      // State zurücksetzen
      setActiveTrip(null)
      setEndFormData({ endLocation: '', endKm: '', changeReason: '' })
      setSignatureData(null)
      setUploadedPhotos([])
      setShowEndForm(false)
      setShowPhotoUpload(false)
      
      // Fahrten neu laden
      const trips = await getAllTrips(user.id)
      setAllTrips(trips)
      
      alert('✅ Fahrt erfolgreich beendet!')
    } catch (error) {
      console.error('Fehler beim Beenden:', error)
      alert('❌ Netzwerkfehler. Bitte Internetverbindung prüfen.')
    } finally {
      setSubmittingTrip(false)
    }
  }

  // Unterschrift speichern
  const handleSignatureSave = (signature) => {
    setSignatureData(signature)
    setShowSignature(false)
    alert('Unterschrift gespeichert! Jetzt auf "Fahrt abschließen" klicken.')
  }

  // Fotos hochladen
 const handlePhotoUpload = async (photos) => {
    if (!activeTrip) {
      alert('Keine aktive Fahrt')
      return
    }

    if (uploadingPhotos) {
      console.log('⚠️ Upload bereits im Gange!')
      return
    }

    console.log('📸 Starte Upload von', photos.length, 'Foto(s)')
    setUploadingPhotos(true)

    try {
      for (let i = 0; i < photos.length; i++) {
        console.log(`📤 Lade Foto ${i + 1}/${photos.length}...`)
        await addTripPhoto(activeTrip.id, photos[i])
      }
      
      setUploadedPhotos(prev => [...prev, ...photos])
      setShowPhotoUpload(false)
      console.log('✅ Alle Fotos hochgeladen!')
      alert(`✅ ${photos.length} Foto(s) erfolgreich hochgeladen!`)
    } catch (error) {
      console.error('Fehler beim Beenden:', error)
      alert('❌ Netzwerkfehler. Bitte Internetverbindung prüfen.')
    } finally {
      setUploadingPhotos(false)
    }
  }

  // Fotos einer Fahrt anzeigen (alte Tabellen-Ansicht)
  const handleViewPhotos = async (tripId) => {
    try {
      const photos = await getTripPhotos(tripId)
      if (photos.length === 0) {
        alert('Keine Fotos für diese Fahrt vorhanden')
        return
      }
      setSelectedTripPhotos(photos)
      setViewingPhotos(tripId)
    } catch (error) {
      console.error('Fehler:', error)
      alert('❌ Fehler beim Laden der Fotos')
    }
  }

  // Fahrt-Details anzeigen (Kachel-Klick)
  const handleViewTripDetails = (trip) => {
    console.log('🔍 Opening trip:', trip.id)
    
    // Modal SOFORT öffnen
    setSelectedTrip(trip)
    setSelectedTripPhotosForModal([])
    
    // Fotos asynchron nachladen
    setTimeout(async () => {
      try {
        const photos = await getTripPhotos(trip.id)
        console.log('📸 Loaded photos:', photos.length)
        setSelectedTripPhotosForModal(photos)
      } catch (error) {
        console.error('Fehler beim Laden der Fotos:', error)
      }
    }, 0)
  }

  // Daten neu laden
  const handleRefresh = async () => {
    setLoading(true)
    const trips = await getAllTrips(user.id)
    setAllTrips(trips)
    const active = await getActiveTrip(user.id)
    setActiveTrip(active)
    const defaultVehicle = await getDefaultVehicle()
    setVehicle(defaultVehicle)
    setLoading(false)
    alert('✅ Daten neu geladen!')
  }

  // Fahrten filtern
  const applyFilters = () => {
    let filtered = [...allTrips]

    // Nach Datum filtern
    if (filters.dateFrom) {
      filtered = filtered.filter(trip => 
        new Date(trip.created_at) >= new Date(filters.dateFrom)
      )
    }

    if (filters.dateTo) {
      const endDate = new Date(filters.dateTo)
      endDate.setHours(23, 59, 59, 999) // Ende des Tages
      filtered = filtered.filter(trip => 
        new Date(trip.created_at) <= endDate
      )
    }

    // Nach Zweck filtern
    if (filters.purpose !== 'alle') {
      filtered = filtered.filter(trip => trip.purpose === filters.purpose)
    }

    // Nach Ort suchen
    if (filters.searchTerm) {
      const search = filters.searchTerm.toLowerCase()
      filtered = filtered.filter(trip => 
        trip.start_location?.toLowerCase().includes(search) ||
        trip.end_location?.toLowerCase().includes(search)
      )
    }

    setFilteredTrips(filtered)
    console.log(`🔍 Filter angewendet: ${filtered.length} von ${allTrips.length} Fahrten`)
  }

  // Filter zurücksetzen
  const resetFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      purpose: 'alle',
      searchTerm: '',
    })
    setFilteredTrips(allTrips)
  }

  // Filter automatisch anwenden wenn sich Daten ändern
  useEffect(() => {
    applyFilters()
  }, [filters, allTrips])

  // ===== RENDER =====
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Lädt...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ===== HEADER ===== */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📋 Fahrtenbuch</h1>
            <p className="text-gray-600 mt-1">Rechtssicheres Fahrtenbuch</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard">
              <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold">
                ← Zurück
              </button>
            </Link>
            <button 
              onClick={handleRefresh}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded font-semibold"
            >
              🔄 Neu laden
            </button>
          </div>
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* ===== MAIN FAHRTENBUCH (LINKS) ===== */}
          <div className="lg:col-span-2">
            
            {/* AKTUELLE FAHRT */}
            {activeTrip ? (
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">🚗 Aktuelle Fahrt läuft</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-gray-600 text-sm">Start-Zeit</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {new Date(activeTrip.start_time).toLocaleString('de-DE')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Start-Ort</p>
                    <p className="text-lg font-semibold text-gray-900">{activeTrip.start_location}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Start-Km</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {activeTrip.start_km ? `${activeTrip.start_km.toFixed(1)} km` : 'Erste Fahrt'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Zweck</p>
                    <p className="text-lg font-semibold text-gray-900 capitalize">{activeTrip.purpose}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowEndForm(!showEndForm)
                    if (showEndForm) {
                      setShowPhotoUpload(false)
                      setUploadedPhotos([])
                    }
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded font-semibold"
                >
                  {showEndForm ? '✕ Abbrechen' : '🛑 Fahrt beenden'}
                </button>

                {/* FAHRT BEENDEN FORMULAR */}
                {showEndForm && (
                  <form onSubmit={handleEndTrip} className="mt-6 bg-white p-4 rounded border border-gray-300">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Fahrt beenden</h3>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-gray-700 font-semibold mb-2">End-Ort *</label>
                        <input
                          type="text"
                          value={endFormData.endLocation}
                          onChange={(e) => setEndFormData({ ...endFormData, endLocation: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                          placeholder="z.B. Büro"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-gray-700 font-semibold mb-2">End-Km *</label>
                        <input
                          type="number"
                          step="0.1"
                          value={endFormData.endKm}
                          onChange={(e) => setEndFormData({ ...endFormData, endKm: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                          placeholder="z.B. 45.5"
                          required
                        />
                      </div>

                      {/* FOTO-UPLOAD (nur wenn End-Km eingegeben) */}
                      {endFormData.endKm && (
                        <div className="bg-blue-50 border-2 border-blue-300 rounded p-4">
                          <h4 className="text-md font-bold text-gray-900 mb-2">📸 KM-Stand fotografieren (optional)</h4>
                          <p className="text-sm text-gray-600 mb-3">
                            Machen Sie ein Foto vom Tacho als Nachweis.
                          </p>
                          
                          {!showPhotoUpload ? (
                            <button
                              type="button"
                              onClick={() => setShowPhotoUpload(true)}
                              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-semibold w-full"
                            >
                              📸 Foto hinzufügen
                            </button>
                          ) : (
                            <div>
                              <PhotoUpload
                                onUpload={handlePhotoUpload}
                                maxPhotos={5}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPhotoUpload(false)}
                                className="mt-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold w-full"
                              >
                                Abbrechen
                              </button>
                            </div>
                          )}

                          {uploadedPhotos.length > 0 && (
                            <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded">
                              <p className="text-green-800 font-semibold">
                                ✓ {uploadedPhotos.length} Foto(s) hochgeladen
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="block text-gray-700 font-semibold mb-2">Grund für Änderungen</label>
                        <textarea
                          value={endFormData.changeReason}
                          onChange={(e) => setEndFormData({ ...endFormData, changeReason: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                          placeholder="Optional: Warum wurden Daten angepasst?"
                          rows="3"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submittingTrip}
                        className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submittingTrip ? '⏳ Speichert...' : '✓ Fahrt abschließen'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (

              /* NEUE FAHRT STARTEN */
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Keine aktive Fahrt</h2>
                <button
                  onClick={() => setShowStartForm(!showStartForm)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded font-semibold"
                >
                  {showStartForm ? '✕ Abbrechen' : '🚗 Neue Fahrt starten'}
                </button>

                {showStartForm && (
                  <form onSubmit={handleStartTrip} className="mt-6 bg-white p-4 rounded border border-gray-300">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Fahrt starten</h3>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-gray-700 font-semibold mb-2">Start-Ort *</label>
                        <input
                          type="text"
                          value={startFormData.startLocation}
                          onChange={(e) => setStartFormData({ ...startFormData, startLocation: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                          placeholder="z.B. Büro"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-gray-700 font-semibold mb-2">Zweck *</label>
                        <select
                          value={startFormData.purpose}
                          onChange={(e) => setStartFormData({ ...startFormData, purpose: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white"
                        >
                          <option value="geschaeftlich">Geschäftlich</option>
                          <option value="privat">Privat</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded font-semibold"
                      >
                        ✓ Fahrt starten
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ALLE FAHRTEN BUTTON */}
            <div className="mb-6 flex gap-2">
              <button
                onClick={() => setShowAllTrips(!showAllTrips)}
                className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded font-semibold"
              >
                {showAllTrips ? '✕ Schließen' : '📊 Alle Fahrten anzeigen'}
              </button>
              <button
                onClick={() => {
                  console.log('📈 Statistik-Button geklickt')
                  console.log('Trips:', allTrips.length)
                  setShowStatistics(true)
                  console.log('showStatistics:', true)
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded font-semibold"
              >
                📈 Statistiken
              </button>
            </div>

            {/* ALLE FAHRTEN KACHELN */}
            {showAllTrips && (
              <div>
                <div className="bg-white rounded-t shadow p-6 border-b">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">
                      📊 Alle Fahrten ({filteredTrips.length} {filteredTrips.length !== allTrips.length && `von ${allTrips.length}`})
                    </h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-4 py-2 rounded font-semibold ${
                          showFilters 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                        }`}
                      >
                        🔍 Filter {showFilters ? '▲' : '▼'}
                      </button>
                      <button
                        onClick={() => exportAllTripsToPDF(filteredTrips)}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-semibold"
                      >
                        📄 Exportieren ({filteredTrips.length})
                      </button>
                    </div>
                  </div>

                  {/* Filter-Panel */}
                  {showFilters && (
                    <div className="bg-gray-50 rounded p-4 border-2 border-gray-200">
                      <h3 className="font-bold text-gray-900 mb-3">🔍 Filteroptionen</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Datum Von */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Von Datum
                          </label>
                          <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white text-sm"
                          />
                        </div>

                        {/* Datum Bis */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Bis Datum
                          </label>
                          <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white text-sm"
                          />
                        </div>

                        {/* Zweck */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Zweck
                          </label>
                          <select
                            value={filters.purpose}
                            onChange={(e) => setFilters({ ...filters, purpose: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white text-sm"
                          >
                            <option value="alle">Alle</option>
                            <option value="geschaeftlich">Geschäftlich</option>
                            <option value="privat">Privat</option>
                          </select>
                        </div>

                        {/* Suche */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Ort suchen
                          </label>
                          <input
                            type="text"
                            value={filters.searchTerm}
                            onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                            placeholder="z.B. Büro"
                            className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white text-sm"
                          />
                        </div>
                      </div>

                      {/* Filter-Actions */}
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={resetFilters}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold text-sm"
                        >
                          ✕ Filter zurücksetzen
                        </button>
                        <div className="flex-1"></div>
                        <span className="text-sm text-gray-600 self-center">
                          {filteredTrips.length} Fahrt{filteredTrips.length !== 1 ? 'en' : ''} gefunden
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-b shadow p-6">
                  {filteredTrips.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-lg">Keine Fahrten gefunden</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredTrips.map((trip) => {
                        const drivenKm = trip.end_km && trip.start_km 
                          ? (trip.end_km - trip.start_km).toFixed(1) 
                          : '-'

                        return (
                          <div
                            key={trip.id}
                            onClick={() => handleViewTripDetails(trip)}
                            className={`bg-white rounded-lg shadow-md p-5 cursor-pointer hover:shadow-xl transition transform hover:scale-105 border-l-4 ${
                              trip.purpose === 'geschaeftlich' 
                                ? 'border-blue-500' 
                                : 'border-purple-500'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="text-sm text-gray-500">
                                  {new Date(trip.created_at).toLocaleDateString('de-DE', { weekday: 'short' })}
                                </p>
                                <p className="text-lg font-bold text-gray-900">
                                  {new Date(trip.created_at).toLocaleDateString('de-DE')}
                                </p>
                              </div>
                              <span
                                className={`px-2 py-1 rounded text-xs font-bold ${
                                  trip.status === 'COMPLETED'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {trip.status === 'COMPLETED' ? '✓' : '▶'}
                              </span>
                            </div>

                            <div className="mb-3">
                              <div className="flex items-center mb-1">
                                <span className="text-green-600 font-bold mr-2">🟢</span>
                                <span className="text-sm text-gray-700 truncate">{trip.start_location}</span>
                              </div>
                              <div className="ml-3 border-l-2 border-gray-300 h-4"></div>
                              <div className="flex items-center">
                                <span className="text-red-600 font-bold mr-2">🔴</span>
                                <span className="text-sm text-gray-700 truncate">{trip.end_location || '-'}</span>
                              </div>
                            </div>

                            <div className="bg-gray-50 rounded p-3 mb-3">
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>Start: {trip.start_km ? `${trip.start_km.toFixed(1)} km` : '-'}</span>
                                <span>End: {trip.end_km ? `${trip.end_km.toFixed(1)} km` : '-'}</span>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-gray-500">Gefahren</p>
                                <p className="text-xl font-bold text-blue-600">{drivenKm} km</p>
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-xs text-gray-500">
                              <span className={`font-semibold ${
                                trip.purpose === 'geschaeftlich' ? 'text-blue-600' : 'text-purple-600'
                              }`}>
                                {trip.purpose === 'geschaeftlich' ? '💼 Geschäftlich' : '🏠 Privat'}
                              </span>
                              <div className="flex gap-2">
                                {trip.signature_data && <span>✍️</span>}
                                <span>📸</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ===== FAHRZEUG-INFO (RECHTS) ===== */}
          <div className="lg:col-span-1">
            {vehicle ? (
              <div className="bg-white rounded shadow p-6 sticky top-4">
                <h3 className="text-xl font-bold text-gray-900 mb-4">🚗 Fahrzeugdaten</h3>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-600 text-sm">Kennzeichen</p>
                    <p className="text-lg font-semibold text-gray-900">{vehicle.kennzeichen}</p>
                  </div>

                  <div>
                    <p className="text-gray-600 text-sm">Modell</p>
                    <p className="text-lg font-semibold text-gray-900">{vehicle.modell}</p>
                  </div>

                  <div className="bg-blue-50 border-2 border-blue-300 p-4 rounded">
                    <p className="text-gray-600 text-sm">Aktueller KM-Stand</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {vehicle.aktueller_km.toFixed(1)} km
                    </p>
                  </div>

                  <Link href="/dashboard/fahrzeugverwaltung">
                    <button className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-semibold">
                      ✎ Fahrzeuge verwalten
                    </button>
                  </Link>
                </div>

                <div className="mt-6 p-3 bg-gray-100 rounded text-sm text-gray-700">
                  <p className="font-semibold mb-2">ℹ️ Info</p>
                  <p>Der KM-Stand wird automatisch nach jeder Fahrt aktualisiert.</p>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">⚠️ Kein Fahrzeug</h3>
                <p className="text-gray-700 mb-4">
                  Bitte erstellen Sie ein Fahrzeug in der Fahrzeugverwaltung.
                </p>
                <Link href="/dashboard/fahrzeugverwaltung">
                  <button className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded font-semibold">
                    → Fahrzeug erstellen
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      /* ===== MODALS (AUSSERHALB VON ALLEM!) ===== */
      
      /* Trip Detail Modal */
      {selectedTrip && (
        <TripDetailModal
          trip={selectedTrip}
          photos={selectedTripPhotosForModal}
          onClose={() => {
            setSelectedTrip(null)
            setSelectedTripPhotosForModal([])
          }}
        />
      )}

      {/* Photo Viewer Modal */}
      {viewingPhotos && (
        <PhotoViewer
          photos={selectedTripPhotos}
          onClose={() => {
            setViewingPhotos(null)
            setSelectedTripPhotos([])
          }}
        />
      )}

      {/* Unterschrift Modal */}
      {showSignature && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="max-w-2xl w-full">
            <SignatureCanvas
              onSave={handleSignatureSave}
              onCancel={() => setShowSignature(false)}
            />
          </div>
        </div>
    )}

         {/* Statistik Modal */}
      {showStatistics && (
      <TripStatistics
        trips={allTrips}
          onClose={() => setShowStatistics(false)}
        />
      )}

    </div>
  )
}

  