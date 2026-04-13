import { Link, createFileRoute } from "@tanstack/react-router"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  ArrowReloadHorizontalIcon,
  Briefcase02Icon,
  FilterHorizontalIcon,
  GridViewIcon,
  Key01Icon,
  Moon02Icon,
  SearchIcon,
  Settings02Icon,
  SortingAZ01Icon,
  Sun02Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useServerFn } from "@tanstack/react-start"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core"

import type { KanbanState } from "@/components/kanban/types"
import type {
  AppSettings,
  BoardFilters,
  MondayBoardDetail,
  MondayBoardSummary,
  MondayTheme,
  MondayTicket,
} from "@/lib/monday/types"
import { KanbanColumn } from "@/components/kanban/kanban-column"
import { TicketCard } from "@/components/kanban/ticket-card"
import { TicketDetailPanel } from "@/components/kanban/ticket-detail-sheet"
import {
  createMondayTicket,
  getMondayBoard,
  getMondayBoards,
  getMondayBootstrap,
  moveMondayTicket,
} from "@/lib/monday/server"
import {
  applyTheme,
  getCachedValue,
  loadSettings,
  saveCache,
  saveSettings,
} from "@/lib/settings"

export const Route = createFileRoute("/")({
  loader: () => getMondayBootstrap(),
  component: App,
})

const NO_STATUS_COLUMN_ID = "no-status"
const BOARDS_CACHE_KEY = "boards"

function getBoardCacheKey(boardId: string) {
  return `board:${boardId}`
}

