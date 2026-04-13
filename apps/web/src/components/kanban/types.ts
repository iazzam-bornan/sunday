import type { MondayStatusLabel, MondayTicket } from "@/lib/monday/types"

export type KanbanColumn = MondayStatusLabel & {
  ticketIds: Array<string>
}

export type KanbanState = {
  columns: Array<KanbanColumn>
  tickets: Record<string, MondayTicket>
}
