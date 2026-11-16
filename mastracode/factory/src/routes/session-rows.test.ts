import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import type { SessionActivityResponse, SessionRow, SessionRowsResponse } from './contracts.js';
import { createProjectSessionsReader } from './project-sessions.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';
import { WorkItemRoutes } from './work-items.js';

const ORG = 'org1';
const PARKED_RUN = { toolName: 'ask_user', suspendedAt: 0 };

let seed: FactoryStorageTestSeed;
let sourceControl: SourceControlStorageHandle;
let projectId = '';
let projectRepositoryId = '';

interface LiveState {
  running?: readonly { threadId: string; resourceId?: string }[];
  parked?: ReadonlySet<string>;
}

function buildApp(viewer: string, { running = [], parked = new Set() }: LiveState = {}) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('factoryAuthUser' as never, { workosId: viewer, organizationId: ORG } as never);
    await next();
  });
  mountApiRoutes(
    app as never,
    new WorkItemRoutes({
      auth: fakeRouteAuth(),
      audit: { emit: async () => {} },
      projects: seed.projects,
      workItems: seed.workItems,
      queueHealth: seed.queueHealth,
      liveSessions: {
        isRunning: sessionId => running.some(run => run.threadId === sessionId),
        parked: sessionId => (parked.has(sessionId) ? PARKED_RUN : undefined),
        parkedIn: () => [...parked].map(sessionId => ({ sessionId, run: PARKED_RUN })),
      },
      projectSessions: createProjectSessionsReader({ sourceControls: [sourceControl], workItems: seed.workItems }),
      activeRuns: () => running,
    }).routes(),
  );
  return app;
}

async function createSession(
  sessionId: string,
  {
    userId = 'u1',
    branch = `user/session-${sessionId}`,
    visibility = 'org',
    materialized = true,
  }: { userId?: string; branch?: string; visibility?: 'org' | 'private'; materialized?: boolean } = {},
) {
  const session = await sourceControl.sessions.create({
    sessionId,
    projectRepositoryId,
    factoryProjectId: projectId,
    orgId: ORG,
    userId,
    branch,
    baseBranch: 'main',
    visibility,
  });
  if (materialized) await sourceControl.sessions.markMaterialized({ id: session.id });
  return session;
}

async function createCardSession(sessionId: string, title: string): Promise<Card> {
  const branch = `factory/${sessionId}`;
  await createSession(sessionId, { branch });
  const { item } = await seed.workItems.upsert({
    orgId: ORG,
    userId: 'u1',
    factoryProjectId: projectId,
    input: { title, stages: ['intake'], sessions: { work: { sessionId, branch, threadId: sessionId } } },
  });
  return item;
}

