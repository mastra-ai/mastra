import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry, defineBoard } from '../boards/index.js';
import type { Intake } from '../capabilities/intake.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { IntakeRoutes, parseIntakeConfig } from './intake.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const auditEvents: Array<Record<string, unknown>> = [];
const audit: AuditEmitter = {
  async emit({ input }) {
    auditEvents.push({
      action: input.action,
      metadata: input.metadata,
      ...(input.factoryProjectId ? { factoryProjectId: input.factoryProjectId } : {}),
    });
  },
};

const github: Pick<Intake, 'listSources' | 'listItems'> = {
  listSources: vi.fn(async () => [{ id: 'repo-1', name: 'acme/app', type: 'repository' }]),
  listItems: vi.fn(async () => ({
    items: [
      {
        source: { type: 'issue', externalId: '17', url: 'https://github.com/acme/app/issues/17' },
        sourceId: 'repo-1',
        title: 'Fix login',
      },
    ],
    nextCursor: 'github-next',
  })),
};

const linear: Pick<Intake, 'listSources' | 'listItems'> = {
  listSources: vi.fn(async () => [{ id: 'team-1', name: 'Platform', type: 'project' }]),
  listItems: vi.fn(async () => ({
    items: [
      {
        source: { type: 'issue', externalId: 'ENG-9', url: 'https://linear.app/acme/issue/ENG-9' },
        sourceId: 'team-1',
        title: 'Ship project model',
      },
    ],
    nextCursor: null,
  })),
};

const integrations = [
  { id: 'github', intake: github },
  { id: 'linear', intake: linear },
];

function buildApp(user: { workosId: string; organizationId?: string } | null, intakeIntegrations = integrations) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app as any,
    new IntakeRoutes({
      auth: fakeRouteAuth(),
      audit,
      intake: seed.intake,
      projects: seed.projects,
      integrations: intakeIntegrations,
      boardRegistry,
      workItems: seed.workItems,
    }).routes(),
  );
  return app;
}

const releaseBoard = defineBoard({
  id: 'release',
  title: 'Release',
  initialPhase: 'queued',
  phases: { queued: { title: 'Queued', kind: 'resting' }, shipped: { title: 'Shipped', kind: 'terminal' } },
});
const boardRegistry = createBoardRegistry({ boards: [releaseBoard] });

const orgUser = { workosId: 'u1', organizationId: 'org1' };
let seed: FactoryStorageTestSeed;

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  auditEvents.length = 0;
  vi.clearAllMocks();
});

