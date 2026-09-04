/**
 * Supervisor routes over HTTP: the deterministic session address, the health
 * report, and the project-ownership gate both sit behind.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

import { builtInFactoryRules } from '../rules/defaults.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';
import { WorkItemRoutes } from './work-items.js';

const orgUser = { workosId: 'u1', organizationId: 'org1' };

let seed: FactoryStorageTestSeed;
let PROJECT_ID = '';

function buildApp(user: typeof orgUser | null = orgUser) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app as never,
    new WorkItemRoutes({
      auth: fakeRouteAuth(),
      audit: { emit: async () => {} },
      projects: seed.projects,
      workItems: seed.workItems,
      comments: seed.comments,
      queueHealth: seed.queueHealth,
      transitionService: new FactoryTransitionService({ rules: builtInFactoryRules(), storage: seed.workItems }),
      liveSessions: { isRunning: () => false },
    }).routes(),
  );
  return app;
}

function request(method: string, path: string, user: typeof orgUser | null = orgUser) {
  return buildApp(user).request(path, { method });
}

async function seedWorkItem(stages: WorkItemRow['stages']): Promise<WorkItemRow> {
  const { item } = await seed.workItems.upsert({
    orgId: 'org1',
    userId: 'u1',
    factoryProjectId: PROJECT_ID,
    input: { title: 'Fix login', stages, sessions: {}, metadata: {} },
  });
  return item;
}

async function seedFailure(workItem: WorkItemRow, now: Date) {
  await seed.workItems.commitRuleEvaluation({
    orgId: 'org1',
    factoryProjectId: PROJECT_ID,
    workItemId: workItem.id,
    ingress: { identity: `supervisor-failure-${now.getTime()}`, triggerType: 'test' },
    ruleSetVersion: 'rules-v1',
    expectedRevision: (await seed.workItems.get({ orgId: 'org1', id: workItem.id }))?.revision ?? workItem.revision,
    actor: { type: 'system', id: 'rules' },
    outcome: { status: 'accepted' },
    decisions: [
      { type: 'sendMessage', role: 'work', message: 'Notify.', idempotencyKey: `supervisor-failure-${now.getTime()}` },
    ],
    causalChain: [],
    now,
  });
  const [claimed] = await seed.workItems.claimDeferredDecisions({
    ownerId: 'worker-1',
    now,
    leaseExpiresAt: new Date(now.getTime() + 60_000),
    limit: 1,
  });
  if (!claimed) throw new Error('Expected a deferred decision');
  const failed = await seed.workItems.failDeferredDecision({
    id: claimed.id,
    orgId: claimed.orgId,
    factoryProjectId: claimed.factoryProjectId,
    ownerId: 'worker-1',
    now,
    availableAt: now,
    lastError: 'No active Factory binding for role work.',
    failureCode: 'session_unavailable',
    terminal: true,
  });
  if (!failed) throw new Error('Expected a failed deferred decision');
  return failed;
}

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'org1 project' } });
  PROJECT_ID = project.id;
});

describe('POST /supervisor/session', () => {
  it('hands back the deterministic per-factory session address', async () => {
    const res = await request('POST', `/web/factory/projects/${PROJECT_ID}/supervisor/session`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      sessionId: `factory-supervisor:${PROJECT_ID}`,
      threadId: `factory-supervisor:${PROJECT_ID}`,
      factoryProjectId: PROJECT_ID,
    });
  });

  it('refuses a project the caller org does not own', async () => {
    const other = { workosId: 'u2', organizationId: 'org2' };
    const res = await request('POST', `/web/factory/projects/${PROJECT_ID}/supervisor/session`, other);
    expect(res.status).toBe(404);
  });

  it('requires a signed-in caller', async () => {
    const res = await request('POST', `/web/factory/projects/${PROJECT_ID}/supervisor/session`, null);
    expect(res.status).toBe(401);
  });
});

describe('GET /supervisor/health', () => {
  it('reports no findings for a healthy factory', async () => {
    const res = await request('GET', `/web/factory/projects/${PROJECT_ID}/supervisor/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.findings).toEqual([]);
    expect(typeof body.checkedAt).toBe('string');
  });

  it('surfaces a failed decision as a finding that points at its card', async () => {
    const item = await seedWorkItem(['execute']);
    const failed = await seedFailure(item, new Date());

    const res = await request('GET', `/web/factory/projects/${PROJECT_ID}/supervisor/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const finding = body.findings.find((f: { kind: string }) => f.kind === 'decision-failed');
    expect(finding).toMatchObject({
      workItemId: item.id,
      suggestedRepair: { action: 'retry-decision', decisionId: failed.id },
    });
    expect(finding.evidence).toContain('No active Factory binding');
    expect(body.counts['decision-failed']).toBe(1);
  });

  it('is scoped to the caller org', async () => {
    const other = { workosId: 'u2', organizationId: 'org2' };
    const res = await request('GET', `/web/factory/projects/${PROJECT_ID}/supervisor/health`, other);
    expect(res.status).toBe(404);
  });
});
