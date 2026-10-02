import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditDomain } from '../storage/domains/audit/domain.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { AutomationRunRoutes } from './automation-runs.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

let seed: FactoryStorageTestSeed;
let PROJECT_ID = '';
let WORK_ITEM_ID = '';

const orgUser = { workosId: 'u1', organizationId: 'org1' };

function buildApp(
  user: { workosId: string; organizationId?: string } | null,
  options: { enabled?: boolean; isOrganizationAdmin?: (orgId: string, userId: string) => Promise<boolean> } = {},
) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  const audit = new AuditDomain({
    auth: fakeRouteAuth(options),
    audit: seed.audit,
    projects: seed.projects,
  });
  mountApiRoutes(
    app as any,
    new AutomationRunRoutes({
      auth: fakeRouteAuth(options),
      audit,
      projects: seed.projects,
      workItems: seed.workItems,
      configVersion: 'factory-config-v1',
    }).routes(),
  );
  return app;
}

const listAudit = (orgId: string) => seed.audit.list({ orgId });

function post(body: unknown, user: typeof orgUser | null = orgUser, options = {}) {
  const path = `/web/factory/projects/${PROJECT_ID}/work-items/${WORK_ITEM_ID}/automation-runs`;
  return buildApp(user, options).request(path, {
    method: 'POST',
    ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
}

const listDecisions = () => seed.workItems.listDeferredDecisions('org1', PROJECT_ID);
const listDecisionsLocal = () => seed.workItems.listDeferredDecisions('local', PROJECT_ID);

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

const validBody = (overrides: Record<string, unknown> = {}) => ({
  requestId: REQUEST_ID,
  expectedRevision: 1,
  role: 'work',
  skillName: 'factory-plan',
  ...overrides,
});

async function seedProjectAndItem(orgId = 'org1') {
  const project = await seed.projects.create({ orgId, userId: 'u1', input: { name: `${orgId} project` } });
  PROJECT_ID = project.id;
  const { item } = await seed.workItems.upsert({
    orgId,
    userId: 'u1',
    factoryProjectId: PROJECT_ID,
    input: { title: 'Bootstrap from intake', stages: ['intake'] },
  });
  WORK_ITEM_ID = item.id;
  return item;
}

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('automation-runs ingress', () => {
  it('commits one bounded invokeSkill decision and stores a system actor', async () => {
    await seedProjectAndItem();
    const res = await post(validBody());
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ status: 'committed', requestId: REQUEST_ID });

    const decisions = await listDecisions();
    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.decision).toMatchObject({ type: 'invokeSkill', role: 'work', skillName: 'factory-plan' });
    expect(decisions[0]!.actor).toEqual({ type: 'system', id: 'factory-external-orchestrator' });
    const events = await listAudit('org1');
    expect(events.events.map(e => e.action)).toContain('factory.run.queued');
  });

  it('rejects tenant callers who are not organization administrators', async () => {
    await seedProjectAndItem();
    const res = await post(validBody(), orgUser, { isOrganizationAdmin: async () => false });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'forbidden' });
    expect(await listDecisions()).toHaveLength(0);
  });

  it('rejects unauthenticated tenant callers', async () => {
    await seedProjectAndItem();
    const res = await post(validBody(), null);
    expect(res.status).toBe(401);
    expect(await listDecisions()).toHaveLength(0);
  });

  it('supports the trusted local no-auth storage scope without inventing a tenant user', async () => {
    await seedProjectAndItem('local');
    const res = await post(validBody(), null, { enabled: false });
    expect(res.status).toBe(202);
    const decisions = await listDecisionsLocal();
    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.actor).toEqual({ type: 'system', id: 'factory-external-orchestrator' });
    // Audit must persist under the synthetic `local` scope — the tenant-gated
    // emit() path would silently drop it here.
    const events = await listAudit('local');
    const queued = events.events.find(e => e.action === 'factory.run.queued');
    expect(queued).toBeDefined();
    expect(queued!.actorType).toBe('system');
    expect(queued!.actorId).toBe('factory-external-orchestrator');
  });

  it('replays the same request id without inserting a second decision', async () => {
    await seedProjectAndItem();
    const first = await post(validBody());
    expect(first.status).toBe(202);
    const second = await post(validBody());
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ status: 'replayed', requestId: REQUEST_ID });
    expect(await listDecisions()).toHaveLength(1);

    // The replay must not append a second audit event for the same request.
    const events = await listAudit('org1');
    expect(events.events.filter(e => e.action === 'factory.run.queued')).toHaveLength(1);
  });

  it('rejects a stale expected revision without creating a runnable decision', async () => {
    await seedProjectAndItem();
    const res = await post(validBody({ expectedRevision: 99 }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ status: 'rejected', code: 'stale' });
    expect(await listDecisions()).toHaveLength(0);
    const events = await listAudit('org1');
    expect(events.events.map(e => e.action)).toContain('factory.run.rejected');
  });

  it('rejects reuse of a request id for a different operation', async () => {
    await seedProjectAndItem();
    const first = await post(validBody());
    expect(first.status).toBe(202);

    // Same requestId, different skill — must not be reported as durably queued.
    const conflict = await post(validBody({ skillName: 'factory-triage', role: 'triage' }));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ status: 'rejected', code: 'request_id_conflict' });
    expect(await listDecisions()).toHaveLength(1);

    const events = await listAudit('org1');
    const rejected = events.events.find(
      e => e.action === 'factory.run.rejected' && (e.metadata as any)?.code === 'request_id_conflict',
    );
    expect(rejected).toBeDefined();
  });

  it('rejects unsupported request fields at the HTTP boundary', async () => {
    await seedProjectAndItem();
    const res = await post(validBody({ extra: 'nope' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_automation_run_request' });
    expect(await listDecisions()).toHaveLength(0);
  });

  it('rejects unknown roles before a deferred failure can be queued', async () => {
    await seedProjectAndItem();
    const res = await post(validBody({ role: 'ghost' }));
    expect(res.status).toBe(400);
    expect(await listDecisions()).toHaveLength(0);
  });

  it('returns 404 for an unknown work item', async () => {
    await seedProjectAndItem();
    WORK_ITEM_ID = '22222222-2222-4222-8222-222222222222';
    const res = await post(validBody());
    expect(res.status).toBe(404);
    expect(await listDecisions()).toHaveLength(0);
  });
});
