import { PrismaRepository } from '@api/repository/repository.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { Integration } from '@api/types/wa.types';
import { Logger } from '@config/logger.config';
import axios from 'axios';

import { ChannelController, ChannelControllerInterface } from '../channel.controller';

export class MetaController extends ChannelController implements ChannelControllerInterface {
  private readonly logger = new Logger('MetaController');

  constructor(prismaRepository: PrismaRepository, waMonitor: WAMonitoringService) {
    super(prismaRepository, waMonitor);
  }

  integrationEnabled: boolean;

  // LYD-26: Messenger (object `page`) e Instagram (object `instagram`) comparten forma de payload
  // (entry[].messaging[]) y se enrutan por `entry.id` = id de la Pagina / cuenta de Instagram, que es
  // el `number` de la instancia. Se filtra por integracion para que un id no cruce canales.
  private async receiveMessagingWebhook(data: any) {
    const integration = data.object === 'page' ? Integration.FACEBOOK_MESSENGER : Integration.INSTAGRAM;

    for (const entry of data.entry ?? []) {
      const instance = await this.prismaRepository.instance.findFirst({
        where: { number: `${entry.id}`, integration },
      });
      const channel = instance && this.waMonitor.waInstances[instance.name];

      if (!channel) {
        this.logger.warn(`Webhook de ${data.object} para ${entry.id}: no hay instancia ${integration} registrada`);
        continue;
      }

      await channel.connectToWhatsapp(entry);
    }

    return {
      status: 'success',
    };
  }

  public async receiveWebhook(data: any) {
    if (data.object === 'page' || data.object === 'instagram') {
      return this.receiveMessagingWebhook(data);
    }

    if (data.object === 'whatsapp_business_account') {
      if (data.entry[0]?.changes[0]?.field === 'message_template_status_update') {
        const template = await this.prismaRepository.template.findFirst({
          where: { templateId: `${data.entry[0].changes[0].value.message_template_id}` },
        });

        if (!template) {
          console.log('template not found');
          return;
        }

        const { webhookUrl } = template;

        await axios.post(webhookUrl, data.entry[0].changes[0].value, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        return;
      }

      data.entry?.forEach(async (entry: any) => {
        const numberId = entry.changes[0].value.metadata.phone_number_id;

        if (!numberId) {
          this.logger.error('WebhookService -> receiveWebhookMeta -> numberId not found');
          return {
            status: 'success',
          };
        }

        const instance = await this.prismaRepository.instance.findFirst({
          where: { number: numberId },
        });

        if (!instance) {
          this.logger.error('WebhookService -> receiveWebhookMeta -> instance not found');
          return {
            status: 'success',
          };
        }

        await this.waMonitor.waInstances[instance.name].connectToWhatsapp(data);

        return {
          status: 'success',
        };
      });
    }

    return {
      status: 'success',
    };
  }
}
