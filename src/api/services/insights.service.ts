import { PrismaRepository } from '@api/repository/repository.service';

// LYD-11: agregados de solo lectura sobre Chat/Lead/CalendarEvent para el
// dashboard personal (PersonalDashboard.tsx). No incluye mensajesEntrantes
// por canal, lapsoMedioRespuesta ni deltasPorSemana -- esos necesitan
// timestamps de mensajes que hoy no se modelan (ver LYD-11, ticket de
// seguimiento aparte).
export class InsightsService {
  constructor(private readonly prisma: PrismaRepository) {}

  public async getPersonalInsights(params: { agentId?: string; from?: string; to?: string }) {
    const { agentId, from, to } = params;
    const dateRange =
      from || to
        ? {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          }
        : undefined;

    const [
      dialogosVigentes,
      dialogosSinReplica,
      leadsGanados,
      leadsActivos,
      leadsPerdidos,
      leadsSinTareas,
      fuentes,
      tareas,
    ] = await Promise.all([
      this.prisma.chat.count({
        where: { status: { not: 'resolved' }, ...(agentId ? { assignedAgentId: agentId } : {}) },
      }),
      this.prisma.chat.count({
        where: { status: 'pending', ...(agentId ? { assignedAgentId: agentId } : {}) },
      }),
      this.prisma.lead.aggregate({
        where: { stage: 'matriculado', ...(agentId ? { assignedAgentId: agentId } : {}) },
        _count: true,
        _sum: { budgetAmount: true },
      }),
      this.prisma.lead.aggregate({
        where: {
          stage: { notIn: ['matriculado', 'venta_perdida'] },
          ...(agentId ? { assignedAgentId: agentId } : {}),
        },
        _count: true,
        _sum: { budgetAmount: true },
      }),
      this.prisma.lead.count({
        where: { stage: 'venta_perdida', ...(agentId ? { assignedAgentId: agentId } : {}) },
      }),
      this.prisma.lead.count({
        where: { hasPendingTasks: false, ...(agentId ? { assignedAgentId: agentId } : {}) },
      }),
      this.prisma.lead.groupBy({
        by: ['source'],
        where: agentId ? { assignedAgentId: agentId } : undefined,
        _count: true,
      }),
      this.prisma.calendarEvent.count({
        where: { ...(agentId ? { agentId } : {}), ...(dateRange ? { startAt: dateRange } : {}) },
      }),
    ]);

    return {
      dialogosVigentes,
      dialogosSinReplica,
      leadsGanados: { count: leadsGanados._count, sumBudget: Number(leadsGanados._sum.budgetAmount ?? 0) },
      leadsActivos: { count: leadsActivos._count, sumBudget: Number(leadsActivos._sum.budgetAmount ?? 0) },
      leadsPerdidos: { count: leadsPerdidos },
      leadsSinTareas: { count: leadsSinTareas },
      fuentes: Object.fromEntries(fuentes.map((f) => [f.source, f._count])),
      tareas: { count: tareas },
    };
  }
}
