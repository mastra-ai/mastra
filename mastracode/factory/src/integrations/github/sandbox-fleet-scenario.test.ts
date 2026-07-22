import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Minimal cloneable template sandbox standing in for a RailwaySandbox. */
function templateSandbox(): WorkspaceSandbox {
  const template = { id: 'template-1', name: 'Template', provider: 'railway', clone: () => template };
  return template as unknown as WorkspaceSandbox;
}

function makeFleet(opts: { maxSandboxes?: number } = {}): SandboxFleet {
  return new SandboxFleet({
    machine: templateSandbox(),
    workdirBase: '/workspace',
    ...(opts.maxSandboxes !== undefined ? { maxSandboxes: opts.maxSandboxes } : {}),
  });
}

/** The fleet under test; recreated per test where a budget cap is needed. */
let fleet = makeFleet();

// ── Phase 7 sandbox-fleet scenario tests ─────────────────────────────────
// These prove the lightweight per-replica sandbox budget and the per-user
// teardown path end to end:
//   1. Cap enforcement + recovery: with a cap of 1, a second fresh provision is
//      rejected, then succeeds once the first is torn down (counter decremented).
//   2. Teardown clears the per-(project,user) binding and decrements the live
//      counter, so the next open re-provisions a fresh sandbox.
//   3. Cross-user teardown is structurally impossible: a DELETE only ever
//      resolves the caller's own `(project, user)` binding, so one user can never
//      tear down another user's sandbox.
//
// Parts 1 & 2 drive the real `ensureProjectSandbox` / `teardownProjectSandbox`
// helpers; part 3 drives the real DELETE route. All share one in-memory fake DB.

vi.mock('drizzle-orm', () => ({
  eq: (column: any, value: any) => ({ kind: 'eq', column: column?.name, value }),
  and: (...conds: any[]) => ({ kind: 'and', conds: conds.filter(Boolean) }),
}));

// Enable the GitHub feature so the project git routes (incl. DELETE) mount.
vi.mock('./config', () => ({
  isGithubFeatureEnabled: () => true,
}));

// Minimal injected instances: this suite only exercises sandbox teardown
// routes, so the integration stub needs no real API methods.
const sourceControlStorage = {
  integrationId: 'github',
  installations: {
    get: async ({ orgId, id }: { orgId: string; id: string }) =>
      tables.installations.find(row => row.orgId === orgId && row.id === id) ?? null,
  },
  repositories: {
    get: async ({ orgId, id }: { orgId: string; id: string }) => {
      const repository = tables.repositories.find(row => row.id === id);
      const installation = tables.installations.find(row => row.id === repository?.installationId);
      return installation?.orgId === orgId ? (repository ?? null) : null;
    },
  },
  connections: {
    get: async ({ orgId, id }: { orgId: string; id: string }) =>
      tables.connections.find(row => row.orgId === orgId && row.id === id) ?? null,
  },
  projectRepositories: {
    get: async ({ orgId, id }: { orgId: string; id: string }) => {
      const projectRepository = tables.projectRepositories.find(row => row.id === id);
      const connection = tables.connections.find(row => row.id === projectRepository?.connectionId);
      return connection?.orgId === orgId ? (projectRepository ?? null) : null;
    },
  },
  sandboxes: {
    getOrCreate: async ({ projectRepository, userId }: { projectRepository: Record<string, any>; userId: string }) => {
      const existing = tables.sandboxes.find(
        row => row.projectRepositoryId === projectRepository.id && row.userId === userId,
      );
      if (existing) return existing;
      const row = {
        id: `gen-sandboxes-${tables.sandboxes.length}`,
        projectRepositoryId: projectRepository.id,
        userId,
        sandboxId: null,
        sandboxWorkdir: projectRepository.sandboxWorkdir,
        materializedAt: null,
        createdAt: new Date(),
      };
      tables.sandboxes.push(row);
      return row;
    },
    getById: async ({ id }: { id: string }) => tables.sandboxes.find(row => row.id === id) ?? null,
    setSandboxId: async ({ id, sandboxId }: { id: string; sandboxId: string }) => {
      const row = tables.sandboxes.find(candidate => candidate.id === id);
      if (row) row.sandboxId = sandboxId;
    },
    clearBinding: async ({ id }: { id: string }) => {
      const row = tables.sandboxes.find(candidate => candidate.id === id);
      if (row) Object.assign(row, { sandboxId: null, materializedAt: null });
    },
    markMaterialized: async ({ id }: { id: string }) => {
      const row = tables.sandboxes.find(candidate => candidate.id === id);
      if (row) row.materializedAt = new Date();
    },
  },
} as any;

const githubStub = {
  sourceControlStorage,
  mintInstallationToken: vi.fn(async () => 'install-token'),
} as any;
const stateSigner = {
  stable: true,
  sign: (orgId: string, userId: string) => `state.${orgId}.${userId}`,
  verify: (state: string | undefined) => {
    if (!state?.startsWith('state.')) return null;
    const [orgId, userId] = state.slice('state.'.length).split('.');
    if (!orgId || !userId) return null;
    return { orgId, userId };
  },
};

