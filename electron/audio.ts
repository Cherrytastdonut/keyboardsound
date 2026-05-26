// JS wrapper around the native WASAPI addon.
// Loaded ONLY in the main process (§6: audio lives outside the renderer).
//
// Build output path: build/Release/keyboard_sfx_audio.node
// If the native module is missing (not yet built), we fail loudly but
// don't crash the whole app — the UI still runs, audio is just absent.

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface NativeAudio {
  start(): boolean
  stop(): boolean
  playTone(freqHz?: number, durationMs?: number): boolean
  info(): { running: boolean; sampleRate?: number; channels?: number }
}

let native: NativeAudio | null = null
let loadError: string | null = null

export function loadAudioEngine(): boolean {
  if (native) return true
  try {
    // From dist-electron/ the project root is one level up.
    const modulePath = path.join(
      __dirname, '..', 'build', 'Release', 'keyboard_sfx_audio.node'
    )
    native = require(modulePath) as NativeAudio
    native.start()
    return true
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e)
    console.error('[audio] native engine failed to load:', loadError)
    return false
  }
}

export function playTone(freqHz?: number, durationMs?: number): void {
  if (!native) return
  try {
    native.playTone(freqHz, durationMs)
  } catch (e) {
    console.error('[audio] playTone error:', e)
  }
}

export function audioInfo() {
  if (!native) return { running: false, error: loadError }
  try {
    return native.info()
  } catch {
    return { running: false }
  }
}

export function stopAudioEngine(): void {
  if (native) {
    try { native.stop() } catch { /* ignore */ }
    native = null
  }
}
