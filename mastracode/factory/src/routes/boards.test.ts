import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { Hono } from 'hono';
import { describe, expect, it, onTestFinished } from 'vitest';

import { compileBoardDefinition } from '../boards/define-board.js';
import type { BoardPhaseDefinition } from '../boards/define-board.js';
import { DRIFT_PROBLEM, ProjectBoardCache } from '../boards/project-boards.js';
import { createBoardRegistry } from '../boards/registry.js';
import type { InstalledBoard } from '../boards/registry.js';
import { seedFromDefinition } from '../boards/stored-board.js';
import { workBoard } from '../boards/work.js';
import { AuditStorage } from '../storage/domains/audit/base.js';
import { AuditDomain } from '../storage/domains/audit/domain.js';
import { StoredBoardsStorage } from '../storage/domains/boards/base.js';
import type { StoredPhaseInput } from '../storage/domains/boards/base.js';
import { WorkItemCommentsStorage } from '../storage/domains/comments/base.js';
import { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import { QueueHealthStorage } from '../storage/domains/queue-health/base.js';
import { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { BoardRoutes } from './boards.js';
import type { RouteAuth } from './route.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';
import { WorkItemRoutes } from './work-items.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const RECHECK_MS = 1000;
const ADMIN = 'admin-user';
const MEMBER = 'member-user';

const released = () => undefined;

/** An app board from `MastraFactory({ boards })`, with a code handler on its working phase. */
function releaseBoard(shippingName = 'Shipping'): InstalledBoard {
  return compileBoardDefinition<string, Record<string, BoardPhaseDefinition<string>>>({
    id: 'release',
    name: 'Release',
    initialPhase: 'queued',
    phases: {
      queued: { name: 'Queued', kind: 'resting', nextPhases: ['shipping'] },
      shipping: {
        name: shippingName,
        kind: 'working',
        runner: { context: 'work' },
        nextPhases: ['shipped'],
        onEnter: { manual: released },
        outcomes: { released: 'shipped' },
      },
      shipped: { name: 'Shipped', kind: 'terminal' },
    },
  });
}

const bugsBoard = {
  key: 'bugs',
  name: 'Bugs',
  phases: [
    { key: 'reported', name: 'Reported', kind: 'resting' },
    { key: 'fixing', name: 'Fixing', kind: 'working', runner: { context: 'work' } },
    { key: 'fixed', name: 'Fixed', kind: 'terminal' },
  ],
};

function definitionError(define: () => unknown): string {
  try {
    define();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('expected the definition to be refused');
}

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('board management routes on %s', backend => {
  async function client(url: string) {
    const storage =
      backend === 'postgres'
        ? new PgFactoryStorage({ id: `board-routes-${randomUUID()}`, connectionString: postgresUrl! })
        : new LibSQLFactoryStorage({ id: `board-routes-${randomUUID()}`, url });
    const domains = {
      projects: storage.registerDomain(new FactoryProjectsStorage()),
      workItems: storage.registerDomain(new WorkItemsStorage()),
      boards: storage.registerDomain(new StoredBoardsStorage()),
      audit: storage.registerDomain(new AuditStorage()),
      comments: storage.registerDomain(new WorkItemCommentsStorage()),
      queueHealth: storage.registerDomain(new QueueHealthStorage()),
    };
    await storage.init();
    onTestFinished(() => storage.close());
    return domains;
  }

  type Client = Awaited<ReturnType<typeof client>>;

  /** One replica: the board and catalog routes over HTTP, with its own board cache and clock. */
  function replica(
    domains: Client,
    orgId: string,
    options: { release?: InstalledBoard; auth?: RouteAuth; clock?: { now: number } } = {},
  ) {
    const clock = options.clock ?? { now: 0 };
    const cache = new ProjectBoardCache({
      seedRegistry: createBoardRegistry({ boards: [options.release ?? releaseBoard()] }),
      storage: domains.boards,
      projects: domains.projects,
      recheckMs: RECHECK_MS,
      now: () => clock.now,
      warn: () => {},
    });
    const auth = options.auth ?? fakeRouteAuth({ isOrganizationAdmin: async (_org, userId) => userId === ADMIN });
    const audit = new AuditDomain({ auth, audit: domains.audit, projects: domains.projects });
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('factoryAuthUser' as never, { workosId: c.req.header('x-user') ?? ADMIN, organizationId: orgId } as never);
      await next();
    });
    mountApiRoutes(app, [
      ...new BoardRoutes({
        auth,
        audit,
        projects: domains.projects,
        workItems: domains.workItems,
        storage: domains.boards,
        boards: cache,
      }).routes(),
      ...new WorkItemRoutes({
        auth,
        audit,
        projects: domains.projects,
        workItems: domains.workItems,
        boardRegistry: cache,
        comments: domains.comments,
        queueHealth: domains.queueHealth,
        liveSessions: { isRunning: () => false, parked: () => undefined, parkedIn: () => [] } as never,
      }).routes(),
    ]);
    async function send(method: string, path: string, body?: unknown, user = ADMIN) {
      const response = await app.request(path, {
        method,
        headers: { 'content-type': 'application/json', 'x-user': user },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    }
    return { cache, clock, send };
  }

  async function setup() {
    let url = ':memory:';
    if (backend === 'libsql') {
      const dir = mkdtempSync(join(tmpdir(), 'factory-board-routes-'));
      onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
      url = `file:${join(dir, 'factory.db')}`;
    }
    const a = await client(url);
    const b = await client(url);
    const orgId = `org-${randomUUID()}`;
    const project = await a.projects.create({ orgId, userId: ADMIN, input: { name: 'Acme' } });
    const base = `/web/factory/projects/${project.id}/boards`;
    const scope = { orgId, factoryProjectId: project.id };
    return { a, b, orgId, scope, base, replicaA: replica(a, orgId) };
  }

  async function getBoard(send: ReturnType<typeof replica>['send'], base: string, key: string) {
    const response = await send('GET', `${base}/${key}`);
    expect(response.status).toBe(200);
    return response.body.board as {
      key: string;
      name: string;
      phases: StoredPhaseInput[];
      revision: number;
      source: string;
      customized: boolean;
      drift: boolean;
      deleted: boolean;
      problems: string[];
    };
  }

  async function catalogBoard(send: ReturnType<typeof replica>['send'], base: string, key: string) {
    const response = await send('GET', base);
    expect(response.status).toBe(200);
    return (response.body.boards as Array<Record<string, any>>).find(board => board.id === key);
  }

  function withPhases(phases: StoredPhaseInput[], edit: (phases: StoredPhaseInput[]) => StoredPhaseInput[]) {
    return edit(structuredClone(phases));
  }

  it('lets an admin create a board, which the catalog lists as stored and records in the audit trail', async () => {
    const { a, orgId, base, replicaA } = await setup();
    const created = await replicaA.send('POST', base, bugsBoard);
    expect(created.status).toBe(201);
    expect(created.body.board).toMatchObject({ key: 'bugs', revision: 1, source: 'stored', customized: false });

    expect(await catalogBoard(replicaA.send, base, 'bugs')).toMatchObject({
      name: 'Bugs',
      source: 'stored',
      initialPhase: 'reported',
      // Unset nextPhases on an API board means every other phase.
      phases: [
        { id: 'reported', nextPhases: ['fixing', 'fixed'] },
        { id: 'fixing', nextPhases: ['reported', 'fixed'] },
        { id: 'fixed', nextPhases: [] },
      ],
    });
    expect((await getBoard(replicaA.send, base, 'bugs')).revision).toBe(1);
    const trail = await a.audit.list({ orgId, actions: ['factory.board.created'] });
    expect(trail.events.map(event => event.targets)).toEqual([[{ type: 'board', id: 'bugs', name: 'Bugs' }]]);
  });

  it('refuses board changes from a member who is not an admin, and leaves the boards as they were', async () => {
    const { base, replicaA } = await setup();
    const work = await getBoard(replicaA.send, base, 'work');

    const create = await replicaA.send('POST', base, bugsBoard, MEMBER);
    expect(create).toMatchObject({ status: 403, body: { error: 'organization_admin_required' } });
    const rename = await replicaA.send(
      'PATCH',
      `${base}/work`,
      { name: 'Renamed', phases: work.phases, expectedRevision: work.revision },
      MEMBER,
    );
    expect(rename.status).toBe(403);
    const remove = await replicaA.send('DELETE', `${base}/release?expectedRevision=1`, undefined, MEMBER);
    expect(remove.status).toBe(403);

    expect(await catalogBoard(replicaA.send, base, 'bugs')).toBeUndefined();
    expect(await getBoard(replicaA.send, base, 'work')).toMatchObject({ name: 'Work', revision: work.revision });
    expect((await getBoard(replicaA.send, base, 'release')).deleted).toBe(false);
    // Reading needs only membership.
    expect((await replicaA.send('GET', `${base}/work`, undefined, MEMBER)).status).toBe(200);
  });

  it('needs no admin in local mode', async () => {
    const { a, orgId, base } = await setup();
    const local = replica(a, orgId, {
      auth: fakeRouteAuth({ enabled: false, isOrganizationAdmin: async () => false }),
    });
    expect((await local.send('POST', base, bugsBoard, MEMBER)).status).toBe(201);
  });

  it("keeps an admin's rename of Work's Building phase when newer code changes Work, and reset adopts the code", async () => {
    const { b, scope, base, replicaA } = await setup();
    const work = await getBoard(replicaA.send, base, 'work');
    expect(work).toMatchObject({ source: 'builtin', customized: false, drift: false });

    const renamed = await replicaA.send('PATCH', `${base}/work`, {
      name: work.name,
      phases: withPhases(work.phases, phases =>
        phases.map(phase => (phase.key === 'execute' ? { ...phase, name: 'Shipping' } : phase)),
      ),
      expectedRevision: work.revision,
    });
    expect(renamed.status).toBe(200);
    expect(renamed.body.board).toMatchObject({ customized: true, drift: false, revision: work.revision + 1 });
    const catalog = await catalogBoard(replicaA.send, base, 'work');
    expect(catalog).toMatchObject({ source: 'builtin', customized: true });
    expect(catalog!.phases.find((phase: { id: string }) => phase.id === 'execute').name).toBe('Shipping');

    // A replica running a newer Factory, whose Work renamed Planning, seeds the project.
    const newerWork = compileBoardDefinition({
      ...workBoard,
      phases: Object.fromEntries(
        Object.entries(workBoard.phases).map(([key, phase]) => [
          key,
          key === 'planning' ? { ...phase, name: 'Designing' } : phase,
        ]),
      ),
    } as never) as InstalledBoard;
    await b.boards.applySeed(scope, [seedFromDefinition(newerWork, 'builtin')]);
    replicaA.clock.now += RECHECK_MS;

    const drifted = await getBoard(replicaA.send, base, 'work');
    expect(drifted).toMatchObject({ customized: true, drift: true });
    expect(drifted.phases.find(phase => phase.key === 'execute')!.name).toBe('Shipping');
    expect(drifted.phases.find(phase => phase.key === 'planning')!.name).toBe('Planning');
    expect((await catalogBoard(replicaA.send, base, 'work'))!.problems).toEqual([DRIFT_PROBLEM]);

    const reset = await replicaA.send('POST', `${base}/work/reset`, { expectedRevision: drifted.revision });
    expect(reset.status).toBe(200);
    expect(reset.body.board).toMatchObject({ customized: false, drift: false, problems: [] });
    expect(reset.body.board.phases.find((phase: StoredPhaseInput) => phase.key === 'execute').name).toBe('Building');
    expect((await catalogBoard(replicaA.send, base, 'work'))!.customized).toBe(false);
  });

  it('refuses an invalid definition with the message defineBoard() gives', async () => {
    const { base, replicaA } = await setup();
    const phases = [
      { key: 'build', name: 'Build', kind: 'working' as const, runner: { context: 'work' } },
      { key: 'done', name: 'Done', kind: 'terminal' as const },
    ];
    const expected = definitionError(() =>
      compileBoardDefinition({
        id: 'broken',
        name: 'Broken',
        initialPhase: 'build',
        phases: {
          build: { name: 'Build', kind: 'working', runner: { context: 'work' }, nextPhases: ['done'] },
          done: { name: 'Done', kind: 'terminal' },
        },
      }),
    );
    const response = await replicaA.send('POST', base, { key: 'broken', name: 'Broken', phases });
    expect(response).toEqual({ status: 422, body: { error: 'invalid_board', message: expected } });
    expect(await catalogBoard(replicaA.send, base, 'broken')).toBeUndefined();
  });

  it("refuses removing the terminal phase Work's code closes finished issues into", async () => {
    const { base, replicaA } = await setup();
    const work = await getBoard(replicaA.send, base, 'work');
    const response = await replicaA.send('PATCH', `${base}/work`, {
      name: work.name,
      phases: withPhases(work.phases, phases =>
        phases
          .filter(phase => phase.key !== 'done')
          .map(phase => ({ ...phase, nextPhases: phase.nextPhases?.filter(next => next !== 'done') ?? null })),
      ),
      expectedRevision: work.revision,
    });
    expect(response.status).toBe(422);
    expect(response.body.error).toBe('invalid_board');
    expect(response.body.message).toMatch(/"done"/);
    expect((await getBoard(replicaA.send, base, 'work')).revision).toBe(work.revision);
  });

  it("refuses removing a phase an app board's code outcomes lead to", async () => {
    const { base, replicaA } = await setup();
    const release = await getBoard(replicaA.send, base, 'release');
    const response = await replicaA.send('PATCH', `${base}/release`, {
      name: release.name,
      phases: withPhases(release.phases, phases =>
        phases
          .filter(phase => phase.key !== 'shipped')
          .map(phase => ({ ...phase, nextPhases: phase.nextPhases?.filter(next => next !== 'shipped') ?? null })),
      ),
      expectedRevision: release.revision,
    });
    expect(response).toEqual({
      status: 422,
      body: {
        error: 'invalid_board',
        message: 'Phase "shipping" targets undefined phase "shipped". The board\'s code behaviors depend on it.',
      },
    });
    expect((await getBoard(replicaA.send, base, 'release')).revision).toBe(release.revision);
  });

  it('refuses a runner skill that does not exist, and warns about a review skill outside review', async () => {
    const { base, replicaA } = await setup();
    const withSkill = (skill: string) => ({
      ...bugsBoard,
      phases: bugsBoard.phases.map(phase =>
        phase.key === 'fixing' ? { ...phase, runner: { context: 'work', skill } } : phase,
      ),
    });
    const unknown = await replicaA.send('POST', base, withSkill('no-such-skill'));
    expect(unknown.status).toBe(422);
    expect(unknown.body).toMatchObject({ error: 'unknown_skill' });
    expect(unknown.body.message).toMatch(/no-such-skill/);

    const review = await replicaA.send('POST', base, withSkill('factory-review'));
    expect(review.status).toBe(201);
    expect(review.body.board.problems).toEqual([
      expect.stringMatching(/review skills only load in the 'review' context/),
    ]);
    expect((await catalogBoard(replicaA.send, base, 'bugs'))!.problems).toEqual(review.body.board.problems);
  });

  it('lets only one of two edits made from the same revision on two replicas land', async () => {
    const { b, orgId, base, replicaA } = await setup();
    const replicaB = replica(b, orgId);
    const work = await getBoard(replicaA.send, base, 'work');
    const edit = (name: string) => ({ name, phases: work.phases, expectedRevision: work.revision });
    const results = await Promise.all([
      replicaA.send('PATCH', `${base}/work`, edit('Work A')),
      replicaB.send('PATCH', `${base}/work`, edit('Work B')),
    ]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    expect(results.find(result => result.status === 409)!.body.error).toBe('revision_mismatch');
    const winner = results.find(result => result.status === 200)!.body.board.name;
    expect(await getBoard(replicaA.send, base, 'work')).toMatchObject({ name: winner, revision: work.revision + 1 });
  });

  it('refuses removing or changing the kind of a phase cards sit in, and allows renaming it', async () => {
    const { a, scope, base, replicaA } = await setup();
    for (const title of ['First', 'Second']) {
      await a.workItems.upsert({ ...scope, userId: ADMIN, input: { title, board: 'work', stages: ['review'] } });
    }
    const work = await getBoard(replicaA.send, base, 'work');
    const patch = (phases: StoredPhaseInput[]) =>
      replicaA.send('PATCH', `${base}/work`, { name: work.name, phases, expectedRevision: work.revision });

    const removed = await patch(
      withPhases(work.phases, phases =>
        phases
          .filter(phase => phase.key !== 'review')
          .map(phase => ({ ...phase, nextPhases: phase.nextPhases?.filter(next => next !== 'review') ?? null })),
      ),
    );
    expect(removed.status).toBe(409);
    expect(removed.body).toMatchObject({ error: 'phase_in_use', phases: { review: 2 } });

    const rekinded = await patch(
      withPhases(work.phases, phases =>
        phases.map(phase =>
          phase.key === 'review'
            ? { key: 'review', name: phase.name, kind: 'resting', nextPhases: phase.nextPhases }
            : phase,
        ),
      ),
    );
    expect(rekinded).toMatchObject({ status: 409, body: { error: 'phase_in_use', phases: { review: 2 } } });
    expect((await getBoard(replicaA.send, base, 'work')).revision).toBe(work.revision);

    const renamed = await patch(
      withPhases(work.phases, phases =>
        phases.map(phase => (phase.key === 'review' ? { ...phase, name: 'Checking' } : phase)),
      ),
    );
    expect(renamed.status).toBe(200);
  });

  it('refuses deleting a board that still has cards, and deleting a built-in board', async () => {
    const { a, scope, base, replicaA } = await setup();
    await replicaA.send('POST', base, bugsBoard);
    await a.workItems.upsert({ ...scope, userId: ADMIN, input: { title: 'Crash', board: 'bugs', stages: ['fixing'] } });
    const inUse = await replicaA.send('DELETE', `${base}/bugs?expectedRevision=1`);
    expect(inUse).toMatchObject({ status: 409, body: { error: 'board_in_use', cards: 1 } });

    const work = await getBoard(replicaA.send, base, 'work');
    const builtin = await replicaA.send('DELETE', `${base}/work?expectedRevision=${work.revision}`);
    expect(builtin).toMatchObject({ status: 409, body: { error: 'builtin_board' } });
    expect(await catalogBoard(replicaA.send, base, 'work')).toBeDefined();
  });

  it('keeps the first phase of a board defined in code first', async () => {
    const { base, replicaA } = await setup();
    const work = await getBoard(replicaA.send, base, 'work');
    const response = await replicaA.send('PATCH', `${base}/work`, {
      name: work.name,
      phases: [{ key: 'inbox', name: 'Inbox', kind: 'resting', nextPhases: null }, ...work.phases],
      expectedRevision: work.revision,
    });
    expect(response).toMatchObject({ status: 422, body: { error: 'initial_phase_locked' } });

    // A board created through the API may change its first phase.
    await replicaA.send('POST', base, bugsBoard);
    const bugs = await getBoard(replicaA.send, base, 'bugs');
    const reordered = await replicaA.send('PATCH', `${base}/bugs`, {
      name: bugs.name,
      phases: [{ key: 'triaged', name: 'Triaged', kind: 'resting' }, ...bugs.phases],
      expectedRevision: bugs.revision,
    });
    expect(reordered.status).toBe(200);
    expect((await catalogBoard(replicaA.send, base, 'bugs'))!.initialPhase).toBe('triaged');
  });

  it('keeps a deleted app board deleted after a restart, until reset restores it', async () => {
    const { a, orgId, base, replicaA } = await setup();
    const release = await getBoard(replicaA.send, base, 'release');
    expect(release.source).toBe('app');
    const deleted = await replicaA.send('DELETE', `${base}/release?expectedRevision=${release.revision}`);
    expect(deleted.status).toBe(204);
    expect(await catalogBoard(replicaA.send, base, 'release')).toBeUndefined();

    // A restart is a new process: a fresh cache that seeds the project again.
    const restarted = replica(a, orgId);
    expect(await catalogBoard(restarted.send, base, 'release')).toBeUndefined();
    const tombstone = await getBoard(restarted.send, base, 'release');
    expect(tombstone.deleted).toBe(true);

    const reset = await restarted.send('POST', `${base}/release/reset`, { expectedRevision: tombstone.revision });
    expect(reset.status).toBe(200);
    expect(reset.body.board).toMatchObject({ deleted: false, customized: false });
    expect(await catalogBoard(restarted.send, base, 'release')).toMatchObject({ source: 'app' });
  });

  it('has nothing to reset a board created through the API to', async () => {
    const { base, replicaA } = await setup();
    await replicaA.send('POST', base, bugsBoard);
    const response = await replicaA.send('POST', `${base}/bugs/reset`, { expectedRevision: 1 });
    expect(response).toMatchObject({ status: 409, body: { error: 'not_seeded' } });
  });

  it("shows an edit made on one replica in another replica's catalog after the recheck window", async () => {
    const { b, orgId, base, replicaA } = await setup();
    const replicaB = replica(b, orgId);
    expect((await catalogBoard(replicaB.send, base, 'review'))!.name).toBe('Review');

    const review = await getBoard(replicaA.send, base, 'review');
    const renamed = await replicaA.send('PATCH', `${base}/review`, {
      name: 'Code review',
      phases: review.phases,
      expectedRevision: review.revision,
    });
    expect(renamed.status).toBe(200);
    expect((await catalogBoard(replicaA.send, base, 'review'))!.name).toBe('Code review');

    replicaB.clock.now += RECHECK_MS - 1;
    expect((await catalogBoard(replicaB.send, base, 'review'))!.name).toBe('Review');
    replicaB.clock.now += 1;
    expect((await catalogBoard(replicaB.send, base, 'review'))!.name).toBe('Code review');
  });
});
