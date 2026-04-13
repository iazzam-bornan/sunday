import type {
  AppSettings,
  MondayTheme,
  ThemeMode,
  ThemePresetId,
  ThemeTokenKey,
  ThemeTokenMap,
} from "@/lib/monday/types"

const SETTINGS_KEY = "sunday:settings"
const LEGACY_SETTINGS_KEY = "monday-wrapper:settings"
const CACHE_PREFIX = "sunday:cache:"
const LEGACY_CACHE_PREFIX = "monday-wrapper:cache:"
const THEME_TOKEN_KEYS: Array<ThemeTokenKey> = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "border",
  "input",
  "ring",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
]

type ThemeDefinition = {
  id: ThemePresetId
  label: string
  description: string
  mode: ThemeMode
  variables?: ThemeTokenMap
}

export const THEME_TOKEN_LABELS: Record<ThemeTokenKey, string> = {
  background: "Background",
  foreground: "Foreground",
  card: "Card",
  "card-foreground": "Card text",
  popover: "Popover",
  "popover-foreground": "Popover text",
  primary: "Primary",
  "primary-foreground": "Primary text",
  secondary: "Secondary",
  "secondary-foreground": "Secondary text",
  muted: "Muted",
  "muted-foreground": "Muted text",
  accent: "Accent",
  "accent-foreground": "Accent text",
  border: "Border",
  input: "Input",
  ring: "Focus ring",
  sidebar: "Sidebar",
  "sidebar-foreground": "Sidebar text",
  "sidebar-primary": "Sidebar primary",
  "sidebar-primary-foreground": "Sidebar primary text",
  "sidebar-accent": "Sidebar accent",
  "sidebar-accent-foreground": "Sidebar accent text",
  "sidebar-border": "Sidebar border",
  "sidebar-ring": "Sidebar ring",
}

export const THEME_EDITOR_TOKENS: Array<ThemeTokenKey> = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "accent",
  "accent-foreground",
  "muted",
  "muted-foreground",
  "border",
  "input",
  "ring",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
]

export const THEME_PRESETS: Array<ThemeDefinition> = [
  {
    id: "sunday-light",
    label: "Sunday Light",
    description: "Clean bright default.",
    mode: "light",
  },
  {
    id: "sunday-dark",
    label: "Sunday Dark",
    description: "Clean dark default.",
    mode: "dark",
  },
  {
    id: "monday",
    label: "Monday",
    description: "Mirage dark with cornflower blue accents.",
    mode: "dark",
    variables: {
      background: "#181b34",
      foreground: "#ffffff",
      card: "#21254a",
      "card-foreground": "#ffffff",
      popover: "#21254a",
      "popover-foreground": "#ffffff",
      primary: "#6161ff",
      "primary-foreground": "#ffffff",
      secondary: "#24294f",
      "secondary-foreground": "#ffffff",
      muted: "#202448",
      "muted-foreground": "#b6bce8",
      accent: "#6161ff",
      "accent-foreground": "#ffffff",
      border: "#2f3565",
      input: "#2f3565",
      ring: "#6161ff",
      sidebar: "#14172d",
      "sidebar-foreground": "#ffffff",
      "sidebar-primary": "#6161ff",
      "sidebar-primary-foreground": "#ffffff",
      "sidebar-accent": "#202448",
      "sidebar-accent-foreground": "#ffffff",
      "sidebar-border": "#2f3565",
      "sidebar-ring": "#6161ff",
    },
  },
  {
    id: "discord",
    label: "Discord",
    description: "Blurple dark chat room.",
    mode: "dark",
    variables: {
      background: "#313338",
      foreground: "#f2f3f5",
      card: "#2b2d31",
      "card-foreground": "#f2f3f5",
      popover: "#1e1f22",
      "popover-foreground": "#f2f3f5",
      primary: "#5865f2",
      "primary-foreground": "#ffffff",
      secondary: "#404249",
      "secondary-foreground": "#f2f3f5",
      muted: "#232428",
      "muted-foreground": "#b5bac1",
      accent: "#5865f2",
      "accent-foreground": "#ffffff",
      border: "#1e1f22",
      input: "#1e1f22",
      ring: "#7c84f7",
      sidebar: "#2b2d31",
      "sidebar-foreground": "#dbdee1",
      "sidebar-primary": "#5865f2",
      "sidebar-primary-foreground": "#ffffff",
      "sidebar-accent": "#404249",
      "sidebar-accent-foreground": "#f2f3f5",
      "sidebar-border": "#1e1f22",
      "sidebar-ring": "#7c84f7",
    },
  },
  {
    id: "graphite",
    label: "Graphite",
    description: "Muted steel dark mode.",
    mode: "dark",
    variables: {
      background: "#0f1115",
      foreground: "#ecf0f7",
      card: "#171a20",
      "card-foreground": "#f8fafc",
      popover: "#171a20",
      "popover-foreground": "#f8fafc",
      primary: "#7dd3fc",
      "primary-foreground": "#082f49",
      secondary: "#1d232d",
      "secondary-foreground": "#e2e8f0",
      muted: "#1b2028",
      "muted-foreground": "#94a3b8",
      accent: "#7dd3fc",
      "accent-foreground": "#082f49",
      border: "#2c3440",
      input: "#2c3440",
      ring: "#7dd3fc",
      sidebar: "#12151b",
      "sidebar-foreground": "#e2e8f0",
      "sidebar-primary": "#7dd3fc",
      "sidebar-primary-foreground": "#082f49",
      "sidebar-accent": "#1d232d",
      "sidebar-accent-foreground": "#e2e8f0",
      "sidebar-border": "#2c3440",
      "sidebar-ring": "#7dd3fc",
    },
  },
  {
    id: "aurora",
    label: "Aurora",
    description: "Cool mint and ice light mode.",
    mode: "light",
    variables: {
      background: "#f5fbfb",
      foreground: "#16313b",
      card: "#ffffff",
      "card-foreground": "#16313b",
      popover: "#ffffff",
      "popover-foreground": "#16313b",
      primary: "#0ea5a4",
      "primary-foreground": "#ffffff",
      secondary: "#ddf7f4",
      "secondary-foreground": "#16313b",
      muted: "#e9f7f8",
      "muted-foreground": "#52717a",
      accent: "#14b8a6",
      "accent-foreground": "#ffffff",
      border: "#cbe8ea",
      input: "#cbe8ea",
      ring: "#0ea5a4",
      sidebar: "#ffffff",
      "sidebar-foreground": "#16313b",
      "sidebar-primary": "#0ea5a4",
      "sidebar-primary-foreground": "#ffffff",
      "sidebar-accent": "#e9f7f8",
      "sidebar-accent-foreground": "#16313b",
      "sidebar-border": "#cbe8ea",
      "sidebar-ring": "#0ea5a4",
    },
  },
]

