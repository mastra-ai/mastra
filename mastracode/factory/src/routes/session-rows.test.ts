import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import type { SessionActivityResponse, SessionRow, SessionRowsResponse } from './contracts.js';
import { createProjectSessionsReader } from './project-sessions.js';
import { buildSourceControlSessionRoutes } from './source-control-sessions.js';
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
  authEnabled?: boolean;
  sessionOnThread?: ReadonlyMap<string, string>;
}

function buildApp(
  viewer: string,
  { running = [], parked = new Set(), authEnabled = true, sessionOnThread = new Map() }: LiveState = {},
) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('factoryAuthUser' as never, { workosId: c.req.header('x-viewer') ?? viewer, organizationId: ORG } as never);
    await next();
  });
  const auth = fakeRouteAuth({ enabled: authEnabled });
  const projectSessions = createProjectSessionsReader({ sourceControls: [sourceControl], workItems: seed.workItems });
  mountApiRoutes(
    app as never,
    new WorkItemRoutes({
      auth,
      audit: { emit: async () => {} },
      projects: seed.projects,
      workItems: seed.workItems,
      queueHealth: seed.queueHealth,
      liveSessions: {
        parked: sessionId => (parked.has(sessionId) ? PARKED_RUN : undefined),
        parkedIn: () => [...parked].map(sessionId => ({ sessionId, run: PARKED_RUN })),
        sessionOnThread: threadId => sessionOnThread.get(threadId),
      },
      projectSessions,
      activeRuns: () => running,
    }).routes(),
  );
  mountApiRoutes(
    app as never,
    buildSourceControlSessionRoutes({
      auth,
      sourceControls: [sourceControl],
      projects: seed.projects,
      memorySettings: seed.memorySettings,
      projectSessions,
    }),
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

async function createCardSession(
  sessionId: string,
  title: string,
  session: { userId?: string; visibility?: 'org' | 'private'; materialized?: boolean } = {},
): Promise<Card> {
  const branch = `factory/${sessionId}`;
  await createSession(sessionId, { ...session, branch });
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

async function responsesFor(app: Hono, viewer: string): Promise<string[]> {
  return Promise.all(
    ['session-rows?groupBy=board&children=true', 'session-rows', 'session-activity', 'sessions'].map(async path => {
      const res = await app.request(`/web/factory/projects/${projectId}/${path}`, { headers: { 'x-viewer': viewer } });
      expect(res.status, path).toBe(200);
      return res.text();
    }),
  );
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

    expect(body).toMatchObject({ total: 3, matching: 3, boards: ['work'] });
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
    for (const query of [
      '?window=user:0',
      '?owner=someone',
      '?window=all:5&window=all:6',
      '?sort=random',
      '?source=github',
    ]) {
      const res = await buildApp('u1').request(`/web/factory/projects/${projectId}/session-rows${query}`);
      expect(res.status, query).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_session_rows_query' });
    }
  });

  it('keeps the rows of the source the reader filters on', async () => {
    await createSession('web');
    await createSession('thread', { branch: 'slack/1794960854.774509' });
    await createCardSession('card-run', 'Fix login');

    const ids = async (source: string) =>
      (await readRows(buildApp('u1'), `?source=${encodeURIComponent(source)}`)).groups.flatMap(group =>
        group.rows.map(row => row.session.sessionId),
      );

    expect(await ids('slack')).toEqual(['thread']);
    expect(await ids('user')).toEqual(['web']);
    expect(await ids('board:work')).toEqual(['card-run']);
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

  it("marks a person's session working while it runs on a thread it opened after its first", async () => {
    await createSession('mine');

    const body = await readRows(
      buildApp('u1', {
        running: [{ threadId: 'second-thread', resourceId: 'u1' }],
        sessionOnThread: new Map([['second-thread', 'mine']]),
      }),
    );

    expect(rowOf(body, 'mine')?.status).toBe('working');
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

  it("marks a person's session waiting while its run waits on their answer", async () => {
    await createSession('asking');

    const body = await readRows(buildApp('u1', { parked: new Set(['asking']) }));

    expect(rowOf(body, 'asking')).toMatchObject({ origin: 'user', status: 'waiting' });
  });

  it("leaves a teammate's session waiting on its owner's answer off another reader's waiting", async () => {
    await createSession('their-asking', { userId: 'u2' });
    const live = { running: [{ threadId: 'their-asking', resourceId: 'u2' }], parked: new Set(['their-asking']) };

    expect(rowOf(await readRows(buildApp('u1', live)), 'their-asking')?.status).toBe('idle');
    expect(rowOf(await readRows(buildApp('u2', live)), 'their-asking')?.status).toBe('waiting');
  });

  it('marks a never set up session initializing only while a run waits on its setup', async () => {
    await createSession('never-set-up', { materialized: false });

    expect(rowOf(await readRows(buildApp('u1')), 'never-set-up')?.status).toBe('idle');

    const running = buildApp('u1', { running: [{ threadId: 'never-set-up', resourceId: 'u1' }] });
    expect(rowOf(await readRows(running), 'never-set-up')?.status).toBe('initializing');
  });

  it('marks a session waiting when its run asks a person before its sandbox ever came up', async () => {
    await createSession('asking-first', { materialized: false });
    await createCardSession('card-asking-first', 'Asks first', { materialized: false });

    const body = await readRows(
      buildApp('u1', {
        running: [
          { threadId: 'asking-first', resourceId: 'u1' },
          { threadId: 'card-asking-first', resourceId: 'u1' },
        ],
        parked: new Set(['asking-first', 'card-asking-first']),
      }),
    );

    expect(rowOf(body, 'asking-first')?.status).toBe('waiting');
    expect(rowOf(body, 'card-asking-first')?.status).toBe('waiting');
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
  it("answers each live card's status and counts the working and waiting cards", async () => {
    const working = await createCardSession('working-run', 'Working');
    const parked = await createCardSession('parked-run', 'Parked');
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
      cardStatuses: { [working.id]: 'working', [parked.id]: 'waiting' },
      sessionHeldCardIds: [working.id, parked.id].toSorted((a, b) => a.localeCompare(b)),
      cards: { working: 1, waiting: 1 },
    });
  });

  it("answers each card the status of its sidebar row, whatever its sessions' own statuses", async () => {
    const proposed = await createCardSession('proposed-run', 'Proposed while running');
    await proposeRunFor(proposed);
    const proposedIdle = await createCardSession('idle-run', 'Proposed while idle');
    await proposeRunFor(proposedIdle);
    await createSession('lead-run', { branch: 'factory/lead-run' });
    await createSession('coming-up', { branch: 'factory/coming-up', materialized: false });
    const { item: twoSessions } = await seed.workItems.upsert({
      orgId: ORG,
      userId: 'u1',
      factoryProjectId: projectId,
      input: {
        title: 'One working, one coming up',
        stages: ['intake'],
        sessions: {
          work: { sessionId: 'lead-run', branch: 'factory/lead-run', threadId: 'lead-run' },
          review: { sessionId: 'coming-up', branch: 'factory/coming-up', threadId: 'coming-up' },
        },
      },
    });
    const app = buildApp('u1', {
      running: [
        { threadId: 'proposed-run', resourceId: 'u1' },
        { threadId: 'lead-run', resourceId: 'u1' },
      ],
    });

    const [rows, activity] = await Promise.all([readRows(app), readActivity(app)]);
    const cardRow = (cardId: string) =>
      rows.groups.flatMap(group => group.rows).find(row => row.itemId === cardId)?.status;

    expect(cardRow(proposed.id)).toBe('waiting');
    expect(cardRow(proposedIdle.id)).toBe('waiting');
    expect(cardRow(twoSessions.id)).toBe('working');
    expect(activity.cardStatuses).toEqual({
      [proposed.id]: 'waiting',
      [proposedIdle.id]: 'waiting',
      [twoSessions.id]: 'working',
    });
    expect(activity.cards).toEqual({ working: 1, waiting: 2 });
    expect(activity.sessionHeldCardIds).toEqual([proposed.id, twoSessions.id].toSorted((a, b) => a.localeCompare(b)));
  });

  it('answers a card whose setup never finished its own status once the run is over', async () => {
    const card = await createCardSession('setup-failed', 'Clone failed', { materialized: false });
    await proposeRunFor(card);
    const app = buildApp('u1');

    const [rows, activity] = await Promise.all([readRows(app), readActivity(app)]);

    expect(rowOf(rows, 'setup-failed')?.status).toBe('waiting');
    expect(activity.cardStatuses).toEqual({ [card.id]: 'waiting' });
    expect(activity.sessionHeldCardIds).toEqual([]);
  });

  it("leaves another person's private sessions out", async () => {
    await createSession('their-running', { userId: 'u2', visibility: 'private' });
    const running = [{ threadId: 'their-running', resourceId: 'their-running' }];

    expect((await readActivity(buildApp('u1', { running }))).runningSessionIds).toEqual([]);
    expect((await readActivity(buildApp('u2', { running }))).runningSessionIds).toEqual(['their-running']);
  });
});

describe.each([{ authEnabled: true }, { authEnabled: false }])(
  'a private session, auth enabled: $authEnabled',
  ({ authEnabled }) => {
    const privateIds = ['their-card-run', 'their-draft', 'their-starting'];

    it("reaches only its owner through rows and the session list; activity names it to others only as a card's session", async () => {
      await createSession('team-session');
      await createCardSession('their-card-run', 'Their card', { userId: 'u2', visibility: 'private' });
      await createSession('their-draft', { userId: 'u2', visibility: 'private' });
      await createSession('their-starting', { userId: 'u2', visibility: 'private', materialized: false });
      const app = buildApp('u2', {
        authEnabled,
        running: [
          { threadId: 'their-card-run', resourceId: projectId },
          { threadId: 'their-draft', resourceId: 'u2' },
        ],
        parked: new Set(['their-card-run']),
      });

      const [revealedRows, rows, activity, sessions] = await responsesFor(app, 'u2');
      for (const id of privateIds) {
        expect(revealedRows).toContain(`"${id}"`);
        expect(rows).toContain(`"${id}"`);
        expect(sessions).toContain(`"${id}"`);
      }
      expect(JSON.parse(activity ?? '')).toMatchObject({
        runningSessionIds: ['their-card-run', 'their-draft'],
        parkedSessionIds: ['their-card-run'],
      });

      for (const viewer of ['u1', 'u3']) {
        const [revealedRowsSeen, rowsSeen, activitySeen, sessionsSeen] = await responsesFor(app, viewer);
        expect(sessionsSeen, viewer).toContain('"team-session"');
        for (const body of [revealedRowsSeen, rowsSeen, sessionsSeen]) {
          for (const id of privateIds) expect(body, viewer).not.toContain(id);
        }
        expect(JSON.parse(activitySeen ?? ''), viewer).toMatchObject({
          runningSessionIds: ['their-card-run'],
          parkedSessionIds: ['their-card-run'],
          cardStatuses: {},
          sessionHeldCardIds: [],
        });
      }
    });
  },
);
