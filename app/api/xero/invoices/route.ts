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

  // Use P&L report to capture all income regardless of payment method
  const fromDate = '2022-01-01'
  const toDate = new Date().toISOString().split('T')[0]

  const res = await fetch(
    `https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss?fromDate=${fromDate}&toDate=${toDate}&periods=36&timeframe=MONTH`,
    {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Xero-Tenant-Id': token.tenant_id,
        Accept: 'application/json',
      },
    }
  )

  if (!res.ok) {
    const errText = await res.text()
    console.error('Xero P&L fetch failed', errText)
    return NextResponse.json({ error: 'Failed to fetch P&L report' }, { status: 500 })
  }

  const data = await res.json()
  const report = data.Reports?.[0]
  if (!report) return NextResponse.json({ connected: true, chartData: [], invoices: 0 })

  // Extract column headers (months) from the report
  const headers: string[] = (report.Rows?.[0]?.Cells ?? []).map((c: { Value: string }) => c.Value).slice(1)

  // Find the "Total Income" or "Income" row
  let incomeRow: number[] | null = null
  for (const section of report.Rows ?? []) {
    if (section.RowType === 'Section' && section.Title?.toLowerCase().includes('income')) {
      for (const row of section.Rows ?? []) {
        if (row.RowType === 'SummaryRow') {
          incomeRow = (row.Cells ?? []).slice(1).map((c: { Value: string }) => parseFloat(c.Value) || 0)
          break
        }
      }
    }
    if (incomeRow) break
  }

  if (!incomeRow) return NextResponse.json({ connected: true, chartData: [], invoices: 0 })

  const chartData = headers
    .map((month, i) => ({
      month,
      actual: Math.round(Math.abs(incomeRow![i] ?? 0)),
    }))
    .filter(d => d.actual > 0)

  return NextResponse.json({ connected: true, chartData, invoices: chartData.length })
}
