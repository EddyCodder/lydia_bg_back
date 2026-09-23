import { PrismaRepository } from '@api/repository/repository.service';
import { BadRequestException, NotFoundException } from '@exceptions';

// LYD-35: config del mensaje de bienvenida automatico, por instancia --
// reemplazo minimo (v1) del Salesbot de Kommo. Este service solo persiste
// on/off + texto; la logica de "a quien se le manda" (solo WhatsApp/Baileys,
// numeros sin historial previo, una sola vez) vive en whatsapp.baileys.service.
export class WelcomeMessageService {
  constructor(private readonly prisma: PrismaRepository) {}

  public async getConfig(instanceName: string) {
    const instance = await this.findInstanceWithConfig(instanceName);
    return {
      instanceName: instance.name,
      enabled: instance.WelcomeMessageConfig?.enabled ?? false,
      message: instance.WelcomeMessageConfig?.message ?? '',
    };
  }

  public async updateConfig(instanceName: string, data: { enabled?: boolean; message?: string }) {
    if (data.enabled !== undefined && typeof data.enabled !== 'boolean') {
      throw new BadRequestException('enabled must be a boolean');
    }
    if (data.message !== undefined && typeof data.message !== 'string') {
      throw new BadRequestException('message must be a string');
    }

    const instance = await this.findInstanceWithConfig(instanceName);
    const existing = instance.WelcomeMessageConfig;

    const enabled = data.enabled ?? existing?.enabled ?? false;
    const message = data.message !== undefined ? data.message.trim() : (existing?.message ?? '');

    // No tiene sentido activar la automatizacion sin texto -- mandaria un
    // WhatsApp vacio al primer numero nuevo que escriba.
    if (enabled && !message) {
      throw new BadRequestException('message is required to enable the automation');
    }

    const config = await this.prisma.welcomeMessageConfig.upsert({
      where: { instanceId: instance.id },
      create: { instanceId: instance.id, enabled, message },
      update: { enabled, message },
    });

    return { instanceName: instance.name, enabled: config.enabled, message: config.message ?? '' };
  }

  // instanceName llega tal cual del query/body (req.query puede ser array si
  // el caller repite el parametro) -- se valida el tipo en runtime, no solo
  // en el tipado de TS, que no se cumple en el limite HTTP.
  private async findInstanceWithConfig(instanceName: string) {
    if (!instanceName || typeof instanceName !== 'string') {
      throw new BadRequestException('instanceName is required');
    }
    const instance = await this.prisma.instance.findUnique({
      where: { name: instanceName },
      include: { WelcomeMessageConfig: true },
    });
    if (!instance) {
      throw new NotFoundException(`Instance "${instanceName}" not found`);
    }
    return instance;
  }
}
