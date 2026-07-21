import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SourceControlStorageInMemory } from '../storage/domains/source-control/inmemory';

// ── Scenario tests (S1, S2) ──────────────────────────────────────────────
// These exercise the *composition* of the real Phase 4 git route handlers
// across a full write-back journey, and the per-project mutex that serialises
// concurrent remote-rewriting pushes. They reuse the exact harness shape from
// `routes.test.ts`: mocked `drizzle-orm` eq/and, an in-memory fake DB, and
// mocked `./client` / `./sandbox` / `./config` modules. No real network.

vi.mock('drizzle-orm', () => ({
  eq: (column: any, value: any) => ({ kind: 'eq', column: column?.name, value }),
  and: (...conds: any[]) => ({ kind: 'and', conds: conds.filter(Boolean) }),
}));

interface Tables {
  installations: Array<Record<string, any>>;
  repositories: Array<Record<string, any>>;
  connections: Array<Record<string, any>>;
  projectRepositories: Array<Record<string, any>>;
  sandboxes: Array<Record<string, any>>;
  worktrees: Array<Record<string, any>>;
}
const tables: Tables = {
  installations: [],
  repositories: [],
  connections: [],
  projectRepositories: [],
  sandboxes: [],
  worktrees: [],
};
const sourceControlStorage = new SourceControlStorageInMemory();

function projectRepositoryRow(row: Record<string, any>) {
  const installationId = `installation-${row.orgId}-${row.installationId}`;
  const repositoryId = `repository-${row.repoId ?? row.repoFullName}`;
  const connectionId = `connection-${row.id}`;
  const now = new Date();

  if (!tables.installations.some(candidate => candidate.id === installationId)) {
    tables.installations.push({
      id: installationId,
      integrationId: 'github',
      orgId: row.orgId,
      connectedByUserId: row.userId,
      externalId: String(row.installationId),
      accountName: 'octo',
      accountType: 'User',
      providerMetadata: {},
      createdAt: now,
    });
  }
  if (!tables.repositories.some(candidate => candidate.id === repositoryId)) {
    tables.repositories.push({
      id: repositoryId,
      installationId,
      externalId: String(row.repoId ?? 99),
      slug: row.repoFullName,
      defaultBranch: row.defaultBranch ?? 'main',
      providerMetadata: {},
      createdAt: now,
      updatedAt: now,
    });
  }
  if (!tables.connections.some(candidate => candidate.id === connectionId)) {
    tables.connections.push({
      id: connectionId,
      factoryProjectId: row.factoryProjectId ?? `factory-${row.id}`,
      integrationId: 'github',
      installationId,
      createdByUserId: row.userId,
      createdAt: now,
    });
  }

  return {
    id: row.id,
    connectionId,
    repositoryId,
    branch: row.defaultBranch ?? null,
    sandboxProvider: 'railway',
    sandboxWorkdir: row.sandboxWorkdir,
    setupCommand: null,
    createdAt: now,
    updatedAt: now,
  };
}

vi.mock('./db', () => {
  const makeDb = () => ({
    select: () => ({
      from: (table: any) => ({
        where: async (cond: any) => filterRows(table, cond),
      }),
    }),
    insert: (table: any) => ({
      values: (vals: any) => {
        const chain = {
          onConflictDoNothing: (opts?: any) => {
            const ret = insertIfAbsent(table, vals, opts);
            const promise: any = Promise.resolve(ret ? [ret] : []);
            promise.returning = async () => (ret ? [ret] : []);
            return promise;
          },
          onConflictDoUpdate: (opts: any) => {
            const ret = upsertRow(table, vals, opts);
            return { returning: async () => [ret] };
          },
          returning: async () => [insertRow(table, vals)],
        };
        return chain;
      },
    }),
    update: (table: any) => ({
      set: (vals: any) => ({ where: async (cond: any) => updateRows(table, vals, cond) }),
    }),
  });
  return { getAppDb: () => makeDb() };
});

