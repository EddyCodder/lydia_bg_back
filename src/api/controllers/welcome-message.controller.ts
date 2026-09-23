import { WelcomeMessageService } from '@api/services/welcome-message.service';

export class WelcomeMessageController {
  constructor(private readonly welcomeMessageService: WelcomeMessageService) {}

  public async getConfig(instanceName: string) {
    return this.welcomeMessageService.getConfig(instanceName);
  }

  public async updateConfig(instanceName: string, data: { enabled?: boolean; message?: string }) {
    return this.welcomeMessageService.updateConfig(instanceName, data);
  }
}