function App() {
  const bootstrap = Route.useLoaderData()
  const getBoards = useServerFn(getMondayBoards)
  const getBoard = useServerFn(getMondayBoard)
  const moveTicket = useServerFn(moveMondayTicket)
  const createTicket = useServerFn(createMondayTicket)
  const [settings, setSettings] = useState<AppSettings>({})
  const [apiTokenInput, setApiTokenInput] = useState("")
  const [theme, setTheme] = useState<MondayTheme>("light")
  const [boards, setBoards] = useState<Array<MondayBoardSummary>>([])
  const [boardSearch, setBoardSearch] = useState("")
  const [selectedBoardId, setSelectedBoardId] = useState(
    bootstrap.envDefaultBoardId || ""
  )
  const [board, setBoard] = useState<MondayBoardDetail>()
  const [kanban, setKanban] = useState<KanbanState>()
  const [activeTicketId, setActiveTicketId] = useState<string>()
  const [activeColumnId, setActiveColumnId] = useState<string>()
  const [overDragId, setOverDragId] = useState<string>()
  const [selectedTicketId, setSelectedTicketId] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [loadingLabel, setLoadingLabel] = useState("Loading Sunday")
  const [boardsLoading, setBoardsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [movingTicketId, setMovingTicketId] = useState<string>()
  const [addingColumnId, setAddingColumnId] = useState<string>()
  const [newTicketName, setNewTicketName] = useState("")
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [detailsPanelWidth, setDetailsPanelWidth] = useState(448)
  const [error, setError] = useState<string>()
  const [waitingForToken, setWaitingForToken] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const effectiveSettings = useMemo(
    () => ({
      ...settings,
      defaultBoardId: settings.defaultBoardId || selectedBoardId || undefined,
    }),
    [selectedBoardId, settings]
  )

  function persistSettings(nextSettings: AppSettings) {
    setSettings(nextSettings)
    saveSettings(nextSettings)
  }

  function getVisibleBoards(
    nextBoards: Array<MondayBoardSummary>,
    nextSettings: AppSettings
  ) {
    return nextBoards.filter(
      (nextBoard) => !nextSettings.hiddenBoardIds?.includes(nextBoard.id)
    )
  }

  const hydrateBoard = useCallback((nextBoard: MondayBoardDetail) => {
    const tickets = Object.fromEntries(
      nextBoard.tickets.map((ticket) => [ticket.id, ticket])
    )
    const columns = nextBoard.statusLabels.map((status) => ({
      ...status,
      ticketIds: nextBoard.tickets
        .filter((ticket) => ticket.statusIndex === status.index)
        .map((ticket) => ticket.id),
    }))
    const noStatusTickets = nextBoard.tickets
      .filter((ticket) => ticket.statusIndex === null)
      .map((ticket) => ticket.id)

    if (noStatusTickets.length) {
      columns.unshift({
        id: NO_STATUS_COLUMN_ID,
        index: -1,
        label: "No status",
        ticketIds: noStatusTickets,
      })
    }

    setBoard(nextBoard)
    const storedSettings = loadSettings()
    const columnOrder = storedSettings.columnOrderByBoard?.[nextBoard.id]

    if (columnOrder?.length) {
      columns.sort((a, b) => {
        const aIndex = columnOrder.indexOf(a.id)
        const bIndex = columnOrder.indexOf(b.id)

        return (
          (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) -
            (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex) ||
          a.index - b.index
        )
      })
    }

    setBoard(nextBoard)
    setKanban({ columns, tickets })
  }, [])

  const refreshBoard = useCallback(
    async (boardId = selectedBoardId, nextSettings = effectiveSettings) => {
      if (!boardId && !nextSettings.defaultBoardId) {
        setLoading(false)
        return
      }

      setRefreshing(true)
      setLoadingLabel(refreshing ? "Refreshing board" : "Loading board")
      setError(undefined)

      try {
        const nextBoard = await getBoard({
          data: { boardId, settings: nextSettings },
        })
        setSelectedBoardId(nextBoard.id)
        hydrateBoard(nextBoard)
        saveCache(getBoardCacheKey(nextBoard.id), nextBoard)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load Monday board."
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [effectiveSettings, getBoard, hydrateBoard, selectedBoardId]
  )

  useEffect(() => {
    const storedSettings = loadSettings()
    setSettings(storedSettings)
    setApiTokenInput(storedSettings.apiToken || "")
    setDetailsPanelWidth(storedSettings.detailsPanelWidth || 448)
    setTheme(storedSettings.theme || "light")
    applyTheme(storedSettings.theme || "light")

    async function boot() {
      if (!bootstrap.hasEnvToken && !storedSettings.apiToken?.trim()) {
        setWaitingForToken(true)
        setLoading(false)
        return
      }

      setLoadingLabel("Loading boards")
      setBoardsLoading(true)
      const cachedBoards =
        getCachedValue<Array<MondayBoardSummary>>(BOARDS_CACHE_KEY) || []

      if (cachedBoards.length) {
        setBoards(cachedBoards)
      }

      setError(undefined)

      try {
        const nextBoards = await getBoards({
          data: { settings: storedSettings },
        })
        setBoards(nextBoards)
        setBoardsLoading(false)
        saveCache(BOARDS_CACHE_KEY, nextBoards)

        const visibleBoards = getVisibleBoards(nextBoards, storedSettings)
        const storedBoardIds = [
          storedSettings.lastBoardId,
          storedSettings.defaultBoardId,
          bootstrap.envDefaultBoardId,
        ].filter((id): id is string => Boolean(id))
        const initialBoardId =
          storedBoardIds.find((id) =>
            visibleBoards.some((option) => option.id === id)
          ) ||
          visibleBoards[0]?.id ||
          ""
        setSelectedBoardId(initialBoardId)

        if (initialBoardId) {
          setLoadingLabel("Loading board")
          const cachedBoard = getCachedValue<MondayBoardDetail>(
            getBoardCacheKey(initialBoardId)
          )

          if (cachedBoard) {
            hydrateBoard(cachedBoard)
            setLoading(false)
          }

          const nextBoard = await getBoard({
            data: {
              boardId: initialBoardId,
              settings: { ...storedSettings, defaultBoardId: initialBoardId },
            },
          })
          hydrateBoard(nextBoard)
          saveCache(getBoardCacheKey(initialBoardId), nextBoard)
        }
      } catch (err) {
        setBoardsLoading(false)
        setError(
          err instanceof Error ? err.message : "Unable to connect to Monday."
        )
      } finally {
        setLoading(false)
      }
    }

    void boot()
  }, [bootstrap.envDefaultBoardId, getBoard, getBoards, hydrateBoard])

  useEffect(() => {
    if (!board || !kanban) {
      return
    }

    const storedTicketId = settings.lastOpenedTicketIdByBoard?.[board.id]
    const hasSelectedTicket = selectedTicketId
      ? Object.hasOwn(kanban.tickets, selectedTicketId)
      : false

    if (selectedTicketId && !hasSelectedTicket) {
      setSelectedTicketId(undefined)
      return
    }

    if (
      !selectedTicketId &&
      storedTicketId &&
      Object.hasOwn(kanban.tickets, storedTicketId)
    ) {
      setSelectedTicketId(storedTicketId)
    }
  }, [board, kanban, selectedTicketId, settings.lastOpenedTicketIdByBoard])

  const activeTicket =
    activeTicketId && kanban ? kanban.tickets[activeTicketId] : undefined
  const activeColumn =
    activeColumnId && kanban
      ? kanban.columns.find((column) => column.id === activeColumnId)
      : undefined
  const selectedTicket =
    selectedTicketId && kanban ? kanban.tickets[selectedTicketId] : undefined
  const visibleStatusIds = board
    ? settings.visibleStatusIdsByBoard?.[board.id]
    : undefined
  const boardFilters: BoardFilters =
    board && settings.boardFiltersByBoard?.[board.id]
      ? settings.boardFiltersByBoard[board.id]
      : { sort: "board" }
  const visibleColumns = useMemo(
    () =>
      kanban
        ? kanban.columns.filter(
            (column) =>
              !visibleStatusIds || visibleStatusIds.includes(column.id)
          )
        : [],
    [kanban, visibleStatusIds]
  )
  const activeDropColumnId =
    overDragId && kanban ? findColumnId(kanban, overDragId) : undefined
  const overColumnId =
    overDragId && kanban
      ? overDragId.startsWith("column:")
        ? overDragId.replace("column:", "")
        : findColumnId(kanban, overDragId)
      : undefined
  const hiddenColumnCount = kanban
    ? kanban.columns.length - visibleColumns.length
    : 0
  const filteredBoards = useMemo(
    () =>
      getVisibleBoards(boards, settings).filter((option) =>
        option.name.toLowerCase().includes(boardSearch.trim().toLowerCase())
      ),
    [boardSearch, boards, settings]
  )
  const assignees = useMemo(
    () =>
      kanban
        ? Array.from(
            new Map(
              Object.values(kanban.tickets)
                .flatMap((ticket) => ticket.assignees || [])
                .map((person) => [person.id, person])
            ).values()
          ).sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [kanban]
  )
  const priorities = useMemo(
    () =>
      kanban
        ? Array.from(
            new Map(
              Object.values(kanban.tickets)
                .filter((ticket) => Boolean(ticket.priority))
                .map((ticket) => [
                  ticket.priority as string,
                  {
                    color: ticket.priorityColor,
                    label: ticket.priority as string,
                  },
                ])
            ).values()
          ).sort((a, b) => a.label.localeCompare(b.label))
        : [],
    [kanban]
  )
  const filteredTicketsByColumn = useMemo(() => {
    if (!kanban) {
      return {}
    }

    const query = boardFilters.query?.trim().toLowerCase()
    const nextTicketsByColumn: Record<string, Array<MondayTicket>> = {}

    for (const column of kanban.columns) {
      const tickets = column.ticketIds
        .map((ticketId) => kanban.tickets[ticketId])
        .filter(Boolean)
        .filter((ticket) => {
          if (
            boardFilters.assigneeIds?.length &&
            !(ticket.assignees || []).some((person) =>
              boardFilters.assigneeIds?.includes(person.id)
            )
          ) {
            return false
          }

          if (
            boardFilters.priority &&
            ticket.priority !== boardFilters.priority
          ) {
            return false
          }

          if (!query) {
            return true
          }

          return [
            ticket.displayTitle,
            ticket.description,
            ticket.group,
            (ticket.assignees || []).map((person) => person.name).join(" "),
            ticket.priority,
            ticket.statusLabel,
          ]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLowerCase().includes(query))
        })

      nextTicketsByColumn[column.id] = sortTickets(tickets, boardFilters.sort)
    }

    return nextTicketsByColumn
  }, [boardFilters, kanban])

  function findColumnId(state: KanbanState, id: string) {
    if (state.columns.some((column) => column.id === id)) {
      return id
    }

    return state.columns.find((column) => column.ticketIds.includes(id))?.id
  }

  function onDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id)

    if (activeId.startsWith("column:")) {
      setActiveTicketId(undefined)
      setActiveColumnId(activeId.replace("column:", ""))
      return
    }

    setActiveColumnId(undefined)
    setActiveTicketId(activeId)
  }

  function onDragOver(event: DragOverEvent) {
    setOverDragId(event.over ? String(event.over.id) : undefined)
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveTicketId(undefined)
    setActiveColumnId(undefined)
    setOverDragId(undefined)

    if (!kanban || !board?.statusColumn || !event.over) {
      return
    }

    const activeId = String(event.active.id)
    const overId = String(event.over.id)

    if (activeId.startsWith("column:")) {
      const draggedColumnId = activeId.replace("column:", "")
      const targetColumnId = overId.startsWith("column:")
        ? overId.replace("column:", "")
        : findColumnId(kanban, overId)
      const fromIndex = kanban.columns.findIndex(
        (column) => column.id === draggedColumnId
      )
      const toIndex = kanban.columns.findIndex(
        (column) => column.id === targetColumnId
      )

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return
      }

      const nextColumns = arrayMove(kanban.columns, fromIndex, toIndex)
      setKanban({
        ...kanban,
        columns: nextColumns,
      })

      persistSettings({
        ...settings,
        columnOrderByBoard: {
          ...settings.columnOrderByBoard,
          [board.id]: nextColumns.map((column) => column.id),
        },
      })

      return
    }

    const fromColumnId = findColumnId(kanban, activeId)
    const toColumnId = findColumnId(kanban, overId)

    if (!fromColumnId || !toColumnId || toColumnId === NO_STATUS_COLUMN_ID) {
      return
    }

    const previousKanban = kanban
    const targetColumn = kanban.columns.find(
      (column) => column.id === toColumnId
    )

    if (!targetColumn) {
      return
    }

    const nextKanban: KanbanState = {
      tickets: {
        ...kanban.tickets,
        [activeId]: {
          ...kanban.tickets[activeId],
          statusIndex: targetColumn.index,
          statusLabel: targetColumn.label,
        },
      },
      columns: kanban.columns.map((column) => ({
        ...column,
        ticketIds: [...column.ticketIds],
      })),
    }

    const fromColumn = nextKanban.columns.find(
      (column) => column.id === fromColumnId
    )
    const toColumn = nextKanban.columns.find(
      (column) => column.id === toColumnId
    )

    if (!fromColumn || !toColumn) {
      return
    }

    const fromIndex = fromColumn.ticketIds.indexOf(activeId)

    if (fromColumnId === toColumnId) {
      const toIndex = toColumn.ticketIds.indexOf(overId)

      if (fromIndex !== -1 && toIndex !== -1) {
        toColumn.ticketIds = arrayMove(toColumn.ticketIds, fromIndex, toIndex)
      }
    } else {
      fromColumn.ticketIds = fromColumn.ticketIds.filter(
        (id) => id !== activeId
      )
      const overIndex = toColumn.ticketIds.indexOf(overId)
      const insertAt = overIndex === -1 ? toColumn.ticketIds.length : overIndex
      toColumn.ticketIds.splice(insertAt, 0, activeId)
    }

    setKanban(nextKanban)
    setMovingTicketId(activeId)
    setError(undefined)

    try {
      await moveTicket({
        data: {
          boardId: board.id,
          itemId: activeId,
          statusColumnId: board.statusColumn.id,
          statusIndex: targetColumn.index,
          settings: effectiveSettings,
        },
      })
    } catch (err) {
      setKanban(previousKanban)
      setError(err instanceof Error ? err.message : "Monday rejected the move.")
    } finally {
      setMovingTicketId(undefined)
    }
  }

  async function selectBoard(boardId: string) {
    setSelectedBoardId(boardId)
    setSelectedTicketId(undefined)
    setLoadingLabel("Loading board")
    const cachedBoard = getCachedValue<MondayBoardDetail>(
      getBoardCacheKey(boardId)
    )

    if (cachedBoard) {
      hydrateBoard(cachedBoard)
      setLoading(false)
    } else {
      setBoard(undefined)
      setKanban(undefined)
      setLoading(true)
    }

    persistSettings({
      ...settings,
      lastBoardId: boardId,
    })
    await refreshBoard(boardId, {
      ...effectiveSettings,
      defaultBoardId: boardId,
    })
  }

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark"

    setTheme(nextTheme)
    applyTheme(nextTheme)
    persistSettings({
      ...settings,
      theme: nextTheme,
    })
  }

  function setAllStatusesVisible() {
    if (!board || !kanban) {
      return
    }

    persistSettings({
      ...settings,
      visibleStatusIdsByBoard: {
        ...settings.visibleStatusIdsByBoard,
        [board.id]: kanban.columns.map((column) => column.id),
      },
    })
  }

  function setNoStatusesVisible() {
    if (!board) {
      return
    }

    persistSettings({
      ...settings,
      visibleStatusIdsByBoard: {
        ...settings.visibleStatusIdsByBoard,
        [board.id]: [],
      },
    })
  }

  function toggleStatus(columnId: string) {
    if (!board || !kanban) {
      return
    }

    const currentIds =
      settings.visibleStatusIdsByBoard?.[board.id] ||
      kanban.columns.map((column) => column.id)
    const nextIds = currentIds.includes(columnId)
      ? currentIds.filter((id) => id !== columnId)
      : [...currentIds, columnId]

    persistSettings({
      ...settings,
      visibleStatusIdsByBoard: {
        ...settings.visibleStatusIdsByBoard,
        [board.id]: nextIds,
      },
    })
  }

  function updateBoardFilters(nextFilters: BoardFilters) {
    if (!board) {
      return
    }

    persistSettings({
      ...settings,
      boardFiltersByBoard: {
        ...settings.boardFiltersByBoard,
        [board.id]: nextFilters,
      },
    })
  }

  function clearBoardFilters() {
    updateBoardFilters({ sort: "board" })
  }

  function openTicketPanel(ticket: MondayTicket) {
    setSelectedTicketId(ticket.id)

    if (!board) {
      return
    }

    persistSettings({
      ...settings,
      lastOpenedTicketIdByBoard: {
        ...settings.lastOpenedTicketIdByBoard,
        [board.id]: ticket.id,
      },
    })
  }

  function closeTicketPanel() {
    setSelectedTicketId(undefined)

    if (!board) {
      return
    }

    const lastOpenedTicketIdByBoard = {
      ...settings.lastOpenedTicketIdByBoard,
    }

    delete lastOpenedTicketIdByBoard[board.id]

    persistSettings({
      ...settings,
      lastOpenedTicketIdByBoard,
    })
  }

  function resizeDetailsPanel(width: number) {
    setDetailsPanelWidth(width)
    persistSettings({
      ...settings,
      detailsPanelWidth: width,
    })
  }

  async function addTicketToColumn(columnId: string) {
    if (!board?.statusColumn || !newTicketName.trim()) {
      return
    }

    const column = kanban?.columns.find((option) => option.id === columnId)

    if (!column || column.id === NO_STATUS_COLUMN_ID) {
      return
    }

    setCreatingTicket(true)
    setError(undefined)

    try {
      await createTicket({
        data: {
          boardId: board.id,
          itemName: newTicketName.trim(),
          settings: effectiveSettings,
          statusColumnId: board.statusColumn.id,
          statusIndex: column.index,
        },
      })
      setAddingColumnId(undefined)
      setNewTicketName("")
      await refreshBoard(board.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create ticket.")
    } finally {
      setCreatingTicket(false)
    }
  }

  function saveApiTokenAndConnect() {
    const apiToken = apiTokenInput.trim()

    if (!apiToken) {
      setError("Paste a Monday API token to connect Sunday.")
      return
    }

    const nextSettings = {
      ...settings,
      apiToken,
    }

    setWaitingForToken(false)
    persistSettings(nextSettings)
    window.location.reload()
  }

  if (waitingForToken) {
    return (
      <main className="flex h-svh max-h-svh min-h-0 flex-col overflow-hidden bg-background">
        <TokenEmptyState
          apiToken={apiTokenInput}
          error={error}
          onApiTokenChange={setApiTokenInput}
          onConnect={saveApiTokenAndConnect}
        />
      </main>
    )
  }

  return (
    <main className="flex h-svh max-h-svh min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-normal">Sunday</h1>
              {bootstrap.hasEnvToken ? (
                <Badge variant="outline">env token</Badge>
              ) : null}
              {movingTicketId ? (
                <Badge variant="secondary">syncing move</Badge>
              ) : null}
              {refreshing ? (
                <Badge variant="secondary" className="gap-1">
                  <Spinner className="size-3" />
                  refreshing
                </Badge>
              ) : null}
              {hiddenColumnCount ? (
                <Badge variant="outline">{hiddenColumnCount} hidden</Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Choose a board, move tickets, keep Monday in sync.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:ms-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[17rem] justify-start">
                  {boardsLoading ? (
                    <Spinner className="size-4" />
                  ) : (
                    <HugeiconsIcon icon={Briefcase02Icon} strokeWidth={2} />
                  )}
                  <span className="min-w-0 truncate text-start">
                    {board?.name || "Choose board"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[20rem]">
                <div className="relative">
                  <HugeiconsIcon
                    icon={SearchIcon}
                    strokeWidth={2}
                    className="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={boardSearch}
                    onChange={(event) => setBoardSearch(event.target.value)}
                    placeholder="Search boards"
                    className="ps-8"
                  />
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {boardsLoading ? (
                    <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                      <Spinner className="size-3.5" />
                      Loading boards
                    </div>
                  ) : null}
                  {filteredBoards.map((option) => (
                    <Button
                      key={option.id}
                      variant={
                        option.id === selectedBoardId ? "secondary" : "ghost"
                      }
                      className="w-full justify-start"
                      onClick={() => {
                        setBoardSearch("")
                        void selectBoard(option.id)
                      }}
                    >
                      <span className="truncate">{option.name}</span>
                    </Button>
                  ))}
                  {filteredBoards.length === 0 && !boardsLoading ? (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      No boards found
                    </p>
                  ) : null}
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void refreshBoard()}
              aria-label="Refresh"
            >
              <HugeiconsIcon icon={ArrowReloadHorizontalIcon} strokeWidth={2} />
            </Button>
            <Button asChild variant="ghost" size="icon">
              <Link to="/settings" aria-label="Settings">
                <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="ms-auto lg:ms-0"
            >
              <HugeiconsIcon
                icon={theme === "dark" ? Sun02Icon : Moon02Icon}
                strokeWidth={2}
              />
            </Button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4">
          {board ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{board.name}</Badge>
              <span>{board.tickets.length} tickets</span>
              <span>
                {board.statusColumn?.title || "No status column found"}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <HugeiconsIcon icon={GridViewIcon} strokeWidth={2} />
                    Status
                    {hiddenColumnCount ? (
                      <Badge variant="secondary">{hiddenColumnCount}</Badge>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Visible statuses</DropdownMenuLabel>
                  {kanban?.columns.map((column) => {
                    const isVisible =
                      !visibleStatusIds || visibleStatusIds.includes(column.id)

                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={isVisible}
                        onCheckedChange={() => toggleStatus(column.id)}
                        onSelect={(event) => event.preventDefault()}
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <span
                            className="size-2 shrink-0 border border-border"
                            style={{
                              backgroundColor: column.color || "transparent",
                            }}
                          />
                          <span className="truncate">{column.label}</span>
                        </span>
                      </DropdownMenuCheckboxItem>
                    )
                  })}
                  <DropdownMenuSeparator />
                  <div className="flex gap-1 p-2">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={setAllStatusesVisible}
                    >
                      Show all
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={setNoStatusesVisible}
                    >
                      Hide all
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <HugeiconsIcon icon={UserIcon} strokeWidth={2} />
                    {boardFilters.assigneeIds?.length
                      ? `${boardFilters.assigneeIds.length} people`
                      : "Assignee"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>People</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={!boardFilters.assigneeIds?.length}
                    onCheckedChange={() =>
                      updateBoardFilters({
                        ...boardFilters,
                        assigneeIds: undefined,
                      })
                    }
                    onSelect={(event) => event.preventDefault()}
                  >
                    Everyone
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {assignees.map((person) => {
                    const checked =
                      boardFilters.assigneeIds?.includes(person.id) || false

                    return (
                      <DropdownMenuCheckboxItem
                        key={person.id}
                        checked={checked}
                        onCheckedChange={() => {
                          const currentIds = boardFilters.assigneeIds || []
                          const assigneeIds = checked
                            ? currentIds.filter((id) => id !== person.id)
                            : [...currentIds, person.id]

                          updateBoardFilters({
                            ...boardFilters,
                            assigneeIds: assigneeIds.length
                              ? assigneeIds
                              : undefined,
                          })
                        }}
                        onSelect={(event) => event.preventDefault()}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar size="sm">
                            <AvatarImage
                              alt={person.name}
                              src={person.avatarUrl}
                            />
                            <AvatarFallback>
                              {getInitials(person.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{person.name}</span>
                        </span>
                      </DropdownMenuCheckboxItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <HugeiconsIcon
                      icon={FilterHorizontalIcon}
                      strokeWidth={2}
                    />
                    {boardFilters.priority ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 border border-border"
                          style={{
                            backgroundColor:
                              priorities.find(
                                (priority) =>
                                  priority.label === boardFilters.priority
                              )?.color || "transparent",
                          }}
                        />
                        {boardFilters.priority}
                      </span>
                    ) : (
                      "Priority"
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuRadioGroup
                    value={boardFilters.priority || "__all__"}
                    onValueChange={(value) =>
                      updateBoardFilters({
                        ...boardFilters,
                        priority: value === "__all__" ? undefined : value,
                      })
                    }
                  >
                    <DropdownMenuRadioItem value="__all__">
                      Any priority
                    </DropdownMenuRadioItem>
                    {priorities.map((priority) => (
                      <DropdownMenuRadioItem
                        key={priority.label}
                        value={priority.label}
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <span
                            className="size-2 shrink-0 border border-border"
                            style={{
                              backgroundColor: priority.color || "transparent",
                            }}
                          />
                          <span className="truncate">{priority.label}</span>
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="relative">
                <HugeiconsIcon
                  icon={SearchIcon}
                  strokeWidth={2}
                  className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={boardFilters.query || ""}
                  onChange={(event) =>
                    updateBoardFilters({
                      ...boardFilters,
                      query: event.target.value || undefined,
                    })
                  }
                  placeholder="Search tickets"
                  className="h-7 w-[12rem] ps-7 text-xs"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <HugeiconsIcon icon={SortingAZ01Icon} strokeWidth={2} />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuRadioGroup
                    value={boardFilters.sort || "board"}
                    onValueChange={(value) =>
                      updateBoardFilters({
                        ...boardFilters,
                        sort: value as BoardFilters["sort"],
                      })
                    }
                  >
                    <DropdownMenuRadioItem value="board">
                      Board order
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="title-asc">
                      Title A-Z
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="title-desc">
                      Title Z-A
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="updated-desc">
                      Recently updated
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="updated-asc">
                      Oldest updated
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="priority-asc">
                      Priority asc
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="priority-desc">
                      Priority desc
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="due-date-asc">
                      Due date soonest
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="due-date-desc">
                      Due date latest
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="ghost" size="sm" onClick={clearBoardFilters}>
                Reset
              </Button>
            </div>
          ) : null}

          {loading ? (
            <BoardLoadingState label={loadingLabel} />
          ) : kanban && board?.statusColumn ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={(event) => void onDragEnd(event)}
            >
              <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden pb-3">
                <SortableContext
                  items={visibleColumns.map((column) => `column:${column.id}`)}
                  strategy={horizontalListSortingStrategy}
                >
                  {visibleColumns.map((column) => (
                    <Fragment key={column.id}>
                      {activeColumnId &&
                      overColumnId === column.id &&
                      activeColumnId !== column.id ? (
                        <ColumnGhost key={`ghost:${column.id}`} />
                      ) : null}
                      <KanbanColumn
                        key={column.id}
                        adding={addingColumnId === column.id}
                        addingName={newTicketName}
                        column={column}
                        creating={creatingTicket}
                        isColumnDragActive={Boolean(activeColumnId)}
                        overId={
                          activeDropColumnId === column.id
                            ? overDragId
                            : undefined
                        }
                        showDropIndicator={Boolean(
                          activeTicketId && activeDropColumnId === column.id
                        )}
                        tickets={filteredTicketsByColumn[column.id]}
                        onAddingNameChange={setNewTicketName}
                        onCancelAdd={() => {
                          setAddingColumnId(undefined)
                          setNewTicketName("")
                        }}
                        onCreateTicket={() => void addTicketToColumn(column.id)}
                        onOpenTicket={openTicketPanel}
                        onStartAdd={() => {
                          setAddingColumnId(column.id)
                          setNewTicketName("")
                        }}
                      />
                    </Fragment>
                  ))}
                </SortableContext>
              </div>
              <DragOverlay>
                {activeTicket ? (
                  <div className="w-[18rem]">
                    <TicketCard
                      ticket={activeTicket}
                      onOpen={() => undefined}
                    />
                  </div>
                ) : activeColumn ? (
                  <ColumnDragOverlay
                    column={activeColumn}
                    tickets={filteredTicketsByColumn[activeColumn.id]}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <div className="flex min-h-[24rem] items-center justify-center border border-dashed border-border p-8 text-center">
              <div className="max-w-md">
                <h2 className="font-medium">Connect Monday to start</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add an API token in Settings or set MONDAY_API_TOKEN. Then
                  choose a board with a status column.
                </p>
                <Button asChild className="mt-4" variant="outline">
                  <Link to="/settings">Open settings</Link>
                </Button>
              </div>
            </div>
          )}
        </section>

        {selectedTicket ? (
          <TicketDetailPanel
            boardId={board?.id || selectedBoardId}
            panelWidth={detailsPanelWidth}
            settings={effectiveSettings}
            ticket={selectedTicket}
            onClose={closeTicketPanel}
            onPanelWidthChange={resizeDetailsPanel}
            onTicketChanged={() => void refreshBoard()}
          />
        ) : null}
      </div>
    </main>
  )
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("")
}

function sortTickets(
  tickets: Array<MondayTicket>,
  sort: BoardFilters["sort"] = "board"
) {
  switch (sort) {
    case "title-asc":
      return tickets.sort((a, b) =>
        a.displayTitle.localeCompare(b.displayTitle)
      )
    case "title-desc":
      return tickets.sort((a, b) =>
        b.displayTitle.localeCompare(a.displayTitle)
      )
    case "updated-asc":
      return tickets.sort((a, b) =>
        (a.updatedAt || "").localeCompare(b.updatedAt || "")
      )
    case "updated-desc":
      return tickets.sort((a, b) =>
        (b.updatedAt || "").localeCompare(a.updatedAt || "")
      )
    case "priority-asc":
      return tickets.sort(
        (a, b) =>
          (b.priorityIndex ?? Number.MAX_SAFE_INTEGER) -
            (a.priorityIndex ?? Number.MAX_SAFE_INTEGER) ||
          (a.priority || "").localeCompare(b.priority || "")
      )
    case "priority-desc":
      return tickets.sort(
        (a, b) =>
          (a.priorityIndex ?? -1) - (b.priorityIndex ?? -1) ||
          (b.priority || "").localeCompare(a.priority || "")
      )
    case "due-date-asc":
      return tickets.sort((a, b) =>
        (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99")
      )
    case "due-date-desc":
      return tickets.sort((a, b) =>
        (b.dueDate || "").localeCompare(a.dueDate || "")
      )
    default:
      return tickets
  }
}

function BoardLoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
      <div className="flex h-full w-[19rem] shrink-0 flex-col border border-border bg-card">
        <div className="border-b border-border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Spinner />
            {label}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Pulling the latest Monday data.
          </p>
        </div>
        <div className="grid gap-2 p-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="border border-border bg-background p-3">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-full w-[19rem] shrink-0 border border-border bg-muted/20 p-3"
        >
          <Skeleton className="h-4 w-28" />
          <div className="mt-5 grid gap-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

function TokenEmptyState({
  apiToken,
  error,
  onApiTokenChange,
  onConnect,
}: {
  apiToken: string
  error?: string
  onApiTokenChange: (value: string) => void
  onConnect: () => void
}) {
  return (
    <section className="flex min-h-0 flex-1 items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center border border-border bg-background">
            <HugeiconsIcon icon={Key01Icon} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Connect Sunday to Monday</h1>
            <p className="text-sm text-muted-foreground">
              Add a Monday API token to load your boards and tickets.
            </p>
          </div>
        </div>

        <form
          className="mt-6 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            onConnect()
          }}
        >
          <label className="grid gap-1.5 text-sm font-medium">
            Monday API token
            <Input
              type="password"
              value={apiToken}
              onChange={(event) => onApiTokenChange(event.target.value)}
              placeholder="Paste your personal API token"
              autoFocus
            />
          </label>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button type="submit" className="justify-center">
            Connect
          </Button>
        </form>

        <div className="mt-6 border border-border bg-background p-4 text-sm">
          <h2 className="font-medium">How to get a token</h2>
          <ol className="mt-3 list-decimal space-y-2 ps-4 text-muted-foreground">
            <li>Open Monday and click your profile avatar.</li>
            <li>Go to Developers, then My access tokens.</li>
            <li>Create or copy a personal API token.</li>
            <li>Paste it here. Sunday saves it locally on this device.</li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            Managed installs can set MONDAY_API_TOKEN before launching Sunday,
            and this screen will be skipped.
          </p>
        </div>
      </div>
    </section>
  )
}

function ColumnGhost() {
  return (
    <div className="h-full min-h-0 w-[19rem] shrink-0 border border-dashed border-foreground/50 bg-foreground/5 shadow-inner" />
  )
}

function ColumnDragOverlay({
  column,
  tickets,
}: {
  column: KanbanState["columns"][number]
  tickets: Array<MondayTicket>
}) {
  return (
    <section
      className="pointer-events-none flex max-h-[calc(100vh-8rem)] min-h-0 w-[19rem] flex-col overflow-hidden border border-foreground/30 bg-background shadow-2xl"
      style={getColumnTintStyle(column.color)}
    >
      <div
        className="h-1 shrink-0"
        style={{ backgroundColor: column.color || "transparent" }}
      />
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-sm font-medium">{column.label}</h2>
          <Badge variant="outline">{tickets.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Monday status {column.index}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2">
        {tickets.slice(0, 5).map((ticket) => (
          <article
            key={ticket.id}
            className="border border-border bg-card p-3 shadow-sm"
          >
            <div className="text-[13px] leading-snug font-medium">
              {ticket.displayTitle}
            </div>
            {ticket.description ? (
              <div className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {ticket.description}
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ticket.statusLabel ? (
                <Badge
                  variant="outline"
                  style={getBadgeColorStyle(ticket.statusColor)}
                >
                  {ticket.statusLabel}
                </Badge>
              ) : null}
              {ticket.priority ? (
                <Badge
                  variant="secondary"
                  style={getBadgeColorStyle(ticket.priorityColor)}
                >
                  {ticket.priority}
                </Badge>
              ) : null}
            </div>
          </article>
        ))}
        {tickets.length > 5 ? (
          <div className="border border-dashed border-border bg-background/80 px-3 py-2 text-center text-xs text-muted-foreground">
            +{tickets.length - 5} more
          </div>
        ) : null}
      </div>
    </section>
  )
}

function getColumnTintStyle(color?: string) {
  if (!color) {
    return undefined
  }

  return {
    background: `color-mix(in srgb, ${color} 3%, var(--background))`,
    borderColor: `color-mix(in srgb, ${color} 22%, var(--border))`,
  }
}

function getBadgeColorStyle(color?: string) {
  if (!color) {
    return undefined
  }

  return {
    backgroundColor: color,
    borderColor: color,
    color: "white",
  }
}
