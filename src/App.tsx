import { useEffect, useState } from 'react'
import { SvgKeyboard } from './components/SvgKeyboard'
import { DebugPanel } from './components/DebugPanel'

export default function App() {
  const [version, setVersion] = useState('')

  useEffect(() => {
    // Ask the main process for the version across the bridge of fate.
    window.sfx?.getVersion().then(setVersion).catch(() => setVersion('dev'))
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">
          Keyboard<span className="app-title-accent">SFX</span>
        </h1>
        <p className="app-sub">Realtime Interactive Audio Engine — v5</p>
      </header>

      <main className="app-main">
        <section className="kb-stage">
          <SvgKeyboard />
          <p className="kb-hint">
            Press any key — the cap lights with its attack transient.
          </p>
        </section>
        <DebugPanel version={version} />
      </main>
    </div>
  )
}
