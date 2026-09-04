import { useEffect, useRef, useState } from 'react'
import { getGitHubSettings, isGitHubConnected, saveGitHubSettings } from '../github'
import {
  connectExistingFile,
  connectGitHub,
  createDataFile,
  disconnectFile,
  exportJsonFile,
  getSyncStatus,
  importJsonText,
  subscribeSync,
} from '../sync'

export function SyncBar() {
  const [, setTick] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const status = getSyncStatus()
  const [settings, setSettings] = useState(getGitHubSettings)
  const githubOk = isGitHubConnected() && status.connected
  const [open, setOpen] = useState(!githubOk)

  useEffect(() => subscribeSync(() => setTick((n) => n + 1)), [])

  useEffect(() => {
    setOpen(!githubOk)
  }, [githubOk])

  function updateSettings(partial: Partial<typeof settings>) {
    const next = { ...settings, ...partial }
    setSettings(next)
    saveGitHubSettings(next)
  }

  const label = settings.owner && settings.repo ? `${settings.owner}/${settings.repo}` : 'GitHub'
  const expanded = !githubOk || open

  return (
    <section className={githubOk && !open ? 'sync-bar collapsed' : 'sync-bar'}>
      {githubOk ? (
        <button type="button" className="sync-toggle" onClick={() => setOpen((value) => !value)}>
          <span>
            Linked · <strong>{label}</strong>
            <span className="sync-toggle-file"> · {status.fileName ?? 'feeding-data.json'}</span>
          </span>
          <span className="sync-toggle-hint">{open ? 'Hide' : 'Show'}</span>
        </button>
      ) : (
        <p>{status.message}</p>
      )}
      {expanded ? (
        <>
          {status.canUseGitHub ? (
            <div className="sync-github">
              <label>
                GitHub owner
                <input
                  value={settings.owner}
                  onChange={(e) => updateSettings({ owner: e.target.value })}
                  placeholder="your-username"
                  autoComplete="username"
                />
              </label>
              <label>
                Repo
                <input
                  value={settings.repo}
                  onChange={(e) => updateSettings({ repo: e.target.value })}
                  placeholder="feeding-app"
                  autoComplete="off"
                />
              </label>
              <label className="sync-token">
                Personal access token
                <input
                  type="password"
                  value={settings.token}
                  onChange={(e) => updateSettings({ token: e.target.value })}
                  placeholder="github_pat_…"
                  autoComplete="off"
                />
              </label>
            </div>
          ) : null}
          <div className="row-actions">
            {status.canUseGitHub ? (
              <button
                type="button"
                className="primary-btn compact"
                onClick={() => void connectGitHub().catch((error: unknown) => window.alert(String(error)))}
              >
                Connect GitHub
              </button>
            ) : null}
            {status.canUseFileApi ? (
              <>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => void connectExistingFile().catch((error: unknown) => window.alert(String(error)))}
                >
                  Open local JSON
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => void createDataFile().catch((error: unknown) => window.alert(String(error)))}
                >
                  Save local JSON
                </button>
              </>
            ) : null}
            {status.connected ? (
              <button type="button" className="text-btn" onClick={() => void disconnectFile()}>
                Disconnect
              </button>
            ) : null}
            <button type="button" className="ghost-btn" onClick={() => void exportJsonFile()}>
              Export JSON
            </button>
            <button type="button" className="ghost-btn" onClick={() => fileInput.current?.click()}>
              Import JSON
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                void file
                  .text()
                  .then((text) => importJsonText(text))
                  .catch((error: unknown) => window.alert(String(error)))
              }}
            />
          </div>
        </>
      ) : null}
    </section>
  )
}
