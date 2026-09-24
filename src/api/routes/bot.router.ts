import 'express-async-errors';

import { botController } from '@api/server.module';
import { Router } from 'express';

// LYD-47: mismo criterio que WelcomeMessageRouter -- CRUD propio de Lydia,
// sin RouterBroker. Un flujo por instancia, identificado por instanceName.
export class BotRouter {
  public readonly router: Router = Router();

  constructor() {
    this.router
      .get('/', async (req, res) => {
        const { instanceName } = req.query as { instanceName?: string };
        return res.json(await botController.getFlow(instanceName));
      })
      .put('/', async (req, res) => {
        const { instanceName, enabled, graph } = req.body ?? {};
        return res.json(await botController.saveFlow(instanceName, { enabled, graph }));
      });
  }
}
