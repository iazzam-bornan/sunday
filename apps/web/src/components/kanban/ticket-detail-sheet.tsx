import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CopyLinkIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useServerFn } from "@tanstack/react-start"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import type * as React from "react"

import type {
  AppSettings,
  MondayAsset,
  MondayComment,
  MondayPerson,
  MondayTicket,
  MondayTicketColumnValue,
} from "@/lib/monday/types"
import {
  getMondayTicketDetail,
  getMondayUsers,
  updateMondayTicketField,
} from "@/lib/monday/server"
import { getCachedValue, saveCache } from "@/lib/settings"

type TicketDetailPanelProps = {
  boardId: string
  panelWidth: number
  settings: AppSettings
  ticket: MondayTicket
  onClose: () => void
  onPanelWidthChange: (width: number) => void
  onTicketChanged: () => void
}

function getTicketDetailCacheKey(boardId: string, ticketId: string) {
  return `ticket-detail:${boardId}:${ticketId}`
}

export function TicketDetailPanel({
  boardId,
  panelWidth,
  settings,
  ticket,
  onClose,
  onPanelWidthChange,
  onTicketChanged,
}: TicketDetailPanelProps) {
  const getTicketDetail = useServerFn(getMondayTicketDetail)
  const getUsers = useServerFn(getMondayUsers)
  const updateTicketField = useServerFn(updateMondayTicketField)
  const [detail, setDetail] = useState(ticket)
  const [users, setUsers] = useState<Array<MondayPerson>>([])
  const [loading, setLoading] = useState(false)
  const [savingColumnId, setSavingColumnId] = useState<string>()
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)
  const visibleTicket = detail
  const assignees = visibleTicket.assignees || []
  const mediaAssets = useMemo(
    () => getUniqueAssets(visibleTicket.assets || [], visibleTicket.columns),
    [visibleTicket]
  )
  const nameField = visibleTicket.columns.find(
    (column) => column.id === "__name__"
  )
  const customNameFields = getCustomNameFields(visibleTicket.columns)
  const descriptionField = findDescriptionField(
    visibleTicket.columns,
    customNameFields
  )
  const statusField = visibleTicket.columns.find(
    (column) => column.id === visibleTicket.statusColumnId
  )
  const priorityField = visibleTicket.columns.find(
    (column) => column.id === visibleTicket.priorityColumnId
  )
  const estimateField = visibleTicket.columns.find((column) =>
    isEstimateColumn(column)
  )
  const peopleField = visibleTicket.columns.find(
    (column) => column.type === "people"
  )
  const coreFieldIds = new Set(
    [
      nameField?.id,
      descriptionField?.id,
      statusField?.id,
      priorityField?.id,
      estimateField?.id,
      peopleField?.id,
    ].filter((id): id is string => Boolean(id))
  )

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelWidth

    function onPointerMove(moveEvent: PointerEvent) {
      const nextWidth = Math.min(
        720,
        Math.max(360, startWidth + startX - moveEvent.clientX)
      )

      onPanelWidthChange(nextWidth)
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
  }

  useEffect(() => {
    let ignore = false

    const cacheKey = getTicketDetailCacheKey(boardId, ticket.id)
    const cachedDetail = getCachedValue<MondayTicket>(cacheKey)

    setDetail(cachedDetail || ticket)
    setLoading(true)
    setError(undefined)

    async function loadDetail() {
      try {
        const nextDetail = await getTicketDetail({
          data: {
            boardId,
            itemId: ticket.id,
            settings,
          },
        })

        if (!ignore) {
          setDetail(nextDetail)
          saveCache(cacheKey, nextDetail)
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load ticket details."
          )
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      ignore = true
    }
  }, [boardId, getTicketDetail, settings, ticket])

  useEffect(() => {
    let ignore = false

    async function loadUsers() {
      try {
        const nextUsers = await getUsers({ data: { settings } })

        if (!ignore) {
          setUsers(nextUsers)
        }
      } catch {
        if (!ignore) {
          setUsers([])
        }
      }
    }

    void loadUsers()

    return () => {
      ignore = true
    }
  }, [getUsers, settings])

  async function saveField(columnId: string, value: string) {
    setSavingColumnId(columnId)
    setError(undefined)

    try {
      await updateTicketField({
        data: {
          boardId,
          columnId,
          itemId: visibleTicket.id,
          settings,
          value,
        },
      })

      const nextDetail = await getTicketDetail({
        data: {
          boardId,
          itemId: visibleTicket.id,
          settings,
        },
      })

      setDetail(nextDetail)
      saveCache(getTicketDetailCacheKey(boardId, visibleTicket.id), nextDetail)
      onTicketChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save field.")
    } finally {
      setSavingColumnId(undefined)
    }
  }

  async function saveAssignees(personIds: Array<string>) {
    if (!peopleField) {
      setError("No people column found for this board.")
      return
    }

    setSavingColumnId(peopleField.id)
    setError(undefined)

    try {
      await updateTicketField({
        data: {
          boardId,
          columnId: peopleField.id,
          itemId: visibleTicket.id,
          personIds,
          settings,
          value: "",
        },
      })

      const nextDetail = await getTicketDetail({
        data: {
          boardId,
          itemId: visibleTicket.id,
          settings,
        },
      })

      setDetail(nextDetail)
      saveCache(getTicketDetailCacheKey(boardId, visibleTicket.id), nextDetail)
      onTicketChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save assignees.")
    } finally {
      setSavingColumnId(undefined)
    }
  }

  return (
    <aside
      className="relative flex min-h-0 shrink-0 flex-col border-l border-border bg-background"
      style={{ width: panelWidth }}
    >
      <div
        className="absolute top-0 bottom-0 left-0 z-10 w-1 cursor-col-resize hover:bg-foreground/20"
        onPointerDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize ticket details"
      />
      <div className="shrink-0 border-b border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">
              Monday item {visibleTicket.id}
            </p>
            <h2 className="mt-1 text-base font-semibold break-words">
              {visibleTicket.displayTitle}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {visibleTicket.url ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  void navigator.clipboard.writeText(visibleTicket.url || "")
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1200)
                }}
                aria-label="Copy Monday item link"
              >
                <HugeiconsIcon
                  icon={copied ? Tick02Icon : CopyLinkIcon}
                  strokeWidth={2}
                  className={cn(
                    "transition-all duration-200",
                    copied && "scale-110 text-emerald-500"
                  )}
                />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close ticket details"
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        {error ? (
          <p className="border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {statusField ? (
            <StatusTagField
              column={statusField}
              saving={savingColumnId === statusField.id}
              onSave={(value) => saveField(statusField.id, value)}
            />
          ) : (
            <Badge
              variant="outline"
              style={getColorStyle(visibleTicket.statusColor)}
            >
              {visibleTicket.statusLabel}
            </Badge>
          )}
          {priorityField ? (
            <StatusTagField
              column={priorityField}
              saving={savingColumnId === priorityField.id}
              onSave={(value) => saveField(priorityField.id, value)}
            />
          ) : visibleTicket.priority ? (
            <Badge
              variant="outline"
              style={getColorStyle(visibleTicket.priorityColor)}
            >
              {visibleTicket.priority}
            </Badge>
          ) : null}
          {visibleTicket.group ? (
            <Badge variant="secondary">{visibleTicket.group}</Badge>
          ) : null}
          {loading ? <Badge variant="secondary">loading details</Badge> : null}
        </div>

        <section className="grid gap-3">
          {nameField ? (
            <EditableField
              column={{ ...nameField, title: "Title" }}
              saving={savingColumnId === nameField.id}
              onSave={(value) => saveField(nameField.id, value)}
            />
          ) : null}
          {customNameFields.map((column) => (
            <EditableField
              key={column.id}
              column={column}
              saving={savingColumnId === column.id}
              onSave={(value) => saveField(column.id, value)}
            />
          ))}
        </section>

        {descriptionField ? (
          <section className="grid gap-3">
            <EditableField
              column={descriptionField}
              saving={savingColumnId === descriptionField.id}
              onSave={(value) => saveField(descriptionField.id, value)}
            />
          </section>
        ) : visibleTicket.description ? (
          <section className="grid gap-2">
            <h3 className="text-xs font-medium">Description</h3>
            <p className="text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
              {visibleTicket.description}
            </p>
          </section>
        ) : null}

        <section className="grid items-start gap-3 sm:grid-cols-2">
          <AssigneeEditor
            assignees={assignees}
            disabled={!peopleField || savingColumnId === peopleField.id}
            users={users}
            onSave={saveAssignees}
          />
          {estimateField ? (
            <EditableField
              column={estimateField}
              saving={savingColumnId === estimateField.id}
              onSave={(value) => saveField(estimateField.id, value)}
            />
          ) : null}
        </section>

        {visibleTicket.prUrl ? (
          <Button asChild className="w-fit" variant="outline">
            <a href={visibleTicket.prUrl} target="_blank" rel="noreferrer">
              Open pull request
            </a>
          </Button>
        ) : null}

        {mediaAssets.length ? (
          <section className="grid gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium">Media</h3>
              <span className="text-[11px] text-muted-foreground">
                {mediaAssets.length} files
              </span>
            </div>
            <MediaGrid assets={mediaAssets} />
          </section>
        ) : null}

        <Separator />

        <CollapsibleSection
          title="Extra fields"
          count={
            visibleTicket.columns.filter(
              (column) => !coreFieldIds.has(column.id)
            ).length
          }
        >
          <div className="grid gap-3 pt-3">
            {visibleTicket.columns
              .filter((column) => !coreFieldIds.has(column.id))
              .map((column) => (
                <EditableField
                  key={column.id}
                  column={column}
                  saving={savingColumnId === column.id}
                  onSave={(value) => saveField(column.id, value)}
                />
              ))}
          </div>
        </CollapsibleSection>

        <Separator />

        <CollapsibleSection
          title="Comments"
          count={visibleTicket.updates?.length || 0}
          defaultOpen
        >
          <div className="grid gap-3 pt-3">
            {visibleTicket.updates?.length ? (
              visibleTicket.updates.map((comment) => (
                <CommentCard key={comment.id} comment={comment} />
              ))
            ) : (
              <p className="border border-dashed border-border p-3 text-xs text-muted-foreground">
                No comments found.
              </p>
            )}
          </div>
        </CollapsibleSection>
      </div>
    </aside>
  )
}

