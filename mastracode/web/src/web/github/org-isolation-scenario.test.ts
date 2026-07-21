import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AuthModule from '../auth';
import { SourceControlStorageInMemory } from '../storage/domains/source-control/inmemory';

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

// Partially mock `../auth`: keep the real helpers (getWebAuthUser/webAuthTenant)
// so middleware-stashed users flow through unchanged, but make
// `ensureWebAuthUser` simulate cookie-based session resolution + personal-org
// bootstrap on `/auth/*` routes the gate skips. A no-org cookie user comes back
// with an `organizationId` populated (mirroring the provider's `ensureOrganization`), so
// downstream `webAuthTenant` yields a real tenant instead of an org gate 403.
let cookieUser: { workosId: string; organizationId?: string } | null = null;
// Bootstrap is always attempted for no-org users, but the WorkOS create can
// fail (e.g. missing API permissions); toggle to exercise that failure path.
let bootstrapSucceeds = true;
vi.mock('../auth', async () => {
  const actual = (await vi.importActual('../auth')) as typeof AuthModule;
  return {
    ...actual,
    ensureWebAuthUser: async (c: any) => {
      const existing = actual.getWebAuthUser(c);
      if (existing) return existing;
      if (!cookieUser) return undefined;
      const u = cookieUser as { workosId: string; organizationId?: string };
      // Bootstrap: a personal (no-org) user gets a personal org. When the WorkOS
      // create fails, the user stays no-org and the org gate still fires.
      const organizationId = u.organizationId ?? (bootstrapSucceeds ? `org-personal-${u.workosId}` : undefined);
      const resolved: { workosId: string; organizationId?: string } = { workosId: u.workosId, organizationId };
      c.set('webAuthUser', resolved);
      return resolved;
    },
  };
});

interface Tables {
  installations: Array<{
    id: string;
    integrationId: string;
    orgId: string;
    connectedByUserId: string;
    externalId: string;
    accountName: string | null;
    accountType: string | null;
    providerMetadata: Record<string, unknown>;
    createdAt: Date;
  }>;
  projects: Array<Record<string, any>>;
  sandboxes: Array<Record<string, any>>;
  worktrees: Array<Record<string, any>>;
}
const tables: Tables = { installations: [], projects: [], sandboxes: [], worktrees: [] };
const sourceControlStorage = new SourceControlStorageInMemory();

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
  listInstallationRepos: vi.fn(async () => []),
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
const ensureProjectSandbox = vi.fn(async (row: any, storage: SourceControlStorageInMemory['sandboxes']) => {
  const sandboxId = row.sandboxId ?? `sb-${row.userId}`;
  await storage.setSandboxId(row.id, sandboxId);
  return { id: sandboxId };
});
const materializeRepo = vi.fn(async () => {});
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
  if (table === worktreesRef) return 'worktrees';
  if (table === sandboxesRef) return 'sandboxes';
  return 'projects';
}
let installationsRef: any;
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
const githubProjectSandboxes = {};
const githubWorktrees = {};
installationsRef = githubInstallations;
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
  tables.projects = [];
  tables.sandboxes = [];
  tables.worktrees = [];
  sourceControlStorage.installationsRows = tables.installations as any;
  sourceControlStorage.projectsRows = tables.projects as any;
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
  it('gives each org its own project row and forbids cross-org operations', async () => {
    // Each org has its own installation for the same repo.
    tables.installations.push({
      id: 'installation-a',
      integrationId: 'github',
      orgId: 'orgA',
      connectedByUserId: 'a1',
      externalId: '7',
      accountName: 'octo',
      accountType: 'User',
      providerMetadata: {},
      createdAt: new Date(),
    });
    tables.installations.push({
      id: 'installation-b',
      integrationId: 'github',
      orgId: 'orgB',
      connectedByUserId: 'b1',
      externalId: '7',
      accountName: 'octo',
      accountType: 'User',
      providerMetadata: {},
      createdAt: new Date(),
    });

    const appA = buildApp({ workosId: 'a1', organizationId: 'orgA' });
    const appB = buildApp({ workosId: 'b1', organizationId: 'orgB' });

    const resA = await postJson(appA, '/web/github/repositories', { repoFullName: 'octo/hello', installationId: 7 });
    const resB = await postJson(appB, '/web/github/repositories', { repoFullName: 'octo/hello', installationId: 7 });
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    const projA = (await resA.json()).repository.id as string;
    const projB = (await resB.json()).repository.id as string;

    // The (org_id, repo_id) unique target means two orgs → two distinct rows.
    expect(projA).not.toBe(projB);
    expect(tables.projects).toHaveLength(2);
    expect(tables.projects.find(p => p.id === projA)?.orgId).toBe('orgA');
    expect(tables.projects.find(p => p.id === projB)?.orgId).toBe('orgB');

    // Org A cannot ensure / worktree / push against Org B's project id.
    expect((await postJson(appA, `/web/github/repositories/${projB}/ensure`, {})).status).toBe(404);
    expect((await postJson(appA, `/web/github/repositories/${projB}/worktree`, { branch: 'feat/x' })).status).toBe(404);
    expect((await postJson(appA, `/web/github/repositories/${projB}/push`, { branch: 'feat/x' })).status).toBe(404);
  });
});

