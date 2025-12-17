import { supabase } from './supabase'

// Benutzer-Rolle abrufen
export const getUserRole = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (error) return null
    
    // WICHTIG: Deaktivierte Accounts blockieren
    if (data?.role === 'deaktiviert') {
      return null // Behandle wie "keine Rolle" = kein Zugriff
    }
    
    return data?.role || 'haustechniker'
  } catch (err) {
    console.error('Fehler beim Abrufen der Rolle:', err)
    return null
  }
}

// Benutzer ist Admin?
export const isAdmin = async (userId) => {
  const role = await getUserRole(userId)
  return role === 'admin'
}

// Neue Rolle erstellen (bei Registrierung)
export const createUserRole = async (userId, role = 'haustechniker') => {
  try {
    const { error } = await supabase
      .from('user_roles')
      .insert([
        {
          user_id: userId,
          role: role,
        },
      ])

    if (error) throw error
    return true
  } catch (err) {
    console.error('Fehler beim Erstellen der Rolle:', err)
    return false
  }
}