function EditableField({
  column,
  hideLabel = false,
  onSave,
  saving,
}: {
  column: MondayTicketColumnValue
  hideLabel?: boolean
  onSave: (value: string) => void
  saving: boolean
}) {
  const [value, setValue] = useState(column.text)
  const dirty = value !== column.text

  useEffect(() => {
    setValue(column.text)
  }, [column.text])

  return (
    <div className="grid gap-2 border-b border-border pb-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        {!hideLabel ? (
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{column.title}</p>
          </div>
        ) : (
          <span />
        )}
        {!column.editable ? (
          <Badge variant="outline">read-only</Badge>
        ) : dirty ? (
          <Button
            variant="outline"
            size="xs"
            disabled={saving}
            onClick={() => onSave(value)}
          >
            {saving ? "Saving" : "Save"}
          </Button>
        ) : null}
      </div>

      {!column.editable ? (
        <p className="text-xs break-words whitespace-pre-wrap text-muted-foreground">
          {column.text || "Empty"}
        </p>
      ) : column.type === "people" ? (
        <p className="text-xs break-words text-muted-foreground">
          {column.people?.map((person) => person.name).join(", ") || "Empty"}
        </p>
      ) : (
        <FieldInput column={column} value={value} onChange={setValue} />
      )}

      {column.assets?.length ? <MediaGrid assets={column.assets} /> : null}
    </div>
  )
}