async function proposeRunFor(card: Card) {
  const now = new Date();
  await seed.workItems.commitRuleEvaluation({
    orgId: ORG,
    factoryProjectId: projectId,
    workItemId: card.id,
    ingress: { identity: `proposal-${card.id}`, triggerType: 'test' },
    configVersion: 'rules-v1',
    expectedRevision: card.revision,
    actor: { type: 'system', id: 'rules' },
    outcome: { status: 'accepted' },
    decisions: [
      { type: 'invokeSkill', role: 'triage', skillName: 'factory-triage', idempotencyKey: `proposal-${card.id}` },
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
  if (!claimed) throw new Error('Expected a claimed decision');
  await seed.workItems.proposeDeferredDecision(
    { id: claimed.id, orgId: claimed.orgId, factoryProjectId: claimed.factoryProjectId, ownerId: 'worker-1' },
    now,
  );
}

async function follow(card: Card, sessionId: string) {
  await seed.workItems.subscribeToWorkItem({
    orgId: ORG,
    factoryProjectId: projectId,
    workItemId: card.id,
    sessionId,
    threadId: sessionId,
    resourceId: 'u1',
    userId: 'u1',
    reason: 'subscribed',
  });
}

async function readRows(app: Hono, query = ''): Promise<SessionRowsResponse> {
  const res = await app.request(`/web/factory/projects/${projectId}/session-rows${query}`);
  expect(res.status).toBe(200);
  return FACTORY_ROUTE_CONTRACTS.sessionRows.responseSchema.parse(await res.json());
}

async function readActivity(app: Hono): Promise<SessionActivityResponse> {
  const res = await app.request(`/web/factory/projects/${projectId}/session-activity`);
  expect(res.status).toBe(200);
  return FACTORY_ROUTE_CONTRACTS.sessionActivity.responseSchema.parse(await res.json());
}

function rowOf(body: SessionRowsResponse, sessionId: string): SessionRow | undefined {
  return body.groups.flatMap(group => group.rows).find(row => row.session.sessionId === sessionId);
}

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  sourceControl = seed.sourceControl.forIntegration('gitlab');
  const project = await seed.projects.create({ orgId: ORG, userId: 'u1', input: { name: 'Sessions' } });
  projectId = project.id;
  const installation = await sourceControl.installations.upsert({
    orgId: ORG,
    connectedByUserId: 'u1',
    externalId: 'gitlab.com',
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: ORG,
    input: { installationId: installation.id, externalId: '1', slug: 'acme/app', defaultBranch: 'main' },
  });
  const connection = await sourceControl.connections.create({
    orgId: ORG,
    factoryProjectId: projectId,
    installationId: installation.id,
    createdByUserId: 'u1',
  });
  const link = await sourceControl.projectRepositories.link({
    orgId: ORG,
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'u1',
    sandboxProvider: 'local',
    sandboxWorkdir: '/workspace/app',
  });
  projectRepositoryId = link.id;
});

describe('GET /web/factory/projects/:id/session-rows', () => {
  it("answers the sidebar's rows grouped, with one row per card and the project's totals", async () => {
    await createSession('mine');
    await createSession('teammate', { userId: 'u2' });
    await createCardSession('card-run', 'Fix login');

    const body = await readRows(buildApp('u1'), '?groupBy=board');

    expect(body).toMatchObject({ total: 3, matching: 3, boards: ['work'], settling: false });
    expect(body.owners.map(owner => owner.userId)).toEqual(['u1', 'u2']);
    expect(body.groups.flatMap(group => group.rows.map(row => row.session.sessionId)).toSorted()).toEqual([
      'card-run',
      'mine',
      'teammate',
    ]);
    expect(rowOf(body, 'card-run')).toMatchObject({ origin: 'factory', board: 'work', card: { title: 'Fix login' } });
    expect(rowOf(body, 'mine')).toMatchObject({ origin: 'user', status: 'idle' });
  });

  it('answers 304 to a reader that holds the same rows, and the rows again once they change', async () => {
    await createSession('mine');
    const app = buildApp('u1');
    const first = await app.request(`/web/factory/projects/${projectId}/session-rows`);
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();

    const unchanged = await app.request(`/web/factory/projects/${projectId}/session-rows`, {
      headers: { 'if-none-match': etag ?? '' },
    });
    expect(unchanged.status).toBe(304);
    expect(await unchanged.text()).toBe('');

    await createSession('another');
    const changed = await app.request(`/web/factory/projects/${projectId}/session-rows`, {
      headers: { 'if-none-match': etag ?? '' },
    });
    expect(changed.status).toBe(200);
  });

  it('refuses a view that fails to parse instead of answering another view', async () => {
    for (const query of ['?window=user:0', '?owner=someone', '?window=all:5&window=all:6', '?sort=random']) {
      const res = await buildApp('u1').request(`/web/factory/projects/${projectId}/session-rows${query}`);
      expect(res.status, query).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_session_rows_query' });
    }
  });

  it("leaves out another person's private session", async () => {
    await createSession('mine');
    await createSession('their-private', { userId: 'u2', visibility: 'private' });

    expect(rowOf(await readRows(buildApp('u1')), 'their-private')).toBeUndefined();
    expect(rowOf(await readRows(buildApp('u2')), 'their-private')).toBeDefined();
  });

  it("lists the reader's pinned session first, as deep as its window asks, and keeps its open session in view", async () => {
    for (const sessionId of ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']) await createSession(sessionId);

    const [group] = (await readRows(buildApp('u1'), '?pin=s1&open=s2&window=all:6')).groups;

    expect(group?.rows.map(row => row.session.sessionId)).toEqual(['s1', 's8', 's7', 's6', 's5', 's4', 's2']);
    expect(group).toMatchObject({ total: 8, openIndex: 7 });
  });

  it("does not mark a row working from a run on another person's resource", async () => {
    await createSession('mine');
    await createSession('also-mine');

    const body = await readRows(
      buildApp('u1', {
        running: [
          { threadId: 'mine', resourceId: 'u2' },
          { threadId: 'also-mine', resourceId: 'u1' },
        ],
      }),
    );

    expect(rowOf(body, 'mine')?.status).toBe('idle');
    expect(rowOf(body, 'also-mine')?.status).toBe('working');
  });

  it('marks a parked run and a card waiting on a proposal as waiting', async () => {
    await createCardSession('parked-run', 'Parked');
    await proposeRunFor(await createCardSession('proposed-run', 'Proposed'));
    await createCardSession('quiet-run', 'Quiet');

    const body = await readRows(buildApp('u1', { parked: new Set(['parked-run']) }));

    expect(rowOf(body, 'parked-run')?.status).toBe('waiting');
    expect(rowOf(body, 'proposed-run')?.status).toBe('waiting');
    expect(rowOf(body, 'quiet-run')?.status).toBe('idle');
  });

  it("marks the follower's own session waiting when the card it follows parks on a person", async () => {
    const card = await createCardSession('card-run', 'Followed');
    await createSession('follower');
    await follow(card, 'follower');

    const parked = await readRows(buildApp('u1', { parked: new Set(['card-run']) }));
    expect(rowOf(parked, 'follower')).toMatchObject({ status: 'waiting', waitingSessionId: 'card-run' });

    const quiet = await readRows(buildApp('u1'));
    expect(rowOf(quiet, 'follower')?.status).toBe('idle');
    expect(rowOf(quiet, 'follower')?.waitingSessionId).toBeUndefined();
  });

  it("lists a followed card's sessions under the follower only when the reader reveals them", async () => {
    await createSession('follower');
    await follow(await createCardSession('card-run', 'Followed'), 'follower');

    const revealed = await readRows(buildApp('u1'), '?children=true');
    expect(rowOf(revealed, 'follower')?.childRows?.map(row => row.session.sessionId)).toEqual(['card-run']);

    expect(rowOf(await readRows(buildApp('u1')), 'follower')?.childRows).toBeUndefined();
  });
});

describe('GET /web/factory/projects/:id/session-activity', () => {
  it("counts the project's working and waiting cards and the sessions still coming up", async () => {
    await createCardSession('working-run', 'Working');
    await createCardSession('parked-run', 'Parked');
    await createCardSession('quiet-run', 'Quiet');
    await createSession('starting', { materialized: false });

    const body = await readActivity(
      buildApp('u1', {
        running: [{ threadId: 'working-run', resourceId: 'u1' }],
        parked: new Set(['parked-run']),
      }),
    );

    expect(body).toEqual({
      runningSessionIds: ['working-run'],
      parkedSessionIds: ['parked-run'],
      initializingSessionIds: ['starting'],
      cards: { working: 1, waiting: 1 },
      settling: true,
    });
  });

  it("leaves another person's private sessions out", async () => {
    await createSession('their-starting', { userId: 'u2', visibility: 'private', materialized: false });
    await createSession('their-running', { userId: 'u2', visibility: 'private' });
    const running = [{ threadId: 'their-running', resourceId: 'their-running' }];

    expect(await readActivity(buildApp('u1', { running }))).toMatchObject({
      runningSessionIds: [],
      initializingSessionIds: [],
      settling: false,
    });
    expect(await readActivity(buildApp('u2', { running }))).toMatchObject({
      runningSessionIds: ['their-running'],
      initializingSessionIds: ['their-starting'],
    });
  });
});
