import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { CopyLinkIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import { useMemo, useState } from "react"
import type { CSSProperties } from "react"

import type { MondayTicket } from "@/lib/monday/types"
import type { KanbanColumn } from "@/components/kanban/types"

type TicketListViewProps = {
  collapsedColumnIds?: Array<string>
  columns: Array<KanbanColumn>
  ticketsByColumn: Record<string, Array<MondayTicket>>
  onCollapsedColumnIdsChange: (value: Array<string>) => void
  onOpenTicket: (ticket: MondayTicket) => void
}

export function TicketListView({
  collapsedColumnIds,
  columns,
  ticketsByColumn,
  onCollapsedColumnIdsChange,
  onOpenTicket,
}: TicketListViewProps) {
  const expandedValues = useMemo(
    () =>
      columns
        .map((column) => column.id)
        .filter((columnId) => !collapsedColumnIds?.includes(columnId)),
    [collapsedColumnIds, columns]
  )

  return (
    <div className="min-h-0 flex-1 overflow-auto border border-border bg-background">
      <Accordion
        type="multiple"
        value={expandedValues}
        onValueChange={(value) => {
          onCollapsedColumnIdsChange(
            columns
              .map((column) => column.id)
              .filter((columnId) => !value.includes(columnId))
          )
        }}
        className="w-full"
      >
        {columns.map((column) => {
          const tickets = ticketsByColumn[column.id]

          return (
            <AccordionItem
              key={column.id}
              value={column.id}
              className="border-b border-border"
            >
              <div
                className="sticky top-0 z-10 border-b border-border px-3"
                style={getGroupTintStyle(column.color)}
              >
                <AccordionTrigger className="items-center py-3 text-sm font-medium hover:no-underline">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: column.color || "transparent" }}
                    />
                    <Badge
                      variant="outline"
                      className="border-none text-[13px]"
                      style={getChipColorStyle(column.color)}
                    >
                      {column.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {tickets.length}
                    </span>
                  </span>
                </AccordionTrigger>
              </div>

              <AccordionContent className="pb-0">
                <Table className="min-w-[44rem]">
                  <TableHeader className="bg-background">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[24rem] ps-4">Task</TableHead>
                      <TableHead className="min-w-[9rem]">Assignees</TableHead>
                      <TableHead className="min-w-[8rem]">Priority</TableHead>
                      <TableHead className="w-[4rem] pe-4 text-end">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.length ? (
                      tickets.map((ticket) => (
                        <TicketListRow
                          key={ticket.id}
                          ticket={ticket}
                          onOpen={onOpenTicket}
                        />
                      ))
                    ) : (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={4}
                          className="px-4 py-6 text-center text-xs text-muted-foreground"
                        >
                          No tickets here
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}

function TicketListRow({
  ticket,
  onOpen,
}: {
  ticket: MondayTicket
  onOpen: (ticket: MondayTicket) => void
}) {
  const assignees = ticket.assignees || []
  const [copied, setCopied] = useState(false)
  const description = getRowDescription(ticket)

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => onOpen(ticket)}
      data-state={undefined}
    >
      <TableCell className="px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {ticket.displayTitle}
          </div>
          {description ? (
            <div className="mt-1 line-clamp-2 max-w-[44rem] text-xs leading-relaxed text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="py-3">
        {assignees.length ? (
          <AvatarGroup title={assignees.map((person) => person.name).join(", ")}>
            {assignees.slice(0, 4).map((person) => (
              <Avatar key={person.id} size="sm">
                {person.avatarUrl ? (
                  <AvatarImage src={person.avatarUrl} alt={person.name} />
                ) : null}
                <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
              </Avatar>
            ))}
            {assignees.length > 4 ? (
              <AvatarGroupCount>+{assignees.length - 4}</AvatarGroupCount>
            ) : null}
          </AvatarGroup>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        )}
      </TableCell>
      <TableCell className="py-3">
        {ticket.priority ? (
          <Badge variant="secondary" style={getChipColorStyle(ticket.priorityColor)}>
            {ticket.priority}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Empty</span>
        )}
      </TableCell>
      <TableCell className="pe-4 py-3 text-end">
        {ticket.url ? (
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0"
            onClick={(event) => {
              event.stopPropagation()
              void navigator.clipboard.writeText(ticket.url || "")
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
      </TableCell>
    </TableRow>
  )
}

function getRowDescription(ticket: MondayTicket) {
  const description = ticket.description?.trim()

  if (!description) {
    return undefined
  }

  const normalizedDescription = normalizeText(description)
  const normalizedDisplayTitle = normalizeText(ticket.displayTitle)
  const normalizedTitle = normalizeText(ticket.title)

  if (
    normalizedDescription === normalizedDisplayTitle ||
    normalizedDescription === normalizedTitle
  ) {
    return undefined
  }

  return description
}

function normalizeText(value?: string) {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase()
}

function getChipColorStyle(color?: string): CSSProperties | undefined {
  if (!color) {
    return undefined
  }

  return {
    backgroundColor: color,
    borderColor: color,
    color: "white",
  }
}

function getGroupTintStyle(color?: string): CSSProperties | undefined {
  if (!color) {
    return undefined
  }

  return {
    background: `color-mix(in srgb, ${color} 4%, var(--background))`,
  }
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}
