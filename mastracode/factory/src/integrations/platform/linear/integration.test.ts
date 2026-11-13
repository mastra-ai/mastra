import { EventEmitterPubSub } from '@mastra/core/events';
import { RequestContext } from '@mastra/core/request-context';
import type { MastraWorker, WorkerDeps } from '@mastra/core/worker';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { createBoardRegistry } from '../../../boards/index.js';
import { createStateSigner } from '../../../state-signing.js';
import type { IntegrationContext } from '../../base.js';
import { EXTERNAL_SOURCE_MISSING_KEY } from '../../issue-reconciler.js';
import { attachLinearIssueReconciler } from '../../linear/issue-reconciler.js';
import { buildPlatformConnectRoutes } from '../connect/routes.js';
import { createPlatformStorageForTests, mountApiRoutes } from '../test-utils.js';
import { encodeSourceId, encodeTeamSourceId, PlatformLinearIntegration } from './integration.js';
import type { PlatformLinearIntegrationConfig } from './integration.js';
import { linearComment, linearIssue, linearWorkspace, startFakeLinear } from './test-utils.js';
import type { FakeLinear } from './test-utils.js';

const project1SourceId = encodeSourceId('workspace-1', 'project-1');
const project2SourceId = encodeSourceId('workspace-2', 'project-2');
const team1SourceId = encodeTeamSourceId('workspace-1', 'team-1');
const oauth = { type: 'oauth' as const, accessToken: 'unused-provider-token' };

function fakeAuth(tenant: { orgId?: string; userId: string } | undefined = { orgId: 'org-1', userId: 'user-1' }) {
  return {
    enabled: () => true,
    ensureUser: vi.fn(async () => ({ workosId: tenant?.userId ?? 'user-1', organizationId: tenant?.orgId })),
    tenant: () => tenant,
    isOrganizationAdmin: vi.fn(async () => true),
  };
}

/** A Linear GraphQL reply the fake proxy passes through, as Linear would answer. */
function graphql(data: unknown) {
  return { status: 200, body: { data } };
}

function issuePage(
  issues: ReturnType<typeof linearIssue>[],
  pageInfo: { hasNextPage: boolean; endCursor: string | null },
) {
  return graphql({ issues: { nodes: issues.map(issue => ({ ...issue, labels: { nodes: issue.labels } })), pageInfo } });
}

let fake: FakeLinear;

