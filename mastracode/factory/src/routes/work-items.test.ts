import { gunzipSync } from 'node:zlib';

import { RequestContext } from '@mastra/core/request-context';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────

import { boardRegistryOf, createBoardRegistry, defineBoard } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import { createTriageWorkRegistry } from '../boards/test-utils.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import type { FactoryRuleActor } from '../rules/types.js';
import type { AuditEmitter, AuditRecorder } from '../storage/domains/audit/domain.js';
import {
  FACTORY_PULL_REQUEST_RECONCILIATION_KEY,
  FACTORY_RULE_MATERIALIZATION_KEY,
} from '../storage/domains/work-items/base.js';
import type { FactoryDeferredDecisionRecord, WorkItemUpdateConflictError } from '../storage/domains/work-items/base.js';

let auditRecorded: Array<Record<string, any>> = [];
let auditFailure: Error | undefined;

const auditRecorder: AuditRecorder = {
  async record(input) {
    if (auditFailure) throw auditFailure;
    auditRecorded.push({
      orgId: input.orgId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: input.action,
      factoryProjectId: input.factoryProjectId,
      targets: input.targets,
      metadata: input.metadata,
      context: input.context,
    });
    return null;
  },
};

const audit: AuditEmitter = {
  async emit({ context, input }) {
    try {
      if (auditFailure) throw auditFailure;
      const user = context.get('factoryAuthUser' as never) as { workosId: string; organizationId?: string } | undefined;
      if (!user?.organizationId) return;
      auditRecorded.push({
        orgId: user.organizationId,
        actorId: user.workosId,
        actorType: 'human',
        action: input.action,
        factoryProjectId: input.factoryProjectId,
        targets: input.targets,
        metadata: input.metadata,
      });
    } catch (error) {
      console.warn('[Audit] Failed to emit audit event', {
        action: input.action,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { boardCheck } from '../work-items/board-check.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';
import { parseCreateWorkItem, parseUpdateWorkItem, WorkItemRoutes } from './work-items.js';

// ── Test harness ─────────────────────────────────────────────────────────
const PARKED_RUN = { toolName: 'ask_user', suspendedAt: 0 };

function buildApp(
  user: { workosId: string; organizationId?: string } | null,
  startCoordinator?: { prepare: (input: any) => Promise<any> },
  requestContext?: RequestContext,
  running: ReadonlySet<string> = new Set(),
  // Work as projects stored before new projects' Work dropped Triage: these tests walk its lanes.
  boardRegistry: BoardRegistry = createTriageWorkRegistry(),
  parked: ReadonlySet<string> = new Set(),
) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    if (requestContext) c.set('requestContext' as never, requestContext as never);
    await next();
  });
  mountApiRoutes(
    app as any,
    new WorkItemRoutes({
      auth: fakeRouteAuth(),
      audit,
      projects: seed.projects,
      workItems: seed.workItems,
      boardRegistry,
      queueHealth: seed.queueHealth,
      transitionService: new FactoryTransitionService({
        configVersion: 'factory-config-v1',
        storage: seed.workItems,
        boards: boardRegistry,
        audit: auditRecorder,
      }),
      startCoordinator,
      liveSessions: {
        isRunning: sessionId => running.has(sessionId),
        parked: sessionId => (parked.has(sessionId) ? PARKED_RUN : undefined),
        parkedIn: () => [...parked].map(sessionId => ({ sessionId, run: PARKED_RUN })),
      },
    }).routes(),
  );
  return app;
}

const orgUser = { workosId: 'u1', organizationId: 'org1' };
let PROJECT_ID = '';

async function seedProject(orgId = 'org1') {
  const project = await seed.projects.create({
    orgId,
    userId: 'u1',
    input: { name: `${orgId} project` },
  });
  PROJECT_ID = project.id;
}

const listItems = () => seed.workItems.list({ orgId: 'org1', factoryProjectId: PROJECT_ID });

function json(method: string, path: string, body?: unknown, user: typeof orgUser | null = orgUser) {
  return buildApp(user).request(path, {
    method,
    ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
}

/** Session of a started run — what makes a card the Factory's own work. */
const run = { execute: { sessionId: 'session-1', branch: 'factory/1', threadId: 'thread-1' } };

const createBody = (overrides: Record<string, unknown> = {}) => ({
  externalSource: {
    integrationId: 'github',
    type: 'issue',
    externalId: '42',
    url: 'https://github.com/acme/app/issues/42',
  },
  title: 'Fix the login flow',
  stages: ['intake'],
  metadata: { number: 42 },
  ...overrides,
});

let seed: FactoryStorageTestSeed;

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  auditRecorded = [];
  auditFailure = undefined;
  await seedProject();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('installed board catalog', () => {
  it.each([true, false])('returns only structural metadata (with Work: %s)', async withWork => {
    const board = defineBoard({
      id: 'release',
      title: 'Release Preview',
      initialPhase: 'queued',
      phases: {
        queued: { title: 'Queued', kind: 'resting', next: 'preparing' },
        preparing: {
          title: 'Preparing',
          kind: 'working',
          role: 'release-preparer',
          next: 'shipped',
          onEnter: { 'github-issue': () => [] },
        },
        shipped: { title: 'Shipped', kind: 'terminal' },
      },
      transitionPolicy: () => undefined,
    });
    const app = buildApp(
      orgUser,
      undefined,
      undefined,
      new Set(),
      withWork ? createBoardRegistry({ boards: [board] }) : boardRegistryOf([board]),
    );
    const response = await app.request(`/web/factory/projects/${PROJECT_ID}/boards`);
    expect(response.status).toBe(200);
    const { boards } = await response.json();
    expect(boards.map((entry: { id: string }) => entry.id)).toEqual(withWork ? ['work', 'release'] : ['release']);
    // Deprecated `title`/`role` stay beside their replacements for older clients.
    expect(boards.at(-1)).toEqual({
      id: 'release',
      name: 'Release Preview',
      title: 'Release Preview',
      initialPhase: 'queued',
      // No phase reviews or builds, so the board has no pull request loop: only its terminal phase finishes cards.
      flow: { completed: 'shipped', canceled: 'shipped' },
      phases: [
        {
          id: 'queued',
          name: 'Queued',
          title: 'Queued',
          kind: 'resting',
          nextPhases: ['preparing'],
          transitions: [{ outcome: null, to: 'preparing' }],
        },
        {
          id: 'preparing',
          name: 'Preparing',
          title: 'Preparing',
          kind: 'working',
          nextPhases: ['shipped'],
          context: 'release-preparer',
          role: 'release-preparer',
          autoStart: false,
          transitions: [{ outcome: null, to: 'shipped' }],
        },
        { id: 'shipped', name: 'Shipped', title: 'Shipped', kind: 'terminal', nextPhases: [], transitions: [] },
      ],
    });
  });

  it("names the phase playing each part of each board's pull request loop", async () => {
    const app = buildApp(orgUser, undefined, undefined, new Set(), createBoardRegistry());
    const body = await (await app.request(`/web/factory/projects/${PROJECT_ID}/boards`)).json();
    expect(FACTORY_ROUTE_CONTRACTS.boardCatalog.responseSchema.parse(body)).toEqual(body);
    // Factory's Work has no Triage, so its flow names none.
    expect(body.boards[0].flow).not.toHaveProperty('triage');
    expect(body.boards[0]).toMatchObject({
      id: 'work',
      flow: { build: 'execute', pullRequestReview: 'pr-review', completed: 'done', canceled: 'canceled' },
    });
    // A project's Work that kept Triage names it.
    const older = await (await buildApp(orgUser).request(`/web/factory/projects/${PROJECT_ID}/boards`)).json();
    expect(older.boards[0]).toMatchObject({
      id: 'work',
      flow: {
        triage: 'triage',
        build: 'execute',
        pullRequestReview: 'pr-review',
        completed: 'done',
        canceled: 'canceled',
      },
    });
    // Which board is the default is DEFAULT_BOARD_ID, and the build context is the build phase's own.
    expect(body.boards[0]).not.toHaveProperty('default');
    expect(body.boards[0].flow).not.toHaveProperty('buildContext');
  });

  it('sends the conditions a phase starts and approves its exit tool under', async () => {
    const lowEffort = {
      operator: 'AND' as const,
      conditions: [{ field: 'item.labels', operator: 'contains' as const, value: 'effort:low' }],
    };
    const board = defineBoard({
      id: 'release',
      name: 'Release',
      initialPhase: 'queued',
      phases: {
        queued: { name: 'Queued', kind: 'resting', nextPhases: ['planning', 'shipping'] },
        planning: {
          name: 'Planning',
          kind: 'working',
          nextPhases: ['shipping'],
          autoStart: true,
          autoStartWhen: lowEffort,
          exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: lowEffort },
        },
        shipping: { name: 'Shipping', kind: 'working', nextPhases: ['shipped'], autoStart: true, exitTool: 'ship' },
        shipped: { name: 'Shipped', kind: 'terminal' },
      },
    });
    const app = buildApp(orgUser, undefined, undefined, new Set(), boardRegistryOf([board]));
    const body = await (await app.request(`/web/factory/projects/${PROJECT_ID}/boards`)).json();
    expect(FACTORY_ROUTE_CONTRACTS.boardCatalog.responseSchema.parse(body)).toEqual(body);
    const [, planning, shipping] = body.boards[0].phases;
    expect(planning).toMatchObject({
      autoStart: true,
      autoStartWhen: lowEffort,
      exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: lowEffort },
    });
    // No condition means every card.
    expect(shipping).toMatchObject({ autoStart: true, exitTool: { id: 'ship', autoApprove: false } });
    expect(shipping).not.toHaveProperty('autoStartWhen');
    expect(shipping.exitTool).not.toHaveProperty('autoApproveWhen');
  });

  it('sends the skill a custom phase runs, so Settings can show it', async () => {
    const board = defineBoard({
      id: 'release',
      name: 'Release',
      initialPhase: 'queued',
      phases: {
        queued: { name: 'Queued', kind: 'resting', nextPhases: ['drafting'] },
        drafting: { name: 'Drafting', kind: 'working', nextPhases: ['shipped'], runner: { skill: 'release-notes' } },
        shipped: { name: 'Shipped', kind: 'terminal' },
      },
    });
    const app = buildApp(orgUser, undefined, undefined, new Set(), boardRegistryOf([board]));
    const body = await (await app.request(`/web/factory/projects/${PROJECT_ID}/boards`)).json();
    expect(FACTORY_ROUTE_CONTRACTS.boardCatalog.responseSchema.parse(body)).toEqual(body);
    const [queued, drafting] = body.boards[0].phases;
    expect(drafting).toMatchObject({ kind: 'working', skill: 'release-notes' });
    expect(queued).not.toHaveProperty('skill');
  });

  it('supports an empty installation', async () => {
    const app = buildApp(orgUser, undefined, undefined, new Set(), boardRegistryOf([]));
    const response = await app.request(`/web/factory/projects/${PROJECT_ID}/boards`);
    expect(await response.json()).toEqual({ boards: [] });
  });

  it('requires authentication and project membership', async () => {
    expect((await buildApp(null).request(`/web/factory/projects/${PROJECT_ID}/boards`)).status).toBe(401);
    expect((await buildApp({ workosId: 'u1' }).request(`/web/factory/projects/${PROJECT_ID}/boards`)).status).toBe(403);
    await seedProject('other-org');
    expect((await buildApp(orgUser).request(`/web/factory/projects/${PROJECT_ID}/boards`)).status).toBe(404);
  });
});

// ── Auth / scoping ───────────────────────────────────────────────────────
describe('auth and scoping', () => {
  it('401s without a user', async () => {
    const res = await json('GET', `/web/factory/projects/${PROJECT_ID}/work-items`, undefined, null);
    expect(res.status).toBe(401);
  });

  it('403s without an organization', async () => {
    const res = await buildApp({ workosId: 'u1' }).request(`/web/factory/projects/${PROJECT_ID}/work-items`);
    expect(res.status).toBe(403);
  });

  it('404s when the project belongs to another org', async () => {
    await seedProject('other-org');
    const res = await json('GET', `/web/factory/projects/${PROJECT_ID}/work-items`);
    expect(res.status).toBe(404);
  });

  it('404s on a non-uuid project id', async () => {
    const res = await json('GET', `/web/factory/projects/not-a-uuid/work-items`);
    expect(res.status).toBe(404);
  });

  it('is org-wide: another member of the same org sees the item', async () => {
    await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const res = await buildApp({ workosId: 'u2', organizationId: 'org1' }).request(
      `/web/factory/projects/${PROJECT_ID}/work-items`,
    );
    const body = await res.json();
    expect(body.workItems).toHaveLength(1);
    expect(body.workItems[0].createdBy).toBe('u1');
  });
});

// ── Create / upsert ──────────────────────────────────────────────────────
describe('POST /web/factory/projects/:id/work-items', () => {
  it('refuses a card filed onto the retired Review board, and files nothing', async () => {
    const res = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({
        board: 'review',
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'github-pr:7' },
      }),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'invalid_board' });
    expect(await seed.workItems.list({ orgId: 'org1', factoryProjectId: PROJECT_ID })).toEqual([]);
  });

  it('creates a work item with server-stamped history', async () => {
    const res = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    expect(res.status).toBe(200);
    const { workItem } = await res.json();
    expect(workItem).toMatchObject({
      orgId: 'org1',
      createdBy: 'u1',
      factoryProjectId: PROJECT_ID,
      externalSource: {
        integrationId: 'github',
        type: 'issue',
        externalId: '42',
        url: 'https://github.com/acme/app/issues/42',
      },
      title: 'Fix the login flow',
      board: 'work',
      stages: ['intake'],
      metadata: { number: 42 },
    });
    expect(workItem.stageHistory).toHaveLength(1);
    expect(workItem.stageHistory[0]).toMatchObject({ stage: 'intake', by: 'u1' });
    expect(workItem.stageHistory[0].enteredAt).toBeTruthy();
    expect(workItem.stageHistory[0].exitedAt).toBeUndefined();
  });

  it('imports incident.io incidents and follow-ups onto an installed custom board at its initial phase', async () => {
    const releaseBoard = defineBoard({
      id: 'release',
      title: 'Release',
      initialPhase: 'queued',
      phases: {
        queued: { title: 'Queued', kind: 'resting', next: 'shipped' },
        shipped: { title: 'Shipped', kind: 'terminal' },
      },
    });
    const boardRegistry = boardRegistryOf([releaseBoard]);
    const app = buildApp(orgUser, undefined, undefined, new Set(), boardRegistry);
    const importedItems = [
      {
        externalSource: {
          integrationId: 'incidentio',
          type: 'issue',
          externalId: 'incidentio:incident:incident-1',
          url: 'https://app.incident.io/acme/incidents/incident-1',
        },
        title: 'INC-42: API unavailable',
      },
      {
        externalSource: {
          integrationId: 'incidentio',
          type: 'issue',
          externalId: 'incidentio:follow-up:follow-up-1',
          url: 'https://app.incident.io/acme/incidents/incident-1',
        },
        title: 'Add database failover alert',
      },
    ];

    for (const importedItem of importedItems) {
      const res = await app.request(`/web/factory/projects/${PROJECT_ID}/work-items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createBody({ ...importedItem, board: 'release', stages: undefined })),
      });
      expect(res.status).toBe(200);
      expect((await res.json()).workItem).toMatchObject({
        ...importedItem,
        board: 'release',
        stages: ['queued'],
      });
    }

    await expect(listItems()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalSource: importedItems[0]!.externalSource,
          board: 'release',
          stages: ['queued'],
        }),
        expect.objectContaining({
          externalSource: importedItems[1]!.externalSource,
          board: 'release',
          stages: ['queued'],
        }),
      ]),
    );
  });

  it('rejects an external-source upsert that tries to bypass governed stage transition', async () => {
    await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const res = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({
        stages: ['execute'],
        sessions: { work: { sessionId: '/sb/wt/issue-42', branch: 'factory/issue-42', threadId: 't-1' } },
      }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'governed_transition_required' });
    const [workItem] = await listItems();
    expect(workItem?.stages).toEqual(['intake']);
    expect(workItem?.stageHistory).toHaveLength(1);
    expect(workItem?.sessions).toEqual({});
  });

  it('never dedupes manual cards without an external source', async () => {
    await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody({ externalSource: null }));
    await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody({ externalSource: null }));
    expect(await listItems()).toHaveLength(2);
  });

  it('400s on an invalid body', async () => {
    const res = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody({ stages: [] }));
    expect(res.status).toBe(400);
    const bad = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({ externalSource: { integrationId: 'jira' } }),
    );
    expect(bad.status).toBe(400);
  });
});

// ── Read wire ────────────────────────────────────────────────────────────
describe('work item read wire', () => {
  it('serves normalized source facts on create, list and update while retaining the legacy wire fields', async () => {
    const response = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({
        metadata: { number: 42, state: 'closed', labels: ['bug'], author: 'reporter', authorTrusted: true },
      }),
    );
    const created = await response.json();
    expect(FACTORY_ROUTE_CONTRACTS.workItemCreate.responseSchema.parse(created)).toEqual(created);
    expect(created.workItem.workItem).toMatchObject({
      provider: 'github',
      key: 'acme/app#42',
      title: 'Fix the login flow',
      state: 'closed',
      labels: ['bug'],
      author: 'reporter',
    });
    expect(created.workItem.metadata).toMatchObject({ number: 42, author: 'reporter', authorTrusted: true });
    expect(created.workItem.workItem.metadata).not.toHaveProperty('authorTrusted');

    const listed = await (await json('GET', `/web/factory/projects/${PROJECT_ID}/work-items`)).json();
    expect(FACTORY_ROUTE_CONTRACTS.workItemList.responseSchema.parse(listed)).toEqual(listed);
    expect(listed.workItems[0].workItem).toEqual(created.workItem.workItem);

    const updated = await (
      await json('PATCH', `/web/factory/work-items/${created.workItem.id}`, { title: 'Updated title' })
    ).json();
    expect(FACTORY_ROUTE_CONTRACTS.workItemUpdate.responseSchema.parse(updated)).toEqual(updated);
    expect(updated.workItem.workItem.title).toBe('Updated title');
    expect(updated.workItem.title).toBe('Updated title');
    for (const card of [created.workItem, listed.workItems[0], updated.workItem]) {
      expect(card.workItem).not.toHaveProperty('kind');
      expect(card.workItem.sources).toHaveLength(1);
      expect(card.workItem.sources[0]).toMatchObject({ provider: 'github', sourceType: 'issue' });
      expect(card.workItem.sources[0]).not.toHaveProperty('kind');
    }
  });

  it('keeps internal tokens in storage and out of every read', async () => {
    const { item } = await seed.workItems.upsert({
      orgId: 'org1',
      userId: 'u1',
      factoryProjectId: PROJECT_ID,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: '42',
          url: 'https://github.com/acme/app/issues/42',
        },
        title: 'Fix the login flow',
        stages: ['intake'],
        sessions: {},
        metadata: {
          number: 42,
          [FACTORY_RULE_MATERIALIZATION_KEY]: 'rule-7:issue-42',
          [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: 'merged',
        },
      },
    });

    const listed = await json('GET', `/web/factory/projects/${PROJECT_ID}/work-items`);
    expect((await listed.json()).workItems[0].metadata).toEqual({ number: 42 });

    const patched = await json('PATCH', `/web/factory/work-items/${item.id}`, { metadata: { prNumber: 7 } });
    expect((await patched.json()).workItem.metadata).toEqual({ number: 42, prNumber: 7 });

    const [stored] = await listItems();
    expect(stored?.metadata[FACTORY_RULE_MATERIALIZATION_KEY]).toBe('rule-7:issue-42');
    expect(stored?.metadata[FACTORY_PULL_REQUEST_RECONCILIATION_KEY]).toBe('merged');
  });

  it('hides the reconciler missing-source marker from list responses', async () => {
    await seed.workItems.upsert({
      orgId: 'org1',
      userId: 'u1',
      factoryProjectId: PROJECT_ID,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: '43',
          url: 'https://github.com/acme/app/issues/43',
        },
        title: 'Gone upstream',
        stages: ['intake'],
        sessions: {},
        metadata: { number: 43, externalSourceMissingAt: '2026-09-30T00:00:00.000Z' },
      },
    });

    const listed = await json('GET', `/web/factory/projects/${PROJECT_ID}/work-items`);
    expect((await listed.json()).workItems[0].metadata).toEqual({ number: 43 });
  });

  it('drops internal tokens from browser writes', async () => {
    const created = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({
        metadata: {
          number: 42,
          [FACTORY_RULE_MATERIALIZATION_KEY]: 'caller-materialization',
          [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: 'merged',
          externalSourceMissingAt: '2099-01-01T00:00:00.000Z',
        },
      }),
    );
    const { workItem } = await created.json();
    expect(workItem.metadata).toEqual({ number: 42 });

    const patched = await json('PATCH', `/web/factory/work-items/${workItem.id}`, {
      metadata: {
        prNumber: 7,
        [FACTORY_RULE_MATERIALIZATION_KEY]: 'replacement-materialization',
        [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: 'closed',
        externalSourceMissingAt: '2099-01-01T00:00:00.000Z',
      },
    });
    expect((await patched.json()).workItem.metadata).toEqual({ number: 42, prNumber: 7 });

    const [stored] = await listItems();
    expect(stored?.metadata).toEqual({ prNumber: 7 });
    expect(stored?.workItem.metadata).toEqual({ number: 42 });
  });
});

// ── Patch ────────────────────────────────────────────────────────────────
describe('PATCH /web/factory/work-items/:id', () => {
  async function createItem(overrides: Record<string, unknown> = {}) {
    const res = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody(overrides));
    return (await res.json()).workItem;
  }

  it('rejects direct stage mutation and leaves the canonical item unchanged', async () => {
    const item = await createItem();
    const res = await buildApp({ workosId: 'u2', organizationId: 'org1' }).request(
      `/web/factory/work-items/${item.id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stages: ['execute'] }),
      },
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'governed_transition_required' });
    const [canonical] = await listItems();
    expect(canonical?.stages).toEqual(['intake']);
    expect(canonical?.stageHistory).toHaveLength(1);
  });

  it('assigns a legacy item to an installed board and phase', async () => {
    const { item } = await seed.workItems.upsert({
      orgId: 'org1',
      userId: 'u1',
      factoryProjectId: PROJECT_ID,
      input: { title: 'Legacy item', stages: ['intake'], sessions: {} },
    });
    const releaseBoard = defineBoard({
      id: 'release',
      title: 'Release',
      initialPhase: 'queued',
      phases: {
        queued: { title: 'Queued', kind: 'resting', next: 'shipped' },
        shipped: { title: 'Shipped', kind: 'terminal' },
      },
    });
    const app = buildApp(orgUser, undefined, undefined, new Set(), boardRegistryOf([releaseBoard]));

    const response = await app.request(`/web/factory/work-items/${item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ board: 'release', stages: ['queued'] }),
    });

    expect(response.status).toBe(200);
    expect((await response.json()).workItem).toMatchObject({ board: 'release', stages: ['queued'] });
  });

  it('atomically assigns a legacy item to only one installed board', async () => {
    const { item } = await seed.workItems.upsert({
      orgId: 'org1',
      userId: 'u1',
      factoryProjectId: PROJECT_ID,
      input: { title: 'Legacy item', stages: ['intake'], sessions: {} },
    });
    const releaseBoard = defineBoard({
      id: 'release',
      title: 'Release',
      initialPhase: 'queued',
      phases: { queued: { title: 'Queued', kind: 'resting' } },
    });
    const supportBoard = defineBoard({
      id: 'support',
      title: 'Support',
      initialPhase: 'backlog',
      phases: { backlog: { title: 'Backlog', kind: 'resting' } },
    });
    const app = buildApp(orgUser, undefined, undefined, new Set(), boardRegistryOf([releaseBoard, supportBoard]));

    const responses = await Promise.all([
      app.request(`/web/factory/work-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ board: 'release', stages: ['queued'] }),
      }),
      app.request(`/web/factory/work-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ board: 'support', stages: ['backlog'] }),
      }),
    ]);

    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect(await responses.find(response => response.status === 409)?.json()).toEqual({
      error: 'board_already_assigned',
    });
    const assigned = await seed.workItems.get({ orgId: 'org1', id: item.id });
    expect([
      { board: 'release', stages: ['queued'] },
      { board: 'support', stages: ['backlog'] },
    ]).toContainEqual({ board: assigned?.board, stages: assigned?.stages });
  });

  it('distinguishes a stale revision from an assigned board conflict', async () => {
    const { item } = await seed.workItems.upsert({
      orgId: 'org1',
      userId: 'u1',
      factoryProjectId: PROJECT_ID,
      input: { title: 'Legacy item', stages: ['intake'], sessions: {} },
    });
    await seed.workItems.update({
      orgId: 'org1',
      id: item.id,
      userId: 'u2',
      patch: { title: 'Concurrent edit' },
    });

    await expect(
      seed.workItems.update({
        orgId: 'org1',
        id: item.id,
        userId: 'u1',
        patch: { board: 'release', stages: ['queued'] },
        expectedBoard: null,
        expectedRevision: item.revision,
      }),
    ).rejects.toMatchObject<WorkItemUpdateConflictError>({ reason: 'revision' });
  });

  it('rejects creation outside exclusive intake', async () => {
    const res = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({ stages: ['intake', 'execute'] }),
    );
    expect(res.status).toBe(409);
    expect(await listItems()).toHaveLength(0);
  });

  it('merges sessions and metadata instead of replacing', async () => {
    const item = await createItem({
      sessions: { work: { sessionId: '/sb/wt/a', branch: 'b-a', threadId: 't-a' } },
      metadata: { number: 42, labels: ['bug'] },
    });
    const res = await json('PATCH', `/web/factory/work-items/${item.id}`, {
      sessions: { review: { sessionId: '/sb/wt/r', branch: 'b-r', threadId: 't-r' } },
      metadata: { prNumber: 7 },
    });
    const { workItem } = await res.json();
    expect(Object.keys(workItem.sessions).sort()).toEqual(['review', 'work']);
    expect(workItem.metadata).toEqual({ number: 42, labels: ['bug'], prNumber: 7 });
  });

  it('serializes concurrent patches so neither session merge is dropped', async () => {
    const item = await createItem();
    // Two runs file their session refs on the same card at once (e.g. a work
    // run and a review run finishing kickoff together). Each merge reads the
    // current `sessions` and writes it back — without the row lock the last
    // write would silently drop the other role.
    const [workRes, reviewRes] = await Promise.all([
      json('PATCH', `/web/factory/work-items/${item.id}`, {
        sessions: { work: { sessionId: '/sb/wt/a', branch: 'b-a', threadId: 't-a' } },
      }),
      json('PATCH', `/web/factory/work-items/${item.id}`, {
        sessions: { review: { sessionId: '/sb/wt/r', branch: 'b-r', threadId: 't-r' } },
      }),
    ]);
    expect(workRes.status).toBe(200);
    expect(reviewRes.status).toBe(200);

    const list = await json('GET', `/web/factory/projects/${PROJECT_ID}/work-items`);
    const [workItem] = (await list.json()).workItems;
    expect(Object.keys(workItem.sessions).sort()).toEqual(['review', 'work']);
  });

  it('404s for items in another org', async () => {
    const item = await createItem();
    const res = await buildApp({ workosId: 'u9', organizationId: 'org2' }).request(
      `/web/factory/work-items/${item.id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Cross-tenant mutation' }),
      },
    );
    expect(res.status).toBe(404);
  });

  it('400s on an empty or invalid patch', async () => {
    const item = await createItem();
    expect((await json('PATCH', `/web/factory/work-items/${item.id}`, {})).status).toBe(400);
    expect((await json('PATCH', `/web/factory/work-items/${item.id}`, { title: '' })).status).toBe(400);
  });

  it('no longer takes a hands-off plan grant: alone it changes nothing, beside a real field it is ignored', async () => {
    const item = await createItem();
    expect((await json('PATCH', `/web/factory/work-items/${item.id}`, { plansPreapproved: true })).status).toBe(400);
    expect((await listItems())[0]).toMatchObject({ revision: item.revision });
    expect((await listItems())[0]).not.toHaveProperty('plansPreapprovedAt');

    const renamed = await json('PATCH', `/web/factory/work-items/${item.id}`, {
      title: 'Renamed',
      plansPreapproved: true,
    });
    expect(renamed.status).toBe(200);
    expect((await listItems())[0]).toMatchObject({ title: 'Renamed' });
  });
});

