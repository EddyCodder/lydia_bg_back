import { PrismaRepository } from '@api/repository/repository.service';
import { BadRequestException, NotFoundException } from '@exceptions';
import { AgentRole, ChatStatus } from '@prisma/client';

// CRM-12: capa de agentes humanos sobre las conversaciones de WhatsApp que
// ya persiste Evolution API (Chat/Contact/Message). No reimplementa nada de
// eso -- solo agrega lo que daba Chatwoot: asignacion de agente, estado de
// atencion (open/pending/resolved) y notas internas.
export class CrmService {
  constructor(private readonly prisma: PrismaRepository) {}

  public async listAgents() {
    return this.prisma.agent.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  public async createAgent(data: { name: string; email?: string; color?: string; role?: AgentRole }) {
    if (!data?.name) {
      throw new BadRequestException('name is required');
    }
    return this.prisma.agent.create({ data });
  }

  // Chat y Contact no tienen relacion FK entre si en el schema de Evolution
  // (ambos son unique por [instanceId, remoteJid] pero independientes) --
  // se cruzan a mano aca en vez de duplicar el contacto en una tabla propia.
  public async listConversations(params: { instanceName: string; status?: ChatStatus; assignedAgentId?: string }) {
    const { instanceName, status, assignedAgentId } = params;
    if (!instanceName) {
      throw new BadRequestException('instanceName is required');
    }

    const instance = await this.prisma.instance.findUnique({ where: { name: instanceName } });
    if (!instance) {
      throw new NotFoundException(`Instance "${instanceName}" not found`);
    }

    const chats = await this.prisma.chat.findMany({
      where: {
        instanceId: instance.id,
        ...(status ? { status } : {}),
        ...(assignedAgentId ? { assignedAgentId } : {}),
      },
      include: { Agent: true },
      orderBy: { updatedAt: 'desc' },
    });

    const remoteJids = chats.map((c) => c.remoteJid);
    const contacts = remoteJids.length
      ? await this.prisma.contact.findMany({
          where: { instanceId: instance.id, remoteJid: { in: remoteJids } },
        })
      : [];
    const contactByJid = new Map(contacts.map((c) => [c.remoteJid, c]));
    const lastMessageByJid = await this.lastMessageByRemoteJid(instance.id, remoteJids);

    return chats.map((chat) => ({
      ...chat,
      contact: contactByJid.get(chat.remoteJid) ?? null,
      lastMessage: lastMessageByJid.get(chat.remoteJid) ?? null,
    }));
  }

  // Message.key es JSON (no hay columna remoteJid propia) -- no hay forma de
  // pedirle a Prisma "el mas nuevo por remoteJid" en una sola query sin SQL
  // crudo. Con el volumen de mensajes de una instancia nueva esto alcanza;
  // si el historial crece mucho, esto se vuelve candidato a reemplazar por
  // un SELECT DISTINCT ON (key->>'remoteJid') ... ORDER BY messageTimestamp
  // DESC con indice dedicado.
  private async lastMessageByRemoteJid(instanceId: string, remoteJids: string[]) {
    const result = new Map<string, { content: string; timestamp: number }>();
    if (!remoteJids.length) return result;

    const messages = await this.prisma.message.findMany({
      where: {
        instanceId,
        OR: remoteJids.map((remoteJid) => ({ key: { path: ['remoteJid'], equals: remoteJid } })),
      },
      orderBy: { messageTimestamp: 'desc' },
      select: { key: true, message: true, messageTimestamp: true },
    });

    for (const m of messages) {
      const remoteJid = (m.key as { remoteJid?: string })?.remoteJid;
      if (!remoteJid || result.has(remoteJid)) continue; // ya ordenado desc: el primero que aparece es el mas nuevo
      const body = m.message as { conversation?: string; extendedTextMessage?: { text?: string } };
      const content = body?.conversation ?? body?.extendedTextMessage?.text ?? '';
      result.set(remoteJid, { content, timestamp: m.messageTimestamp });
    }
    return result;
  }

  public async getConversation(chatId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { Agent: true, Note: { orderBy: { createdAt: 'asc' }, include: { Agent: true } } },
    });
    if (!chat) {
      throw new NotFoundException(`Conversation "${chatId}" not found`);
    }
    const contact = await this.prisma.contact.findFirst({
      where: { instanceId: chat.instanceId, remoteJid: chat.remoteJid },
    });
    return { ...chat, contact: contact ?? null };
  }

  public async updateConversation(
    chatId: string,
    data: { status?: ChatStatus; assignedAgentId?: string | null; unreadMessages?: number },
  ) {
    await this.assertChatExists(chatId);

    if (data.assignedAgentId) {
      const agent = await this.prisma.agent.findUnique({ where: { id: data.assignedAgentId } });
      if (!agent) {
        throw new BadRequestException(`Agent "${data.assignedAgentId}" not found`);
      }
    }

    // unreadMessages es de Evolution API (Chat.unreadMessages), no algo propio
    // de CRM -- lo unico que necesita el frontend es poder ponerlo en 0 al
    // abrir la conversacion (LYD-13). No se expone para setearlo a cualquier
    // valor arbitrario.
    if (data.unreadMessages !== undefined && data.unreadMessages !== 0) {
      throw new BadRequestException('unreadMessages solo puede setearse a 0');
    }

    return this.prisma.chat.update({
      where: { id: chatId },
      data,
      include: { Agent: true },
    });
  }

  public async listNotes(chatId: string) {
    await this.assertChatExists(chatId);
    return this.prisma.conversationNote.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      include: { Agent: true },
    });
  }

  public async addNote(chatId: string, data: { content: string; agentId?: string }) {
    await this.assertChatExists(chatId);
    if (!data?.content?.trim()) {
      throw new BadRequestException('content is required');
    }
    return this.prisma.conversationNote.create({
      data: { chatId, content: data.content, agentId: data.agentId ?? null },
      include: { Agent: true },
    });
  }

  private async assertChatExists(chatId: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) {
      throw new NotFoundException(`Conversation "${chatId}" not found`);
    }
    return chat;
  }
}