// Stub integration instance: routes consume the injected `github` instance —
// real DI instead of module mocking (client.ts no longer exists).
const githubStub = {
  sourceControlStorage,
  buildInstallUrl: (state: string) => `https://github.com/apps/test/installations/new?state=${state}`,
  buildOAuthIdentifyUrl: (state: string) => `https://github.com/login/oauth/authorize?state=${state}`,
  exchangeOAuthCode: vi.fn(async () => 'user-token'),
  listUserInstallations: vi.fn(async () => [{ installationId: 7, accountLogin: 'octo', accountType: 'User' }]),
  listInstallationRepos: vi.fn(async () => [
    {
      id: 99,
      fullName: 'octo/hello',
      name: 'hello',
      owner: 'octo',
      defaultBranch: 'main',
      private: false,
      installationId: 7,
    },
  ]),
  getInstallationRepo: vi.fn(async (installationId: number, fullName: string) =>
    fullName === 'octo/hello'
      ? {
          id: 99,
          fullName: 'octo/hello',
          name: 'hello',
          owner: 'octo',
          defaultBranch: 'main',
          private: false,
          installationId,
        }
      : null,
  ),
  // A fresh token string per call so the scenario can prove per-op minting.
  mintInstallationToken: vi.fn(async () => `install-token-${++mintCount}`),
  versionControl: {
    createPullRequest: async (input: import('../capabilities/version-control').CreatePullRequestInput) => {
      const result = await createPullRequest(input);
      return {
        id: '1',
        title: input.title,
        url: result.url,
        author: 'octo',
        body: input.body ?? null,
        state: 'open' as const,
        draft: false,
        merged: false,
        mergeable: null,
        baseBranch: input.baseBranch,
        headBranch: input.headBranch,
        headSha: 'abc123',
        createdAt: '2026-07-21T00:00:00Z',
        updatedAt: '2026-07-21T00:00:00Z',
      };
    },
  },
};

// Deterministic state signer stub (replaces the old signState/verifyState mocks).
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

let mintCount = 0;

const subscribeToPullRequest = vi.fn(async (_input: unknown) => ({ created: true }));
vi.mock('./subscriptions', () => ({
  subscribeToPullRequest: (input: unknown) => subscribeToPullRequest(input),
}));

const ensureProjectSandbox = vi.fn(async (row: any, storage: SourceControlStorageInMemory['sandboxes']) => {
  await storage.setSandboxId(row.id, 'sb');
  return { id: 'sb' };
});
const materializeRepo = vi.fn(async () => {});
const reattachSandbox = vi.fn(async (_id: string) => ({ id: 'sb' }));
const ensureWorktree = vi.fn(async (_sb: any, _workdir: string, opts: { branch: string; baseBranch: string }) => ({
  worktreePath: `/workspace/hello/../worktrees/${opts.branch}`,
  branch: opts.branch,
  baseBranch: opts.baseBranch,
}));
const commitAll = vi.fn(async () => ({ committed: true }));
// pushBranch is overridable per-test so S2 can make it block on a deferred.
let pushImpl: (...args: any[]) => Promise<void> = async () => {};
const pushBranch = vi.fn((...args: any[]) => pushImpl(...args));
const createPullRequest = vi.fn(async () => ({ url: 'https://github.com/octo/hello/pull/1' }));
let sandboxEnabled = true;
vi.mock('../sandbox/fleet', () => {
  class SandboxBudgetError extends Error {
    readonly code = 'sandbox-budget-exceeded';
    constructor(readonly max: number) {
      super(`Sandbox budget exceeded: ${max}`);
    }
  }
  return {
    computeSandboxWorkdir: (repo: string) => `/workspace/${repo.split('/').pop()}`,
    getSandboxProvider: () => 'railway',
    isSandboxEnabled: () => sandboxEnabled,
    reattachSandbox: (id: string) => reattachSandbox(id),
    SandboxBudgetError,
  };
});
vi.mock('./sandbox', () => {
  class MaterializeError extends Error {
    code: string;
    constructor(m: string, code: string) {
      super(m);
      this.code = code;
    }
  }
  class WorktreeError extends Error {
    code: string;
    constructor(m: string, code: string) {
      super(m);
      this.code = code;
    }
  }
  return {
    ensureProjectSandbox: (row: any, storage: SourceControlStorageInMemory['sandboxes']) =>
      ensureProjectSandbox(row, storage),
    materializeRepo: (...args: any[]) => materializeRepo(...(args as [])),
    ensureWorktree: (sb: any, workdir: string, opts: any) => ensureWorktree(sb, workdir, opts),
    commitAll: (...args: any[]) => commitAll(...(args as [])),
    pushBranch: (...args: any[]) => pushBranch(...(args as [])),
    createPullRequest: (...args: any[]) => createPullRequest(...(args as [])),
    isValidGitRef: (v: unknown): v is string =>
      typeof v === 'string' && v.length > 0 && v.length <= 255 && /^[A-Za-z0-9_./-]+$/.test(v),
    MaterializeError,
    WorktreeError,
  };
});

let featureEnabled = true;
vi.mock('./config', () => ({
  isGithubFeatureEnabled: () => featureEnabled,
  getGithubFeatureDiagnostics: () => ({}),
}));

