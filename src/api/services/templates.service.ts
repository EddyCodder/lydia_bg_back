import { PrismaRepository } from '@api/repository/repository.service';
import { BadRequestException, NotFoundException } from '@exceptions';

// LYD-10: plantillas de respuesta rapida del composer, agrupadas.
export class TemplatesService {
  constructor(private readonly prisma: PrismaRepository) {}

  public async listGroups() {
    return this.prisma.templateGroup.findMany({
      include: { Templates: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  public async createGroup(data: { title: string }) {
    if (!data?.title?.trim()) {
      throw new BadRequestException('title is required');
    }
    return this.prisma.templateGroup.create({ data: { title: data.title }, include: { Templates: true } });
  }

  public async updateGroup(id: string, data: { title?: string }) {
    await this.assertGroupExists(id);
    return this.prisma.templateGroup.update({
      where: { id },
      data,
      include: { Templates: { orderBy: { createdAt: 'asc' } } },
    });
  }

  public async deleteGroup(id: string) {
    await this.assertGroupExists(id);
    await this.prisma.templateGroup.delete({ where: { id } });
  }

  public async createTemplate(groupId: string, data: { command: string; label: string; body: string }) {
    await this.assertGroupExists(groupId);
    if (!data?.command?.trim() || !data?.label?.trim() || !data?.body?.trim()) {
      throw new BadRequestException('command, label and body are required');
    }
    return this.prisma.quickReplyTemplate.create({ data: { ...data, groupId } });
  }

  public async updateTemplate(id: string, data: { command?: string; label?: string; body?: string }) {
    await this.assertTemplateExists(id);
    return this.prisma.quickReplyTemplate.update({ where: { id }, data });
  }

  public async deleteTemplate(id: string) {
    await this.assertTemplateExists(id);
    await this.prisma.quickReplyTemplate.delete({ where: { id } });
  }

  private async assertGroupExists(id: string) {
    const group = await this.prisma.templateGroup.findUnique({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Template group "${id}" not found`);
    }
    return group;
  }

  private async assertTemplateExists(id: string) {
    const template = await this.prisma.quickReplyTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template "${id}" not found`);
    }
    return template;
  }
}
