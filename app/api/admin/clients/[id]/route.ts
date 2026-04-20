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

// GET /api/admin/clients/[id] — fetch a single client
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireCoach()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = getAdmin()
  const { data, error } = await admin
    .from('clients')
    .select('id, name, email, sex, spreadsheet_id, package_end_date, whatsapp_number, terms_url, expectations_url, trainerize_url, onboarding_form_url, drive_folder_url, created_at')
    .eq('id', id)
    .single()

  if (error || !data) {
    // Fallback: fetch without optional columns in case migrations haven't run
    const { data: fallback, error: fallbackError } = await admin
      .from('clients')
      .select('id, name, email, sex, spreadsheet_id, created_at')
      .eq('id', id)
      .single()
    if (fallbackError || !fallback) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ...fallback, package_end_date: null, whatsapp_number: null, terms_url: null, expectations_url: null })
  }
  return NextResponse.json(data)
}

// PATCH /api/admin/clients/[id] — update a client
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireCoach()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const {
    name, sex, whatsappNumber, packageEndDate, spreadsheetUrl,
    trainerizeUrl, termsUrl, expectationsUrl, onboardingFormUrl, driveFolderUrl,
    step_form_sent, step_terms_signed, step_expectations_signed, step_trainerize_setup,
    step_tracker_created, step_bloods_reminder_sent, step_intro_call_done,
  } = body

  const updates: Record<string, string | boolean | null> = {}
  if (name !== undefined) updates.name = name
  if (sex !== undefined) updates.sex = sex
  if (whatsappNumber !== undefined) updates.whatsapp_number = whatsappNumber || null
  if (packageEndDate !== undefined) updates.package_end_date = packageEndDate || null
  if (trainerizeUrl !== undefined) updates.trainerize_url = trainerizeUrl || null
  if (termsUrl !== undefined) updates.terms_url = termsUrl || null
  if (expectationsUrl !== undefined) updates.expectations_url = expectationsUrl || null
  if (onboardingFormUrl !== undefined) updates.onboarding_form_url = onboardingFormUrl || null
  if (driveFolderUrl !== undefined) updates.drive_folder_url = driveFolderUrl || null

  // Onboarding step booleans
  if (step_form_sent !== undefined) updates.step_form_sent = step_form_sent
  if (step_terms_signed !== undefined) updates.step_terms_signed = step_terms_signed
  if (step_expectations_signed !== undefined) updates.step_expectations_signed = step_expectations_signed
  if (step_trainerize_setup !== undefined) updates.step_trainerize_setup = step_trainerize_setup
  if (step_tracker_created !== undefined) updates.step_tracker_created = step_tracker_created
  if (step_bloods_reminder_sent !== undefined) updates.step_bloods_reminder_sent = step_bloods_reminder_sent
  if (step_intro_call_done !== undefined) updates.step_intro_call_done = step_intro_call_done

  if (spreadsheetUrl !== undefined) {
    let spreadsheetId = spreadsheetUrl.trim()
    const urlMatch = spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
    if (urlMatch) spreadsheetId = urlMatch[1]
    updates.spreadsheet_id = spreadsheetId
  }

  const admin = getAdmin()
  const { data, error } = await admin
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
