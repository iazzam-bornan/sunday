const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron")
const { autoUpdater } = require("electron-updater")
const fs = require("node:fs")
const { pathToFileURL } = require("node:url")
const path = require("node:path")
const net = require("node:net")

const DEFAULT_DEV_URL = "http://localhost:3000"
const DEV_SERVER_TIMEOUT_MS = 60_000
const DEV_SERVER_RETRY_MS = 500
const WINDOW_ICON = path.join(__dirname, "..", "assets", "icon.png")
const PRELOAD = path.join(__dirname, "preload.cjs")

/**
 * @typedef {"idle" | "checking" | "available" | "downloading" | "downloaded" | "up-to-date" | "error" | "unavailable"} UpdaterStatus
 */

/**
 * @typedef {{
 *   availableVersion?: string
 *   error?: string
 *   progressPercent: number
 *   status: UpdaterStatus
 * }} UpdaterState
 */

/** @type {BrowserWindow | undefined} */
let mainWindow
/** @type {string | undefined} */
let storagePath
/** @type {Record<string, string>} */
let storage = {}
let updaterRegistered = false
/** @type {UpdaterState} */
let updaterState = {
  availableVersion: undefined,
  error: undefined,
  progressPercent: 0,
  status: /** @type {UpdaterStatus} */ (
    app.isPackaged ? "idle" : "unavailable"
  ),
}

function broadcastUpdaterState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  mainWindow.webContents.send("sunday-updater:state", updaterState)
}

/**
 * @param {Partial<UpdaterState>} nextState
 */
function setUpdaterState(nextState) {
  updaterState = {
    ...updaterState,
    ...nextState,
  }
  broadcastUpdaterState()
}

function loadStorage() {
  storagePath = path.join(app.getPath("userData"), "sunday-storage.json")

  try {
    storage = JSON.parse(fs.readFileSync(storagePath, "utf8"))
  } catch {
    storage = {}
  }
}

function saveStorage() {
  if (!storagePath) {
    return
  }

  fs.mkdirSync(path.dirname(storagePath), { recursive: true })
  fs.writeFileSync(storagePath, JSON.stringify(storage, null, 2))
}

function registerStorageIpc() {
  ipcMain.on("sunday-storage:get", (event, key) => {
    event.returnValue = Object.hasOwn(storage, key) ? storage[key] : null
  })

  ipcMain.on("sunday-storage:keys", (event) => {
    event.returnValue = Object.keys(storage)
  })

  ipcMain.on("sunday-storage:set", (event, key, value) => {
    storage[key] = value
    saveStorage()
    event.returnValue = true
  })

  ipcMain.on("sunday-storage:remove", (event, key) => {
    delete storage[key]
    saveStorage()
    event.returnValue = true
  })

  ipcMain.on("sunday-storage:remove-matching", (event, prefixes, exactKeys) => {
    /** @type {Array<string>} */
    const storagePrefixes = prefixes
    const exactKeySet = new Set(exactKeys)

    for (const key of Object.keys(storage)) {
      if (
        exactKeySet.has(key) ||
        storagePrefixes.some((prefix) => key.startsWith(prefix))
      ) {
        delete storage[key]
      }
    }

    saveStorage()
    event.returnValue = true
  })
}

