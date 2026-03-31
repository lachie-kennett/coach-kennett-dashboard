import { getSheetValues } from './client'

export interface PerformanceTest {
  name: string
  category: string
  dates: string[]
  values: (number | null)[]
  latest: number | null
  unit: string
}

const CATEGORIES = [
  'Speed & Acceleration',
  'Jumping & Explosive Power',
  'Strength',
  'Aerobic Endurance',
]

// Lower is better for these tests
const LOWER_IS_BETTER = ['10 m Sprint', '20 m Sprint', '50 m Sprint']

export async function parsePerformanceSheet(spreadsheetId: string): Promise<PerformanceTest[]> {
  const values = await getSheetValues(spreadsheetId, '⚡️ Performance Testing!A1:J40')
  if (!values || values.length < 3) return []

  // Row 1 (index 0) = headers, row 2 = "Latest Date" + dates
  const dateRow = values[1] ?? []
  const dates = dateRow.slice(2).filter(Boolean) // columns C onwards

  const tests: PerformanceTest[] = []
  let currentCategory = ''

  for (let i = 2; i < values.length; i++) {
    const row = values[i]
    if (!row || row.length === 0) continue

    const label = row[1]?.trim() ?? ''
    if (!label) continue

    if (CATEGORIES.includes(label)) {
      currentCategory = label
      continue
    }

    // It's a test row
    const rawValues = row.slice(2)
    const numericValues: (number | null)[] = rawValues.map(v => {
      const n = parseFloat(v)
      return isNaN(n) ? null : n
    })

    const validValues = numericValues.filter(v => v !== null) as number[]
    const latest = validValues.length > 0 ? validValues[validValues.length - 1] : null

    // Derive unit from test name
    let unit = ''
    if (label.includes('Sprint')) unit = 's'
    else if (label.includes('Jump') || label.includes('Broad') || label.includes('Triple')) unit = 'm'
    else if (label.includes('1RM')) unit = 'kg'
    else if (label.includes('VO')) unit = 'mL/kg/min'
    else if (label.includes('Yo-Yo') || label.includes('Cooper') || label.includes('Yo')) unit = 'm'
    else if (label.includes('time trial')) unit = 'min'

    tests.push({
      name: label,
      category: currentCategory,
      dates: dates.slice(0, rawValues.length),
      values: numericValues,
      latest,
      unit,
    })
  }

  return tests
}

export function computePerformanceScore(tests: PerformanceTest[]): number {
  // Simple composite: percentage of tests with data
  const withData = tests.filter(t => t.latest !== null).length
  return tests.length > 0 ? Math.round((withData / tests.length) * 100) : 0
}