// ── Shared in-memory DB shaped like routes.test.ts ────────────────────────
interface Tables {
  installations: Array<Record<string, any>>;
  repositories: Array<Record<string, any>>;
  connections: Array<Record<string, any>>;
  projectRepositories: Array<Record<string, any>>;
  sandboxes: Array<Record<string, any>>;
}
const tables: Tables = {
  installations: [],
  repositories: [],
  connections: [],
  projectRepositories: [],
  sandboxes: [],
};

import { fakeRouteAuth, mountApiRoutes } from '../../routes/test-utils.js';
import { SandboxBudgetError, SandboxFleet } from '../../sandbox/fleet.js';
import type { MaterializationSandbox } from '../../sandbox/fleet.js';
import type { ProjectRepositorySandbox } from '../../storage/domains/source-control/base.js';
import type * as RoutesModule from './routes.js';
import { ensureProjectSandbox, teardownProjectSandbox } from './sandbox.js';

/** Minimal fake sandbox VM that records lifecycle calls. */
class FakeSandbox implements MaterializationSandbox {
  readonly id: string;
  startCount = 0;
  stopCount = 0;
  constructor(id: string) {
    this.id = id;
  }
  async start(): Promise<void> {
    this.startCount += 1;
  }
  async stop(): Promise<void> {
    this.stopCount += 1;
  }
  async getInfo() {
    return { metadata: { railwaySandboxId: `vm-${this.id}` } };
  }
  async executeCommand() {
    return { exitCode: 0, stdout: '', stderr: '' };
  }
}

function makeBindingRow(id: string): ProjectRepositorySandbox {
  const row = {
    id,
    projectRepositoryId: `project-repository-${id}`,
    userId: 'u1',
    sandboxId: null,
    sandboxWorkdir: '/workspace/hello',
    materializedAt: null,
    createdAt: new Date(),
  } satisfies ProjectRepositorySandbox;
  tables.sandboxes.push(row as unknown as Record<string, any>);
  return row;
}

afterEach(() => {
  fleet = makeFleet();
  tables.installations = [];
  tables.repositories = [];
  tables.connections = [];
  tables.projectRepositories = [];
  tables.sandboxes = [];
  vi.restoreAllMocks();
});

