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

  // Fetch paid invoices from the last 24 months
  const since = new Date()
  since.setMonth(since.getMonth() - 24)
  const dateStr = since.toISOString().split('T')[0]

  const res = await fetch(
    `https://api.xero.com/api.xro/2.0/Invoices?Statuses=PAID&ModifiedAfter=${dateStr}&order=FullyPaidOnDate ASC`,
    {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Xero-Tenant-Id': token.tenant_id,
        Accept: 'application/json',
      },
    }
  )

  if (!res.ok) {
    console.error('Xero invoices fetch failed', await res.text())
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }

  const data = await res.json()
  const invoices = (data.Invoices ?? []) as {
    AmountPaid: number
    FullyPaidOnDate: string
    Contact: { Name: string }
    InvoiceNumber: string
  }[]

  // Group by month
  const byMonth: Record<string, number> = {}
  for (const inv of invoices) {
    if (!inv.FullyPaidOnDate) continue
    // Xero date format: /Date(1234567890000+0000)/
    const ms = parseInt(inv.FullyPaidOnDate.replace(/\/Date\((\d+)[^)]*\)\//, '$1'))
    const d = new Date(ms)
    const key = d.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
    byMonth[key] = (byMonth[key] ?? 0) + inv.AmountPaid
  }

  const chartData = Object.entries(byMonth).map(([month, actual]) => ({
    month,
    actual: Math.round(actual),
  }))

  return NextResponse.json({ connected: true, chartData, invoices: invoices.length })
}
