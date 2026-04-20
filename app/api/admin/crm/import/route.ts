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

export async function POST(request: NextRequest) {
  const user = await requireCoach()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, email, mobile, startDate, offerType, weeklyRate, birthday, tcSigned, expectationsSigned } = body

  if (!name || !email) {
    return NextResponse.json({ error: 'name and email are required' }, { status: 400 })
  }

  const admin = getAdmin()

  // Check if already exists
  const { data: existing } = await admin.from('clients').select('id').eq('email', email).single()
  if (existing) return NextResponse.json({ error: 'Client already exists' }, { status: 409 })

  // Parse weekly rate — strip $ and commas
  let weeklyRateNum: number | null = null
  if (weeklyRate) {
    const parsed = parseFloat(weeklyRate.toString().replace(/[$,\s]/g, ''))
    if (!isNaN(parsed)) weeklyRateNum = parsed
  }

  // Invite user — sends them an email to set their password
  const { data: authData, error: authError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { is_coach: false },
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const { data: client, error: dbError } = await admin.from('clients').insert({
    id: authData.user.id,
    name,
    email,
    sex: 'Male',
    is_coach: false,
    whatsapp_number: mobile || null,
    start_date: startDate || null,
    offer_type: offerType || null,
    weekly_rate: weeklyRateNum,
    birthday: birthday || null,
    step_terms_signed: tcSigned ?? false,
    step_expectations_signed: expectationsSigned ?? false,
  }).select().single()

  if (dbError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json(client, { status: 201 })
}