import { mountApiRoutes } from '../test-utils';
import { buildGithubRoutes } from './routes';

// ── Fake table helpers (mirrors routes.test.ts) ─────────────────────────
function tableKind(table: any): keyof Tables {
  if (table === installationsRef) return 'installations';
  if (table === repositoriesRef) return 'repositories';
  if (table === connectionsRef) return 'connections';
  if (table === worktreesRef) return 'worktrees';
  if (table === sandboxesRef) return 'sandboxes';
  return 'projectRepositories';
}
let installationsRef: any;
let repositoriesRef: any;
let connectionsRef: any;
let projectRepositoriesRef: any;
let worktreesRef: any;
let sandboxesRef: any;

function dbNameToJsKey(table: any, dbName: string): string {
  for (const [jsKey, col] of Object.entries(table)) {
    if ((col as any)?.name === dbName) return jsKey;
  }
  return dbName;
}
function matches(table: any, row: any, cond: any): boolean {
  if (!cond) return true;
  if (cond.kind === 'and') return cond.conds.every((c: any) => matches(table, row, c));
  if (cond.kind === 'eq') return row[dbNameToJsKey(table, cond.column)] === cond.value;
  return true;
}
function filterRows(table: any, cond?: any): any[] {
  return tables[tableKind(table)].filter(row => matches(table, row, cond));
}
function insertRow(table: any, vals: any): any {
  const kind = tableKind(table);
  const row = { id: `id-${tables[kind].length + 1}`, ...vals };
  tables[kind].push(row as any);
  return row;
}
function upsertRow(table: any, vals: any, opts: any): any {
  const kind = tableKind(table);
  const targets: string[] = (opts?.target ?? [])
    .map((col: any) => (col?.name ? dbNameToJsKey(table, col.name) : undefined))
    .filter(Boolean);
  const existing = tables[kind].find(row => targets.every(t => row[t] === vals[t]));
  if (existing) {
    Object.assign(existing, opts?.set ?? {});
    return existing;
  }
  return insertRow(table, vals);
}
function insertIfAbsent(table: any, vals: any, opts: any): any | undefined {
  const kind = tableKind(table);
  const targets: string[] = (opts?.target ?? [])
    .map((col: any) => (col?.name ? dbNameToJsKey(table, col.name) : undefined))
    .filter(Boolean);
  const existing = targets.length
    ? tables[kind].find(row => targets.every(t => (row as any)[t] === vals[t]))
    : undefined;
  if (existing) return undefined;
  return insertRow(table, vals);
}
function updateRows(table: any, vals: any, cond?: any): void {
  for (const row of tables[tableKind(table)]) {
    if (matches(table, row, cond)) Object.assign(row, vals);
  }
}

const githubInstallations = {};
const githubRepositories = {};
const githubConnections = {};
const githubProjectRepositories = {};
const githubProjectSandboxes = {};
const githubWorktrees = {};
installationsRef = githubInstallations;
repositoriesRef = githubRepositories;
connectionsRef = githubConnections;
projectRepositoriesRef = githubProjectRepositories;
worktreesRef = githubWorktrees;
sandboxesRef = githubProjectSandboxes;

// A tiny deferred so S2 can control when a push resolves.
function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function buildApp(user: { workosId: string; organizationId?: string } | null) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('webAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app as any,
    buildGithubRoutes({ baseUrl: 'http://localhost:4111', github: githubStub as any, stateSigner }),
  );
  return app;
}

function postJson(app: ReturnType<typeof buildApp>, path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  tables.installations = [];
  tables.repositories = [];
  tables.connections = [];
  tables.projectRepositories = [];
  tables.sandboxes = [];
  tables.worktrees = [];
  sourceControlStorage.installationsRows = tables.installations as any;
  sourceControlStorage.repositoriesRows = tables.repositories as any;
  sourceControlStorage.connectionsRows = tables.connections as any;
  sourceControlStorage.projectRepositoriesRows = tables.projectRepositories as any;
  sourceControlStorage.sandboxesRows = tables.sandboxes as any;
  sourceControlStorage.worktreesRows = tables.worktrees as any;
  featureEnabled = true;
  sandboxEnabled = true;
  // No Postgres in these scenario tests: keep the project lock in-process.
  // The in-process mutex still serializes same-replica callers (S2).
  process.env.MASTRACODE_DISTRIBUTED_LOCK = '0';
  mintCount = 0;
  pushImpl = async () => {};
  ensureProjectSandbox.mockClear();
  materializeRepo.mockClear();
  reattachSandbox.mockClear();
  ensureWorktree.mockClear();
  commitAll.mockClear();
  pushBranch.mockClear();
  createPullRequest.mockClear();
  subscribeToPullRequest.mockClear();
});

