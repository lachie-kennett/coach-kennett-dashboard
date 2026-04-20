import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { parseBloodsSheet } from '@/lib/sheets/parseBloods'

export interface ClientBloodSummary {
  id: string
  name: string
  criticalCount: number    // outside standard range (low or high)
  suboptimalCount: number  // below_optimal or above_optimal
  optimalCount: number
  noDataCount: number
  totalMarkers: number
  lastUpdated: string | null
  status: 'critical' | 'suboptimal' | 'optimal' | 'no_data'
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
    .select('id, name, spreadsheet_id')
    .eq('is_coach', false)

  if (!clients) return NextResponse.json([])

  const results: ClientBloodSummary[] = await Promise.all(
    clients.map(async (client) => {
      try {
        const markers = await parseBloodsSheet(client.spreadsheet_id)

        let criticalCount = 0
        let suboptimalCount = 0
        let optimalCount = 0
        let noDataCount = 0

        for (const marker of markers) {
          if (marker.status === 'low' || marker.status === 'high') criticalCount++
          else if (marker.status === 'below_optimal' || marker.status === 'above_optimal') suboptimalCount++
          else if (marker.status === 'optimal') optimalCount++
          else noDataCount++
        }

        const status: ClientBloodSummary['status'] =
          criticalCount > 0 ? 'critical' :
          suboptimalCount > 0 ? 'suboptimal' :
          optimalCount > 0 ? 'optimal' : 'no_data'

        return {
          id: client.id,
          name: client.name,
          criticalCount,
          suboptimalCount,
          optimalCount,
          noDataCount,
          totalMarkers: markers.length,
          lastUpdated: null,
          status,
        }
      } catch {
        return {
          id: client.id,
          name: client.name,
          criticalCount: 0,
          suboptimalCount: 0,
          optimalCount: 0,
          noDataCount: 0,
          totalMarkers: 0,
          lastUpdated: null,
          status: 'no_data' as const,
        }
      }
    })
  )

  // Sort: critical first, then suboptimal, then optimal, then no_data
  const order = { critical: 0, suboptimal: 1, optimal: 2, no_data: 3 }
  results.sort((a, b) => order[a.status] - order[b.status])

  return NextResponse.json(results)
}
