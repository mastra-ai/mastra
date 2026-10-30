import type { Hono } from 'hono';
import { z } from 'zod';
import { pageSchema as listPage, parse } from '../core/contracts.js';
import { advisoryId, triageSchema } from '../advisory/contracts.js';
import { AdvisorySync } from '../advisory/sync.js';
import { ReferenceCatalog } from '../knowledge/catalog.js';
import { PlaybookRegistry } from '../knowledge/playbooks.js';
import { readJson } from './security.js';

const revision = z
  .string()
  .regex(/^"[1-9][0-9]{0,15}"$/)
  .transform(value => Number(value.slice(1, -1)))
  .pipe(z.number().int().safe().positive());
export function registerIntelligenceRoutes(
  app: Hono,
  catalog: ReferenceCatalog,
  registry: PlaybookRegistry,
  advisory: AdvisorySync,
  onAdvisorySync?: () => Promise<void>,
) {
  app.get('/api/references', async context => {
    const query = parse(z.string().trim().min(1).max(120), context.req.query('q'));
    const limit = parse(z.coerce.number().int().min(1).max(25).default(10), context.req.query('limit'));
    return context.json({ items: await catalog.search(query, limit) });
  });
  app.get('/api/references/:id', async context => context.json(await catalog.resolve(context.req.param('id'))));
  app.get('/api/playbooks', async context => context.json({ items: await registry.list() }));
  app.get('/api/advisories/status', async context => context.json(await advisory.store.checkpoint()));
  app.get('/api/advisories/quarantine', async context => {
    const { limit, offset } = parse(listPage, context.req.query());
    return context.json({ items: await advisory.store.quarantine(limit, offset), limit, offset });
  });
  app.get('/api/advisories', async context => {
    const { limit, offset } = parse(listPage, context.req.query());
    return context.json({ items: await advisory.store.list(limit, offset), limit, offset });
  });
  app.post('/api/advisories/sync', async context => {
    parse(z.object({}).strict(), await readJson(context.req));
    const result = await advisory.syncOnce();
    await onAdvisorySync?.();
    return context.json(result, 200);
  });
  app.get('/api/advisories/:id', async context => {
    const id = parse(advisoryId, context.req.param('id'));
    const canonical = await advisory.store.resolveAlias(id);
    const item = await advisory.store.get(canonical ?? id);
    context.header('ETag', `"${item.recordRevision}"`);
    return context.json(item);
  });
  app.get('/api/advisories/:id/events', async context =>
    context.json({ items: await advisory.store.events(parse(advisoryId, context.req.param('id'))) }),
  );
  app.put('/api/advisories/:id/triage', async context => {
    const id = parse(advisoryId, context.req.param('id'));
    const expected = parse(revision, context.req.header('if-match'));
    const { status } = parse(triageSchema, await readJson(context.req));
    const item = await advisory.store.setTriage(id, expected, status);
    context.header('ETag', `"${item.recordRevision}"`);
    return context.json(item);
  });
}
