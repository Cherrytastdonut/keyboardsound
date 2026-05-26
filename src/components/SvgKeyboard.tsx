import { useEffect, useMemo } from 'react'
import { useKeyState } from '../store/keyState'
import { KEY_LAYOUT, UNIT, GAP, PADDING, type KeyDef } from './keyLayout'

// ──────────────────────────────────────────────────────────────
// Key Normalization Layer (spec §26)
//
// The browser hands us event.code (e.g. "KeyA", "Space"). We pass it
// straight through as our InternalKey for Phase 1, because event.code
// is already layout-independent. The seam exists here so that when the
// native global hook arrives in Phase 3, its raw scancodes get mapped
// through this same function — the rest of the app never notices.
// ──────────────────────────────────────────────────────────────
function normalize(code: string): string {
  return code
}

// Phase 3 placeholder: turn a key id into a distinct pitch so every key
// sounds different. Hashes the string into a pentatonic-ish range so the
// result is pleasant rather than random noise. Replaced by real per-key
// PCM samples in Phase 4 (§4-1 voice / §10 voice pool).
function keyToFreq(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0xffff
  // pentatonic scale degrees over ~2 octaves, base A3 = 220Hz
  const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]
  const semis = scale[h % scale.length] + 12 * (Math.floor(h / scale.length) % 2)
  return 220 * Math.pow(2, semis / 12)
}

export function SvgKeyboard() {
  const pressedKeys = useKeyState((s) => s.pressedKeys)
  const keyDown = useKeyState((s) => s.keyDown)
  const keyUp = useKeyState((s) => s.keyUp)
  const clearAll = useKeyState((s) => s.clearAll)

  // Compute SVG canvas size from the layout once.
  const { width, height } = useMemo(() => {
    let maxX = 0
    let maxY = 0
    for (const k of KEY_LAYOUT) {
      maxX = Math.max(maxX, k.x + (k.w ?? 1))
      maxY = Math.max(maxY, k.y + 1)
    }
    return {
      width: PADDING * 2 + maxX * UNIT + (maxX - 1) * GAP,
      height: PADDING * 2 + maxY * UNIT + (maxY - 1) * GAP,
    }
  }, [])

  // Listen to the DOM keyboard. In Phase 1 this IS our input source.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      // Spec §4-2: drop OS auto-repeat. The browser flags it for us.
      if (e.repeat) return
      const key = normalize(e.code)
      keyDown(key)
      // Spec §4-1: a new sounding key → fire a voice. For Phase 3 the
      // "voice" is a test tone whose pitch is derived from the key code,
      // so every key sounds distinct. Phase 4 swaps this for real PCM.
      const freq = keyToFreq(key)
      window.sfx?.playTone(freq, 90)
    }
    const onUp = (e: KeyboardEvent) => keyUp(normalize(e.code))

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [keyDown, keyUp])

  // Key State Recovery (spec §27): when the window loses focus the OS may
  // swallow the keyup. The main process screams "focus:lost" across the
  // bridge — we force-clear so no key gets stuck "alive" forever.
  useEffect(() => {
    // window.sfx exists only inside Electron; guard for browser dev too.
    const unsub = window.sfx?.onFocusLost(() => clearAll())
    const onBlur = () => clearAll()
    window.addEventListener('blur', onBlur)
    return () => {
      unsub?.()
      window.removeEventListener('blur', onBlur)
    }
  }, [clearAll])

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="kb-svg"
      role="img"
      aria-label="Interactive keyboard"
    >
      {KEY_LAYOUT.map((key) => (
        <KeyCap key={key.id} def={key} active={pressedKeys.has(normalize(key.id))} />
      ))}
    </svg>
  )
}

function KeyCap({ def, active }: { def: KeyDef; active: boolean }) {
  const w = (def.w ?? 1) * UNIT + ((def.w ?? 1) - 1) * GAP
  const h = UNIT
  const x = PADDING + def.x * (UNIT + GAP)
  const y = PADDING + def.y * (UNIT + GAP)

  return (
    <g className={`keycap ${active ? 'is-active' : ''}`}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className="keycap-bg"
      />
      {/* attack glow — the visual "transient" (spec §13) */}
      {active && (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={8}
          className="keycap-glow"
        />
      )}
      {def.label && (
        <text
          x={x + w / 2}
          y={y + h / 2}
          className="keycap-label"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {def.label}
        </text>
      )}
    </g>
  )
}
