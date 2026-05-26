import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main process
        entry: 'electron/main.ts',
      },
      {
        // Preload — must be built as a separate entry
        entry: 'electron/preload.ts',
        onstart(args) {
          // reload the page when preload rebuilds
          args.reload()
        },
      },
    ]),
    renderer(),
  ],
})
