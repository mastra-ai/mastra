import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FactorySandbox } from '@mastra/core/workspace';
import type { FactorySandboxContext } from '@mastra/core/workspace';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import { SourceControlStorage } from '../storage/domains/source-control/base.js';
import { ProjectRoutes } from './projects.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

class SettingsSandbox extends FactorySandbox<{ cpuCount?: number; memoryMb?: number }> {
  readonly provider = 'test';
  readonly settings = {
    type: 'object',
    properties: {
      cpuCount: { type: 'integer', minimum: 1 },
      memoryMb: { type: 'integer', minimum: 512 },
    },
    additionalProperties: false,
    // Each patch can be valid on its own but invalid when combined.
    not: {
      required: ['cpuCount', 'memoryMb'],
      properties: { cpuCount: { const: 8 }, memoryMb: { const: 512 } },
    },
  } as const;
  create(_ctx: FactorySandboxContext) {
    throw new Error('not constructed in route tests');
  }
}

const cases = [
  {
    name: 'keeps both disjoint patches',
    initial: {},
    left: { cpuCount: 8 },
    right: { memoryMb: 2048 },
    expected: { cpuCount: 8, memoryMb: 2048 },
    statuses: [200, 200],
  },
  {
    name: 'keeps a key clear alongside a disjoint patch',
    initial: { cpuCount: 4 },
    left: { cpuCount: null },
    right: { memoryMb: 2048 },
    expected: { memoryMb: 2048 },
    statuses: [200, 200],
  },
  {
    name: 'validates the combined settings before accepting a patch',
    initial: {},
    left: { cpuCount: 8 },
    right: { memoryMb: 512 },
    expected: undefined,
    statuses: [200, 400],
  },
];

// Set FACTORY_TEST_POSTGRES_URL to a disposable database to also exercise independent PostgreSQL pools.
const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])(
  'environment settings across independent %s clients',
  backend => {
    it.each(cases)('$name', async ({ initial, left, right, expected, statuses }) => {
      const directory = await mkdtemp(join(tmpdir(), 'factory-settings-'));
      const url = `file:${join(directory, 'settings.db')}`;
      const backends = ['left', 'right'].map(id =>
        backend === 'postgres'
          ? new PgFactoryStorage({ id, connectionString: postgresUrl! })
          : new LibSQLFactoryStorage({ id, url }),
      );
      let projectId: string | undefined;
      try {
        const clients = [];
        for (const storage of backends) {
          const projects = storage.registerDomain(new FactoryProjectsStorage());
          const sourceControl = storage.registerDomain(new SourceControlStorage());
          await storage.init();
          const app = new Hono();
          app.use('*', async (context, next) => {
            context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
            await next();
          });
          mountApiRoutes(
            app as never,
            new ProjectRoutes({
              auth: fakeRouteAuth(),
              projects,
              sourceControl,
              sandbox: new SettingsSandbox(),
            }).routes(),
          );
          clients.push({ app, projects });
        }
        const [first, second] = clients;
        const project = await first!.projects.create({
          orgId: 'org-1',
          userId: 'user-1',
          input: { name: 'Concurrent' },
        });
        projectId = project.id;
        await first!.projects.update({ orgId: 'org-1', id: project.id, input: { sandboxSettings: initial } });

        // Both HTTP requests must finish their initial project read before either proceeds.
        // The database reads/writes remain real, using distinct connections to the same file.
        const readsReady = Promise.withResolvers<void>();
        let reads = 0;
        for (const { projects } of clients) {
          const get = projects.get.bind(projects);
          vi.spyOn(projects, 'get').mockImplementationOnce(async args => {
            const snapshot = await get(args);
            if (++reads === 2) readsReady.resolve();
            await readsReady.promise;
            return snapshot;
          });
        }
        const patch = (app: Hono, settings: Record<string, unknown>) =>
          app.request(`/web/factory/projects/${project.id}/environment`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ settings }),
          });
        const responses = await Promise.all([patch(first!.app, left), patch(second!.app, right)]);
        expect(responses.map(response => response.status).sort()).toEqual(statuses);
        const stored = await first!.projects.getById({ id: project.id });
        if (expected) expect(stored?.sandboxSettings).toEqual(expected);
        else {
          const accepted = responses[0]!.status === 200 ? left : right;
          expect(stored?.sandboxSettings).toEqual(accepted);
          const rejected = responses.find(response => response.status === 400)!;
          expect(await rejected.json()).toMatchObject({ error: 'invalid_environment' });
        }
      } finally {
        try {
          if (projectId) await backends[0]!.ops.deleteMany('factory_projects', { id: projectId });
        } finally {
          await Promise.all(backends.map(storage => storage.close()));
          await rm(directory, { recursive: true, force: true });
        }
      }
    });
  },
);

