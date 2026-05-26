import { contextBridge, ipcRenderer } from 'electron'

// The bridge of fate (spec §6 / §32).
// Only these explicitly-chosen powers cross from main → renderer.
// The UI body never sees raw Node or the full ipcRenderer surface.
contextBridge.exposeInMainWorld('sfx', {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),

  // Key State Recovery (spec §27): main fires this on window blur.
  onFocusLost: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('focus:lost', handler)
    // return an unsubscribe fn so React effects can clean up
    return () => ipcRenderer.removeListener('focus:lost', handler)
  },

  // Audio command channel (spec §6/§8): renderer pushes a command,
  // main's native engine performs the playback. Fire-and-forget (send),
  // not invoke — we don't block the UI waiting on audio.
  playTone: (freqHz?: number, durationMs?: number) =>
    ipcRenderer.send('audio:playTone', freqHz, durationMs),

  audioInfo: (): Promise<{ running: boolean; sampleRate?: number; channels?: number }> =>
    ipcRenderer.invoke('audio:info'),
})
