import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { parseTrackingSheet, computeAdherenceStats, getLastLoggedDate } from '@/lib/sheets/parseTracking'

export interface NudgeClient {
  id: string
  name: string
  whatsappNumber: string | null
  lastLoggedDate: string | null
  daysSinceLog: number
  adherencePercent: number
  currentStreak: number
  urgency: 'critical' | 'warning'
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await admin.from('clients').select('is_coach').eq('id', user.id).single()
  if (!profile?.is_coach) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: clients } = await admin
    .from('clients')
    .select('id, name, spreadsheet_id, whatsapp_number')
    .eq('is_coach', false)

  if (!clients) return NextResponse.json([])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const results: NudgeClient[] = await Promise.all(
    clients.map(async (client) => {
      try {
        const months = await parseTrackingSheet(client.spreadsheet_id)
        const stats = computeAdherenceStats(months)
        const lastLoggedDate = getLastLoggedDate(months)

        let daysSinceLog = 999
        if (lastLoggedDate) {
          const last = new Date(lastLoggedDate)
          last.setHours(0, 0, 0, 0)
          daysSinceLog = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
        }

        return {
          id: client.id,
          name: client.name,
          whatsappNumber: client.whatsapp_number ?? null,
          lastLoggedDate,
          daysSinceLog,
          adherencePercent: stats.adherencePercent,
          currentStreak: stats.currentStreak,
          urgency: daysSinceLog >= 5 ? 'critical' : 'warning',
        } as NudgeClient
      } catch {
        return {
          id: client.id,
          name: client.name,
          whatsappNumber: client.whatsapp_number ?? null,
          lastLoggedDate: null,
          daysSinceLog: 999,
          adherencePercent: 0,
          currentStreak: 0,
          urgency: 'critical',
        } as NudgeClient
      }
    })
  )

  // Only return clients who haven't logged in 3+ days
  const needsNudge = results
    .filter(c => c.daysSinceLog >= 3)
    .sort((a, b) => b.daysSinceLog - a.daysSinceLog)

  return NextResponse.json(needsNudge)
}
