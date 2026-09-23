import { PrismaRepository } from '@api/repository/repository.service';
import { BadRequestException, NotFoundException } from '@exceptions';
import { AgentRole, ChatStatus } from '@prisma/client';
import { status as messageStatus } from '@utils/renderStatus';

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
  //
  // LYD-31: instanceName ahora es opcional -- sin el, se listan las conversaciones
  // de TODAS las instancias (canales) juntas, mezcladas y ordenadas por ultimo
  // mensaje. remoteJid solo es unico dentro de una instancia (dos canales podrian
  // en teoria compartir el mismo valor), asi que contactos y ultimo mensaje se
  // resuelven por instancia, no en una sola consulta cruzada.
  public async listConversations(params: { instanceName?: string; status?: ChatStatus; assignedAgentId?: string }) {
    const { instanceName, status, assignedAgentId } = params;

    let instances: { id: string; name: string; integration: string }[];
    if (instanceName) {
      const instance = await this.prisma.instance.findUnique({ where: { name: instanceName } });
      if (!instance) {
        throw new NotFoundException(`Instance "${instanceName}" not found`);
      }
      instances = [instance];
    } else {
      instances = await this.prisma.instance.findMany();
    }

    const byInstance = await Promise.all(
      instances.map(async (instance) => {
        // Sin orderBy aca a proposito: Chat.updatedAt es @updatedAt de Prisma, se pisa con
        // cualquier escritura a la fila -- incluido el PATCH de "marcar como leida" al abrir
        // la conversacion (unreadMessages: 0). Ordenar por eso hacia que abrir un chat lo
        // subiera al tope aunque no hubiera mensaje nuevo. El orden real se calcula al final,
        // por el timestamp del ultimo mensaje, que solo cambia cuando llega o se envia uno.
        const chats = await this.prisma.chat.findMany({
          where: {
            instanceId: instance.id,
            ...(status ? { status } : {}),
            ...(assignedAgentId ? { assignedAgentId } : {}),
          },
          include: { Agent: true },
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
          instanceName: instance.name,
          integration: instance.integration,
          contact: contactByJid.get(chat.remoteJid) ?? null,
          lastMessage: lastMessageByJid.get(chat.remoteJid) ?? null,
        }));
      }),
    );

    return byInstance.flat().sort((a, b) => {
      // Chats sin ningun mensaje (recien creados, caso raro) van al final por updatedAt.
      const ta = a.lastMessage?.timestamp ?? Math.floor(a.updatedAt?.getTime() / 1000);
      const tb = b.lastMessage?.timestamp ?? Math.floor(b.updatedAt?.getTime() / 1000);
      return tb - ta;
    });
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
      const content = body?.conversation ?? body?.extendedTextMessage?.text ?? this.mediaPreviewLabel(m.message);
      result.set(remoteJid, { content, timestamp: m.messageTimestamp });
    }
    return result;
  }

  // LYD-15: sin esto, un mensaje que es solo una foto/audio/documento (sin
  // texto) mostraba el preview de "Ultimo mensaje" vacio en la lista de
  // conversaciones.
  private mediaPreviewLabel(message: unknown): string {
    const body = message as Record<string, unknown>;
    if (body?.imageMessage) return 'Foto';
    if (body?.videoMessage) return 'Video';
    if (body?.audioMessage) return 'Audio';
    if (body?.documentMessage) return 'Documento';
    if (body?.stickerMessage) return 'Sticker';
    return '';
  }

  public async getConversation(chatId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { Agent: true, Note: { orderBy: { createdAt: 'asc' }, include: { Agent: true } }, Instance: true },
    });
    if (!chat) {
      throw new NotFoundException(`Conversation "${chatId}" not found`);
    }
    const contact = await this.prisma.contact.findFirst({
      where: { instanceId: chat.instanceId, remoteJid: chat.remoteJid },
    });
    // LYD-31: instanceName/integration van sueltos (no solo dentro de Instance) porque
    // el front los necesita para saber contra que canal mandar los mensajes/media.
    return {
      ...chat,
      instanceName: chat.Instance.name,
      integration: chat.Instance.integration,
      contact: contact ?? null,
    };
  }

  public async updateConversation(
    chatId: string,
    data: {
      status?: ChatStatus;
      assignedAgentId?: string | null;
      unreadMessages?: number;
      contactNameOverride?: string | null;
      contactPhoneOverride?: string | null;
    },
  ) {
    const chat = await this.assertChatExists(chatId);

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

    // Chat.unreadMessages no es la fuente de verdad -- whatsapp.baileys.service
    // (updateChatUnreadMessages) lo recalcula de cero contando Message.status
    // = DELIVERY_ACK cada vez que llega un mensaje nuevo. Poner solo el
    // contador en 0 sin tocar el status de los mensajes hacia que el badge
    // volviera a "resucitar" con todos los mensajes viejos + el nuevo en
    // cuanto entraba cualquier mensaje siguiente (bug reportado en LYD-13).
    if (data.unreadMessages === 0) {
      await this.prisma.$executeRaw`
        UPDATE "Message"
        SET "status" = ${messageStatus[4]}
        WHERE "instanceId" = ${chat.instanceId}
        AND "key"->>'remoteJid' = ${chat.remoteJid}
        AND ("key"->>'fromMe')::boolean = false
        AND ("status" IS NULL OR "status" = ${messageStatus[3]})
      `;
    }

    // LYD-14: string vacio limpia el override (vuelve a mostrar el nombre/
    // numero nativo de WhatsApp), no se guarda como "".
    if (data.contactNameOverride !== undefined) {
      data.contactNameOverride = data.contactNameOverride?.trim() || null;
    }
    if (data.contactPhoneOverride !== undefined) {
      data.contactPhoneOverride = data.contactPhoneOverride?.trim() || null;
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
