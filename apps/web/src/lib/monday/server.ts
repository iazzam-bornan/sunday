import { createServerFn } from "@tanstack/react-start"

import type {
  MondayAsset,
  MondayBoardDetail,
  MondayBoardSummary,
  MondayBootstrap,
  MondayColumn,
  MondayComment,
  MondayPerson,
  MondaySettings,
  MondayStatusLabel,
  MondayTicket,
  MondayTicketColumnValue,
} from "./types"

type MondayGraphQLResponse<T> = {
  data?: T
  errors?: Array<{ message: string }>
}

type RawColumn = {
  id: string
  title: string
  type: string
  settings_str?: string | null
}

type RawColumnValue = {
  id: string
  text?: string | null
  value?: string | null
  type?: string | null
  column?: RawColumn | null
  files?: Array<{
    asset?: RawAsset | null
  }> | null
}

type RawItem = {
  id: string
  name: string
  url?: string | null
  updated_at?: string
  group?: {
    id: string
    title: string
  } | null
  column_values?: Array<RawColumnValue>
  assets?: Array<RawAsset>
  updates?: Array<RawUpdate>
}

type RawBoard = {
  id: string
  name: string
  description?: string | null
  columns?: Array<RawColumn>
  items_page?: {
    cursor?: string | null
    items?: Array<RawItem>
  }
}

type RawUser = {
  id: string
  name: string
  photo_thumb?: string | null
}

type RawAsset = {
  id: string
  name?: string | null
  url?: string | null
  public_url?: string | null
  file_extension?: string | null
}

type RawUpdate = {
  id: string
  body?: string | null
  text_body?: string | null
  created_at?: string | null
  creator?: RawUser | null
  assets?: Array<RawAsset>
  replies?: Array<RawUpdate>
}

const MONDAY_ENDPOINT = "https://api.monday.com/v2"
const MONDAY_API_VERSION = "2026-01"
const ASSET_FIELDS = `
  id
  name
  url
  public_url
  file_extension
`
const ITEM_PAGE_FIELDS = `
  cursor
  items {
    id
    name
    url
    updated_at
    group {
      id
      title
    }
    column_values {
      id
      text
      value
      type
      column {
        id
        title
        type
      }
    }
  }
`

const TICKET_DETAIL_FIELDS = `
  id
  name
  url
  updated_at
  group {
    id
    title
  }
  assets {
    ${ASSET_FIELDS}
  }
  column_values {
    id
    text
    value
    type
    column {
      id
      title
      type
      settings_str
    }
    ... on FileValue {
      files {
        ... on FileAssetValue {
          asset {
            ${ASSET_FIELDS}
          }
        }
      }
    }
  }
  updates(limit: 100) {
    id
    body
    text_body
    created_at
    creator {
      id
      name
      photo_thumb
    }
    assets {
      ${ASSET_FIELDS}
    }
    replies {
      id
      body
      text_body
      created_at
      creator {
        id
        name
        photo_thumb
      }
      assets {
        ${ASSET_FIELDS}
      }
    }
  }
`

function getEnvValue(name: string) {
  return process.env[name]?.trim() || undefined
}

function resolveToken(settings?: MondaySettings) {
  return (
    settings?.apiToken?.trim() ||
    getEnvValue("MONDAY_API_TOKEN") ||
    getEnvValue("VITE_MONDAY_API_TOKEN")
  )
}

function resolveDefaultBoardId(settings?: MondaySettings) {
  return (
    settings?.defaultBoardId?.trim() ||
    getEnvValue("MONDAY_BOARD_ID") ||
    getEnvValue("VITE_MONDAY_BOARD_ID")
  )
}

function resolveStatusColumnId(settings?: MondaySettings) {
  return (
    settings?.statusColumnId?.trim() ||
    getEnvValue("MONDAY_STATUS_COLUMN_ID") ||
    getEnvValue("VITE_MONDAY_STATUS_COLUMN_ID")
  )
}

