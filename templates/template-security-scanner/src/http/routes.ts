import type { Hono, Context } from 'hono';
import { z } from 'zod';
import { ControlPlane } from '../core/control-plane.js';
import { idSchema, pageSchema, parse, ControlPlaneError } from '../core/contracts.js';
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
function respond(context: Context, value: { revision: number }, created = false) {
  context.header('ETag', `"${value.revision}"`);
  return context.json(value, created ? 201 : 200);
}
export function registerDomainRoutes(app: Hono, service: ControlPlane) {
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
      await service.checkIdentity(OPERATOR_ID, id(context), id(context, 'profileId'), await readJson(context.req)),
    ),
  );
  app.post('/api/targets/:id/scans', async context => {
    await service.admitScan(OPERATOR_ID, id(context), await readJson(context.req));
    return context.body(null, 503);
  });
}
