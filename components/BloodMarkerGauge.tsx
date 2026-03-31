import type { BloodMarker } from '@/lib/sheets/parseBloods'

const STATUS_CONFIG = {
  optimal:       { label: 'Optimal',       color: 'text-green-400',  bg: 'bg-green-400',  bar: 'bg-green-400' },
  below_optimal: { label: 'Below Optimal', color: 'text-yellow-400', bg: 'bg-yellow-400', bar: 'bg-yellow-400' },
  above_optimal: { label: 'Above Optimal', color: 'text-yellow-400', bg: 'bg-yellow-400', bar: 'bg-yellow-400' },
  low:           { label: 'Low',           color: 'text-red-400',    bg: 'bg-red-400',    bar: 'bg-red-400' },
  high:          { label: 'High',          color: 'text-red-400',    bg: 'bg-red-400',    bar: 'bg-red-400' },
  no_data:       { label: 'No Data',       color: 'text-slate-500',  bg: 'bg-slate-600',  bar: 'bg-slate-700' },
}

interface Props {
  marker: BloodMarker
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

export default function BloodMarkerGauge({ marker }: Props) {
  const cfg = STATUS_CONFIG[marker.status]

  // Compute fill % within standard range for the bar
  let fillPercent = 0
  if (marker.latest !== null && marker.standardMax > marker.standardMin) {
    fillPercent = ((marker.latest - marker.standardMin) / (marker.standardMax - marker.standardMin)) * 100
    fillPercent = clamp(fillPercent, 0, 100)
  }

  // Optimal zone markers as % of bar width
  const optStart = marker.standardMax > marker.standardMin
    ? ((marker.optimalMin - marker.standardMin) / (marker.standardMax - marker.standardMin)) * 100
    : 0
  const optEnd = marker.standardMax > marker.standardMin
    ? ((marker.optimalMax - marker.standardMin) / (marker.standardMax - marker.standardMin)) * 100
    : 100

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <p className="font-semibold text-white text-sm leading-tight">{marker.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{marker.unit}</p>
        </div>
        <div className="text-right shrink-0">
          {marker.latest !== null ? (
            <>
              <p className="text-lg font-bold text-white">{marker.latest}</p>
              <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
            </>
          ) : (
            <p className="text-sm text-slate-600">No data</p>
          )}
        </div>
      </div>

      {/* Gauge bar */}
      <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
        {/* Optimal zone highlight */}
        <div
          className="absolute top-0 h-full bg-green-500/20 rounded-full"
          style={{ left: `${clamp(optStart,0,100)}%`, width: `${clamp(optEnd - optStart, 0, 100)}%` }}
        />
        {/* Value fill */}
        {marker.latest !== null && (
          <div
            className={`absolute top-0 left-0 h-full ${cfg.bar} rounded-full transition-all`}
            style={{ width: `${fillPercent}%`, opacity: 0.85 }}
          />
        )}
      </div>

      {/* Range labels */}
      <div className="flex justify-between mt-1.5 text-xs text-slate-600">
        <span>{marker.standardMin}</span>
        <span className="text-green-600 text-xs">
          {marker.optimalMin}–{marker.optimalMax} optimal
        </span>
        <span>{marker.standardMax}</span>
      </div>

      {/* History dots */}
      {marker.values.filter(v => v !== null).length > 1 && (
        <div className="flex gap-1 mt-3 flex-wrap">
          {marker.values.map((v, i) => {
            if (v === null) return null
            return (
              <div key={i} className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${cfg.bg}`} />
                <span className="text-xs text-slate-500">{v}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