describe('POST /web/factory/projects/:id/work-items/:workItemId/transition', () => {
  async function createItem(overrides: Record<string, unknown> = {}) {
    const res = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody(overrides));
    return (await res.json()).workItem;
  }

  const transition = (item: { id: string; revision: number }, overrides: Record<string, unknown> = {}) =>
    json('POST', `/web/factory/projects/${PROJECT_ID}/work-items/${item.id}/transition`, {
      board: 'work',
      stage: 'planning',
      expectedRevision: item.revision,
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      cause: 'board_drag',
      ...overrides,
    });

  it('moves through the rule authority and preserves storage-owned history', async () => {
    const item = await createItem();
    auditRecorded = [];
    const res = await transition(item);
    expect(res.status).toBe(200);
    const { result } = await res.json();
    expect(result).toMatchObject({ status: 'accepted', itemId: item.id, revision: 2, stage: 'planning' });
    const [canonical] = await listItems();
    expect(canonical?.stages).toEqual(['planning']);
    expect(canonical?.stageHistory.map(entry => [entry.stage, entry.exitedAt !== undefined])).toEqual([
      ['intake', true],
      ['planning', false],
    ]);
    expect(auditRecorded).toContainEqual(
      expect.objectContaining({
        action: 'factory.work_item.stage_moved',
        metadata: expect.objectContaining({ ingressType: 'human', configVersion: 'factory-config-v1' }),
      }),
    );
  });

  it('stamps the browser request onto the row a move leaves behind', async () => {
    const item = await createItem();
    auditRecorded = [];

    const res = await buildApp(orgUser).request(
      `/web/factory/projects/${PROJECT_ID}/work-items/${item.id}/transition`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (factory board)',
          'x-forwarded-for': '203.0.113.7, 10.0.0.1',
        },
        body: JSON.stringify({
          board: 'work',
          stage: 'planning',
          expectedRevision: item.revision,
          requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
          cause: 'board_drag',
        }),
      },
    );

    expect(res.status).toBe(200);
    expect(auditRecorded).toContainEqual(
      expect.objectContaining({
        action: 'factory.work_item.stage_moved',
        context: { location: '203.0.113.7', userAgent: 'Mozilla/5.0 (factory board)' },
      }),
    );
  });

  it('accepts a human cancel over HTTP', async () => {
    const item = await createItem();
    const res = await transition(item, { stage: 'canceled' });
    expect(res.status).toBe(200);
    expect((await res.json()).result).toMatchObject({ status: 'accepted', stage: 'canceled' });
    expect((await listItems())[0]?.stages).toEqual(['canceled']);
  });

  it('returns typed stale without overwriting the winner', async () => {
    const item = await createItem();
    expect((await transition(item)).status).toBe(200);
    const stale = await transition(item, { requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', stage: 'triage' });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ result: { status: 'rejected', code: 'stale' } });
    expect((await listItems())[0]?.stages).toEqual(['planning']);
  });

  it('replays immutable ingress without evaluating a second destination', async () => {
    const item = await createItem();
    const first = await transition(item);
    const replay = await transition(item, { stage: 'triage' });
    expect(await replay.json()).toEqual(await first.json());
    expect((await listItems())[0]?.stages).toEqual(['planning']);
  });

  it('rejects non-UUID human request identities before they can collide across work items', async () => {
    const item = await createItem();
    const res = await transition(item, { requestId: 'reused-human-request' });
    expect(res.status).toBe(400);
  });

  it('re-runs the lane only when the body asks to re-enter it', async () => {
    const decisionCount = async () =>
      ((await (await json('GET', `/web/factory/projects/${PROJECT_ID}/decisions`)).json()).decisions as unknown[])
        .length;
    const item = await createItem();
    const moved = (await (await transition(item, { stage: 'triage' })).json()).result;
    expect(await decisionCount()).toBe(1);

    const stayed = await transition(
      { id: item.id, revision: moved.revision },
      { stage: 'triage', requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2' },
    );
    expect(stayed.status).toBe(200);
    expect(await decisionCount()).toBe(1);

    const reentered = await transition(
      { id: item.id, revision: (await stayed.json()).result.revision },
      { stage: 'triage', reenter: true, requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3' },
    );
    expect(reentered.status).toBe(200);
    expect(await decisionCount()).toBe(2);
  });

  it('rejects a work item addressed through the Review board', async () => {
    const item = await createItem();
    const res = await transition(item, { board: 'review' });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ result: { status: 'rejected', code: 'invalid_transition' } });
  });
});

