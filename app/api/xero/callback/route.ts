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
    const desc = searchParams.get('error_description') ?? error ?? 'unknown'
    console.error('Xero auth error:', error, desc)
    return NextResponse.redirect(`https://coach-kennett-dashboard.vercel.app/revenue?xero=error&msg=${encodeURIComponent(desc)}`)
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

  const tokenText = await tokenRes.text()
  if (!tokenRes.ok) {
    console.error('Xero token exchange failed', tokenRes.status, tokenText)
    return NextResponse.redirect(`https://coach-kennett-dashboard.vercel.app/revenue?xero=error&msg=${encodeURIComponent(`token_exchange_${tokenRes.status}: ${tokenText.slice(0, 200)}`)}`)
  }

  const tokens = JSON.parse(tokenText)

  // Get tenant (organisation) ID
  const connRes = await fetch('https://api.xero.com/connections', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (!connRes.ok) {
    const ct = await connRes.text()
    console.error('Xero connections fetch failed', connRes.status, ct)
    return NextResponse.redirect(`https://coach-kennett-dashboard.vercel.app/revenue?xero=error&msg=${encodeURIComponent(`connections_${connRes.status}: ${ct.slice(0, 200)}`)}`)
  }
  const connections = await connRes.json()
  const tenantId = connections[0]?.tenantId ?? null
  if (!tenantId) {
    console.error('Xero: no tenantId in connections', connections)
    return NextResponse.redirect(`https://coach-kennett-dashboard.vercel.app/revenue?xero=error&msg=${encodeURIComponent('no_tenant_found')}`)
  }

  const admin = getAdmin()
  const { error: upsertError } = await admin.from('xero_tokens').upsert({
    id: 1,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    tenant_id: tenantId,
    updated_at: new Date().toISOString(),
  })

  if (upsertError) {
    console.error('Xero: failed to save tokens to DB', upsertError)
    return NextResponse.redirect(`https://coach-kennett-dashboard.vercel.app/revenue?xero=error&msg=${encodeURIComponent(`db_error: ${upsertError.message}`)}`)
  }

  return NextResponse.redirect(`https://coach-kennett-dashboard.vercel.app/revenue?xero=connected`)
}
