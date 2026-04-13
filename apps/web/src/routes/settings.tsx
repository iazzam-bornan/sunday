import { Link, createFileRoute } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  Briefcase02Icon,
  Delete02Icon,
  Moon02Icon,
  Sun02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { useEffect, useState } from "react"

import type {
  AppSettings,
  MondayBoardSummary,
  ThemeMode,
  ThemePresetId,
  ThemeTokenKey,
} from "@/lib/monday/types"
import { getMondayBoards, getMondayBootstrap } from "@/lib/monday/server"
import {
  THEME_EDITOR_TOKENS,
  THEME_PRESETS,
  THEME_TOKEN_LABELS,
  applyTheme,
  clearAllSundayData,
  clearSettings,
  createEmptyCustomTheme,
  getCachedValue,
  getResolvedThemeId,
  getThemeDefinition,
  loadSettings,
  saveCache,
  saveSettings
} from "@/lib/settings"

const BOARDS_CACHE_KEY = "boards"

export const Route = createFileRoute("/settings")({
  loader: () => getMondayBootstrap(),
  component: SettingsPage,
})

function SettingsPage() {
  const bootstrap = Route.useLoaderData()
  const refreshBootstrap = useServerFn(getMondayBootstrap)
  const getBoards = useServerFn(getMondayBoards)
  const [settings, setSettings] = useState<AppSettings>({})
  const [boards, setBoards] = useState<Array<MondayBoardSummary>>([])
  const [theme, setTheme] = useState<ThemePresetId>("sunday-light")
  const [saved, setSaved] = useState(false)
  const [hasEnvToken, setHasEnvToken] = useState(bootstrap.hasEnvToken)
  const [boardError, setBoardError] = useState<string>()
  const [boardsLoading, setBoardsLoading] = useState(false)
  const activeThemeDefinition = getThemeDefinition(settings)

  function persistSettings(nextSettings: AppSettings) {
    setSettings(nextSettings)
    saveSettings(nextSettings)
  }

  function flashSaved() {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  useEffect(() => {
    const storedSettings = loadSettings()

    setSettings(storedSettings)
    setTheme(getResolvedThemeId(storedSettings))
    applyTheme(storedSettings)

    async function loadBoards() {
      setBoardsLoading(true)
      const cachedBoards =
        getCachedValue<Array<MondayBoardSummary>>(BOARDS_CACHE_KEY) || []

      if (cachedBoards.length) {
        setBoards(cachedBoards)
      }

      try {
        const nextBoards = await getBoards({
          data: { settings: storedSettings },
        })

        setBoards(nextBoards)
        saveCache(BOARDS_CACHE_KEY, nextBoards)
      } catch (err) {
        setBoardError(
          err instanceof Error ? err.message : "Unable to load boards."
        )
      } finally {
        setBoardsLoading(false)
      }
    }

    void loadBoards()
  }, [])

  async function save() {
    saveSettings(settings)
    flashSaved()
    const nextBootstrap = await refreshBootstrap()
    setHasEnvToken(nextBootstrap.hasEnvToken)
  }

  function clear() {
    clearSettings()
    setSettings({})
    setTheme("sunday-light")
    applyTheme("sunday-light")
    flashSaved()
  }

  function resetApp() {
    clearAllSundayData()
    window.location.assign("/")
  }

  function toggleTheme() {
    const nextTheme: ThemePresetId =
      activeThemeDefinition.mode === "dark" ? "sunday-light" : "sunday-dark"

    setTheme(nextTheme)
    const nextSettings = {
      ...settings,
      theme: nextTheme,
    }
    applyTheme(nextSettings)
    persistSettings(nextSettings)
  }

  function selectTheme(nextTheme: ThemePresetId) {
    setTheme(nextTheme)
    const nextSettings = {
      ...settings,
      theme: nextTheme,
      customTheme:
        nextTheme === "custom"
          ? settings.customTheme || createEmptyCustomTheme()
          : settings.customTheme,
      themeMode:
        nextTheme === "custom" ? settings.themeMode || "dark" : settings.themeMode,
    }
    persistSettings(nextSettings)
    flashSaved()
    applyTheme(nextSettings)
  }

  function updateCustomThemeMode(themeMode: ThemeMode) {
    const nextSettings = {
      ...settings,
      theme: "custom" as const,
      themeMode,
      customTheme: settings.customTheme || createEmptyCustomTheme(),
    }
    setTheme("custom")
    persistSettings(nextSettings)
    flashSaved()
    applyTheme(nextSettings)
  }

  function updateCustomThemeColor(token: ThemeTokenKey, value: string) {
    const nextCustomTheme = {
      ...(settings.customTheme || createEmptyCustomTheme()),
    }

    if (value.trim()) {
      nextCustomTheme[token] = value
    } else {
      delete nextCustomTheme[token]
    }

    const nextSettings = {
      ...settings,
      theme: "custom" as const,
      customTheme: nextCustomTheme,
      themeMode: settings.themeMode || "dark",
    }
    setTheme("custom")
    persistSettings(nextSettings)
    flashSaved()
    applyTheme(nextSettings)
  }

  function updateConnection(nextSettings: AppSettings) {
    setSettings(nextSettings)
  }

  function saveConnection() {
    void save()
  }

  function setBoardHidden(boardId: string, hidden: boolean) {
    const currentIds = settings.hiddenBoardIds || []
    const hiddenBoardIds = hidden
      ? Array.from(new Set([...currentIds, boardId]))
      : currentIds.filter((id) => id !== boardId)

    persistSettings({
      ...settings,
      hiddenBoardIds,
    })
  }

  function hideAllBoards() {
    persistSettings({
      ...settings,
      hiddenBoardIds: boards.map((board) => board.id),
    })
  }

  function showAllBoards() {
    persistSettings({
      ...settings,
      hiddenBoardIds: [],
    })
  }

  return (
    <main className="min-h-svh bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">Settings</h1>
          <p className="text-xs text-muted-foreground">
            Local overrides are saved in this browser.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/">Board</Link>
        </Button>
      </header>

      <section className="mx-auto w-full max-w-5xl px-4 py-6">
        <Tabs
          defaultValue="general"
          orientation="vertical"
          className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)]"
        >
          <TabsList
            variant="line"
            className="w-full items-stretch justify-start border border-border bg-card p-2"
          >
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="connection">Connection</TabsTrigger>
            <TabsTrigger value="boards">Boards</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="min-w-0">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-medium">General</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Theme presets, custom palette, and local app preferences.
                  </p>
                </div>
                {saved ? <Badge variant="secondary">saved</Badge> : null}
              </div>
              <Separator className="my-4" />
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label>Theme preset</Label>
                  <div className="grid gap-2 md:grid-cols-2">
                    {THEME_PRESETS.map((preset) => {
                      const selected = theme === preset.id

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => selectTheme(preset.id)}
                          className={`grid gap-1 border p-3 text-left transition ${
                            selected
                              ? "border-primary bg-primary/8"
                              : "border-border bg-background"
                          }`}
                        >
                          <span className="text-sm font-medium">
                            {preset.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {preset.description}
                          </span>
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => selectTheme("custom")}
                      className={`grid gap-1 border p-3 text-left transition ${
                        theme === "custom"
                          ? "border-primary bg-primary/8"
                          : "border-border bg-background"
                      }`}
                    >
                      <span className="text-sm font-medium">Custom</span>
                      <span className="text-xs text-muted-foreground">
                        Build your own palette.
                      </span>
                    </button>
                  </div>
                </div>
                {theme === "custom" ? (
                  <div className="grid gap-3 border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Label>Custom theme</Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Changes apply live and save with your app settings.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={
                            (settings.themeMode || "dark") === "light"
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => updateCustomThemeMode("light")}
                        >
                          Light base
                        </Button>
                        <Button
                          variant={
                            (settings.themeMode || "dark") === "dark"
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => updateCustomThemeMode("dark")}
                        >
                          Dark base
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {THEME_EDITOR_TOKENS.map((token) => (
                        <label key={token} className="grid gap-1.5">
                          <span className="text-xs font-medium">
                            {THEME_TOKEN_LABELS[token]}
                          </span>
                          <div className="flex items-center gap-2">
                            <Input
                              type="color"
                              value={toColorInputValue(
                                settings.customTheme?.[token]
                              )}
                              onChange={(event) =>
                                updateCustomThemeColor(token, event.target.value)
                              }
                              className="h-9 w-14 p-1"
                            />
                            <Input
                              value={settings.customTheme?.[token] || ""}
                              placeholder="Default"
                              onChange={(event) =>
                                updateCustomThemeColor(token, event.target.value)
                              }
                            />
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <Separator className="my-4" />
              <div className="flex flex-wrap items-center justify-between gap-3 border border-border p-3">
                <div>
                  <Label>Quick toggle</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Jump between Sunday Light and Sunday Dark.
                  </p>
                </div>
                <Button variant="outline" onClick={toggleTheme}>
                  <HugeiconsIcon
                    icon={
                      activeThemeDefinition.mode === "dark"
                        ? Sun02Icon
                        : Moon02Icon
                    }
                    strokeWidth={2}
                  />
                  {activeThemeDefinition.mode === "dark"
                    ? "Use light"
                    : "Use dark"}
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-destructive/30 bg-destructive/5 p-3">
                <div>
                  <Label>Reset Sunday</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Clears settings, cached boards, cached tickets, filters,
                    column order, and saved panel state.
                  </p>
                </div>
                <Button variant="destructive" onClick={resetApp}>
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                  Clear all data
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="connection" className="min-w-0">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">Monday connection</h2>
                {hasEnvToken ? (
                  <Badge variant="outline">MONDAY_API_TOKEN found</Badge>
                ) : null}
                {saved ? <Badge variant="secondary">saved</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Leave a field empty to use the matching .env value.
              </p>
              <Separator className="my-4" />
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="api-token">API token override</Label>
                  <Input
                    id="api-token"
                    type="password"
                    value={settings.apiToken || ""}
                    placeholder={
                      hasEnvToken
                        ? "Using MONDAY_API_TOKEN"
                        : "Paste Monday API token"
                    }
                    onChange={(event) =>
                      updateConnection({
                        ...settings,
                        apiToken: event.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="board-id">Default board ID</Label>
                  <Input
                    id="board-id"
                    value={settings.defaultBoardId || ""}
                    placeholder={
                      bootstrap.envDefaultBoardId ||
                      "Choose from the board dropdown"
                    }
                    onChange={(event) =>
                      updateConnection({
                        ...settings,
                        defaultBoardId: event.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="status-column-id">Status column ID</Label>
                  <Input
                    id="status-column-id"
                    value={settings.statusColumnId || ""}
                    placeholder={
                      bootstrap.envStatusColumnId ||
                      "First status column on the board"
                    }
                    onChange={(event) =>
                      updateConnection({
                        ...settings,
                        statusColumnId: event.target.value || undefined,
                      })
                    }
                  />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={saveConnection}>Save connection</Button>
                <Button variant="ghost" onClick={clear}>
                  Clear all local settings
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="boards" className="min-w-0">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={Briefcase02Icon} strokeWidth={2} />
                    <h2 className="font-medium">Boards</h2>
                    {boardsLoading ? <Spinner className="size-3.5" /> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Hidden boards stay out of the board picker. Changes save
                    immediately.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={showAllBoards}>
                    Show all
                  </Button>
                  <Button variant="ghost" size="sm" onClick={hideAllBoards}>
                    Hide all
                  </Button>
                </div>
              </div>
              <Separator className="my-4" />
              {boardError ? (
                <p className="text-xs text-destructive">{boardError}</p>
              ) : boardsLoading && boards.length === 0 ? (
                <div className="grid gap-2">
                  {[0, 1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between border border-border p-2"
                    >
                      <Skeleton className="h-3 w-48" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid max-h-[32rem] gap-2 overflow-y-auto pr-1">
                  {boards.map((board) => {
                    const hidden =
                      settings.hiddenBoardIds?.includes(board.id) || false

                    return (
                      <label
                        key={board.id}
                        className="flex items-center justify-between gap-3 border border-border p-2 text-xs"
                      >
                        <span className="min-w-0 truncate">{board.name}</span>
                        <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                          {hidden ? "Hidden" : "Shown"}
                          <Checkbox
                            checked={!hidden}
                            onCheckedChange={(checked) =>
                              setBoardHidden(board.id, checked !== true)
                            }
                          />
                        </span>
                      </label>
                    )
                  })}
                  {boards.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      Boards appear here after Monday connects.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  )
}

function toColorInputValue(value?: string) {
  if (!value) {
    return "#0f172a"
  }

  return value.startsWith("#") ? value : "#0f172a"
}
