import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { parseMealPlanSheet } from '@/lib/sheets/parseMealPlan'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const requestedId = request.nextUrl.searchParams.get('clientId')
  const { data: profile } = await admin.from('clients').select('is_coach').eq('id', user.id).single()
  const isCoach = profile?.is_coach === true
  const targetId = (isCoach && requestedId) ? requestedId : user.id

  const { data: client } = await admin.from('clients').select('*').eq('id', targetId).single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const days = await parseMealPlanSheet(client.spreadsheet_id)
  return NextResponse.json({ days, client })
}
