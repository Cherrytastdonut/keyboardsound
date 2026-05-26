// The contract of fate (spec §APIs): what the bridge promises to the renderer.
export interface SfxBridge {
  getVersion: () => Promise<string>
  onFocusLost: (cb: () => void) => () => void
  playTone: (freqHz?: number, durationMs?: number) => void
  audioInfo: () => Promise<{ running: boolean; sampleRate?: number; channels?: number }>
}

declare global {
  interface Window {
    sfx: SfxBridge
  }
}

export {}
