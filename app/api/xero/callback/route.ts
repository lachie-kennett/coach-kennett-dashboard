import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getAdmin() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${process.env.XERO_REDIRECT_URI?.replace('/api/xero/callback', '')}/revenue?xero=error`)
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.XERO_REDIRECT_URI!,
    }),
  })

  if (!tokenRes.ok) {
    console.error('Xero token exchange failed', await tokenRes.text())
    return NextResponse.redirect(`https://coach-kennett-dashboard.vercel.app/revenue?xero=error`)
  }

  const tokens = await tokenRes.json()

  // Get tenant (organisation) ID
  const connRes = await fetch('https://api.xero.com/connections', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const connections = await connRes.json()
  const tenantId = connections[0]?.tenantId ?? null

  const admin = getAdmin()
  await admin.from('xero_tokens').upsert({
    id: 1,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    tenant_id: tenantId,
    updated_at: new Date().toISOString(),
  })

  return NextResponse.redirect(`https://coach-kennett-dashboard.vercel.app/revenue?xero=connected`)
}