// ── Scenario 2: two users, one org, own sandboxes ────────────────────────
describe('two users in one org each get their own sandbox + worktree', () => {
  function seedOrgProject() {
    tables.projects.push({
      id: 'p1',
      integrationId: 'github',
      orgId: 'orgA',
      createdByUserId: 'a1',
      installationExternalId: '7',
      repositoryExternalId: '99',
      repositorySlug: 'octo/hello',
      defaultBranch: 'main',
      sandboxProvider: 'railway',
      sandboxWorkdir: '/workspace/hello',
      setupCommand: null,
      providerMetadata: {},
      createdAt: new Date(),
    });
  }

  it('creates a distinct (project,user) sandbox row per user and hides worktrees across users', async () => {
    seedOrgProject();
    const user1 = buildApp({ workosId: 'a1', organizationId: 'orgA' });
    const user2 = buildApp({ workosId: 'a2', organizationId: 'orgA' });

    // Both users open (ensure) the same org-owned project.
    expect((await postJson(user1, '/web/github/repositories/p1/ensure', {})).status).toBe(200);
    expect((await postJson(user2, '/web/github/repositories/p1/ensure', {})).status).toBe(200);

    // Each got their own per-(project,user) sandbox binding row.
    expect(tables.sandboxes).toHaveLength(2);
    expect(tables.sandboxes.filter(s => s.projectId === 'p1' && s.userId === 'a1')).toHaveLength(1);
    expect(tables.sandboxes.filter(s => s.projectId === 'p1' && s.userId === 'a2')).toHaveLength(1);

    // User 1 creates a worktree; it is owned by user 1 only.
    const wt = await postJson(user1, '/web/github/repositories/p1/worktree', { branch: 'feat/x' });
    expect(wt.status).toBe(200);
    const wtPath = (await wt.json()).worktreePath as string;
    expect(tables.worktrees).toHaveLength(1);
    expect(tables.worktrees[0]).toMatchObject({ userId: 'a1', orgId: 'orgA', projectId: 'p1' });

    // User 2 cannot commit against user 1's worktree path (scoped to (p,user)).
    const crossCommit = await postJson(user2, '/web/github/repositories/p1/commit', {
      message: 'sneaky',
      worktreePath: wtPath,
    });
    expect(crossCommit.status).toBe(400);
    expect((await crossCommit.json()).error).toBe('Invalid worktreePath');

    // User 1 can commit against their own worktree path.
    const ownCommit = await postJson(user1, '/web/github/repositories/p1/commit', {
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
    tables.projects.push({
      id: 'p1',
      integrationId: 'github',
      orgId: 'orgA',
      createdByUserId: 'a1',
      installationExternalId: '7',
      repositoryExternalId: '99',
      repositorySlug: 'octo/hello',
      defaultBranch: 'main',
      sandboxProvider: 'railway',
      sandboxWorkdir: '/workspace/hello',
      setupCommand: null,
      providerMetadata: {},
      createdAt: new Date(),
    });
    // Both users have their own sandbox bindings + a worktree row on the same
    // branch name; uniqueness is (project,user,branch) so both can coexist.
    for (const userId of ['a1', 'a2']) {
      tables.sandboxes.push({
        id: `sbrow-${userId}`,
        projectId: 'p1',
        userId,
        sandboxId: `sb-${userId}`,
        sandboxWorkdir: '/workspace/hello',
        materializedAt: new Date(),
      });
      tables.worktrees.push({
        id: `wt-${userId}`,
        orgId: 'orgA',
        userId,
        projectId: 'p1',
        branch: 'feat/x',
        baseBranch: 'main',
        worktreePath: `/workspace/hello/../worktrees/${userId}/feat/x`,
      });
    }

    const user2 = buildApp({ workosId: 'a2', organizationId: 'orgA' });

    // User 2 supplies user 1's worktree path → rejected (path not owned).
    const res = await postJson(user2, '/web/github/repositories/p1/push', {
      branch: 'feat/x',
      worktreePath: '/workspace/hello/../worktrees/a1/feat/x',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid worktreePath');
    expect(pushBranch).not.toHaveBeenCalled();

    // User 2 with their own worktree path succeeds.
    const ok = await postJson(user2, '/web/github/repositories/p1/push', {
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
    // create a project from it (no second install required).
    const user2 = buildApp({ workosId: 'a2', organizationId: 'orgA' });
    const status = await user2.request('/web/github/status');
    expect((await status.json()).connected).toBe(true);

    const proj = await postJson(user2, '/web/github/repositories', {
      repoFullName: 'octo/hello',
      installationId: 7,
    });
    expect(proj.status).toBe(200);
    expect(tables.projects).toHaveLength(1);
    expect(tables.projects[0]).toMatchObject({ orgId: 'orgA', repositoryExternalId: '99' });
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
