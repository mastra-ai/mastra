import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Intake } from '../capabilities/intake.js';
import { PlatformGithubIntegration } from '../integrations/platform/github/integration.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { IntakeRoutes, parseIntakeBinding, parseIntakeConfig } from './intake.js';
import { ProjectRoutes } from './projects.js';
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
    }).routes(),
  );
  return app;
}

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
    expect(await seed.intake.getConfig({ orgId: 'org1' })).toEqual(config);
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

  it("accepts GitHub's Dependabot opt-in under its own id and rejects it when GitHub is absent", async () => {
    vi.stubEnv('MASTRA_INTEGRATIONS_API_URL', 'https://platform.test');
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'test-key');
    const platformGithub = new PlatformGithubIntegration();
    vi.unstubAllEnvs();
    const withGithub = [{ id: 'github', intake: github }, ...platformGithub.additionalIntakes];
    const config = { dependabot: { enabled: true, sourceIds: ['acme/app'] } };
    const put = (app: Hono) =>
      app.request('/web/intake/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(config),
      });

    expect((await put(buildApp(orgUser, integrations))).status).toBe(400);

    const response = await put(buildApp(orgUser, withGithub));
    expect(response.status).toBe(200);
    expect((await response.json()).config.dependabot).toEqual(config.dependabot);
    expect(await seed.intake.getConfig({ orgId: 'org1', integrationIds: ['dependabot'] })).toEqual(config);
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

      const bindings = [
        {
          integrationId: 'linear',
          sourceId: 'team-1',
          factoryProjectId: project.id,
          labels: null,
          createdAt: expect.any(String),
        },
      ];
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ bindings });
      expect(await (await buildApp(orgUser).request('/web/intake/bindings')).json()).toEqual({ bindings });
      expect(auditEvents).toEqual([
        {
          action: 'factory.intake.binding_updated',
          factoryProjectId: project.id,
          metadata: { factoryProjectId: project.id, labels: null },
        },
      ]);
    });

    it('ignores a board an older client still sends and leaves the cards where they are', async () => {
      const project = await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'app' } });
      const { item } = await seed.workItems.upsert({
        orgId: 'org1',
        userId: 'u1',
        factoryProjectId: project.id,
        input: {
          board: 'work',
          title: 'ENG-1',
          stages: ['intake'],
          externalSource: {
            integrationId: 'linear',
            type: 'issue',
            externalId: 'linear:ENG-1',
            url: 'https://linear.app/acme/issue/ENG-1',
          },
        },
      });

      const response = await put({
        integrationId: 'linear',
        sourceId: 'team-1',
        factoryProjectId: project.id,
        board: 'release',
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).not.toHaveProperty('relocated');
      expect(body.bindings[0]).not.toHaveProperty('board');
      expect(linear.listItems).not.toHaveBeenCalled();
      expect(await seed.workItems.get({ orgId: 'org1', id: item.id })).toMatchObject({
        board: 'work',
        stages: ['intake'],
      });
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
          metadata: { factoryProjectId: null, labels: null },
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

  describe('Jira bindings shared by label', () => {
    const jira: Pick<Intake, 'listSources' | 'listItems' | 'bindingLabelFilters'> = {
      bindingLabelFilters: true,
      listSources: vi.fn(async () => [{ id: '10000', name: 'OPS', type: 'project' }]),
      listItems: vi.fn(async () => ({ items: [], nextCursor: null })),
    };
    const withJira = [...integrations, { id: 'jira', intake: jira }];
    const app = () => buildApp(orgUser, withJira);
    const put = (body: unknown) =>
      app().request('/web/intake/bindings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    const remove = (query: Record<string, string>) =>
      app().request(`/web/intake/bindings?${new URLSearchParams(query)}`, { method: 'DELETE' });
    const factories = async () => {
      const create = (name: string) => seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name } });
      return { platform: await create('platform'), payments: await create('payments'), mobile: await create('mobile') };
    };
    const ops = { integrationId: 'jira', sourceId: '10000' };
    const summary = (bindings: Array<{ factoryProjectId: string; labels: string[] | null }>) =>
      bindings.map(({ factoryProjectId, labels }) => ({ factoryProjectId, labels }));

    it('lets several factories take their own labelled slice of one Jira project', async () => {
      const { platform, payments, mobile } = await factories();
      expect((await put({ ...ops, factoryProjectId: platform.id })).status).toBe(200);
      expect((await put({ ...ops, factoryProjectId: payments.id, labels: ['payments'] })).status).toBe(200);
      const response = await put({ ...ops, factoryProjectId: mobile.id, labels: ['mobile', 'ios'] });

      expect(response.status).toBe(200);
      const expected = [
        { factoryProjectId: platform.id, labels: null },
        { factoryProjectId: payments.id, labels: ['payments'] },
        { factoryProjectId: mobile.id, labels: ['mobile', 'ios'] },
      ];
      // Bindings saved within one millisecond share a timestamp, so compare without order.
      const saved = summary((await response.json()).bindings);
      expect(saved).toHaveLength(3);
      expect(saved).toEqual(expect.arrayContaining(expected));
      expect(summary((await (await app().request('/web/intake/bindings')).json()).bindings)).toEqual(saved);
      expect(auditEvents.at(-1)).toEqual({
        action: 'factory.intake.binding_updated',
        factoryProjectId: mobile.id,
        metadata: { factoryProjectId: mobile.id, labels: ['mobile', 'ios'] },
      });
    });

    it('rejects overlapping labels and a second all-issues binding with binding_conflict', async () => {
      const { platform, payments, mobile } = await factories();
      await put({ ...ops, factoryProjectId: platform.id });
      await put({ ...ops, factoryProjectId: payments.id, labels: ['payments'] });

      const overlap = await put({ ...ops, factoryProjectId: mobile.id, labels: ['Payments', 'ios'] });
      expect(overlap.status).toBe(409);
      expect(await overlap.json()).toEqual({
        error: 'binding_conflict',
        message: 'Already routed to another factory: payments.',
        conflicts: [{ factoryProjectId: payments.id, labels: ['payments'] }],
      });
      const allIssues = await put({ ...ops, factoryProjectId: mobile.id, labels: null });
      expect(allIssues.status).toBe(409);
      expect(await allIssues.json()).toMatchObject({ conflicts: [{ factoryProjectId: platform.id, labels: null }] });
      expect(await seed.intake.listBindings({ orgId: 'org1', integrationId: 'jira' })).toHaveLength(2);
    });

    it('refuses a binding whose factory is deleted while the request is in flight, so its successor can bind', async () => {
      const { platform, payments } = await factories();
      const projectsApp = new Hono();
      projectsApp.use('*', async (c, next) => {
        c.set('factoryAuthUser' as never, orgUser as never);
        await next();
      });
      mountApiRoutes(
        projectsApp,
        new ProjectRoutes({
          auth: fakeRouteAuth(),
          projects: seed.projects,
          sourceControl: seed.sourceControl,
          intake: seed.intake,
        }).routes(),
      );
      const write = seed.intake.setSharedBinding.bind(seed.intake);
      const { promise: writing, resolve: startWriting } = Promise.withResolvers<void>();
      const { promise: deleted, resolve: finishDelete } = Promise.withResolvers<void>();
      vi.spyOn(seed.intake, 'setSharedBinding').mockImplementationOnce(async input => {
        startWriting();
        await deleted;
        return write(input);
      });

      const inFlight = put({ ...ops, factoryProjectId: platform.id });
      await writing;
      expect((await projectsApp.request(`/web/factory/projects/${platform.id}`, { method: 'DELETE' })).status).toBe(
        204,
      );
      finishDelete();

      expect((await inFlight).status).toBe(404);
      expect((await put({ ...ops, factoryProjectId: payments.id })).status).toBe(200);
      expect(summary(await seed.intake.listBindings({ orgId: 'org1', integrationId: 'jira' }))).toEqual([
        { factoryProjectId: payments.id, labels: null },
      ]);
    });

    it('keeps the label filter when a save omits labels, and clears it with labels: null', async () => {
      const { payments } = await factories();
      await put({ ...ops, factoryProjectId: payments.id, labels: ['payments'] });

      await put({ ...ops, factoryProjectId: payments.id });
      expect(await seed.intake.getBinding({ orgId: 'org1', ...ops, factoryProjectId: payments.id })).toMatchObject({
        labels: ['payments'],
      });

      await put({ ...ops, factoryProjectId: payments.id, labels: null });
      expect(
        (await seed.intake.getBinding({ orgId: 'org1', ...ops, factoryProjectId: payments.id }))?.labels,
      ).toBeNull();
    });

    it('rejects an empty label list, a label with a space, and unbinding a Jira project through PUT', async () => {
      const { payments } = await factories();
      expect((await put({ ...ops, factoryProjectId: payments.id, labels: [] })).status).toBe(400);
      expect((await put({ ...ops, factoryProjectId: payments.id, labels: ['  '] })).status).toBe(400);
      expect((await put({ ...ops, factoryProjectId: payments.id, labels: ['needs triage'] })).status).toBe(400);
      const unbind = await put({ ...ops, factoryProjectId: null });
      expect(unbind.status).toBe(400);
      expect(await unbind.json()).toMatchObject({ error: 'use_delete' });
    });

    it("removes one factory's binding with DELETE and leaves the rest of the project's bindings", async () => {
      const { platform, payments } = await factories();
      await put({ ...ops, factoryProjectId: platform.id });
      await put({ ...ops, factoryProjectId: payments.id, labels: ['payments'] });

      const response = await remove({ ...ops, factoryProjectId: payments.id });

      expect(response.status).toBe(200);
      expect(summary((await response.json()).bindings)).toEqual([{ factoryProjectId: platform.id, labels: null }]);
      expect(auditEvents.at(-1)).toEqual({
        action: 'factory.intake.binding_updated',
        factoryProjectId: payments.id,
        metadata: { factoryProjectId: null, labels: null },
      });
      expect((await remove({ ...ops, factoryProjectId: payments.id })).status).toBe(404);
    });

    it('unroutes a binding whose factory was deleted, so another factory can take all issues', async () => {
      const { platform, payments } = await factories();
      await put({ ...ops, factoryProjectId: platform.id });
      await seed.projects.delete({ orgId: 'org1', id: platform.id });
      expect((await put({ ...ops, factoryProjectId: payments.id })).status).toBe(409);

      const unrouted = await remove({ ...ops, factoryProjectId: platform.id });

      expect(unrouted.status).toBe(200);
      expect((await put({ ...ops, factoryProjectId: payments.id })).status).toBe(200);
      expect(summary(await seed.intake.listBindings({ orgId: 'org1' }))).toEqual([
        { factoryProjectId: payments.id, labels: null },
      ]);
    });

    it('rejects DELETE without every identifier, or for another org', async () => {
      const { payments } = await factories();
      const foreign = await seed.projects.create({ orgId: 'org2', userId: 'u2', input: { name: 'other' } });
      expect((await remove({ integrationId: 'jira', sourceId: '10000' })).status).toBe(400);
      expect((await remove({ integrationId: 'jira', factoryProjectId: payments.id })).status).toBe(400);
      expect((await remove({ ...ops, integrationId: 'unknown', factoryProjectId: payments.id })).status).toBe(400);
      expect((await remove({ ...ops, factoryProjectId: foreign.id })).status).toBe(404);
      expect(
        (
          await buildApp(null, withJira).request(`/web/intake/bindings?${new URLSearchParams(ops)}`, {
            method: 'DELETE',
          })
        ).status,
      ).toBe(401);
    });

    it('keeps moving a Linear source between factories and rejects label filters for it', async () => {
      const { platform, payments } = await factories();
      const linearSource = { integrationId: 'linear', sourceId: 'team-1' };
      await put({ ...linearSource, factoryProjectId: platform.id });
      await put({ ...linearSource, factoryProjectId: payments.id });
      expect(summary(await seed.intake.listBindings({ orgId: 'org1', integrationId: 'linear' }))).toEqual([
        { factoryProjectId: payments.id, labels: null },
      ]);

      const labelled = await put({ ...linearSource, factoryProjectId: payments.id, labels: ['bug'] });
      expect(labelled.status).toBe(400);
      expect((await put({ ...linearSource, factoryProjectId: null })).status).toBe(200);
      expect(await seed.intake.listBindings({ orgId: 'org1', integrationId: 'linear' })).toEqual([]);
    });

    it('never writes the frozen pre-upgrade bindings collection', async () => {
      const { platform, payments } = await factories();
      await put({ ...ops, factoryProjectId: platform.id });
      await put({ ...ops, factoryProjectId: payments.id, labels: ['payments'] });
      await put({ integrationId: 'linear', sourceId: 'team-1', factoryProjectId: platform.id });
      await remove({ ...ops, factoryProjectId: payments.id });

      expect(await seed.storage.ops.findMany('intake_source_bindings', {})).toEqual([]);
    });
  });

  describe('label routes', () => {
    it('answers 410 to old clients now that intake routes place cards', async () => {
      const project = await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'app' } });
      const app = buildApp(orgUser);
      const read = await app.request(`/web/intake/label-routes?factoryProjectId=${project.id}`);
      const write = await app.request('/web/intake/label-routes', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          integrationId: 'github',
          factoryProjectId: project.id,
          label: 'release',
          board: 'work',
        }),
      });

      for (const response of [read, write]) {
        expect(response.status).toBe(410);
        expect(await response.json()).toMatchObject({ error: 'label_routes_removed' });
      }
      expect(auditEvents).toEqual([]);
      expect((await buildApp(null).request('/web/intake/label-routes')).status).toBe(401);
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

  it('keeps a stored custom integration selection when a save omits it', async () => {
    const app = buildApp(orgUser, [...integrations, { id: 'custom-tracker', intake: linear }]);
    const put = (body: unknown) =>
      app.request('/web/intake/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    const custom = { enabled: false, sourceIds: ['src-1'] };

    expect((await put({ 'custom-tracker': custom })).status).toBe(200);
    const response = await put({
      github: { enabled: true, sourceIds: ['repo-1'] },
      linear: { enabled: false, sourceIds: null },
    });

    const expected = {
      github: { enabled: true, sourceIds: ['repo-1'] },
      linear: { enabled: false, sourceIds: null },
      'custom-tracker': custom,
    };
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ config: expected });
    expect(await (await app.request('/web/intake/config')).json()).toEqual({ config: expected });

    await put({ github: { enabled: false, sourceIds: null } });
    expect(await (await app.request('/web/intake/config')).json()).toEqual({
      config: { ...expected, github: { enabled: false, sourceIds: null } },
    });
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
    expect(await seed.intake.getConfig({ orgId: 'org1' })).toEqual(config);
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

  it("lists only the requested integration's sources without asking the others", async () => {
    const response = await buildApp(orgUser).request('/web/intake/sources?integrationId=github');
    expect(await response.json()).toEqual({
      sources: [{ integrationId: 'github', id: 'repo-1', name: 'acme/app', type: 'repository' }],
      failures: [],
    });
    expect(vi.mocked(linear.listSources)).not.toHaveBeenCalled();
  });

  it('lists selected items with generic external-source references and per-integration cursors', async () => {
    await seed.intake.saveConfig({
      orgId: 'org1',
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

  it('accepts encoded source ids up to the shared selection and binding limit', () => {
    const sourceId = 'gitlab-project:' + 'a'.repeat(900);
    expect(parseIntakeConfig({ gitlab: { enabled: true, sourceIds: [sourceId] } })?.gitlab?.sourceIds).toEqual([
      sourceId,
    ]);
    expect(parseIntakeBinding({ integrationId: 'gitlab', sourceId, factoryProjectId: 'factory-1' })).toMatchObject({
      sourceId,
    });
    expect(parseIntakeConfig({ gitlab: { enabled: true, sourceIds: ['a'.repeat(1025)] } })).toBeNull();
  });

  it('rejects malformed or duplicate source ids', () => {
    expect(parseIntakeConfig(null)).toBeNull();
    expect(parseIntakeConfig({ github: { enabled: 'yes' } })).toBeNull();
    expect(parseIntakeConfig({ github: { enabled: true, sourceIds: ['a', 'a'] } })).toBeNull();
  });
});
