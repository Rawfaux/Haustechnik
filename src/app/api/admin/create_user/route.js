
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Server-Side Supabase Client mit Service Role Key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request) {
  try {
    const body = await request.json()
    const { email, password, role, employeeId } = body

    // Validierung
    if (!email || !password || !role) {
      return NextResponse.json(
        { error: 'Email, Passwort und Rolle erforderlich' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Passwort muss mindestens 6 Zeichen haben' },
        { status: 400 }
      )
    }

    // 1. User in Supabase Auth erstellen
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-bestätigen
    })

    if (authError) {
      console.error('Auth Error:', authError)
      
      // Benutzerfreundliche Fehlermeldung
      if (authError.message.includes('already registered')) {
        return NextResponse.json(
          { error: 'Diese Email ist bereits registriert' },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    // 2. Rolle in user_roles eintragen
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert([
        {
          user_id: userId,
          role: role,
        },
      ])

    if (roleError) {
      console.error('Role Error:', roleError)
      
      // User wieder löschen wenn Rolle fehlschlägt
      await supabaseAdmin.auth.admin.deleteUser(userId)
      
      return NextResponse.json(
        { error: 'Fehler beim Setzen der Rolle: ' + roleError.message },
        { status: 500 }
      )
    }

    // 3. Mitarbeiter mit user_id verknüpfen (falls employeeId angegeben)
    if (employeeId) {
      const { error: empError } = await supabaseAdmin
        .from('employees')
        .update({ user_id: userId })
        .eq('id', employeeId)

      if (empError) {
        console.error('Employee Link Error:', empError)
        // Nicht kritisch, trotzdem weitermachen
      }
    }

    return NextResponse.json({
      success: true,
      userId: userId,
      email: email,
      role: role,
      message: 'Benutzer erfolgreich erstellt!'
    })

  } catch (error) {
    console.error('Server Error:', error)
    return NextResponse.json(
      { error: 'Interner Server-Fehler: ' + error.message },
      { status: 500 }
    )
  }
}