import type { Hono } from 'hono';
import { z } from 'zod';
import {
  ControlPlaneError,
  idSchema,
  pageSchema,
  parse,
  ifMatchRevision as revisionHeader,
} from '../core/contracts.js';
import type { InvestigationService } from '../investigation/service.js';
import { OPERATOR_ID, readJson } from './security.js';

const approvalRequest = z
  .object({
    callback: z.url().max(2048),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export function registerInvestigationRoutes(app: Hono, service: InvestigationService, modelEnabled = false) {
  const page = (value: unknown) => parse(pageSchema, value);
  const id = (value: unknown) => parse(idSchema, value);
  app.get('/api/investigations', async context => {
    const { limit, offset } = page(context.req.query());
    return context.json({
      items: await service.store.list('scanner_investigations', OPERATOR_ID, limit, offset),
      limit,
      offset,
    });
  });
  app.post('/api/targets/:id/verification-resources', async context => {
    const result = await service.bindOwnedResource(
      OPERATOR_ID,
      id(context.req.param('id')),
      await readJson(context.req),
    );
    return context.json(result.binding, result.created ? 201 : 200);
  });
  app.post('/api/investigations', async context => {
    const result = await service.admit(OPERATOR_ID, await readJson(context.req));
    context.header('ETag', `"${result.investigation.revision}"`);
    return context.json(result.investigation, result.created ? 201 : 200);
  });
  app.get('/api/investigations/:id', async context => {
    const result = await service.store.getInvestigation(id(context.req.param('id')), OPERATOR_ID);
    context.header('ETag', `"${result.revision}"`);
    return context.json(result);
  });
  app.post('/api/investigations/:id/cancel', async context => {
    parse(z.object({}).strict(), await readJson(context.req));
    const revision = parse(revisionHeader, context.req.header('if-match'));
    const result = await service.cancel(OPERATOR_ID, id(context.req.param('id')), revision);
    context.header('ETag', `"${result.revision}"`);
    return context.json(result);
  });
  app.get('/api/investigations/:id/hypotheses', async context => {
    const investigationId = id(context.req.param('id'));
    await service.store.getInvestigation(investigationId, OPERATOR_ID);
    const { limit, offset } = page(context.req.query());
    return context.json({
      items: await service.store.list('scanner_hypotheses', OPERATOR_ID, limit, offset, investigationId),
      limit,
      offset,
    });
  });
  app.post('/api/investigations/:id/plan', async context => {
    if (!modelEnabled) throw new ControlPlaneError('INVESTIGATION_DISABLED', 403);
    parse(z.object({}).strict(), await readJson(context.req));
    return context.json(await service.proposeWithModels(OPERATOR_ID, id(context.req.param('id'))));
  });
  app.get('/api/investigations/:id/jobs', async context => {
    const investigationId = id(context.req.param('id'));
    await service.store.getInvestigation(investigationId, OPERATOR_ID);
    const { limit, offset } = page(context.req.query());
    return context.json({
      items: await service.store.list('scanner_verification_jobs', OPERATOR_ID, limit, offset, investigationId),
      limit,
      offset,
    });
  });
  app.get('/api/investigations/:id/findings', async context => {
    const investigationId = id(context.req.param('id'));
    await service.store.getInvestigation(investigationId, OPERATOR_ID);
    const { limit, offset } = page(context.req.query());
    return context.json({
      items: await service.store.list('scanner_findings', OPERATOR_ID, limit, offset, investigationId),
      limit,
      offset,
    });
  });
  app.get('/api/investigations/:id/evaluations', async context => {
    const investigationId = id(context.req.param('id'));
    await service.store.getInvestigation(investigationId, OPERATOR_ID);
    const { limit, offset } = page(context.req.query());
    return context.json({
      items: await service.store.list('scanner_verification_proofs', OPERATOR_ID, limit, offset, investigationId),
      limit,
      offset,
    });
  });
  app.get('/api/investigations/:id/model-events', async context => {
    const investigationId = id(context.req.param('id'));
    await service.store.getInvestigation(investigationId, OPERATOR_ID);
    const { limit, offset } = page(context.req.query());
    return context.json({
      items: await service.store.modelEvents(OPERATOR_ID, investigationId, limit, offset),
      limit,
      offset,
    });
  });
  app.get('/api/approvals', async context => {
    const { limit, offset } = page(context.req.query());
    return context.json({
      items: await service.store.list('scanner_approvals', OPERATOR_ID, limit, offset),
      limit,
      offset,
    });
  });
  app.get('/api/approvals/:id', async context => {
    const result = await service.store.getApproval(id(context.req.param('id')), OPERATOR_ID);
    context.header('ETag', `"${result.revision}"`);
    return context.json(result);
  });
  app.post('/api/hypotheses/:id/approval', async context => {
    const input = parse(approvalRequest, await readJson(context.req));
    const result = await service.requestApproval(
      OPERATOR_ID,
      id(context.req.param('id')),
      input.callback,
      input.expiresAt,
    );
    context.header('ETag', `"${result.revision}"`);
    return context.json(result, 201);
  });
  app.post('/api/approvals/:id/decision', async context => {
    const input = await readJson(context.req);
    const revision = parse(revisionHeader, context.req.header('if-match'));
    if (typeof input !== 'object' || input === null || !('revision' in input) || input.revision !== revision)
      throw new ControlPlaneError('REVISION_CONFLICT', 409);
    const result = await service.decide(OPERATOR_ID, id(context.req.param('id')), input);
    context.header('ETag', `"${result.revision}"`);
    return context.json(result);
  });
  app.put('/api/targets/:id/recurrence', async context => {
    const targetId = id(context.req.param('id'));
    const input = await readJson(context.req);
    if (typeof input !== 'object' || input === null || !('targetId' in input) || input.targetId !== targetId)
      throw new ControlPlaneError('TARGET_MISMATCH', 400);
    const header = context.req.header('if-match');
    const result = await service.schedule(OPERATOR_ID, input, header ? parse(revisionHeader, header) : undefined);
    context.header('ETag', `"${result.revision}"`);
    return context.json(result);
  });
  app.get('/api/investigation-metrics', async context => context.json(await service.store.metrics(OPERATOR_ID)));
}
