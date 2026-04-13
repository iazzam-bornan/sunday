import type { AppSettings, MondayTheme } from "@/lib/monday/types"

const SETTINGS_KEY = "sunday:settings"
const LEGACY_SETTINGS_KEY = "monday-wrapper:settings"
const CACHE_PREFIX = "sunday:cache:"
const LEGACY_CACHE_PREFIX = "monday-wrapper:cache:"

type SundayStorageBridge = {
  getItem: (key: string) => string | null
  keys: () => Array<string>
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  removeMatching: (prefixes: Array<string>, exactKeys: Array<string>) => void
}

declare global {
  interface Window {
    sundayStorage?: SundayStorageBridge
  }
}

function getStorageItem(key: string) {
  if (typeof window === "undefined") {
    return null
  }

  const bridgeValue = window.sundayStorage?.getItem(key)
  const localValue = window.localStorage.getItem(key)

  if (window.sundayStorage && bridgeValue === null && localValue !== null) {
    window.sundayStorage.setItem(key, localValue)
  }

  return bridgeValue ?? localValue
}

function setStorageItem(key: string, value: string) {
  window.sundayStorage?.setItem(key, value)
  window.localStorage.setItem(key, value)
}

function removeStorageItem(key: string) {
  window.sundayStorage?.removeItem(key)
  window.localStorage.removeItem(key)
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") {
    return {}
  }

  const raw = getStorageItem(SETTINGS_KEY) || getStorageItem(LEGACY_SETTINGS_KEY)

  if (!raw) {
    return {}
  }

  try {
    return JSON.parse(raw) as AppSettings
  } catch {
    return {}
  }
}

export function saveSettings(settings: AppSettings) {
  setStorageItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function clearSettings() {
  removeStorageItem(SETTINGS_KEY)
  removeStorageItem(LEGACY_SETTINGS_KEY)
}

export function clearAllSundayData() {
  if (typeof window === "undefined") {
    return
  }

  window.sundayStorage?.removeMatching(
    [CACHE_PREFIX, LEGACY_CACHE_PREFIX],
    [SETTINGS_KEY, LEGACY_SETTINGS_KEY]
  )

  const localKeys = Array.from(
    { length: window.localStorage.length },
    (_value, index) => window.localStorage.key(index)
  )

  for (const key of localKeys) {
    if (
      key === SETTINGS_KEY ||
      key === LEGACY_SETTINGS_KEY ||
      key?.startsWith(CACHE_PREFIX) ||
      key?.startsWith(LEGACY_CACHE_PREFIX)
    ) {
      window.localStorage.removeItem(key)
    }
  }

  window.sessionStorage.clear()
}

export function applyTheme(theme: MondayTheme = "light") {
  document.documentElement.classList.toggle("dark", theme === "dark")
}

export function loadCache<T>(key: string): T | undefined {
  if (typeof window === "undefined") {
    return undefined
  }

  const raw =
    getStorageItem(`${CACHE_PREFIX}${key}`) ||
    getStorageItem(`${LEGACY_CACHE_PREFIX}${key}`)

  if (!raw) {
    return undefined
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

export function saveCache<T>(key: string, value: T) {
  setStorageItem(
    `${CACHE_PREFIX}${key}`,
    JSON.stringify({
      cachedAt: new Date().toISOString(),
      value,
    })
  )
}

export function getCachedValue<T>(key: string): T | undefined {
  return loadCache<{ cachedAt: string; value: T }>(key)?.value
}
