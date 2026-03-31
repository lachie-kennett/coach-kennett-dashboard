import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { parseTrackingSheet, computeAdherenceStats } from '@/lib/sheets/parseTracking'
import { parsePerformanceSheet } from '@/lib/sheets/parsePerformance'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Exclude coaches from the leaderboard
  const { data: clients } = await admin.from('clients').select('*').eq('is_coach', false)
  if (!clients) return NextResponse.json([])

  const leaderboard = await Promise.all(
    clients.map(async (client) => {
      try {
        const [months, performanceTests] = await Promise.all([
          parseTrackingSheet(client.spreadsheet_id),
          parsePerformanceSheet(client.spreadsheet_id),
        ])
        const stats = computeAdherenceStats(months)

        // Key performance metrics for leaderboard
        const sprint10 = performanceTests.find(t => t.name === '10 m Sprint')?.latest
        const cmj = performanceTests.find(t => t.name === 'Countermovement Jump (CMJ)')?.latest
        const squat = performanceTests.find(t => t.name === '1RM Back Squat')?.latest
        const vo2 = performanceTests.find(t => t.name === 'VO₂ max test')?.latest

        return {
          id: client.id,
          name: client.name,
          adherencePercent: stats.adherencePercent,
          totalPoints: stats.totalPoints,
          totalSessions: stats.totalSessions,
          trackedDays: stats.trackedDays,
          currentStreak: stats.currentStreak,
          sprint10,
          cmj,
          squat,
          vo2,
          isCurrentUser: client.id === user.id,
        }
      } catch {
        return {
          id: client.id,
          name: client.name,
          adherencePercent: 0,
          totalPoints: 0,
          totalSessions: 0,
          trackedDays: 0,
          currentStreak: 0,
          sprint10: null,
          cmj: null,
          squat: null,
          vo2: null,
          isCurrentUser: client.id === user.id,
        }
      }
    })
  )

  // Sort by adherence desc
  leaderboard.sort((a, b) => b.adherencePercent - a.adherencePercent)

  return NextResponse.json(leaderboard)
}