function registerAutoUpdater() {
  if (updaterRegistered) {
    broadcastUpdaterState()
    return
  }

  updaterRegistered = true

  ipcMain.handle("sunday-updater:get-state", () => updaterState)
  ipcMain.handle("sunday-updater:check", async () => {
    if (!app.isPackaged) {
      setUpdaterState({
        availableVersion: undefined,
        error: undefined,
        progressPercent: 0,
        status: "unavailable",
      })
      return updaterState
    }

    setUpdaterState({
      availableVersion: undefined,
      error: undefined,
      progressPercent: 0,
      status: "checking",
    })
    await autoUpdater.checkForUpdates()
    return updaterState
  })
  ipcMain.handle("sunday-updater:download", async () => {
    if (!app.isPackaged) {
      setUpdaterState({
        error: "Updates are only available in the packaged app.",
        status: "unavailable",
      })
      return updaterState
    }

    setUpdaterState({
      error: undefined,
      progressPercent: 0,
      status: "downloading",
    })
    await autoUpdater.downloadUpdate()
    return updaterState
  })
  ipcMain.handle("sunday-updater:install", () => {
    if (updaterState.status === "downloaded") {
      autoUpdater.quitAndInstall()
    }
    return updaterState
  })

  if (!app.isPackaged) {
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on("checking-for-update", () => {
    setUpdaterState({
      error: undefined,
      progressPercent: 0,
      status: "checking",
    })
  })

  autoUpdater.on("update-available", (info) => {
    setUpdaterState({
      availableVersion: info?.version,
      error: undefined,
      progressPercent: 0,
      status: "available",
    })
  })

  autoUpdater.on("update-not-available", () => {
    setUpdaterState({
      availableVersion: undefined,
      error: undefined,
      progressPercent: 100,
      status: "up-to-date",
    })
  })

  autoUpdater.on("download-progress", (progress) => {
    setUpdaterState({
      error: undefined,
      progressPercent: Number(progress?.percent || 0),
      status: "downloading",
    })
  })

  autoUpdater.on("update-downloaded", (info) => {
    setUpdaterState({
      availableVersion: info?.version,
      error: undefined,
      progressPercent: 100,
      status: "downloaded",
    })
  })

  autoUpdater.on("error", (error) => {
    console.warn("Sunday update check failed:", error)
    setUpdaterState({
      error: error instanceof Error ? error.message : String(error),
      status: "error",
    })
  })
}

/**
 * @param {string} name
 */
function getEnv(name) {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : undefined
}

function getDevUrl() {
  return getEnv("SUNDAY_WEB_URL") || getEnv("MONDAY_WRAPPER_WEB_URL") || DEFAULT_DEV_URL
}

/**
 * @param {string} appUrl
 */
function getLoadingPage(appUrl) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Sunday</title>
    <style>
      :root { color-scheme: dark light; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0a0a0a;
        color: #fafafa;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(520px, calc(100vw - 48px));
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(255, 255, 255, 0.04);
        padding: 24px;
      }
      .row { display: flex; align-items: center; gap: 12px; }
      .spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255, 255, 255, 0.22);
        border-top-color: #fafafa;
        border-radius: 999px;
        animation: spin 0.8s linear infinite;
      }
      h1 { margin: 0; font-size: 20px; }
      p { margin: 12px 0 0; color: rgba(250, 250, 250, 0.68); line-height: 1.6; }
      code { color: #fafafa; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <main>
      <div class="row">
        <div class="spinner"></div>
        <h1>Starting Sunday</h1>
      </div>
      <p>Waiting for the web app at <code>${appUrl}</code>.</p>
    </main>
  </body>
</html>`)}`
}

/**
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * @param {string} appUrl
 */
async function waitForUrl(appUrl) {
  const startedAt = Date.now()
  let lastError

  while (Date.now() - startedAt < DEV_SERVER_TIMEOUT_MS) {
    try {
      const response = await fetch(appUrl, { method: "HEAD" })

      if (response.ok || response.status < 500) {
        return
      }
    } catch (error) {
      lastError = error
    }

    await delay(DEV_SERVER_RETRY_MS)
  }

  throw lastError || new Error(`Timed out waiting for ${appUrl}.`)
}

/**
 * @returns {Promise<number>}
 */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.unref()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()

      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to reserve a local port.")))
        return
      }

      const { port } = address
      server.close(() => resolve(port))
    })
  })
}

async function startPackagedWebServer() {
  const serverEntry = path.join(process.resourcesPath, "web", "server", "index.mjs")

  process.env.HOST = process.env.HOST || "127.0.0.1"
  process.env.PORT = String(await getFreePort())

  await import(pathToFileURL(serverEntry).href)

  return `http://127.0.0.1:${process.env.PORT}`
}

async function resolveAppUrl() {
  if (!app.isPackaged) {
    return getDevUrl()
  }

  return startPackagedWebServer()
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1040,
    minHeight: 720,
    title: "Sunday",
    icon: WINDOW_ICON,
    backgroundColor: "#0a0a0a",
    autoHideMenuBar: true,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      preload: PRELOAD,
      sandbox: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: "deny" }
  })

  try {
    const appUrl = await resolveAppUrl()

    if (!app.isPackaged) {
      await mainWindow.loadURL(getLoadingPage(appUrl))
      await waitForUrl(appUrl)
    }

    await mainWindow.loadURL(appUrl)
    registerAutoUpdater()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Sunday could not start",
      message: "Unable to load the Sunday web app.",
      detail: app.isPackaged
        ? `${message}\n\nBuild the web app before packaging the desktop app.`
        : `${message}\n\nStart the web app, or set SUNDAY_WEB_URL to the running URL.`,
    })
  }
}

app.setName("Sunday")

app.whenReady().then(async () => {
  loadStorage()
  registerStorageIpc()
  registerAutoUpdater()
  await createWindow()

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