describe('intake configuration', () => {
  it('requires an authenticated organization', async () => {
    expect((await buildApp(null).request('/web/intake/config')).status).toBe(401);
    expect((await buildApp({ workosId: 'u1' }).request('/web/intake/config')).status).toBe(403);
  });

  it('defaults every configured capability to enabled with no selected sources', async () => {
    const response = await buildApp(orgUser).request('/web/intake/config');
    expect(await response.json()).toEqual({
      config: {
        github: { enabled: true, sourceIds: null },
        linear: { enabled: true, sourceIds: null },
      },
    });
  });

  it('persists dynamic integration selections and audits a bounded summary', async () => {
    const config = {
      github: { enabled: true, sourceIds: ['repo-1'] },
      linear: { enabled: false, sourceIds: null },
    };
    const response = await buildApp(orgUser).request('/web/intake/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(config),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ config });
    expect(await seed.intake.getConfig({ orgId: 'org1', userId: 'u1' })).toEqual(config);
    expect(auditEvents).toEqual([
      {
        action: 'factory.intake.config_updated',
        metadata: {
          github: { enabled: true, sources: 1 },
          linear: { enabled: false, sources: null },
        },
      },
    ]);
  });

  describe('source bindings', () => {
    const put = (body: unknown, user: typeof orgUser | null = orgUser) =>
      buildApp(user).request('/web/intake/bindings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    it('requires an authenticated organization', async () => {
      expect((await buildApp(null).request('/web/intake/bindings')).status).toBe(401);
      expect((await buildApp({ workosId: 'u1' }).request('/web/intake/bindings')).status).toBe(403);
    });

    it('binds a source to a Factory project and reads it back', async () => {
      const project = await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'app' } });
      const response = await put({ integrationId: 'linear', sourceId: 'team-1', factoryProjectId: project.id });

      const bindings = [{ integrationId: 'linear', sourceId: 'team-1', factoryProjectId: project.id, board: null }];
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ bindings });
      expect(await (await buildApp(orgUser).request('/web/intake/bindings')).json()).toEqual({ bindings });
      expect(auditEvents).toEqual([
        {
          action: 'factory.intake.binding_updated',
          factoryProjectId: project.id,
          metadata: { factoryProjectId: project.id, board: null },
        },
      ]);
    });

    it('binds a source to an installed board and rebinding clears the board', async () => {
      const project = await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'app' } });
      const response = await put({
        integrationId: 'linear',
        sourceId: 'team-1',
        factoryProjectId: project.id,
        board: 'release',
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        bindings: [{ integrationId: 'linear', sourceId: 'team-1', factoryProjectId: project.id, board: 'release' }],
      });
      expect(auditEvents.at(-1)?.metadata).toEqual({ factoryProjectId: project.id, board: 'release' });

      await put({ integrationId: 'linear', sourceId: 'team-1', factoryProjectId: project.id });
      expect(await seed.intake.getBinding({ orgId: 'org1', integrationId: 'linear', sourceId: 'team-1' })).toEqual({
        integrationId: 'linear',
        sourceId: 'team-1',
        factoryProjectId: project.id,
        board: null,
      });
    });

    it('moves the resting cards of a rebound source and leaves the rest', async () => {
      const project = await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'app' } });
      const linearSource = (externalId: string) => ({
        integrationId: 'linear',
        type: 'issue',
        externalId,
        url: `https://linear.app/acme/issue/${externalId}`,
      });
      const create = (
        externalId: string,
        stages: string[],
        sessions: Record<string, { sessionId: string; branch: string; threadId: string }> = {},
      ) =>
        seed.workItems.upsert({
          orgId: 'org1',
          userId: 'u1',
          factoryProjectId: project.id,
          input: { board: 'work', title: externalId, stages, sessions, externalSource: linearSource(externalId) },
        });
      const resting = (await create('linear:ENG-9', ['intake'])).item;
      // Parked in a working phase with no run attached — how auto-ingested issues sit in Triage.
      const parked = (await create('linear:ENG-13', ['triage'])).item;
      const working = (
        await create('linear:ENG-10', ['triage'], { triage: { sessionId: 's-1', branch: 'b', threadId: 't' } })
      ).item;
      const finished = (await create('linear:ENG-11', ['done'])).item;
      const unrelated = (await create('linear:ENG-12', ['intake'])).item;
      const sourcePage = {
        items: [
          {
            source: { type: 'issue', externalId: 'uuid-9' },
            sourceId: 'team-1',
            title: 'a',
            metadata: { identifier: 'ENG-9' },
          },
          {
            source: { type: 'issue', externalId: 'uuid-10' },
            sourceId: 'team-1',
            title: 'b',
            metadata: { identifier: 'ENG-10' },
          },
          {
            source: { type: 'issue', externalId: 'uuid-11' },
            sourceId: 'team-1',
            title: 'c',
            metadata: { identifier: 'ENG-11' },
          },
          {
            source: { type: 'issue', externalId: 'uuid-13' },
            sourceId: 'team-1',
            title: 'd',
            metadata: { identifier: 'ENG-13' },
          },
        ],
        nextCursor: null,
      };
      // One read per rebind below; `Once` so the shared mock stays intact for other tests.
      vi.mocked(linear.listItems).mockResolvedValueOnce(sourcePage).mockResolvedValueOnce(sourcePage);
      // A legacy binding (no persisted board) still fed Work, so pointing it at a
      // board for the first time must carry those resting cards along.
      await put({ integrationId: 'linear', sourceId: 'team-1', factoryProjectId: project.id });
      expect(linear.listItems).not.toHaveBeenCalled();

      const response = await put({
        integrationId: 'linear',
        sourceId: 'team-1',
        factoryProjectId: project.id,
        board: 'release',
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ relocated: { moved: 2, skipped: 2 } });
      expect(linear.listItems).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'org1', userId: 'u1', sourceIds: ['team-1'] }),
      );
      const byId = new Map(
        (await seed.workItems.list({ orgId: 'org1', factoryProjectId: project.id })).map(i => [i.id, i]),
      );
      expect(byId.get(resting.id)).toMatchObject({ board: 'release', stages: ['queued'] });
      expect(byId.get(parked.id)).toMatchObject({ board: 'release', stages: ['queued'] });
      expect(byId.get(working.id)).toMatchObject({ board: 'work', stages: ['triage'] });
      expect(byId.get(finished.id)).toMatchObject({ board: 'work', stages: ['done'] });
      expect(byId.get(unrelated.id)).toMatchObject({ board: 'work', stages: ['intake'] });
      expect(auditEvents.at(-1)?.metadata).toEqual({
        factoryProjectId: project.id,
        board: 'release',
        relocated: { moved: 2, skipped: 2 },
      });

      // Moving back to Work returns the moved cards to Work's initial phase.
      const back = await put({
        integrationId: 'linear',
        sourceId: 'team-1',
        factoryProjectId: project.id,
        board: 'work',
      });
      expect(await back.json()).toMatchObject({ relocated: { moved: 2, skipped: 0 } });
      const again = await seed.workItems.list({ orgId: 'org1', factoryProjectId: project.id });
      expect(again.find(i => i.id === resting.id)).toMatchObject({ board: 'work', stages: ['intake'] });
    });

    it('rejects a board that is not installed', async () => {
      const project = await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'app' } });
      const response = await put({
        integrationId: 'linear',
        sourceId: 'team-1',
        factoryProjectId: project.id,
        board: 'hotfix',
      });
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ error: 'invalid_board' });
      expect(
        (await put({ integrationId: 'linear', sourceId: 'team-1', factoryProjectId: project.id, board: 7 })).status,
      ).toBe(400);
      expect(await seed.intake.listBindings({ orgId: 'org1' })).toEqual([]);
    });

    it('clears a binding when the project is null', async () => {
      const project = await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'app' } });
      await put({ integrationId: 'linear', sourceId: 'team-1', factoryProjectId: project.id });
      auditEvents.length = 0;

      const response = await put({ integrationId: 'linear', sourceId: 'team-1', factoryProjectId: null });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ bindings: [] });
      expect(auditEvents).toEqual([
        {
          action: 'factory.intake.binding_updated',
          factoryProjectId: project.id,
          metadata: { factoryProjectId: null, board: null },
        },
      ]);
    });

    it('rejects unknown integrations and malformed bodies for bindings', async () => {
      const project = await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'app' } });
      expect((await put({ integrationId: 'jira', sourceId: 's', factoryProjectId: project.id })).status).toBe(400);
      expect((await put({ integrationId: 'linear', factoryProjectId: project.id })).status).toBe(400);
      expect((await put({ integrationId: 'linear', sourceId: 'team-1' })).status).toBe(400);
    });

    it('refuses to bind a source to another org project', async () => {
      const foreign = await seed.projects.create({ orgId: 'org2', userId: 'u9', input: { name: 'other' } });
      const response = await put({ integrationId: 'linear', sourceId: 'team-1', factoryProjectId: foreign.id });

      expect(response.status).toBe(404);
      expect(await seed.intake.listBindings({ orgId: 'org1' })).toEqual([]);
    });
  });

  describe('label routes', () => {
    const put = (body: unknown, user: typeof orgUser | null = orgUser) =>
      buildApp(user).request('/web/intake/label-routes', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    const list = (factoryProjectId?: string) =>
      buildApp(orgUser).request(
        factoryProjectId ? `/web/intake/label-routes?factoryProjectId=${factoryProjectId}` : '/web/intake/label-routes',
      );

    it('requires an authenticated organization', async () => {
      expect((await buildApp(null).request('/web/intake/label-routes')).status).toBe(401);
      expect((await buildApp({ workosId: 'u1' }).request('/web/intake/label-routes')).status).toBe(403);
    });

    it('stores a normalized label route, reads it back per project, and clears it', async () => {
      const project = await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'app' } });
      const other = await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'other' } });
      const response = await put({
        integrationId: 'github',
        factoryProjectId: project.id,
        label: '  Release ',
        board: 'release',
      });

      const route = { integrationId: 'github', factoryProjectId: project.id, label: 'release', board: 'release' };
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ routes: [route], relocated: { moved: 0, skipped: 0 } });
      expect(await (await list(project.id)).json()).toEqual({ routes: [route] });
      expect(await (await list(other.id)).json()).toEqual({ routes: [] });
      expect(auditEvents.at(-1)).toEqual({
        action: 'factory.intake.label_route_updated',
        factoryProjectId: project.id,
        metadata: { board: 'release', relocated: { moved: 0, skipped: 0 } },
      });

      const cleared = await put({ integrationId: 'github', factoryProjectId: project.id, label: 'RELEASE' });
      expect(await cleared.json()).toEqual({ routes: [], relocated: { moved: 0, skipped: 0 } });
      expect(await (await list()).json()).toEqual({ routes: [] });
    });

    it('rejects uninstalled boards, unknown integrations, malformed bodies, and foreign projects', async () => {
      const project = await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'app' } });
      const foreign = await seed.projects.create({ orgId: 'org2', userId: 'u9', input: { name: 'other' } });
      const invalidBoard = await put({
        integrationId: 'github',
        factoryProjectId: project.id,
        label: 'release',
        board: 'hotfix',
      });
      expect(invalidBoard.status).toBe(422);
      expect(await invalidBoard.json()).toMatchObject({ error: 'invalid_board' });
      expect(
        (await put({ integrationId: 'jira', factoryProjectId: project.id, label: 'x', board: 'release' })).status,
      ).toBe(400);
      expect((await put({ integrationId: 'github', factoryProjectId: project.id, label: '   ' })).status).toBe(400);
      expect((await put({ integrationId: 'github', factoryProjectId: project.id })).status).toBe(400);
      expect(
        (await put({ integrationId: 'github', factoryProjectId: foreign.id, label: 'release', board: 'release' }))
          .status,
      ).toBe(404);
      expect(await (await list()).json()).toEqual({ routes: [] });
    });

    it('relocates labelled issue cards when a route is added and returns them when it is removed', async () => {
      const project = await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'app' } });
      const create = (
        externalId: string,
        labels: string[],
        stages: string[],
        extra: {
          type?: string;
          sessions?: Record<string, { sessionId: string; branch: string; threadId: string }>;
        } = {},
      ) =>
        seed.workItems.upsert({
          orgId: 'org1',
          userId: 'u1',
          factoryProjectId: project.id,
          input: {
            board: 'work',
            title: externalId,
            stages,
            sessions: extra.sessions ?? {},
            metadata: { labels },
            externalSource: {
              integrationId: 'github',
              type: extra.type ?? 'issue',
              externalId,
              url: `https://github.com/acme/app/${externalId}`,
            },
          },
        });
      const labelled = (await create('github-issue:1', ['Release'], ['intake'])).item;
      const parked = (await create('github-issue:2', ['bug', 'release'], ['triage'])).item;
      const running = (
        await create('github-issue:3', ['release'], ['triage'], {
          sessions: { triage: { sessionId: 's-1', branch: 'b', threadId: 't' } },
        })
      ).item;
      const finished = (await create('github-issue:4', ['release'], ['done'])).item;
      const unlabelled = (await create('github-issue:5', ['bug'], ['intake'])).item;
      const pullRequest = (await create('github-pr:6', ['release'], ['intake'], { type: 'pull-request' })).item;

      const response = await put({
        integrationId: 'github',
        factoryProjectId: project.id,
        label: 'release',
        board: 'release',
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ relocated: { moved: 2, skipped: 2 } });
      expect(auditEvents.at(-1)?.metadata).toEqual({ board: 'release', relocated: { moved: 2, skipped: 2 } });

      const byId = async () =>
        new Map((await seed.workItems.list({ orgId: 'org1', factoryProjectId: project.id })).map(i => [i.id, i]));
      let items = await byId();
      expect(items.get(labelled.id)).toMatchObject({ board: 'release', stages: ['queued'] });
      expect(items.get(parked.id)).toMatchObject({ board: 'release', stages: ['queued'] });
      expect(items.get(running.id)).toMatchObject({ board: 'work', stages: ['triage'] });
      expect(items.get(finished.id)).toMatchObject({ board: 'work', stages: ['done'] });
      expect(items.get(unlabelled.id)).toMatchObject({ board: 'work', stages: ['intake'] });
      expect(items.get(pullRequest.id)).toMatchObject({ board: 'work', stages: ['intake'] });

      // Re-saving the same route is a no-op for cards.
      const same = await put({
        integrationId: 'github',
        factoryProjectId: project.id,
        label: 'release',
        board: 'release',
      });
      expect(await same.json()).not.toHaveProperty('relocated');

      // Removing the route sends the movable cards back to Work's initial phase.
      const removed = await put({ integrationId: 'github', factoryProjectId: project.id, label: 'release' });
      expect(await removed.json()).toMatchObject({ routes: [], relocated: { moved: 2, skipped: 0 } });
      items = await byId();
      expect(items.get(labelled.id)).toMatchObject({ board: 'work', stages: ['intake'] });
      expect(items.get(parked.id)).toMatchObject({ board: 'work', stages: ['intake'] });
    });
  });

  it('rejects unknown integrations and invalid JSON', async () => {
    const unknown = await buildApp(orgUser).request('/web/intake/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jira: { enabled: true, sourceIds: null } }),
    });
    expect(unknown.status).toBe(400);

    const invalid = await buildApp(orgUser).request('/web/intake/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: 'bad-json',
    });
    expect(invalid.status).toBe(400);
  });

  it('drops disabled empty entries for unregistered integrations', async () => {
    const response = await buildApp(orgUser, [{ id: 'github', intake: github }]).request('/web/intake/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        github: { enabled: true, sourceIds: ['repo-1'] },
        linear: { enabled: false, sourceIds: null },
      }),
    });

    const config = { github: { enabled: true, sourceIds: ['repo-1'] } };
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ config });
    expect(await seed.intake.getConfig({ orgId: 'org1', userId: 'u1' })).toEqual(config);
    expect(auditEvents).toEqual([
      {
        action: 'factory.intake.config_updated',
        metadata: { github: { enabled: true, sources: 1 } },
      },
    ]);
  });

  it('rejects unregistered integrations with active selections', async () => {
    for (const selection of [
      { enabled: true, sourceIds: null },
      { enabled: false, sourceIds: ['team-1'] },
    ]) {
      const response = await buildApp(orgUser, [{ id: 'github', intake: github }]).request('/web/intake/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ github: { enabled: true, sourceIds: null }, linear: selection }),
      });
      expect(response.status).toBe(400);
    }
  });

  it('rejects an active selection sent under a prototype key', async () => {
    const response = await buildApp(orgUser, [{ id: 'github', intake: github }]).request('/web/intake/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: '{"github":{"enabled":true,"sourceIds":null},"__proto__":{"enabled":true,"sourceIds":["team-1"]}}',
    });

    expect(response.status).toBe(400);
    expect(auditEvents).toEqual([]);
  });
});

