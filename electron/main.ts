import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { loadAudioEngine, playTone, audioInfo, stopAudioEngine } from './audio'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// vite-plugin-electron may emit the preload as .mjs OR .js depending on
// version/config. Pick whichever actually exists so we never point the
// window at a phantom file (約点 1 fix).
function resolvePreload(): string {
  const mjs = path.join(__dirname, 'preload.mjs')
  const js = path.join(__dirname, 'preload.js')
  return existsSync(mjs) ? mjs : js
}

// dist-electron/  ← compiled output of this file lives here
// dist/           ← compiled renderer (vite build)
process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

let win: BrowserWindow | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 620,
    minWidth: 880,
    minHeight: 480,
    backgroundColor: '#0a0a0f',
    title: 'KeyboardSFX',
    webPreferences: {
      preload: resolvePreload(),
      // --- Realtime-safe / security law from spec §32 ---
      contextIsolation: true,   // renderer cannot touch Node directly
      nodeIntegration: false,   // no Node in the UI layer
      sandbox: false,           // preload still needs limited bridge access
    },
  })

  // Renderer is the UI body only — it must never own audio (spec §29-2).
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // --- Key State Recovery (spec §27) ---
  // When focus is lost, the renderer might miss keyup events.
  // The main process screams the warning across the IPC bridge so the
  // renderer can run pressedKeys.clear() + stop all repeats.
  win.on('blur', () => {
    win?.webContents.send('focus:lost')
  })
}

// --- Minimal IPC handlers (the bridge of fate, spec §6) ---
ipcMain.handle('app:getVersion', () => app.getVersion())

// --- Audio IPC (spec §6: renderer sends commands, main does the audio) ---
// The renderer never touches WASAPI. On keydown it sends 'audio:playTone';
// the native engine (running in main) fires the sound on its own thread.
ipcMain.on('audio:playTone', (_e, freqHz?: number, durationMs?: number) => {
  playTone(freqHz, durationMs)
})
ipcMain.handle('audio:info', () => audioInfo())

app.whenReady().then(() => {
  // Wake the native WASAPI heart before opening the window (§Phase 3).
  loadAudioEngine()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopAudioEngine()
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
