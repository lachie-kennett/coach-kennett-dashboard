import { getSheetValues } from './client'

export interface MealPlanDay {
  day: string        // "Monday", "Tuesday", etc.
  planName: string   // "Meal Plan 1", "Meal Plan 2", etc.
  meals: string[]    // Meal 1 through Meal 5 content
  miscellaneous: string
  supplements: string
}

export async function parseMealPlanSheet(spreadsheetId: string): Promise<MealPlanDay[]> {
  let values: string[][]
  try {
    values = await getSheetValues(spreadsheetId, '📋 Meal Plan!A1:Z100')
  } catch {
    return []
  }

  if (!values || values.length < 2) return []

  // Row 0: day names (Monday, Tuesday, etc.) starting from col 2
  // Row 1: plan names (Meal Plan 1, Meal Plan 2, etc.)
  // Then meal rows with "Meal 1", "Meal 2" etc. in col 1 (rotated header)
  // Miscellaneous section header in col 0
  // Supplements section header in col 0

  const dayRow = values[0] ?? []
  const planRow = values[1] ?? []

  // Find which columns are days (non-empty in row 0, skip col 0 and 1)
  const dayColumns: { col: number; day: string; planName: string }[] = []
  for (let c = 2; c < dayRow.length; c++) {
    const day = dayRow[c]?.trim()
    if (day && day !== '') {
      dayColumns.push({
        col: c,
        day,
        planName: planRow[c]?.trim() ?? '',
      })
    }
  }

  if (dayColumns.length === 0) return []

  // Initialise result
  const result: MealPlanDay[] = dayColumns.map(d => ({
    day: d.day,
    planName: d.planName,
    meals: [],
    miscellaneous: '',
    supplements: '',
  }))

  let currentSection: 'meals' | 'misc' | 'supplements' = 'meals'
  const mealContents: string[][] = dayColumns.map(() => []) // per-day meal content accumulator
  let miscContents: string[] = dayColumns.map(() => '')
  let suppContents: string[] = dayColumns.map(() => '')

  for (let r = 2; r < values.length; r++) {
    const row = values[r] ?? []
    const sectionLabel = row[0]?.trim() ?? ''

    // Detect section changes from col 0
    if (sectionLabel.toLowerCase().includes('miscellaneous')) {
      currentSection = 'misc'
      continue
    }
    if (sectionLabel.toLowerCase().includes('supplement')) {
      currentSection = 'supplements'
      continue
    }

    // Accumulate content for each day column
    dayColumns.forEach((dc, i) => {
      const cellValue = row[dc.col]?.trim() ?? ''
      if (!cellValue) return

      if (currentSection === 'meals') {
        mealContents[i].push(cellValue)
      } else if (currentSection === 'misc') {
        miscContents[i] = miscContents[i] ? miscContents[i] + '\n' + cellValue : cellValue
      } else if (currentSection === 'supplements') {
        suppContents[i] = suppContents[i] ? suppContents[i] + '\n' + cellValue : cellValue
      }
    })
  }

  // Assign accumulated content back
  result.forEach((day, i) => {
    day.meals = mealContents[i]
    day.miscellaneous = miscContents[i]
    day.supplements = suppContents[i]
  })

  return result
}
