import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibSQLFactoryStorage } from '@mastra/libsql';

import { PgFactoryStorage } from '@mastra/pg';
import { Hono } from 'hono';
import { describe, expect, it, onTestFinished } from 'vitest';
import { ProjectBoardCache } from '../boards/project-boards.js';

import { createTriageWorkRegistry } from '../boards/test-utils.js';
import { FactoryDecisionDispatcher } from '../rules/dispatcher.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import { auditActionsInNamespaces } from '../storage/domains/audit/actions.js';
import { AuditStorage } from '../storage/domains/audit/base.js';
import { AuditDomain } from '../storage/domains/audit/domain.js';
import {
  CATCH_ALL_INTAKE_ROUTE,
  CLOSES_ISSUE_INTAKE_ROUTE,
  DEFAULT_INTAKE_ROUTE,
  PULL_REQUEST_INTAKE_ROUTE,
  StoredBoardsStorage,
} from '../storage/domains/boards/base.js';
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
const WORK = { boardKey: 'work' };
const TRIAGE = { boardKey: 'work', phaseKey: 'triage' };

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
  target: { boardKey: string; phaseKey: string | null };
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
  function replica(
    domains: Client,
    orgId: string,
    options: { auth?: RouteAuth; evaluator?: 'route-list' | 'intake-order' } = {},
  ) {
    const cache = new ProjectBoardCache({
      codeRegistry: createTriageWorkRegistry(),
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
        workItems: domains.workItems,
        storage: domains.boards,
        boards: cache,
        configVersion: 'intake-routes-test',
        ...(options.evaluator ? { intakeEvaluator: options.evaluator } : {}),
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

  /** Pass `seeded` to keep the default routes every project starts with; tests otherwise start with none. */
  async function setup({
    seeded = false,
    evaluator,
  }: { seeded?: boolean; evaluator?: 'route-list' | 'intake-order' } = {}) {
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
    if (!seeded) {
      // Last first, so no delete moves (and re-revisions) a route still to delete.
      for (const route of (await a.boards.listIntakeRoutes(scope)).toReversed()) {
        await a.boards.deleteIntakeRoute(scope, route.id, { expectedRevision: route.revision });
      }
    }
    return { a, b, orgId, scope, projectPath, base, replicaA: replica(a, orgId, evaluator ? { evaluator } : {}) };
  }

  async function list(send: ReturnType<typeof replica>['send'], base: string, user = ADMIN): Promise<Route[]> {
    const response = await send('GET', base, undefined, user);
    expect(response.status).toBe(200);
    return response.body.intakeRoutes;
  }

  it('lists the default routes a new project starts with, and lets an admin edit them like any other', async () => {
    const { base, replicaA } = await setup({ seeded: true });
    const [closesIssue, route, pullRequests, ...rest] = await list(replicaA.send, base, MEMBER);
    const events = rest.slice(0, -1);
    // Whatever no other route takes lands on Work's first phase, as it did before routes existed.
    expect(rest.at(-1)).toMatchObject({
      name: CATCH_ALL_INTAKE_ROUTE.name,
      position: 11,
      on: ['work_item.created'],
      when: null,
      target: { boardKey: 'work', phaseKey: 'intake' },
      createdBy: 'factory',
      problems: [],
    });
    // Close, reopen and pull request routes target Work's phases, and none has a problem to report.
    expect(events).toMatchObject([
      { name: 'Closed issues go to Done', on: ['work_item.closed'], target: { phaseKey: 'done' }, problems: [] },
      {
        name: 'Issues closed as not planned go to Canceled',
        on: ['work_item.closed'],
        target: { phaseKey: 'canceled' },
        problems: [],
      },
      {
        name: 'Reopened issues go back to Intake',
        on: ['work_item.reopened'],
        target: { phaseKey: 'intake' },
        problems: [],
      },
      // A pull request's merge, close, push and review request move its card the same way.
      { on: ['pull_request.merged'], target: { phaseKey: 'done' }, problems: [] },
      { on: ['pull_request.closed'], target: { phaseKey: 'canceled' }, problems: [] },
      { on: ['pull_request.closed'], target: { phaseKey: 'intake' }, problems: [] },
      { on: ['pull_request.synchronized'], target: { phaseKey: 'pr-review' }, problems: [] },
      { on: ['pull_request.review_requested'], target: { phaseKey: 'pr-review' }, problems: [] },
    ]);
    expect(events).toHaveLength(8);
    expect(closesIssue).toMatchObject({
      name: CLOSES_ISSUE_INTAKE_ROUTE.name,
      position: 0,
      when: CLOSES_ISSUE_INTAKE_ROUTE.when,
      target: { boardKey: 'work', phaseKey: 'pr-review', joinClosedIssue: true },
      createdBy: 'factory',
      problems: [],
    });
    expect(pullRequests).toMatchObject({
      name: PULL_REQUEST_INTAKE_ROUTE.name,
      position: 2,
      target: { boardKey: 'work', phaseKey: 'pr-review', joinClosedIssue: false },
      createdBy: 'factory',
      problems: [],
    });
    expect(route).toMatchObject({
      name: DEFAULT_INTAKE_ROUTE.name,
      enabled: true,
      position: 1,
      when: DEFAULT_INTAKE_ROUTE.when,
      target: { boardKey: 'work', phaseKey: 'intake' },
      createdBy: 'factory',
      problems: [],
    });
    expect(
      await replicaA.send('PATCH', `${base}/${route!.id}`, { enabled: false, expectedRevision: route!.revision }),
    ).toMatchObject({ status: 200, body: { intakeRoute: { enabled: false, updatedBy: ADMIN } } });
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

    const changed = await replicaA.send('PATCH', `${base}/${route.id}`, { enabled: false, expectedRevision: 1 });
    expect(changed).toMatchObject({
      status: 200,
      body: { intakeRoute: { enabled: false, revision: 2, when: TRUSTED, target: { boardKey: 'work' } } },
    });
    const cleared = await replicaA.send('PATCH', `${base}/${route.id}`, { when: null, expectedRevision: 2 });
    expect(cleared.body.intakeRoute).toMatchObject({ when: null, target: { boardKey: 'work' }, revision: 3 });

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
    const route = (await replicaA.send('POST', base, { name: 'Docs', when: DOCS, target: WORK })).body
      .intakeRoute as Route;

    const create = await replicaA.send('POST', base, { name: 'Sneaky', target: WORK }, MEMBER);
    expect(create).toMatchObject({ status: 403, body: { error: 'organization_admin_required' } });
    const patch = await replicaA.send('PATCH', `${base}/${route.id}`, { enabled: false, expectedRevision: 1 }, MEMBER);
    expect(patch.status).toBe(403);
    expect((await replicaA.send('POST', `${base}/reorder`, { ids: [route.id] }, MEMBER)).status).toBe(403);
    expect((await replicaA.send('DELETE', `${base}/${route.id}?expectedRevision=1`, undefined, MEMBER)).status).toBe(
      403,
    );

    expect(await list(replicaA.send, base, MEMBER)).toEqual([
      expect.objectContaining({ id: route.id, name: 'Docs', enabled: true, revision: 1 }),
    ]);
    expect((await replicaA.send('GET', base, undefined, MEMBER)).body).toMatchObject({ canEdit: false });
    expect((await replicaA.send('GET', base)).body).toMatchObject({ canEdit: true });
  });

  it("hides another organization's project and refuses a signed-out request", async () => {
    const { a, base, replicaA } = await setup();
    await replicaA.send('POST', base, { name: 'Docs', when: DOCS, target: WORK });

    const outsider = replica(a, `org-${randomUUID()}`);
    expect(await outsider.send('GET', base)).toMatchObject({ status: 404, body: { error: 'Project not found' } });
    expect((await outsider.send('POST', base, { name: 'Mine', target: WORK })).status).toBe(404);
    expect((await replicaA.send('GET', base, undefined, SIGNED_OUT)).status).toBe(401);
    expect(await list(replicaA.send, base)).toHaveLength(1);
  });

  it('needs no admin in local mode', async () => {
    const { a, orgId, base } = await setup();
    const local = replica(a, orgId, {
      auth: fakeRouteAuth({ enabled: false, isOrganizationAdmin: async () => false }),
    });
    expect((await local.send('POST', base, { name: 'Docs', target: WORK }, MEMBER)).status).toBe(201);
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
      // The retired Review board is no target any more.
      [{ boardKey: 'review', phaseKey: 'review' }, 'unknown_board'],
      [{ boardKey: 'work', phaseKey: 'nope' }, 'unknown_phase'],
      [{ boardKey: 'work', phaseKey: 'done' }, 'terminal_phase'],
      [{ boardKey: 'stepwise', phaseKey: 'fixing' }, 'unreachable_phase'],
      [{ boardKey: 'work', phaseKey: 'done', joinClosedIssue: true }, 'terminal_phase'],
      [{ boardKey: 'work', phaseKey: 'nope', joinClosedIssue: true }, 'unknown_phase'],
    ] as const;
    for (const [target, error] of cases) {
      expect(await replicaA.send('POST', base, { name: 'Bad', target })).toMatchObject({
        status: 422,
        body: { error },
      });
    }
    const route = (await replicaA.send('POST', base, { name: 'Ok', when: DOCS, target: { boardKey: 'work' } })).body
      .intakeRoute as Route;
    expect(route.target).toEqual({ boardKey: 'work', phaseKey: null, joinClosedIssue: false });
    // A card a pull request joins moves to any phase its board allows from where it is, so a
    // joining route may name a phase new cards can't land in.
    const joining = await replicaA.send('POST', base, {
      name: 'Join',
      target: { boardKey: 'stepwise', phaseKey: 'fixing', joinClosedIssue: true },
      when: { operator: 'AND', conditions: [{ field: 'closedIssue.phase', operator: 'equals', value: 'intake' }] },
    });
    expect(joining).toMatchObject({
      status: 201,
      body: { intakeRoute: { target: { boardKey: 'stepwise', phaseKey: 'fixing', joinClosedIssue: true } } },
    });
    const patch = await replicaA.send('PATCH', `${base}/${route.id}`, {
      target: { boardKey: 'work', phaseKey: 'canceled' },
      expectedRevision: 1,
    });
    expect(patch).toMatchObject({ status: 422, body: { error: 'terminal_phase' } });
    expect(await list(replicaA.send, base)).toEqual([
      expect.objectContaining({ name: 'Ok', revision: 1 }),
      expect.objectContaining({ name: 'Join', revision: 1 }),
    ]);
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
      { name: 'No target' },
      { name: 'Null target', target: null },
      { name: 'Hold', target: WORK, hold: 'never' },
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
    const route = (await replicaA.send('POST', base, { name: 'Ok', target: WORK })).body.intakeRoute as Route;
    expect((await replicaA.send('PATCH', `${base}/${route.id}`, { expectedRevision: 1 })).status).toBe(422);
    expect((await replicaA.send('PATCH', `${base}/${route.id}`, { name: 'No revision' })).status).toBe(422);
    expect((await replicaA.send('PATCH', `${base}/${route.id}`, { target: null, expectedRevision: 1 })).status).toBe(
      422,
    );
    expect(await list(replicaA.send, base)).toEqual([expect.objectContaining({ name: 'Ok' })]);
  });

  it('saves the events a route handles, and lets a route for later events target a terminal phase', async () => {
    const { base, replicaA } = await setup();
    const canceled = {
      operator: 'AND',
      conditions: [{ field: 'event.reason', operator: 'equals', value: 'canceled' }],
    };

    const created = await replicaA.send('POST', base, {
      name: 'Closed as not planned',
      on: ['work_item.closed'],
      when: canceled,
      target: { boardKey: 'work', phaseKey: 'canceled' },
    });
    expect(created).toMatchObject({
      status: 201,
      body: { intakeRoute: { on: ['work_item.closed'], when: canceled, problems: [] } },
    });
    const route = created.body.intakeRoute as Route;
    const bare = (await replicaA.send('POST', base, { name: 'New cards', target: WORK })).body.intakeRoute;
    expect(bare).toMatchObject({ on: ['work_item.created'] });

    const reopened = await replicaA.send('PATCH', `${base}/${route.id}`, {
      on: ['work_item.reopened'],
      when: null,
      target: { boardKey: 'work', phaseKey: 'triage' },
      expectedRevision: 1,
    });
    // A route may name a working phase such as Triage: the phase's own start decides whether a run starts.
    expect(reopened).toMatchObject({
      status: 200,
      body: { intakeRoute: { on: ['work_item.reopened'], target: { phaseKey: 'triage' }, revision: 2 } },
    });
    // A route that places new cards still can't name a terminal phase, whether it is created that way or narrowed to it.
    expect(
      await replicaA.send('POST', base, {
        name: 'Both',
        on: ['work_item.created', 'work_item.closed'],
        target: { boardKey: 'work', phaseKey: 'done' },
      }),
    ).toMatchObject({ status: 422, body: { error: 'terminal_phase' } });
    const done = await replicaA.send('PATCH', `${base}/${route.id}`, {
      target: { boardKey: 'work', phaseKey: 'done' },
      expectedRevision: 2,
    });
    expect(done.status).toBe(200);
    expect(
      await replicaA.send('PATCH', `${base}/${route.id}`, { on: ['work_item.created'], expectedRevision: 3 }),
    ).toMatchObject({ status: 422, body: { error: 'terminal_phase' } });
  });

  it('refuses allowWorkingPhase like any other field a route does not have, and changes nothing', async () => {
    const { base, replicaA } = await setup();
    const refused = { status: 422, body: { error: 'invalid_intake_route' } };
    const reopened = { name: 'Reopened back to Triage', on: ['work_item.reopened'], target: TRIAGE };
    expect(await replicaA.send('POST', base, { ...reopened, allowWorkingPhase: true })).toMatchObject(refused);

    const created = await replicaA.send('POST', base, reopened);
    expect(created).toMatchObject({ status: 201, body: { intakeRoute: { revision: 1 } } });
    const route = created.body.intakeRoute as Route;
    for (const patch of [
      { allowWorkingPhase: false },
      { name: 'Reopened issues are triaged again', allowWorkingPhase: true },
    ]) {
      expect(
        await replicaA.send('PATCH', `${base}/${route.id}`, { ...patch, expectedRevision: 1 }),
        JSON.stringify(patch),
      ).toMatchObject(refused);
    }
    expect(await list(replicaA.send, base)).toContainEqual(
      expect.objectContaining({ id: route.id, name: 'Reopened back to Triage', revision: 1 }),
    );
  });

  it('refuses a route that joins pull requests to their issue on any event but an arrival', async () => {
    const { base, replicaA } = await setup();
    const joins = { boardKey: 'work', phaseKey: 'pr-review', joinClosedIssue: true };
    const refused = { status: 422, body: { error: 'join_on_event' } };

    expect(
      await replicaA.send('POST', base, { name: 'On close', on: ['work_item.closed'], target: joins }),
    ).toMatchObject(refused);
    expect(
      await replicaA.send('POST', base, {
        name: 'On both',
        on: ['work_item.created', 'work_item.reopened'],
        target: joins,
      }),
    ).toMatchObject(refused);
    const created = await replicaA.send('POST', base, { name: 'Joins', target: joins });
    expect(created).toMatchObject({ status: 201, body: { intakeRoute: { on: ['work_item.created'], problems: [] } } });
    const route = created.body.intakeRoute as Route;
    expect(
      await replicaA.send('PATCH', `${base}/${route.id}`, {
        on: ['work_item.closed'],
        expectedRevision: route.revision,
      }),
    ).toMatchObject(refused);
  });

  it('refuses a route that names no event, an unknown or repeated one, activity, or event conditions it cannot test', async () => {
    const { base, replicaA } = await setup();
    const bodies = [
      { on: [] },
      { on: ['work_item.deleted'] },
      { on: ['work_item.closed', 'work_item.closed'] },
      { on: ['work_item.commented'] },
      { on: 'work_item.closed' },
    ];
    for (const body of bodies) {
      expect(
        await replicaA.send('POST', base, { name: 'Bad', target: WORK, ...body }),
        JSON.stringify(body),
      ).toMatchObject({
        status: 422,
        body: { error: 'invalid_intake_route' },
      });
    }
    const activity = await replicaA.send('POST', base, { name: 'Bad', target: WORK, on: ['work_item.commented'] });
    expect(activity.body.message).toMatch(/activity/);
    // `event.reason` can't be tested on a route that only places new cards; storage refuses it.
    const placement = await replicaA.send('POST', base, {
      name: 'Bad',
      target: WORK,
      when: { operator: 'AND', conditions: [{ field: 'event.reason', operator: 'equals', value: 'completed' }] },
    });
    expect(placement).toMatchObject({ status: 422, body: { error: 'invalid_intake_route' } });
    expect(await list(replicaA.send, base)).toEqual([]);
  });

  it('saves a route sending a repository, team or project to a board, by any fact of the work item', async () => {
    const { projectPath, base, replicaA } = await setup();
    expect((await replicaA.send('POST', `${projectPath}/boards`, docsBoard)).status).toBe(201);
    const when = {
      operator: 'OR',
      conditions: [
        { field: 'source.repository', operator: 'equals', value: 'acme/app' },
        {
          operator: 'AND',
          conditions: [
            { field: 'source.provider', operator: 'equals', value: 'linear' },
            { field: 'item.key', operator: 'contains', value: 'ENG-' },
            { field: 'item.state', operator: 'not_equals', value: 'Backlog' },
            { field: 'item.assignees', operator: 'contains', value: 'ada' },
          ],
        },
      ],
    };
    const created = await replicaA.send('POST', base, { name: 'App and ENG', when, target: { boardKey: 'docs' } });

    expect(created.status).toBe(201);
    expect(await list(replicaA.send, base)).toEqual([expect.objectContaining({ name: 'App and ENG', when })]);
  });

  it('previews, then moves untouched cards a new route now files elsewhere to the start of that board', async () => {
    const { a, scope, projectPath, base, replicaA } = await setup();
    expect((await replicaA.send('POST', `${projectPath}/boards`, docsBoard)).status).toBe(201);
    const card = async (title: string, stage: string, labels: string[]) =>
      (
        await a.workItems.upsert({
          ...scope,
          userId: ADMIN,
          input: { title, board: 'work', stages: [stage], metadata: { labels } },
        })
      ).item;
    const waiting = await card('Docs waiting', 'intake', ['docs']);
    const started = await card('Docs started', 'triage', ['docs']);
    const other = await card('Not docs', 'intake', []);

    expect((await replicaA.send('GET', `${base}/reroute`)).body).toEqual({ total: 0, moves: [] });
    expect((await replicaA.send('POST', base, { name: 'Docs', when: DOCS, target: { boardKey: 'docs' } })).status).toBe(
      201,
    );
    expect((await replicaA.send('GET', `${base}/reroute`)).body).toEqual({
      total: 1,
      moves: [{ fromBoard: 'work', toBoard: 'docs', count: 1 }],
    });
    // Moving cards is an admin's call, like changing the routes.
    expect((await replicaA.send('POST', `${base}/reroute`, undefined, MEMBER)).status).toBe(403);

    expect(await replicaA.send('POST', `${base}/reroute`)).toEqual({ status: 200, body: { moved: 1, skipped: 0 } });
    const after = await a.workItems.listShared(scope);
    const where = (id: string) => after.find(item => item.id === id)!;
    expect(where(waiting.id)).toMatchObject({ board: 'docs', stages: ['inbox'] });
    expect(where(started.id)).toMatchObject({ board: 'work', stages: ['triage'] });
    expect(where(other.id)).toMatchObject({ board: 'work', stages: ['intake'] });
    expect((await replicaA.send('GET', `${base}/reroute`)).body).toEqual({ total: 0, moves: [] });

    const trail = await a.audit.list({ orgId: scope.orgId, actions: auditActionsInNamespaces(['intake_route']) });
    expect(trail.events.filter(event => event.action === 'factory.intake_route.rerouted')).toMatchObject([
      { metadata: { moved: 1, skipped: 0, moves: [{ fromBoard: 'work', toBoard: 'docs', count: 1 }] } },
    ]);
  });

  it('accepts a stored board as a target, and deleting the board deletes its rules with an audit entry', async () => {
    const { a, orgId, projectPath, base, replicaA } = await setup();
    expect((await replicaA.send('POST', `${projectPath}/boards`, docsBoard)).status).toBe(201);
    const route = (
      await replicaA.send('POST', base, { name: 'Docs', when: DOCS, target: { boardKey: 'docs', phaseKey: 'writing' } })
    ).body.intakeRoute as Route;
    expect(route.problems).toEqual([]);

    expect((await replicaA.send('DELETE', `${projectPath}/boards/docs?expectedRevision=1`)).status).toBe(204);
    expect(await list(replicaA.send, base)).toEqual([]);
    const trail = await a.audit.list({ orgId, actions: auditActionsInNamespaces(['intake_route']) });
    expect(trail.events.filter(event => event.action === 'factory.intake_route.deleted')).toMatchObject([
      { targets: [{ type: 'intake_route', id: route.id }], metadata: { boardKey: 'docs', cause: 'board_deleted' } },
    ]);
  });

  it('refuses a stale change or delete and leaves the route as it was', async () => {
    const { a, orgId, base, replicaA } = await setup();
    const route = (await replicaA.send('POST', base, { name: 'Docs', when: DOCS, target: WORK })).body
      .intakeRoute as Route;
    const replicaB = replica(a, orgId);
    expect((await replicaB.send('PATCH', `${base}/${route.id}`, { name: 'B', expectedRevision: 1 })).status).toBe(200);

    expect(await replicaA.send('PATCH', `${base}/${route.id}`, { enabled: false, expectedRevision: 1 })).toMatchObject({
      status: 409,
      body: { error: 'revision_mismatch' },
    });
    expect(await replicaA.send('DELETE', `${base}/${route.id}?expectedRevision=1`)).toMatchObject({
      status: 409,
      body: { error: 'revision_mismatch' },
    });
    expect((await replicaA.send('DELETE', `${base}/${route.id}`)).status).toBe(422);
    expect(await list(replicaA.send, base)).toEqual([
      expect.objectContaining({ name: 'B', enabled: true, revision: 2 }),
    ]);
  });

  it('reorders routes only when given exactly the current set', async () => {
    const { a, orgId, base, replicaA } = await setup();
    const ids: string[] = [];
    for (const name of ['first', 'second', 'third']) {
      ids.push(((await replicaA.send('POST', base, { name, target: WORK })).body.intakeRoute as Route).id);
    }
    const [first, second, third] = ids as [string, string, string];

    const reordered = await replicaA.send('POST', `${base}/reorder`, { ids: [third, first, second] });
    expect(reordered.status).toBe(200);
    expect(reordered.body.intakeRoutes.map((route: Route) => [route.name, route.position])).toEqual([
      ['third', 0],
      ['first', 1],
      ['second', 2],
    ]);

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
        (index % 2 ? replicaB : replicaA).send('POST', base, { name: `route-${index}`, target: WORK }),
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
  describe('under intake order', () => {
    it('refuses moving a rule to another board only under intake order; the old evaluator still allows it', async () => {
      for (const evaluator of ['intake-order', 'route-list'] as const) {
        const { projectPath, base, replicaA } = await setup({ evaluator });
        expect((await replicaA.send('POST', `${projectPath}/boards`, docsBoard)).status).toBe(201);
        const route = (await replicaA.send('POST', base, { name: 'Docs', when: DOCS, target: WORK })).body
          .intakeRoute as Route;
        const moved = await replicaA.send('PATCH', `${base}/${route.id}`, {
          target: { boardKey: 'docs' },
          expectedRevision: route.revision,
        });
        if (evaluator === 'intake-order') {
          expect(moved).toMatchObject({ status: 422, body: { error: 'intake_route_board_fixed' } });
          // Its phase on its own board can still change.
          expect(
            await replicaA.send('PATCH', `${base}/${route.id}`, { target: TRIAGE, expectedRevision: route.revision }),
          ).toMatchObject({ status: 200, body: { intakeRoute: { target: TRIAGE } } });
        } else {
          expect(moved).toMatchObject({ status: 200, body: { intakeRoute: { target: { boardKey: 'docs' } } } });
        }
      }
    });

    it("lists and reorders one board's rules, leaving the other boards' places alone", async () => {
      const { projectPath, base, replicaA } = await setup({ evaluator: 'intake-order' });
      expect((await replicaA.send('POST', `${projectPath}/boards`, docsBoard)).status).toBe(201);
      const make = async (name: string, target: unknown) =>
        ((await replicaA.send('POST', base, { name, when: DOCS, target })).body.intakeRoute as Route).id;
      const w1 = await make('w1', WORK);
      const d1 = await make('d1', { boardKey: 'docs' });
      const w2 = await make('w2', WORK);
      const d2 = await make('d2', { boardKey: 'docs' });

      const docs = await list(replicaA.send, `${base}?boardKey=docs`);
      expect(docs.map(route => route.id)).toEqual([d1, d2]);
      const reordered = await replicaA.send('POST', `${base}/reorder`, { boardKey: 'docs', ids: [d2, d1] });
      expect(reordered.status).toBe(200);
      expect(reordered.body.intakeRoutes.map((route: Route) => route.id)).toEqual([d2, d1]);
      expect((await list(replicaA.send, base)).map(route => route.id)).toEqual([w1, d2, w2, d1]);
      expect(await replicaA.send('POST', `${base}/reorder`, { boardKey: 'docs', ids: [d2, w1] })).toMatchObject({
        status: 409,
        body: { error: 'intake_route_set_mismatch' },
      });
    });

    it('reads and sets the intake order, refusing an order that misses a board, with an audit entry', async () => {
      const { a, orgId, projectPath, replicaA } = await setup({ evaluator: 'intake-order' });
      expect((await replicaA.send('POST', `${projectPath}/boards`, docsBoard)).status).toBe(201);
      const read = await replicaA.send('GET', `${projectPath}/intake-order`);
      expect(read).toMatchObject({ status: 200, body: { evaluator: 'intake-order', canEdit: true } });
      expect(read.body.boards.map((board: { boardKey: string }) => board.boardKey).toSorted()).toEqual([
        'docs',
        'work',
      ]);

      expect(await replicaA.send('PUT', `${projectPath}/intake-order`, { boardKeys: ['docs'] })).toMatchObject({
        status: 409,
        body: { error: 'intake_order_set_mismatch' },
      });
      expect(
        (await replicaA.send('PUT', `${projectPath}/intake-order`, { boardKeys: ['docs', 'work'] }, MEMBER)).status,
      ).toBe(403);
      const set = await replicaA.send('PUT', `${projectPath}/intake-order`, { boardKeys: ['docs', 'work'] });
      expect(set).toMatchObject({
        status: 200,
        body: { boards: [{ boardKey: 'docs', name: 'Docs' }, { boardKey: 'work' }] },
      });
      const trail = await a.audit.list({ orgId, actions: auditActionsInNamespaces(['intake_order']) });
      expect(trail.events).toMatchObject([
        { action: 'factory.intake_order.updated', metadata: { after: ['docs', 'work'] } },
      ]);
    });

    it('routes again by intake order even on a replica still running the old evaluator', async () => {
      const { a, scope, projectPath, base, replicaA } = await setup({ evaluator: 'route-list' });
      expect((await replicaA.send('POST', `${projectPath}/boards`, docsBoard)).status).toBe(201);
      // The old list sends docs items to Work › Triage; by intake order Docs is asked first and takes them.
      await replicaA.send('POST', base, { name: 'Docs to Triage', when: DOCS, target: TRIAGE });
      const docs = (await replicaA.send('POST', base, { name: 'Docs', target: { boardKey: 'docs' } })).body
        .intakeRoute as Route;
      expect((await replicaA.send('PUT', `${projectPath}/intake-order`, { boardKeys: ['docs', 'work'] })).status).toBe(
        200,
      );
      const decided = await a.boards.recordIntakeDecision(scope, {
        idempotencyKey: 'arrival-docs',
        outcome: 'not_routed',
        evaluator: 'intake-order',
        sourceKey: 'github-issue:10',
        title: 'Docs typo',
        arrival: {
          type: 'upsertLinkedWorkItem',
          idempotencyKey: 'arrival-docs',
          board: 'work',
          source: 'github-issue',
          sourceKey: 'github-issue:10',
          title: 'Docs typo',
          url: 'https://example.com/10',
          stage: 'intake',
          metadata: { labels: ['docs'] },
        },
      });

      expect(await replicaA.send('POST', `${projectPath}/intake/not-routed/${decided.id}/route-again`)).toMatchObject({
        status: 202,
        body: { boardKey: 'docs', phaseKey: 'inbox', routeId: docs.id },
      });
      // A worker still on the old evaluator files it by intake order too, where the response said.
      const boards = new ProjectBoardCache({
        codeRegistry: createTriageWorkRegistry(),
        storage: a.boards,
        recheckMs: 0,
      });
      await new FactoryDecisionDispatcher({
        controller: {} as never,
        transitionService: new FactoryTransitionService({
          storage: a.workItems,
          configVersion: 'intake-routes-test',
          boards,
        }),
        storage: a.workItems,
        boards,
        intakeRoutes: a.boards,
        intakeEvaluator: 'route-list',
        ownerId: 'worker-route-list',
      }).runOnce(new Date(Date.now() + 1000));
      expect(await a.workItems.list(scope)).toMatchObject([{ title: 'Docs typo', board: 'docs', stages: ['inbox'] }]);
    });

    it('compares the order that is in force, derived or chosen, on every read', async () => {
      const { a, orgId, scope, projectPath, base } = await setup({ evaluator: 'intake-order' });
      const { send } = replica(a, orgId, { evaluator: 'intake-order' });
      expect((await send('POST', `${projectPath}/boards`, docsBoard)).status).toBe(201);
      await a.workItems.upsert({
        ...scope,
        userId: ADMIN,
        input: { title: 'Docs typo', board: 'docs', stages: ['inbox'], metadata: { labels: ['docs'] } },
      });
      const bug = { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'bug' }] };
      const bugs = (await send('POST', base, { name: 'Bugs', when: bug, target: WORK })).body.intakeRoute as Route;
      const docs = (await send('POST', base, { name: 'Docs', when: DOCS, target: { boardKey: 'docs' } })).body
        .intakeRoute as Route;
      const all = (await send('POST', base, { name: 'Everything', target: WORK })).body.intakeRoute as Route;
      const read = async () => (await send('GET', `${projectPath}/intake-order`)).body;

      // Work's first rule comes before Docs', so Work is asked first and its catch-all takes the docs card.
      expect(await read()).toMatchObject({
        boards: [{ boardKey: 'work' }, { boardKey: 'docs' }],
        origin: 'derived',
        comparison: { compared: 1, differing: 1, notRouted: 0 },
      });

      // A rule write moves the derived order, and the comparison with it.
      expect((await send('POST', `${base}/reorder`, { ids: [docs.id, bugs.id, all.id] })).status).toBe(200);
      expect(await read()).toMatchObject({
        boards: [{ boardKey: 'docs' }, { boardKey: 'work' }],
        comparison: { differing: 0 },
      });

      // The chosen order is what gets compared, and rule writes no longer move it.
      expect((await send('PUT', `${projectPath}/intake-order`, { boardKeys: ['work', 'docs'] })).status).toBe(200);
      expect(await read()).toMatchObject({
        boards: [{ boardKey: 'work' }, { boardKey: 'docs' }],
        origin: 'explicit',
        comparison: { compared: 1, differing: 1 },
      });
      expect((await send('POST', `${base}/reorder`, { ids: [bugs.id, docs.id, all.id] })).status).toBe(200);
      expect(await read()).toMatchObject({ boards: [{ boardKey: 'work' }, { boardKey: 'docs' }] });

      // A rule fix after the order is set shows at once: with Work's catch-all off, Docs takes the card again.
      const current = (await send('GET', `${base}/${all.id}`)).body.intakeRoute as Route;
      expect(
        (await send('PATCH', `${base}/${all.id}`, { enabled: false, expectedRevision: current.revision })).status,
      ).toBe(200);
      expect(await read()).toMatchObject({
        boards: [{ boardKey: 'work' }, { boardKey: 'docs' }],
        origin: 'explicit',
        comparison: { compared: 1, differing: 0, notRouted: 0 },
      });
    });

    it('routes again with the closed issue facts the dispatcher tests', async () => {
      const { a, scope, projectPath, base, replicaA } = await setup({ evaluator: 'intake-order' });
      const issue = (
        await a.workItems.upsert({
          ...scope,
          userId: ADMIN,
          input: { title: 'Bug', board: 'work', stages: ['intake'] },
        })
      ).item;
      const closing = {
        operator: 'AND',
        conditions: [{ field: 'pullRequest.closesIssue', operator: 'equals', value: true }],
      };
      const rule = (await replicaA.send('POST', base, { name: 'Fixes', when: closing, target: WORK })).body
        .intakeRoute as Route;
      const decided = await a.boards.recordIntakeDecision(scope, {
        idempotencyKey: 'arrival-pr',
        outcome: 'not_routed',
        evaluator: 'intake-order',
        sourceKey: 'github-pr:11',
        title: 'Fix bug',
        arrival: {
          type: 'upsertLinkedWorkItem',
          idempotencyKey: 'arrival-pr',
          board: 'work',
          source: 'github-pr',
          sourceKey: 'github-pr:11',
          title: 'Fix bug',
          url: 'https://example.com/pull/11',
          stage: 'intake',
          closesIssue: { workItemId: issue.id },
        },
      });
      expect(await replicaA.send('POST', `${projectPath}/intake/not-routed/${decided.id}/route-again`)).toMatchObject({
        status: 202,
        body: { boardKey: 'work', phaseKey: 'intake', routeId: rule.id },
      });
    });

    it('pages the Not routed list oldest first', async () => {
      const { a, scope, projectPath, replicaA } = await setup({ evaluator: 'intake-order' });
      for (const [n, day] of [
        [1, 3],
        [2, 1],
        [3, 2],
      ] as const) {
        await a.boards.recordIntakeDecision(
          scope,
          { idempotencyKey: `k${n}`, outcome: 'not_routed', evaluator: 'intake-order', title: `item ${n}` },
          new Date(Date.UTC(2026, 10, day)),
        );
      }
      const path = `${projectPath}/intake/not-routed`;
      const first = await replicaA.send('GET', `${path}?limit=2`);
      expect(first).toMatchObject({ status: 200, body: { nextCursor: expect.any(String) } });
      expect(first.body.notRouted.map((item: { title: string }) => item.title)).toEqual(['item 2', 'item 3']);
      const second = await replicaA.send('GET', `${path}?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`);
      expect(second).toMatchObject({ status: 200, body: { notRouted: [{ title: 'item 1' }], nextCursor: null } });

      expect(await replicaA.send('GET', `${path}?cursor=nonsense`)).toMatchObject({
        status: 422,
        body: { error: 'invalid_intake_cursor' },
      });
      expect((await replicaA.send('GET', `${path}?limit=101`)).status).toBe(422);
    });

    it('routes a Not routed item again once a rule takes it, and refuses while none does', async () => {
      const { a, orgId, scope, projectPath, base, replicaA } = await setup({ evaluator: 'intake-order' });
      const decided = await a.boards.recordIntakeDecision(scope, {
        idempotencyKey: 'arrival-1',
        outcome: 'not_routed',
        evaluator: 'intake-order',
        reason: "No board's intake rules match it (checked Work).",
        sourceKey: 'github-issue:9',
        title: 'Flaky build',
        url: 'https://example.com/9',
        arrival: {
          type: 'upsertLinkedWorkItem',
          idempotencyKey: 'arrival-1',
          board: 'work',
          source: 'github-issue',
          sourceKey: 'github-issue:9',
          title: 'Flaky build',
          url: 'https://example.com/9',
          stage: 'intake',
          metadata: { labels: ['docs'] },
        },
      });
      const listed = await replicaA.send('GET', `${projectPath}/intake/not-routed`);
      expect(listed).toMatchObject({
        status: 200,
        body: { notRouted: [{ id: decided.id, title: 'Flaky build', reason: expect.any(String) }], canEdit: true },
      });
      const again = `${projectPath}/intake/not-routed/${decided.id}/route-again`;
      expect(await replicaA.send('POST', again)).toMatchObject({ status: 422, body: { error: 'intake_not_routed' } });
      expect((await replicaA.send('POST', again, undefined, MEMBER)).status).toBe(403);

      const rule = (await replicaA.send('POST', base, { name: 'Docs', when: DOCS, target: TRIAGE })).body
        .intakeRoute as Route;
      expect(await replicaA.send('POST', again)).toMatchObject({
        status: 202,
        body: { status: 'queued', boardKey: 'work', phaseKey: 'triage', routeId: rule.id },
      });
      const queued = await a.workItems.listDeferredDecisions(orgId, scope.factoryProjectId);
      expect(queued).toMatchObject([
        {
          status: 'pending',
          workItemId: null,
          decision: {
            type: 'upsertLinkedWorkItem',
            sourceKey: 'github-issue:9',
            idempotencyKey: expect.stringContaining(decided.id),
          },
        },
      ]);
      const trail = await a.audit.list({ orgId, actions: auditActionsInNamespaces(['intake']) });
      expect(trail.events).toMatchObject([
        { action: 'factory.intake.routed_again', targets: [{ type: 'intake_decision', id: decided.id }] },
      ]);
      expect((await replicaA.send('POST', `${projectPath}/intake/not-routed/${randomUUID()}/route-again`)).status).toBe(
        404,
      );

      // The dispatcher files the queued arrival where the rule says, and the record is resolved.
      const boards = new ProjectBoardCache({
        codeRegistry: createTriageWorkRegistry(),
        storage: a.boards,
        recheckMs: 0,
      });
      const dispatcher = new FactoryDecisionDispatcher({
        controller: {} as never,
        transitionService: new FactoryTransitionService({
          storage: a.workItems,
          configVersion: 'intake-routes-test',
          boards,
        }),
        storage: a.workItems,
        boards,
        intakeRoutes: a.boards,
        intakeEvaluator: 'intake-order',
        ownerId: 'worker-route-again',
      });
      await dispatcher.runOnce(new Date(Date.now() + 1000));
      const [card, ...others] = await a.workItems.list(scope);
      expect(others).toEqual([]);
      expect(card).toMatchObject({ title: 'Flaky build', board: 'work', stages: ['triage'] });
      expect((await replicaA.send('GET', `${projectPath}/intake/not-routed`)).body.notRouted).toEqual([]);
      expect(await replicaA.send('POST', again)).toMatchObject({
        status: 409,
        body: { error: 'intake_decision_resolved' },
      });
    });
  });
});
