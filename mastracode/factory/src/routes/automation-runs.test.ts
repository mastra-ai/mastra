import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

import { builtInFactoryRules } from '../rules/defaults.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { buildAutomationRunRoutes } from './automation-runs.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const orgUser = { workosId: 'u1', organizationId: 'org1' };
const REQUEST_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const SECOND_REQUEST_ID = '11111111-2222-4333-8444-555555555555';

let seed: FactoryStorageTestSeed;
let projectId = '';
let workItemId = '';
let workItemRevision = 0;
let auditEvents: Array<Record<string, unknown>> = [];

const audit: AuditEmitter = {
  async emit({ input }) {
    auditEvents.push(input as unknown as Record<string, unknown>);
  },
};

function app() {
  const hono = new Hono();
  hono.use('*', async (c, next) => {
    c.set('factoryAuthUser' as never, orgUser as never);
    await next();
  });
  mountApiRoutes(
    hono as never,
    buildAutomationRunRoutes({
      auth: fakeRouteAuth(),
      audit,
      projects: seed.projects,
      workItems: seed.workItems,
      rules: builtInFactoryRules(),
    }),
  );
  return hono;
}

function request(body: Record<string, unknown>) {
  return app().request(`/web/factory/projects/${projectId}/work-items/${workItemId}/automation-runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    requestId: REQUEST_ID,
    expectedRevision: workItemRevision,
    role: 'work',
    skillName: 'modelspend-implementation',
    arguments: '{"issue":801}',
    ...overrides,
  };
}

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  auditEvents = [];
  const project = await seed.projects.create({
    orgId: 'org1',
    userId: 'u1',
    input: { name: 'modelspend' },
  });
  projectId = project.id;
  const result = await seed.workItems.upsert({
    orgId: 'org1',
    userId: 'u1',
    factoryProjectId: projectId,
    input: {
      board: 'work',
      title: 'EXECUTION.BRIDGE.REQUEST.ENVELOPE.1',
      stages: ['intake'],
      externalSource: {
        integrationId: 'github',
        type: 'issue',
        externalId: 'github-issue:801',
        url: 'https://github.com/TheTekTeam/modelspend/issues/801',
      },
      metadata: { githubIssueNumber: 801, authorTrusted: true },
    },
  });
  workItemId = result.item.id;
  workItemRevision = result.item.revision;
});

describe('POST automation-runs', () => {
  it('commits one bounded invokeSkill decision and stores a system actor', async () => {
    const response = await request(body());
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      status: 'committed',
      result: { status: 'accepted', itemId: workItemId },
    });

    const decisions = await seed.workItems.listDeferredDecisions('org1', projectId);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      workItemId,
      status: 'pending',
      actor: { type: 'system', id: 'factory-external-orchestrator' },
      decision: {
        type: 'invokeSkill',
        role: 'work',
        skillName: 'modelspend-implementation',
        arguments: '{"issue":801}',
      },
    });
    expect(auditEvents.at(-1)).toMatchObject({ action: 'factory.automation_run.queued' });
  });

  it('replays the same request id without inserting a second decision', async () => {
    expect((await request(body())).status).toBe(202);
    const replay = await request(body());
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ status: 'replayed', result: { status: 'accepted' } });

    const decisions = await seed.workItems.listDeferredDecisions('org1', projectId);
    expect(decisions).toHaveLength(1);
  });

  it('rejects a stale expected revision without creating a runnable decision', async () => {
    const response = await request(body({ requestId: SECOND_REQUEST_ID, expectedRevision: workItemRevision + 1 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      status: 'committed',
      result: { status: 'rejected', code: 'stale' },
    });
    expect(await seed.workItems.listDeferredDecisions('org1', projectId)).toHaveLength(0);
    expect(auditEvents.at(-1)).toMatchObject({ action: 'factory.automation_run.rejected' });
  });

  it('rejects unsupported request fields at the HTTP boundary', async () => {
    const response = await request(body({ effect: { type: 'transition', stage: 'done' } }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid_automation_run_request' });
    expect(await seed.workItems.listDeferredDecisions('org1', projectId)).toHaveLength(0);
  });

  it('rejects unknown roles before a deferred failure can be queued', async () => {
    const response = await request(body({ role: 'release-manager' }));
    expect(response.status).toBe(400);
    expect(await seed.workItems.listDeferredDecisions('org1', projectId)).toHaveLength(0);
  });
});
