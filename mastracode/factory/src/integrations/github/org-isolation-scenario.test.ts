import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteAuth } from '../../routes/route';
import { mountApiRoutes } from '../../routes/test-utils';
import type { SandboxFleet } from '../../sandbox/fleet';
import { SourceControlStorageInMemory } from '../../storage/domains/source-control/inmemory';
import { buildGithubRoutes } from './routes';

// ── Phase 2 org-isolation scenario tests ─────────────────────────────────
// These prove the org-tenancy boundary end to end through the real GitHub
// route handlers:
//   1. The same repo connected by two different orgs never bleeds across orgs.
//   2. Two users in one org each get their own per-(project,user) sandbox row,
//      and one user's worktree is invisible to the other.
//   3. A user cannot operate on another user's persisted worktree path.
// They reuse the harness shape from `routes.test.ts`: mocked drizzle eq/and,
// an in-memory fake DB, and mocked `./client` / `./sandbox` / `./config`.

vi.mock('drizzle-orm', () => ({
  eq: (column: any, value: any) => ({ kind: 'eq', column: column?.name, value }),
  and: (...conds: any[]) => ({ kind: 'and', conds: conds.filter(Boolean) }),
}));

// RouteAuth fake mirroring the web host: middleware-stashed users flow through
// unchanged, and `ensureUser` simulates cookie-based session resolution +
// personal-org bootstrap. A no-org cookie user comes back with an
// `organizationId` populated (mirroring the provider's `ensureOrganization`),
// so `tenant()` yields a real tenant instead of an org gate 403.
let cookieUser: { workosId: string; organizationId?: string } | null = null;
// Bootstrap is always attempted for no-org users, but the WorkOS create can
// fail (e.g. missing API permissions); toggle to exercise that failure path.
let bootstrapSucceeds = true;
const testAuth: RouteAuth = {
  enabled: () => true,
  ensureUser: async (c: any) => {
    const existing = c.get('webAuthUser');
    if (existing) return existing;
    if (!cookieUser) return undefined;
    const u = cookieUser;
    // Bootstrap: a personal (no-org) user gets a personal org. When the WorkOS
    // create fails, the user stays no-org and the org gate still fires.
    const organizationId = u.organizationId ?? (bootstrapSucceeds ? `org-personal-${u.workosId}` : undefined);
    const resolved: { workosId: string; organizationId?: string } = { workosId: u.workosId, organizationId };
    c.set('webAuthUser', resolved);
    return resolved;
  },
  tenant: (c: any) => {
    const u = c.get('webAuthUser') as { workosId: string; organizationId?: string } | undefined;
    return u ? { orgId: u.organizationId, userId: u.workosId } : undefined;
  },
  isOrganizationAdmin: async () => true,
};

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
  const installationId = row.installationRecordId ?? `installation-${row.orgId}-${row.installationId}`;
  const repositoryId = `repository-${row.id}`;
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
  tables.repositories.push({
    id: repositoryId,
    installationId,
    externalId: String(row.repoId ?? 99),
    slug: row.repoFullName ?? 'octo/hello',
    defaultBranch: 'main',
    providerMetadata: {},
    createdAt: now,
    updatedAt: now,
  });
  tables.connections.push({
    id: connectionId,
    factoryProjectId: `factory-${row.id}`,
    integrationId: 'github',
    installationId,
    createdByUserId: row.userId,
    createdAt: now,
  });

  return {
    id: row.id,
    connectionId,
    repositoryId,
    branch: 'main',
    sandboxProvider: 'railway',
    sandboxWorkdir: '/workspace/hello',
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

let mintCount = 0;
// Stub integration instance: routes consume the injected `github` instance —
// real DI instead of module mocking (client.ts no longer exists).
const githubStub = {
  sourceControlStorage,
  buildInstallUrl: (state: string) => `https://github.com/apps/test/installations/new?state=${state}`,
  buildOAuthIdentifyUrl: (state: string) => `https://github.com/login/oauth/authorize?state=${state}`,
  exchangeOAuthCode: vi.fn(async () => 'user-token'),
  listUserInstallations: vi.fn(async () => [{ installationId: 7, accountLogin: 'octo', accountType: 'User' }]),
  listInstallationRepos: vi.fn(
    async (): Promise<
      Array<{
        id: number;
        fullName: string;
        name: string;
        owner: string;
        defaultBranch: string;
        private: boolean;
        installationId: number;
      }>
    > => [],
  ),
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
  mintInstallationToken: vi.fn(async () => `install-token-${++mintCount}`),
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

// Mirror production: provisioning persists a sandboxId onto the binding row so
// the later git routes can reattach. We update the fake DB row in place.
const ensureProjectSandbox = vi.fn(async (opts: { row: any; storage: SourceControlStorageInMemory['sandboxes'] }) => {
  const sandboxId = opts.row.sandboxId ?? `sb-${opts.row.userId}`;
  await opts.storage.setSandboxId({ id: opts.row.id, sandboxId });
  return { id: sandboxId };
});
const materializeRepo = vi.fn(async (_opts: any) => {});
const reattachSandbox = vi.fn(async (_id: string) => ({ id: 'sb' }));
const ensureWorktree = vi.fn(async (_sb: any, _workdir: string, opts: { branch: string; baseBranch: string }) => ({
  worktreePath: `/workspace/hello/../worktrees/${opts.branch}`,
  branch: opts.branch,
  baseBranch: opts.baseBranch,
}));
const commitAll = vi.fn(async () => ({ committed: true }));
const pushBranch = vi.fn(async () => {});
const createPullRequest = vi.fn(async () => ({ url: 'https://github.com/octo/hello/pull/1' }));
let sandboxEnabled = true;
/** DI-injected fleet stub — routes read `enabled`/`provider`/`computeWorkdir`/`reattachSandbox`. */
const fleet = {
  get enabled() {
    return sandboxEnabled;
  },
  get provider() {
    return sandboxEnabled ? 'railway' : 'none';
  },
  computeWorkdir: (repo: string) => `/workspace/${repo.split('/').pop()}`,
  reattachSandbox: (id: string) => reattachSandbox(id),
} as unknown as SandboxFleet;
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
    ensureProjectSandbox: (opts: any) => ensureProjectSandbox(opts),
    materializeRepo: (opts: any) => materializeRepo(opts),
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
let _projectRepositoriesRef: any;
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
  const existing = tables[kind].find(row => targets.every(t => (row as any)[t] === vals[t]));
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
_projectRepositoriesRef = githubProjectRepositories;
worktreesRef = githubWorktrees;
sandboxesRef = githubProjectSandboxes;

function buildApp(user: { workosId: string; organizationId?: string } | null) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('webAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app as any,
    buildGithubRoutes({
      baseUrl: 'http://localhost:4111',
      github: githubStub as any,
      stateSigner,
      auth: testAuth,
      fleet,
    }),
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
  cookieUser = null;
  bootstrapSucceeds = true;
  // No Postgres in these scenario tests: keep the project lock in-process.
  process.env.MASTRACODE_DISTRIBUTED_LOCK = '0';
  mintCount = 0;
  ensureProjectSandbox.mockClear();
  materializeRepo.mockClear();
  reattachSandbox.mockClear();
  ensureWorktree.mockClear();
  commitAll.mockClear();
  pushBranch.mockClear();
  createPullRequest.mockClear();
});

afterEach(() => {
  delete process.env.MASTRACODE_DISTRIBUTED_LOCK;
  vi.clearAllMocks();
});

// ── Scenario 1: same repo, two orgs, no bleed ────────────────────────────
describe('same repo connected by two orgs stays isolated', () => {
  it('gives each org its own project-repository row and forbids cross-org operations', async () => {
    const projectRepositoryA = projectRepositoryRow({
      id: 'project-repository-a',
      orgId: 'orgA',
      userId: 'a1',
      installationId: 7,
    });
    const projectRepositoryB = projectRepositoryRow({
      id: 'project-repository-b',
      orgId: 'orgB',
      userId: 'b1',
      installationId: 7,
    });
    tables.projectRepositories.push(projectRepositoryA, projectRepositoryB);

    const appA = buildApp({ workosId: 'a1', organizationId: 'orgA' });

    expect(projectRepositoryA.id).not.toBe(projectRepositoryB.id);
    expect(tables.projectRepositories).toHaveLength(2);

    // Org A cannot ensure / worktree / push against Org B's project-repository id.
    expect((await postJson(appA, `/web/github/projects/${projectRepositoryB.id}/ensure`, {})).status).toBe(404);
    expect(
      (await postJson(appA, `/web/github/projects/${projectRepositoryB.id}/worktree`, { branch: 'feat/x' })).status,
    ).toBe(404);
    expect(
      (await postJson(appA, `/web/github/projects/${projectRepositoryB.id}/push`, { branch: 'feat/x' })).status,
    ).toBe(404);
  });
});

// ── Scenario 2: two users, one org, own sandboxes ────────────────────────
describe('two users in one org each get their own sandbox + worktree', () => {
  function seedOrgProject() {
    tables.projectRepositories.push(projectRepositoryRow({ id: 'p1', orgId: 'orgA', userId: 'a1', installationId: 7 }));
  }

  it('creates a distinct (project,user) sandbox row per user and hides worktrees across users', async () => {
    seedOrgProject();
    const user1 = buildApp({ workosId: 'a1', organizationId: 'orgA' });
    const user2 = buildApp({ workosId: 'a2', organizationId: 'orgA' });

    // Both users open (ensure) the same org-owned project.
    expect((await postJson(user1, '/web/github/projects/p1/ensure', {})).status).toBe(200);
    expect((await postJson(user2, '/web/github/projects/p1/ensure', {})).status).toBe(200);

    // Each got their own per-(project,user) sandbox binding row.
    expect(tables.sandboxes).toHaveLength(2);
    expect(tables.sandboxes.filter(s => s.projectRepositoryId === 'p1' && s.userId === 'a1')).toHaveLength(1);
    expect(tables.sandboxes.filter(s => s.projectRepositoryId === 'p1' && s.userId === 'a2')).toHaveLength(1);

    // User 1 creates a worktree; it is owned by user 1 only.
    const wt = await postJson(user1, '/web/github/projects/p1/worktree', { branch: 'feat/x' });
    expect(wt.status).toBe(200);
    const wtPath = (await wt.json()).worktreePath as string;
    expect(tables.worktrees).toHaveLength(1);
    expect(tables.worktrees[0]).toMatchObject({ userId: 'a1', projectRepositoryId: 'p1' });

    // User 2 cannot commit against user 1's worktree path (scoped to (p,user)).
    const crossCommit = await postJson(user2, '/web/github/projects/p1/commit', {
      message: 'sneaky',
      worktreePath: wtPath,
    });
    expect(crossCommit.status).toBe(400);
    expect((await crossCommit.json()).error).toBe('Invalid worktreePath');

    // User 1 can commit against their own worktree path.
    const ownCommit = await postJson(user1, '/web/github/projects/p1/commit', {
      message: 'wip',
      worktreePath: wtPath,
    });
    expect(ownCommit.status).toBe(200);
    expect(await ownCommit.json()).toMatchObject({ committed: true });
  });
});

// ── Scenario 3: cross-user worktree path rejected even with same branch ───
describe('cross-user worktree paths are rejected', () => {
  it('does not let user 2 push user 1 worktree path when both share a branch name', async () => {
    tables.projectRepositories.push(projectRepositoryRow({ id: 'p1', orgId: 'orgA', userId: 'a1', installationId: 7 }));
    // Both users have their own sandbox bindings + a worktree row on the same
    // branch name; uniqueness is (project,user,branch) so both can coexist.
    for (const userId of ['a1', 'a2']) {
      tables.sandboxes.push({
        id: `sbrow-${userId}`,
        projectRepositoryId: 'p1',
        userId,
        sandboxId: `sb-${userId}`,
        sandboxWorkdir: '/workspace/hello',
        materializedAt: new Date(),
      });
      tables.worktrees.push({
        id: `wt-${userId}`,
        orgId: 'orgA',
        userId,
        projectRepositoryId: 'p1',
        branch: 'feat/x',
        baseBranch: 'main',
        worktreePath: `/workspace/hello/../worktrees/${userId}/feat/x`,
      });
    }

    const user2 = buildApp({ workosId: 'a2', organizationId: 'orgA' });

    // User 2 supplies user 1's worktree path → rejected (path not owned).
    const res = await postJson(user2, '/web/github/projects/p1/push', {
      branch: 'feat/x',
      worktreePath: '/workspace/hello/../worktrees/a1/feat/x',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid worktreePath');
    expect(pushBranch).not.toHaveBeenCalled();

    // User 2 with their own worktree path succeeds.
    const ok = await postJson(user2, '/web/github/projects/p1/push', {
      branch: 'feat/x',
      worktreePath: '/workspace/hello/../worktrees/a2/feat/x',
    });
    expect(ok.status).toBe(200);
    expect(pushBranch).toHaveBeenCalledOnce();
  });
});

// ── Phase 4: org-scoped GitHub install flow ──────────────────────────────
// The install `state` carries `(orgId, userId)`; the callback persists the
// installation against the org and rejects a session whose org differs from
// the signed state's org. A second user in the same org then sees the shared
// org-level installation and can create projects from it.
describe('install flow binds the installation to the org', () => {
  it('persists an org-owned installation, then a second org user can use it', async () => {
    // User 1 connects: state must encode their (org, user).
    const connect = await buildApp({ workosId: 'a1', organizationId: 'orgA' }).request('/auth/github/connect');
    expect(connect.status).toBe(302);
    expect(connect.headers.get('location')).toContain('state=state.orgA.a1');

    // Callback with a matching state persists the installation against orgA.
    const cb = await buildApp({ workosId: 'a1', organizationId: 'orgA' }).request(
      '/auth/github/callback?state=state.orgA.a1&code=abc',
    );
    expect(cb.headers.get('location')).toBe('/?github=connected');
    expect(tables.installations).toHaveLength(1);
    expect(tables.installations[0]).toMatchObject({ orgId: 'orgA', externalId: '7' });

    // A different user in the same org sees the org-level installation and can
    // discover repositories from it (no second install required).
    githubStub.listInstallationRepos.mockResolvedValueOnce([
      {
        id: 99,
        fullName: 'octo/hello',
        name: 'hello',
        owner: 'octo',
        defaultBranch: 'main',
        private: false,
        installationId: 7,
      },
    ]);
    const user2 = buildApp({ workosId: 'a2', organizationId: 'orgA' });
    const status = await user2.request('/web/github/status');
    expect((await status.json()).connected).toBe(true);

    const repos = await user2.request('/web/github/repos');
    expect(repos.status).toBe(200);
    expect(tables.repositories).toHaveLength(1);
    expect(tables.repositories[0]).toMatchObject({
      installationId: tables.installations[0]!.id,
      externalId: '99',
      slug: 'octo/hello',
      defaultBranch: 'main',
    });
    expect(await repos.json()).toMatchObject({
      repos: [
        {
          id: 99,
          fullName: 'octo/hello',
          installationId: 7,
          installationStorageId: tables.installations[0]!.id,
          repositoryStorageId: tables.repositories[0]!.id,
          sandboxProvider: 'railway',
          sandboxWorkdir: '/workspace/hello',
        },
      ],
    });
  });

  it('rejects a callback whose session org differs from the signed state org', async () => {
    // State was signed for orgA but the callback session is in orgB.
    const res = await buildApp({ workosId: 'a1', organizationId: 'orgB' }).request(
      '/auth/github/callback?state=state.orgA.a1&code=abc',
    );
    expect(res.headers.get('location')).toBe('/?github=error');
    expect(tables.installations).toHaveLength(0);
  });
});

// ── Personal-org bootstrap: no-org cookie connect reaches install ─────────
// A user who signs in with no WorkOS organization used to dead-end at the org
// gate (`organization_required`). With bootstrap, `ensureWebAuthUser` gives the
// personal account an org on first authenticated use, so a cookie-only
// navigation to `/auth/github/connect` redirects to the GitHub App install with
// the bootstrapped org encoded in the signed state — not a 403.
describe('personal-org bootstrap on the cookie connect flow', () => {
  it('redirects a no-org cookie user to install with the bootstrapped org', async () => {
    // The gate skips `/auth/*`, so no user is stashed up front; the cookie user
    // has no organization yet.
    cookieUser = { workosId: 'solo1' };

    const res = await buildApp(null).request('/auth/github/connect');

    expect(res.status).toBe(302);
    const location = res.headers.get('location') ?? '';
    // Bootstrap produced a personal org; the signed state carries (org, user).
    expect(location).toContain('state=state.org-personal-solo1.solo1');
  });

  it('still org-gates a no-org cookie user when bootstrap fails', async () => {
    // When the WorkOS org create fails (e.g. missing API permissions), the
    // personal account stays no-org, so the org gate fires as before.
    bootstrapSucceeds = false;
    cookieUser = { workosId: 'solo1' };

    const res = await buildApp(null).request('/auth/github/connect');

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('organization_required');
  });
});
