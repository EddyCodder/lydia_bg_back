import { PrismaRepository } from '@api/repository/repository.service';
import { BadRequestException, NotFoundException } from '@exceptions';
import { CalendarEventType } from '@prisma/client';

// LYD-9: calendario por agente. type='tarea' es el unico que retroalimenta
// Lead.hasPendingTasks (usado por el board de pipeline y por Insights) --
// los demas tipos (chat/nota/reserva) son informativos, no bloquean nada.
export class CalendarEventsService {
  constructor(private readonly prisma: PrismaRepository) {}

  public async listEvents(params: { agentId?: string; leadId?: string; from?: string; to?: string }) {
    const { agentId, leadId, from, to } = params;
    return this.prisma.calendarEvent.findMany({
      where: {
        ...(agentId ? { agentId } : {}),
        ...(leadId ? { leadId } : {}),
        ...(from || to
          ? {
              startAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: { Agent: true, Lead: true },
      orderBy: { startAt: 'asc' },
    });
  }

  public async createEvent(data: {
    type: CalendarEventType;
    leadId?: string;
    agentId?: string;
    startAt: string;
    endAt: string;
    note: string;
  }) {
    if (!data?.type) {
      throw new BadRequestException('type is required');
    }
    if (!data?.startAt || !data?.endAt) {
      throw new BadRequestException('startAt and endAt are required');
    }
    if (data.leadId) {
      const lead = await this.prisma.lead.findUnique({ where: { id: data.leadId } });
      if (!lead) {
        throw new BadRequestException(`Lead "${data.leadId}" not found`);
      }
    }
    if (data.agentId) {
      const agent = await this.prisma.agent.findUnique({ where: { id: data.agentId } });
      if (!agent) {
        throw new BadRequestException(`Agent "${data.agentId}" not found`);
      }
    }

    const event = await this.prisma.calendarEvent.create({
      data: {
        type: data.type,
        leadId: data.leadId ?? null,
        agentId: data.agentId ?? null,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
        note: data.note ?? '',
      },
      include: { Agent: true, Lead: true },
    });

    if (event.type === 'tarea' && event.leadId) {
      await this.syncLeadPendingTasks(event.leadId);
    }
    return event;
  }

  public async updateEvent(
    id: string,
    data: {
      type?: CalendarEventType;
      leadId?: string | null;
      agentId?: string | null;
      startAt?: string;
      endAt?: string;
      note?: string;
      completed?: boolean;
    },
  ) {
    const existing = await this.assertEventExists(id);

    const event = await this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...data,
        ...(data.startAt ? { startAt: new Date(data.startAt) } : {}),
        ...(data.endAt ? { endAt: new Date(data.endAt) } : {}),
      },
      include: { Agent: true, Lead: true },
    });

    // Resincroniza tanto el lead viejo (por si se le saco la tarea o se
    // marco completada) como el nuevo (si se reasigno el evento a otro lead).
    const leadIdsToSync = new Set([existing.leadId, event.leadId].filter(Boolean) as string[]);
    for (const leadId of leadIdsToSync) {
      await this.syncLeadPendingTasks(leadId);
    }
    return event;
  }

  public async deleteEvent(id: string) {
    const existing = await this.assertEventExists(id);
    await this.prisma.calendarEvent.delete({ where: { id } });
    if (existing.leadId) {
      await this.syncLeadPendingTasks(existing.leadId);
    }
  }

  // Un lead tiene tareas pendientes si le queda al menos un evento
  // type='tarea' con completed=false.
  private async syncLeadPendingTasks(leadId: string) {
    const pending = await this.prisma.calendarEvent.count({
      where: { leadId, type: 'tarea', completed: false },
    });
    await this.prisma.lead.update({ where: { id: leadId }, data: { hasPendingTasks: pending > 0 } });
  }

  private async assertEventExists(id: string) {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Calendar event "${id}" not found`);
    }
    return event;
  }
}
