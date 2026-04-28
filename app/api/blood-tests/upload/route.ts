import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()

  const { data: profile } = await admin.from('clients').select('id, name, is_coach').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const testDate = formData.get('testDate') as string | null
  const clientIdOverride = formData.get('clientId') as string | null

  // Coach can upload on behalf of a client by passing clientId
  const isCoach = profile.is_coach === true
  const targetClientId = (isCoach && clientIdOverride) ? clientIdOverride : user.id

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Validate file type
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  if (!allowed.includes(file.type) && !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be a PDF or image' }, { status: 400 })
  }

  // Validate file size (20MB max)
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 20MB' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Sanitise filename
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${targetClientId}/${Date.now()}-${safeName}`

  const { error: uploadError } = await admin.storage
    .from('blood-tests')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: record, error: dbError } = await admin
    .from('blood_tests')
    .insert({
      client_id: targetClientId,
      file_path: storagePath,
      file_name: file.name,
      file_type: file.type,
      test_date: testDate || null,
      status: 'pending',
    })
    .select()
    .single()

  if (dbError) {
    // Clean up orphaned storage file
    await admin.storage.from('blood-tests').remove([storagePath])
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json(record, { status: 201 })
}
