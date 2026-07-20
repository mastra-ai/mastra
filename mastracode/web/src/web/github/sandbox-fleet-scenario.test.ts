import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { __resetRuntimeConfigForTests, seedRuntimeConfig } from '../runtime-config';

/** Minimal cloneable template sandbox standing in for a RailwaySandbox. */
function templateSandbox(): WorkspaceSandbox {
  const template = { id: 'template-1', name: 'Template', provider: 'railway', clone: () => template };
  return template as unknown as WorkspaceSandbox;
}

function seedSandboxRuntime(opts: { maxSandboxes?: number } = {}): void {
  seedRuntimeConfig({
    sandbox: {
      machine: templateSandbox(),
      workdirBase: '/workspace',
      ...(opts.maxSandboxes !== undefined ? { maxSandboxes: opts.maxSandboxes } : {}),
    },
  });
}

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
  projects: {
    getOrg: async (orgId: string, projectId: string) =>
      tables.projects.find(row => row.orgId === orgId && row.id === projectId),
  },
  sandboxes: {
    getOrCreate: async (project: Record<string, any>, userId: string) => {
      const existing = tables.sandboxes.find(row => row.projectId === project.id && row.userId === userId);
      if (existing) return existing;
      const row = {
        id: `gen-sandboxes-${tables.sandboxes.length}`,
        projectId: project.id,
        userId,
        sandboxId: null,
        sandboxWorkdir: project.sandboxWorkdir,
        materializedAt: null,
        createdAt: new Date(),
      };
      tables.sandboxes.push(row);
      return row;
    },
    getById: async (id: string) => tables.sandboxes.find(row => row.id === id),
    setSandboxId: async (id: string, sandboxId: string) => {
      const row = tables.sandboxes.find(candidate => candidate.id === id);
      if (row) row.sandboxId = sandboxId;
    },
    clearBinding: async (id: string) => {
      const row = tables.sandboxes.find(candidate => candidate.id === id);
      if (row) Object.assign(row, { sandboxId: null, materializedAt: null });
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
  projects: Array<Record<string, any>>;
  sandboxes: Array<Record<string, any>>;
}
const tables: Tables = { projects: [], sandboxes: [] };

function dbNameToJsKey(name: string): string {
  return name.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
}

function matches(row: Record<string, any>, cond: any): boolean {
  if (!cond) return true;
  if (cond.kind === 'and') return cond.conds.every((c: any) => matches(row, c));
  if (cond.kind === 'eq') return row[dbNameToJsKey(cond.column)] === cond.value;
  return true;
}

let sandboxesRef: any;
function tableKind(table: any): keyof Tables {
  return table === sandboxesRef ? 'sandboxes' : 'projects';
}

vi.mock('./db', () => ({
  getAppDb: () => ({
    select: () => ({
      from: (table: any) => ({
        where: async (cond: any) => tables[tableKind(table)].filter(r => matches(r, cond)),
      }),
    }),
    insert: (table: any) => ({
      values: (vals: any) => {
        const kind = tableKind(table);
        const push = () => {
          const row = { id: `gen-${kind}-${tables[kind].length}`, ...vals };
          tables[kind].push(row);
          return row;
        };
        const chain: any = {
          onConflictDoNothing: (opts?: any) => {
            // Honor the conflict target: if a row already matches on the target
            // columns, insert nothing (mirrors Postgres ON CONFLICT DO NOTHING).
            const targets: string[] = (opts?.target ?? [])
              .map((col: any) => (col?.name ? dbNameToJsKey(col.name) : undefined))
              .filter(Boolean);
            const existing = targets.length ? tables[kind].find(r => targets.every(t => r[t] === vals[t])) : undefined;
            const row = existing ? undefined : push();
            const result = row ? [row] : [];
            const p: any = Promise.resolve(result);
            p.returning = async () => result;
            return p;
          },
          returning: async () => [push()],
        };
        return chain;
      },
    }),
    update: (table: any) => ({
      set: (vals: any) => ({
        where: async (cond: any) => {
          for (const r of tables[tableKind(table)]) {
            if (matches(r, cond)) Object.assign(r, vals);
          }
        },
      }),
    }),
  }),
}));

import { mountApiRoutes } from '../test-utils';
import type * as RoutesModule from './routes';
import {
  __resetLiveSandboxCount,
  getLiveSandboxCount,
  resetSandboxFactory,
  SandboxBudgetError,
  setSandboxFactory,
} from '../sandbox/fleet';
import type { MaterializationSandbox } from '../sandbox/fleet';
import { ensureProjectSandbox, teardownProjectSandbox } from './sandbox';
import type { SourceControlProjectSandbox } from '../storage/domains/source-control/base';

const githubProjectSandboxes = {};
sandboxesRef = githubProjectSandboxes;

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

function makeBindingRow(id: string): SourceControlProjectSandbox {
  const row = {
    id,
    projectId: `proj-${id}`,
    userId: 'u1',
    sandboxId: null,
    sandboxWorkdir: '/workspace/hello',
    materializedAt: null,
    createdAt: new Date(),
  } satisfies SourceControlProjectSandbox;
  tables.sandboxes.push(row as unknown as Record<string, any>);
  return row;
}

afterEach(() => {
  resetSandboxFactory();
  __resetLiveSandboxCount(0);
  __resetRuntimeConfigForTests();
  tables.projects = [];
  tables.sandboxes = [];
  vi.restoreAllMocks();
});

describe('S7 — sandbox fleet budget', () => {
  it('cap=1: a second fresh provision is rejected, then succeeds after teardown frees a slot', async () => {
    seedSandboxRuntime({ maxSandboxes: 1 });
    let made = 0;
    setSandboxFactory(({ providerSandboxId }) => new FakeSandbox(providerSandboxId ?? `fresh-${++made}`));

    const rowA = makeBindingRow('a');
    const rowB = makeBindingRow('b');

    // First fresh provision succeeds and consumes the single slot.
    const sandboxA = (await ensureProjectSandbox(rowA, sourceControlStorage.sandboxes)) as FakeSandbox;
    expect(sandboxA.startCount).toBe(1);
    expect(getLiveSandboxCount()).toBe(1);
    expect(rowA.sandboxId).toBe('vm-fresh-1');

    // Second fresh provision is over budget → rejected before spending quota.
    const err = await ensureProjectSandbox(rowB, sourceControlStorage.sandboxes).catch(e => e);
    expect(err).toBeInstanceOf(SandboxBudgetError);
    expect(err.max).toBe(1);
    expect(getLiveSandboxCount()).toBe(1);
    expect(rowB.sandboxId).toBeNull();

    // Tear down A → frees the slot.
    await teardownProjectSandbox(rowA, sourceControlStorage.sandboxes, sandboxA);
    expect(sandboxA.stopCount).toBe(1);
    expect(getLiveSandboxCount()).toBe(0);
    expect(rowA.sandboxId).toBeNull();

    // Now B provisions successfully.
    const sandboxB = (await ensureProjectSandbox(rowB, sourceControlStorage.sandboxes)) as FakeSandbox;
    expect(sandboxB.startCount).toBe(1);
    expect(getLiveSandboxCount()).toBe(1);
    expect(rowB.sandboxId).toBe('vm-fresh-2');
  });

  it('teardown clears the per-(project,user) binding and the next open re-provisions fresh', async () => {
    let made = 0;
    setSandboxFactory(({ providerSandboxId }) => new FakeSandbox(providerSandboxId ?? `fresh-${++made}`));

    const row = makeBindingRow('a');

    const first = (await ensureProjectSandbox(row, sourceControlStorage.sandboxes)) as FakeSandbox;
    expect(getLiveSandboxCount()).toBe(1);
    expect(row.sandboxId).toBe('vm-fresh-1');

    // Simulate a materialized binding so teardown clears that too.
    (row as { materializedAt: Date | null }).materializedAt = new Date();

    await teardownProjectSandbox(row, sourceControlStorage.sandboxes, first);
    expect(first.stopCount).toBe(1);
    expect(getLiveSandboxCount()).toBe(0);
    expect(row.sandboxId).toBeNull();
    expect(row.materializedAt).toBeNull();

    // Next open re-provisions a brand new sandbox (fresh provider id).
    const second = (await ensureProjectSandbox(row, sourceControlStorage.sandboxes)) as FakeSandbox;
    expect(second).not.toBe(first);
    expect(second.startCount).toBe(1);
    expect(getLiveSandboxCount()).toBe(1);
    expect(row.sandboxId).toBe('vm-fresh-2');
  });

  it('teardown of a never-provisioned binding is a no-op that does not underflow the counter', async () => {
    const row = makeBindingRow('a'); // sandboxId stays null
    await teardownProjectSandbox(row, sourceControlStorage.sandboxes);
    expect(getLiveSandboxCount()).toBe(0);
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
    tables.projects = [
      { id: 'p1', orgId: 'org1', installationId: 7, repoFullName: 'octo/hello', sandboxWorkdir: '/workspace/hello' },
    ];
    // Only user 1 has a provisioned sandbox binding.
    tables.sandboxes = [
      { id: 's1', projectId: 'p1', userId: 'u1', sandboxId: 'vm-u1', sandboxWorkdir: '/workspace/hello' },
    ];
    process.env.MASTRACODE_DISTRIBUTED_LOCK = '0';
    // A seeded sandbox template makes isSandboxEnabled() true.
    seedSandboxRuntime();

    // Real teardown/reattach run; the factory yields a fake VM so reattach starts
    // a recordable sandbox instead of hitting Railway.
    setSandboxFactory(({ providerSandboxId }) => new FakeSandbox(providerSandboxId ?? 'fresh'));

    ({ buildGithubRoutes } = await import('./routes'));
  });

  afterEach(() => {
    delete process.env.MASTRACODE_DISTRIBUTED_LOCK;
  });

  function buildApp(workosId: string) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      (c as any).set('webAuthUser', { id: workosId, workosId, organizationId: 'org1', name: 'Test', email: 't@e.co' });
      await next();
    });
    mountApiRoutes(app as any, buildGithubRoutes({ github: githubStub, stateSigner }));
    return app;
  }

  it("user 2's teardown never touches user 1's sandbox binding", async () => {
    const app = buildApp('u2');
    const res = await app.request('/web/github/repositories/p1/sandbox', { method: 'DELETE' });

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
    __resetLiveSandboxCount(1); // u1 has one live sandbox
    const app = buildApp('u1');
    const res = await app.request('/web/github/repositories/p1/sandbox', { method: 'DELETE' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tornDown: true });

    // The caller's own binding is cleared and the counter is decremented.
    const u1Row = tables.sandboxes.find(r => r.userId === 'u1');
    expect(u1Row?.sandboxId).toBeNull();
    expect(getLiveSandboxCount()).toBe(0);
  });
});