afterEach(() => {
  delete process.env.MASTRACODE_DISTRIBUTED_LOCK;
  vi.clearAllMocks();
});

// ── S1: full write-back journey ──────────────────────────────────────────
describe('S1: full write-back journey through the real route handlers', () => {
  it('drives create → ensure → worktree → commit → push → pr for one user', async () => {
    const mint = githubStub.mintInstallationToken;
    const projectId = 'project-1';
    tables.projectRepositories.push(
      projectRepositoryRow({
        id: projectId,
        orgId: 'org1',
        userId: 'u1',
        installationId: 7,
        repoFullName: 'octo/hello',
        repoId: 99,
        defaultBranch: 'main',
        sandboxWorkdir: '/workspace/hello',
      }),
    );
    const app = buildApp({ workosId: 'u1', organizationId: 'org1' });

    // Seed the per-(project-repository,user) sandbox binding the way `ensure`
    // would persist it (provisioning itself is mocked).
    tables.sandboxes.push({
      id: 'sbrow-1',
      projectRepositoryId: projectId,
      userId: 'u1',
      sandboxId: 'sb-1',
      sandboxWorkdir: '/workspace/hello',
      materializedAt: null,
    });

    // 2. Ensure → provisions the sandbox + materialises the repo.
    const ensureRes = await postJson(app, `/web/github/projects/${projectId}/ensure`, {});
    expect(ensureRes.status).toBe(200);
    expect(ensureProjectSandbox).toHaveBeenCalledOnce();
    expect(materializeRepo).toHaveBeenCalledOnce();

    // 3. Worktree → persists a source_control_worktrees row for feat/x.
    const wtRes = await postJson(app, `/web/github/projects/${projectId}/worktree`, { branch: 'feat/x' });
    expect(wtRes.status).toBe(200);
    const wtJson = await wtRes.json();
    expect(wtJson.branch).toBe('feat/x');
    expect(wtJson.baseBranch).toBe('main');
    expect(tables.worktrees).toHaveLength(1);
    expect(tables.worktrees[0]).toMatchObject({
      projectRepositoryId: projectId,
      branch: 'feat/x',
      baseBranch: 'main',
    });
    const persistedWorktreePath = wtJson.worktreePath as string;
    expect(tables.worktrees[0].worktreePath).toBe(persistedWorktreePath);

    // 4. Commit in that exact worktree path → the round-trip is honoured:
    // a path that only exists because step 3 persisted it now passes
    // resolveWorktreePath (no client-path injection possible).
    const commitRes = await postJson(app, `/web/github/projects/${projectId}/commit`, {
      message: 'wip',
      worktreePath: persistedWorktreePath,
    });
    expect(commitRes.status).toBe(200);
    expect(await commitRes.json()).toMatchObject({ committed: true });
    expect((commitAll.mock.calls[0] as unknown as any[])[1]).toBe(persistedWorktreePath);

    // 5. Push that worktree → a fresh token is minted for *this* op.
    const mintBeforePush = mint.mock.calls.length;
    const pushRes = await postJson(app, `/web/github/projects/${projectId}/push`, {
      branch: 'feat/x',
      worktreePath: persistedWorktreePath,
    });
    expect(pushRes.status).toBe(200);
    expect(await pushRes.json()).toMatchObject({ pushed: true, branch: 'feat/x' });
    expect(mint.mock.calls.length).toBe(mintBeforePush + 1);
    const pushCall = pushBranch.mock.calls[0] as unknown as any[];
    // pushBranch(sandbox, workdir, branch, token, repoFullName)
    expect(pushCall[1]).toBe(persistedWorktreePath);
    expect(pushCall[2]).toBe('feat/x');
    const pushToken = pushCall[3] as string;
    expect(pushToken).toMatch(/^install-token-/);

    // 6. Open a PR through VersionControl; only the preceding git push needs a sandbox token.
    const mintBeforePr = mint.mock.calls.length;
    const prRes = await postJson(app, `/web/github/projects/${projectId}/pr`, {
      branch: 'feat/x',
      title: 'My PR',
      body: 'Adds a thing',
      worktreePath: persistedWorktreePath,
      sessionId: 'session-1',
      threadId: 'thread-1',
    });
    expect(prRes.status).toBe(200);
    expect(await prRes.json()).toMatchObject({ url: 'https://github.com/octo/hello/pull/1' });
    expect(mint.mock.calls.length).toBe(mintBeforePr);
    expect(createPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        connection: { type: 'app-installation', installationId: 7 },
        sourceId: 'octo/hello',
        baseBranch: 'main',
        headBranch: 'feat/x',
      }),
    );
    expect(subscribeToPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRepositoryId: projectId,
        changeRequestId: '1',
        installationExternalId: '7',
        repositoryExternalId: '99',
        repositorySlug: 'octo/hello',
        sessionId: 'session-1',
        ownerId: 'u1',
        resourceId: `factory-${projectId}`,
        threadId: 'thread-1',
        sessionScope: persistedWorktreePath,
        source: 'factory-pr-create',
      }),
    );
  });

  it('keeps PR creation compatible when no originating session is supplied', async () => {
    const app = buildApp({ workosId: 'u1', organizationId: 'org1' });
    const projectId = 'project-compat';
    tables.projectRepositories.push(
      projectRepositoryRow({
        id: projectId,
        orgId: 'org1',
        userId: 'u1',
        installationId: 7,
        repoFullName: 'octo/hello',
        repoId: 99,
        defaultBranch: 'main',
        sandboxWorkdir: '/workspace/hello',
      }),
    );
    tables.sandboxes.push({
      id: 'sbrow-compat',
      projectRepositoryId: projectId,
      userId: 'u1',
      sandboxId: 'sb-compat',
      sandboxWorkdir: '/workspace/hello',
      materializedAt: new Date(),
    });

    const response = await postJson(app, `/web/github/projects/${projectId}/pr`, {
      branch: 'feat/x',
      title: 'My PR',
    });

    expect(response.status).toBe(200);
    expect(subscribeToPullRequest).not.toHaveBeenCalled();
  });
});

