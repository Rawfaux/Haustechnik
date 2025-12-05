'use client'

import { useState } from 'react'
import PhotoViewer from './PhotoViewer'
import { exportTripToPDF } from '@/lib/pdfExport'

export default function TripDetailModal({ trip, photos, onClose }) {
  const [showPhotoViewer, setShowPhotoViewer] = useState(false)

  if (!trip) return null

  // Gefahrene KM berechnen
  const drivenKm = trip.end_km && trip.start_km 
    ? (trip.end_km - trip.start_km).toFixed(1) 
    : '-'

  // Zeitdauer berechnen
  const getDuration = () => {
    if (!trip.start_time || !trip.end_time) return '-'
    const start = new Date(trip.start_time)
    const end = new Date(trip.end_time)
    const diffMs = end - start
    const diffHrs = Math.floor(diffMs / 3600000)
    const diffMins = Math.floor((diffMs % 3600000) / 60000)
    return `${diffHrs}h ${diffMins}min`
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full my-8">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-t-lg">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold mb-2">📋 Fahrtenprotokoll</h2>
                <p className="text-blue-100">
                  {new Date(trip.created_at).toLocaleDateString('de-DE', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              <button
                onClick={onClose}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded font-semibold"
              >
                ✕ Schließen
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            
            {/* Status Badge */}
            <div className="flex items-center gap-3">
              <span
                className={`px-4 py-2 rounded-full text-sm font-bold ${
                  trip.status === 'COMPLETED'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {trip.status === 'COMPLETED' ? '✓ Abgeschlossen' : '▶ In Bearbeitung'}
              </span>
              <span
                className={`px-4 py-2 rounded-full text-sm font-bold ${
                  trip.purpose === 'geschaeftlich'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {trip.purpose === 'geschaeftlich' ? '💼 Geschäftlich' : '🏠 Privat'}
              </span>
            </div>

            {/* Zeit-Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-bold text-gray-900 mb-3">🕐 Zeitangaben</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Start-Zeit</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(trip.start_time).toLocaleTimeString('de-DE', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })} Uhr
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">End-Zeit</p>
                  <p className="font-semibold text-gray-900">
                    {trip.end_time 
                      ? `${new Date(trip.end_time).toLocaleTimeString('de-DE', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })} Uhr`
                      : '-'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Dauer</p>
                  <p className="font-semibold text-gray-900">{getDuration()}</p>
                </div>
              </div>
            </div>

            {/* Strecken-Info */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-bold text-gray-900 mb-3">📍 Streckendaten</h3>
              <div className="space-y-3">
                <div className="flex items-start">
                  <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3">
                    A
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">Start-Ort</p>
                    <p className="font-semibold text-gray-900">{trip.start_location}</p>
                    <p className="text-sm text-gray-500">
                      KM-Stand: {trip.start_km ? `${trip.start_km.toFixed(1)} km` : 'Erste Fahrt'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3">
                    B
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">End-Ort</p>
                    <p className="font-semibold text-gray-900">{trip.end_location || '-'}</p>
                    <p className="text-sm text-gray-500">
                      KM-Stand: {trip.end_km ? `${trip.end_km.toFixed(1)} km` : '-'}
                    </p>
                  </div>
                </div>

                <div className="bg-white border-2 border-blue-300 rounded p-3">
                  <p className="text-sm text-gray-600">Gefahrene Kilometer</p>
                  <p className="text-2xl font-bold text-blue-600">{drivenKm} km</p>
                </div>
              </div>
            </div>

            {/* Fotos */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="font-bold text-gray-900 mb-3">
                📸 Fotos {photos && photos.length > 0 ? `(${photos.length})` : ''}
              </h3>
              
              {!photos || photos.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <p className="text-sm">Lade Fotos...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {photos.map((photo, index) => (
                      <img
                        key={photo.id}
                        src={photo.photo_data}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-24 object-cover rounded border-2 border-gray-300 cursor-pointer hover:border-blue-500 transition"
                        onClick={() => setShowPhotoViewer(true)}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setShowPhotoViewer(true)}
                    className="mt-3 w-full bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded font-semibold"
                  >
                    📸 Alle Fotos anzeigen
                  </button>
                </>
              )}
            </div>
            

            {/* Unterschrift */}
            {trip.signature_data && (
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 mb-3">✍️ Unterschrift</h3>
                <div className="bg-white border-2 border-gray-300 rounded p-4 mb-3">
                  <img
                    src={trip.signature_data}
                    alt="Unterschrift"
                    className="max-w-full h-32 mx-auto"
                  />
                </div>
                <p className="text-sm text-gray-600">
                  Signiert am: {new Date(trip.signature_date).toLocaleString('de-DE')}
                </p>
              </div>
            )}

            {/* Änderungen */}
            {trip.change_reason && (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded p-4">
                <h3 className="font-bold text-gray-900 mb-2">📝 Änderungsgrund</h3>
                <p className="text-gray-700">{trip.change_reason}</p>
              </div>
            )}

            {/* Meta-Info */}
            <div className="bg-gray-50 rounded p-4 text-sm text-gray-600">
              <p>Erstellt am: {new Date(trip.created_at).toLocaleString('de-DE')}</p>
              {trip.updated_at !== trip.created_at && (
                <p>Zuletzt geändert: {new Date(trip.updated_at).toLocaleString('de-DE')}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-100 p-4 rounded-b-lg flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
            >
              Schließen
            </button>
            <button
              onClick={() => exportTripToPDF(trip, photos)}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-semibold"
            >
              📄 Als PDF exportieren
            </button>
          </div>
        </div>
      </div>

      {/* Photo Viewer */}
      {showPhotoViewer && photos && photos.length > 0 && (
        <PhotoViewer
          photos={photos}
          onClose={() => setShowPhotoViewer(false)}
        />
      )}
    </>
  )
}