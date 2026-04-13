export type MondaySettings = {
  apiToken?: string
  defaultBoardId?: string
  statusColumnId?: string
}

export type ThemeMode = "light" | "dark"

export type ThemePresetId =
  | "sunday-light"
  | "sunday-dark"
  | "monday"
  | "discord"
  | "graphite"
  | "aurora"
  | "custom"

export type MondayTheme = ThemePresetId | ThemeMode

export type ThemeTokenKey =
  | "background"
  | "foreground"
  | "card"
  | "card-foreground"
  | "popover"
  | "popover-foreground"
  | "primary"
  | "primary-foreground"
  | "secondary"
  | "secondary-foreground"
  | "muted"
  | "muted-foreground"
  | "accent"
  | "accent-foreground"
  | "border"
  | "input"
  | "ring"
  | "sidebar"
  | "sidebar-foreground"
  | "sidebar-primary"
  | "sidebar-primary-foreground"
  | "sidebar-accent"
  | "sidebar-accent-foreground"
  | "sidebar-border"
  | "sidebar-ring"

export type ThemeTokenMap = Partial<Record<ThemeTokenKey, string>>

export type BoardFilters = {
  assigneeIds?: Array<string>
  priority?: string
  query?: string
  sort?:
    | "board"
    | "title-asc"
    | "title-desc"
    | "updated-desc"
    | "updated-asc"
    | "priority-asc"
    | "priority-desc"
    | "due-date-asc"
    | "due-date-desc"
}

export type BoardViewMode = "board" | "list"

export type AppSettings = MondaySettings & {
  boardFiltersByBoard?: Record<string, BoardFilters>
  boardViewByBoard?: Record<string, BoardViewMode>
  collapsedListStatusIdsByBoard?: Record<string, Array<string>>
  hiddenBoardIds?: Array<string>
  lastBoardId?: string
  lastOpenedTicketIdByBoard?: Record<string, string>
  detailsPanelWidth?: number
  columnOrderByBoard?: Record<string, Array<string>>
  theme?: MondayTheme
  themeMode?: ThemeMode
  customTheme?: ThemeTokenMap
  visibleStatusIdsByBoard?: Record<string, Array<string>>
}

export type MondayBoardSummary = {
  id: string
  name: string
  description?: string
}

export type MondayStatusLabel = {
  id: string
  index: number
  label: string
  color?: string
}

export type MondayColumn = {
  id: string
  title: string
  type: string
  settings?: {
    labels?: Record<string, string>
    labels_colors?: Record<string, { color?: string }>
  }
}

export type MondayPerson = {
  id: string
  name: string
  avatarUrl?: string
}

export type MondayAsset = {
  id: string
  name: string
  url?: string
  publicUrl?: string
  fileExtension?: string
}

export type MondayTicketColumnValue = {
  id: string
  title: string
  type: string
  text: string
  value?: string
  editable: boolean
  statusLabels?: Array<MondayStatusLabel>
  assets?: Array<MondayAsset>
  people?: Array<MondayPerson>
}

export type MondayComment = {
  id: string
  body?: string
  textBody?: string
  createdAt?: string
  creator?: MondayPerson
  assets: Array<MondayAsset>
  replies: Array<MondayComment>
}

export type MondayTicket = {
  id: string
  title: string
  displayTitle: string
  description?: string
  group?: string
  statusIndex: number | null
  statusColumnId?: string
  statusLabel: string
  owner?: string
  assignees?: Array<MondayPerson>
  priority?: string
  priorityColor?: string
  priorityColumnId?: string
  priorityIndex: number | null
  statusColor?: string
  dueDate?: string
  prUrl?: string
  url?: string
  updatedAt?: string
  columns: Array<MondayTicketColumnValue>
  assets?: Array<MondayAsset>
  updates?: Array<MondayComment>
}

export type MondayBoardDetail = {
  id: string
  name: string
  columns: Array<MondayColumn>
  statusColumn?: MondayColumn
  statusLabels: Array<MondayStatusLabel>
  tickets: Array<MondayTicket>
}

export type MondayBootstrap = {
  hasEnvToken: boolean
  envDefaultBoardId?: string
  envStatusColumnId?: string
}