describe('S7 — sandbox fleet budget', () => {
  it('cap=1: a second fresh provision is rejected, then succeeds after teardown frees a slot', async () => {
    fleet = makeFleet({ maxSandboxes: 1 });
    let made = 0;
    fleet.setFactory(({ providerSandboxId }) => new FakeSandbox(providerSandboxId ?? `fresh-${++made}`));

    const rowA = makeBindingRow('a');
    const rowB = makeBindingRow('b');

    // First fresh provision succeeds and consumes the single slot.
    const sandboxA = (await ensureProjectSandbox({
      fleet,
      row: rowA,
      storage: sourceControlStorage.sandboxes,
    })) as FakeSandbox;
    expect(sandboxA.startCount).toBe(1);
    expect(fleet.liveCount).toBe(1);
    expect(rowA.sandboxId).toBe('vm-fresh-1');

    // Second fresh provision is over budget → rejected before spending quota.
    const err = await ensureProjectSandbox({ fleet, row: rowB, storage: sourceControlStorage.sandboxes }).catch(e => e);
    expect(err).toBeInstanceOf(SandboxBudgetError);
    expect(err.max).toBe(1);
    expect(fleet.liveCount).toBe(1);
    expect(rowB.sandboxId).toBeNull();

    // Tear down A → frees the slot.
    await teardownProjectSandbox({ fleet, row: rowA, storage: sourceControlStorage.sandboxes, sandbox: sandboxA });
    expect(sandboxA.stopCount).toBe(1);
    expect(fleet.liveCount).toBe(0);
    expect(rowA.sandboxId).toBeNull();

    // Now B provisions successfully.
    const sandboxB = (await ensureProjectSandbox({
      fleet,
      row: rowB,
      storage: sourceControlStorage.sandboxes,
    })) as FakeSandbox;
    expect(sandboxB.startCount).toBe(1);
    expect(fleet.liveCount).toBe(1);
    expect(rowB.sandboxId).toBe('vm-fresh-2');
  });

  it('teardown clears the per-(project,user) binding and the next open re-provisions fresh', async () => {
    let made = 0;
    fleet.setFactory(({ providerSandboxId }) => new FakeSandbox(providerSandboxId ?? `fresh-${++made}`));

    const row = makeBindingRow('a');

    const first = (await ensureProjectSandbox({
      fleet,
      row: row,
      storage: sourceControlStorage.sandboxes,
    })) as FakeSandbox;
    expect(fleet.liveCount).toBe(1);
    expect(row.sandboxId).toBe('vm-fresh-1');

    // Simulate a materialized binding so teardown clears that too.
    (row as { materializedAt: Date | null }).materializedAt = new Date();

    await teardownProjectSandbox({ fleet, row: row, storage: sourceControlStorage.sandboxes, sandbox: first });
    expect(first.stopCount).toBe(1);
    expect(fleet.liveCount).toBe(0);
    expect(row.sandboxId).toBeNull();
    expect(row.materializedAt).toBeNull();

    // Next open re-provisions a brand new sandbox (fresh provider id).
    const second = (await ensureProjectSandbox({
      fleet,
      row: row,
      storage: sourceControlStorage.sandboxes,
    })) as FakeSandbox;
    expect(second).not.toBe(first);
    expect(second.startCount).toBe(1);
    expect(fleet.liveCount).toBe(1);
    expect(row.sandboxId).toBe('vm-fresh-2');
  });

  it('teardown of a never-provisioned binding is a no-op that does not underflow the counter', async () => {
    const row = makeBindingRow('a'); // sandboxId stays null
    await teardownProjectSandbox({ fleet, row: row, storage: sourceControlStorage.sandboxes });
    expect(fleet.liveCount).toBe(0);
    expect(row.sandboxId).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Part 3: route-level cross-user teardown isolation. The DELETE handler always
// resolves the caller's own `(project, user)` binding, so user 2's teardown can
// never touch user 1's sandbox.

describe('S7 — cross-user teardown isolation (route level)', () => {
  let buildGithubRoutes: (typeof RoutesModule)['buildGithubRoutes'];

  beforeEach(async () => {
    const now = new Date();
    tables.installations = [
      {
        id: 'installation-1',
        integrationId: 'github',
        orgId: 'org1',
        connectedByUserId: 'u1',
        externalId: '7',
        accountName: 'octo',
        accountType: 'Organization',
        providerMetadata: {},
        createdAt: now,
      },
    ];
    tables.repositories = [
      {
        id: 'repository-1',
        installationId: 'installation-1',
        externalId: 'octo/hello',
        slug: 'octo/hello',
        defaultBranch: 'main',
        providerMetadata: {},
        createdAt: now,
        updatedAt: now,
      },
    ];
    tables.connections = [
      {
        id: 'connection-1',
        orgId: 'org1',
        factoryProjectId: 'factory-project-1',
        integrationId: 'github',
        installationId: 'installation-1',
        createdByUserId: 'u1',
        createdAt: now,
      },
    ];
    tables.projectRepositories = [
      {
        id: 'p1',
        connectionId: 'connection-1',
        repositoryId: 'repository-1',
        createdByUserId: 'u1',
        branch: null,
        sandboxProvider: 'railway',
        sandboxWorkdir: '/workspace/hello',
        setupCommand: null,
        createdAt: now,
        updatedAt: now,
      },
    ];
    // Only user 1 has a provisioned sandbox binding.
    tables.sandboxes = [
      {
        id: 's1',
        projectRepositoryId: 'p1',
        userId: 'u1',
        sandboxId: 'vm-u1',
        sandboxWorkdir: '/workspace/hello',
        materializedAt: now,
        createdAt: now,
      },
    ];
    process.env.MASTRACODE_DISTRIBUTED_LOCK = '0';
    // A default fleet makes fleet.enabled true.
    fleet = makeFleet();

    // Real teardown/reattach run; the factory yields a fake VM so reattach starts
    // a recordable sandbox instead of hitting Railway.
    fleet.setFactory(({ providerSandboxId }) => new FakeSandbox(providerSandboxId ?? 'fresh'));

    ({ buildGithubRoutes } = await import('./routes.js'));
  });

  afterEach(() => {
    delete process.env.MASTRACODE_DISTRIBUTED_LOCK;
  });

  function buildApp(workosId: string) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      (c as any).set('factoryAuthUser', {
        id: workosId,
        workosId,
        organizationId: 'org1',
        name: 'Test',
        email: 't@e.co',
      });
      await next();
    });
    mountApiRoutes(app as any, buildGithubRoutes({ github: githubStub, stateSigner, auth: fakeRouteAuth(), fleet }));
    return app;
  }

  it("user 2's teardown never touches user 1's sandbox binding", async () => {
    const app = buildApp('u2');
    const res = await app.request('/web/github/projects/p1/sandbox', { method: 'DELETE' });

    // u2 has no provisioned binding → idempotent no-op success.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tornDown: false });

    // u1's sandbox row is untouched.
    const u1Row = tables.sandboxes.find(r => r.userId === 'u1');
    expect(u1Row?.sandboxId).toBe('vm-u1');
    // u2's own (freshly created) binding has no sandbox.
    const u2Row = tables.sandboxes.find(r => r.userId === 'u2');
    expect(u2Row?.sandboxId ?? null).toBeNull();
  });

  it('user 1 can tear down their own sandbox', async () => {
    fleet.__resetLiveCount(1); // u1 has one live sandbox
    const app = buildApp('u1');
    const res = await app.request('/web/github/projects/p1/sandbox', { method: 'DELETE' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tornDown: true });

    // The caller's own binding is cleared and the counter is decremented.
    const u1Row = tables.sandboxes.find(r => r.userId === 'u1');
    expect(u1Row?.sandboxId).toBeNull();
    expect(fleet.liveCount).toBe(0);
  });
});
