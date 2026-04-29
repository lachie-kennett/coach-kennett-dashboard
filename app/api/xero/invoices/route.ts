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

  // Fetch all accounts receivable payments (captures Pay Advantage + invoice payments)
  const res = await fetch(
    `https://api.xero.com/api.xro/2.0/Payments?PaymentType=ACCRECPAYMENT`,
    {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Xero-Tenant-Id': token.tenant_id,
        Accept: 'application/json',
      },
    }
  )

  if (!res.ok) {
    console.error('Xero payments fetch failed', await res.text())
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }

  const data = await res.json()
  const payments = (data.Payments ?? []) as {
    Amount: number
    Date: string
    Status: string
  }[]

  const byMonth: Record<string, number> = {}
  for (const p of payments) {
    if (!p.Date || !p.Amount || p.Status === 'DELETED') continue
    let d: Date
    const dotNet = p.Date.match(/\/Date\((\d+)/)
    if (dotNet) {
      d = new Date(parseInt(dotNet[1]))
    } else {
      d = new Date(p.Date)
    }
    if (isNaN(d.getTime())) continue
    const key = `${d.toLocaleString('en-AU', { month: 'short' })} ${String(d.getFullYear()).slice(-2)}`
    byMonth[key] = (byMonth[key] ?? 0) + p.Amount
  }

  const chartData = Object.entries(byMonth)
    .sort(([a], [b]) => new Date(`01 ${a}`).getTime() - new Date(`01 ${b}`).getTime())
    .map(([month, actual]) => ({ month, actual: Math.round(actual) }))
    .filter(d => d.actual > 0)

  return NextResponse.json({ connected: true, chartData, invoices: payments.length })
}
