import { getSheetValues } from './client'

export interface BloodMarker {
  name: string
  category: string
  standardMin: number
  standardMax: number
  optimalMin: number
  optimalMax: number
  unit: string
  values: (number | null)[]  // up to 15 test results
  dates: string[]
  latest: number | null
  status: 'low' | 'below_optimal' | 'optimal' | 'above_optimal' | 'high' | 'no_data'
}

const CATEGORY_HEADERS = [
  'Complete Blood Count',
  'Metabolic Markers',
  'Lipids',
  'Iron Studies',
  'Thyroid Markers',
  'Hormones',
  'Nutrients',
  'MISC',
  'GI MAP',
]

function classifyStatus(
  value: number,
  stdMin: number,
  stdMax: number,
  optMin: number,
  optMax: number
): BloodMarker['status'] {
  if (value < stdMin) return 'low'
  if (value < optMin) return 'below_optimal'
  if (value <= optMax) return 'optimal'
  if (value <= stdMax) return 'above_optimal'
  return 'high'
}

export async function parseBloodsSheet(spreadsheetId: string): Promise<BloodMarker[]> {
  const values = await getSheetValues(spreadsheetId, '🩸Bloods!A1:V300')
  if (!values) return []

  const markers: BloodMarker[] = []
  let currentCategory = ''

  for (let i = 0; i < values.length; i++) {
    const row = values[i]
    if (!row || row.length === 0) continue

    const col1 = row[1]?.trim() ?? ''

    // Category header
    if (CATEGORY_HEADERS.includes(col1)) {
      currentCategory = col1
      continue
    }

    // Marker row: col1 = name, col2 = stdMin, col3 = optMin, col4 = optMax, col5 = stdMax, col6 = unit
    // Test values start at col7 (index 7)
    const stdMin = parseFloat(row[2] ?? '')
    const optMin = parseFloat(row[3] ?? '')
    const optMax = parseFloat(row[4] ?? '')
    const stdMax = parseFloat(row[5] ?? '')
    const unit = row[6]?.trim() ?? ''

    if (!col1 || isNaN(stdMin) || isNaN(stdMax)) continue

    // Test values: columns 7-21 (indices 7..21)
    const rawValues = row.slice(7, 22)
    const numericValues: (number | null)[] = rawValues.map(v => {
      const n = parseFloat(v)
      return isNaN(n) ? null : n
    })

    const validValues = numericValues.filter(v => v !== null) as number[]
    const latest = validValues.length > 0 ? validValues[validValues.length - 1] : null

    const status = latest !== null
      ? classifyStatus(latest, stdMin, stdMax, optMin, optMax)
      : 'no_data'

    markers.push({
      name: col1,
      category: currentCategory,
      standardMin: stdMin,
      standardMax: stdMax,
      optimalMin: optMin,
      optimalMax: optMax,
      unit,
      values: numericValues,
      dates: [], // dates not stored per-marker in this sheet format
      latest,
      status,
    })
  }

  return markers
}

export function getBloodsFocusAreas(markers: BloodMarker[]): BloodMarker[] {
  return markers.filter(m =>
    m.status === 'low' || m.status === 'high' || m.status === 'below_optimal' || m.status === 'above_optimal'
  )
}
