import { CSS } from "@dnd-kit/utilities"
import { CopyLinkIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useSortable } from "@dnd-kit/sortable"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { memo, useState } from "react"
import type { CSSProperties } from "react"

import type { MondayTicket } from "@/lib/monday/types"

type TicketCardProps = {
  ticket: MondayTicket
  onOpen: (ticket: MondayTicket) => void
}

export const TicketCard = memo(function TicketCard({
  ticket,
  onOpen,
}: TicketCardProps) {
  const assignees = ticket.assignees || []
  const [copied, setCopied] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id })

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group rounded-lg border border-border bg-card p-3 shadow-sm transition hover:border-foreground/30",
        isDragging && "scale-[1.01] opacity-70 shadow-lg"
      )}
    >
      <button
        className="flex w-full cursor-grab touch-none flex-col gap-2 text-start active:cursor-grabbing"
        {...attributes}
        {...listeners}
        onClick={() => onOpen(ticket)}
        type="button"
      >
        <span className="text-[13px] leading-snug font-medium">
          {ticket.displayTitle}
        </span>
        {ticket.description ? (
          <span className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {ticket.description}
          </span>
        ) : null}
        <span className="flex flex-wrap gap-1.5">
          <Badge variant="outline" style={getColorStyle(ticket.statusColor)}>
            {ticket.statusLabel}
          </Badge>
          {ticket.group ? (
            <Badge variant="outline">{ticket.group}</Badge>
          ) : null}
          {ticket.priority ? (
            <Badge
              variant="secondary"
              style={getColorStyle(ticket.priorityColor)}
            >
              {ticket.priority}
            </Badge>
          ) : null}
          {ticket.dueDate ? (
            <Badge variant="ghost">{ticket.dueDate}</Badge>
          ) : null}
        </span>
      </button>
      <div className="mt-3 flex items-center justify-between gap-2">
        {assignees.length ? (
          <AvatarGroup title={ticket.owner}>
            {assignees.slice(0, 3).map((person) => (
              <Avatar key={person.id} size="sm">
                {person.avatarUrl ? (
                  <AvatarImage src={person.avatarUrl} alt={person.name} />
                ) : null}
                <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
              </Avatar>
            ))}
            {assignees.length > 3 ? (
              <AvatarGroupCount>+{assignees.length - 3}</AvatarGroupCount>
            ) : null}
          </AvatarGroup>
        ) : (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            Unassigned
          </span>
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          {ticket.url ? (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => {
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
          {ticket.prUrl ? (
            <Button asChild variant="outline" size="xs">
              <a href={ticket.prUrl} target="_blank" rel="noreferrer">
                PR
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}, areTicketCardPropsEqual)

function areTicketCardPropsEqual(
  previous: TicketCardProps,
  next: TicketCardProps
) {
  return previous.ticket === next.ticket
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

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}
