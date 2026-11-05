import type { Hono, Context } from 'hono';
import { z } from 'zod';
import { ControlPlane } from '../core/control-plane.js';
import { idSchema, pageSchema, parse, ControlPlaneError, bindingSchema } from '../core/contracts.js';
import type { ScanService } from '../discovery/service.js';
import type { Policy, Target } from '../core/contracts.js';
import { OPERATOR_ID, readJson } from './security.js';

const ifMatchSchema = z
  .string()
  .regex(/^"[1-9][0-9]{0,15}"$/)
  .transform(value => Number(value.slice(1, -1)))
  .pipe(z.number().int().positive().safe());
const revision = (context: Context) => parse(ifMatchSchema, context.req.header('if-match'));
const id = (context: Context, parameter = 'id') => parse(idSchema, context.req.param(parameter));
const page = (context: Context) => parse(pageSchema, context.req.query());
/** Return a revisioned JSON record with its ETag and creation status. */
function respond(context: Context, value: { revision: number }, created = false) {
  context.header('ETag', `"${value.revision}"`);
  return context.json(value, created ? 201 : 200);
}
/** Register protected policy, target and profile routes on the local Hono application. */
export function registerDomainRoutes(app: Hono, service: ControlPlane, scans?: ScanService) {
  app.onError((error, context) =>
    context.json(
      { code: error instanceof ControlPlaneError ? error.code : 'CONTROL_PLANE_UNAVAILABLE' },
      error instanceof ControlPlaneError ? error.status : 503,
    ),
  );
  app.get('/api/policies', async context => {
    const { limit, offset } = page(context);
    return context.json({
      items: await service.store.list<Policy>('policy', OPERATOR_ID, limit, offset),
      limit,
      offset,
    });
  });
  app.get('/api/policies/:id/revisions', async context => {
    const { limit, offset } = page(context);
    return context.json({
      items: await service.store.revisions('policy', id(context), OPERATOR_ID, limit, offset),
      limit,
      offset,
    });
  });
  app.post('/api/policies', async context =>
    respond(context, await service.createPolicy(OPERATOR_ID, await readJson(context.req)), true),
  );
  app.get('/api/policies/:id', async context =>
    respond(context, await service.store.get<Policy>('policy', id(context), OPERATOR_ID)),
  );
  app.put('/api/policies/:id', async context =>
    respond(
      context,
      await service.updatePolicy(OPERATOR_ID, id(context), revision(context), await readJson(context.req)),
    ),
  );
  app.delete('/api/policies/:id', async context => {
    await service.remove(OPERATOR_ID, 'policy', id(context), revision(context));
    return context.body(null, 204);
  });
  app.get('/api/targets', async context => {
    const { limit, offset } = page(context);
    return context.json({
      items: await service.store.list<Target>('target', OPERATOR_ID, limit, offset),
      limit,
      offset,
    });
  });
  app.post('/api/targets', async context =>
    respond(context, await service.createTarget(OPERATOR_ID, await readJson(context.req)), true),
  );
  app.get('/api/targets/:id', async context =>
    respond(context, await service.store.get<Target>('target', id(context), OPERATOR_ID)),
  );
  app.put('/api/targets/:id', async context =>
    respond(
      context,
      await service.updateTarget(OPERATOR_ID, id(context), revision(context), await readJson(context.req)),
    ),
  );
  app.delete('/api/targets/:id', async context => {
    await service.remove(OPERATOR_ID, 'target', id(context), revision(context));
    return context.body(null, 204);
  });
  app.get('/api/targets/:id/profiles', async context => {
    const { limit, offset } = page(context);
    return context.json({ items: await service.listProfiles(OPERATOR_ID, id(context), limit, offset), limit, offset });
  });
  app.post('/api/targets/:id/profiles', async context =>
    respond(
      context,
      await service.createProfile(OPERATOR_ID, id(context), revision(context), await readJson(context.req)),
      true,
    ),
  );
  app.get('/api/targets/:id/profiles/:profileId', async context =>
    respond(context, await service.profile(OPERATOR_ID, id(context), id(context, 'profileId'))),
  );
  app.put('/api/targets/:id/profiles/:profileId', async context =>
    respond(
      context,
      await service.updateProfile(
        OPERATOR_ID,
        id(context),
        id(context, 'profileId'),
        revision(context),
        await readJson(context.req),
      ),
    ),
  );
  app.delete('/api/targets/:id/profiles/:profileId', async context => {
    await service.remove(OPERATOR_ID, 'profile', id(context, 'profileId'), revision(context), id(context));
    return context.body(null, 204);
  });
  app.post('/api/targets/:id/profiles/:profileId/check', async context =>
    respond(
      context,
      await (scans?.enabled
        ? scans.checkIdentity(OPERATOR_ID, id(context), id(context, 'profileId'), await readJson(context.req))
        : service.checkIdentity(OPERATOR_ID, id(context), id(context, 'profileId'), await readJson(context.req))),
    ),
  );
  app.post('/api/targets/:id/scans', async context => {
    const input = await readJson(context.req);
    if (scans && (scans.enabled || !bindingSchema.safeParse(input).success))
      return context.json(await scans.admit(OPERATOR_ID, id(context), input), 202);
    await service.admitScan(OPERATOR_ID, id(context), input);
    return context.body(null, 503);
  });
  if (scans) {
    app.get('/api/retention', async context => context.json(await scans.store.retentionStatus()));
    app.post('/api/retention/cleanup', async context => {
      parse(z.object({}).strict(), await readJson(context.req));
      const result = await scans.store.purgeExpired();
      return context.json({ ...result, status: await scans.store.retentionStatus() });
    });
    app.get('/api/scans', async context => {
      const { limit, offset } = page(context);
      return context.json({ items: await scans.store.list(OPERATOR_ID, limit, offset), limit, offset });
    });
    app.get('/api/targets/:id/scans', async context => {
      const targetId = id(context);
      await service.store.get('target', targetId, OPERATOR_ID);
      const { limit, offset } = page(context);
      return context.json({ items: await scans.store.list(OPERATOR_ID, limit, offset, targetId), limit, offset });
    });
    app.get('/api/scans/:id', async context => context.json(await scans.store.get(id(context), OPERATOR_ID)));
    app.post('/api/scans/:id/cancel', async context => {
      parse(z.object({}).strict(), await readJson(context.req));
      return context.json(await scans.cancel(OPERATOR_ID, id(context)));
    });
    for (const collection of ['inventory', 'evidence'])
      app.get(`/api/scans/:id/${collection}`, async context => {
        const { limit, offset } = page(context);
        return context.json({
          items: await scans.store.evidence(id(context), OPERATOR_ID, limit, offset),
          limit,
          offset,
        });
      });
  }
}
