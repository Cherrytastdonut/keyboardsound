import { useKeyState } from '../store/keyState'

// Debug panel (spec §31). In Phase 1 only the live key-state metrics are
// real — the audio-engine metrics (active voices, latency, XRUN) light up
// in Phase 5 once the native engine exists. We label those honestly as
// "pending" rather than faking numbers.

export function DebugPanel({ version }: { version: string }) {
  const pressed = useKeyState((s) => s.pressedKeys)
  const pressedList = Array.from(pressed.keys())

  return (
    <aside className="debug">
      <h2 className="debug-title">DEBUG MONITOR</h2>

      <Metric label="Pressed keys" value={String(pressed.size)} live />
      <Metric
        label="Active keys"
        value={pressedList.length ? pressedList.join('  ') : '—'}
        live
      />

      <div className="debug-divider" />

      <Metric label="Active voices" value="pending · Phase 5" />
      <Metric label="Latency meter" value="pending · Phase 5" />
      <Metric label="XRUN counter" value="pending · Phase 5" />
      <Metric label="Audio thread" value="pending · Phase 3" />
      <Metric label="Output device" value="pending · Phase 6" />

      <div className="debug-divider" />

      <Metric label="App version" value={version || '—'} />
      <Metric label="Phase" value="1 · UI Skeleton" />
    </aside>
  )
}

function Metric({
  label,
  value,
  live = false,
}: {
  label: string
  value: string
  live?: boolean
}) {
  return (
    <div className={`metric ${live ? 'metric-live' : 'metric-pending'}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  )
}
