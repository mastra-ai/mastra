import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { Hono } from 'hono';
import { describe, expect, it, onTestFinished } from 'vitest';

import { UNTRUSTED_AUTHOR_WHEN } from '../boards/intake-routing.js';
import { ProjectBoardCache } from '../boards/project-boards.js';
import { createBoardRegistry } from '../boards/registry.js';
import { auditActionsInNamespaces } from '../storage/domains/audit/actions.js';
import { AuditStorage } from '../storage/domains/audit/base.js';
import { AuditDomain } from '../storage/domains/audit/domain.js';
import { StoredBoardsStorage } from '../storage/domains/boards/base.js';
import { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { BoardRoutes } from './boards.js';
import { IntakeRouteRoutes } from './intake-routes.js';
import type { RouteAuth } from './route.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const ADMIN = 'admin-user';
const MEMBER = 'member-user';
const SIGNED_OUT = 'signed-out';

const TRUSTED = { operator: 'AND', conditions: [{ field: 'author.trusted', operator: 'equals', value: true }] };
const DOCS = { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'docs' }] };

const docsBoard = {
  key: 'docs',
  name: 'Docs',
  phases: [
    { key: 'inbox', name: 'Inbox', kind: 'resting' },
    { key: 'writing', name: 'Writing', kind: 'working', runner: { context: 'work' } },
    { key: 'published', name: 'Published', kind: 'terminal' },
  ],
};

