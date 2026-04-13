const { contextBridge, ipcRenderer } = require("electron")

/**
 * @typedef {{
 *   availableVersion?: string
 *   error?: string
 *   progressPercent: number
 *   status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "up-to-date" | "error" | "unavailable"
 * }} UpdaterState
 */

contextBridge.exposeInMainWorld("sundayStorage", {
  /**
   * @param {string} key
   * @returns {string | null}
   */
  getItem(key) {
    return ipcRenderer.sendSync("sunday-storage:get", key)
  },

  /**
   * @returns {Array<string>}
   */
  keys() {
    return ipcRenderer.sendSync("sunday-storage:keys")
  },

  /**
   * @param {string} key
   * @param {string} value
   */
  setItem(key, value) {
    ipcRenderer.sendSync("sunday-storage:set", key, value)
  },

  /**
   * @param {string} key
   */
  removeItem(key) {
    ipcRenderer.sendSync("sunday-storage:remove", key)
  },

  /**
   * @param {Array<string>} prefixes
   * @param {Array<string>} exactKeys
   */
  removeMatching(prefixes, exactKeys) {
    ipcRenderer.sendSync("sunday-storage:remove-matching", prefixes, exactKeys)
  },
})

contextBridge.exposeInMainWorld("sundayUpdater", {
  /**
   * @returns {Promise<UpdaterState>}
   */
  async getState() {
    return ipcRenderer.invoke("sunday-updater:get-state")
  },

  /**
   * @returns {Promise<UpdaterState>}
   */
  async check() {
    return ipcRenderer.invoke("sunday-updater:check")
  },

  /**
   * @returns {Promise<UpdaterState>}
   */
  async download() {
    return ipcRenderer.invoke("sunday-updater:download")
  },

  /**
   * @returns {Promise<UpdaterState>}
   */
  async install() {
    return ipcRenderer.invoke("sunday-updater:install")
  },

  /**
   * @param {(value: UpdaterState) => void} callback
   * @returns {() => void}
   */
  onStateChange(callback) {
    /**
     * @param {unknown} _event
     * @param {UpdaterState} value
     */
    const listener = (_event, value) => callback(value)
    ipcRenderer.on("sunday-updater:state", listener)

    return () => {
      ipcRenderer.removeListener("sunday-updater:state", listener)
    }
  },
})
