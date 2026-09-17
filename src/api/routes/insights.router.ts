import 'express-async-errors';

import { insightsController } from '@api/server.module';
import { Router } from 'express';

// LYD-11: dashboard agregado, solo lectura.
export class InsightsRouter {
  public readonly router: Router = Router();

  constructor() {
    this.router.get('/personal', async (req, res) => {
      const { agentId, from, to } = req.query as { agentId?: string; from?: string; to?: string };
      return res.json(await insightsController.getPersonalInsights({ agentId, from, to }));
    });
  }
}