type UpdateManyArgs = [table: string, filter: { id?: string }, values: { position?: number }];

describe.each(['libsql', 'libsql-memory', ...(postgresUrl ? ['postgres'] : [])])(
  'environment repository order across independent %s clients',
  backend => {
    async function withEnvironment(
      run: (env: {
        apps: Hono[];
        projects: FactoryProjectsStorage;
        projectId: string;
        docs: string;
        api: string;
        /** Wraps every database `updateMany`, inside and outside transactions. */
        intercept: (handler: (args: UpdateManyArgs, write: () => Promise<unknown>) => Promise<unknown>) => void;
        positions: () => Promise<Record<string, number>>;
      }) => Promise<void>,
    ) {
      const directory = await mkdtemp(join(tmpdir(), 'factory-order-'));
      const url = `file:${join(directory, 'order.db')}`;
      // An in-memory database lives in one client, so that backend gets a single client.
      const backends = (backend === 'libsql-memory' ? ['only'] : ['left', 'right']).map(id =>
        backend === 'postgres'
          ? new PgFactoryStorage({ id, connectionString: postgresUrl! })
          : new LibSQLFactoryStorage({ id, url: backend === 'libsql-memory' ? ':memory:' : url }),
      );
      let projectId: string | undefined;
      try {
        const apps: Hono[] = [];
        let projects: FactoryProjectsStorage | undefined;
        let sourceControl: SourceControlStorage | undefined;
        for (const storage of backends) {
          projects = storage.registerDomain(new FactoryProjectsStorage());
          sourceControl = storage.registerDomain(new SourceControlStorage());
          await storage.init();
          const app = new Hono();
          app.use('*', async (context, next) => {
            context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
            await next();
          });
          mountApiRoutes(
            app as never,
            new ProjectRoutes({
              auth: fakeRouteAuth(),
              projects,
              sourceControl,
              versionControlIntegrationIds: ['github'],
            }).routes(),
          );
          apps.push(app);
        }
        const project = await projects!.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Ordered' } });
        projectId = project.id;
        const github = sourceControl!.forIntegration('github');
        const installation = await github.installations.upsert({
          orgId: 'org-1',
          connectedByUserId: 'user-1',
          externalId: `gh-${project.id}`,
          accountName: 'acme',
        });
        const connection = await github.connections.create({
          orgId: 'org-1',
          factoryProjectId: project.id,
          installationId: installation.id,
          createdByUserId: 'user-1',
        });
        const ids: string[] = [];
        for (const slug of ['acme/docs', 'acme/api']) {
          const repository = await github.repositories.upsert({
            orgId: 'org-1',
            input: {
              installationId: installation.id,
              externalId: `${project.id}/${slug}`,
              slug,
              defaultBranch: 'main',
            },
          });
          const link = await github.projectRepositories.link({
            orgId: 'org-1',
            connectionId: connection.id,
            repositoryId: repository.id,
            createdByUserId: 'user-1',
            branch: 'main',
            sandboxProvider: 'local',
            sandboxWorkdir: '/workspace',
          });
          await github.projectRepositories.update({ orgId: 'org-1', id: link.id, input: { position: ids.length + 1 } });
          ids.push(link.id);
        }
        const [docs, api] = ids as [string, string];
        // Ops created inside and outside transactions share one prototype per backend.
        const prototype = Object.getPrototypeOf(backends[0]!.ops) as { updateMany: (...args: unknown[]) => unknown };
        const original = prototype.updateMany;
        const intercept: Parameters<typeof run>[0]['intercept'] = handler => {
          vi.spyOn(prototype, 'updateMany').mockImplementation(function (this: unknown, ...args: unknown[]) {
            return handler(args as UpdateManyArgs, async () => original.apply(this, args));
          });
        };
        const positions = async () =>
          Object.fromEntries(
            (await github.projectRepositories.listByProject({ orgId: 'org-1', factoryProjectId: project.id })).map(
              link => [link.id === docs ? 'docs' : 'api', link.position],
            ),
          );
        await run({ apps, projects: projects!, projectId: project.id, docs, api, intercept, positions });
      } finally {
        vi.restoreAllMocks();
        try {
          if (projectId) await backends[0]!.ops.deleteMany('factory_projects', { id: projectId });
        } finally {
          await Promise.all(backends.map(storage => storage.close()));
          await rm(directory, { recursive: true, force: true });
        }
      }
    }

    const patch = (app: Hono, projectId: string, body: unknown) =>
      app.request(`/web/factory/projects/${projectId}/environment`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    it('leaves the project and every link unchanged when a link write fails partway', async () => {
      await withEnvironment(async ({ apps, projects, projectId, docs, api, intercept, positions }) => {
        let linkWrites = 0;
        intercept(async ([table], write) => {
          if (table === 'factory_project_repositories' && ++linkWrites === 2) throw new Error('disk full');
          return write();
        });
        const response = await patch(apps[0]!, projectId, {
          workspaceSetupCommand: 'pnpm -r build',
          repositories: [
            { projectRepositoryId: api, position: 1 },
            { projectRepositoryId: docs, position: 2 },
          ],
        });
        vi.restoreAllMocks();
        expect(response.status).toBe(500);
        expect(await positions()).toEqual({ docs: 1, api: 2 });
        expect(await projects.getById({ id: projectId })).toMatchObject({ workspaceSetupCommand: null });
      });
    });

    it.skipIf(backend === 'libsql-memory')(
      'applies two concurrent reorders one after the other instead of mixing them',
      async () => {
        await withEnvironment(async ({ apps, projectId, docs, api, intercept, positions }) => {
          const swapStarted = Promise.withResolvers<void>();
          const keepDone = Promise.withResolvers<void>();
          let paused = false;
          intercept(async ([table, filter, values], write) => {
            const result = await write();
            // Hold the swap after its first link write until the other reorder finishes (or a
            // transaction keeps it from starting).
            if (table === 'factory_project_repositories' && filter.id === docs && values.position === 2 && !paused) {
              paused = true;
              swapStarted.resolve();
              await Promise.race([keepDone.promise, new Promise(resolve => setTimeout(resolve, 300))]);
            }
            return result;
          });
          const swap = patch(apps[0]!, projectId, {
            repositories: [
              { projectRepositoryId: docs, position: 2 },
              { projectRepositoryId: api, position: 1 },
            ],
          });
          await swapStarted.promise;
          const keep = patch(apps[1]!, projectId, {
            repositories: [
              { projectRepositoryId: docs, position: 1 },
              { projectRepositoryId: api, position: 2 },
            ],
          }).finally(() => keepDone.resolve());
          expect((await Promise.all([swap, keep])).map(response => response.status)).toEqual([200, 200]);
          vi.restoreAllMocks();
          expect([
            { docs: 2, api: 1 },
            { docs: 1, api: 2 },
          ]).toContainEqual(await positions());
        });
      },
    );
  },
);

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])(
  'environment build claims across independent %s clients',
  backend => {
    async function withClients(
      run: (env: {
        clients: FactoryProjectsStorage[];
        projectId: string;
        /** Holds the first `factory_projects` read until `release` resolves or 300ms pass. */
        holdFirstProjectRead: (release: Promise<unknown>) => Promise<void>;
      }) => Promise<void>,
    ) {
      const directory = await mkdtemp(join(tmpdir(), 'factory-build-'));
      const url = `file:${join(directory, 'build.db')}`;
      const backends = ['left', 'right'].map(id =>
        backend === 'postgres'
          ? new PgFactoryStorage({ id, connectionString: postgresUrl! })
          : new LibSQLFactoryStorage({ id, url }),
      );
      let projectId: string | undefined;
      try {
        const clients: FactoryProjectsStorage[] = [];
        for (const storage of backends) {
          clients.push(storage.registerDomain(new FactoryProjectsStorage()));
          await storage.init();
        }
        const project = await clients[0]!.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Builds' } });
        projectId = project.id;
        // Ops created inside and outside transactions share one prototype per backend.
        const prototype = Object.getPrototypeOf(backends[0]!.ops) as { findOne: (...args: unknown[]) => unknown };
        const original = prototype.findOne;
        const holdFirstProjectRead = (release: Promise<unknown>) => {
          const held = Promise.withResolvers<void>();
          let holding = true;
          vi.spyOn(prototype, 'findOne').mockImplementation(async function (this: unknown, ...args: unknown[]) {
            const row = await original.apply(this, args);
            if (args[0] === 'factory_projects' && holding) {
              holding = false;
              held.resolve();
              await Promise.race([release, new Promise(resolve => setTimeout(resolve, 300))]);
            }
            return row;
          });
          return held.promise;
        };
        await run({ clients, projectId: project.id, holdFirstProjectRead });
      } finally {
        vi.restoreAllMocks();
        try {
          if (projectId) await backends[0]!.ops.deleteMany('factory_projects', { id: projectId });
        } finally {
          await Promise.all(backends.map(storage => storage.close()));
          await rm(directory, { recursive: true, force: true });
        }
      }
    }

    it('lets only one of two concurrent push claims win', async () => {
      await withClients(async ({ clients, projectId, holdFirstProjectRead }) => {
        const now = new Date('2026-10-13T12:00:00Z');
        const secondDone = Promise.withResolvers<void>();
        const held = holdFirstProjectRead(secondDone.promise);
        const first = clients[0]!.claimBuildAttempt({ id: projectId, debounceMinutes: 10, now });
        await held;
        const second = clients[1]!
          .claimBuildAttempt({ id: projectId, debounceMinutes: 10, now })
          .finally(() => secondDone.resolve());
        expect((await Promise.all([first, second])).filter(Boolean)).toHaveLength(1);
      });
    });

    it('gives the build-start lease to one of two clients and only its holder releases it', async () => {
      await withClients(async ({ clients, projectId, holdFirstProjectRead }) => {
        const now = new Date('2026-10-13T12:00:00Z');
        const lease = { id: projectId, leaseMs: 60_000, now };
        const secondDone = Promise.withResolvers<void>();
        const held = holdFirstProjectRead(secondDone.promise);
        const first = clients[0]!.claimBuildStart({ ...lease, token: 'run-1' });
        await held;
        const second = clients[1]!.claimBuildStart({ ...lease, token: 'run-2' }).finally(() => secondDone.resolve());
        const results = await Promise.all([first, second]);
        expect(results.filter(result => result.claimed)).toHaveLength(1);
        const [winner, loser] = results[0]!.claimed ? ['run-1', 'run-2'] : ['run-2', 'run-1'];
        expect(await clients[1]!.renewBuildStart({ ...lease, token: loser })).toBe(false);
        expect(await clients[1]!.renewBuildStart({ ...lease, token: winner })).toBe(true);

        const changes = { lastBuildId: 'build-x' };
        expect(await clients[1]!.releaseBuildStart({ id: projectId, token: loser, changes })).toBe(false);
        expect(await clients[0]!.getById({ id: projectId })).toMatchObject({ lastBuildId: null });
        expect(await clients[0]!.releaseBuildStart({ id: projectId, token: winner, changes })).toBe(true);
        expect(await clients[1]!.getById({ id: projectId })).toMatchObject({ lastBuildId: 'build-x' });
        expect(await clients[1]!.claimBuildStart({ ...lease, token: 'run-3' })).toEqual({
          claimed: true,
          uncertain: false,
        });
        // Taking over a lapsed lease marks the start uncertain until a release resolves it.
        const expired = new Date(now.getTime() + 61_000);
        expect(await clients[0]!.claimBuildStart({ ...lease, token: 'run-4', now: expired })).toEqual({
          claimed: true,
          uncertain: true,
        });
        expect(await clients[1]!.releaseBuildStart({ id: projectId, token: 'run-4', now: expired })).toBe(true);
        expect(await clients[1]!.claimBuildStart({ ...lease, token: 'run-5', now: expired })).toEqual({
          claimed: true,
          uncertain: true,
        });
        expect(
          await clients[0]!.releaseBuildStart({ id: projectId, token: 'run-5', resolved: true, now: expired }),
        ).toBe(true);
        expect(await clients[0]!.claimBuildStart({ ...lease, token: 'run-6', now: expired })).toEqual({
          claimed: true,
          uncertain: false,
        });
      });
    });

    it('never lets a stale build overwrite a newer build pin', async () => {
      await withClients(async ({ clients, projectId, holdFirstProjectRead }) => {
        const [stale, fresh] = clients as [FactoryProjectsStorage, FactoryProjectsStorage];
        await stale.update({ orgId: 'org-1', id: projectId, input: { lastBuildId: 'build-1' } });
        const freshDone = Promise.withResolvers<void>();
        const held = holdFirstProjectRead(freshDone.promise);
        const stalePin = stale.pinActiveTemplate({ id: projectId, buildId: 'build-1', templateId: 'tpl-1', heads: {} });
        await held;
        const freshPin = (async () => {
          await fresh.update({ orgId: 'org-1', id: projectId, input: { lastBuildId: 'build-2' } });
          return fresh.pinActiveTemplate({ id: projectId, buildId: 'build-2', templateId: 'tpl-2', heads: {} });
        })().finally(() => freshDone.resolve());
        await Promise.all([stalePin, freshPin]);
        vi.restoreAllMocks();
        expect(await fresh.getById({ id: projectId })).toMatchObject({
          lastBuildId: 'build-2',
          activeTemplateId: 'tpl-2',
        });
      });
    });
  },
);