function StatusTagField({
  column,
  onSave,
  saving,
}: {
  column: MondayTicketColumnValue
  onSave: (value: string) => void
  saving: boolean
}) {
  const currentStatus = column.statusLabels?.find(
    (status) => status.label === column.text
  )

  return (
    <Select
      value={column.text || "__empty__"}
      onValueChange={(value) => onSave(value === "__empty__" ? "" : value)}
      disabled={saving}
    >
      <SelectTrigger
        size="sm"
        className="w-fit border-transparent px-0 py-0"
        style={getColorStyle(currentStatus?.color)}
      >
        <SelectValue placeholder={column.title} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__empty__">Empty</SelectItem>
        {column.statusLabels?.map((status) => (
          <SelectItem key={status.index} value={status.label}>
            <span className="inline-flex items-center gap-2">
              <span
                className="size-2 shrink-0 border border-border"
                style={{ backgroundColor: status.color || "transparent" }}
              />
              {status.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function CollapsibleSection({
  children,
  count,
  defaultOpen = false,
  title,
}: {
  children: React.ReactNode
  count: number
  defaultOpen?: boolean
  title: string
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="group/collapse px-0">
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className="transition-transform group-data-[state=closed]/collapse:-rotate-90"
            />
            {title}
          </Button>
        </CollapsibleTrigger>
        <span className="text-[11px] text-muted-foreground">{count}</span>
      </div>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}

function AssigneeEditor({
  assignees,
  disabled,
  onSave,
  users,
}: {
  assignees: Array<MondayPerson>
  disabled: boolean
  onSave: (personIds: Array<string>) => void
  users: Array<MondayPerson>
}) {
  const [selectedIds, setSelectedIds] = useState<Array<string>>(
    assignees.map((person) => person.id)
  )
  const peopleById = new Map(
    [...assignees, ...users].map((person) => [person.id, person])
  )
  const selectedPeople = selectedIds
    .map((id) => peopleById.get(id))
    .filter((person): person is MondayPerson => Boolean(person))
  const dirty =
    selectedIds.length !== assignees.length ||
    selectedIds.some((id) => !assignees.some((person) => person.id === id))

  useEffect(() => {
    setSelectedIds(assignees.map((person) => person.id))
  }, [assignees])

  function togglePerson(personId: string) {
    setSelectedIds((currentIds) =>
      currentIds.includes(personId)
        ? currentIds.filter((id) => id !== personId)
        : [...currentIds, personId]
    )
  }

  return (
    <section className="grid content-start gap-2">
      <div className="flex h-5 items-center justify-between gap-2">
        <p className="text-xs font-medium">Assignees</p>
        {dirty ? (
          <Button
            variant="outline"
            size="xs"
            disabled={disabled}
            onClick={() => onSave(selectedIds)}
          >
            Save
          </Button>
        ) : null}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-8 w-full justify-start overflow-hidden"
            disabled={disabled}
          >
            {selectedIds.length ? (
              <span className="flex min-w-0 items-center gap-2">
                <AvatarGroup>
                  {selectedPeople.slice(0, 4).map((person) => (
                    <Avatar key={person.id} size="sm">
                      <AvatarImage alt={person.name} src={person.avatarUrl} />
                      <AvatarFallback>
                        {getInitials(person.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {selectedIds.length > 4 ? (
                    <AvatarGroupCount>
                      +{selectedIds.length - 4}
                    </AvatarGroupCount>
                  ) : null}
                </AvatarGroup>
                <span className="text-xs text-muted-foreground">
                  {selectedIds.length}
                </span>
              </span>
            ) : (
              "Unassigned"
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-80 w-72 overflow-y-auto"
        >
          <DropdownMenuLabel>People</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {users.map((person) => {
            const checked = selectedIds.includes(person.id)

            return (
              <button
                key={person.id}
                type="button"
                className="flex w-full items-center gap-2 px-2 py-1.5 text-start text-xs hover:bg-muted"
                onClick={() => togglePerson(person.id)}
              >
                <Checkbox checked={checked} />
                <Avatar size="sm">
                  <AvatarImage alt={person.name} src={person.avatarUrl} />
                  <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 truncate">{person.name}</span>
              </button>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </section>
  )
}

function FieldInput({
  column,
  onChange,
  value,
}: {
  column: MondayTicketColumnValue
  onChange: (value: string) => void
  value: string
}) {
  if (column.type === "long_text") {
    return (
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Empty"
      />
    )
  }

  if (column.type === "status" && column.statusLabels?.length) {
    return (
      <Select
        value={value || "__empty__"}
        onValueChange={(nextValue) =>
          onChange(nextValue === "__empty__" ? "" : nextValue)
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Empty" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty__">Empty</SelectItem>
          {column.statusLabels.map((status) => (
            <SelectItem key={status.index} value={status.label}>
              <span className="inline-flex items-center gap-2">
                <span
                  className="size-2 shrink-0 border border-border"
                  style={{ backgroundColor: status.color || "transparent" }}
                />
                {status.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <Input
      value={value}
      type={column.type === "date" ? "date" : "text"}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Empty"
    />
  )
}

function CommentCard({ comment }: { comment: MondayComment }) {
  return (
    <Collapsible defaultOpen>
      <article className="grid gap-3 border border-border bg-muted/20 p-3">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group/comment flex w-full items-center gap-2 text-start"
          >
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className="size-3 shrink-0 transition-transform group-data-[state=closed]/comment:-rotate-90"
            />
            {comment.creator ? (
              <Avatar size="sm">
                <AvatarImage
                  alt={comment.creator.name}
                  src={comment.creator.avatarUrl}
                />
                <AvatarFallback>
                  {getInitials(comment.creator.name)}
                </AvatarFallback>
              </Avatar>
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">
                {comment.creator?.name || "Monday user"}
              </p>
              {comment.createdAt ? (
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(comment.createdAt)}
                </p>
              ) : null}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="grid gap-3">
          {comment.body ? (
            <CommentBody body={comment.body} assets={comment.assets} />
          ) : (
            <p className="text-xs break-words whitespace-pre-wrap text-muted-foreground">
              {comment.textBody || "Empty comment"}
            </p>
          )}

          {getLooseCommentAssets(comment).length ? (
            <MediaGrid assets={getLooseCommentAssets(comment)} />
          ) : null}

          {comment.replies.length ? (
            <div className="ms-4 grid gap-2 border-s border-border ps-3">
              {comment.replies.map((reply) => (
                <CommentCard key={reply.id} comment={reply} />
              ))}
            </div>
          ) : null}
        </CollapsibleContent>
      </article>
    </Collapsible>
  )
}
function MediaGrid({ assets }: { assets: Array<MondayAsset> }) {
  const imageAssets = assets.filter(isImageAsset)
  const [lightboxIndex, setLightboxIndex] = useState<number>()

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {assets.map((asset) => (
          <MediaAsset
            key={asset.id}
            asset={asset}
            onOpenImage={() => {
              const index = imageAssets.findIndex(
                (option) => option.id === asset.id
              )

              if (index !== -1) {
                setLightboxIndex(index)
              }
            }}
          />
        ))}
      </div>
      {typeof lightboxIndex === "number" ? (
        <MediaLightbox
          assets={imageAssets}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(undefined)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </>
  )
}

function CommentBody({
  assets,
  body,
}: {
  assets: Array<MondayAsset>
  body: string
}) {
  const parts = splitCommentBody(body, assets)
  const imageAssets = parts
    .filter(
      (part): part is { asset: MondayAsset; type: "image" } =>
        part.type === "image"
    )
    .map((part) => part.asset)
  const [lightboxIndex, setLightboxIndex] = useState<number>()

  return (
    <div className="grid gap-2">
      {parts.map((part, index) =>
        part.type === "html" ? (
          <div
            key={`${part.type}:${index}`}
            className="sunday-comment-body text-xs leading-relaxed break-words text-muted-foreground [&_a]:underline [&_li]:ms-4 [&_li]:list-disc [&_p]:mb-2 last:[&_p]:mb-0"
            dangerouslySetInnerHTML={{ __html: sanitizeMondayHtml(part.html) }}
          />
        ) : (
          <InlineImageAsset
            key={`${part.asset.id}:${index}`}
            asset={part.asset}
            onOpenImage={() => {
              const assetIndex = imageAssets.findIndex(
                (asset) => asset.id === part.asset.id
              )

              if (assetIndex !== -1) {
                setLightboxIndex(assetIndex)
              }
            }}
          />
        )
      )}
      {typeof lightboxIndex === "number" ? (
        <MediaLightbox
          assets={imageAssets}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(undefined)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </div>
  )
}

function MediaAsset({
  asset,
  onOpenImage,
}: {
  asset: MondayAsset
  onOpenImage: () => void
}) {
  const href = asset.publicUrl || asset.url
  const extension = asset.fileExtension?.toLowerCase() || ""

  if (!href) {
    return (
      <div className="border border-border p-2 text-xs text-muted-foreground">
        {asset.name}
      </div>
    )
  }

  if (isImageAsset(asset)) {
    return (
      <button
        type="button"
        className="grid gap-1 text-start"
        onClick={onOpenImage}
      >
        <img
          alt={asset.name}
          src={href}
          className="max-h-64 w-full border border-border bg-muted/30 object-contain"
        />
        <span className="truncate text-[11px] text-muted-foreground">
          {asset.name}
        </span>
      </button>
    )
  }

  if (["mp4", "ogg", "webm"].includes(extension)) {
    return (
      <div className="grid gap-1">
        <video
          src={href}
          controls
          className="aspect-video w-full border border-border"
        />
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="truncate text-[11px] text-muted-foreground underline"
        >
          {asset.name}
        </a>
      </div>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block border border-border p-2 text-xs break-words text-muted-foreground underline"
    >
      {asset.name}
    </a>
  )
}

function InlineImageAsset({
  asset,
  onOpenImage,
}: {
  asset: MondayAsset
  onOpenImage: () => void
}) {
  const href = asset.publicUrl || asset.url

  if (!href) {
    return null
  }

  return (
    <button
      type="button"
      className="block w-full text-start"
      onClick={onOpenImage}
    >
      <img
        alt={asset.name}
        src={href}
        className="max-h-96 max-w-full object-contain"
      />
    </button>
  )
}

function MediaLightbox({
  assets,
  index,
  onClose,
  onIndexChange,
}: {
  assets: Array<MondayAsset>
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
}) {
  const asset = assets[index]
  const href = asset.publicUrl || asset.url
  const [zoom, setZoom] = useState(1)
  const [naturalSize, setNaturalSize] = useState({ height: 0, width: 0 })
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }

      if (event.key === "ArrowLeft") {
        onIndexChange((index - 1 + assets.length) % assets.length)
      }

      if (event.key === "ArrowRight") {
        onIndexChange((index + 1) % assets.length)
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => window.removeEventListener("keydown", onKeyDown)
  }, [assets.length, index, onClose, onIndexChange])

  useEffect(() => {
    setZoom(1)
    setZoomOrigin({ x: 50, y: 50 })
  }, [index])

  if (!href) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95">
      <div className="flex shrink-0 items-center justify-between border-b border-border p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{asset.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {index + 1} of {assets.length}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="xs"
            onClick={() => setZoom((current) => Math.max(0.25, current - 0.25))}
          >
            Zoom out
          </Button>
          <Button variant="outline" size="xs" onClick={() => setZoom(1)}>
            {Math.round(zoom * 100)}%
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setZoom((current) => Math.min(6, current + 0.25))}
          >
            Zoom in
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close image"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </Button>
        </div>
      </div>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-6"
        onWheel={(event) => {
          if (!event.ctrlKey && !event.metaKey) {
            return
          }

          event.preventDefault()
          const bounds = event.currentTarget.getBoundingClientRect()
          setZoomOrigin({
            x: ((event.clientX - bounds.left) / bounds.width) * 100,
            y: ((event.clientY - bounds.top) / bounds.height) * 100,
          })
          setZoom((current) =>
            Math.min(
              6,
              Math.max(0.25, current + (event.deltaY > 0 ? -0.1 : 0.1))
            )
          )
        }}
      >
        <img
          alt={asset.name}
          src={href}
          className="block cursor-zoom-in object-contain"
          onClick={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect()
            setZoomOrigin({
              x: ((event.clientX - bounds.left) / bounds.width) * 100,
              y: ((event.clientY - bounds.top) / bounds.height) * 100,
            })
            setZoom((current) =>
              current === 1 ? 2 : Math.min(6, current + 0.5)
            )
          }}
          onLoad={(event) =>
            setNaturalSize({
              height: event.currentTarget.naturalHeight,
              width: event.currentTarget.naturalWidth,
            })
          }
          style={{
            height:
              zoom === 1
                ? "calc(100vh - 7rem)"
                : naturalSize.height
                  ? naturalSize.height * zoom
                  : undefined,
            maxHeight: zoom === 1 ? "calc(100vh - 7rem)" : "none",
            maxWidth: zoom === 1 ? "100%" : "none",
            transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
            width:
              zoom === 1
                ? "auto"
                : naturalSize.width
                  ? naturalSize.width * zoom
                  : undefined,
          }}
        />
      </div>
      {assets.length > 1 ? (
        <>
          <Button
            variant="outline"
            size="icon"
            className="fixed top-1/2 left-4 z-50 -translate-y-1/2"
            onClick={() =>
              onIndexChange((index - 1 + assets.length) % assets.length)
            }
            aria-label="Previous image"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="fixed top-1/2 right-4 z-50 -translate-y-1/2"
            onClick={() => onIndexChange((index + 1) % assets.length)}
            aria-label="Next image"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
          </Button>
        </>
      ) : null}
    </div>
  )
}

function isImageAsset(asset: MondayAsset) {
  const extension = asset.fileExtension?.toLowerCase() || ""
  const url = `${asset.publicUrl || asset.url || asset.name}`.toLowerCase()

  return (
    ["apng", "avif", "gif", "jpg", "jpeg", "png", "webp"].includes(extension) ||
    /\.(apng|avif|gif|jpe?g|png|webp)(\?|#|$)/.test(url)
  )
}

function getUniqueAssets(
  assets: Array<MondayAsset>,
  columns: Array<MondayTicketColumnValue>
) {
  const entries = [
    ...assets,
    ...columns.flatMap((column) => column.assets || []),
  ]
  const unique = new Map<string, MondayAsset>()

  for (const asset of entries) {
    unique.set(asset.id, asset)
  }

  return Array.from(unique.values())
}

function isDescriptionColumn(column: MondayTicketColumnValue) {
  const title = column.title.toLowerCase()

  return (
    title.includes("description") ||
    title.includes("desc") ||
    title.includes("brief") ||
    title.includes("details")
  )
}

function findDescriptionField(
  columns: Array<MondayTicketColumnValue>,
  customNameFields: Array<MondayTicketColumnValue>
) {
  const customNameIds = new Set(customNameFields.map((column) => column.id))
  const explicitDescription = columns.find(
    (column) => !customNameIds.has(column.id) && isDescriptionColumn(column)
  )

  if (explicitDescription) {
    return explicitDescription
  }

  return columns.find(
    (column) =>
      !customNameIds.has(column.id) &&
      column.id !== "__name__" &&
      column.type === "long_text" &&
      column.text
  )
}

function isEstimateColumn(column: MondayTicketColumnValue) {
  const title = column.title.toLowerCase()

  return (
    title.includes("estimate") ||
    title.includes("estimated") ||
    title.includes("estimation") ||
    title === "md" ||
    title.includes("md")
  )
}

function getCustomNameFields(columns: Array<MondayTicketColumnValue>) {
  const seenTexts = new Set<string>()

  return columns.filter((column) => {
    const normalizedText = column.text.trim().toLowerCase()

    if (
      column.id === "__name__" ||
      column.title.toLowerCase() !== "name" ||
      !normalizedText ||
      seenTexts.has(normalizedText)
    ) {
      return false
    }

    seenTexts.add(normalizedText)
    return true
  })
}

function getColorStyle(color?: string): CSSProperties | undefined {
  if (!color) {
    return undefined
  }

  return {
    backgroundColor: color,
    borderColor: color,
    color: "white",
  }
}

function sanitizeMondayHtml(html: string) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
}

function getLooseCommentAssets(comment: MondayComment) {
  const inlineAssetIds = getInlineMatchedAssetIds(
    comment.body || "",
    comment.assets
  )
  const uniqueAssets = new Map<string, MondayAsset>()

  for (const asset of comment.assets) {
    if (inlineAssetIds.has(asset.id)) {
      continue
    }

    const dedupKey = getExactAssetDedupKey(asset)
    const existingAsset = uniqueAssets.get(dedupKey)

    if (!existingAsset || isBetterAsset(asset, existingAsset)) {
      uniqueAssets.set(dedupKey, asset)
    }
  }

  return Array.from(uniqueAssets.values())
}

function getExactAssetDedupKey(asset: MondayAsset) {
  const href = asset.publicUrl || asset.url

  if (href) {
    return normalizeAssetUrl(href)
  }

  return asset.id
}

function splitCommentBody(body: string, assets: Array<MondayAsset>) {
  const parts: Array<
    { html: string; type: "html" } | { asset: MondayAsset; type: "image" }
  > = []
  const imageRegex = /<img\b[^>]*>/gi
  let currentIndex = 0
  let imageIndex = 0
  let match = imageRegex.exec(body)

  while (match) {
    if (match.index > currentIndex) {
      parts.push({
        html: body.slice(currentIndex, match.index),
        type: "html",
      })
    }

    const htmlAsset = getImageAssetFromTag(match[0])
    const matchingAsset = htmlAsset
      ? findMatchingAsset(htmlAsset, assets) ||
        assets.at(imageIndex) ||
        htmlAsset
      : undefined

    if (matchingAsset) {
      parts.push({ asset: matchingAsset, type: "image" })
    }

    imageIndex += 1
    currentIndex = match.index + match[0].length
    match = imageRegex.exec(body)
  }

  if (currentIndex < body.length) {
    parts.push({ html: body.slice(currentIndex), type: "html" })
  }

  return parts.filter((part) => part.type === "image" || part.html.trim())
}

function getInlineMatchedAssetIds(body: string, assets: Array<MondayAsset>) {
  const ids = new Set<string>()
  const imageRegex = /<img\b[^>]*>/gi
  let imageIndex = 0
  let match = imageRegex.exec(body)

  while (match) {
    const htmlAsset = getImageAssetFromTag(match[0])
    const matchingAsset: MondayAsset | undefined = htmlAsset
      ? findMatchingAsset(htmlAsset, assets) || assets.at(imageIndex)
      : assets.at(imageIndex)

    if (matchingAsset) {
      ids.add(matchingAsset.id)
    }

    imageIndex += 1
    match = imageRegex.exec(body)
  }

  return ids
}

function getImageAssetFromTag(tag: string) {
  const src = decodeHtmlAttribute(getHtmlAttribute(tag, "src") || "")

  if (!src) {
    return undefined
  }

  const alt = decodeHtmlAttribute(getHtmlAttribute(tag, "alt") || "Image")

  return {
    id: `html:${src}`,
    name: alt,
    publicUrl: src,
    fileExtension: getExtensionFromUrl(src),
  }
}

function findMatchingAsset(htmlAsset: MondayAsset, assets: Array<MondayAsset>) {
  const htmlSource = normalizeImageSource(
    htmlAsset.publicUrl || htmlAsset.url || ""
  )
  const htmlFileName = getFileNameFromUrl(
    htmlAsset.publicUrl || htmlAsset.url || ""
  )
  const htmlBaseName = getBaseAssetName(htmlFileName || htmlAsset.name)

  return assets.find((asset) => {
    const assetSource = normalizeImageSource(asset.publicUrl || asset.url || "")
    const assetFileName = getFileNameFromUrl(asset.publicUrl || asset.url || "")
    const assetBaseName = getBaseAssetName(assetFileName || asset.name)

    return Boolean(
      (htmlSource && assetSource && htmlSource === assetSource) ||
      (htmlBaseName && assetBaseName && htmlBaseName === assetBaseName) ||
      areLikelySameImage(htmlAsset, asset)
    )
  })
}

function normalizeAssetUrl(url: string) {
  return url
    .replace(/([?&])(width|height|w|h|thumb|thumbnail|preview)=[^&]+/gi, "$1")
    .replace(/[?&]+$/, "")
}

function normalizeImageSource(url: string) {
  return normalizeAssetUrl(url)
    .replace(/\/thumbs?\//gi, "/")
    .replace(/\/thumbnails?\//gi, "/")
    .replace(/[-_](thumb|thumbnail|preview)(?=\.)/gi, "")
}

function getFileNameFromUrl(url: string) {
  const cleanUrl = normalizeImageSource(url).split("?")[0]?.split("#")[0] || ""

  return cleanUrl.split("/").pop()
}

function areLikelySameImage(asset: MondayAsset, existing: MondayAsset) {
  const assetName = getBaseAssetName(asset.name)
  const existingName = getBaseAssetName(existing.name)

  if (assetName && existingName && assetName === existingName) {
    return true
  }

  const assetHref = normalizeAssetUrl(asset.publicUrl || asset.url || "")
  const existingHref = normalizeAssetUrl(
    existing.publicUrl || existing.url || ""
  )

  return Boolean(
    assetHref &&
    existingHref &&
    (assetHref.includes(existingHref) || existingHref.includes(assetHref))
  )
}

function getBaseAssetName(name: string) {
  const normalizedName = name.trim().toLowerCase()

  if (!normalizedName || normalizedName === "image") {
    return undefined
  }

  return normalizedName.replace(/\.[a-z0-9]+$/i, "")
}

function isBetterAsset(nextAsset: MondayAsset, currentAsset: MondayAsset) {
  const nextHasExtension = Boolean(nextAsset.fileExtension)
  const currentHasExtension = Boolean(currentAsset.fileExtension)
  const nextHasSpecificName = getBaseAssetName(nextAsset.name)
  const currentHasSpecificName = getBaseAssetName(currentAsset.name)

  if (nextHasExtension !== currentHasExtension) {
    return nextHasExtension
  }

  if (Boolean(nextHasSpecificName) !== Boolean(currentHasSpecificName)) {
    return Boolean(nextHasSpecificName)
  }

  return (
    (nextAsset.publicUrl || nextAsset.url || "").length >
    (currentAsset.publicUrl || currentAsset.url || "").length
  )
}

function getExtensionFromUrl(url: string) {
  return url.split("?")[0]?.split("#")[0]?.split(".").pop()
}

function getHtmlAttribute(html: string, name: string) {
  const regex = new RegExp(`\\b${name}=(["'])(.*?)\\1`, "i")
  return regex.exec(html)?.[2]
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("")
}
