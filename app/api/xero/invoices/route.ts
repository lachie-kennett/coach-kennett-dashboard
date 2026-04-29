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

  // Single call: current month + 11 comparison months = 12 months of monthly data (Xero max periods=11)
  const now = new Date()
  const fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const toDate = now.toISOString().split('T')[0]

  const res = await fetch(
    `https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss?fromDate=${fromDate}&toDate=${toDate}&periods=11&timeframe=MONTH`,
    { headers: xeroHeaders }
  )

  if (!res.ok) {
    console.error('Xero P&L fetch failed', await res.text())
    return NextResponse.json({ error: 'Failed to fetch P&L report' }, { status: 500 })
  }

  const data = await res.json()
  const report = data.Reports?.[0]
  if (!report) return NextResponse.json({ connected: true, chartData: [], invoices: 0 })

  // Headers are "DD Mon YY" end-of-period dates e.g. "29 Apr 26", "31 Mar 26"
  const allHeaders: string[] = ((report.Rows as {Cells: {Value: string}[]}[])?.[0]?.Cells ?? [])
    .slice(1).map(c => c.Value)

  // Convert "DD Mon YY" → "Mon YY" for chart labels
  const monthHeaders = allHeaders.map(h => {
    const parts = h.split(' ')
    return parts.length === 3 ? `${parts[1]} ${parts[2]}` : h
  })

  // Find Total Income summary row
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

  if (!incomeValues) return NextResponse.json({ connected: true, chartData: [], invoices: 0 })

  // Xero returns most recent first — reverse to get chronological order
  const chartData = monthHeaders
    .map((month, i) => ({ month, actual: Math.round(incomeValues![i] ?? 0) }))
    .filter(d => d.actual > 0)
    .reverse()

  return NextResponse.json({ connected: true, chartData, invoices: chartData.length })
}
