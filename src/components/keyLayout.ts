// Keyboard layout map (spec §30: SVG-based rendering).
// Each key gives its grid position (col,row in "units") and width in units.
// The renderer turns these units into SVG rects. A compact ANSI-ish layout
// is enough for Phase 1 — the point is to prove key-state → visual feedback.

export interface KeyDef {
  /** normalized internal key id — must match what keyState receives */
  id: string
  /** label shown on the cap */
  label: string
  /** column position in key-units */
  x: number
  /** row position in key-units */
  y: number
  /** width in key-units (1 = standard) */
  w?: number
}

// One "unit" = a standard 1u keycap. Layout is laid out row by row.
export const KEY_LAYOUT: KeyDef[] = [
  // Row 0 — number row
  { id: 'Backquote', label: '`', x: 0, y: 0 },
  { id: 'Digit1', label: '1', x: 1, y: 0 },
  { id: 'Digit2', label: '2', x: 2, y: 0 },
  { id: 'Digit3', label: '3', x: 3, y: 0 },
  { id: 'Digit4', label: '4', x: 4, y: 0 },
  { id: 'Digit5', label: '5', x: 5, y: 0 },
  { id: 'Digit6', label: '6', x: 6, y: 0 },
  { id: 'Digit7', label: '7', x: 7, y: 0 },
  { id: 'Digit8', label: '8', x: 8, y: 0 },
  { id: 'Digit9', label: '9', x: 9, y: 0 },
  { id: 'Digit0', label: '0', x: 10, y: 0 },
  { id: 'Minus', label: '-', x: 11, y: 0 },
  { id: 'Equal', label: '=', x: 12, y: 0 },
  { id: 'Backspace', label: '⌫', x: 13, y: 0, w: 2 },

  // Row 1 — QWERTY
  { id: 'Tab', label: 'Tab', x: 0, y: 1, w: 1.5 },
  { id: 'KeyQ', label: 'Q', x: 1.5, y: 1 },
  { id: 'KeyW', label: 'W', x: 2.5, y: 1 },
  { id: 'KeyE', label: 'E', x: 3.5, y: 1 },
  { id: 'KeyR', label: 'R', x: 4.5, y: 1 },
  { id: 'KeyT', label: 'T', x: 5.5, y: 1 },
  { id: 'KeyY', label: 'Y', x: 6.5, y: 1 },
  { id: 'KeyU', label: 'U', x: 7.5, y: 1 },
  { id: 'KeyI', label: 'I', x: 8.5, y: 1 },
  { id: 'KeyO', label: 'O', x: 9.5, y: 1 },
  { id: 'KeyP', label: 'P', x: 10.5, y: 1 },
  { id: 'BracketLeft', label: '[', x: 11.5, y: 1 },
  { id: 'BracketRight', label: ']', x: 12.5, y: 1 },
  { id: 'Backslash', label: '\\', x: 13.5, y: 1, w: 1.5 },

  // Row 2 — ASDF (home row)
  { id: 'CapsLock', label: 'Caps', x: 0, y: 2, w: 1.75 },
  { id: 'KeyA', label: 'A', x: 1.75, y: 2 },
  { id: 'KeyS', label: 'S', x: 2.75, y: 2 },
  { id: 'KeyD', label: 'D', x: 3.75, y: 2 },
  { id: 'KeyF', label: 'F', x: 4.75, y: 2 },
  { id: 'KeyG', label: 'G', x: 5.75, y: 2 },
  { id: 'KeyH', label: 'H', x: 6.75, y: 2 },
  { id: 'KeyJ', label: 'J', x: 7.75, y: 2 },
  { id: 'KeyK', label: 'K', x: 8.75, y: 2 },
  { id: 'KeyL', label: 'L', x: 9.75, y: 2 },
  { id: 'Semicolon', label: ';', x: 10.75, y: 2 },
  { id: 'Quote', label: "'", x: 11.75, y: 2 },
  { id: 'Enter', label: '⏎', x: 12.75, y: 2, w: 2.25 },

  // Row 3 — ZXCV
  { id: 'ShiftLeft', label: 'Shift', x: 0, y: 3, w: 2.25 },
  { id: 'KeyZ', label: 'Z', x: 2.25, y: 3 },
  { id: 'KeyX', label: 'X', x: 3.25, y: 3 },
  { id: 'KeyC', label: 'C', x: 4.25, y: 3 },
  { id: 'KeyV', label: 'V', x: 5.25, y: 3 },
  { id: 'KeyB', label: 'B', x: 6.25, y: 3 },
  { id: 'KeyN', label: 'N', x: 7.25, y: 3 },
  { id: 'KeyM', label: 'M', x: 8.25, y: 3 },
  { id: 'Comma', label: ',', x: 9.25, y: 3 },
  { id: 'Period', label: '.', x: 10.25, y: 3 },
  { id: 'Slash', label: '/', x: 11.25, y: 3 },
  { id: 'ShiftRight', label: 'Shift', x: 12.25, y: 3, w: 2.75 },

  // Row 4 — bottom row
  { id: 'ControlLeft', label: 'Ctrl', x: 0, y: 4, w: 1.25 },
  { id: 'MetaLeft', label: 'Win', x: 1.25, y: 4, w: 1.25 },
  { id: 'AltLeft', label: 'Alt', x: 2.5, y: 4, w: 1.25 },
  { id: 'Space', label: '', x: 3.75, y: 4, w: 6.25 },
  { id: 'AltRight', label: 'Alt', x: 10, y: 4, w: 1.25 },
  { id: 'MetaRight', label: 'Win', x: 11.25, y: 4, w: 1.25 },
  { id: 'ContextMenu', label: '☰', x: 12.5, y: 4, w: 1.25 },
  { id: 'ControlRight', label: 'Ctrl', x: 13.75, y: 4, w: 1.25 },
]

// Layout geometry (in SVG px). One unit cap is UNIT px wide/tall.
export const UNIT = 54
export const GAP = 4
export const PADDING = 16
