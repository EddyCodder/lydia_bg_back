import 'express-async-errors';

import { welcomeMessageController } from '@api/server.module';
import { Router } from 'express';

// LYD-35: mismo criterio que CrmRouter/LeadsRouter -- no extiende
// RouterBroker (pensado para /:instanceName nativo de WhatsApp con
// validacion JSONSchema). Config singleton por instancia, identificada por
// instanceName en query/body en vez de un :id en la URL.
export class WelcomeMessageRouter {
  public readonly router: Router = Router();

  constructor() {
    this.router
      .get('/', async (req, res) => {
        const { instanceName } = req.query as { instanceName?: string };
        return res.json(await welcomeMessageController.getConfig(instanceName));
      })
      .patch('/', async (req, res) => {
        const { instanceName, enabled, message } = req.body ?? {};
        return res.json(await welcomeMessageController.updateConfig(instanceName, { enabled, message }));
      });
  }
}
