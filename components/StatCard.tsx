interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
  color?: 'green' | 'orange' | 'blue' | 'red' | 'slate'
}

const colorMap = {
  green:  'text-green-400',
  orange: 'text-orange-400',
  blue:   'text-blue-400',
  red:    'text-red-400',
  slate:  'text-slate-300',
}

export default function StatCard({ label, value, sub, accent, color = 'orange' }: StatCardProps) {
  return (
    <div className={`rounded-2xl p-4 ${accent ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-slate-800/60 border border-slate-700/50'}`}>
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}
