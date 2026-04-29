import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sheetsGet } from '@/lib/google-sheets'

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

function parseRate(val: string): number {
  const n = parseFloat(val.replace(/[$,\s]/g, ''))
  return isNaN(n) ? 0 : n
}

function parseDate(val: string): Date | null {
  if (!val) return null
  // Try DD/MM/YYYY
  const dmy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
  // Try ISO or other formats
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

export async function GET() {
  const user = await requireCoach()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sheetId = process.env.GOOGLE_CRM_SHEET_ID!
  const sheetName = process.env.GOOGLE_CRM_SHEET_NAME ?? '🟢 Active Clients'

  const res = await sheetsGet(sheetId, `${sheetName}!A:AZ`)
  const rows = res.values ?? []
  if (rows.length < 3) return NextResponse.json({ clients: [], chartData: [], totalWeekly: 0, totalMonthly: 0 })

  // Row 2 (index 1) is column headers
  const headers = (rows[1] as string[]).map(h => h?.toString() ?? '')

  const cols = {
    firstName:  findCol(headers, 'first name', 'firstname'),
    lastName:   findCol(headers, 'last name', 'lastname'),
    weeklyRate: findCol(headers, '$ / week', '$/week', '$ per week', 'per week', 'weekly rate'),
    startDate:  findCol(headers, 'start date'),
    weeksTo:    findCol(headers, 'weeks together'),
    lifetime:   findCol(headers, 'lifetime value'),
  }

  const clients = (rows.slice(5) as string[][])
    .map(row => {
      const get = (i: number) => (i >= 0 ? row[i]?.toString().trim() ?? '' : '')
      const firstName = get(cols.firstName)
      const lastName = get(cols.lastName)
      const name = [firstName, lastName].filter(Boolean).join(' ')
      if (!name) return null
      const weeklyRate = parseRate(get(cols.weeklyRate))
      const startDate = parseDate(get(cols.startDate))
      const weeksTo = parseFloat(get(cols.weeksTo)) || 0
      const lifetime = parseRate(get(cols.lifetime))
      return { name, weeklyRate, startDate: startDate?.toISOString() ?? null, weeksTo, lifetime }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null && c.weeklyRate > 0)

  const totalWeekly = clients.reduce((sum, c) => sum + c.weeklyRate, 0)
  const totalMonthly = totalWeekly * 4.33

  // Build monthly revenue chart from start dates
  const withDates = clients.filter(c => c.startDate)
  let chartData: { month: string; revenue: number }[] = []

  if (withDates.length > 0) {
    const dates = withDates.map(c => new Date(c.startDate!).getTime())
    const earliest = new Date(Math.min(...dates))
    const now = new Date()

    let cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1)
    while (cursor <= now) {
      const endOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
      const revenue = withDates
        .filter(c => new Date(c.startDate!) <= endOfMonth)
        .reduce((sum, c) => sum + c.weeklyRate * 4.33, 0)

      chartData.push({
        month: cursor.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
        revenue: Math.round(revenue),
      })
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    }
  }

  return NextResponse.json({ clients, chartData, totalWeekly: Math.round(totalWeekly * 100) / 100, totalMonthly: Math.round(totalMonthly * 100) / 100 })
}
