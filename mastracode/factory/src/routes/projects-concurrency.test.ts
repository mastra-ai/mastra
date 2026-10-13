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
