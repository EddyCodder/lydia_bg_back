import { RouterBroker } from '@api/abstract/abstract.router';
import { metaController } from '@api/server.module';
import { ConfigService, WaBusiness } from '@config/env.config';
import { Logger } from '@config/logger.config';
import { isValidMetaSignature } from '@utils/verifyMetaSignature';
import { Router } from 'express';

export class MetaRouter extends RouterBroker {
  private readonly logger = new Logger('MetaRouter');

  constructor(readonly configService: ConfigService) {
    super();

    if (!configService.get<WaBusiness>('WA_BUSINESS').APP_SECRET) {
      this.logger.warn(
        'WA_BUSINESS_APP_SECRET no definido: POST /webhook/meta NO valida la firma X-Hub-Signature-256 (cualquiera puede inyectar mensajes)',
      );
    }

    this.router
      .get(this.routerPath('webhook/meta', false), async (req, res) => {
        if (req.query['hub.verify_token'] === configService.get<WaBusiness>('WA_BUSINESS').TOKEN_WEBHOOK)
          res.send(req.query['hub.challenge']);
        else res.send('Error, wrong validation token');
      })
      .post(this.routerPath('webhook/meta', false), async (req, res) => {
        const appSecret = configService.get<WaBusiness>('WA_BUSINESS').APP_SECRET;

        // Con secreto configurado la firma es obligatoria. Meta reintenta los envios que reciben != 200,
        // asi que un secreto mal cargado retrasa mensajes pero no los pierde.
        if (appSecret) {
          const signature = req.get('x-hub-signature-256');
          if (!isValidMetaSignature((req as any).rawBody, signature, appSecret)) {
            this.logger.warn('POST /webhook/meta rechazado: firma X-Hub-Signature-256 ausente o invalida');
            return res.status(401).json({ status: 'error', message: 'Invalid signature' });
          }
        }

        const { body } = req;
        const response = await metaController.receiveWebhook(body);

        return res.status(200).json(response);
      });
  }

  public readonly router: Router = Router();
}
