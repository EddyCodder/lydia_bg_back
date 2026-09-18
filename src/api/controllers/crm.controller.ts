import { CrmService } from '@api/services/crm.service';
import { AgentRole, ChatStatus } from '@prisma/client';

export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  public async listAgents() {
    return this.crmService.listAgents();
  }

  public async createAgent(data: { name: string; email?: string; color?: string; role?: AgentRole }) {
    return this.crmService.createAgent(data);
  }

  public async listConversations(query: { instanceName: string; status?: ChatStatus; assignedAgentId?: string }) {
    return this.crmService.listConversations(query);
  }

  public async getConversation(chatId: string) {
    return this.crmService.getConversation(chatId);
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
    return this.crmService.updateConversation(chatId, data);
  }

  public async listNotes(chatId: string) {
    return this.crmService.listNotes(chatId);
  }

  public async addNote(chatId: string, data: { content: string; agentId?: string }) {
    return this.crmService.addNote(chatId, data);
  }
}