beforeEach(async () => {
  fake = await startFakeLinear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function createIntegration(config: PlatformLinearIntegrationConfig = {}): PlatformLinearIntegration {
  return new PlatformLinearIntegration({ connect: fake.platform.connect(), ...config });
}

async function setup(options: { config?: PlatformLinearIntegrationConfig; auth?: ReturnType<typeof fakeAuth> } = {}) {
  const seed = await createPlatformStorageForTests();
  const integration = createIntegration(options.config);
  const auth = options.auth ?? fakeAuth();
  const sourceControl = seed.sourceControl.forIntegration('linear');
  const runtime = { configVersion: 'v1', workItems: seed.workItems, boards: createBoardRegistry() };
  const ctx = {
    auth,
    baseUrl: 'https://factory.example',
    stateSigner: createStateSigner('test-secret'),
    storage: {
      generic: seed.integrations.forIntegration('linear'),
      sourceControl,
      sourceControls: [sourceControl],
      projects: seed.projects,
      intake: seed.intake,
    },
    runtime,
  } as unknown as IntegrationContext;
  integration.initialize({ projects: seed.projects, auth });
  const app = new Hono();
  mountApiRoutes(app, integration.routes(ctx));
  return { seed, integration, ctx, app, auth, runtime };
}

function workerDeps(pubsub = new EventEmitterPubSub()): WorkerDeps {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { pubsub, storage: {}, logger } as unknown as WorkerDeps;
}

/** Starts only the migration worker, as the Factory starts every integration worker at boot. */
async function startMigrationWorker(
  integration: PlatformLinearIntegration,
  ctx: IntegrationContext,
  pubsub?: EventEmitterPubSub,
): Promise<MastraWorker> {
  const worker = integration
    .workers(ctx)
    .find(candidate => candidate.name === 'linear-connect-migration-issue-reconcile');
  if (!worker) throw new Error('No Linear migration worker');
  await worker.init(workerDeps(pubsub));
  await worker.start();
  onTestFinished(async () => {
    await worker.stop();
    integration.migration.stop();
  });
  return worker;
}

/** Requests outside the Connect `/v2` API: any would be a legacy fallback. */
const nonConnectRequests = () => fake.platform.requests.filter(request => !request.path.startsWith('/v2/'));

describe('PlatformLinearIntegration', () => {
  describe('workspace status', () => {
    it.each([true, false])(
      'lists workspaces that need a fresh connect by name (healthy workspace present: %s)',
      async healthy => {
        if (healthy) fake.connect(linearWorkspace());
        const old = fake.connect(linearWorkspace('old', { name: 'Mastra' }));
        const { app, integration } = await setup();
        // Identified while it worked, then revoked.
        await integration.listWorkspaces();
        fake.setStatus(old, 'needs_reauth');
        integration.invalidateConnections();

        const response = await app.request('/web/linear/status');
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
          mode: 'platform',
          connected: healthy,
          workspaces: expect.arrayContaining([{ id: 'old', name: 'Mastra', urlKey: null, connected: false }]),
          requiresFreshConnect: [
            { connectionId: old, accountLabel: 'Mastra', linearWorkspaceId: 'old', requiresFreshConnect: true },
          ],
        });
      },
    );

    it('connects and reconnects workspaces through project-scoped Connect sessions', async () => {
      fake.connect(linearWorkspace());
      const { integration, auth } = await setup();
      const app = new Hono();
      mountApiRoutes(app, buildPlatformConnectRoutes({ auth, providers: integration.platformConnectProviders() }));

      const session = await app.request('/web/integrations/platform/linear/connect-session', { method: 'POST' });
      expect(session.status).toBe(201);
      expect(
        fake.platform.count('POST', `/v2/projects/${fake.platform.projectId}/integrations/linear/connect-sessions`),
      ).toBe(1);
      // Linear links only through migration and project-scoped sessions, never by linking org connections.
      const link = await app.request('/web/integrations/platform/linear/link-connections', { method: 'POST' });
      expect(link.status).toBe(404);
      await expect(link.json()).resolves.toEqual({ error: 'linking_not_supported' });
      expect(integration.diagnostics()).not.toHaveProperty('needsLinking');
    });

    it.each(['projects', 'issues'])(
      'keeps healthy workspace intake working when another workspace fails to load %s',
      async failedResource => {
        fake.connect(linearWorkspace());
        fake.connect(
          linearWorkspace('workspace-2', {
            name: 'Unavailable workspace',
            projects: [{ id: 'project-2', name: 'Platform', state: 'started', teams: [] }],
          }),
        );
        if (failedResource === 'projects') fake.override('workspace-2', 'Projects', () => ({ status: 503 }));
        fake.override('workspace-2', 'Intake', () => ({ status: 503 }));
        const { app, integration } = await setup();

        const response = await app.request('/web/linear/projects');
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
          projects: expect.arrayContaining([
            {
              id: project1SourceId,
              name: 'Platform',
              state: 'started',
              teams: [{ id: 'team-1', key: 'ENG', name: 'Engineering' }],
              workspaceId: 'workspace-1',
            },
          ]),
          workspaceErrors:
            failedResource === 'projects' ? [{ workspaceId: 'workspace-2', name: 'Unavailable workspace' }] : [],
        });
        const intake = await integration.intake.listIssues({
          connection: oauth,
          sourceIds: [project1SourceId, project2SourceId],
        });
        expect(intake.issues.map(item => item.identifier)).toEqual(['ENG-42']);
      },
    );

    it('reports a failed listing when no workspace could be read', async () => {
      fake.connect(linearWorkspace());
      fake.override('workspace-1', 'Projects', () => ({ status: 503 }));
      const { app } = await setup();
      const response = await app.request('/web/linear/projects');
      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toMatchObject({ error: 'linear_fetch_failed' });
    });

    it('fails a later issue page instead of ending the list when every remaining source fails', async () => {
      const project3Issue = linearIssue({ id: 'issue-3', identifier: 'ENG-43', project: { id: 'project-3' } });
      const workspace = linearWorkspace();
      workspace.projects.push({ ...workspace.projects[0]!, id: 'project-3' });
      fake.connect(workspace);
      fake.override('workspace-1', 'Intake', variables => {
        if (variables.after) return { status: 503 };
        const projectIds = variables.projectIds as string[];
        return projectIds.includes('project-3')
          ? issuePage([project3Issue], { hasNextPage: true, endCursor: 'page-2' })
          : undefined;
      });
      const { integration } = await setup();
      const sourceIds = [project1SourceId, encodeSourceId('workspace-1', 'project-3')];
      const first = await integration.intake.listIssues({ connection: oauth, sourceIds });
      expect(first.issues.map(item => item.identifier).sort()).toEqual(['ENG-42', 'ENG-43']);
      expect(first.nextCursor).toEqual(expect.any(String));
      await expect(
        integration.intake.listIssues({ connection: oauth, sourceIds, cursor: first.nextCursor ?? undefined }),
      ).rejects.toMatchObject({ status: 503 });
    });
  });

  describe('when issues belong to a Linear project', () => {
    it.each([project1SourceId, team1SourceId])(
      'lists the same project identity as the picker for source %s',
      async selectedSourceId => {
        fake.connect(linearWorkspace());
        const integration = createIntegration();
        const projects = await integration.listProjects();
        const result = await integration.intake.listIssues({ connection: oauth, sourceIds: [selectedSourceId] });
        expect(result.issues).toEqual([
          expect.objectContaining({ sourceId: selectedSourceId, projectId: projects[0]!.id }),
        ]);
      },
    );

    it('preserves the project identity during detail reads used to reconcile stored cards', async () => {
      fake.connect(linearWorkspace());
      await expect(
        createIntegration().intake.getIssue({ connection: oauth, sourceId: team1SourceId, issueId: 'issue-1' }),
      ).resolves.toMatchObject({ projectId: project1SourceId });
    });

    it.each(['workspace-1', 'workspace-2'])('scopes detail project identity to %s', async workspaceId => {
      fake.connect(linearWorkspace());
      fake.connect(linearWorkspace('workspace-2'));
      await expect(
        createIntegration().intake.getIssue({
          connection: oauth,
          sourceId: encodeTeamSourceId(workspaceId, 'team-1'),
          issueId: 'issue-1',
        }),
      ).resolves.toMatchObject({ projectId: encodeSourceId(workspaceId, 'project-1') });
    });

    it('preserves the project identity when a state update is already satisfied', async () => {
      fake.connect(linearWorkspace());
      await expect(
        createIntegration().intake.updateIssue({
          connection: oauth,
          sourceId: project1SourceId,
          issueId: 'issue-1',
          state: { kind: 'byName', name: 'Todo' },
        }),
      ).resolves.toMatchObject({ projectId: project1SourceId });
    });
  });

  describe('when an issue has no Linear project', () => {
    it('represents the missing project explicitly during reconciliation', async () => {
      fake.connect(linearWorkspace('workspace-1', { issues: [linearIssue({ project: null })] }));
      await expect(
        createIntegration().intake.getIssue({ connection: oauth, sourceId: team1SourceId, issueId: 'issue-1' }),
      ).resolves.toMatchObject({ projectId: null });
    });
  });

  describe('when stored Linear cards are reconciled', () => {
    it.each([
      { name: 'backfills older cards', metadata: {}, project: { id: 'project-1' }, expected: project1SourceId },
      {
        name: 'clears removed membership',
        metadata: { linearProjectId: project1SourceId },
        project: null,
        expected: null,
      },
      {
        name: 'updates moved membership',
        metadata: { linearProjectId: project1SourceId },
        project: { id: 'project-2' },
        expected: encodeSourceId('workspace-1', 'project-2'),
      },
    ])(
      '$name so filtering does not depend on the current intake page',
      async ({ metadata, project: linearProject, expected }) => {
        const issue = linearIssue({ project: linearProject });
        fake.connect(linearWorkspace('workspace-1', { issues: [issue] }));
        const seed = await createPlatformStorageForTests();
        const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
        const { item } = await seed.workItems.upsert({
          orgId: project.orgId,
          userId: project.createdBy,
          factoryProjectId: project.id,
          input: {
            externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear:ENG-42', url: issue.url },
            title: issue.title,
            stages: ['planning'],
            sessions: {},
            metadata: { ...metadata, linearIssueId: issue.id },
          },
        });
        const reconcile = attachLinearIssueReconciler(createIntegration(), {
          storage: { projects: seed.projects, intake: seed.intake },
          runtime: { configVersion: 'v1', workItems: seed.workItems, boards: createBoardRegistry() },
        });
        await expect(reconcile?.()).resolves.toMatchObject({ checked: 1, updated: 1, failed: 0 });
        await expect(seed.workItems.get({ orgId: project.orgId, id: item.id })).resolves.toMatchObject({
          workItem: expect.objectContaining({ metadata: expect.objectContaining({ linearProjectId: expected }) }),
        });
        await expect(reconcile?.()).resolves.toMatchObject({ checked: 1, updated: 0, failed: 0 });
      },
    );
  });

  describe('when a Linear issue is new to Factory', () => {
    async function firstSight() {
      fake.connect(linearWorkspace());
      const env = await setup();
      const factoryProject = await env.seed.projects.create({
        orgId: 'org-1',
        userId: 'user-1',
        input: { name: 'Factory' },
      });
      await env.seed.intake.saveConfig({
        orgId: 'org-1',
        config: { linear: { enabled: true, sourceIds: [project1SourceId] } },
      });
      await env.seed.intake.setBinding({
        orgId: 'org-1',
        integrationId: 'linear',
        sourceId: project1SourceId,
        factoryProjectId: factoryProject.id,
      });
      const filed = async () =>
        (await env.seed.workItems.listDeferredDecisions('org-1', factoryProject.id)).map(
          record => (record.decision as { sourceKey?: string }).sourceKey,
        );
      return { ...env, factoryProject, filed };
    }

    it('files it from the reconcile sweep with no board open', async () => {
      const { seed, integration, runtime, filed } = await firstSight();
      const reconcile = attachLinearIssueReconciler(integration, {
        storage: { projects: seed.projects, intake: seed.intake },
        runtime,
      });
      await expect(reconcile?.()).resolves.toMatchObject({ observed: 1, failed: 0 });
      expect(await filed()).toEqual(['linear:ENG-42']);
    });

    it('does not file it when someone views the board', async () => {
      const { app, factoryProject, filed } = await firstSight();
      const res = await app.request(`/web/linear/issues?factoryProjectId=${factoryProject.id}`);
      expect(res.status).toBe(200);
      expect((await res.json()).issues).toMatchObject([{ identifier: 'ENG-42' }]);
      expect(await filed()).toEqual([]);
    });
  });

  describe('migration to Mastra Connect', () => {
    it('migrates legacy workspaces at boot and serves them through Connect at once, with the same source ids', async () => {
      fake.addLegacy(linearWorkspace());
      const { app, integration, ctx } = await setup();
      const reconcile = vi.spyOn(integration, 'requestReconcile');

      // Before migration: no fallback, the status says why.
      await expect((await app.request('/web/linear/status')).json()).resolves.toMatchObject({
        connected: false,
        reason: 'migration_required',
        migration: { required: true, pending: ['workspace-1'] },
      });

      await startMigrationWorker(integration, ctx);
      await vi.waitFor(() => expect(integration.migration.state.lastRunAt).not.toBeNull());
      expect(fake.migrateRequests).toEqual([{ linearWorkspaceIds: ['workspace-1'] }]);
      expect(reconcile).toHaveBeenCalledOnce();

      // The listing cached before migration was dropped, so the migrated connection serves reads now.
      await expect((await app.request('/web/linear/status')).json()).resolves.toMatchObject({
        connected: true,
        reason: 'ready',
        migration: { required: false, pending: [] },
      });
      // Cards stored under legacy source ids keep resolving: the workspace id is Linear's organization id.
      await expect(
        integration.intake.listIssues({ connection: oauth, sourceIds: [project1SourceId] }),
      ).resolves.toMatchObject({ issues: [expect.objectContaining({ id: 'issue-1', sourceId: project1SourceId })] });
      expect(fake.ops().every(op => op.connectionId === 'conn-migrated-workspace-1')).toBe(true);
      expect(nonConnectRequests()).toEqual([]);
    });

    it('migrates on one replica at a time', async () => {
      fake.addLegacy(linearWorkspace());
      const first = await setup();
      const second = await setup();
      const pubsub = new EventEmitterPubSub();
      await Promise.all([
        startMigrationWorker(first.integration, first.ctx, pubsub),
        startMigrationWorker(second.integration, second.ctx, pubsub),
      ]);
      await vi.waitFor(() =>
        expect(
          first.integration.migration.state.lastRunAt ?? second.integration.migration.state.lastRunAt,
        ).not.toBeNull(),
      );
      // Give the other replica's boot tick time to run too.
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(fake.platform.count('POST', '/v2/integrations/linear/migrate')).toBe(1);
    });

    it('never migrates from read paths', async () => {
      fake.connect(linearWorkspace());
      fake.addLegacy(linearWorkspace('workspace-2', { name: 'Legacy' }));
      const { app, integration } = await setup();
      await integration.listWorkspaces();
      await app.request('/web/linear/status');
      await app.request('/web/linear/projects');
      await integration.intake.listIssues({ connection: oauth, sourceIds: [project1SourceId] });
      expect(fake.platform.count('POST', '/v2/integrations/linear/migrate')).toBe(0);
      expect(integration.diagnostics()).toMatchObject({ migration: { required: true, pending: ['workspace-2'] } });
    });

    it('skips a legacy workspace a linked Connect connection already serves', async () => {
      fake.connect(linearWorkspace());
      fake.addLegacy(linearWorkspace());
      fake.addLegacy(linearWorkspace('workspace-2', { name: 'Legacy' }));
      const { integration } = await setup();
      await expect(integration.migration.run('schedule')).resolves.toMatchObject({ requested: ['workspace-2'] });
      expect(fake.migrateRequests).toEqual([{ linearWorkspaceIds: ['workspace-2'] }]);
    });

    it('reports workspaces the platform skipped', async () => {
      fake.addLegacy(linearWorkspace());
      fake.nextMigrateReplies.push({
        status: 200,
        body: { connections: [], skipped: [{ linearWorkspaceId: 'workspace-1', reason: 'disconnected' }] },
      });
      const { integration } = await setup();
      await integration.migration.run('schedule');
      expect(integration.diagnostics()).toMatchObject({
        migration: {
          required: true,
          pending: ['workspace-1'],
          skipped: [{ linearWorkspaceId: 'workspace-1', reason: 'disconnected' }],
        },
      });
    });

    it('leaves Linear not connected when migration fails, retries with backoff, and never falls back', async () => {
      fake.addLegacy(linearWorkspace());
      fake.nextMigrateReplies.push({ status: 500, body: { title: 'boom' } });
      const { app, integration } = await setup();
      onTestFinished(() => integration.migration.stop());
      const timers = vi.spyOn(globalThis, 'setTimeout');
      const retry = vi.fn();

      await expect(integration.migration.sweep(retry)()).resolves.toMatchObject({ failed: 1 });
      expect(timers.mock.calls.some(([, delay]) => delay === 60_000)).toBe(true);
      await expect((await app.request('/web/linear/status')).json()).resolves.toMatchObject({
        connected: false,
        reason: 'migration_required',
        migration: { required: true, lastError: { message: expect.any(String) } },
      });
      // An unreachable workspace must not read as a deleted issue: that would close the card.
      await expect(
        integration.intake.getIssue({ connection: oauth, sourceId: project1SourceId, issueId: 'issue-1' }),
      ).rejects.toMatchObject({ status: 401 });
      expect(nonConnectRequests()).toEqual([]);

      // The next run succeeds and clears the error.
      await expect(integration.migration.sweep(retry)()).resolves.toMatchObject({ failed: 0, updated: 1 });
      expect(integration.migration.state).toMatchObject({ required: false, lastError: null });
    });

    it('cancels a pending migration retry when its worker stops', async () => {
      fake.addLegacy(linearWorkspace());
      fake.nextMigrateReplies.push({ status: 500, body: { title: 'boom' } });
      const { integration, ctx } = await setup();
      const setTimeouts = vi.spyOn(globalThis, 'setTimeout');
      const clearTimeouts = vi.spyOn(globalThis, 'clearTimeout');
      const worker = await startMigrationWorker(integration, ctx);
      await vi.waitFor(() => expect(integration.migration.state.lastError).not.toBeNull());
      const retry = setTimeouts.mock.results[setTimeouts.mock.calls.findIndex(([, delay]) => delay === 60_000)];
      expect(retry).toBeDefined();

      await worker.stop();
      expect(clearTimeouts).toHaveBeenCalledWith(retry!.value);
    });

    it('lets org admins retry migration, and counts a workspace another deployment migrated as success', async () => {
      fake.addLegacy(linearWorkspace());
      const { app, integration } = await setup();
      const reconcile = vi.spyOn(integration, 'requestReconcile');
      fake.nextMigrateReplies.push({
        status: 409,
        body: { type: 'linear_workspace_migrated', title: 'Conflict', status: 409 },
        contentType: 'application/problem+json',
      });
      const conflict = await app.request('/web/integrations/platform/linear/migrate', { method: 'POST' });
      expect(conflict.status).toBe(200);
      expect(reconcile).toHaveBeenCalledOnce();

      const retried = await app.request('/web/integrations/platform/linear/migrate', { method: 'POST' });
      expect(retried.status).toBe(200);
      await expect(retried.json()).resolves.toMatchObject({
        requested: ['workspace-1'],
        connections: [expect.objectContaining({ connectionId: 'conn-migrated-workspace-1', migrated: true })],
        migration: { required: false },
      });
      expect(reconcile).toHaveBeenCalledTimes(2);
    });

    it('refuses the migrate route to non-admins', async () => {
      fake.addLegacy(linearWorkspace());
      const auth = fakeAuth();
      auth.isOrganizationAdmin.mockResolvedValue(false);
      const { app } = await setup({ auth });
      const response = await app.request('/web/integrations/platform/linear/migrate', { method: 'POST' });
      expect(response.status).toBe(403);
      expect(fake.platform.count('POST', '/v2/integrations/linear/migrate')).toBe(0);
    });
  });

  describe('Connect connections', () => {
    it('neither links nor lists an org Linear connection that is not linked to the project', async () => {
      const unlinked = fake.connect(linearWorkspace(), { linked: false });
      const { integration, ctx } = await setup();
      await Promise.all(integration.workers(ctx).map(async worker => worker.init(workerDeps())));
      await expect(integration.listWorkspaces()).resolves.toEqual([]);
      expect(fake.platform.count('POST', `/v2/projects/${fake.platform.projectId}/connections/${unlinked}`)).toBe(0);
    });

    it('serves a workspace with two connections from the newest and reports the other as its duplicate', async () => {
      const older = fake.connect(linearWorkspace(), {
        connectionId: 'conn-older',
        connectedAt: '2026-10-01T00:00:00.000Z',
      });
      const newer = fake.connect(linearWorkspace(), {
        connectionId: 'conn-newer',
        connectedAt: '2026-11-01T00:00:00.000Z',
      });
      const { app, integration } = await setup();
      await expect(integration.listWorkspaces()).resolves.toEqual([
        expect.objectContaining({ connectionId: newer, linearWorkspaceId: 'workspace-1' }),
      ]);
      await expect((await app.request('/web/linear/status')).json()).resolves.toMatchObject({
        duplicates: [{ connectionId: older, linearWorkspaceId: 'workspace-1', duplicateOf: newer }],
      });
      await integration.intake.listIssues({ connection: oauth, sourceIds: [project1SourceId] });
      expect(fake.ops('Intake').map(op => op.connectionId)).toEqual([newer]);
    });

    it('asks for a fresh connect when the platform says the connection needs reauth, but not for a provider 409', async () => {
      const revoked = fake.connect(linearWorkspace());
      fake.connect(linearWorkspace('workspace-2'));
      fake.override('workspace-2', 'Viewer', () => ({ status: 409, body: { errors: [{ message: 'Conflict' }] } }));
      const { integration } = await setup();
      // The listing still says active; the proxy answers with the platform's problem.
      const fakeProxy = fake.platform.proxy;
      fake.platform.proxy = (connectionId, path, query, body) =>
        connectionId === revoked
          ? {
              status: 409,
              body: { type: 'connection_needs_reauth', title: 'Reauth', status: 409 },
              contentType: 'application/problem+json',
            }
          : fakeProxy(connectionId, path, query, body);
      await expect(integration.intake.inventory()).resolves.toEqual({
        workspaces: [],
        duplicates: [],
        unusable: [
          { connectionId: revoked, accountLabel: 'Acme', linearWorkspaceId: null, requiresFreshConnect: true },
        ],
        // A provider 409 is a failed lookup, retried later, not a fresh connect.
        unidentified: [{ connectionId: 'conn-workspace-2', error: expect.any(String) }],
      });
    });

    it('identifies each connection once and keeps the identity until its connection changes', async () => {
      fake.connect(linearWorkspace());
      const { integration } = await setup();
      await integration.listWorkspaces();
      await integration.listWorkspaces();
      await integration.intake.listIssues({ connection: oauth, sourceIds: [project1SourceId] });
      expect(fake.ops('Viewer')).toHaveLength(1);
    });
  });

  describe('workers', () => {
    it('registers the issue reconcile worker and the migration worker, and no event poller', async () => {
      const { integration, ctx } = await setup();
      expect(
        integration
          .workers(ctx)
          .map(worker => worker.name)
          .sort(),
      ).toEqual(['linear-connect-migration-issue-reconcile', 'linear-issue-reconcile']);
    });

    it('keeps migrating when issue reconciliation is disabled', async () => {
      vi.stubEnv('MASTRACODE_LINEAR_ISSUE_RECONCILE_ENABLED', 'false');
      const { integration, ctx } = await setup();
      expect(integration.workers(ctx).map(worker => worker.name)).toEqual(['linear-connect-migration-issue-reconcile']);
    });
  });

  it('does not expose the Platform credential through synthetic Linear connections', async () => {
    fake.connect(linearWorkspace());
    const integration = createIntegration();
    const storedConnection = await integration.storage.connections.get('org-1');
    const loadedConnection = await integration.loadConnection('org-1');
    if (!loadedConnection) throw new Error('Expected a connected Platform Linear workspace.');
    expect(storedConnection?.data.accessToken).not.toBe('platform-secret');
    expect(loadedConnection.accessToken).not.toBe('platform-secret');
    await expect(integration.getFreshAccessToken(loadedConnection)).resolves.not.toBe('platform-secret');
  });

  it('reports a workspace link slug only when exactly one workspace is connected', async () => {
    fake.connect(linearWorkspace());
    const other = fake.connect(linearWorkspace('workspace-2', { name: 'Other', urlKey: 'other' }));
    const integration = createIntegration();
    await expect(integration.checkConnection('org-1')).resolves.toMatchObject({
      connected: true,
      workspaceUrlKey: null,
    });

    fake.platform.orgConnections = fake.platform.orgConnections.filter(connection => connection.id !== other);
    integration.invalidateConnections();
    await expect(integration.checkConnection('org-1')).resolves.toMatchObject({
      connected: true,
      workspaceUrlKey: 'acme',
    });
  });

  it('checks the connection from a single workspace snapshot', async () => {
    fake.connect(linearWorkspace());
    fake.connect(linearWorkspace('workspace-2', { name: 'Other', urlKey: 'other' }));
    const integration = createIntegration();
    await expect(integration.checkConnection('org-1')).resolves.toMatchObject({
      connected: true,
      workspaceUrlKey: null,
    });
    expect(fake.platform.count('GET', `/v2/projects/${fake.platform.projectId}/connections`)).toBe(1);
  });

  it('resolves dispatch context with the platform-managed token when a workspace is connected', async () => {
    fake.connect(linearWorkspace());
    const resolved = await createIntegration().intake.resolveIntakeDispatch({
      orgId: 'org-1',
      externalSource: { type: 'issue', externalId: 'issue-1' },
    });
    expect(resolved).toMatchObject({ connection: { type: 'oauth' }, issueId: 'issue-1' });
    expect((resolved?.connection as { accessToken?: string }).accessToken).not.toBe('platform-secret');
  });

  it('resolves issue dispatch without a connected workspace and leaves the read to say it is unreachable', async () => {
    const integration = createIntegration();
    // `null` here would tell the reconciler the card is gone; an unreachable workspace isn't that.
    const dispatch = await integration.intake.resolveIntakeDispatch({
      orgId: 'org-1',
      externalSource: { type: 'issue', externalId: 'issue-1' },
    });
    expect(dispatch).toMatchObject({ issueId: 'issue-1' });
    await expect(integration.intake.getIssue({ ...dispatch!, issueId: 'issue-1' })).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      integration.intake.resolveIntakeDispatch({
        orgId: 'org-1',
        externalSource: { type: 'pull-request', externalId: 'x' },
      }),
    ).resolves.toBeNull();
  });

  it('reports an unscoped issue as gone only once every workspace is reachable', async () => {
    fake.addLegacy(linearWorkspace('workspace-legacy', { issues: [linearIssue({ id: 'issue-legacy' })] }));
    fake.connect(linearWorkspace());
    const integration = createIntegration();
    // The legacy workspace hasn't moved yet, so its issue can't be called deleted.
    await expect(integration.intake.getIssue({ connection: oauth, issueId: 'issue-legacy' })).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining('has not finished'),
    });
    await expect(
      integration.intake.createComment({ connection: oauth, issueId: 'issue-legacy', body: 'hi' }),
    ).rejects.toMatchObject({ status: 401 });

    await integration.migration.run('admin');
    expect(integration.migration.settled).toBe(true);
    await expect(integration.intake.getIssue({ connection: oauth, issueId: 'issue-legacy' })).resolves.toMatchObject({
      id: 'issue-legacy',
    });
    await expect(integration.intake.getIssue({ connection: oauth, issueId: 'ENG-404' })).resolves.toBeNull();
  });

  it('refuses to report an unscoped issue as gone while a connection needs a fresh connect', async () => {
    fake.connect(linearWorkspace());
    fake.connect(linearWorkspace('workspace-2'), { status: 'needs_reauth' });
    const integration = createIntegration();
    await integration.migration.refreshStatus();
    await expect(integration.intake.getIssue({ connection: oauth, issueId: 'ENG-404' })).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining('fresh connect'),
    });
  });

  it('refuses to report an unscoped issue as gone while a connection fails to identify its workspace', async () => {
    fake.connect(linearWorkspace());
    fake.connect(linearWorkspace('workspace-2', { issues: [linearIssue({ id: 'issue-2', identifier: 'OPS-1' })] }));
    fake.override('workspace-2', 'Viewer', () => ({ status: 503 }));
    const integration = createIntegration();
    await integration.migration.refreshStatus();
    await expect(integration.intake.getIssue({ connection: oauth, issueId: 'issue-2' })).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining("didn't answer"),
    });
    fake.overrides.delete('workspace-2:Viewer');
    await expect(integration.intake.getIssue({ connection: oauth, issueId: 'issue-2' })).resolves.toMatchObject({
      id: 'issue-2',
    });
  });

  it('refuses to report an unscoped issue as gone when a connection fails to identify itself just once', async () => {
    fake.connect(linearWorkspace());
    fake.connect(linearWorkspace('workspace-2', { issues: [linearIssue({ id: 'issue-2', identifier: 'OPS-1' })] }));
    let failures = 0;
    fake.override('workspace-2', 'Viewer', () => (failures-- > 0 ? { status: 503 } : undefined));
    const integration = createIntegration();
    await integration.migration.refreshStatus();
    integration.intake.clearCaches();
    failures = 1;
    // The lookup searched a snapshot without workspace-2; a later snapshot that has it must not turn that into "gone".
    await expect(integration.intake.getIssue({ connection: oauth, issueId: 'issue-2' })).rejects.toMatchObject({
      status: 401,
    });
    await expect(integration.intake.getIssue({ connection: oauth, issueId: 'issue-2' })).resolves.toMatchObject({
      id: 'issue-2',
    });
  });

  it('knows which workspace a migrated connection served after a restart, so its fresh replacement unblocks "gone"', async () => {
    fake.addLegacy(linearWorkspace());
    const first = createIntegration();
    await first.migration.run('admin');
    const migrated = 'conn-migrated-workspace-1';
    fake.setStatus(migrated, 'needs_reauth');
    fake.connect(linearWorkspace(), { connectionId: 'conn-fresh', connectedAt: '2026-12-01T00:00:00.000Z' });
    // A new process has no identity cache; only the platform's migration status says what the stale connection served.
    const restarted = createIntegration();
    await restarted.migration.refreshStatus();
    await expect(restarted.intake.getIssue({ connection: oauth, issueId: 'ENG-404' })).resolves.toBeNull();
    await expect(restarted.intake.inventory()).resolves.toMatchObject({
      unusable: [{ connectionId: migrated, linearWorkspaceId: 'workspace-1' }],
    });
  });

  it('settles once a migrated workspace whose connection was deleted is served by a fresh connect', async () => {
    fake.addLegacy(linearWorkspace());
    const integration = createIntegration();
    await integration.migration.run('admin');
    fake.dropConnection('conn-migrated-workspace-1');
    fake.connect(linearWorkspace(), { connectionId: 'conn-fresh', connectedAt: '2026-12-01T00:00:00.000Z' });
    integration.invalidateConnections();
    await integration.migration.run('schedule');
    expect(integration.migration.settled).toBe(true);
    expect(fake.migrateRequests).toHaveLength(1);
  });

  it('settles when a migrated workspace lost its connection and nothing serves it, and an admin retry asks again', async () => {
    fake.addLegacy(linearWorkspace());
    const integration = createIntegration();
    await integration.migration.run('admin');
    fake.dropConnection('conn-migrated-workspace-1');
    integration.invalidateConnections();
    await expect(integration.migration.run('schedule')).resolves.toMatchObject({
      skipped: [{ linearWorkspaceId: 'workspace-1', reason: 'connection_inactive' }],
    });
    expect(integration.migration.settled).toBe(true);
    await integration.migration.run('schedule');
    expect(fake.migrateRequests).toHaveLength(2);
    await integration.migration.run('admin');
    expect(fake.migrateRequests).toHaveLength(3);
  });

  it('stops counting a stale connection that needs a fresh connect once a newer one serves its workspace', async () => {
    const stale = fake.connect(linearWorkspace(), {
      connectionId: 'conn-stale',
      connectedAt: '2026-10-01T00:00:00.000Z',
    });
    const integration = createIntegration();
    await integration.migration.refreshStatus();
    await integration.listWorkspaces(); // Factory has seen the stale connection serve workspace-1.
    fake.setStatus(stale, 'needs_reauth');
    fake.connect(linearWorkspace(), { connectionId: 'conn-fresh', connectedAt: '2026-11-01T00:00:00.000Z' });
    integration.invalidateConnections();
    await expect(integration.intake.getIssue({ connection: oauth, issueId: 'ENG-404' })).resolves.toBeNull();
  });

  it('keeps a pre-migration reconcile from marking a card missing, so the post-migration reconcile refreshes it', async () => {
    fake.addLegacy(linearWorkspace());
    const seed = await createPlatformStorageForTests();
    const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
    const { item } = await seed.workItems.upsert({
      orgId: project.orgId,
      userId: project.createdBy,
      factoryProjectId: project.id,
      input: {
        externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear:ENG-42', url: linearIssue().url },
        title: 'ENG-42: Fix intake',
        stages: ['planning'],
        sessions: {},
        metadata: { linearIssueId: 'issue-1' },
      },
    });
    const integration = createIntegration();
    const reconcile = attachLinearIssueReconciler(integration, {
      storage: { projects: seed.projects, intake: seed.intake },
      runtime: { configVersion: 'v1', workItems: seed.workItems, boards: createBoardRegistry() },
    })!;
    const metadata = async () =>
      (await seed.workItems.get({ orgId: project.orgId, id: item.id }))?.workItem.metadata ?? {};

    // Boot: the reconcile runs before the workspace has moved. A failure, retried later; not "gone".
    await expect(reconcile()).resolves.toMatchObject({ checked: 1, missing: 0, failed: 1 });
    expect(await metadata()).not.toHaveProperty(EXTERNAL_SOURCE_MISSING_KEY);

    await integration.migration.run('boot');
    await expect(reconcile()).resolves.toMatchObject({ checked: 1, updated: 1, missing: 0, failed: 0 });
    expect(await metadata()).toMatchObject({ identifier: 'ENG-42', linearStateType: 'unstarted' });
  });

  it('lists connected workspace projects and teams as Intake sources', async () => {
    fake.connect(linearWorkspace());
    fake.connect(linearWorkspace('old'), { status: 'needs_reauth' });
    await expect(createIntegration().intake.listSources({ orgId: 'org-1', userId: 'user-1' })).resolves.toEqual([
      {
        id: project1SourceId,
        name: 'Platform',
        type: 'project',
        metadata: expect.objectContaining({ workspaceId: 'workspace-1', workspaceName: 'Acme', state: 'started' }),
      },
      {
        id: team1SourceId,
        name: 'Engineering',
        type: 'team',
        metadata: expect.objectContaining({ workspaceId: 'workspace-1', workspaceName: 'Acme', teamKey: 'ENG' }),
      },
    ]);
    expect(fake.ops().every(op => op.workspaceId === 'workspace-1')).toBe(true);
  });

  it('normalizes active project issues and filters labels client-side', async () => {
    fake.connect(
      linearWorkspace('workspace-1', {
        issues: [
          linearIssue(),
          linearIssue({ id: 'issue-2', identifier: 'ENG-43', labels: [{ id: 'label-2', name: 'feature' }] }),
        ],
      }),
    );
    await expect(
      createIntegration().intake.listIssues({ connection: oauth, sourceIds: [project1SourceId], labels: ['bug'] }),
    ).resolves.toEqual({
      issues: [
        expect.objectContaining({
          id: 'issue-1',
          identifier: 'ENG-42',
          // Must match the intake binding key so board routing can resolve it.
          sourceId: project1SourceId,
          source: 'ENG',
          stateType: 'unstarted',
          priority: 'High',
          assignee: 'Ada',
          labels: ['bug'],
        }),
      ],
      nextCursor: null,
    });
    expect(fake.ops('Intake')).toEqual([
      expect.objectContaining({
        workspaceId: 'workspace-1',
        variables: expect.objectContaining({
          projectIds: ['project-1'],
          stateTypes: ['triage', 'backlog', 'unstarted', 'started'],
        }),
      }),
    ]);
    expect(fake.ops('Intake')[0]!.variables).not.toHaveProperty('labels');
  });

  it('does not fetch issues from attribution-only workspaces', async () => {
    fake.connect(linearWorkspace());
    fake.connect(
      linearWorkspace('workspace-2', {
        name: 'Other',
        projects: [{ id: 'project-2', name: 'Other project', state: 'started', teams: [] }],
      }),
    );
    fake.override('workspace-2', 'Intake', () => ({ status: 503 }));
    const result = await createIntegration().intake.listIssues({
      connection: oauth,
      sourceIds: [project1SourceId],
      attributionSourceIds: [project1SourceId, project2SourceId],
    });
    expect(result.issues).toEqual([expect.objectContaining({ id: 'issue-1', sourceId: project1SourceId })]);
    expect(fake.ops('Intake').some(op => op.workspaceId === 'workspace-2')).toBe(false);
  });

  it('does not discover sources from attribution-only workspaces during team intake', async () => {
    fake.connect(linearWorkspace('workspace-1', { issues: [linearIssue({ project: null })] }));
    fake.connect(linearWorkspace('workspace-2', { name: 'Other' }));
    fake.override('workspace-2', 'Teams', () => ({ status: 503 }));
    const result = await createIntegration().intake.listIssues({
      connection: oauth,
      sourceIds: [team1SourceId],
      attributionSourceIds: [team1SourceId, project2SourceId],
    });
    expect(result.issues).toEqual([expect.objectContaining({ id: 'issue-1', sourceId: team1SourceId })]);
    expect(fake.ops('Teams').some(op => op.workspaceId === 'workspace-2')).toBe(false);
    expect(fake.ops('Projects')).toEqual([]);
  });

  it('lists a team source with teamIds (no projectIds) and returns projectless issues', async () => {
    fake.connect(
      linearWorkspace('workspace-1', {
        issues: [linearIssue({ id: 'issue-9', identifier: 'ENG-9', project: null, labels: [] })],
      }),
    );
    const result = await createIntegration().intake.listIssues({ connection: oauth, sourceIds: [team1SourceId] });
    expect(result.issues).toEqual([
      expect.objectContaining({ id: 'issue-9', identifier: 'ENG-9', sourceId: team1SourceId }),
    ]);
    const [intake] = fake.ops('Intake');
    expect(intake!.variables).toMatchObject({
      teamIds: ['team-1'],
      stateTypes: ['triage', 'backlog', 'unstarted', 'started'],
    });
    expect(intake!.variables).not.toHaveProperty('projectIds');
  });

  it('dedupes an issue selected via both a team and its project, project wins (most-specific)', async () => {
    fake.connect(
      linearWorkspace('workspace-1', {
        issues: [linearIssue(), linearIssue({ id: 'issue-2', identifier: 'ENG-99', project: null, labels: [] })],
      }),
    );
    const result = await createIntegration().intake.listIssues({
      connection: oauth,
      sourceIds: [project1SourceId, team1SourceId],
    });
    expect(result.issues).toHaveLength(2);
    expect(result.issues.find(issue => issue.id === 'issue-1')!.sourceId).toBe(project1SourceId);
    expect(result.issues.find(issue => issue.id === 'issue-2')!.sourceId).toBe(team1SourceId);
  });

  it('keeps a selected-project issue out of an earlier team page', async () => {
    fake.connect(linearWorkspace());
    fake.override('workspace-1', 'Intake', variables =>
      variables.projectIds ? issuePage([], { hasNextPage: true, endCursor: 'project-next' }) : undefined,
    );
    const result = await createIntegration().intake.listIssues({
      connection: oauth,
      sourceIds: [project1SourceId, team1SourceId],
    });
    expect(result.issues).toEqual([]);
    expect(result.nextCursor).not.toBeNull();
  });

  it('fetches issue details with comments and creates comments through the source workspace', async () => {
    const issue = linearIssue();
    fake.connect(linearWorkspace('workspace-1', { comments: { 'issue-1': [linearComment(issue)] } }));
    const integration = createIntegration();

    await expect(
      integration.intake.getIssue({ connection: oauth, sourceId: project1SourceId, issueId: 'ENG-42' }),
    ).resolves.toEqual(
      expect.objectContaining({
        description: 'Issue body',
        commentCount: 1,
        comments: [{ author: 'Ada', body: 'Looking now', createdAt: '2026-07-03T00:00:00Z' }],
      }),
    );
    await expect(
      integration.intake.createComment({
        connection: oauth,
        sourceId: project1SourceId,
        issueId: 'ENG-42',
        body: 'Done',
      }),
    ).resolves.toEqual({ id: 'comment-2', url: `${issue.url}#comment-2` });
    expect(fake.ops('IssueDetail')[0]!.variables).toMatchObject({ id: 'ENG-42' });
    // Writes take the issue's UUID, not its identifier.
    expect(fake.ops('CommentCreate')[0]!.variables).toEqual({ input: { issueId: 'issue-1', body: 'Done' } });
  });

  it('uses an opaque team source for issue reads, comments, and updates', async () => {
    fake.connect(linearWorkspace());
    fake.connect(linearWorkspace('workspace-2'));
    const integration = createIntegration();

    await expect(
      integration.intake.getIssue({ connection: oauth, sourceId: team1SourceId, issueId: 'ENG-42' }),
    ).resolves.toMatchObject({ id: 'issue-1' });
    await expect(
      integration.intake.createComment({ connection: oauth, sourceId: team1SourceId, issueId: 'ENG-42', body: 'Done' }),
    ).resolves.toMatchObject({ id: 'comment-1' });
    await expect(
      integration.intake.updateIssue({
        connection: oauth,
        sourceId: team1SourceId,
        issueId: 'ENG-42',
        state: { kind: 'byType', stateType: 'unstarted' },
      }),
    ).resolves.toMatchObject({ id: 'issue-1', stateType: 'unstarted' });
    const dataOps = fake.ops().filter(op => op.operation !== 'Viewer');
    expect(dataOps.length).toBeGreaterThan(0);
    expect(dataOps.every(op => op.workspaceId === 'workspace-1')).toBe(true);
  });

  it('resolves a byType target to a workflow state and updates the Linear issue', async () => {
    fake.connect(linearWorkspace());
    const result = await createIntegration().intake.updateIssue({
      connection: oauth,
      sourceId: project1SourceId,
      issueId: 'issue-1',
      state: { kind: 'byType', stateType: 'completed' },
    });
    expect(result).toMatchObject({ id: 'issue-1', state: 'Done', stateType: 'completed', projectId: project1SourceId });
    expect(fake.ops('UpdateIssueState')).toEqual([
      expect.objectContaining({ workspaceId: 'workspace-1', variables: { id: 'issue-1', stateId: 'state-done' } }),
    ]);
  });

  it('skips the update when the current byType state already matches', async () => {
    fake.connect(linearWorkspace());
    const result = await createIntegration().intake.updateIssue({
      connection: oauth,
      sourceId: project1SourceId,
      issueId: 'issue-1',
      state: { kind: 'byType', stateType: 'unstarted' },
    });
    expect(result).toMatchObject({ stateType: 'unstarted', projectId: project1SourceId });
    expect(fake.ops('UpdateIssueState')).toEqual([]);
  });

  it('returns null when no workflow state matches the byType target', async () => {
    fake.connect(
      linearWorkspace('workspace-1', {
        states: { 'team-1': [{ id: 'state-todo', name: 'Todo', type: 'unstarted', position: 1 }] },
      }),
    );
    await expect(
      createIntegration().intake.updateIssue({
        connection: oauth,
        sourceId: project1SourceId,
        issueId: 'issue-1',
        state: { kind: 'byType', stateType: 'completed' },
      }),
    ).resolves.toBeNull();
    expect(fake.ops('UpdateIssueState')).toEqual([]);
  });

  it("returns null when Linear can't list the team's workflow states", async () => {
    fake.connect(linearWorkspace());
    fake.override('workspace-1', 'TeamStates', () => graphql({ team: null }));
    await expect(
      createIntegration().intake.updateIssue({
        connection: oauth,
        sourceId: project1SourceId,
        issueId: 'issue-1',
        state: { kind: 'byType', stateType: 'completed' },
      }),
    ).resolves.toBeNull();
    expect(fake.ops('UpdateIssueState')).toEqual([]);
  });

  it('searches connected workspaces when issue operations have no source id and returns null when none has it', async () => {
    fake.connect(linearWorkspace());
    fake.connect(linearWorkspace('workspace-2', { name: 'Second' }));
    const integration = createIntegration();
    await integration.migration.refreshStatus();
    await expect(integration.intake.getIssue({ connection: oauth, issueId: 'ENG-404' })).resolves.toBeNull();
    expect(
      fake
        .ops('IssueDetail')
        .map(op => op.workspaceId)
        .sort(),
    ).toEqual(['workspace-1', 'workspace-2']);
  });

  it('probes only routed workspaces while retaining complete source precedence', async () => {
    const workspace2TeamSource = encodeTeamSourceId('workspace-2', 'team-2');
    fake.connect(linearWorkspace());
    fake.connect(
      linearWorkspace('workspace-2', {
        issues: [
          linearIssue({ id: 'issue-correct', project: null, team: { id: 'team-2', key: 'ENG', name: 'Engineering' } }),
        ],
      }),
    );
    fake.override('workspace-1', 'IssueDetail', () => ({ status: 503 }));
    await expect(
      createIntegration().fetchIssueDetail(
        'unused-provider-token',
        'ENG-42',
        [project1SourceId, team1SourceId, workspace2TeamSource],
        [workspace2TeamSource],
      ),
    ).resolves.toMatchObject({ id: 'issue-correct', workspaceId: 'workspace-2', teamId: 'team-2' });
    expect(fake.ops('IssueDetail').map(op => op.workspaceId)).toEqual(['workspace-2']);
  });

  it('tracks independent cursors when selected projects span workspaces', async () => {
    fake.connect(linearWorkspace());
    fake.connect(
      linearWorkspace('workspace-2', {
        name: 'Second',
        projects: [{ id: 'project-2', name: 'Product', state: 'started', teams: [] }],
      }),
    );
    fake.override('workspace-2', 'Intake', () =>
      issuePage([linearIssue({ id: 'issue-2', identifier: 'ENG-43', project: { id: 'project-2' } })], {
        hasNextPage: true,
        endCursor: 'next-2',
      }),
    );
    const integration = createIntegration();
    const result = await integration.intake.listItems({
      orgId: 'org-1',
      userId: 'user-1',
      sourceIds: [project1SourceId, project2SourceId],
    });
    expect(result.items).toHaveLength(2);
    expect(JSON.parse(Buffer.from(result.nextCursor!, 'base64url').toString('utf8'))).toEqual({
      v: 1,
      sourceSet: expect.any(String),
      cursors: [null, 'next-2'],
    });
    await expect(
      integration.intake.listItems({
        orgId: 'org-1',
        userId: 'user-1',
        sourceIds: [project1SourceId],
        cursor: result.nextCursor!,
      }),
    ).rejects.toMatchObject({ code: 'invalid_cursor' });
  });

  it('rejects a team page that hands back the cursor it was asked for', async () => {
    fake.connect(linearWorkspace());
    // Every page claims more follows and repeats the same cursor.
    fake.override('workspace-1', 'Teams', () =>
      graphql({
        teams: {
          nodes: [{ id: 'team-1', key: 'ENG', name: 'Engineering' }],
          pageInfo: { hasNextPage: true, endCursor: 'stuck' },
        },
      }),
    );
    await expect(
      createIntegration().intake.listIssues({
        connection: oauth,
        sourceIds: [team1SourceId],
        attributionSourceIds: [team1SourceId],
      }),
    ).rejects.toMatchObject({ code: 'invalid_cursor' });
    // The first page is asked without a cursor and the second with it; nothing beyond that.
    expect(fake.ops('Teams')).toHaveLength(2);
  });

  it('rejects an issue page that hands back the cursor it was asked for', async () => {
    fake.connect(linearWorkspace());
    fake.override('workspace-1', 'Intake', () => issuePage([linearIssue()], { hasNextPage: true, endCursor: 'stuck' }));
    const integration = createIntegration();
    const first = await integration.intake.listItems({
      orgId: 'org-1',
      userId: 'user-1',
      sourceIds: [project1SourceId],
    });
    expect(first.nextCursor).not.toBeNull();
    await expect(
      integration.intake.listItems({
        orgId: 'org-1',
        userId: 'user-1',
        sourceIds: [project1SourceId],
        cursor: first.nextCursor!,
      }),
    ).rejects.toMatchObject({ code: 'invalid_cursor' });
  });

  it('propagates Linear rate limits through Linear capabilities', async () => {
    fake.connect(linearWorkspace());
    fake.override('workspace-1', 'Projects', () => ({
      status: 429,
      body: { errors: [{ message: 'Rate limited', extensions: { code: 'RATELIMITED' } }] },
      headers: { 'retry-after': '11' },
    }));
    await expect(
      createIntegration().intake.listIssues({ connection: oauth, sourceIds: [project1SourceId] }),
    ).rejects.toMatchObject({ status: 429, code: 'RATELIMITED', retryAfterSeconds: 11 });
  });

  it('rejects GitHub-style app-installation connections', async () => {
    await expect(
      createIntegration().intake.listIssues({
        connection: { type: 'app-installation', installationId: 7 },
        sourceIds: ['project-1'],
      }),
    ).rejects.toThrow('Linear capabilities require an OAuth connection.');
  });

  it('exposes platform-backed route and agent-tool surfaces', async () => {
    fake.connect(linearWorkspace());
    const { app, integration, seed, ctx } = await setup();
    const projectRecord = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Acme app' } });
    const routes = integration.routes(ctx);
    expect(integration.id).toBe('linear');
    expect(integration.intake).toBeDefined();
    expect('versionControl' in integration).toBe(false);
    expect(routes.map(route => route.path)).toEqual(
      expect.arrayContaining([
        '/web/integrations/platform/linear/migrate',
        '/web/linear/status',
        '/web/linear/projects',
        '/web/linear/teams',
        '/web/linear/issues',
      ]),
    );
    // Workspaces connect through Connect sessions, never Linear OAuth.
    expect(routes.some(route => route.path.startsWith('/auth/linear/'))).toBe(false);

    await expect((await app.request('/web/linear/status')).json()).resolves.toMatchObject({
      enabled: true,
      connected: true,
      reason: 'ready',
      workspace: { name: 'Acme', urlKey: 'acme' },
      migration: { required: false, pending: [], skipped: [] },
    });
    const teams = await app.request('/web/linear/teams');
    expect(teams.status).toBe(200);
    await expect(teams.json()).resolves.toEqual({
      workspaceErrors: [],
      teams: [{ id: 'team-1', key: 'ENG', name: 'Engineering', workspaceId: 'workspace-1', sourceId: team1SourceId }],
    });
    expect(
      integration.sourceMatchesIssue(team1SourceId, { workspaceId: 'workspace-1', projectId: null, teamId: 'team-1' }),
    ).toBe(true);
    const requestContext = new RequestContext();
    requestContext.set('controller', { resourceId: projectRecord.id, getState: () => ({}) });
    await expect(integration.agentTools({ requestContext })).resolves.toEqual(
      expect.objectContaining({ linear_get_issue: expect.anything(), linear_create_comment: expect.anything() }),
    );
    expect(integration.diagnostics()).toEqual({
      configured: true,
      mode: 'platform',
      endpointHost: new URL(fake.platform.baseUrl).host,
      migration: { required: false, pending: [], skipped: [] },
    });
    expect(JSON.stringify(integration.diagnostics())).not.toContain('platform-secret');
  });

  it('runs custom Linear rules on Platform issues from the sweep, not from board reads', async () => {
    fake.connect(linearWorkspace());
    const onEvent = vi.fn();
    const { app, seed, ctx, integration } = await setup({ config: { rules: { issueObserved: onEvent } } });
    const projectRecord = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Acme app' } });
    await seed.intake.saveConfig({
      orgId: 'org-1',
      config: { linear: { enabled: true, sourceIds: [project1SourceId] } },
    });
    // The sweep only ingests sources explicitly bound to the project.
    await seed.intake.setBinding({
      orgId: 'org-1',
      userId: 'user-1',
      integrationId: 'linear',
      sourceId: project1SourceId,
      factoryProjectId: projectRecord.id,
    });

    const response = await app.request(`/web/linear/issues?factoryProjectId=${projectRecord.id}`);
    expect(response.status).toBe(200);
    expect(onEvent).not.toHaveBeenCalled();
    await expect(attachLinearIssueReconciler(integration, ctx)?.()).resolves.toMatchObject({ observed: 1, failed: 0 });
    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'issueObserved',
        issue: expect.objectContaining({ id: 'issue-1', identifier: 'ENG-42' }),
      }),
    );
    const detail = await app.request(`/web/linear/issues/ENG-42?factoryProjectId=${projectRecord.id}`);
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toMatchObject({
      identifier: 'ENG-42',
      title: 'Fix intake',
      description: 'Issue body',
    });
  });

  it('defaults the integrations API URL and requires a platform credential', () => {
    vi.stubEnv('MASTRA_INTEGRATIONS_API_URL', '');
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'platform-secret');
    expect(new PlatformLinearIntegration().diagnostics()).toMatchObject({
      mode: 'platform',
      endpointHost: 'integrations.mastra.ai',
    });

    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', '');
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'injected-token');
    expect(() => new PlatformLinearIntegration()).not.toThrow();

    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
    expect(() => new PlatformLinearIntegration()).toThrow(/MASTRA_PLATFORM_ACCESS_TOKEN/);
  });
});
