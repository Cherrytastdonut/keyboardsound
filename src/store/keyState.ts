import { create } from 'zustand'

// ──────────────────────────────────────────────────────────────
// Key State System (spec §4, §26, §27, §29)
//
// This is the single source of truth for "which keys are alive
// right now". OS key-repeat events are IGNORED (spec §4-2):
// repeat is driven by KEY STATE, not by the OS firing repeats.
//
// In Phase 1 the input comes from the renderer's DOM keydown/keyup.
// In Phase 3+ a native global hook + audio command queue replaces
// this DOM path — but the *shape* of the truth stays identical, so
// the rest of the app won't have to change.
// ──────────────────────────────────────────────────────────────

export type InternalKey = string // normalized key id (spec §26 Key Normalization)

interface KeyEntry {
  key: InternalKey
  /** monotonic timestamp (performance.now) of the keydown that started this press */
  pressedAt: number
}

interface KeyState {
  pressedKeys: Map<InternalKey, KeyEntry>

  /** true keydown attack — ignores OS auto-repeat (spec §4-1) */
  keyDown: (key: InternalKey) => void
  /** keyup → stop repeat for this key (spec §4-1) */
  keyUp: (key: InternalKey) => void
  /** focus lost / sleep / alt-tab → force-clear everything (spec §27-3) */
  clearAll: () => void

  isPressed: (key: InternalKey) => boolean
}

export const useKeyState = create<KeyState>((set, get) => ({
  pressedKeys: new Map(),

  keyDown: (key) => {
    const current = get().pressedKeys
    // Already physically held? This DOM event is an OS auto-repeat — REJECT it.
    // (spec §4-2: OS repeat events are not used.)
    if (current.has(key)) return

    const next = new Map(current)
    next.set(key, { key, pressedAt: performance.now() })
    set({ pressedKeys: next })
  },

  keyUp: (key) => {
    const current = get().pressedKeys
    if (!current.has(key)) return
    const next = new Map(current)
    next.delete(key)
    set({ pressedKeys: next })
  },

  clearAll: () => {
    if (get().pressedKeys.size === 0) return
    set({ pressedKeys: new Map() })
  },

  isPressed: (key) => get().pressedKeys.has(key),
}))
