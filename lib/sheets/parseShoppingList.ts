import { getSheetValues } from './client'

export interface ShoppingItem {
  name: string
  notes: string
  calories: string
  protein: string
  fat: string
  carbs: string
  per: string
}

export interface ShoppingList {
  items: ShoppingItem[]
}

export async function parseShoppingListSheet(spreadsheetId: string): Promise<ShoppingList> {
  let values: string[][]
  try {
    values = await getSheetValues(spreadsheetId, '🛒 Shopping List!A1:O200')
  } catch {
    return { items: [] }
  }

  if (!values || values.length < 3) return { items: [] }

  // Find header row — look for row containing "Weekly Shopping List"
  let dataStartRow = 2 // default: data starts at row 2 (0-indexed)
  for (let r = 0; r < Math.min(5, values.length); r++) {
    const row = values[r]
    if (row?.some(c => c?.toLowerCase().includes('shopping list'))) {
      dataStartRow = r + 2 // data starts 2 rows after header
      break
    }
  }

  // Find column indices from the macro header row
  // Row 1 contains: "Weekly Shopping List" | "Shopping Notes" | ... | "Item Macros" > Calories | Protein | Fat | Carbs | Per
  const headerRow = values[1] ?? []
  let nameCol = 5   // col F (0-indexed)
  let notesCol = 8  // col I
  let calCol = 9    // col J
  let protCol = 10  // col K
  let fatCol = 11   // col L
  let carbCol = 12  // col M
  let perCol = 14   // col O

  // Try to detect columns from headers
  for (let c = 0; c < headerRow.length; c++) {
    const h = headerRow[c]?.toLowerCase().trim() ?? ''
    if (h === 'calories') calCol = c
    else if (h === 'protein') protCol = c
    else if (h === 'fat') fatCol = c
    else if (h === 'carbs') carbCol = c
    else if (h === 'per') perCol = c
  }

  const items: ShoppingItem[] = []

  for (let r = dataStartRow; r < values.length; r++) {
    const row = values[r] ?? []
    const name = row[nameCol]?.trim() ?? ''
    if (!name) continue

    items.push({
      name,
      notes: row[notesCol]?.trim() ?? '',
      calories: row[calCol]?.trim() ?? '',
      protein: row[protCol]?.trim() ?? '',
      fat: row[fatCol]?.trim() ?? '',
      carbs: row[carbCol]?.trim() ?? '',
      per: row[perCol]?.trim() ?? '',
    })
  }

  return { items }
}
