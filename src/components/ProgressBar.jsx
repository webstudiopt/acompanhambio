export default function ProgressBar({ label, current, target }) {
  const hasTarget = target !== 0
  // Meta negativa (despesa a pagar) e acumulado negativo dão razão positiva —
  // funciona igual à meta positiva sem precisar de lógica separada.
  const pct = hasTarget ? Math.max(0, Math.min(100, (current / target) * 100)) : 0

  return (
    <div className="progress-bar">
      <div className="progress-bar-label">
        <span>{label}</span>
        <span>
          {hasTarget
            ? `€${current.toFixed(2)} / €${target.toFixed(2)} (${pct.toFixed(0)}%)`
            : `€${current.toFixed(2)} (sem meta definida)`}
        </span>
      </div>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
