import { getSheetValues } from './client'

export interface DayEntry {
  date: string
  day: string
  weight: string
  weightGoal: string
  sleep: string
  stress: string
  cyclePhase: string
  steps: string
  stepsGoal: string
  nutritionQualitative: string
  nutritionQuantitative: string
  proteinTracked: string
  proteinGoal: string
  carbTracked: string
  carbGoal: string
  fatTracked: string
  fatGoal: string
  caloriesTracked: string
  caloriesGoal: string
  deviation: string
  completedTracker: string
  sessionsTrained: string
  cardioMins: string
  bristol: string
  bowelMovements: string
  systolicBP: string
  diastolicBP: string
  restingHR: string
  hrv: string
  sodium: string
  potassium: string
  water: string
  energy: string
  sleepScore: string
  fatigue: string
  notes: string
}

export interface MonthData {
  month: string
  days: DayEntry[]
  pointsEarned: string
}

// Column indices based on the tracking sheet structure
const COL = {
  date: 1,
  day: 2,
  weight: 3,
  weightGoal: 4,
  sleep: 5,
  stress: 6,
  cyclePhase: 7,
  steps: 13,
  stepsGoal: 14,
  nutritionQualitative: 15,
  nutritionQuantitative: 16,
  proteinTracked: 17,
  proteinGoal: 18,
  carbTracked: 19,
  carbGoal: 20,
  fatTracked: 21,
  fatGoal: 22,
  caloriesTracked: 23,
  caloriesGoal: 24,
  deviation: 25,
  completedTracker: 28,
  sessionsTrained: 35,
  cardioMins: 36,
  bristol: 37,
  bowelMovements: 38,
  systolicBP: 39,
  diastolicBP: 40,
  restingHR: 41,
  hrv: 42,
  sodium: 43,
  potassium: 44,
  water: 45,
  energy: 46,
  sleepScore: 47,
  fatigue: 52,
  notes: 55,
}

function cell(row: string[], col: number): string {
  return row[col] ?? ''
}

export async function parseTrackingSheet(spreadsheetId: string): Promise<MonthData[]> {
  let values: string[][]
  try {
    values = await getSheetValues(spreadsheetId, '📊 Tracking!A1:BJ500')
  } catch {
    return []
  }

  const months: MonthData[] = []
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']

  let currentMonth: MonthData | null = null

  for (let i = 0; i < values.length; i++) {
    const row = values[i]
    if (!row || row.length === 0) continue

    const firstCell = row[0]?.trim() ?? ''

    // Detect month header row
    if (monthNames.includes(firstCell)) {
      if (currentMonth) months.push(currentMonth)
      currentMonth = { month: firstCell, days: [], pointsEarned: row[28] ?? '0' }
      continue
    }

    if (!currentMonth) continue

    // Detect date rows (format: D/M)
    const dateCell = cell(row, COL.date)
    if (dateCell && /^\d{1,2}\/\d{1,2}$/.test(dateCell)) {
      currentMonth.days.push({
        date: dateCell,
        day: cell(row, COL.day),
        weight: cell(row, COL.weight),
        weightGoal: cell(row, COL.weightGoal),
        sleep: cell(row, COL.sleep),
        stress: cell(row, COL.stress),
        cyclePhase: cell(row, COL.cyclePhase),
        steps: cell(row, COL.steps),
        stepsGoal: cell(row, COL.stepsGoal),
        nutritionQualitative: cell(row, COL.nutritionQualitative),
        nutritionQuantitative: cell(row, COL.nutritionQuantitative),
        proteinTracked: cell(row, COL.proteinTracked),
        proteinGoal: cell(row, COL.proteinGoal),
        carbTracked: cell(row, COL.carbTracked),
        carbGoal: cell(row, COL.carbGoal),
        fatTracked: cell(row, COL.fatTracked),
        fatGoal: cell(row, COL.fatGoal),
        caloriesTracked: cell(row, COL.caloriesTracked),
        caloriesGoal: cell(row, COL.caloriesGoal),
        deviation: cell(row, COL.deviation),
        completedTracker: cell(row, COL.completedTracker),
        sessionsTrained: cell(row, COL.sessionsTrained),
        cardioMins: cell(row, COL.cardioMins),
        bristol: cell(row, COL.bristol),
        bowelMovements: cell(row, COL.bowelMovements),
        systolicBP: cell(row, COL.systolicBP),
        diastolicBP: cell(row, COL.diastolicBP),
        restingHR: cell(row, COL.restingHR),
        hrv: cell(row, COL.hrv),
        sodium: cell(row, COL.sodium),
        potassium: cell(row, COL.potassium),
        water: cell(row, COL.water),
        energy: cell(row, COL.energy),
        sleepScore: cell(row, COL.sleepScore),
        fatigue: cell(row, COL.fatigue),
        notes: cell(row, COL.notes),
      })
    }
  }

  if (currentMonth) months.push(currentMonth)
  return months
}

export function isCompleted(day: DayEntry): boolean {
  // A day is "tracked" if any key metric has been filled in
  return !!(day.sleep || day.steps || day.weight || day.energy || day.water || day.caloriesTracked)
}

export function getLastLoggedDate(months: MonthData[]): string | null {
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const year = new Date().getFullYear()
  for (let mi = months.length - 1; mi >= 0; mi--) {
    const month = months[mi]
    const monthIndex = monthNames.indexOf(month.month)
    if (monthIndex === -1) continue
    for (let di = month.days.length - 1; di >= 0; di--) {
      const day = month.days[di]
      if (isCompleted(day) && day.date) {
        const [d, m] = day.date.split('/').map(Number)
        if (!isNaN(d) && !isNaN(m)) {
          return new Date(year, m - 1, d).toISOString().split('T')[0]
        }
      }
    }
  }
  return null
}

export function computeAdherenceStats(months: MonthData[]) {
  // Days passed since Jan 1 of current year (up to and including today)
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const daysSinceJan1 = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000) + 1

  let trackedDays = 0
  let totalSessions = 0
  let totalPoints = 0
  let monthlyPoints: { month: string; points: number }[] = []

  for (const month of months) {
    let monthTracked = 0
    for (const day of month.days) {
      if (day.date) {
        if (isCompleted(day)) {
          trackedDays++
          monthTracked++
        }
        const sessions = parseFloat(day.sessionsTrained)
        if (!isNaN(sessions)) totalSessions += sessions
      }
    }
    const pts = parseFloat(month.pointsEarned?.replace(/[^\d.]/g, '') || '0')
    if (!isNaN(pts)) totalPoints += pts
    if (monthTracked > 0) {
      monthlyPoints.push({ month: month.month, points: pts })
    }
  }

  const totalDays = daysSinceJan1

  // Streak: consecutive completed days counting backwards from most recent
  const allDays = months.flatMap(m => m.days).filter(d => !!d.date)
  let streakStart = allDays.length - 1
  // Skip today if not yet completed (day might not be over)
  if (streakStart >= 0 && !isCompleted(allDays[streakStart])) streakStart--
  let currentStreak = 0
  for (let i = streakStart; i >= 0; i--) {
    if (isCompleted(allDays[i])) {
      currentStreak++
    } else {
      break
    }
  }

  return {
    adherencePercent: totalDays > 0 ? Math.round((trackedDays / totalDays) * 100) : 0,
    totalSessions,
    totalPoints,
    trackedDays,
    totalDays,
    monthlyPoints,
    currentStreak,
  }
}