// ── S2: concurrent push serialisation (per-project mutex) ─────────────────
describe('S2: per-project mutex serialises concurrent pushes', () => {
  function seed(id: string, userId = 'u1', orgId = 'org1') {
    tables.projectRepositories.push(
      projectRepositoryRow({
        id,
        orgId,
        userId,
        installationId: 7,
        repoFullName: `octo/${id}`,
        repoId: id,
        defaultBranch: 'main',
        sandboxWorkdir: '/workspace/hello',
      }),
    );
    tables.sandboxes.push({
      id: `sbrow-${id}`,
      projectRepositoryId: id,
      userId,
      sandboxId: `sb-${id}`,
      sandboxWorkdir: '/workspace/hello',
      materializedAt: new Date(),
    });
  }

  it('does not start the second push for the same project until the first resolves', async () => {
    seed('p1');
    const app = buildApp({ workosId: 'u1', organizationId: 'org1' });

    const order: string[] = [];
    const gate = deferred();
    let active = 0;
    let maxConcurrent = 0;
    pushImpl = async () => {
      active++;
      maxConcurrent = Math.max(maxConcurrent, active);
      order.push(`start:${active}`);
      // First push blocks on the gate; both wait on the same deferred so the
      // mutex (not wall-clock) determines ordering.
      await gate.promise;
      active--;
      order.push('end');
    };

    const first = postJson(app, '/web/github/projects/p1/push', { branch: 'feat/a' });
    const second = postJson(app, '/web/github/projects/p1/push', { branch: 'feat/b' });

    // Let microtasks flush; only the first push body should have begun.
    await new Promise(r => setTimeout(r, 10));
    expect(pushBranch).toHaveBeenCalledTimes(1);
    expect(maxConcurrent).toBe(1);

    // Release the gate → both complete, second runs only after the first ends.
    gate.resolve();
    const [r1, r2] = await Promise.all([first, second]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(pushBranch).toHaveBeenCalledTimes(2);
    // The mutex never let two push bodies overlap.
    expect(maxConcurrent).toBe(1);
    expect(order).toEqual(['start:1', 'end', 'start:1', 'end']);
  });

  it('allows pushes for different projects to overlap', async () => {
    seed('p1');
    seed('p2');
    const app = buildApp({ workosId: 'u1', organizationId: 'org1' });

    const gate = deferred();
    let active = 0;
    let maxConcurrent = 0;
    pushImpl = async () => {
      active++;
      maxConcurrent = Math.max(maxConcurrent, active);
      await gate.promise;
      active--;
    };

    const first = postJson(app, '/web/github/projects/p1/push', { branch: 'feat/a' });
    const second = postJson(app, '/web/github/projects/p2/push', { branch: 'feat/b' });

    await new Promise(r => setTimeout(r, 10));
    // Distinct project ids → distinct locks → both bodies run concurrently.
    expect(pushBranch).toHaveBeenCalledTimes(2);
    expect(maxConcurrent).toBe(2);

    gate.resolve();
    const [r1, r2] = await Promise.all([first, second]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });
});