describe('POST /web/factory/projects/:id/runs/start', () => {
  const startBody = (workItemId?: string) => ({
    sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    threadTitle: 'Investigate issue 42',
    kickoffKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    workItem: {
      id: workItemId,
      role: 'plan',
      input: createBody({ stages: ['intake'] }),
    },
  });

  it('passes authenticated tenant identity and the Factory default model to the coordinator', async () => {
    await seed.projects.update({
      orgId: 'org1',
      id: PROJECT_ID,
      input: { defaultModelId: 'anthropic/claude-fable-5' },
    });
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const { workItem } = await created.json();
    auditRecorded = [];
    const prepare = vi.fn(async (input: any) => ({
      workItemId: input.workItem.id,
      bindingId: 'binding-1',
      threadId: input.sessionId,
      resourceId: input.sessionId,
      sessionId: input.sessionId,
      branch: 'factory/issue-42',
      revision: 2,
      kickoffStatus: 'pending',
      replayed: false,
    }));
    const requestContext = new RequestContext();
    requestContext.set('user', orgUser);
    const app = buildApp(orgUser, { prepare }, requestContext);

    const res = await app.request(`/web/factory/projects/${PROJECT_ID}/runs/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(startBody(workItem.id)),
    });

    expect(res.status).toBe(202);
    expect(prepare).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org1',
        userId: 'u1',
        factoryProjectId: PROJECT_ID,
        modelScope: 'factory',
        defaultModelId: 'anthropic/claude-fable-5',
        requestContext,
      }),
    );
    expect(auditRecorded).toEqual([]);
  });

  it('starts the run under the caller, whatever actor the body claims', async () => {
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const { workItem } = await created.json();
    const prepare = vi.fn(async (input: any) => ({
      workItemId: input.workItem.id,
      bindingId: 'binding-1',
      threadId: input.sessionId,
      resourceId: input.sessionId,
      sessionId: input.sessionId,
      branch: 'factory/issue-42',
      revision: 2,
      kickoffStatus: 'pending',
      replayed: false,
    }));
    const app = buildApp(orgUser, { prepare });

    const res = await app.request(`/web/factory/projects/${PROJECT_ID}/runs/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...startBody(workItem.id),
        actor: { type: 'system', id: 'forged' },
        userId: 'forged',
        orgId: 'forged',
      }),
    });

    expect(res.status).toBe(202);
    expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org1', userId: 'u1' }));
  });

  it('rejects a non-UUID kickoff identity before coordination', async () => {
    const prepare = vi.fn();
    const app = buildApp(orgUser, { prepare });

    const res = await app.request(`/web/factory/projects/${PROJECT_ID}/runs/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...startBody('cccccccc-cccc-4ccc-8ccc-ccccccccccc1'), kickoffKey: 'reused-kickoff' }),
    });

    expect(res.status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });

  it.each(['', 'not-a-uuid', 'x'.repeat(65), 42])(
    'rejects an explicitly supplied invalid work item identity: %o',
    async id => {
      const prepare = vi.fn();
      const app = buildApp(orgUser, { prepare });
      const body = startBody();

      const res = await app.request(`/web/factory/projects/${PROJECT_ID}/runs/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, workItem: { ...body.workItem, id } }),
      });

      expect(res.status).toBe(400);
      expect(prepare).not.toHaveBeenCalled();
    },
  );

  it('rejects a start without a work item id', async () => {
    const prepare = vi.fn();
    const app = buildApp(orgUser, { prepare });
    const body = startBody();

    const res = await app.request(`/web/factory/projects/${PROJECT_ID}/runs/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });
});

// ── Delete ───────────────────────────────────────────────────────────────
describe('DELETE /web/factory/work-items/:id', () => {
  it('removes the item for the org', async () => {
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const { workItem } = await created.json();
    const res = await json('DELETE', `/web/factory/work-items/${workItem.id}`);
    expect((await res.json()).ok).toBe(true);
    expect(await listItems()).toHaveLength(0);
  });

  it('404s for unknown or cross-org items', async () => {
    expect((await json('DELETE', `/web/factory/work-items/00000000-0000-4000-8000-000000000099`)).status).toBe(404);
  });
});

// ── Related Work / Review items ──────────────────────────────────────────
describe('work item relations', () => {
  const create = async (externalId: string, overrides: Record<string, unknown> = {}) => {
    const response = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({
        externalSource: { integrationId: 'github', type: 'issue', externalId },
        ...overrides,
      }),
    );
    return { response, body: await response.json() };
  };

  it('creates separate related items and preserves the relation on source-key reuse', async () => {
    const { body: parent } = await create('parent');
    const { body: child } = await create('child', {
      externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'child' },
      parentWorkItemId: parent.workItem.id,
    });

    expect(child.workItem.parentWorkItemId).toBe(parent.workItem.id);
    // A pull request filed without a board lands on Work, where it is reviewed.
    expect(child.workItem.board).toBe('work');

    const { body: repeated } = await create('child', {
      externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'child' },
      parentWorkItemId: null,
      title: 'Updated review title',
    });
    expect(repeated.workItem).toMatchObject({
      id: child.workItem.id,
      parentWorkItemId: parent.workItem.id,
      title: 'Updated review title',
    });
  });

  it('attaches a parent when a repeated source-key upsert supplies one', async () => {
    const { body: parent } = await create('late-parent');
    const pullRequestSource = { integrationId: 'github', type: 'pull-request', externalId: 'late-child' };
    const { body: existing } = await create('late-child', { externalSource: pullRequestSource });
    const { body: related } = await create('late-child', {
      externalSource: pullRequestSource,
      parentWorkItemId: parent.workItem.id,
    });

    expect(related.workItem).toMatchObject({ id: existing.workItem.id, parentWorkItemId: parent.workItem.id });
  });

  it('rejects missing, cross-project, self, and cyclic relations', async () => {
    const missing = await create('missing', {
      parentWorkItemId: '00000000-0000-4000-8000-000000000099',
    });
    expect(missing.response.status).toBe(400);

    const otherProject = await seed.projects.create({
      orgId: 'org1',
      userId: 'u1',
      input: { name: 'Other project' },
    });
    const otherParentResponse = await json(
      'POST',
      `/web/factory/projects/${otherProject.id}/work-items`,
      createBody({
        externalSource: { integrationId: 'github', type: 'issue', externalId: 'other-project' },
      }),
    );
    const otherParent = (await otherParentResponse.json()).workItem;
    const crossProject = await create('cross-project', { parentWorkItemId: otherParent.id });
    expect(crossProject.response.status).toBe(400);

    const { body: first } = await create('first');
    const { body: second } = await create('second', { parentWorkItemId: first.workItem.id });
    expect(
      (
        await json('PATCH', `/web/factory/work-items/${first.workItem.id}`, {
          parentWorkItemId: first.workItem.id,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await json('PATCH', `/web/factory/work-items/${first.workItem.id}`, {
          parentWorkItemId: second.workItem.id,
        })
      ).status,
    ).toBe(400);
  });

  it('clears a relation explicitly and when the parent is deleted', async () => {
    const { body: parent } = await create('delete-parent');
    const { body: child } = await create('delete-child', { parentWorkItemId: parent.workItem.id });

    const cleared = await json('PATCH', `/web/factory/work-items/${child.workItem.id}`, { parentWorkItemId: null });
    expect((await cleared.json()).workItem.parentWorkItemId).toBeNull();

    await json('PATCH', `/web/factory/work-items/${child.workItem.id}`, { parentWorkItemId: parent.workItem.id });
    expect((await json('DELETE', `/web/factory/work-items/${parent.workItem.id}`)).status).toBe(200);
    expect((await listItems())[0]?.parentWorkItemId).toBeNull();
  });
});

describe('GET /web/factory/projects/:id/decisions', () => {
  it('names the linked-card source on the summary and leaves it null for other effects', async () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: null,
      ingress: { identity: 'decision-source', triggerType: 'test' },
      configVersion: 'rules-v1',
      expectedRevision: null,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'upsertLinkedWorkItem',
          idempotencyKey: 'decision-source-linked',
          board: 'review',
          source: 'github-pr',
          sourceKey: 'github-pr:7',
          title: 'Fix the login flow',
          url: null,
          stage: 'intake',
          metadata: {},
        },
        {
          type: 'sendMessage',
          role: 'work',
          message: 'Notify the session.',
          idempotencyKey: 'decision-source-message',
        },
      ],
      causalChain: [],
      now,
    });

    const body = await (await json('GET', `/web/factory/projects/${PROJECT_ID}/decisions`)).json();
    expect(body.decisions).toHaveLength(2);
    expect(body.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'upsertLinkedWorkItem', source: 'github-pr' }),
        expect.objectContaining({ type: 'sendMessage', source: null }),
      ]),
    );
  });
});

describe('GET /web/factory/projects/:id/decisions retry eligibility', () => {
  it('reports decisions that have not failed as not retryable, matching the retry route', async () => {
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const workItem = (await seed.workItems.update({
      orgId: 'org1',
      id: (await created.json()).workItem.id,
      userId: 'u1',
      patch: { stages: ['triage'] },
    }))!.item;
    const now = new Date();
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: workItem.id,
      ingress: { identity: 'not-failed', triggerType: 'test' },
      configVersion: 'rules-v1',
      expectedRevision: workItem.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: ['succeeded', 'superseded', 'proposed'].map(key => ({
        type: 'invokeSkill' as const,
        role: 'triage',
        skillName: 'factory-triage',
        idempotencyKey: key,
      })),
      causalChain: [],
      now,
    });
    const claimed = await seed.workItems.claimDeferredDecisions({
      ownerId: 'worker-1',
      now,
      leaseExpiresAt: new Date(now.getTime() + 60_000),
      limit: 3,
    });
    expect(claimed).toHaveLength(3);
    const [succeeded, superseded, proposed] = claimed.map(decision => ({
      id: decision.id,
      orgId: decision.orgId,
      factoryProjectId: decision.factoryProjectId,
      ownerId: 'worker-1',
    }));
    await seed.workItems.completeDeferredDecision(succeeded!, now);
    await seed.workItems.supersedeLeasedDecision(superseded!, now);
    await seed.workItems.proposeDeferredDecision(proposed!, now);

    const body = await (await json('GET', `/web/factory/projects/${PROJECT_ID}/decisions`)).json();
    expect(body.decisions.map((decision: { status: string }) => decision.status).sort()).toEqual([
      'proposed',
      'succeeded',
      'superseded',
    ]);
    for (const decision of body.decisions) {
      expect(decision).toMatchObject({ failureCode: null, canRetry: false });
      const retry = await json('POST', `/web/factory/projects/${PROJECT_ID}/decisions/${decision.id}/retry`);
      expect(retry.status).toBe(409);
      expect((await seed.workItems.getDeferredDecision('org1', PROJECT_ID, decision.id))?.status).toBe(decision.status);
    }
  });
});

describe('GET /web/factory/projects/:id/attention', () => {
  it('refuses to retry a failed run once the card has left the phase it was decided for', async () => {
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const workItem = (await seed.workItems.update({
      orgId: 'org1',
      id: (await created.json()).workItem.id,
      userId: 'u1',
      patch: { stages: ['triage'] },
    }))!.item;
    const decidedAt = new Date(Date.now() + 1_000);
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: workItem.id,
      ingress: { identity: 'stale-retry', triggerType: 'test' },
      configVersion: 'rules-v1',
      expectedRevision: workItem.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [{ type: 'invokeSkill', role: 'triage', skillName: 'factory-triage', idempotencyKey: 'stale-retry' }],
      causalChain: [],
      now: decidedAt,
    });
    const [claimed] = await seed.workItems.claimDeferredDecisions({
      ownerId: 'worker-1',
      now: decidedAt,
      leaseExpiresAt: new Date(decidedAt.getTime() + 60_000),
      limit: 1,
    });
    const failed = await seed.workItems.failDeferredDecision({
      id: claimed!.id,
      orgId: claimed!.orgId,
      factoryProjectId: claimed!.factoryProjectId,
      ownerId: 'worker-1',
      now: decidedAt,
      availableAt: decidedAt,
      lastError: 'Session unavailable.',
      failureCode: 'session_unavailable',
      terminal: true,
    });
    const listDecisions = async () =>
      (await (await json('GET', `/web/factory/projects/${PROJECT_ID}/decisions`)).json()).decisions;
    await expect(listDecisions()).resolves.toMatchObject([{ id: failed!.id, canRetry: true }]);

    vi.useFakeTimers({ now: new Date(decidedAt.getTime() + 60_000), toFake: ['Date'] });
    try {
      await seed.workItems.update({ orgId: 'org1', id: workItem.id, userId: 'u1', patch: { stages: ['planning'] } });
    } finally {
      vi.useRealTimers();
    }

    await expect(listDecisions()).resolves.toMatchObject([{ id: failed!.id, canRetry: false }]);
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [{ decisionId: failed!.id, canRetry: false }],
    });
    const retry = await json('POST', `/web/factory/projects/${PROJECT_ID}/decisions/${failed!.id}/retry`);
    expect(retry.status).toBe(409);
    await expect(retry.json()).resolves.toEqual({ error: 'decision_not_retryable' });
    expect((await seed.workItems.getDeferredDecision('org1', PROJECT_ID, failed!.id))?.status).toBe('failed');
  });

  it('tracks read and archived failure occurrences across retries', async () => {
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const createdBody = await created.json();
    const workItem = createdBody.workItem;
    const now = new Date('2030-01-01T00:00:00.000Z');
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: workItem.id,
      ingress: { identity: 'attention-failure', triggerType: 'test' },
      configVersion: 'rules-v1',
      expectedRevision: workItem.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'sendMessage',
          role: 'work',
          message: 'Notify the session.',
          idempotencyKey: 'attention-failure',
        },
      ],
      causalChain: [],
      now,
    });

    const failNextAttempt = async () => {
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
        failureCode: 'source_control_missing',
        terminal: true,
      });
      if (!failed) throw new Error('Expected a failed deferred decision');
      return failed;
    };

    const firstFailure = await failNextAttempt();
    const firstKey = `factory:${PROJECT_ID}:attention:automation-failed:${firstFailure.id}:1`;
    const findMany = vi.spyOn(seed.storage.ops, 'findMany');
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [
        {
          key: firstKey,
          kind: 'automation-failed',
          decisionId: firstFailure.id,
          occurrence: 1,
          workItemId: workItem.id,
          title: 'Fix the login flow',
          detail: 'No active Factory binding for role work.',
          decisionType: 'sendMessage',
          failureCode: 'source_control_missing',
          canRetry: true,
          occurredAt: now.toISOString(),
          read: false,
          archived: false,
          target: { kind: 'work-item', workItemId: workItem.id, board: 'work' },
        },
      ],
      kinds: {
        'automation-failed': { open: 1, unread: 1, latest: { key: firstKey, at: now.toISOString(), unread: true } },
      },
      hasMore: false,
    });
    const receiptRead = findMany.mock.calls.find(([collection]) => collection === 'factory_attention_receipts');
    expect(receiptRead?.[1]).toMatchObject({ source_id: { in: [firstFailure.id] } });
    const decisionReads = findMany.mock.calls.filter(([collection]) => collection === 'factory_deferred_decisions');
    expect(decisionReads.every(([, , options]) => options?.limit !== undefined)).toBe(true);

    expect(
      (
        await json('PATCH', `/web/factory/work-items/${workItem.id}`, {
          sessions: {
            triage: { sessionId: 'session-triage', branch: 'factory/triage', threadId: 'thread-triage' },
          },
        })
      ).status,
    ).toBe(200);
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [{ decisionId: firstFailure.id, target: { kind: 'work-item', workItemId: workItem.id, board: 'work' } }],
    });

    expect(
      (
        await json('PATCH', `/web/factory/work-items/${workItem.id}`, {
          sessions: {
            work: { sessionId: 'session-attention', branch: 'factory/attention', threadId: 'thread-attention' },
          },
        })
      ).status,
    ).toBe(200);
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [
        {
          decisionId: firstFailure.id,
          target: { kind: 'thread', sessionId: 'session-attention', threadId: 'thread-attention' },
        },
      ],
    });
    const receiptPath = `/web/factory/projects/${PROJECT_ID}/attention/automation-failed/${firstFailure.id}/1`;
    expect((await json('POST', `${receiptPath}/read`)).status).toBe(200);
    await expect(
      (await json('GET', `/web/factory/projects/${PROJECT_ID}/attention?view=unread`)).json(),
    ).resolves.toMatchObject({ items: [], kinds: { 'automation-failed': { open: 1, unread: 0 } } });

    expect((await json('POST', `${receiptPath}/archive`)).status).toBe(200);
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [],
      kinds: { 'automation-failed': { open: 0, unread: 0 } },
    });
    expect((await json('POST', `${receiptPath}/read`)).status).toBe(200);
    await expect(
      (await json('GET', `/web/factory/projects/${PROJECT_ID}/attention?view=archived`)).json(),
    ).resolves.toMatchObject({
      items: [{ key: firstKey, read: true, archived: true }],
    });

    expect((await json('POST', `${receiptPath}/restore`)).status).toBe(200);
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [{ key: firstKey, read: true, archived: false }],
      kinds: { 'automation-failed': { open: 1, unread: 0 } },
    });
    await seed.workItems.setAttentionReceipt({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      userId: 'u2',
      identity: {
        kind: 'automation-failed',
        sourceId: firstFailure.id,
        occurrence: firstFailure.failureOccurrence,
      },
      action: 'archive',
      now,
    });

    expect((await json('POST', `/web/factory/projects/${PROJECT_ID}/decisions/${firstFailure.id}/retry`)).status).toBe(
      200,
    );
    const receiptsAfterRetry = await Promise.all(
      ['u1', 'u2'].map(userId =>
        seed.workItems.listAttentionReceipts({
          orgId: 'org1',
          factoryProjectId: PROJECT_ID,
          userId,
          identities: [
            {
              kind: 'automation-failed',
              sourceId: firstFailure.id,
              occurrence: firstFailure.failureOccurrence,
            },
          ],
        }),
      ),
    );
    expect(receiptsAfterRetry).toEqual([[], []]);
    const secondFailure = await failNextAttempt();
    expect(secondFailure.failureOccurrence).toBe(2);
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [
        {
          key: `factory:${PROJECT_ID}:attention:automation-failed:${secondFailure.id}:2`,
          read: false,
          archived: false,
        },
      ],
      kinds: { 'automation-failed': { open: 1, unread: 1 } },
    });

    const readAll = await json('POST', `/web/factory/projects/${PROJECT_ID}/attention/read-all`);
    expect(readAll.status).toBe(200);
    await expect(readAll.json()).resolves.toEqual({ ok: true, hasMore: false });
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [{ occurrence: 2, read: true, archived: false }],
      kinds: { 'automation-failed': { open: 1, unread: 0 } },
    });

    const [retried, staleReceipt] = await Promise.all([
      seed.workItems.retryDeferredDecision('org1', PROJECT_ID, secondFailure.id, now),
      seed.workItems.setAttentionReceipt({
        orgId: 'org1',
        factoryProjectId: PROJECT_ID,
        userId: 'u3',
        identity: {
          kind: 'automation-failed',
          sourceId: secondFailure.id,
          occurrence: secondFailure.failureOccurrence,
        },
        action: 'archive',
        now,
      }),
    ]);
    expect(retried).toMatchObject({ status: 'retry' });
    expect(staleReceipt).toBeNull();
    await expect(
      seed.workItems.listAttentionReceipts({
        orgId: 'org1',
        factoryProjectId: PROJECT_ID,
        userId: 'u3',
        identities: [
          {
            kind: 'automation-failed',
            sourceId: secondFailure.id,
            occurrence: secondFailure.failureOccurrence,
          },
        ],
      }),
    ).resolves.toEqual([]);
  });

  it('lists a parked run as an attention item and drops it once it is superseded', async () => {
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const workItem = (await created.json()).workItem;
    const now = new Date('2030-01-01T00:00:00.000Z');
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: workItem.id,
      ingress: { identity: 'approval-queue', triggerType: 'test' },
      configVersion: 'rules-v1',
      expectedRevision: workItem.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'invokeSkill',
          role: 'triage',
          skillName: 'factory-triage',
          idempotencyKey: 'approval-queue-triage',
        },
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
    if (!claimed) throw new Error('Expected a proposed decision');
    await seed.workItems.proposeDeferredDecision(
      { id: claimed.id, orgId: claimed.orgId, factoryProjectId: claimed.factoryProjectId, ownerId: 'worker-1' },
      now,
    );

    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [
        {
          key: `factory:${PROJECT_ID}:attention:automation-proposed:${claimed.id}:0`,
          kind: 'automation-proposed',
          decisionId: claimed.id,
          occurrence: 0,
          workItemId: workItem.id,
          detail: 'Waiting for approval to run triage',
          decisionType: 'invokeSkill',
          read: false,
          archived: false,
        },
      ],
      kinds: { 'automation-proposed': { open: 1, unread: 1 } },
    });

    await seed.workItems.supersedeTerminalDecisionsForWorkItem({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: workItem.id,
      supersededAt: now,
    });
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [],
      kinds: { 'automation-proposed': { open: 0 } },
    });
  });

  it('stamps the approver on the decision when a proposed run is approved', async () => {
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const workItem = (await created.json()).workItem;
    const now = new Date('2030-01-01T00:00:00.000Z');
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: workItem.id,
      ingress: { identity: 'approve-attribution', triggerType: 'test' },
      configVersion: 'rules-v1',
      expectedRevision: workItem.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'invokeSkill',
          role: 'triage',
          skillName: 'factory-triage',
          idempotencyKey: 'approve-attribution-triage',
        },
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
    if (!claimed) throw new Error('Expected a proposed decision');
    await seed.workItems.proposeDeferredDecision(
      { id: claimed.id, orgId: claimed.orgId, factoryProjectId: claimed.factoryProjectId, ownerId: 'worker-1' },
      now,
    );

    const approved = await json('POST', `/web/factory/projects/${PROJECT_ID}/decisions/${claimed.id}/approve`);
    expect(approved.status).toBe(200);

    const decision = await seed.workItems.getDeferredDecision('org1', PROJECT_ID, claimed.id);
    expect(decision?.approvedBy).toBe('u1');
  });

  it('orders a re-failed old decision by its latest failure occurrence', async () => {
    const createdAt = new Date('2030-01-01T00:00:00.000Z');
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: null,
      ingress: { identity: 'attention-refailure-order', triggerType: 'test' },
      configVersion: 'rules-v1',
      expectedRevision: null,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'sendMessage',
          role: 'work',
          message: 'Older decision.',
          idempotencyKey: 'attention-refailure-older',
        },
        {
          type: 'sendMessage',
          role: 'work',
          message: 'Newer decision.',
          idempotencyKey: 'attention-refailure-newer',
        },
      ],
      causalChain: [],
      now: createdAt,
    });
    const claimed = await seed.workItems.claimDeferredDecisions({
      ownerId: 'worker-1',
      now: createdAt,
      leaseExpiresAt: new Date(createdAt.getTime() + 60_000),
      limit: 2,
    });
    const [older, newer] = [...claimed].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (!older || !newer) throw new Error('Expected two deferred decisions');
    const fail = (decision: FactoryDeferredDecisionRecord, now: Date) =>
      seed.workItems.failDeferredDecision({
        id: decision.id,
        orgId: decision.orgId,
        factoryProjectId: decision.factoryProjectId,
        ownerId: 'worker-1',
        now,
        availableAt: now,
        lastError: `Failure ${decision.id}`,
        failureCode: 'unknown',
        terminal: true,
      });
    const firstFailureAt = new Date(createdAt.getTime() + 60_000);
    const newerFailureAt = new Date(createdAt.getTime() + 120_000);
    await fail(older, firstFailureAt);
    await fail(newer, newerFailureAt);

    const refailureAt = new Date(createdAt.getTime() + 180_000);
    await seed.workItems.retryDeferredDecision('org1', PROJECT_ID, older.id, refailureAt);
    const [reclaimed] = await seed.workItems.claimDeferredDecisions({
      ownerId: 'worker-1',
      now: refailureAt,
      leaseExpiresAt: new Date(refailureAt.getTime() + 60_000),
      limit: 1,
    });
    if (!reclaimed) throw new Error('Expected the retried decision');
    await fail(reclaimed, refailureAt);

    const firstPage = await (await json('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=1`)).json();
    expect(firstPage).toMatchObject({
      items: [{ decisionId: older.id, occurrence: 2, occurredAt: refailureAt.toISOString() }],
      hasMore: true,
    });
    if (typeof firstPage.nextCursor !== 'string') throw new Error('Expected an attention cursor');
    await expect(
      (
        await json(
          'GET',
          `/web/factory/projects/${PROJECT_ID}/attention?limit=1&before=${encodeURIComponent(firstPage.nextCursor)}`,
        )
      ).json(),
    ).resolves.toMatchObject({
      items: [{ decisionId: newer.id, occurredAt: newerFailureAt.toISOString() }],
      hasMore: false,
    });
  });

  it('rejects malformed structured receipt rows', async () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    await seed.storage.ops.insertOne('factory_attention_receipts', {
      org_id: 'org1',
      factory_project_id: PROJECT_ID,
      user_id: 'u1',
      kind: 'automation-failed',
      source_id: 'bad-state',
      occurrence: 0,
      state: 'corrupt',
      read_at: now,
      archived_at: null,
      created_at: now,
      updated_at: now,
    });
    await seed.storage.ops.insertOne('factory_attention_receipts', {
      org_id: 'org1',
      factory_project_id: PROJECT_ID,
      user_id: 'u1',
      kind: 'corrupt',
      source_id: 'bad-kind',
      occurrence: 0,
      state: 'read',
      read_at: now,
      archived_at: null,
      created_at: now,
      updated_at: now,
    });

    await expect(
      seed.workItems.listAttentionReceipts({
        orgId: 'org1',
        factoryProjectId: PROJECT_ID,
        userId: 'u1',
        identities: [{ kind: 'automation-failed', sourceId: 'bad-state', occurrence: 0 }],
      }),
    ).rejects.toThrow("Unsupported attention receipt state 'corrupt'.");
    const invalidIdentity = JSON.parse('{"kind":"corrupt","sourceId":"bad-kind","occurrence":0}');
    await expect(
      seed.workItems.listAttentionReceipts({
        orgId: 'org1',
        factoryProjectId: PROJECT_ID,
        userId: 'u1',
        identities: [invalidIdentity],
      }),
    ).rejects.toThrow("Unsupported attention receipt kind 'corrupt'.");
  });
  it('accepts receipts for legacy failed decisions at occurrence zero', async () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: null,
      ingress: { identity: 'legacy-attention-failure', triggerType: 'test' },
      configVersion: 'rules-v1',
      expectedRevision: null,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'sendMessage',
          role: 'work',
          message: 'Legacy failure.',
          idempotencyKey: 'legacy-attention-failure',
        },
      ],
      causalChain: [],
      now,
    });
    const [legacy] = await seed.workItems.listDeferredDecisions('org1', PROJECT_ID);
    if (!legacy) throw new Error('Expected a legacy deferred decision');
    await seed.storage.ops.updateMany(
      'factory_deferred_decisions',
      { id: legacy.id, org_id: 'org1', factory_project_id: PROJECT_ID },
      {
        status: 'failed',
        last_error: 'Legacy terminal failure.',
        failure_code: 'unsupported_provider_item',
        completed_at: now,
        updated_at: now,
      },
    );

    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [
        {
          key: `factory:${PROJECT_ID}:attention:automation-failed:${legacy.id}:0`,
          occurrence: 0,
          failureCode: 'unsupported_provider_item',
          canRetry: false,
          read: false,
        },
      ],
    });
    expect((await json('POST', `/web/factory/projects/${PROJECT_ID}/decisions/${legacy.id}/retry`)).status).toBe(409);
    expect(
      (await json('POST', `/web/factory/projects/${PROJECT_ID}/attention/automation-failed/${legacy.id}/0junk/read`))
        .status,
    ).toBe(422);
    expect(
      (await json('POST', `/web/factory/projects/${PROJECT_ID}/attention/automation-failed/${legacy.id}/0/read`))
        .status,
    ).toBe(200);
  });

  it('scans past a fully archived raw decision page', async () => {
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const workItem = (await created.json()).workItem;
    const now = new Date('2030-01-01T00:00:00.000Z');
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: workItem.id,
      ingress: { identity: 'attention-pagination', triggerType: 'test' },
      configVersion: 'rules-v1',
      expectedRevision: workItem.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: Array.from({ length: 51 }, (_, index) => ({
        type: 'sendMessage',
        role: 'work',
        message: `Message ${index}`,
        idempotencyKey: `attention-pagination-${index}`,
      })),
      causalChain: [],
      now,
    });
    const claimed = await seed.workItems.claimDeferredDecisions({
      ownerId: 'worker-1',
      now,
      leaseExpiresAt: new Date(now.getTime() + 60_000),
      limit: 51,
    });
    const failed: FactoryDeferredDecisionRecord[] = [];
    for (const decision of claimed) {
      const record = await seed.workItems.failDeferredDecision({
        id: decision.id,
        orgId: decision.orgId,
        factoryProjectId: decision.factoryProjectId,
        ownerId: 'worker-1',
        now,
        availableAt: now,
        lastError: `Terminal failure ${decision.id}.`,
        failureCode: 'unknown',
        terminal: true,
      });
      if (record) failed.push(record);
    }
    const newestFirst = [...failed].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id),
    );
    for (const decision of newestFirst.slice(0, 50)) {
      await seed.workItems.setAttentionReceipt({
        orgId: 'org1',
        factoryProjectId: PROJECT_ID,
        userId: 'u1',
        identity: { kind: 'automation-failed', sourceId: decision.id, occurrence: decision.failureOccurrence },
        action: 'archive',
        now,
      });
    }
    const target = newestFirst[50];
    if (!target) throw new Error('Expected an unarchived attention item');

    await expect(
      (await json('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=1`)).json(),
    ).resolves.toMatchObject({
      items: [{ decisionId: target.id }],
      kinds: { 'automation-failed': { open: 1, unread: 1 } },
      hasMore: false,
    });
    await expect(
      (
        await json(
          'GET',
          `/web/factory/projects/${PROJECT_ID}/attention?limit=1&search=${encodeURIComponent(target.id)}`,
        )
      ).json(),
    ).resolves.toMatchObject({
      items: [{ decisionId: target.id }],
      hasMore: false,
    });

    const listPage = seed.workItems.listDecisionPageByStatus.bind(seed.workItems);
    let scannedPages = 0;
    let lastScanned: FactoryDeferredDecisionRecord | undefined;
    const pageSpy = vi.spyOn(seed.workItems, 'listDecisionPageByStatus').mockImplementation(async input => {
      if (input.status !== 'failed' || input.limit === 1) return listPage(input);
      scannedPages += 1;
      const decisions = Array.from({ length: 50 }, (_, index) => {
        const ordinal = scannedPages * 50 + index;
        const occurredAt = new Date(now.getTime() - ordinal * 1_000);
        return {
          ...target,
          id: `00000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
          workItemId: null,
          lastError: 'Unrelated terminal failure.',
          completedAt: occurredAt,
          updatedAt: occurredAt,
        };
      });
      lastScanned = decisions.at(-1);
      return { decisions, hasMore: true };
    });
    const bounded = await (
      await json('GET', `/web/factory/projects/${PROJECT_ID}/attention?search=never-matches`)
    ).json();
    pageSpy.mockRestore();

    expect(scannedPages).toBe(4);
    expect(bounded).toMatchObject({ items: [], hasMore: true });
    expect(typeof bounded.nextCursor).toBe('string');
    expect(JSON.parse(Buffer.from(bounded.nextCursor, 'base64url').toString('utf8'))).toEqual({
      'automation-failed': [lastScanned?.completedAt?.toISOString(), lastScanned?.id],
    });
  });
});

// ── Metrics ──────────────────────────────────────────────────────────────
describe('GET /web/factory/projects/:id/metrics', () => {
  it('401s without a user and 404s for projects outside the org', async () => {
    expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics`, undefined, null)).status).toBe(401);

    await seedProject('other-org');
    expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics`)).status).toBe(404);
  });

  it('resolves the from/to range window, defaulting when absent or malformed', async () => {
    const bodyFor = async (query: string) =>
      (await (await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics${query}`)).json()).metrics;

    // No params → default 30-day window.
    expect((await bodyFor('')).daysCovered).toBe(30);

    // Explicit inclusive 7-calendar-day window.
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.parse(`${to}T00:00:00.000Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
    expect((await bodyFor(`?from=${from}&to=${to}`)).daysCovered).toBe(7);

    // Malformed params fall back to the default.
    expect((await bodyFor('?from=evil&to=evil')).daysCovered).toBe(30);
  });

  it('aggregates the cards the Factory ran: throughput, WIP, and source mix', async () => {
    // Freeze the clock so the cards and the one-day window below share a date
    // even when the run straddles UTC midnight.
    vi.useFakeTimers({ now: new Date('2026-06-15T12:00:00.000Z'), toFake: ['Date'] });
    // One card completed today (intake → done), one still in intake.
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody({ sessions: run }));
    const { workItem } = await created.json();
    await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items/${workItem.id}/transition`, {
      board: 'work',
      stage: 'done',
      expectedRevision: workItem.revision,
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      cause: 'board_drag',
    });
    await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({ externalSource: null, title: 'Manual card', sessions: run }),
    );
    // Synced from the repo, never run: not the Factory's work.
    await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({ externalSource: { integrationId: 'github', type: 'issue', externalId: '43' }, title: 'Upstream' }),
    );

    // One-day window matching when the cards were filed; multi-day series and
    // board-lifetime clipping are covered by the range test above and the unit tests.
    const today = new Date().toISOString().slice(0, 10);
    const res = await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics?from=${today}&to=${today}`);
    expect(res.status).toBe(200);
    const { metrics } = await res.json();

    expect(metrics.daysCovered).toBe(1);
    expect(metrics.throughput).toHaveLength(1);
    expect(metrics.throughput.reduce((sum: number, p: any) => sum + p.count, 0)).toBe(1);
    expect(metrics.leadTime.samples).toBe(1);
    // The manual card sits in intake — queued, not in flight — and the synced
    // card is out of the population entirely.
    expect(metrics.wipTotal).toBe(0);
    expect(metrics.sourceMix).toEqual(
      expect.arrayContaining([
        { source: 'github:issue', count: 1 },
        { source: 'manual', count: 1 },
      ]),
    );
    expect(metrics.sourceMix).toHaveLength(2);
  });

  it('returns zeroed metrics for an empty board', async () => {
    const res = await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics`);
    const { metrics } = await res.json();
    expect(metrics.throughput).toHaveLength(30);
    expect(metrics.leadTime).toEqual({ medianMs: null, p90Ms: null, samples: 0 });
    expect(metrics.wipTotal).toBe(0);
    expect(metrics.agentCoverage).toEqual([]);
  });

  it('serves per-stage coverage: agent-finished triage vs human-approved planning', async () => {
    // The rules engine queues triage (intake → triage), the bound agent run
    // finishes it (triage → planning), then a human approves planning into done.
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody({ sessions: run }));
    const { workItem } = await created.json();
    const service = new FactoryTransitionService({
      configVersion: 'factory-config-v1',
      storage: seed.workItems,
      boards: createTriageWorkRegistry(),
    });
    const move = (stage: 'triage' | 'planning', expectedRevision: number, identity: string, actor: FactoryRuleActor) =>
      service.transition({
        orgId: 'org1',
        factoryProjectId: PROJECT_ID,
        workItemId: workItem.id,
        board: 'work',
        stage,
        expectedRevision,
        actor,
        ingress: { type: 'rule', identity },
        cause: 'auto_triage',
      });
    const triaged = await move('triage', workItem.revision, 'auto-1', {
      type: 'system',
      id: 'factory-rule-dispatcher',
    });
    expect(triaged.status).toBe('accepted');
    const planned = await move('planning', (triaged as { revision: number }).revision, 'auto-2', {
      type: 'agent',
      bindingId: 'binding-1',
      role: 'triage',
    });
    expect(planned.status).toBe('accepted');
    const approved = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items/${workItem.id}/transition`, {
      board: 'work',
      stage: 'done',
      expectedRevision: (planned as { revision: number }).revision,
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7',
      cause: 'board_drag',
    });
    expect(approved.status).toBe(200);

    const res = await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics?days=7`);
    expect(res.status).toBe(200);
    const { metrics } = await res.json();

    expect(metrics.agentCoverage).toEqual([
      // Intake is the inbox — filing a card is not a pass through the pipeline.
      // Exited by the agent run, first visit → the agent's pass, item is done.
      { stage: 'triage', passes: 1, byAgent: 1, outcomes: { done: 1, canceled: 0, reworked: 0, inFlight: 0 } },
      // Agent-entered, human-exited → the human finished this one.
      { stage: 'planning', passes: 1, byAgent: 0, outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 0 } },
    ]);
  });
});

