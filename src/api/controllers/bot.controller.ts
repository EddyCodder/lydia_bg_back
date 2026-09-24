import { BotService } from '@api/services/bot.service';

export class BotController {
  constructor(private readonly botService: BotService) {}

  public async getFlow(instanceName: string) {
    return this.botService.getFlow(instanceName);
  }

  public async saveFlow(instanceName: string, data: { enabled?: boolean; graph?: unknown }) {
    return this.botService.saveFlow(instanceName, data);
  }
}
