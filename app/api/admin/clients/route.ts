import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function requireCoach() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getAdmin()
  const { data: profile } = await admin.from('clients').select('is_coach').eq('id', user.id).single()
  if (!profile?.is_coach) return null
  return user
}

// GET /api/admin/clients — list all clients (coach only)
export async function GET() {
  const user = await requireCoach()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = getAdmin()
  const { data: clients, error } = await admin
    .from('clients')
    .select('id, name, email, sex, spreadsheet_id, created_at, is_coach')
    .eq('is_coach', false)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(clients ?? [])
}

// POST /api/admin/clients — create a new client (coach only)
export async function POST(request: NextRequest) {
  const user = await requireCoach()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, email, password, spreadsheetUrl, sex = 'Male' } = body

  if (!name || !email || !password || !spreadsheetUrl) {
    return NextResponse.json({ error: 'name, email, password, and spreadsheetUrl are required' }, { status: 400 })
  }

  // Extract sheet ID from URL or use as-is if it looks like an ID already
  let spreadsheetId = spreadsheetUrl.trim()
  const urlMatch = spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (urlMatch) spreadsheetId = urlMatch[1]

  const admin = getAdmin()

  // Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { is_coach: false },
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Insert into clients table
  const { data: client, error: dbError } = await admin.from('clients').insert({
    id: authData.user.id,
    name,
    email,
    spreadsheet_id: spreadsheetId,
    sex,
    is_coach: false,
  }).select().single()

  if (dbError) {
    // Clean up the auth user if DB insert fails
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json(client, { status: 201 })
}
