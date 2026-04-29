import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getAdmin() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function requireCoach() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getAdmin()
  const { data: profile } = await admin.from('clients').select('is_coach').eq('id', user.id).single()
  return profile?.is_coach ? user : null
}

async function getValidToken(): Promise<{ access_token: string; tenant_id: string } | null> {
  const admin = getAdmin()
  const { data: row } = await admin.from('xero_tokens').select('*').eq('id', 1).single()
  if (!row) return null

  // Refresh if expired or expiring in next 5 minutes
  const expiresAt = new Date(row.expires_at).getTime()
  if (expiresAt - Date.now() < 5 * 60 * 1000) {
    const res = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: row.refresh_token,
      }),
    })
    if (!res.ok) return null
    const tokens = await res.json()
    await admin.from('xero_tokens').upsert({
      id: 1,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      tenant_id: row.tenant_id,
      updated_at: new Date().toISOString(),
    })
    return { access_token: tokens.access_token, tenant_id: row.tenant_id }
  }

  return { access_token: row.access_token, tenant_id: row.tenant_id }
}

export async function GET() {
  const user = await requireCoach()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = await getValidToken()
  if (!token) return NextResponse.json({ connected: false }, { status: 200 })

  const xeroHeaders = {
    Authorization: `Bearer ${token.access_token}`,
    'Xero-Tenant-Id': token.tenant_id,
    Accept: 'application/json',
  }

  // Fetch P&L report in yearly chunks (Xero limits to 365 days per request)
  async function fetchPnL(fromDate: string, toDate: string) {
    const res = await fetch(
      `https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss?fromDate=${fromDate}&toDate=${toDate}&timeframe=MONTH`,
      { headers: xeroHeaders }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.Reports?.[0] ?? null
  }

  function extractIncome(report: Record<string, unknown>): { month: string; actual: number }[] {
    const allHeaders: string[] = ((report.Rows as {Cells: {Value: string}[]}[])?.[0]?.Cells ?? [])
      .slice(1).map(c => c.Value)
    // Log headers to debug format
    console.log('Xero P&L headers:', allHeaders)
    // Keep only month columns — format like "Jan-25" or "Jan 25", skip totals like "31 Dec 25"
    const monthRegex = /^[A-Za-z]{3}[-\s]\d{2}$/
    const validIndices = allHeaders.map((h, i) => ({ h: h.replace('-', ' '), i })).filter(({ h }) => monthRegex.test(h))

    let incomeValues: number[] | null = null
    for (const section of (report.Rows as {RowType: string; Title: string; Rows: {RowType: string; Cells: {Value: string}[]}[]}[]) ?? []) {
      if (section.RowType === 'Section' && section.Title?.toLowerCase().includes('income')) {
        for (const row of section.Rows ?? []) {
          if (row.RowType === 'SummaryRow') {
            incomeValues = (row.Cells ?? []).slice(1).map(c => Math.abs(parseFloat(c.Value) || 0))
            break
          }
        }
      }
      if (incomeValues) break
    }
    if (!incomeValues) return []
    return validIndices
      .map(({ h, i }) => ({ month: h, actual: Math.round(incomeValues![i] ?? 0) }))
      .filter(d => d.actual > 0)
  }

  const now = new Date()
  const ranges = [
    { from: `${now.getFullYear() - 2}-01-01`, to: `${now.getFullYear() - 2}-12-31` },
    { from: `${now.getFullYear() - 1}-01-01`, to: `${now.getFullYear() - 1}-12-31` },
    { from: `${now.getFullYear()}-01-01`, to: now.toISOString().split('T')[0] },
  ]

  const results = await Promise.all(ranges.map(r => fetchPnL(r.from, r.to)))
  const allData = results.flatMap(r => r ? extractIncome(r) : [])

  // Deduplicate and sort
  const byMonth: Record<string, number> = {}
  for (const d of allData) byMonth[d.month] = (byMonth[d.month] ?? 0) + d.actual
  const chartData = Object.entries(byMonth)
    .sort(([a], [b]) => new Date(`01 ${a}`).getTime() - new Date(`01 ${b}`).getTime())
    .map(([month, actual]) => ({ month, actual }))

  return NextResponse.json({ connected: true, chartData, invoices: chartData.length })
}