async function mondayRequest<T>(
  settings: MondaySettings | undefined,
  query: string,
  variables?: Record<string, unknown>
) {
  const token = resolveToken(settings)

  if (!token) {
    throw new Error("Add a Monday API token in Settings or MONDAY_API_TOKEN.")
  }

  const response = await fetch(MONDAY_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      "API-Version": MONDAY_API_VERSION,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new Error(`Monday request failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as MondayGraphQLResponse<T>

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(" "))
  }

  if (!payload.data) {
    throw new Error("Monday returned an empty response.")
  }

  return payload.data
}

function parseColumn(column: RawColumn): MondayColumn {
  let settings: MondayColumn["settings"]

  if (column.settings_str) {
    try {
      settings = JSON.parse(column.settings_str) as MondayColumn["settings"]
    } catch {
      settings = undefined
    }
  }

  return {
    id: column.id,
    title: column.title,
    type: column.type,
    settings,
  }
}

function getStatusLabels(column?: MondayColumn): Array<MondayStatusLabel> {
  if (!column?.settings?.labels) {
    return []
  }

  const { labels, labels_colors: labelColors } = column.settings

  return Object.entries(labels)
    .filter(([, label]) => Boolean(label.trim()))
    .map(([index, label]) => ({
      id: `${column.id}:${index}`,
      index: Number(index),
      label,
      color: labelColors?.[index]?.color,
    }))
    .sort((a, b) => a.index - b.index)
}

function normalizeAsset(asset?: RawAsset | null): MondayAsset | undefined {
  if (!asset) {
    return undefined
  }

  return {
    id: asset.id,
    name: asset.name || "Attachment",
    url: asset.url || undefined,
    publicUrl: asset.public_url || undefined,
    fileExtension: asset.file_extension || undefined,
  }
}

function normalizePerson(user?: RawUser | null): MondayPerson | undefined {
  if (!user) {
    return undefined
  }

  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.photo_thumb || undefined,
  }
}

function normalizeComment(update: RawUpdate): MondayComment {
  return {
    id: update.id,
    body: update.body || undefined,
    textBody: update.text_body || undefined,
    createdAt: update.created_at || undefined,
    creator: normalizePerson(update.creator),
    assets: (update.assets || [])
      .map(normalizeAsset)
      .filter((asset): asset is MondayAsset => Boolean(asset)),
    replies: (update.replies || []).map(normalizeComment),
  }
}

function getColumnAssets(value: RawColumnValue) {
  return (value.files || [])
    .map((file) => normalizeAsset(file.asset))
    .filter((asset): asset is MondayAsset => Boolean(asset))
}

function isEditableColumn(type: string, columnId: string) {
  return (
    columnId === "__name__" ||
    [
      "text",
      "long_text",
      "numbers",
      "numeric",
      "date",
      "status",
      "email",
      "phone",
      "link",
      "people",
    ].includes(type)
  )
}

function normalizeColumnValue(
  value: RawColumnValue,
  usersById: Record<string, MondayPerson> = {}
): MondayTicketColumnValue {
  const column = value.column ? parseColumn(value.column) : undefined
  const type = column?.type || value.type || "unknown"
  const assets = getColumnAssets(value)
  const people =
    type === "people"
      ? getPeopleIds(value.value)
          .map((id) => usersById[id])
          .filter((person): person is MondayPerson => Boolean(person))
      : undefined

  return {
    id: value.id,
    title: column?.title || value.id,
    type,
    text: value.text || "",
    value: value.value || undefined,
    editable: isEditableColumn(type, value.id),
    statusLabels: type === "status" ? getStatusLabels(column) : undefined,
    assets: assets.length ? assets : undefined,
    people,
  }
}

function parseColumnValueValue(value?: string | null) {
  if (!value) {
    return undefined
  }

  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return undefined
  }
}

function getPeopleIds(value?: string | null) {
  const parsedValue = parseColumnValueValue(value)
  const personsAndTeams = parsedValue?.personsAndTeams

  if (!Array.isArray(personsAndTeams)) {
    return []
  }

  return personsAndTeams
    .filter(
      (entry): entry is { id: number | string; kind?: string } =>
        typeof entry === "object" &&
        entry !== null &&
        "id" in entry &&
        (!("kind" in entry) || entry.kind === "person")
    )
    .map((entry) => String(entry.id))
}

function findColumnValue(
  item: RawItem,
  predicate: (value: RawColumnValue) => boolean
) {
  return item.column_values?.find(predicate)
}

function findColumnValues(
  item: RawItem,
  predicate: (value: RawColumnValue) => boolean
) {
  return item.column_values?.filter(predicate) || []
}

function getDisplayTitle(item: RawItem) {
  const nameValues = findColumnValues(item, (value) => {
    const title = value.column?.title.toLowerCase() || ""

    return title === "name" && Boolean(value.text?.trim())
  })
    .map((value) => value.text?.trim())
    .filter((value): value is string => Boolean(value))

  return Array.from(new Set([item.name, ...nameValues])).join(" - ")
}

function getDescription(item: RawItem) {
  const descriptionValue = findColumnValue(item, (value) => {
    const title = value.column?.title.toLowerCase() || ""
    const type = value.column?.type || value.type || ""

    return (
      Boolean(value.text?.trim()) &&
      (type === "long_text" ||
        title.includes("description") ||
        title.includes("desc") ||
        title.includes("brief") ||
        title.includes("details"))
    )
  })

  return descriptionValue?.text?.trim() || undefined
}

function getFallbackPeople(text?: string | null) {
  return (text || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({
      id: `name:${name}`,
      name,
    }))
}

function normalizeTicket(
  item: RawItem,
  statusColumn?: MondayColumn,
  usersById: Record<string, MondayPerson> = {},
  boardColumns: Array<MondayColumn> = []
): MondayTicket {
  const statusValue = statusColumn
    ? findColumnValue(item, (value) => value.id === statusColumn.id)
    : findColumnValue(
        item,
        (value) => value.column?.type === "status" || value.type === "status"
      )
  const parsedStatusValue = parseColumnValueValue(statusValue?.value)
  const statusIndex =
    typeof parsedStatusValue?.index === "number"
      ? parsedStatusValue.index
      : null
  const statusColor =
    statusIndex === null
      ? undefined
      : getStatusLabels(statusColumn).find(
          (status) => status.index === statusIndex
        )?.color
  const ownerValue = findColumnValue(
    item,
    (value) =>
      value.column?.type === "people" ||
      value.type === "people" ||
      value.id.toLowerCase().includes("owner")
  )
  const assignees = ownerValue
    ? getPeopleIds(ownerValue.value)
        .map((id) => usersById[id])
        .filter((person): person is MondayPerson => Boolean(person))
    : []
  const fallbackAssignees = assignees.length
    ? assignees
    : getFallbackPeople(ownerValue?.text)
  const priorityValue = findColumnValue(
    item,
    (value) =>
      value.column?.type === "status" &&
      value.id !== statusColumn?.id &&
      value.column.title.toLowerCase().includes("priority")
  )
  const parsedPriorityValue = parseColumnValueValue(priorityValue?.value)
  const priorityIndex =
    typeof parsedPriorityValue?.index === "number"
      ? parsedPriorityValue.index
      : null
  const priorityColumn =
    boardColumns.find((column) => column.id === priorityValue?.id) ||
    (priorityValue?.column ? parseColumn(priorityValue.column) : undefined)
  const priorityColor =
    priorityIndex === null
      ? undefined
      : getStatusLabels(priorityColumn).find(
          (status) => status.index === priorityIndex
        )?.color
  const dueDateValue = findColumnValue(
    item,
    (value) =>
      value.column?.type === "date" ||
      value.type === "date" ||
      value.id.toLowerCase().includes("date")
  )
  const prValue = findColumnValue(item, (value) => {
    const text = value.text?.toLowerCase() || ""
    const title = value.column?.title.toLowerCase() || ""
    return (
      title.includes("pr") ||
      title.includes("pull") ||
      title.includes("github") ||
      text.includes("github.com")
    )
  })

  return {
    id: item.id,
    title: item.name,
    displayTitle: getDisplayTitle(item),
    description: getDescription(item),
    group: item.group?.title,
    statusIndex,
    statusColumnId: statusValue?.id,
    statusLabel: statusValue?.text || "No status",
    statusColor,
    owner:
      fallbackAssignees.map((person) => person.name).join(", ") ||
      ownerValue?.text ||
      undefined,
    assignees: fallbackAssignees,
    priority: priorityValue?.text || undefined,
    priorityColor,
    priorityColumnId: priorityValue?.id,
    priorityIndex,
    dueDate: dueDateValue?.text || undefined,
    prUrl: prValue?.text?.startsWith("http") ? prValue.text : undefined,
    url: item.url || undefined,
    updatedAt: item.updated_at,
    columns: [
      {
        id: "__name__",
        title: "Name",
        type: "name",
        text: item.name,
        editable: true,
      },
      ...(item.column_values?.map((value) =>
        normalizeColumnValue(value, usersById)
      ) || []),
    ],
    assets: (item.assets || [])
      .map(normalizeAsset)
      .filter((asset): asset is MondayAsset => Boolean(asset)),
    updates: item.updates?.map(normalizeComment),
  }
}

function normalizeBoard(
  board: RawBoard,
  settings?: MondaySettings,
  usersById: Record<string, MondayPerson> = {}
): MondayBoardDetail {
  const columns = board.columns?.map(parseColumn) || []
  const preferredStatusColumnId = resolveStatusColumnId(settings)
  const statusColumn =
    columns.find((column) => column.id === preferredStatusColumnId) ||
    columns.find((column) => column.type === "status")

  return {
    id: board.id,
    name: board.name,
    columns,
    statusColumn,
    statusLabels: getStatusLabels(statusColumn),
    tickets:
      board.items_page?.items?.map((item) =>
        normalizeTicket(item, statusColumn, usersById, columns)
      ) || [],
  }
}

async function getUsersById(
  settings: MondaySettings | undefined,
  items: Array<RawItem>
) {
  const userIds = Array.from(
    new Set(
      items.flatMap((item) =>
        findColumnValues(
          item,
          (value) => value.column?.type === "people" || value.type === "people"
        ).flatMap((value) => getPeopleIds(value.value))
      )
    )
  )

  if (!userIds.length) {
    return {}
  }

  const response = await mondayRequest<{ users: Array<RawUser> }>(
    settings,
    `
      query Users($userIds: [ID!]) {
        users(ids: $userIds) {
          id
          name
          photo_thumb
        }
      }
    `,
    { userIds }
  )

  return Object.fromEntries(
    response.users.map((user) => [
      user.id,
      {
        id: user.id,
        name: user.name,
        avatarUrl: user.photo_thumb || undefined,
      },
    ])
  )
}

export const getMondayBootstrap = createServerFn({ method: "GET" }).handler(
  (): MondayBootstrap => ({
    hasEnvToken: Boolean(resolveToken()),
    envDefaultBoardId: resolveDefaultBoardId(),
    envStatusColumnId: resolveStatusColumnId(),
  })
)

export const getMondayBoards = createServerFn({ method: "POST" })
  .inputValidator((data: { settings?: MondaySettings }) => data)
  .handler(async ({ data }): Promise<Array<MondayBoardSummary>> => {
    const response = await mondayRequest<{ boards: Array<RawBoard> }>(
      data.settings,
      `
        query Boards {
          boards(limit: 100) {
            id
            name
            description
          }
        }
      `
    )

    return response.boards.map((board) => ({
      id: board.id,
      name: board.name,
      description: board.description || undefined,
    }))
  })

export const getMondayBoard = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { boardId?: string; settings?: MondaySettings }) => data
  )
  .handler(async ({ data }): Promise<MondayBoardDetail> => {
    const boardId = data.boardId?.trim() || resolveDefaultBoardId(data.settings)

    if (!boardId) {
      throw new Error("Choose a board or set MONDAY_BOARD_ID.")
    }

    const response = await mondayRequest<{ boards: Array<RawBoard> }>(
      data.settings,
      `
        query Board($boardIds: [ID!]) {
          boards(ids: $boardIds) {
            id
            name
            columns {
              id
              title
              type
              settings_str
            }
            items_page(limit: 100) {
              ${ITEM_PAGE_FIELDS}
            }
          }
        }
      `,
      { boardIds: [boardId] }
    )

    const board = response.boards.at(0)

    if (!board) {
      throw new Error("Monday could not find that board.")
    }

    let cursor = board.items_page?.cursor
    const items = [...(board.items_page?.items || [])]
    let pageCount = 1

    while (cursor && pageCount < 25) {
      const nextPage = await mondayRequest<{
        next_items_page?: RawBoard["items_page"]
      }>(
        data.settings,
        `
          query NextItemsPage($cursor: String!) {
            next_items_page(cursor: $cursor, limit: 100) {
              ${ITEM_PAGE_FIELDS}
            }
          }
        `,
        { cursor }
      )

      items.push(...(nextPage.next_items_page?.items || []))
      cursor = nextPage.next_items_page?.cursor || null
      pageCount += 1
    }

    board.items_page = {
      cursor,
      items,
    }

    const usersById = await getUsersById(data.settings, items)

    return normalizeBoard(board, data.settings, usersById)
  })

export const getMondayTicketDetail = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { itemId: string; boardId?: string; settings?: MondaySettings }) =>
      data
  )
  .handler(async ({ data }): Promise<MondayTicket> => {
    const response = await mondayRequest<{
      boards: Array<RawBoard>
      items: Array<RawItem>
    }>(
      data.settings,
      `
        query TicketDetail($itemIds: [ID!], $boardIds: [ID!]) {
          boards(ids: $boardIds) {
            id
            columns {
              id
              title
              type
              settings_str
            }
          }
          items(ids: $itemIds) {
            ${TICKET_DETAIL_FIELDS}
          }
        }
      `,
      { boardIds: data.boardId ? [data.boardId] : [], itemIds: [data.itemId] }
    )

    const item = response.items.at(0)

    if (!item) {
      throw new Error("Monday could not find that item.")
    }

    const usersById = await getUsersById(data.settings, [item])
    const columns = response.boards.at(0)?.columns?.map(parseColumn) || []
    const preferredStatusColumnId = resolveStatusColumnId(data.settings)
    const statusColumn =
      columns.find((column) => column.id === preferredStatusColumnId) ||
      columns.find((column) => column.type === "status")

    return normalizeTicket(item, statusColumn, usersById, columns)
  })

export const getMondayUsers = createServerFn({ method: "POST" })
  .inputValidator((data: { settings?: MondaySettings }) => data)
  .handler(async ({ data }): Promise<Array<MondayPerson>> => {
    const response = await mondayRequest<{ users: Array<RawUser> }>(
      data.settings,
      `
        query Users {
          users(limit: 500) {
            id
            name
            photo_thumb
          }
        }
      `
    )

    return response.users
      .map(normalizePerson)
      .filter((person): person is MondayPerson => Boolean(person))
      .sort((a, b) => a.name.localeCompare(b.name))
  })

export const updateMondayTicketField = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      boardId: string
      itemId: string
      columnId: string
      value: string
      personIds?: Array<string>
      settings?: MondaySettings
    }) => data
  )
  .handler(async ({ data }) => {
    if (data.columnId === "__name__") {
      await mondayRequest(
        data.settings,
        `
          mutation RenameItem(
            $boardId: ID!
            $itemId: ID!
            $itemName: String!
          ) {
            change_item_name(
              board_id: $boardId
              item_id: $itemId
              item_name: $itemName
            ) {
              id
            }
          }
        `,
        {
          boardId: data.boardId,
          itemId: data.itemId,
          itemName: data.value,
        }
      )

      return { ok: true }
    }

    if (data.personIds) {
      await mondayRequest(
        data.settings,
        `
          mutation UpdateTicketPeople(
            $boardId: ID!
            $itemId: ID!
            $columnId: String!
            $value: JSON!
          ) {
            change_column_value(
              board_id: $boardId
              item_id: $itemId
              column_id: $columnId
              value: $value
            ) {
              id
            }
          }
        `,
        {
          boardId: data.boardId,
          itemId: data.itemId,
          columnId: data.columnId,
          value: JSON.stringify({
            personsAndTeams: data.personIds.map((id) => ({
              id: Number(id),
              kind: "person",
            })),
          }),
        }
      )

      return { ok: true }
    }

    await mondayRequest(
      data.settings,
      `
        mutation UpdateTicketField(
          $boardId: ID!
          $itemId: ID!
          $columnId: String!
          $value: String!
        ) {
          change_simple_column_value(
            board_id: $boardId
            item_id: $itemId
            column_id: $columnId
            value: $value
          ) {
            id
          }
        }
      `,
      {
        boardId: data.boardId,
        itemId: data.itemId,
        columnId: data.columnId,
        value: data.value,
      }
    )

    return { ok: true }
  })

export const createMondayTicket = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      boardId: string
      itemName: string
      statusColumnId?: string
      statusIndex?: number
      settings?: MondaySettings
    }) => data
  )
  .handler(async ({ data }) => {
    const columnValues =
      data.statusColumnId && typeof data.statusIndex === "number"
        ? JSON.stringify({
            [data.statusColumnId]: { index: data.statusIndex },
          })
        : undefined

    await mondayRequest(
      data.settings,
      `
        mutation CreateTicket(
          $boardId: ID!
          $itemName: String!
          $columnValues: JSON
        ) {
          create_item(
            board_id: $boardId
            item_name: $itemName
            column_values: $columnValues
          ) {
            id
          }
        }
      `,
      {
        boardId: data.boardId,
        itemName: data.itemName,
        columnValues,
      }
    )

    return { ok: true }
  })

export const moveMondayTicket = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      boardId: string
      itemId: string
      statusColumnId: string
      statusIndex: number
      settings?: MondaySettings
    }) => data
  )
  .handler(async ({ data }) => {
    await mondayRequest(
      data.settings,
      `
        mutation MoveTicket(
          $boardId: ID!
          $itemId: ID!
          $columnId: String!
          $value: JSON!
        ) {
          change_column_value(
            board_id: $boardId
            item_id: $itemId
            column_id: $columnId
            value: $value
          ) {
            id
          }
        }
      `,
      {
        boardId: data.boardId,
        itemId: data.itemId,
        columnId: data.statusColumnId,
        value: JSON.stringify({ index: data.statusIndex }),
      }
    )

    return { ok: true }
  })
