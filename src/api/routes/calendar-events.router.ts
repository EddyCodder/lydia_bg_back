import 'express-async-errors';

import { calendarEventsController } from '@api/server.module';
import { Router } from 'express';

// LYD-9: calendario por agente.
export class CalendarEventsRouter {
  public readonly router: Router = Router();

  constructor() {
    this.router
      .get('/', async (req, res) => {
        const { agentId, leadId, from, to } = req.query as {
          agentId?: string;
          leadId?: string;
          from?: string;
          to?: string;
        };
        return res.json(await calendarEventsController.listEvents({ agentId, leadId, from, to }));
      })
      .post('/', async (req, res) => {
        return res.status(201).json(await calendarEventsController.createEvent(req.body ?? {}));
      })
      .patch('/:id', async (req, res) => {
        return res.json(await calendarEventsController.updateEvent(req.params.id, req.body ?? {}));
      })
      .delete('/:id', async (req, res) => {
        await calendarEventsController.deleteEvent(req.params.id);
        return res.status(204).send();
      });
  }
}
