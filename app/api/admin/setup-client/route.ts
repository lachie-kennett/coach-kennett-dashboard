import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClientFolder, copyTemplateSheet, shareWithCoach } from '@/lib/drive/client'

// Required env vars:
// GOOGLE_CLIENTS_FOLDER_ID — Google Drive folder ID where all client folders live
// GOOGLE_TEMPLATE_SHEET_ID — Sheet ID of the tracker template to copy
// COACH_GOOGLE_EMAIL — coach's Google account to share files with (e.g. lachie@coachkennett.com)

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: profile } = await admin.from('clients').select('is_coach').eq('id', user.id).single()
  if (!profile?.is_coach) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { clientId } = await request.json()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const clientsFolderId = process.env.GOOGLE_CLIENTS_FOLDER_ID
  const templateSheetId = process.env.GOOGLE_TEMPLATE_SHEET_ID
  const coachEmail = process.env.COACH_GOOGLE_EMAIL

  if (!clientsFolderId || !templateSheetId || !coachEmail) {
    return NextResponse.json({
      error: 'Missing env vars: GOOGLE_CLIENTS_FOLDER_ID, GOOGLE_TEMPLATE_SHEET_ID, COACH_GOOGLE_EMAIL'
    }, { status: 500 })
  }

  const { data: client } = await admin.from('clients').select('id, name').eq('id', clientId).single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  try {
    // 1. Create client folder in Google Drive
    const folder = await createClientFolder(client.name, clientsFolderId)

    // 2. Copy template tracker sheet into the folder
    const sheet = await copyTemplateSheet(templateSheetId, client.name, folder.id)

    // 3. Share both with the coach's Google account
    await shareWithCoach(folder.id, coachEmail)
    await shareWithCoach(sheet.id, coachEmail)

    // 4. Save the sheet ID and folder URL to Supabase
    await admin.from('clients').update({
      spreadsheet_id: sheet.id,
      drive_folder_url: folder.url,
      step_tracker_created: true,
    }).eq('id', clientId)

    return NextResponse.json({
      success: true,
      sheetId: sheet.id,
      sheetUrl: sheet.url,
      folderUrl: folder.url,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Drive API error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
