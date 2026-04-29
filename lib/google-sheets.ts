function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN[^-]+-----/, '')
    .replace(/-----END[^-]+-----/, '')
    .replace(/\s+/g, '')
  return Uint8Array.from(Buffer.from(b64, 'base64'))
}

async function getAccessToken(scopes: string[]): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!
  const rawKey = process.env.GOOGLE_PRIVATE_KEY_B64
    ? Buffer.from(process.env.GOOGLE_PRIVATE_KEY_B64, 'base64').toString('utf-8')
    : (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss: email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const headerB64 = Buffer.from('{"alg":"RS256","typ":"JWT"}').toString('base64url')
  const claimB64 = Buffer.from(JSON.stringify(claim)).toString('base64url')
  const input = `${headerB64}.${claimB64}`

  // Use Web Crypto API to avoid OpenSSL 3 compatibility issues
  const subtle = globalThis.crypto.subtle
  const cryptoKey = await subtle.importKey(
    'pkcs8',
    pemToDer(rawKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBuffer = await subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, Buffer.from(input))
  const sig = Buffer.from(signatureBuffer).toString('base64url')

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${input}.${sig}`,
    }),
  })

  if (!tokenRes.ok) throw new Error(`Google token exchange failed: ${await tokenRes.text()}`)
  const { access_token } = await tokenRes.json()
  return access_token as string
}

export async function sheetsGet(spreadsheetId: string, range: string) {
  const token = await getAccessToken(['https://www.googleapis.com/auth/spreadsheets.readonly'])
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Sheets get failed: ${await res.text()}`)
  return res.json() as Promise<{ values?: string[][] }>
}

export async function sheetsAppend(spreadsheetId: string, range: string, values: unknown[][]) {
  const token = await getAccessToken(['https://www.googleapis.com/auth/spreadsheets'])
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
  if (!res.ok) throw new Error(`Sheets append failed: ${await res.text()}`)
  return res.json()
}