describe('run activity on the work-item listing', () => {
  async function startRun(sessionId: string) {
    const { item } = await seed.workItems.prepareRunStart({
      orgId: 'org1',
      userId: 'u1',
      factoryProjectId: PROJECT_ID,
      workItem: { input: { title: `Work for ${sessionId}`, stages: ['execute'] } },
      role: 'execute',
      session: { sessionId, branch: `factory/${sessionId}`, threadId: `thread-${sessionId}` },
      resourceId: sessionId,
      kickoffKey: `kickoff-${sessionId}`,
      kickoffMessage: null,
    });
    return item;
  }

  it('stamps only the starting role, preserving other roles’ sessions and startedBy (#22254)', async () => {
    const first = await seed.workItems.prepareRunStart({
      orgId: 'org1',
      userId: 'u1',
      factoryProjectId: PROJECT_ID,
      workItem: { input: { title: 'Multi-role card', stages: ['triage', 'execute'] } },
      role: 'triage',
      session: { sessionId: 'session-triage', branch: 'factory/triage', threadId: 'thread-triage' },
      resourceId: 'session-triage',
      kickoffKey: 'kickoff-triage',
      kickoffMessage: null,
    });

    const second = await seed.workItems.prepareRunStart({
      orgId: 'org1',
      userId: 'u2',
      factoryProjectId: PROJECT_ID,
      workItem: { id: first.item.id, input: { title: 'Multi-role card', stages: ['triage', 'execute'] } },
      role: 'execute',
      session: { sessionId: 'session-execute', branch: 'factory/execute', threadId: 'thread-execute' },
      resourceId: 'session-execute',
      kickoffKey: 'kickoff-execute',
      kickoffMessage: null,
    });

    expect(second.item.sessions.triage).toMatchObject({ sessionId: 'session-triage', startedBy: 'u1' });
    expect(second.item.sessions.execute).toMatchObject({ sessionId: 'session-execute', startedBy: 'u2' });
  });

  it('reports the listed cards whose session has a run in flight', async () => {
    await startRun('session-running');
    await startRun('session-idle');

    const res = await buildApp(orgUser, undefined, undefined, new Set(['session-running'])).request(
      `/web/factory/projects/${PROJECT_ID}/work-items`,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workItems).toHaveLength(2);
    expect(body.runningSessionIds).toEqual(['session-running']);
    expect(body.parkedSessionIds).toEqual([]);
  });

  it('reports the listed cards whose session waits on an answer', async () => {
    await startRun('session-parked');
    await startRun('session-idle');

    const res = await buildApp(
      orgUser,
      undefined,
      undefined,
      new Set(),
      undefined,
      new Set(['session-parked']),
    ).request(`/web/factory/projects/${PROJECT_ID}/work-items`);

    expect((await res.json()).parkedSessionIds).toEqual(['session-parked']);
  });

  it('reports no activity for a session that belongs to no card in the project', async () => {
    await startRun('session-idle');

    const res = await buildApp(orgUser, undefined, undefined, new Set(['session-elsewhere'])).request(
      `/web/factory/projects/${PROJECT_ID}/work-items`,
    );

    expect((await res.json()).runningSessionIds).toEqual([]);
  });

  describe('repeat reads of an unchanged board', () => {
    const listPath = () => `/web/factory/projects/${PROJECT_ID}/work-items`;

    it('answers 304 without a body while the cards and their activity are unchanged', async () => {
      await startRun('session-running');
      const app = buildApp(orgUser, undefined, undefined, new Set(['session-running']));

      const first = await app.request(listPath());
      const etag = first.headers.get('etag');
      expect(first.status).toBe(200);
      expect(etag).toBeTruthy();
      expect(first.headers.get('cache-control')).toBe('private, no-cache');

      const again = await app.request(listPath(), { headers: { 'if-none-match': etag! } });
      expect(again.status).toBe(304);
      expect(await again.text()).toBe('');
    });

    it('sends the board again once a card changes', async () => {
      const card = await startRun('session-idle');
      const app = buildApp(orgUser);
      const etag = (await app.request(listPath())).headers.get('etag')!;

      await json('PATCH', `/web/factory/work-items/${card.id}`, { title: 'Renamed' });

      const after = await app.request(listPath(), { headers: { 'if-none-match': etag } });
      expect(after.status).toBe(200);
      expect(after.headers.get('etag')).not.toBe(etag);
      expect((await after.json()).workItems[0].title).toBe('Renamed');
    });

    it('sends the board again once a run starts or parks on an unchanged card', async () => {
      await startRun('session-a');
      const running = new Set<string>();
      const parked = new Set<string>();
      const app = buildApp(orgUser, undefined, undefined, running, undefined, parked);
      const idle = (await app.request(listPath())).headers.get('etag')!;

      running.add('session-a');
      const started = await app.request(listPath(), { headers: { 'if-none-match': idle } });
      expect(started.status).toBe(200);
      expect((await started.json()).runningSessionIds).toEqual(['session-a']);

      running.delete('session-a');
      parked.add('session-a');
      const parkedRes = await app.request(listPath(), { headers: { 'if-none-match': idle } });
      expect(parkedRes.status).toBe(200);
      expect((await parkedRes.json()).parkedSessionIds).toEqual(['session-a']);
    });

    it('gzips the body for clients that accept it', async () => {
      await startRun('session-idle');
      const res = await buildApp(orgUser).request(listPath(), { headers: { 'accept-encoding': 'gzip, br' } });

      expect(res.headers.get('content-encoding')).toBe('gzip');
      expect(res.headers.get('vary')).toContain('Accept-Encoding');
      const body = JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8'));
      expect(FACTORY_ROUTE_CONTRACTS.workItemList.responseSchema.parse(body)).toEqual(body);
      expect(body.workItems).toHaveLength(1);
    });
  });

  const boardPath = () => `/web/factory/projects/${PROJECT_ID}/work-items`;
  const listedIds = async (res: Response) =>
    FACTORY_ROUTE_CONTRACTS.workItemList.responseSchema.parse(await res.json()).workItems.map(item => item.id);
  const createCard = async (externalId: string, overrides: Record<string, unknown> = {}): Promise<{ id: string }> => {
    const res = await json(
      'POST',
      boardPath(),
      createBody({ externalSource: { integrationId: 'github', type: 'issue', externalId }, ...overrides }),
    );
    const { workItem } = await res.json();
    return workItem;
  };

  describe('a board read that sends its cursor back (?since=)', () => {
    // Steps past the window a `since` read goes back to catch a writer whose clock runs behind.
    const later = () => vi.setSystemTime(Date.now() + 10_000);
    const read = async (since?: string) => {
      const res = await buildApp(orgUser).request(since === undefined ? boardPath() : `${boardPath()}?since=${since}`);
      const text = await res.text();
      return { ...FACTORY_ROUTE_CONTRACTS.workItemList.responseSchema.parse(JSON.parse(text)), bytes: text.length };
    };
    /** A board of `count` cards, read in full once every write to it is older than the window. */
    const boardOf = async (count: number) => {
      const cards: { id: string }[] = [];
      for (let from = 0; from < count; from += 50) {
        const ids = Array.from({ length: Math.min(50, count - from) }, (_, i) => `issue-${from + i}`);
        cards.push(...(await Promise.all(ids.map(id => createCard(id)))));
      }
      later();
      return { cards, board: await read() };
    };

    /** The card tables read from here on, and the table of deleted ids. */
    const cardReads = () => {
      const tables = ['factory_board_items', 'factory_work_items', 'factory_work_item_sources', 'work_items'];
      const findMany = vi.spyOn(seed.storage.ops, 'findMany');
      return () =>
        findMany.mock.calls
          .map(([collection]) => collection)
          .filter(collection => [...tables, 'factory_board_item_tombstones'].includes(collection));
    };

    beforeEach(() => void vi.useFakeTimers({ toFake: ['Date'] }));

    it('sends only the cards written and the ids removed since the cursor', async () => {
      const { cards, board } = await boardOf(4);
      later();
      await json('PATCH', `/web/factory/work-items/${cards[1]!.id}`, { title: 'Renamed' });
      await json('PATCH', `/web/factory/work-items/${cards[2]!.id}`, { title: 'Reworded' });
      await json('DELETE', `/web/factory/work-items/${cards[3]!.id}`);
      later();

      const next = await read(board.cursor);

      expect(next.workItems.map(card => card.title).sort()).toEqual(['Renamed', 'Reworded']);
      expect(next).toMatchObject({ removedIds: [cards[3]!.id], check: boardCheck((await read()).workItems) });
      later();
      expect(await read(next.cursor)).toMatchObject({ workItems: [], removedIds: [], check: next.check });
    });

    it('sends a card stamped before the cursor that the cursor’s read did not hold', async () => {
      const { board } = await boardOf(1);
      // A second writer: its card lands after the read, stamped by a clock behind this one.
      vi.setSystemTime(Date.now() - 2_000);
      const late = await createCard('late');
      later();

      expect((await read(board.cursor)).workItems.map(card => card.id)).toEqual([late.id]);
    });

    it.each(['not-a-cursor', ''])('sends the whole board for the cursor %j, which it did not issue', async since => {
      await boardOf(2);

      const answer = await read(since);

      expect(answer.workItems).toHaveLength(2);
      expect(answer.cursor).toEqual(expect.any(String));
      expect(answer.removedIds).toBeUndefined();
    });

    it('answers one changed card in the same bytes on a board of 50 cards and of 2,000', async () => {
      const bytes = [];
      for (const count of [50, 2_000]) {
        await seedProject();
        const { cards, board } = await boardOf(count);
        later();
        await json('PATCH', `/web/factory/work-items/${cards[0]!.id}`, { title: 'Renamed' });
        const answer = await read(board.cursor);
        bytes.push(answer.bytes - answer.check!.length);
      }

      expect(bytes[1]).toBe(bytes[0]);
    }, 60_000);

    it('names a board that holds an edit its reader was never sent', async () => {
      const { cards, board } = await boardOf(2);
      // A writer whose clock runs further behind than a `since` read goes back.
      vi.setSystemTime(Date.now() - 6_000);
      await json('PATCH', `/web/factory/work-items/${cards[0]!.id}`, { title: 'Renamed' });
      // Past the age at which the list is read whole again, which finds the edit.
      vi.setSystemTime(Date.now() + 70_000);

      const next = await read(board.cursor);

      expect(next).toMatchObject({ workItems: [], removedIds: [] });
      expect(next.check).not.toBe(boardCheck(board.workItems));
      const whole = await read();
      expect(whole.workItems.map(card => card.title)).toContain('Renamed');
      expect(next.check).toBe(boardCheck(whole.workItems));
    });

    it.each([50, 2_000])(
      'reads no card to answer a reader that holds the cached board of %i cards',
      async count => {
        const { board } = await boardOf(count);
        const reads = cardReads();

        for (let poll = 0; poll < 3; poll++) {
          expect(await read(board.cursor)).toMatchObject({ workItems: [], removedIds: [], cursor: board.cursor });
        }

        expect(reads()).toEqual([]);
      },
      60_000,
    );

    it('reads only the deleted ids to answer a cursor older than the cached board', async () => {
      const { cards, board } = await boardOf(3);
      later();
      await json('PATCH', `/web/factory/work-items/${cards[0]!.id}`, { title: 'Renamed' });
      await read(board.cursor);
      const reads = cardReads();

      const next = await read(board.cursor);
      const all = await read('1');

      expect(next.workItems.map(card => card.title)).toEqual(['Renamed']);
      expect(all.workItems).toHaveLength(3);
      expect(reads()).toEqual(['factory_board_item_tombstones', 'factory_board_item_tombstones']);
    });

    it('gzips what moved for a reader that accepts it', async () => {
      const { cards, board } = await boardOf(1);
      later();
      await json('PATCH', `/web/factory/work-items/${cards[0]!.id}`, { title: 'Renamed' });

      const res = await buildApp(orgUser).request(`${boardPath()}?since=${board.cursor}`, {
        headers: { 'accept-encoding': 'gzip, br' },
      });

      expect(res.headers.get('content-encoding')).toBe('gzip');
      expect(res.headers.get('vary')).toBe('Accept-Encoding');
      const body = JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8'));
      expect(body.workItems.map((card: { title: string }) => card.title)).toEqual(['Renamed']);
    });
  });

  describe('one session’s cards (?sessionId=)', () => {
    const scopedPath = (...sessionIds: string[]) =>
      `${boardPath()}?${sessionIds.map(sessionId => `sessionId=${encodeURIComponent(sessionId)}`).join('&')}`;

    it('lists the card that holds the session, and the activity of that card only', async () => {
      const mine = await startRun('session-mine');
      await startRun('session-other');
      const app = buildApp(orgUser, undefined, undefined, new Set(['session-mine', 'session-other']));

      const res = await app.request(scopedPath('session-mine'));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(FACTORY_ROUTE_CONTRACTS.workItemList.responseSchema.parse(body)).toEqual(body);
      expect(body.workItems.map((item: { id: string }) => item.id)).toEqual([mine.id]);
      expect(body.runningSessionIds).toEqual(['session-mine']);
    });

    it('lists the cards of every session named, in board order', async () => {
      const first = await startRun('session-first');
      await startRun('session-second');
      const third = await startRun('session-third');
      const board = await listedIds(await buildApp(orgUser).request(boardPath()));

      const res = await buildApp(orgUser).request(scopedPath('session-third', 'session-first'));

      expect(await listedIds(res)).toEqual(board.filter(id => id === first.id || id === third.id));
    });

    it('lists nothing for a session no card holds', async () => {
      await startRun('session-other');

      const res = await buildApp(orgUser).request(scopedPath('session-unknown'));

      expect(res.status).toBe(200);
      expect(await listedIds(res)).toEqual([]);
    });

    it('brings the cards related to the session’s card: its parent, its children and the pull request pushed from its branch', async () => {
      const mine = await startRun('session-mine');
      const parent = await createCard('parent');
      await json('PATCH', `/web/factory/work-items/${mine.id}`, { parentWorkItemId: parent.id });
      const child = await createCard('child', { parentWorkItemId: mine.id });
      const pullRequest = await createCard('pr-7', {
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'pr-7' },
        metadata: { number: 7, headBranch: 'factory/session-mine' },
      });
      await createCard('unrelated');

      const res = await buildApp(orgUser).request(scopedPath('session-mine'));

      expect((await listedIds(res)).toSorted()).toEqual([mine.id, parent.id, child.id, pullRequest.id].toSorted());
    });

    it('answers 304 through writes to other cards, and sends the session’s card again once it changes', async () => {
      const mine = await startRun('session-mine');
      const other = await startRun('session-other');
      const app = buildApp(orgUser);
      const etag = (await app.request(scopedPath('session-mine'))).headers.get('etag')!;

      await json('PATCH', `/web/factory/work-items/${other.id}`, { title: 'Renamed elsewhere' });
      const unchanged = await app.request(scopedPath('session-mine'), { headers: { 'if-none-match': etag } });
      expect(unchanged.status).toBe(304);
      expect(await unchanged.text()).toBe('');

      await json('PATCH', `/web/factory/work-items/${mine.id}`, { title: 'Renamed' });
      const changed = await app.request(scopedPath('session-mine'), { headers: { 'if-none-match': etag } });
      expect(changed.status).toBe(200);
      expect((await changed.json()).workItems[0].title).toBe('Renamed');
    });

    it('sends the session’s card again once its run starts', async () => {
      await startRun('session-mine');
      const running = new Set<string>();
      const app = buildApp(orgUser, undefined, undefined, running);
      const idle = (await app.request(scopedPath('session-mine'))).headers.get('etag')!;

      running.add('session-mine');
      const started = await app.request(scopedPath('session-mine'), { headers: { 'if-none-match': idle } });

      expect(started.status).toBe(200);
      expect((await started.json()).runningSessionIds).toEqual(['session-mine']);
    });

    it('refuses a blank session id rather than sending the whole board', async () => {
      await startRun('session-mine');

      const res = await buildApp(orgUser).request(`${boardPath()}?sessionId=`);

      expect(res.status).toBe(400);
    });
  });

  describe('the cards holding a session (?scope=sessions)', () => {
    const sessionsPath = () => `${boardPath()}?scope=sessions`;

    it('lists every card holding a session with its activity, in board order, without the cards holding none', async () => {
      const first = await startRun('session-first');
      await createCard('unstarted');
      const second = await startRun('session-second');
      const board = await listedIds(await buildApp(orgUser).request(boardPath()));
      const app = buildApp(
        orgUser,
        undefined,
        undefined,
        new Set(['session-first']),
        undefined,
        new Set(['session-second']),
      );

      const res = await app.request(sessionsPath());

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(FACTORY_ROUTE_CONTRACTS.workItemList.responseSchema.parse(body)).toEqual(body);
      expect(body.workItems.map((item: { id: string }) => item.id)).toEqual(
        board.filter(id => id === first.id || id === second.id),
      );
      expect(body.runningSessionIds).toEqual(['session-first']);
      expect(body.parkedSessionIds).toEqual(['session-second']);
    });

    it('brings the pull request pushed from a session’s branch, though it holds no session', async () => {
      const mine = await startRun('session-mine');
      const pullRequest = await createCard('pr-7', {
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'pr-7' },
        metadata: { number: 7, headBranch: 'factory/session-mine' },
      });
      await createCard('unrelated');

      const res = await buildApp(orgUser).request(sessionsPath());

      expect((await listedIds(res)).toSorted()).toEqual([mine.id, pullRequest.id].toSorted());
    });

    it('answers 304 through writes to cards holding no session, and sends the list again once a listed card changes', async () => {
      const mine = await startRun('session-mine');
      const unstarted = await createCard('unstarted');
      const app = buildApp(orgUser);
      const etag = (await app.request(sessionsPath())).headers.get('etag')!;

      await json('PATCH', `/web/factory/work-items/${unstarted.id}`, { title: 'Renamed elsewhere' });
      const unchanged = await app.request(sessionsPath(), { headers: { 'if-none-match': etag } });
      expect(unchanged.status).toBe(304);
      expect(await unchanged.text()).toBe('');

      await json('PATCH', `/web/factory/work-items/${mine.id}`, { title: 'Renamed' });
      const changed = await app.request(sessionsPath(), { headers: { 'if-none-match': etag } });
      expect(changed.status).toBe(200);
      expect((await changed.json()).workItems[0].title).toBe('Renamed');
    });

    it('sends the list again each time a run starts or stops on an unchanged card', async () => {
      await startRun('session-mine');
      const running = new Set<string>();
      const app = buildApp(orgUser, undefined, undefined, running);
      const idle = (await app.request(sessionsPath())).headers.get('etag')!;

      running.add('session-mine');
      const started = await app.request(sessionsPath(), { headers: { 'if-none-match': idle } });
      expect(started.status).toBe(200);
      expect((await started.json()).runningSessionIds).toEqual(['session-mine']);

      running.delete('session-mine');
      const stopped = await app.request(sessionsPath(), {
        headers: { 'if-none-match': started.headers.get('etag')! },
      });
      expect(stopped.status).toBe(200);
      expect((await stopped.json()).runningSessionIds).toEqual([]);
    });

    it.each([
      ['an unknown scope', '?scope=everything'],
      ['a scope combined with session ids', '?scope=sessions&sessionId=session-mine'],
    ])('refuses %s rather than guessing which cards to send', async (_case, query) => {
      await startRun('session-mine');

      const res = await buildApp(orgUser).request(`${boardPath()}${query}`);

      expect(res.status).toBe(400);
    });
  });

  describe('the cards holding no session (?started=false)', () => {
    const unstarted = async (query = '') => {
      const res = await buildApp(orgUser).request(`${boardPath()}?started=false${query}`);
      const body = FACTORY_ROUTE_CONTRACTS.workItemList.responseSchema.parse(await res.json());
      return { titles: body.workItems.map(item => item.title), total: body.total };
    };
    const rename = (card: { id: string }, title: string) =>
      json('PATCH', `/web/factory/work-items/${card.id}`, { title });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('lists the cards holding no session, most recently updated first, and counts them', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-01T10:00:00Z') });
      await startRun('session-mine');
      const oldest = await createCard('1', { title: 'Oldest card' });
      vi.setSystemTime(new Date('2026-11-01T10:01:00Z'));
      await createCard('2', { title: 'Middle card' });
      vi.setSystemTime(new Date('2026-11-01T10:02:00Z'));
      await createCard('3', { title: 'Newest card' });
      vi.setSystemTime(new Date('2026-11-01T10:03:00Z'));
      await json('PATCH', `/web/factory/work-items/${oldest.id}`, { metadata: { note: 'looked at' } });

      expect(await unstarted()).toEqual({
        titles: ['Oldest card', 'Newest card', 'Middle card'],
        total: 3,
      });
    });

    it('finds a card by every word typed, in any case, in its title, its key, its number or its source id', async () => {
      await createCard('github:7:issue:12', { title: 'Fix the login flow', metadata: { number: 12 } });
      await createCard('github:7:issue:345', { title: 'Rework the login palette', metadata: { number: 345 } });
      await createCard('linear:issue-uuid', {
        title: 'Tidy the settings page',
        externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear:issue-uuid' },
        metadata: { identifier: 'ENG-77' },
      });

      expect((await unstarted('&q=LOGIN%20fix')).titles).toEqual(['Fix the login flow']);
      expect((await unstarted('&q=%2312')).titles).toEqual(['Fix the login flow']);
      expect((await unstarted('&q=34')).titles).toEqual(['Rework the login palette']);
      expect((await unstarted('&q=issue:345')).titles).toEqual(['Rework the login palette']);
      expect((await unstarted('&q=eng-77')).titles).toEqual(['Tidy the settings page']);
      expect(await unstarted('&q=fix%20palette')).toEqual({ titles: [], total: 0 });
      expect((await unstarted('&q=login')).total).toBe(2);
    });

    it('never lists a card holding a session, whatever is typed', async () => {
      await startRun('session-mine');
      await createCard('1', { title: 'Work nobody started' });

      expect(await unstarted('&q=work')).toEqual({ titles: ['Work nobody started'], total: 1 });
    });

    it('sends the first 20 matches unless told a limit, with the count of every match', async () => {
      for (let number = 1; number <= 23; number += 1) {
        await createCard(String(number), { title: number % 2 ? `Palette ${number}` : `Login ${number}` });
      }

      const all = await unstarted();
      expect(all.titles).toHaveLength(20);
      expect(all.total).toBe(23);
      const typed = await unstarted('&q=palette&limit=5');
      expect(typed.titles).toHaveLength(5);
      expect(typed.titles.every(title => title.startsWith('Palette'))).toBe(true);
      expect(typed.total).toBe(12);
      expect((await unstarted('&limit=500')).titles).toHaveLength(23);
    });

    it('answers 304 while nothing changed, and sends the count again once only it changed', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-01T10:00:00Z') });
      const older = await createCard('1', { title: 'Palette, older' });
      vi.setSystemTime(new Date('2026-11-01T10:01:00Z'));
      await createCard('2', { title: 'Palette, newer' });
      const path = `${boardPath()}?started=false&q=palette&limit=1`;
      const app = buildApp(orgUser);
      const first = await app.request(path);
      const etag = first.headers.get('etag')!;
      expect(await first.json()).toMatchObject({ workItems: [{ title: 'Palette, newer' }], total: 2 });

      const unchanged = await app.request(path, { headers: { 'if-none-match': etag } });
      expect(unchanged.status).toBe(304);

      // The card that was past the limit stops matching: the listed card is the same, the count is not.
      await rename(older, 'Login');
      const changed = await app.request(path, { headers: { 'if-none-match': etag } });
      expect(changed.status).toBe(200);
      expect(await changed.json()).toMatchObject({ workItems: [{ title: 'Palette, newer' }], total: 1 });
    });
  });

  describe('the cards filed from given sources (?source=)', () => {
    const sourcePath = (...sources: string[]) =>
      `${boardPath()}?${sources.map(source => `source=${encodeURIComponent(source)}`).join('&')}`;

    it('lists the cards filed from a source named by its id or its URL, whatever sessions they hold', async () => {
      const byId = await createCard('github:7:issue:12');
      const byUrl = await createCard('github-issue:13', {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github-issue:13',
          url: 'https://github.com/acme/app/issues/13',
        },
      });
      const started = await createCard('github:7:pull-request:14');
      await json('PATCH', `/web/factory/work-items/${started.id}`, {
        sessions: { review: { sessionId: 'session-review', branch: 'factory/pr-14', threadId: 'thread-review' } },
      });
      await createCard('github:7:issue:99');

      const res = await buildApp(orgUser).request(
        sourcePath(
          'github:7:issue:12',
          'https://github.com/acme/app/issues/13',
          'github:7:pull-request:14',
          'github:7:issue:404',
        ),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(FACTORY_ROUTE_CONTRACTS.workItemList.responseSchema.parse(body)).toEqual(body);
      expect(body.workItems.map((item: { id: string }) => item.id).toSorted()).toEqual(
        [byId.id, byUrl.id, started.id].toSorted(),
      );
      expect(body).not.toHaveProperty('total');
    });

    it('lists nothing when no card is filed from the sources', async () => {
      await createCard('github:7:issue:12');

      expect(await listedIds(await buildApp(orgUser).request(sourcePath('github:7:issue:404')))).toEqual([]);
    });
  });

  it.each([
    ['a wish for the started cards', '?started=true', 'invalid_started'],
    ['unstarted cards combined with a scope', '?started=false&scope=sessions', 'invalid_started'],
    ['unstarted cards combined with session ids', '?started=false&sessionId=session-mine', 'invalid_started'],
    ['typed text without started=false', '?q=login', 'invalid_search'],
    ['typed text with a scope', '?scope=sessions&q=login', 'invalid_search'],
    ['typed text longer than 200 characters', `?started=false&q=${'a'.repeat(201)}`, 'invalid_search'],
    ['a blank source', '?source=', 'invalid_source'],
    ['a source longer than 512 characters', `?source=${'a'.repeat(513)}`, 'invalid_source'],
    ['more than 100 sources', `?${Array.from({ length: 101 }, (_, i) => `source=s${i}`).join('&')}`, 'invalid_source'],
    ['sources combined with a scope', '?source=github-issue:1&scope=sessions', 'invalid_source'],
    ['sources combined with unstarted cards', '?source=github-issue:1&started=false', 'invalid_source'],
    ['sources combined with session ids', '?source=github-issue:1&sessionId=session-mine', 'invalid_source'],
  ])('refuses %s rather than sending the whole board', async (_case, query, error) => {
    await createCard('github-issue:1');

    const res = await buildApp(orgUser).request(`${boardPath()}${query}`);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
  });
});

