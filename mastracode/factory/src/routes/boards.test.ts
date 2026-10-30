import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { Hono } from 'hono';
import { describe, expect, it, onTestFinished } from 'vitest';

import { compileBoardDefinition } from '../boards/define-board.js';
import { ProjectBoardCache } from '../boards/project-boards.js';
import { createBoardRegistry } from '../boards/registry.js';
import type { InstalledBoard } from '../boards/registry.js';
import { boardDefinitionOf } from '../boards/stored-board.js';
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

/** An app board from `MastraFactory({ boards })`. */
function releaseBoard(): InstalledBoard {
  return compileBoardDefinition({
    id: 'release',
    name: 'Release',
    initialPhase: 'queued',
    phases: {
      queued: { name: 'Queued', kind: 'resting', nextPhases: ['shipping'] },
      shipping: { name: 'Shipping', kind: 'working', runner: { context: 'work' }, nextPhases: ['shipped'] },
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
} satisfies { key: string; name: string; phases: StoredPhaseInput[] };

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
  function replica(domains: Client, orgId: string, options: { auth?: RouteAuth; clock?: { now: number } } = {}) {
    const clock = options.clock ?? { now: 0 };
    const cache = new ProjectBoardCache({
      codeRegistry: createBoardRegistry({ boards: [releaseBoard()] }),
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
      revision: number | null;
      source: string;
      editable: boolean;
      problems: string[];
    };
  }

  async function catalogBoard(send: ReturnType<typeof replica>['send'], base: string, key: string) {
    const response = await send('GET', base);
    expect(response.status).toBe(200);
    return (response.body.boards as Array<Record<string, any>>).find(board => board.id === key);
  }

  it('refuses changing a built-in or app board, which are defined in code, and stores nothing', async () => {
    const { a, scope, base, replicaA } = await setup();
    const work = await getBoard(replicaA.send, base, 'work');
    const refused = (key: string) => ({
      status: 409,
      body: { error: 'code_board', message: `Board "${key}" is defined in code and can't be edited here.` },
    });

    expect(
      await replicaA.send('PATCH', `${base}/work`, { name: 'Renamed', phases: work.phases, expectedRevision: 1 }),
    ).toEqual(refused('work'));
    expect(await replicaA.send('DELETE', `${base}/work?expectedRevision=1`)).toEqual(refused('work'));
    expect(await replicaA.send('DELETE', `${base}/release?expectedRevision=1`)).toEqual(refused('release'));
    expect(await replicaA.send('POST', base, { ...bugsBoard, key: 'release' })).toEqual(refused('release'));

    expect(await a.boards.list(scope)).toEqual([]);
    expect(await a.boards.readVersion(scope)).toBeNull();
    expect((await catalogBoard(replicaA.send, base, 'work'))!.name).toBe('Work');
    expect((await catalogBoard(replicaA.send, base, 'release'))!.name).toBe('Release');
  });

  it('lists code boards as read-only and boards the project created as editable', async () => {
    const { base, replicaA } = await setup();
    expect((await replicaA.send('POST', base, bugsBoard)).status).toBe(201);
    const catalog = await replicaA.send('GET', base);
    expect(
      (catalog.body.boards as Array<Record<string, unknown>>).map(board => [board.id, board.source, board.editable]),
    ).toEqual([
      ['work', 'builtin', false],
      ['review', 'builtin', false],
      ['release', 'app', false],
      ['bugs', 'stored', true],
    ]);
  });

  it("returns a code board's definition read-only, with no revision", async () => {
    const { base, replicaA } = await setup();
    const work = await getBoard(replicaA.send, base, 'work');
    const { description, ...definition } = boardDefinitionOf(workBoard);
    expect(work).toEqual({
      ...definition,
      description: description ?? null,
      revision: null,
      source: 'builtin',
      editable: false,
      problems: [],
    });
    expect(work.phases.map(phase => [phase.key, phase.nextPhases])).toEqual(
      Object.keys(workBoard.phases).map(key => [
        key,
        [...workBoard.phases[key as keyof typeof workBoard.phases].nextPhases],
      ]),
    );
    expect(await getBoard(replicaA.send, base, 'release')).toMatchObject({
      source: 'app',
      editable: false,
      revision: null,
    });
  });

  it("lets an admin create, edit and delete the project's own board, recording each in the audit trail", async () => {
    const { a, orgId, base, replicaA } = await setup();
    const created = await replicaA.send('POST', base, bugsBoard);
    expect(created.status).toBe(201);
    expect(created.body.board).toMatchObject({ key: 'bugs', revision: 1, source: 'stored', editable: true });
    expect(await catalogBoard(replicaA.send, base, 'bugs')).toMatchObject({
      name: 'Bugs',
      initialPhase: 'reported',
      // Unset nextPhases on a stored board means every other phase.
      phases: [
        { id: 'reported', nextPhases: ['fixing', 'fixed'] },
        { id: 'fixing', nextPhases: ['reported', 'fixed'] },
        { id: 'fixed', nextPhases: [] },
      ],
    });

    // A stored board may change which phase comes first.
    const edited = await replicaA.send('PATCH', `${base}/bugs`, {
      name: 'Bug reports',
      phases: [{ key: 'triaged', name: 'Triaged', kind: 'resting' }, ...bugsBoard.phases],
      expectedRevision: 1,
    });
    expect(edited.status).toBe(200);
    expect(edited.body.board).toMatchObject({ name: 'Bug reports', revision: 2 });
    expect((await catalogBoard(replicaA.send, base, 'bugs'))!.initialPhase).toBe('triaged');

    expect((await replicaA.send('DELETE', `${base}/bugs?expectedRevision=2`)).status).toBe(204);
    expect(await catalogBoard(replicaA.send, base, 'bugs')).toBeUndefined();
    expect((await replicaA.send('GET', `${base}/bugs`)).status).toBe(404);

    const trail = await a.audit.list({
      orgId,
      actions: ['factory.board.created', 'factory.board.updated', 'factory.board.deleted'],
    });
    expect(trail.events.map(event => event.action).sort()).toEqual([
      'factory.board.created',
      'factory.board.deleted',
      'factory.board.updated',
    ]);
  });

  it('refuses board changes from a member who is not an admin, and leaves the boards as they were', async () => {
    const { base, replicaA } = await setup();
    await replicaA.send('POST', base, bugsBoard);

    const create = await replicaA.send('POST', base, { ...bugsBoard, key: 'hotfix' }, MEMBER);
    expect(create).toMatchObject({ status: 403, body: { error: 'organization_admin_required' } });
    const rename = await replicaA.send(
      'PATCH',
      `${base}/bugs`,
      { name: 'Renamed', phases: bugsBoard.phases, expectedRevision: 1 },
      MEMBER,
    );
    expect(rename.status).toBe(403);
    expect((await replicaA.send('DELETE', `${base}/bugs?expectedRevision=1`, undefined, MEMBER)).status).toBe(403);

    expect(await catalogBoard(replicaA.send, base, 'hotfix')).toBeUndefined();
    expect(await getBoard(replicaA.send, base, 'bugs')).toMatchObject({ name: 'Bugs', revision: 1 });
    // Reading needs only membership.
    expect((await replicaA.send('GET', `${base}/bugs`, undefined, MEMBER)).status).toBe(200);
  });

  it('needs no admin in local mode', async () => {
    const { a, orgId, base } = await setup();
    const local = replica(a, orgId, {
      auth: fakeRouteAuth({ enabled: false, isOrganizationAdmin: async () => false }),
    });
    expect((await local.send('POST', base, bugsBoard, MEMBER)).status).toBe(201);
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
    await replicaA.send('POST', base, bugsBoard);
    const replicaB = replica(b, orgId);
    const edit = (name: string) => ({ name, phases: bugsBoard.phases, expectedRevision: 1 });
    const results = await Promise.all([
      replicaA.send('PATCH', `${base}/bugs`, edit('Bugs A')),
      replicaB.send('PATCH', `${base}/bugs`, edit('Bugs B')),
    ]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    expect(results.find(result => result.status === 409)!.body.error).toBe('revision_mismatch');
    const winner = results.find(result => result.status === 200)!.body.board.name;
    expect(await getBoard(replicaA.send, base, 'bugs')).toMatchObject({ name: winner, revision: 2 });
  });

  it('refuses removing or changing the kind of a phase cards sit in, and allows renaming it', async () => {
    const { a, scope, base, replicaA } = await setup();
    await replicaA.send('POST', base, bugsBoard);
    for (const title of ['First', 'Second']) {
      await a.workItems.upsert({ ...scope, userId: ADMIN, input: { title, board: 'bugs', stages: ['fixing'] } });
    }
    const patch = (phases: StoredPhaseInput[]) =>
      replicaA.send('PATCH', `${base}/bugs`, { name: 'Bugs', phases, expectedRevision: 1 });

    const removed = await patch(bugsBoard.phases.filter(phase => phase.key !== 'fixing'));
    expect(removed.status).toBe(409);
    expect(removed.body).toMatchObject({ error: 'phase_in_use', phases: { fixing: 2 } });

    const rekinded = await patch(
      bugsBoard.phases.map(phase =>
        phase.key === 'fixing' ? { key: 'fixing', name: phase.name, kind: 'resting' } : phase,
      ),
    );
    expect(rekinded).toMatchObject({ status: 409, body: { error: 'phase_in_use', phases: { fixing: 2 } } });
    expect((await getBoard(replicaA.send, base, 'bugs')).revision).toBe(1);

    const renamed = await patch(
      bugsBoard.phases.map(phase => (phase.key === 'fixing' ? { ...phase, name: 'Patching' } : phase)),
    );
    expect(renamed.status).toBe(200);
  });

  it('refuses deleting a board that still has cards', async () => {
    const { a, scope, base, replicaA } = await setup();
    await replicaA.send('POST', base, bugsBoard);
    await a.workItems.upsert({ ...scope, userId: ADMIN, input: { title: 'Crash', board: 'bugs', stages: ['fixing'] } });
    const inUse = await replicaA.send('DELETE', `${base}/bugs?expectedRevision=1`);
    expect(inUse).toMatchObject({ status: 409, body: { error: 'board_in_use', cards: 1 } });
    expect(await catalogBoard(replicaA.send, base, 'bugs')).toBeDefined();
  });

  it("shows a board one replica created on another replica's routes after the recheck window", async () => {
    const { b, orgId, base, replicaA } = await setup();
    const replicaB = replica(b, orgId);
    expect(await catalogBoard(replicaB.send, base, 'bugs')).toBeUndefined();

    await replicaA.send('POST', base, bugsBoard);
    expect(await catalogBoard(replicaB.send, base, 'bugs')).toBeUndefined();
    replicaB.clock.now += RECHECK_MS;
    expect(await catalogBoard(replicaB.send, base, 'bugs')).toMatchObject({ name: 'Bugs', editable: true });
  });
});