type SundayStorageBridge = {
  getItem: (key: string) => string | null
  keys: () => Array<string>
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  removeMatching: (prefixes: Array<string>, exactKeys: Array<string>) => void
}

type SundayUpdaterState = {
  availableVersion?: string
  error?: string
  progressPercent: number
  status:
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "up-to-date"
    | "error"
    | "unavailable"
}

type SundayUpdaterBridge = {
  check: () => Promise<SundayUpdaterState>
  download: () => Promise<SundayUpdaterState>
  getState: () => Promise<SundayUpdaterState>
  install: () => Promise<SundayUpdaterState>
  onStateChange: (
    callback: (value: SundayUpdaterState) => void
  ) => () => void
}

declare global {
  interface Window {
    sundayStorage?: SundayStorageBridge
    sundayUpdater?: SundayUpdaterBridge
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
    const parsed = JSON.parse(raw) as AppSettings

    if (parsed.theme === "light") {
      parsed.theme = "sunday-light"
    } else if (parsed.theme === "dark") {
      parsed.theme = "sunday-dark"
    }

    return parsed
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

export function getResolvedThemeId(
  input?: AppSettings | MondayTheme
): ThemePresetId {
  if (!input) {
    return "sunday-light"
  }

  if (typeof input === "string") {
    if (input === "light") {
      return "sunday-light"
    }

    if (input === "dark") {
      return "sunday-dark"
    }

    return input
  }

  return getResolvedThemeId(input.theme)
}

export function getThemeDefinition(
  input?: AppSettings | MondayTheme
): ThemeDefinition {
  const themeId = getResolvedThemeId(input)

  if (themeId === "custom") {
    const settings = typeof input === "object" ? input : undefined

    return {
      id: "custom",
      label: "Custom",
      description: "Your own saved palette.",
      mode: settings?.themeMode || "dark",
      variables: settings?.customTheme || {},
    }
  }

  return (
    THEME_PRESETS.find((theme) => theme.id === themeId) || THEME_PRESETS[0]
  )
}

export function applyTheme(input: AppSettings | MondayTheme = "sunday-light") {
  const theme = getThemeDefinition(input)
  const root = document.documentElement

  root.classList.toggle("dark", theme.mode === "dark")

  for (const token of THEME_TOKEN_KEYS) {
    root.style.removeProperty(`--${token}`)
  }

  for (const [token, value] of Object.entries(theme.variables || {})) {
    root.style.setProperty(`--${token}`, value)
  }
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

export function createEmptyCustomTheme(): ThemeTokenMap {
  return {}
}
