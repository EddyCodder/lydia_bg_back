import 'express-async-errors';

import { templatesController } from '@api/server.module';
import { Router } from 'express';

// LYD-10: registrada como /crm/template-groups (ver index.router.ts). Las
// rutas de templates individuales (/crm/templates/:id) cuelgan del mismo
// router para no anidar mutaciones bajo /template-groups/:groupId una vez
// que ya se conoce el id del template.
export class TemplatesRouter {
  public readonly router: Router = Router();

  constructor() {
    this.router
      .get('/', async (req, res) => {
        return res.json(await templatesController.listGroups());
      })
      .post('/', async (req, res) => {
        return res.status(201).json(await templatesController.createGroup(req.body ?? {}));
      })
      .patch('/:id', async (req, res) => {
        return res.json(await templatesController.updateGroup(req.params.id, req.body ?? {}));
      })
      .delete('/:id', async (req, res) => {
        await templatesController.deleteGroup(req.params.id);
        return res.status(204).send();
      })
      .post('/:groupId/templates', async (req, res) => {
        return res.status(201).json(await templatesController.createTemplate(req.params.groupId, req.body ?? {}));
      });
  }
}

// LYD-10: /crm/templates/:id -- PATCH/DELETE de un template puntual, sin
// pasar por su grupo. Router aparte porque cuelga de un path distinto
// (/crm/templates, no /crm/template-groups).
export class TemplateItemsRouter {
  public readonly router: Router = Router();

  constructor() {
    this.router
      .patch('/:id', async (req, res) => {
        return res.json(await templatesController.updateTemplate(req.params.id, req.body ?? {}));
      })
      .delete('/:id', async (req, res) => {
        await templatesController.deleteTemplate(req.params.id);
        return res.status(204).send();
      });
  }
}
