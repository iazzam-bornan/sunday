import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { useDroppable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Add01Icon, Menu02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { memo, useMemo } from "react"

import { TicketCard } from "./ticket-card"
import type { CSSProperties } from "react"
import type { MondayTicket } from "@/lib/monday/types"
import type { KanbanColumn as KanbanColumnType } from "./types"

type KanbanColumnProps = {
  column: KanbanColumnType
  tickets: Array<MondayTicket>
  isColumnDragActive?: boolean
  overId?: string
  showDropIndicator?: boolean
  adding: boolean
  addingName: string
  creating: boolean
  onOpenTicket: (ticket: MondayTicket) => void
  onStartAdd: () => void
  onCancelAdd: () => void
  onAddingNameChange: (value: string) => void
  onCreateTicket: () => void
}

export const KanbanColumn = memo(function KanbanColumn({
  adding,
  addingName,
  column,
  creating,
  isColumnDragActive,
  tickets,
  onAddingNameChange,
  onCancelAdd,
  onCreateTicket,
  onOpenTicket,
  onStartAdd,
  overId,
  showDropIndicator,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    disabled: isColumnDragActive,
  })
  const {
    attributes,
    listeners,
    setNodeRef: setSortableNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `column:${column.id}` })
  const ticketIds = useMemo(() => tickets.map((ticket) => ticket.id), [tickets])
  const overTicketIndex = overId
    ? tickets.findIndex((ticket) => ticket.id === overId)
    : -1

  return (
    <section
      ref={(node) => {
        setNodeRef(node)
        setSortableNodeRef(node)
      }}
      style={{
        ...getColumnStyle(column.color),
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex h-full min-h-0 w-[19rem] shrink-0 flex-col rounded-lg border border-border bg-muted/30 transition",
        isOver && "border-foreground/40 bg-muted",
        isDragging &&
          "border-dashed border-foreground/50 bg-foreground/5 shadow-none [&>*]:opacity-0"
      )}
    >
      <div
        className="h-1 shrink-0"
        style={{ backgroundColor: column.color || "transparent" }}
      />
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              className="column-drag-handle cursor-grab active:cursor-grabbing"
              aria-label={`Reorder ${column.label}`}
              {...attributes}
              {...listeners}
            >
              <HugeiconsIcon icon={Menu02Icon} strokeWidth={2} />
            </Button>
            <h2 className="truncate text-sm font-medium">{column.label}</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Monday status {column.index}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="outline">{tickets.length}</Badge>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onStartAdd}
            aria-label={`Add ticket to ${column.label}`}
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
          </Button>
        </div>
      </div>
      <SortableContext
        items={ticketIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
          {adding ? (
            <form
              className="grid gap-2 border border-border bg-background p-2"
              onSubmit={(event) => {
                event.preventDefault()
                onCreateTicket()
              }}
            >
              <Input
                autoFocus
                value={addingName}
                onChange={(event) => onAddingNameChange(event.target.value)}
                placeholder="New ticket name"
              />
              <div className="flex justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={onCancelAdd}
                >
                  Cancel
                </Button>
                <Button type="submit" size="xs" disabled={creating}>
                  {creating ? "Adding" : "Add"}
                </Button>
              </div>
            </form>
          ) : null}
          {tickets.map((ticket) => (
            <div key={ticket.id} className="grid gap-2">
              {showDropIndicator && ticket.id === overId ? (
                <DropIndicator />
              ) : null}
              <TicketCard ticket={ticket} onOpen={onOpenTicket} />
            </div>
          ))}
          {showDropIndicator && overTicketIndex === -1 ? (
            <DropIndicator />
          ) : null}
          {tickets.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center border border-dashed border-border px-3 text-center text-xs text-muted-foreground">
              Drop a ticket here
            </div>
          ) : null}
        </div>
      </SortableContext>
    </section>
  )
}, areColumnPropsEqual)

function areColumnPropsEqual(
  previous: KanbanColumnProps,
  next: KanbanColumnProps
) {
  return (
    previous.column === next.column &&
    previous.tickets === next.tickets &&
    previous.isColumnDragActive === next.isColumnDragActive &&
    previous.overId === next.overId &&
    previous.showDropIndicator === next.showDropIndicator &&
    previous.adding === next.adding &&
    previous.addingName === next.addingName &&
    previous.creating === next.creating
  )
}

function DropIndicator() {
  return (
    <div className="h-8 border border-dashed border-foreground/50 bg-foreground/5" />
  )
}

function getColumnStyle(color?: string): CSSProperties | undefined {
  if (!color) {
    return undefined
  }

  return {
    background: `color-mix(in srgb, ${color} 3%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 18%, var(--border))`,
  }
}