describe('aggregated intake', () => {
  it('lists normalized sources from every configured capability', async () => {
    const response = await buildApp(orgUser).request('/web/intake/sources');
    expect(await response.json()).toEqual({
      sources: [
        { integrationId: 'github', id: 'repo-1', name: 'acme/app', type: 'repository' },
        { integrationId: 'linear', id: 'team-1', name: 'Platform', type: 'project' },
      ],
      failures: [],
    });
  });

  it('lists selected items with generic external-source references and per-integration cursors', async () => {
    await seed.intake.saveConfig({
      orgId: 'org1',
      userId: 'u1',
      config: {
        github: { enabled: true, sourceIds: ['repo-1'] },
        linear: { enabled: true, sourceIds: ['team-1'] },
      },
    });

    const response = await buildApp(orgUser).request('/web/intake/items');
    const body = await response.json();
    expect(body.items).toEqual([
      expect.objectContaining({
        integrationId: 'github',
        title: 'Fix login',
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: '17',
          url: 'https://github.com/acme/app/issues/17',
        },
      }),
      expect.objectContaining({
        integrationId: 'linear',
        title: 'Ship project model',
        externalSource: {
          integrationId: 'linear',
          type: 'issue',
          externalId: 'ENG-9',
          url: 'https://linear.app/acme/issue/ENG-9',
        },
      }),
    ]);
    expect(typeof body.nextCursor).toBe('string');
  });

  it('keeps listing sources from the capabilities that answer when one is unavailable', async () => {
    vi.mocked(linear.listSources).mockRejectedValueOnce(new Error('Linear token expired'));

    const response = await buildApp(orgUser).request('/web/intake/sources');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sources: [{ integrationId: 'github', id: 'repo-1', name: 'acme/app', type: 'repository' }],
      failures: [{ integrationId: 'linear', message: 'Linear token expired' }],
    });
  });

  it('gives up on a capability that never answers instead of hanging the listing', async () => {
    vi.useFakeTimers();
    vi.mocked(linear.listSources).mockReturnValueOnce(new Promise(() => {}));

    const pending = buildApp(orgUser).request('/web/intake/sources');
    await vi.advanceTimersByTimeAsync(15_000);
    const response = await pending;
    vi.useRealTimers();

    expect(await response.json()).toEqual({
      sources: [{ integrationId: 'github', id: 'repo-1', name: 'acme/app', type: 'repository' }],
      failures: [{ integrationId: 'linear', message: 'linear did not answer within 15s' }],
    });
  });

  it('keeps listing items from the capabilities that answer and resumes an unavailable one at its cursor', async () => {
    await seed.intake.saveConfig({
      orgId: 'org1',
      userId: 'u1',
      config: {
        github: { enabled: true, sourceIds: ['repo-1'] },
        linear: { enabled: true, sourceIds: ['team-1'] },
      },
    });
    vi.mocked(linear.listItems).mockRejectedValueOnce(new Error('Bad gateway'));
    const cursor = Buffer.from(JSON.stringify({ linear: 'linear-page-2' })).toString('base64url');

    const response = await buildApp(orgUser).request(`/web/intake/items?cursor=${cursor}`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toEqual([expect.objectContaining({ integrationId: 'github', title: 'Fix login' })]);
    expect(body.failures).toEqual([{ integrationId: 'linear', message: 'Bad gateway' }]);
    expect(JSON.parse(Buffer.from(body.nextCursor, 'base64url').toString('utf8'))).toEqual({
      github: 'github-next',
      linear: 'linear-page-2',
    });
  });

  it('does not call disabled or unselected capabilities', async () => {
    await seed.intake.saveConfig({
      orgId: 'org1',
      userId: 'u1',
      config: {
        github: { enabled: false, sourceIds: ['repo-1'] },
        linear: { enabled: true, sourceIds: null },
      },
    });
    const response = await buildApp(orgUser).request('/web/intake/items');
    expect(await response.json()).toEqual({ items: [], nextCursor: null, failures: [] });
    expect(github.listItems).not.toHaveBeenCalled();
    expect(linear.listItems).not.toHaveBeenCalled();
  });
});

describe('parseIntakeConfig', () => {
  it('accepts arbitrary integration ids and defaults omitted source lists to null', () => {
    expect(parseIntakeConfig({ gitlab: { enabled: true }, jira: { enabled: false, sourceIds: ['board-1'] } })).toEqual({
      gitlab: { enabled: true, sourceIds: null },
      jira: { enabled: false, sourceIds: ['board-1'] },
    });
  });

  it('rejects malformed or duplicate source ids', () => {
    expect(parseIntakeConfig(null)).toBeNull();
    expect(parseIntakeConfig({ github: { enabled: 'yes' } })).toBeNull();
    expect(parseIntakeConfig({ github: { enabled: true, sourceIds: ['a', 'a'] } })).toBeNull();
  });
});
