import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  return google.sheets({ version: 'v4', auth })
}

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function requireCoach() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getAdmin()
  const { data: profile } = await admin.from('clients').select('is_coach').eq('id', user.id).single()
  if (!profile?.is_coach) return null
  return user
}

function findCol(headers: string[], ...terms: string[]): number {
  return headers.findIndex(h =>
    terms.some(t => h.toLowerCase().includes(t.toLowerCase()))
  )
}

function parseBoolean(val: string | undefined): boolean {
  if (!val) return false
  return ['yes', 'true', '1', 'x', '✓', '✔', 'sent', 'signed', 'done'].includes(val.toLowerCase().trim())
}

export async function GET() {
  const user = await requireCoach()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sheetId = process.env.GOOGLE_CRM_SHEET_ID!
  const sheetName = process.env.GOOGLE_CRM_SHEET_NAME ?? '🟢 Active Clients'
  const sheets = getSheetsClient()

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:AZ`,
  })

  const rows = res.data.values ?? []
  if (rows.length < 3) return NextResponse.json([])

  // Row 1 is section labels, row 2 is actual column headers
  const headers = (rows[1] as string[]).map(h => h?.toString() ?? '')

  const cols = {
    firstName:          findCol(headers, 'first name', 'firstname'),
    lastName:           findCol(headers, 'last name', 'lastname'),
    mobile:             findCol(headers, 'mobile', 'phone', 'whatsapp'),
    birthday:           findCol(headers, 'birthday', 'dob', 'date of birth'),
    email:              findCol(headers, 'email'),
    tcSigned:           findCol(headers, 't&c agreement signed', 'terms signed', 'tc signed'),
    expectSigned:       findCol(headers, 'expectation doc signed', 'expectations signed'),
    startDate:          findCol(headers, 'start date'),
    offerType:          findCol(headers, 'offer type', 'package type'),
    weeklyRate:         findCol(headers, '$ per week', 'per week', 'weekly rate', 'weekly'),
  }

  // Get existing emails to mark already-imported contacts
  const admin = getAdmin()
  const { data: existing } = await admin.from('clients').select('email')
  const existingEmails = new Set((existing ?? []).map(c => c.email?.toLowerCase()))

  const contacts = (rows.slice(5) as string[][])
    .map(row => {
      const get = (i: number) => (i >= 0 ? row[i]?.toString().trim() ?? '' : '')
      const firstName = get(cols.firstName)
      const lastName = get(cols.lastName)
      const email = get(cols.email)
      if (!email) return null
      return {
        firstName,
        lastName,
        name: [firstName, lastName].filter(Boolean).join(' '),
        mobile: get(cols.mobile),
        birthday: get(cols.birthday),
        email,
        tcSigned: parseBoolean(get(cols.tcSigned)),
        expectationsSigned: parseBoolean(get(cols.expectSigned)),
        startDate: get(cols.startDate),
        offerType: get(cols.offerType),
        weeklyRate: get(cols.weeklyRate),
        alreadyImported: existingEmails.has(email.toLowerCase()),
      }
    })
    .filter(Boolean)

  return NextResponse.json(contacts)
}
