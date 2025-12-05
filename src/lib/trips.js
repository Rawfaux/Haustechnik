import { supabase } from './supabase'

// Letzte abgeschlossene Fahrt abrufen (für Start-Km)
export const getLastCompletedTrip = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('end_km')
      .eq('user_id', userId)
      .eq('status', 'COMPLETED')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) return null
    return data?.end_km || null
  } catch (err) {
    return null
  }
}

// Aktuelle laufende Fahrt abrufen
export const getActiveTrip = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'IN_PROGRESS')
      .single()

    if (error) return null
    return data
  } catch (err) {
    return null
  }
}

// Alle Fahrten abrufen
export const getAllTrips = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) return []
    return data || []
  } catch (err) {
    return []
  }
}

// Fahrt starten
export const startTrip = async (userId, startLocation, purpose) => {
  try {
    // Letzte Fahrt-Km holen
    const lastEndKm = await getLastCompletedTrip(userId)

    const { data, error } = await supabase
      .from('trips')
      .insert([
        {
          user_id: userId,
          start_time: new Date().toISOString(),
          start_location: startLocation,
          start_km: lastEndKm,
          purpose: purpose,
          status: 'IN_PROGRESS',
        },
      ])
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (err) {
    console.log('Fehler beim Starten der Fahrt')
    return null
  }
}

// Fahrt beenden (mit Unterschrift!)
export const endTrip = async (tripId, endLocation, endKm, signatureData, changeReason = null) => {
  try {
    const { data, error } = await supabase
      .from('trips')
      .update({
        end_time: new Date().toISOString(),
        end_location: endLocation,
        end_km: parseFloat(endKm),
        status: 'COMPLETED',
        signature_data: signatureData,
        signature_date: new Date().toISOString(),
        change_reason: changeReason,
      })
      .eq('id', tripId)
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (err) {
    console.log('Fehler beim Beenden der Fahrt')
    return null
  }
}

// Fahrt aktualisieren (bearbeiten)
export const updateTrip = async (tripId, updates, changeReason) => {
  try {
    const { data, error } = await supabase
      .from('trips')
      .update({
        ...updates,
        change_reason: changeReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId)
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (err) {
    console.log('Fehler beim Aktualisieren der Fahrt')
    return null
  }
}

// Fahrt löschen
export const deleteTrip = async (tripId) => {
  try {
    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('id', tripId)

    if (error) throw error
    return true
  } catch (err) {
    console.log('Fehler beim Löschen der Fahrt')
    return false
  }
}

// ===== FAHRZEUG-FUNKTIONEN =====

// Fahrzeuge abrufen (ALLE für alle Nutzer sichtbar!)
export const getVehicles = async () => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return []
    return data || []
  } catch (err) {
    return []
  }
}

// Fotos zu Fahrt hinzufügen
export const addTripPhoto = async (tripId, photoData) => {
  try {
    const { data, error } = await supabase
      .from('trip_photos')
      .insert([
        {
          trip_id: tripId,
          photo_data: photoData,
        },
      ])
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (err) {
    console.log('Fehler beim Hochladen des Fotos')
    return null
  }
}

// Fotos einer Fahrt abrufen
export const getTripPhotos = async (tripId) => {
  try {
    const { data, error } = await supabase
      .from('trip_photos')
      .select('*')
      .eq('trip_id', tripId)
      .order('uploaded_at', { ascending: true })

    if (error) return []
    return data || []
  } catch (err) {
    return []
  }
}

// Erstes/Standard-Fahrzeug abrufen (für ALLE Nutzer sichtbar!)
export const getDefaultVehicle = async () => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (error) return null
    return data
  } catch (err) {
    return null
  }
}

// Fahrzeug erstellen
export const createVehicle = async (userId, kennzeichen, modell, aktuellerKm) => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .insert([
        {
          user_id: userId,
          kennzeichen,
          modell,
          aktueller_km: parseFloat(aktuellerKm),
        },
      ])
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (err) {
    console.log('Fehler beim Erstellen des Fahrzeugs')
    return null
  }
}

// Fahrzeug aktualisieren
export const updateVehicle = async (vehicleId, updates) => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', vehicleId)
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (err) {
    console.log('Fehler beim Aktualisieren des Fahrzeugs')
    return null
  }
}

// KM-Stand nach Fahrt-Ende aktualisieren
export const updateVehicleKmAfterTrip = async (vehicleId, newKm) => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .update({ aktueller_km: parseFloat(newKm) })
      .eq('id', vehicleId)
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (err) {
    console.log('Fehler beim Aktualisieren des KM-Stands')
    return null
  }
}

// Fahrzeug löschen
export const deleteVehicle = async (vehicleId) => {
  try {
    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', vehicleId)

    if (error) throw error
    return true
  } catch (err) {
    console.log('Fehler beim Löschen des Fahrzeugs')
    return false
  }
}