describe('GET /web/factory/projects/:id/health/thresholds', () => {
  it('401s without a user and 404s for projects outside the org', async () => {
    expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/health/thresholds`, undefined, null)).status).toBe(
      401,
    );

    await seedProject('other-org');
    expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/health/thresholds`)).status).toBe(404);
  });

  it('returns the default config when unset and the saved config after saveConfig', async () => {
    const res = await json('GET', `/web/factory/projects/${PROJECT_ID}/health/thresholds`);
    expect(res.status).toBe(200);
    expect((await res.json()).thresholds).toEqual([14400, 86400, 259200]);

    await seed.queueHealth.saveConfig('org1', PROJECT_ID, { thresholdsSeconds: [60, 300, 3600] });
    const res2 = await json('GET', `/web/factory/projects/${PROJECT_ID}/health/thresholds`);
    expect((await res2.json()).thresholds).toEqual([60, 300, 3600]);
  });
});

// ── Audit events ─────────────────────────────────────────────────────────
describe('audit events', () => {
  async function createItem(overrides: Record<string, unknown> = {}) {
    const res = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody(overrides));
    return (await res.json()).workItem;
  }

  it('records work_item.created on POST with actor, project, and target', async () => {
    const item = await createItem();
    expect(auditRecorded).toHaveLength(1);
    expect(auditRecorded[0]).toMatchObject({
      orgId: 'org1',
      actorId: 'u1',
      action: 'factory.work_item.created',
      factoryProjectId: PROJECT_ID,
      targets: [{ type: 'work_item', id: item.id, name: 'Fix the login flow' }],
      metadata: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: '42',
          url: 'https://github.com/acme/app/issues/42',
        },
        stages: ['intake'],
      },
    });
  });

  it('audits only the bounded non-stage refresh when a source-key POST reuses the canonical item', async () => {
    const item = await createItem();
    auditRecorded = [];

    const reused = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    expect(reused.status).toBe(200);
    expect((await reused.json()).workItem.id).toBe(item.id);
    expect(auditRecorded.map(event => event.action)).toEqual(['factory.work_item.updated']);
    expect(auditRecorded[0]?.metadata.fields).not.toContain('stages');
    expect(auditRecorded[0]?.metadata.fields).not.toContain('sessions');
  });

  it('does not audit a rejected legacy stage PATCH as a movement', async () => {
    const item = await createItem();
    auditRecorded = [];

    const rejected = await json('PATCH', `/web/factory/work-items/${item.id}`, { stages: ['execute'] });
    expect(rejected.status).toBe(409);
    expect(auditRecorded).toEqual([]);
  });

  it('files a session onto a role as an update, never as a run start', async () => {
    const item = await createItem();
    auditRecorded = [];

    const session = { sessionId: '/sb/wt/issue-42', branch: 'factory/issue-42', threadId: 't-1' };
    await json('PATCH', `/web/factory/work-items/${item.id}`, { sessions: { work: session } });
    expect(auditRecorded.map(e => e.action)).toEqual(['factory.work_item.updated']);
    expect(auditRecorded[0].metadata).toEqual({ fields: ['sessions'] });
  });

  it('records only updated when the patch does not move stages', async () => {
    const item = await createItem();
    auditRecorded = [];

    await json('PATCH', `/web/factory/work-items/${item.id}`, { title: 'Renamed card' });
    expect(auditRecorded.map(e => e.action)).toEqual(['factory.work_item.updated']);
    expect(auditRecorded[0].metadata).toEqual({ fields: ['title'] });
  });

  it('records work_item.deleted on DELETE', async () => {
    const item = await createItem();
    auditRecorded = [];

    await json('DELETE', `/web/factory/work-items/${item.id}`);
    expect(auditRecorded).toHaveLength(1);
    expect(auditRecorded[0]).toMatchObject({
      action: 'factory.work_item.deleted',
      factoryProjectId: PROJECT_ID,
      targets: [{ type: 'work_item', id: item.id, name: 'Fix the login flow' }],
    });
  });

  it('never blocks the mutation when the audit insert throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    auditFailure = new Error('audit db down');

    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    expect(created.status).toBe(200);
    const { workItem } = await created.json();

    const transitioned = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items/${workItem.id}/transition`,
      {
        board: 'work',
        stage: 'done',
        expectedRevision: workItem.revision,
        requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
        cause: 'board_drag',
      },
    );
    expect(transitioned.status).toBe(200);

    const deleted = await json('DELETE', `/web/factory/work-items/${workItem.id}`);
    expect(deleted.status).toBe(200);
    expect(await listItems()).toHaveLength(0);

    warn.mockRestore();
  });
});

// ── Validation units ─────────────────────────────────────────────────────
describe('parseCreateWorkItem', () => {
  it('accepts a minimal manual work item', () => {
    expect(parseCreateWorkItem({ title: ' Card ', stages: ['intake'] })).toEqual({
      title: 'Card',
      stages: ['intake'],
    });
  });

  it('accepts a normalized external source', () => {
    expect(parseCreateWorkItem(createBody())).toEqual(createBody());
  });

  it('rejects bad stages, malformed external sources, and oversized metadata', () => {
    expect(parseCreateWorkItem(createBody({ stages: ['in take'] }))).toBeNull();
    expect(parseCreateWorkItem(createBody({ stages: ['a', 'a'] }))).toBeNull();
    expect(parseCreateWorkItem(createBody({ externalSource: { integrationId: 'github' } }))).toBeNull();
    expect(parseCreateWorkItem(createBody({ metadata: { blob: 'x'.repeat(20_000) } }))).toBeNull();
  });

  it('rejects malformed sessions', () => {
    expect(parseCreateWorkItem(createBody({ sessions: { work: { sessionId: '/p' } } }))).toBeNull();
    expect(
      parseCreateWorkItem(createBody({ sessions: { '': { sessionId: '/p', branch: 'b', threadId: 't' } } })),
    ).toBeNull();
  });
});

describe('parseUpdateWorkItem', () => {
  it('rejects an empty or unknown-only patch and passes through valid fields', () => {
    expect(parseUpdateWorkItem({})).toBeNull();
    expect(parseUpdateWorkItem({ stages: ['done'] })).toEqual({ stages: ['done'] });
    expect(parseUpdateWorkItem({ url: null })).toBeNull();
  });
});
