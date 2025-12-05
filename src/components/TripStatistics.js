'use client'

export default function TripStatistics({ trips, onClose }) {
  if (!trips || trips.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">📊 Statistiken</h2>
            <button
              onClick={onClose}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
            >
              ✕ Schließen
            </button>
          </div>
          <p className="text-center text-gray-500 py-12">Keine Fahrten vorhanden</p>
        </div>
      </div>
    )
  }

  // Berechnungen
  const gesamtFahrten = trips.length
  const abgeschlossen = trips.filter(t => t.status === 'COMPLETED').length
  
  const geschaeftlichFahrten = trips.filter(t => t.purpose === 'geschaeftlich')
  const privatFahrten = trips.filter(t => t.purpose === 'privat')
  
  // KM berechnen
  const berechneKm = (tripList) => {
    return tripList.reduce((sum, trip) => {
      if (trip.end_km && trip.start_km) {
        return sum + (trip.end_km - trip.start_km)
      }
      return sum
    }, 0)
  }
  
  const gesamtKm = berechneKm(trips)
  const geschaeftlichKm = berechneKm(geschaeftlichFahrten)
  const privatKm = berechneKm(privatFahrten)
  
  // Durchschnitt
  const durchschnittKm = abgeschlossen > 0 ? (gesamtKm / abgeschlossen) : 0
  
  // Aktueller Monat
  const aktuellerMonat = new Date().getMonth()
  const aktuellesJahr = new Date().getFullYear()
  
  const dieserMonat = trips.filter(t => {
    const date = new Date(t.created_at)
    return date.getMonth() === aktuellerMonat && date.getFullYear() === aktuellesJahr
  })
  
  const diesesJahr = trips.filter(t => {
    const date = new Date(t.created_at)
    return date.getFullYear() === aktuellesJahr
  })
  
  const dieserMonatKm = berechneKm(dieserMonat)
  const diesesJahrKm = berechneKm(diesesJahr)
  
  // Letzte 5 Fahrten
  const letzteFahrten = [...trips]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)
  
  // Monats-Übersicht (letzte 6 Monate)
  const monatsUebersicht = []
  for (let i = 5; i >= 0; i--) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const monat = date.getMonth()
    const jahr = date.getFullYear()
    
    const fahrtenImMonat = trips.filter(t => {
      const tripDate = new Date(t.created_at)
      return tripDate.getMonth() === monat && tripDate.getFullYear() === jahr
    })
    
    monatsUebersicht.push({
      monat: date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
      anzahl: fahrtenImMonat.length,
      km: berechneKm(fahrtenImMonat)
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-blue-600 text-white p-6 rounded-t-lg">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold mb-2">📊 Fahrtenbuch Statistiken</h2>
              <p className="text-purple-100">Übersicht aller Fahrten und Kennzahlen</p>
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
          
          {/* Hauptstatistiken */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Gesamt KM */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-5 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-100 text-sm font-semibold">Gesamt-KM</span>
                <span className="text-3xl">🚗</span>
              </div>
              <p className="text-4xl font-bold mb-1">{gesamtKm.toFixed(0)}</p>
              <p className="text-blue-100 text-sm">{gesamtFahrten} Fahrten</p>
            </div>

            {/* Geschäftlich */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-5 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-100 text-sm font-semibold">Geschäftlich</span>
                <span className="text-3xl">💼</span>
              </div>
              <p className="text-4xl font-bold mb-1">{geschaeftlichKm.toFixed(0)}</p>
              <p className="text-green-100 text-sm">{geschaeftlichFahrten.length} Fahrten</p>
            </div>

            {/* Privat */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-5 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-100 text-sm font-semibold">Privat</span>
                <span className="text-3xl">🏠</span>
              </div>
              <p className="text-4xl font-bold mb-1">{privatKm.toFixed(0)}</p>
              <p className="text-purple-100 text-sm">{privatFahrten.length} Fahrten</p>
            </div>

            {/* Durchschnitt */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-5 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-orange-100 text-sm font-semibold">Ø pro Fahrt</span>
                <span className="text-3xl">📊</span>
              </div>
              <p className="text-4xl font-bold mb-1">{durchschnittKm.toFixed(1)}</p>
              <p className="text-orange-100 text-sm">km pro Fahrt</p>
            </div>
          </div>

          {/* Zeitraum-Statistiken */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dieser Monat */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-5">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <span className="mr-2">📅</span>
                Dieser Monat ({new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })})
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Fahrten:</span>
                  <span className="font-bold text-gray-900">{dieserMonat.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Gesamt-KM:</span>
                  <span className="font-bold text-blue-600">{dieserMonatKm.toFixed(1)} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Geschäftlich:</span>
                  <span className="font-bold text-green-600">
                    {berechneKm(dieserMonat.filter(t => t.purpose === 'geschaeftlich')).toFixed(1)} km
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Privat:</span>
                  <span className="font-bold text-purple-600">
                    {berechneKm(dieserMonat.filter(t => t.purpose === 'privat')).toFixed(1)} km
                  </span>
                </div>
              </div>
            </div>

            {/* Dieses Jahr */}
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-5">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <span className="mr-2">📆</span>
                Dieses Jahr ({aktuellesJahr})
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Fahrten:</span>
                  <span className="font-bold text-gray-900">{diesesJahr.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Gesamt-KM:</span>
                  <span className="font-bold text-green-600">{diesesJahrKm.toFixed(1)} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Geschäftlich:</span>
                  <span className="font-bold text-green-600">
                    {berechneKm(diesesJahr.filter(t => t.purpose === 'geschaeftlich')).toFixed(1)} km
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Privat:</span>
                  <span className="font-bold text-purple-600">
                    {berechneKm(diesesJahr.filter(t => t.purpose === 'privat')).toFixed(1)} km
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Monatsübersicht */}
          <div className="bg-gray-50 rounded-lg p-5 border-2 border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">📈</span>
              Letzte 6 Monate
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 px-3 text-gray-700 font-semibold">Monat</th>
                    <th className="text-right py-2 px-3 text-gray-700 font-semibold">Fahrten</th>
                    <th className="text-right py-2 px-3 text-gray-700 font-semibold">KM</th>
                  </tr>
                </thead>
                <tbody>
                  {monatsUebersicht.map((monat, index) => (
                    <tr key={index} className="border-b border-gray-200 hover:bg-gray-100">
                      <td className="py-2 px-3 text-gray-900">{monat.monat}</td>
                      <td className="py-2 px-3 text-right text-gray-900">{monat.anzahl}</td>
                      <td className="py-2 px-3 text-right font-semibold text-blue-600">
                        {monat.km.toFixed(1)} km
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Letzte 5 Fahrten */}
          <div className="bg-purple-50 rounded-lg p-5 border-2 border-purple-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">🕐</span>
              Letzte 5 Fahrten
            </h3>
            <div className="space-y-2">
              {letzteFahrten.map((trip) => {
                const km = trip.end_km && trip.start_km ? (trip.end_km - trip.start_km).toFixed(1) : '-'
                return (
                  <div key={trip.id} className="bg-white rounded p-3 border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {trip.start_location} → {trip.end_location || '-'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(trip.created_at).toLocaleDateString('de-DE')} • {km} km • {trip.purpose === 'geschaeftlich' ? '💼 Geschäftlich' : '🏠 Privat'}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        trip.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {trip.status === 'COMPLETED' ? '✓' : '▶'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-100 p-4 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}