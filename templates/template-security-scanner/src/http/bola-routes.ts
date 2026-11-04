import type { Hono } from 'hono';
import { z } from 'zod';
import { idSchema, pageSchema, parse, ifMatchRevision } from '../core/contracts.js';
import type { BolaAssessmentService } from '../investigation/bola-service.js';
import { OPERATOR_ID, readJson } from './security.js';

export function registerBolaRoutes(app: Hono, service: BolaAssessmentService) {
  app.post('/api/targets/:id/assessments', async context =>
    context.json(
      await service.admit(OPERATOR_ID, parse(idSchema, context.req.param('id')), await readJson(context.req)),
      202,
    ),
  );
  app.get('/api/assessments', async context => {
    const { limit, offset } = parse(pageSchema, context.req.query());
    return context.json({ items: await service.store.list(OPERATOR_ID, limit, offset), limit, offset });
  });
  app.get('/api/assessments/:id', async context =>
    context.json(await service.get(OPERATOR_ID, context.req.param('id'))),
  );
  app.post('/api/assessments/:id/cancel', async context => {
    parse(z.object({}).strict(), await readJson(context.req));
    const revision = parse(ifMatchRevision, context.req.header('if-match'));
    const result = await service.cancel(OPERATOR_ID, context.req.param('id'), revision);
    context.header('ETag', `"${result.revision}"`);
    return context.json(result);
  });
  app.get('/api/bola-findings', async context => {
    const { limit, offset } = parse(pageSchema, context.req.query());
    return context.json({ items: await service.store.findings(OPERATOR_ID, limit, offset), limit, offset });
  });
  app.get('/api/bola-findings/:id', async context =>
    context.json(await service.store.finding(parse(idSchema, context.req.param('id')), OPERATOR_ID)),
  );
}
