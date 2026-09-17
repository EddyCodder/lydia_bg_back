import 'express-async-errors';

import { crmController } from '@api/server.module';
import { BadRequestException } from '@exceptions';
import { ChatStatus } from '@prisma/client';
import { Router } from 'express';

// CRM-12: capa de agentes/asignacion/notas para el frontend de Lydia
// (lydia_bg_front), reemplazando lo que daba Chatwoot. No extiende
// RouterBroker: ese abstraccion asume rutas ancladas a /:instanceName con
// validacion JSONSchema pensada para operaciones de WhatsApp -- estas rutas
// son CRUD simple sobre datos propios de Lydia, sin esa forma.
export class CrmRouter {
  public readonly router: Router = Router();

  constructor() {
    this.router
      .get('/agents', async (req, res) => {
        return res.json(await crmController.listAgents());
      })
      .post('/agents', async (req, res) => {
        const { name, email, color } = req.body ?? {};
        return res.status(201).json(await crmController.createAgent({ name, email, color }));
      })
      .get('/conversations', async (req, res) => {
        const { instanceName, status, assignedAgentId } = req.query as {
          instanceName?: string;
          status?: ChatStatus;
          assignedAgentId?: string;
        };
        if (!instanceName) {
          throw new BadRequestException('instanceName query param is required');
        }
        return res.json(await crmController.listConversations({ instanceName, status, assignedAgentId }));
      })
      .get('/conversations/:chatId', async (req, res) => {
        return res.json(await crmController.getConversation(req.params.chatId));
      })
      .patch('/conversations/:chatId', async (req, res) => {
        const { status, assignedAgentId } = req.body ?? {};
        return res.json(await crmController.updateConversation(req.params.chatId, { status, assignedAgentId }));
      })
      .get('/conversations/:chatId/notes', async (req, res) => {
        return res.json(await crmController.listNotes(req.params.chatId));
      })
      .post('/conversations/:chatId/notes', async (req, res) => {
        const { content, agentId } = req.body ?? {};
        return res.status(201).json(await crmController.addNote(req.params.chatId, { content, agentId }));
      });
  }
}
