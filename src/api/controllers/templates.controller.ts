import { TemplatesService } from '@api/services/templates.service';

export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  public async listGroups() {
    return this.templatesService.listGroups();
  }

  public async createGroup(data: { title: string }) {
    return this.templatesService.createGroup(data);
  }

  public async updateGroup(id: string, data: { title?: string }) {
    return this.templatesService.updateGroup(id, data);
  }

  public async deleteGroup(id: string) {
    return this.templatesService.deleteGroup(id);
  }

  public async createTemplate(groupId: string, data: { command: string; label: string; body: string }) {
    return this.templatesService.createTemplate(groupId, data);
  }

  public async updateTemplate(id: string, data: { command?: string; label?: string; body?: string }) {
    return this.templatesService.updateTemplate(id, data);
  }

  public async deleteTemplate(id: string) {
    return this.templatesService.deleteTemplate(id);
  }
}
