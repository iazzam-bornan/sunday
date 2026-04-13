const { contextBridge, ipcRenderer } = require("electron")

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
