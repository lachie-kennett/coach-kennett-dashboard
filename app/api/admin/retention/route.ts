import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { parseTrackingSheet, computeAdherenceStats } from '@/lib/sheets/parseTracking'

export interface RetentionClient {
  id: string
  name: string
  daysAsMember: number
  daysInZone: number
  daysRemainingInZone: number
  packageEndDate: string | null
  adherencePercent: number
  currentStreak: number
  zones: ('buyersRemorse' | 'plateau' | 'packageEnd')[]
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
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
    .select('id, name, spreadsheet_id, created_at, package_end_date')
    .eq('is_coach', false)

  if (!clients) return NextResponse.json({ zones: { buyersRemorse: [], plateau: [], packageEnd: [] }, counts: { buyersRemorse: 0, plateau: 0, packageEnd: 0, total: 0 } })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const results: RetentionClient[] = await Promise.all(
    clients.map(async (client) => {
      const startDate = new Date(client.created_at)
      startDate.setHours(0, 0, 0, 0)
      const daysAsMember = daysBetween(startDate, today)

      let adherencePercent = 0
      let currentStreak = 0

      try {
        const months = await parseTrackingSheet(client.spreadsheet_id)
        const stats = computeAdherenceStats(months)
        adherencePercent = stats.adherencePercent
        currentStreak = stats.currentStreak
      } catch {
        // Sheet unreadable — use defaults
      }

      const zones: RetentionClient['zones'] = []
      let daysInZone = 0
      let daysRemainingInZone = 0

      // Zone 1: Buyer's Remorse — Week 2-3 (days 14–21)
      if (daysAsMember >= 14 && daysAsMember <= 21) {
        zones.push('buyersRemorse')
        daysInZone = daysAsMember - 14 + 1
        daysRemainingInZone = 21 - daysAsMember
      }

      // Zone 2: The Plateau — Month 2-3 (days 60–90)
      if (daysAsMember >= 60 && daysAsMember <= 90) {
        zones.push('plateau')
        daysInZone = daysAsMember - 60 + 1
        daysRemainingInZone = 90 - daysAsMember
      }

      // Zone 3: Package End — within 14 days of package_end_date
      if (client.package_end_date) {
        const endDate = new Date(client.package_end_date)
        endDate.setHours(0, 0, 0, 0)
        const daysUntilEnd = daysBetween(today, endDate)
        if (daysUntilEnd >= 0 && daysUntilEnd <= 14) {
          zones.push('packageEnd')
          daysInZone = 14 - daysUntilEnd
          daysRemainingInZone = daysUntilEnd
        }
      }

      return {
        id: client.id,
        name: client.name,
        daysAsMember,
        daysInZone,
        daysRemainingInZone,
        packageEndDate: client.package_end_date ?? null,
        adherencePercent,
        currentStreak,
        zones,
      }
    })
  )

  // Only return clients actually in a danger zone
  const atRisk = results.filter(c => c.zones.length > 0)

  const buyersRemorse = atRisk.filter(c => c.zones.includes('buyersRemorse'))
  const plateau = atRisk.filter(c => c.zones.includes('plateau'))
  const packageEnd = atRisk.filter(c => c.zones.includes('packageEnd'))

  return NextResponse.json({
    zones: { buyersRemorse, plateau, packageEnd },
    counts: {
      buyersRemorse: buyersRemorse.length,
      plateau: plateau.length,
      packageEnd: packageEnd.length,
      total: atRisk.length,
    },
  })
}
