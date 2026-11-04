import type { Hono } from 'hono';
import { z } from 'zod';
import { pageSchema as listPage, parse, ifMatchRevision as revision } from '../core/contracts.js';
import { advisoryId, triageSchema } from '../advisory/contracts.js';
import { AdvisorySync } from '../advisory/sync.js';
import { AdvisoryTriage, caseInput, ignoreInput, unignoreInput } from '../advisory/triage.js';
import { ReferenceCatalog } from '../knowledge/catalog.js';
import { PlaybookRegistry } from '../knowledge/playbooks.js';
import { OPERATOR_ID, readJson } from './security.js';

export function registerIntelligenceRoutes(
  app: Hono,
  catalog: ReferenceCatalog,
  registry: PlaybookRegistry,
  advisory: AdvisorySync,
  triage: AdvisoryTriage,
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
    if (result.outcome === 'SKIPPED') return context.json(result, 200);
    const hypotheses = await triage.planNew(OPERATOR_ID);
    await onAdvisorySync?.();
    return context.json({ ...result, hypotheses }, 200);
  });
  app.get('/api/advisories/:id/triage-state', async context =>
    context.json(
      await triage.state(
        parse(advisoryId, context.req.param('id')),
        parse(z.string().uuid().optional(), context.req.query('targetId')),
        OPERATOR_ID,
      ),
    ),
  );
  app.get('/api/advisories/:id/checkers', async context =>
    context.json(await triage.search(parse(advisoryId, context.req.param('id')))),
  );
  app.post('/api/advisories/:id/ignore', async context =>
    context.json(
      await triage.ignore(
        parse(advisoryId, context.req.param('id')),
        parse(ignoreInput, await readJson(context.req)),
        OPERATOR_ID,
      ),
    ),
  );
  app.post('/api/advisories/:id/unignore', async context => {
    const input = parse(unignoreInput, await readJson(context.req));
    return context.json(
      await triage.unignore(parse(advisoryId, context.req.param('id')), input.scope, input.targetId, OPERATOR_ID),
    );
  });
  app.post('/api/advisories/:id/cases', async context =>
    context.json(
      await triage.investigate(
        parse(advisoryId, context.req.param('id')),
        parse(caseInput, await readJson(context.req)),
        OPERATOR_ID,
      ),
      201,
    ),
  );
  app.get('/api/advisories/:id', async context => {
    const id = parse(advisoryId, context.req.param('id'));
    const canonical = await advisory.store.resolveAlias(id);
    const item = await advisory.store.get(canonical ?? id);
    context.header('ETag', `"${item.recordRevision}"`);
    return context.json(item);
  });
  app.get('/api/advisories/:id/events', async context => {
    const id = parse(advisoryId, context.req.param('id'));
    const canonical = await advisory.store.resolveAlias(id);
    return context.json({ items: await advisory.store.events(canonical ?? id) });
  });
  app.put('/api/advisories/:id/triage', async context => {
    const id = parse(advisoryId, context.req.param('id'));
    const expected = parse(revision, context.req.header('if-match'));
    const { status } = parse(triageSchema, await readJson(context.req));
    const canonical = await advisory.store.resolveAlias(id);
    const item = await advisory.store.setTriage(canonical ?? id, expected, status);
    context.header('ETag', `"${item.recordRevision}"`);
    return context.json(item);
  });
}
