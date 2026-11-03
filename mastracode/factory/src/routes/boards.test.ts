import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { Hono } from 'hono';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

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
import { SourceControlStorage } from '../storage/domains/source-control/base.js';
import { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { BoardRoutes } from './boards.js';
import { ProjectRoutes } from './projects.js';
import type { RouteAuth } from './route.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';
import { WorkItemRoutes } from './work-items.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const RECHECK_MS = 1000;
const ADMIN = 'admin-user';
const MEMBER = 'member-user';
const SIGNED_OUT = 'signed-out';

/** An app board from `MastraFactory({ boards })`. */
function releaseBoard(queued = 'Queued'): InstalledBoard {
  return compileBoardDefinition({
    id: 'release',
    name: 'Release',
    initialPhase: 'queued',
    phases: {
      queued: { name: queued, kind: 'resting', nextPhases: ['shipping'] },
      shipping: { name: 'Shipping', kind: 'working', runner: { context: 'work' }, nextPhases: ['shipped'] },
      shipped: { name: 'Shipped', kind: 'terminal' },
    },
  });
}

const EFFORT_LOW = {
  operator: 'AND' as const,
  conditions: [{ field: 'item.labels', operator: 'contains' as const, value: 'effort:low' }],
};

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
      sourceControl: storage.registerDomain(new SourceControlStorage()),
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
    options: { auth?: RouteAuth; clock?: { now: number }; release?: InstalledBoard | null } = {},
  ) {
    const clock = options.clock ?? { now: 0 };
    const cache = new ProjectBoardCache({
      codeRegistry: createBoardRegistry({
        boards: options.release === null ? [] : [options.release ?? releaseBoard()],
      }),
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
      const user = c.req.header('x-user') ?? ADMIN;
      if (user !== SIGNED_OUT) c.set('factoryAuthUser' as never, { workosId: user, organizationId: orgId } as never);
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
      ...new ProjectRoutes({
        auth,
        projects: domains.projects,
        sourceControl: domains.sourceControl,
        boards: cache,
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

  /** The Work board's stored copy with one phase changed, as an admin would PATCH it. */
  function editPhase(
    work: { name: string; phases: StoredPhaseInput[]; revision: number | null },
    key: string,
    edit: (phase: StoredPhaseInput) => StoredPhaseInput | undefined,
  ) {
    return {
      name: work.name,
      phases: work.phases.flatMap(phase => (phase.key === key ? (edit(phase) ?? []) : [phase])),
      expectedRevision: work.revision,
    };
  }

  async function catalogBoard(send: ReturnType<typeof replica>['send'], base: string, key: string) {
    const response = await send('GET', base);
    expect(response.status).toBe(200);
    return (response.body.boards as Array<Record<string, any>>).find(board => board.id === key);
  }

  it("refuses creating over a built-in or app board, deleting the Work board, and any write under the retired Review board's key, and stores nothing else", async () => {
    const { a, scope, base, replicaA } = await setup();
    const refused = (key: string, message: string) => ({ status: 409, body: { error: 'code_board', message } });
    const deleteMessage = (key: string) =>
      `Board "${key}" is defined in code and can't be deleted; reset it to its default instead.`;
    const createMessage = (key: string) => `Board "${key}" is defined in code and can't be created over here.`;
    // The project's first load stores its Work and app boards.
    await getBoard(replicaA.send, base, 'work');

    expect(await replicaA.send('DELETE', `${base}/work?expectedRevision=1`)).toEqual(
      refused('work', deleteMessage('work')),
    );
    expect(await replicaA.send('POST', base, { ...bugsBoard, key: 'release' })).toEqual(
      refused('release', createMessage('release')),
    );
    expect(await replicaA.send('POST', base, { ...bugsBoard, key: 'work' })).toEqual(
      refused('work', createMessage('work')),
    );
    // The retired Review board's key stays reserved: its stored cards read as Work.
    const reserved = {
      status: 409,
      body: {
        error: 'reserved_board',
        message: 'Board "review" is reserved: the retired Review board\'s cards now live on Work.',
      },
    };
    expect(await replicaA.send('POST', base, { ...bugsBoard, key: 'review' })).toEqual(reserved);
    expect(
      await replicaA.send('PATCH', `${base}/review`, {
        name: 'Renamed',
        phases: bugsBoard.phases,
        expectedRevision: 1,
      }),
    ).toEqual(reserved);
    expect(await replicaA.send('POST', `${base}/review/reset`, { expectedRevision: 1 })).toEqual(reserved);
    expect(await replicaA.send('DELETE', `${base}/review?expectedRevision=1`)).toEqual(reserved);

    // The project's first load stored its Work and app boards; no refusal wrote anything.
    expect((await a.boards.list(scope)).map(row => [row.key, row.revision])).toEqual([
      ['work', 1],
      ['release', 1],
    ]);
    expect((await catalogBoard(replicaA.send, base, 'work'))!.name).toBe('Work');
    expect(await catalogBoard(replicaA.send, base, 'review')).toBeUndefined();
  });

  it("deletes an app board like the project's own boards, and doesn't store it again on a later load or restart", async () => {
    const { a, orgId, scope, base, replicaA } = await setup();
    await getBoard(replicaA.send, base, 'release');

    expect(await replicaA.send('DELETE', `${base}/release?expectedRevision=1`)).toEqual({ status: 204, body: null });
    expect((await a.audit.list({ orgId, actions: ['factory.board.deleted'] })).events).toHaveLength(1);

    replicaA.clock.now += RECHECK_MS;
    const restarted = replica(a, orgId);
    for (const send of [replicaA.send, restarted.send]) {
      const catalog = await send('GET', base);
      expect((catalog.body.boards as Array<{ id: string }>).map(board => board.id)).toEqual(['work']);
      expect(catalog.body.problems).toBeUndefined();
      expect(await send('GET', `${base}/release`)).toMatchObject({ status: 404, body: { error: 'board_not_found' } });
    }
    expect((await a.boards.list(scope)).map(row => row.key)).toEqual(['work']);
  });

  it("serves a board stored under an app board's key before Factory stored it as that app board, leaves the row alone, and edits it", async () => {
    const { a, scope, base, replicaA } = await setup();
    const legacy = { ...boardDefinitionOf(releaseBoard()), name: 'Old release' };
    await a.boards.create(scope, legacy, ADMIN);
    replicaA.cache.invalidate(scope);

    const read = await getBoard(replicaA.send, base, 'release');
    expect(read).toMatchObject({
      name: 'Old release',
      revision: 1,
      source: 'app',
      editable: true,
      problems: [],
    });
    const catalog = await replicaA.send('GET', base);
    expect(catalog.body.problems).toBeUndefined();
    expect((await catalogBoard(replicaA.send, base, 'release'))!.name).toBe('Old release');
    expect(await a.boards.get(scope, 'release')).toMatchObject({ name: 'Old release', revision: 1 });

    const edited = await replicaA.send('PATCH', `${base}/release`, {
      name: 'Newer release',
      phases: read.phases,
      expectedRevision: 1,
    });
    expect(edited.status).toBe(200);
    expect(edited.body.board).toMatchObject({ revision: 2, source: 'app', problems: [] });
    expect((await catalogBoard(replicaA.send, base, 'release'))!.name).toBe('Newer release');
    expect((await replicaA.send('GET', base)).body.problems).toBeUndefined();
  });

  it("stores a new project's Work and app boards when the project is created, before any boards request", async () => {
    const { a, orgId, replicaA } = await setup();

    const created = await replicaA.send('POST', '/web/factory/projects', { name: 'Shipyard' });

    expect(created.status).toBe(201);
    const scope = { orgId, factoryProjectId: created.body.project.id as string };
    expect((await a.boards.list(scope)).map(row => [row.key, row.revision])).toEqual([
      ['work', 1],
      ['release', 1],
    ]);
    expect(await a.boards.readVersion(scope)).not.toBeNull();
  });

  it('still creates a project when its boards could not be stored, and stores them on its first load', async () => {
    const { a, orgId, replicaA } = await setup();
    const seeding = vi.spyOn(a.boards, 'seedBoards').mockRejectedValueOnce(new Error('storage unavailable'));

    const created = await replicaA.send('POST', '/web/factory/projects', { name: 'Shipyard' });

    expect(created.status).toBe(201);
    const scope = { orgId, factoryProjectId: created.body.project.id as string };
    expect(await a.boards.list(scope)).toEqual([]);
    replicaA.clock.now = RECHECK_MS;
    const catalog = await replicaA.send('GET', `/web/factory/projects/${scope.factoryProjectId}/boards`);
    expect(catalog.status).toBe(200);
    expect(seeding).toHaveBeenCalledTimes(2);
    expect((await a.boards.list(scope)).map(row => row.key)).toEqual(['work', 'release']);
  });

  it('lists the Work and app boards and the boards the project created, all editable', async () => {
    const { base, replicaA } = await setup();
    expect((await replicaA.send('POST', base, bugsBoard)).status).toBe(201);
    const catalog = await replicaA.send('GET', base);
    expect(
      (catalog.body.boards as Array<Record<string, unknown>>).map(board => [board.id, board.source, board.editable]),
    ).toEqual([
      ['work', 'builtin', true],
      ['release', 'app', true],
      ['bugs', 'stored', true],
    ]);
  });

  it('returns the Work and app boards the project stored, editable at revision 1, and no Review board', async () => {
    const { a, scope, base, replicaA } = await setup();
    const work = await getBoard(replicaA.send, base, 'work');
    const { description, ...definition } = boardDefinitionOf(workBoard);
    // Stored rows spell unset phase fields as null.
    expect(work).toMatchObject({
      ...definition,
      description: description ?? null,
      revision: 1,
      source: 'builtin',
      editable: true,
      problems: [],
    });
    expect((await a.boards.list(scope)).map(row => [row.key, row.revision])).toEqual([
      ['work', 1],
      ['release', 1],
    ]);
    const version = await a.boards.readVersion(scope);
    await getBoard(replicaA.send, base, 'work');
    expect(await a.boards.readVersion(scope)).toBe(version);
    expect(await replicaA.send('GET', `${base}/review`)).toMatchObject({
      status: 404,
      body: { error: 'board_not_found' },
    });
    expect(work.phases.map(phase => [phase.key, phase.name, phase.kind])).toEqual(
      Object.entries(workBoard.phases).map(([key, phase]) => [key, phase.name, phase.kind]),
    );
    expect(work.phases.map(phase => [phase.key, phase.nextPhases])).toEqual(
      Object.keys(workBoard.phases).map(key => [
        key,
        [...workBoard.phases[key as keyof typeof workBoard.phases].nextPhases],
      ]),
    );
    expect(await getBoard(replicaA.send, base, 'release')).toMatchObject({
      source: 'app',
      editable: true,
      revision: 1,
    });
    // What the code behaviour holds fixed, so an editor can show it read-only.
    const read = await replicaA.send('GET', `${base}/work`);
    expect(read.body).toMatchObject({
      canEdit: true,
      board: {
        codeBehaviour: {
          intake: {
            handlers: false,
            exitToolId: null,
            requiredNextPhases: ['triage', 'planning', 'pr-review', 'done', 'canceled'],
          },
          triage: { handlers: true, exitToolId: null },
          planning: { handlers: true, exitToolId: 'submit_plan' },
          'pr-review': { handlers: true, exitToolId: null },
          canceled: { handlers: false, exitToolId: null },
        },
      },
    });
  });

  it("lets an admin edit the Work board's automation, which another replica serves after the recheck window", async () => {
    const { a, b, orgId, scope, base, replicaA } = await setup();
    const replicaB = replica(b, orgId);
    expect((await catalogBoard(replicaB.send, base, 'work'))!.phases.find(p => p.id === 'planning')!.autoStart).toBe(
      false,
    );
    const work = await getBoard(replicaA.send, base, 'work');
    const planned = editPhase(work, 'planning', phase => ({
      ...phase,
      autoStart: true,
      autoStartWhen: EFFORT_LOW,
      exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: EFFORT_LOW },
    }));
    const body = editPhase({ ...planned, revision: 1 }, 'pr-review', phase => ({ ...phase, autoStart: true }));

    const edited = await replicaA.send('PATCH', `${base}/work`, body);
    expect(edited.status).toBe(200);
    expect(edited.body.board).toMatchObject({
      key: 'work',
      revision: 2,
      source: 'builtin',
      editable: true,
    });
    const planning = (board: Record<string, any> | undefined) => board!.phases.find((p: any) => p.id === 'planning');
    expect(planning(await catalogBoard(replicaA.send, base, 'work'))).toMatchObject({
      autoStart: true,
      autoStartWhen: EFFORT_LOW,
      exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: EFFORT_LOW },
    });

    expect(planning(await catalogBoard(replicaB.send, base, 'work')).autoStart).toBe(false);
    replicaB.clock.now += RECHECK_MS;
    const onB = await catalogBoard(replicaB.send, base, 'work');
    expect(planning(onB)).toMatchObject({ autoStart: true, autoStartWhen: EFFORT_LOW });
    expect(onB!.phases.find((p: any) => p.id === 'pr-review').autoStart).toBe(true);

    const trail = await a.audit.list({ orgId, actions: ['factory.board.updated'] });
    expect(trail.events.map(event => event.targets?.[0]?.id ?? event.action)).toHaveLength(1);
    expect((await a.boards.get(scope, 'work'))!.revision).toBe(2);
  });

  it('writes nothing when the Work board is saved unchanged', async () => {
    const { a, orgId, scope, base, replicaA } = await setup();
    const work = await getBoard(replicaA.send, base, 'work');
    const version = await a.boards.readVersion(scope);
    // The editor sends a switched-off auto-approval back as `autoApprove: false`; that is still no change.
    const body = editPhase({ ...work, revision: 1 }, 'planning', phase => ({
      ...phase,
      exitTool: { ...phase.exitTool, autoApprove: false },
    }));

    const saved = await replicaA.send('PATCH', `${base}/work`, body);
    expect(saved.status).toBe(200);
    expect(saved.body.board).toMatchObject({ revision: 1 });
    expect(await a.boards.get(scope, 'work')).toMatchObject({ revision: 1 });
    expect(await a.boards.readVersion(scope)).toBe(version);
    expect((await a.audit.list({ orgId, actions: ['factory.board.updated'] })).events).toEqual([]);

    const stale = await replicaA.send('PATCH', `${base}/work`, { ...body, expectedRevision: 2 });
    expect(stale).toMatchObject({ status: 409, body: { error: 'revision_mismatch' } });
  });

  it('refuses a Work board edit its code behaviour cannot honour, listing every conflict, and stores nothing', async () => {
    const { a, scope, base, replicaA } = await setup();
    const work = await getBoard(replicaA.send, base, 'work');
    const version = await a.boards.readVersion(scope);
    const cases = [
      {
        ...editPhase(work, 'planning', () => undefined),
        phases: editPhase(work, 'planning', () => undefined).phases.map(phase => ({
          ...phase,
          nextPhases: phase.nextPhases?.filter(next => next !== 'planning'),
        })),
      },
      editPhase(work, 'triage', phase => ({ ...phase, runner: { ...phase.runner, context: 'work' } })),
      editPhase(work, 'planning', phase => ({ ...phase, exitTool: { id: 'finish_plan', autoApprove: false } })),
      editPhase(work, 'planning', phase => ({
        ...phase,
        nextPhases: phase.nextPhases?.filter(next => next !== 'execute'),
      })),
      editPhase(work, 'execute', phase => ({ ...phase, exitTool: { id: 'finish_build', autoApprove: false } })),
    ];
    const messages = [
      /"planning" has code behaviour on board "work"; it can't be removed\./,
      /keep runner\.context/,
      /waits for exit tool "submit_plan"; keep exitTool\.id\./,
      /moves cards from it to "execute"; keep it in nextPhases\./,
      /move cards on without an exit tool; leave exitTool unset\./,
    ];
    for (const [index, body] of cases.entries()) {
      const response = await replicaA.send('PATCH', `${base}/work`, body);
      expect(response.status).toBe(422);
      expect(response.body.error).toBe('code_behaviour');
      expect(response.body.message).toMatch(messages[index]!);
      expect(response.body.conflicts).toContainEqual(expect.stringMatching(messages[index]!));
    }
    // Removing Planning also drops the moves code makes into it.
    const removal = await replicaA.send('PATCH', `${base}/work`, cases[0]);
    expect(removal.body.conflicts).toContainEqual(
      'Phase "triage": Factory\'s code moves cards from it to "planning"; keep it in nextPhases.',
    );
    const both = editPhase({ ...cases[1]!, revision: 1 }, 'planning', phase => ({
      ...phase,
      exitTool: { id: 'finish_plan', autoApprove: false },
    }));
    expect((await replicaA.send('PATCH', `${base}/work`, both)).body.conflicts).toHaveLength(2);

    expect(await a.boards.get(scope, 'work')).toMatchObject({ revision: 1 });
    expect(await a.boards.readVersion(scope)).toBe(version);
  });

  it("serves an app board's row as the project's own board once the app stops defining it", async () => {
    const { a, orgId, scope, base, replicaA } = await setup();
    await getBoard(replicaA.send, base, 'release');
    const gone = replica(a, orgId, { release: null });

    const before = (await gone.send('GET', base)).body;
    expect((before.boards as Array<Record<string, unknown>>).find(board => board.id === 'release')).toMatchObject({
      name: 'Release',
      source: 'stored',
      editable: true,
    });
    expect(before.problems).toBeUndefined();

    const copy = await getBoard(gone.send, base, 'release');
    const renamed = await gone.send('PATCH', `${base}/release`, {
      name: 'Shipped stuff',
      description: copy.description,
      phases: copy.phases,
      expectedRevision: copy.revision,
    });
    expect(renamed.status).toBe(200);
    expect(await a.boards.get(scope, 'release')).toMatchObject({ name: 'Shipped stuff' });
    expect(await catalogBoard(gone.send, base, 'release')).toMatchObject({
      name: 'Shipped stuff',
      source: 'stored',
      editable: true,
    });
  });

  it("resets an edited Work board to Factory's definition at the next revision, refusing a stale revision and a board with no default", async () => {
    const { a, orgId, scope, base, replicaA } = await setup();
    const work = await getBoard(replicaA.send, base, 'work');
    await replicaA.send(
      'PATCH',
      `${base}/work`,
      editPhase(work, 'planning', phase => ({ ...phase, name: 'Plan it' })),
    );
    expect(await replicaA.send('POST', `${base}/work/reset`, { expectedRevision: 1 })).toMatchObject({
      status: 409,
      body: { error: 'revision_mismatch' },
    });

    const reset = await replicaA.send('POST', `${base}/work/reset`, { expectedRevision: 2 });
    expect(reset.status).toBe(200);
    // Reset rewrites the row at the next revision; it never deletes it.
    expect(reset.body.board).toMatchObject({ revision: 3 });
    expect(reset.body.board.phases).toMatchObject(boardDefinitionOf(workBoard).phases);
    expect((await catalogBoard(replicaA.send, base, 'work'))!.phases.find((p: any) => p.id === 'planning').name).toBe(
      'Planning',
    );
    expect(await a.boards.get(scope, 'work')).toMatchObject({ revision: 3 });

    // So a save made before the reset can't overwrite an edit made after it.
    const fresh = await replicaA.send(
      'PATCH',
      `${base}/work`,
      editPhase(await getBoard(replicaA.send, base, 'work'), 'planning', phase => ({ ...phase, name: 'Edit B' })),
    );
    expect(fresh.body.board).toMatchObject({ revision: 4 });
    const stale = await replicaA.send(
      'PATCH',
      `${base}/work`,
      editPhase({ ...work, revision: 2 }, 'planning', phase => ({ ...phase, name: 'Stale overwrite' })),
    );
    expect(stale).toMatchObject({ status: 409, body: { error: 'revision_mismatch' } });
    expect((await a.boards.get(scope, 'work'))!.phases.find(phase => phase.key === 'planning')!.name).toBe('Edit B');

    await replicaA.send('POST', base, bugsBoard);
    expect(await replicaA.send('POST', `${base}/bugs/reset`, { expectedRevision: 1 })).toMatchObject({
      status: 409,
      body: { error: 'not_code_board' },
    });
    expect((await replicaA.send('POST', `${base}/nope/reset`, { expectedRevision: 1 })).status).toBe(404);
    const trail = await a.audit.list({ orgId, actions: ['factory.board.reset'] });
    expect(trail.events.map(event => event.action)).toEqual(['factory.board.reset']);
  });

  it("keeps an edited app board when the app's code changes, and reset writes the app's current definition at the next revision", async () => {
    const { a, orgId, base, replicaA } = await setup();
    const release = await getBoard(replicaA.send, base, 'release');
    await replicaA.send('PATCH', `${base}/release`, {
      name: 'Our release',
      phases: release.phases,
      expectedRevision: 1,
    });

    // A later release of the app renames a phase.
    const restarted = replica(a, orgId, { release: releaseBoard('Waiting') });
    expect(await getBoard(restarted.send, base, 'release')).toMatchObject({
      name: 'Our release',
    });
    expect(await catalogBoard(restarted.send, base, 'release')).toMatchObject({
      name: 'Our release',
    });

    const reset = await restarted.send('POST', `${base}/release/reset`, { expectedRevision: 2 });
    expect(reset.body.board).toMatchObject({ name: 'Release', revision: 3 });
    expect((await catalogBoard(restarted.send, base, 'release'))!.phases[0].name).toBe('Waiting');
  });

  it('refuses editing or resetting the Work board from a member who is not an admin', async () => {
    const { a, scope, base, replicaA } = await setup();
    const work = await getBoard(replicaA.send, base, 'work');
    expect(await replicaA.send('GET', `${base}/work`, undefined, MEMBER)).toMatchObject({
      status: 200,
      body: { canEdit: false, board: { editable: true } },
    });
    const body = editPhase(work, 'planning', phase => ({ ...phase, name: 'Plan it' }));
    expect(await replicaA.send('PATCH', `${base}/work`, body, MEMBER)).toMatchObject({
      status: 403,
      body: { error: 'organization_admin_required' },
    });
    expect(await replicaA.send('POST', `${base}/work/reset`, { expectedRevision: 1 }, MEMBER)).toMatchObject({
      status: 403,
      body: { error: 'organization_admin_required' },
    });
    expect(await a.boards.get(scope, 'work')).toMatchObject({ revision: 1 });
  });

  it('lets an app board be edited within its code behaviour, the same way as Work', async () => {
    const { base, replicaA } = await setup();
    const release = await getBoard(replicaA.send, base, 'release');
    const moved = await replicaA.send('PATCH', `${base}/release`, {
      name: 'Release',
      phases: release.phases.map(phase =>
        phase.key === 'shipping'
          ? { key: 'shipping', name: 'Shipping', kind: 'resting', nextPhases: ['shipped'] }
          : phase,
      ),
      expectedRevision: 1,
    });
    expect(moved).toMatchObject({ status: 422, body: { error: 'code_behaviour' } });
    expect(moved.body.message).toMatch(/must stay working/);

    const edited = await replicaA.send('PATCH', `${base}/release`, {
      name: 'Release',
      phases: release.phases.map(phase =>
        phase.key === 'shipping' ? { ...phase, runner: { ...phase.runner, instructions: 'Tag first.' } } : phase,
      ),
      expectedRevision: 1,
    });
    expect(edited.body.board).toMatchObject({ source: 'app', revision: 2 });
  });

  it('accepts a phase added to the Work board, and refuses removing it while a card sits in it', async () => {
    const { a, scope, base, replicaA } = await setup();
    const work = await getBoard(replicaA.send, base, 'work');
    const qa: StoredPhaseInput = { key: 'qa', name: 'QA', kind: 'working', runner: { context: 'work' } };
    const added = await replicaA.send('PATCH', `${base}/work`, {
      name: work.name,
      phases: [...work.phases, qa],
      expectedRevision: 1,
    });
    expect(added.status).toBe(200);
    expect((await catalogBoard(replicaA.send, base, 'work'))!.phases.map((p: any) => p.id)).toContain('qa');

    await a.workItems.upsert({ ...scope, userId: ADMIN, input: { title: 'Check it', board: 'work', stages: ['qa'] } });
    const removed = await replicaA.send('PATCH', `${base}/work`, {
      name: work.name,
      phases: work.phases,
      expectedRevision: 2,
    });
    expect(removed).toMatchObject({ status: 409, body: { error: 'phase_in_use', phases: { qa: 1 } } });
    expect(await replicaA.send('POST', `${base}/work/reset`, { expectedRevision: 2 })).toMatchObject({
      status: 409,
      body: { error: 'phase_in_use', phases: { qa: 1 } },
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

  it('refuses a request with no signed-in user, as the other project routes do', async () => {
    const { a, scope, base, replicaA } = await setup();
    expect(await replicaA.send('GET', `${base}/work`, undefined, SIGNED_OUT)).toEqual({
      status: 401,
      body: { error: 'unauthorized' },
    });
    expect((await replicaA.send('POST', base, bugsBoard, SIGNED_OUT)).status).toBe(401);
    expect((await replicaA.send('GET', base, undefined, SIGNED_OUT)).status).toBe(401);
    expect(await a.boards.list(scope)).toEqual([]);
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