type Route = {
  id: string;
  name: string;
  enabled: boolean;
  position: number;
  when: unknown;
  target: { boardKey: string; phaseKey: string | null } | null;
  hold: string;
  revision: number;
  createdBy: string;
  updatedBy: string;
  problems: string[];
};

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('intake route management routes on %s', backend => {
  async function client(url: string) {
    const storage =
      backend === 'postgres'
        ? new PgFactoryStorage({ id: `intake-routes-${randomUUID()}`, connectionString: postgresUrl! })
        : new LibSQLFactoryStorage({ id: `intake-routes-${randomUUID()}`, url });
    const domains = {
      projects: storage.registerDomain(new FactoryProjectsStorage()),
      workItems: storage.registerDomain(new WorkItemsStorage()),
      boards: storage.registerDomain(new StoredBoardsStorage()),
      audit: storage.registerDomain(new AuditStorage()),
    };
    await storage.init();
    onTestFinished(() => storage.close());
    return domains;
  }

  type Client = Awaited<ReturnType<typeof client>>;

  /** One replica: the intake route and board routes over HTTP, with its own board cache. */
  function replica(domains: Client, orgId: string, options: { auth?: RouteAuth } = {}) {
    const cache = new ProjectBoardCache({
      codeRegistry: createBoardRegistry(),
      storage: domains.boards,
      projects: domains.projects,
      recheckMs: 1000,
      now: () => 0,
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
      ...new IntakeRouteRoutes({
        auth,
        audit,
        projects: domains.projects,
        storage: domains.boards,
        boards: cache,
      }).routes(),
      ...new BoardRoutes({
        auth,
        audit,
        projects: domains.projects,
        workItems: domains.workItems,
        storage: domains.boards,
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
    return { send };
  }

  async function setup() {
    let url = ':memory:';
    if (backend === 'libsql') {
      const dir = mkdtempSync(join(tmpdir(), 'factory-intake-routes-'));
      onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
      url = `file:${join(dir, 'factory.db')}`;
    }
    const a = await client(url);
    const b = await client(url);
    const orgId = `org-${randomUUID()}`;
    const project = await a.projects.create({ orgId, userId: ADMIN, input: { name: 'Acme' } });
    const projectPath = `/web/factory/projects/${project.id}`;
    const base = `${projectPath}/intake-routes`;
    const scope = { orgId, factoryProjectId: project.id };
    return { a, b, orgId, scope, projectPath, base, replicaA: replica(a, orgId) };
  }

  async function list(send: ReturnType<typeof replica>['send'], base: string, user = ADMIN): Promise<Route[]> {
    const response = await send('GET', base, undefined, user);
    expect(response.status).toBe(200);
    return response.body.intakeRoutes;
  }

  it('lists no routes on a new project and shows the built-in untrusted fallback', async () => {
    const { base, replicaA } = await setup();
    expect(await replicaA.send('GET', base, undefined, MEMBER)).toEqual({
      status: 200,
      body: { intakeRoutes: [], fallback: { hold: 'untrusted', untrustedWhen: UNTRUSTED_AUTHOR_WHEN } },
    });
  });

  it('creates, reads, changes and deletes a route, and records each change in the audit log', async () => {
    const { a, orgId, base, replicaA } = await setup();

    const created = await replicaA.send('POST', base, {
      name: ' Trusted to triage ',
      when: TRUSTED,
      target: { boardKey: 'work', phaseKey: 'triage' },
    });
    expect(created.status).toBe(201);
    const route = created.body.intakeRoute as Route;
    expect(route).toMatchObject({
      name: 'Trusted to triage',
      enabled: true,
      position: 0,
      when: TRUSTED,
      target: { boardKey: 'work', phaseKey: 'triage' },
      hold: 'untrusted',
      revision: 1,
      createdBy: ADMIN,
      problems: [],
    });
    expect(route).not.toHaveProperty('orgId');

    // Reading needs only membership.
    expect(await replicaA.send('GET', `${base}/${route.id}`, undefined, MEMBER)).toMatchObject({
      status: 200,
      body: { intakeRoute: { id: route.id, name: 'Trusted to triage' } },
    });

    const changed = await replicaA.send('PATCH', `${base}/${route.id}`, { hold: 'always', expectedRevision: 1 });
    expect(changed).toMatchObject({
      status: 200,
      body: { intakeRoute: { hold: 'always', revision: 2, when: TRUSTED, target: { boardKey: 'work' } } },
    });
    const cleared = await replicaA.send('PATCH', `${base}/${route.id}`, { target: null, expectedRevision: 2 });
    expect(cleared.body.intakeRoute).toMatchObject({ target: null, revision: 3 });

    expect((await replicaA.send('DELETE', `${base}/${route.id}?expectedRevision=3`)).status).toBe(204);
    expect(await list(replicaA.send, base)).toEqual([]);
    expect(await replicaA.send('GET', `${base}/${route.id}`)).toMatchObject({
      status: 404,
      body: { error: 'intake_route_not_found' },
    });

    const trail = await a.audit.list({ orgId, actions: auditActionsInNamespaces(['intake_route']) });
    expect(trail.events.map(event => event.action).sort()).toEqual([
      'factory.intake_route.created',
      'factory.intake_route.deleted',
      'factory.intake_route.updated',
      'factory.intake_route.updated',
    ]);
    expect(trail.events.every(event => event.targets[0]?.type === 'intake_route')).toBe(true);
  });

  it('refuses route changes from a member who is not an admin, and leaves the routes as they were', async () => {
    const { base, replicaA } = await setup();
    const route = (await replicaA.send('POST', base, { name: 'Docs', when: DOCS })).body.intakeRoute as Route;

    const create = await replicaA.send('POST', base, { name: 'Sneaky', hold: 'never' }, MEMBER);
    expect(create).toMatchObject({ status: 403, body: { error: 'organization_admin_required' } });
    const patch = await replicaA.send('PATCH', `${base}/${route.id}`, { hold: 'never', expectedRevision: 1 }, MEMBER);
    expect(patch.status).toBe(403);
    expect((await replicaA.send('POST', `${base}/reorder`, { ids: [route.id] }, MEMBER)).status).toBe(403);
    expect((await replicaA.send('DELETE', `${base}/${route.id}?expectedRevision=1`, undefined, MEMBER)).status).toBe(
      403,
    );

    expect(await list(replicaA.send, base, MEMBER)).toEqual([
      expect.objectContaining({ id: route.id, name: 'Docs', hold: 'untrusted', revision: 1 }),
    ]);
  });

  it("hides another organization's project and refuses a signed-out request", async () => {
    const { a, base, replicaA } = await setup();
    await replicaA.send('POST', base, { name: 'Docs', when: DOCS });

    const outsider = replica(a, `org-${randomUUID()}`);
    expect(await outsider.send('GET', base)).toMatchObject({ status: 404, body: { error: 'Project not found' } });
    expect((await outsider.send('POST', base, { name: 'Mine' })).status).toBe(404);
    expect((await replicaA.send('GET', base, undefined, SIGNED_OUT)).status).toBe(401);
    expect(await list(replicaA.send, base)).toHaveLength(1);
  });

  it('needs no admin in local mode', async () => {
    const { a, orgId, base } = await setup();
    const local = replica(a, orgId, {
      auth: fakeRouteAuth({ enabled: false, isOrganizationAdmin: async () => false }),
    });
    expect((await local.send('POST', base, { name: 'Docs' }, MEMBER)).status).toBe(201);
  });

  it('refuses a target that is not an installed board or a phase new cards can land in', async () => {
    const { base, projectPath, replicaA } = await setup();
    const stepwise = {
      key: 'stepwise',
      name: 'Stepwise',
      phases: [
        { key: 'reported', name: 'Reported', kind: 'resting', nextPhases: ['triaged'] },
        { key: 'triaged', name: 'Triaged', kind: 'resting', nextPhases: ['fixing'] },
        { key: 'fixing', name: 'Fixing', kind: 'working', runner: { context: 'work' }, nextPhases: [] },
      ],
    };
    expect((await replicaA.send('POST', `${projectPath}/boards`, stepwise)).status).toBe(201);
    const cases = [
      [{ boardKey: 'nope' }, 'unknown_board'],
      [{ boardKey: 'work', phaseKey: 'nope' }, 'unknown_phase'],
      [{ boardKey: 'work', phaseKey: 'done' }, 'terminal_phase'],
      [{ boardKey: 'stepwise', phaseKey: 'fixing' }, 'unreachable_phase'],
    ] as const;
    for (const [target, error] of cases) {
      expect(await replicaA.send('POST', base, { name: 'Bad', target })).toMatchObject({
        status: 422,
        body: { error },
      });
    }
    const route = (await replicaA.send('POST', base, { name: 'Ok', target: { boardKey: 'work' } })).body
      .intakeRoute as Route;
    expect(route.target).toEqual({ boardKey: 'work', phaseKey: null });
    const patch = await replicaA.send('PATCH', `${base}/${route.id}`, {
      target: { boardKey: 'review', phaseKey: 'done' },
      expectedRevision: 1,
    });
    expect(patch).toMatchObject({ status: 422, body: { error: 'terminal_phase' } });
    expect(await list(replicaA.send, base)).toEqual([expect.objectContaining({ name: 'Ok', revision: 1 })]);
  });

  it('refuses a malformed route before it reaches storage', async () => {
    const { base, replicaA } = await setup();
    const deep = {
      operator: 'AND',
      conditions: [
        { operator: 'AND', conditions: [{ operator: 'AND', conditions: [{ operator: 'AND', conditions: [] }] }] },
      ],
    };
    const bodies = [
      { name: '' },
      { name: 'x'.repeat(121) },
      { name: 'Bad field', when: { operator: 'AND', conditions: [{ field: 'item.body', operator: 'exists' }] } },
      { name: 'Too deep', when: deep },
      { name: 'Bad hold', hold: 'sometimes' },
      { name: 'Phase only', target: { phaseKey: 'triage' } },
      { name: 'Bad key', target: { boardKey: 'work board' } },
      { name: 'Extra', position: 3 },
    ];
    for (const body of bodies) {
      expect(await replicaA.send('POST', base, body), JSON.stringify(body)).toMatchObject({
        status: 422,
        body: { error: 'invalid_intake_route' },
      });
    }
    expect((await replicaA.send('POST', base, 'not json')).status).toBe(422);
    const route = (await replicaA.send('POST', base, { name: 'Ok' })).body.intakeRoute as Route;
    expect((await replicaA.send('PATCH', `${base}/${route.id}`, { expectedRevision: 1 })).status).toBe(422);
    expect((await replicaA.send('PATCH', `${base}/${route.id}`, { name: 'No revision' })).status).toBe(422);
    expect(await list(replicaA.send, base)).toEqual([expect.objectContaining({ name: 'Ok' })]);
  });

  it('accepts a stored board as a target and reports the route once that board is gone', async () => {
    const { projectPath, base, replicaA } = await setup();
    expect((await replicaA.send('POST', `${projectPath}/boards`, docsBoard)).status).toBe(201);
    const route = (
      await replicaA.send('POST', base, { name: 'Docs', when: DOCS, target: { boardKey: 'docs', phaseKey: 'writing' } })
    ).body.intakeRoute as Route;
    expect(route.problems).toEqual([]);

    expect((await replicaA.send('DELETE', `${projectPath}/boards/docs?expectedRevision=1`)).status).toBe(204);
    expect(await list(replicaA.send, base)).toEqual([
      expect.objectContaining({ id: route.id, problems: ['Board "docs" is not installed in this project.'] }),
    ]);
  });

  it('refuses a stale change or delete and leaves the route as it was', async () => {
    const { a, orgId, base, replicaA } = await setup();
    const route = (await replicaA.send('POST', base, { name: 'Docs', when: DOCS })).body.intakeRoute as Route;
    const replicaB = replica(a, orgId);
    expect((await replicaB.send('PATCH', `${base}/${route.id}`, { name: 'B', expectedRevision: 1 })).status).toBe(200);

    expect(await replicaA.send('PATCH', `${base}/${route.id}`, { hold: 'never', expectedRevision: 1 })).toMatchObject({
      status: 409,
      body: { error: 'revision_mismatch' },
    });
    expect(await replicaA.send('DELETE', `${base}/${route.id}?expectedRevision=1`)).toMatchObject({
      status: 409,
      body: { error: 'revision_mismatch' },
    });
    expect((await replicaA.send('DELETE', `${base}/${route.id}`)).status).toBe(422);
    expect(await list(replicaA.send, base)).toEqual([
      expect.objectContaining({ name: 'B', hold: 'untrusted', revision: 2 }),
    ]);
  });

  it('reorders routes only when given exactly the current set', async () => {
    const { a, orgId, base, replicaA } = await setup();
    const ids: string[] = [];
    for (const name of ['first', 'second', 'third']) {
      ids.push(((await replicaA.send('POST', base, { name })).body.intakeRoute as Route).id);
    }
    const [first, second, third] = ids as [string, string, string];

    const reordered = await replicaA.send('POST', `${base}/reorder`, { ids: [third, first, second] });
    expect(reordered.status).toBe(200);
    expect(reordered.body.intakeRoutes.map((route: Route) => [route.name, route.position])).toEqual([
      ['third', 0],
      ['first', 1],
      ['second', 2],
    ]);
    expect(reordered.body.fallback.hold).toBe('untrusted');

    for (const body of [{ ids: [third, first] }, { ids: [third, first, second, randomUUID()] }]) {
      expect(await replicaA.send('POST', `${base}/reorder`, body)).toMatchObject({
        status: 409,
        body: { error: 'intake_route_set_mismatch' },
      });
    }
    expect((await replicaA.send('POST', `${base}/reorder`, { ids: [first, first, second] })).status).toBe(422);
    expect((await replicaA.send('POST', `${base}/reorder`, { ids: [] })).status).toBe(422);
    expect((await list(replicaA.send, base)).map(route => route.name)).toEqual(['third', 'first', 'second']);

    const trail = await a.audit.list({ orgId, actions: auditActionsInNamespaces(['intake_route']) });
    expect(trail.events.filter(event => event.action === 'factory.intake_route.reordered')).toHaveLength(1);
  });

  it('answers 404 for a missing or malformed route id', async () => {
    const { base, replicaA } = await setup();
    expect((await replicaA.send('GET', `${base}/${randomUUID()}`)).status).toBe(404);
    expect((await replicaA.send('GET', `${base}/not-a-uuid`)).status).toBe(404);
    expect(
      (await replicaA.send('PATCH', `${base}/${randomUUID()}`, { name: 'Gone', expectedRevision: 1 })).body.error,
    ).toBe('intake_route_not_found');
    expect((await replicaA.send('DELETE', `${base}/${randomUUID()}?expectedRevision=1`)).status).toBe(404);
  });

  it('keeps distinct positions when two replicas add routes at once, and settles concurrent reorders', async () => {
    const { b, orgId, base, replicaA } = await setup();
    const replicaB = replica(b, orgId);
    const created = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        (index % 2 ? replicaB : replicaA).send('POST', base, { name: `route-${index}` }),
      ),
    );
    expect(created.map(response => response.status)).toEqual(Array(6).fill(201));
    const routes = await list(replicaA.send, base);
    expect(routes.map(route => route.position)).toEqual([0, 1, 2, 3, 4, 5]);

    const ids = routes.map(route => route.id);
    const forward = [...ids].reverse();
    const results = await Promise.all([
      replicaA.send('POST', `${base}/reorder`, { ids: forward }),
      replicaB.send('POST', `${base}/reorder`, { ids }),
    ]);
    expect(results.map(result => result.status)).toEqual([200, 200]);
    const final = (await list(replicaA.send, base)).map(route => route.id);
    expect([forward, ids]).toContainEqual(final);
  });
});
