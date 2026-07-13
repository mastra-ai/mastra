import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AuthModule from '../auth';

// ── Mocks ────────────────────────────────────────────────────────────────
// Mock drizzle's `eq`/`and` so the fake DB below can honour `where` predicates.
// Each `eq(col, val)` yields a `{ column, value }` descriptor (using the
// column's `.name`), and `and(...)` wraps them so `filterRows` can apply them.
vi.mock('drizzle-orm', () => ({
  eq: (column: any, value: any) => ({ kind: 'eq', column: column?.name, value }),
  and: (...conds: any[]) => ({ kind: 'and', conds: conds.filter(Boolean) }),
}));

// In-memory tables so route handlers exercise real query-builder call shapes
// against a tiny fake. We only model the operations the routes actually use.
interface Tables {
  installations: Array<{
    orgId?: string;
    userId: string;
    installationId: number;
    accountLogin: string | null;
    accountType: string | null;
  }>;
  projects: Array<Record<string, any>>;
  sandboxes: Array<Record<string, any>>;
  worktrees: Array<Record<string, any>>;
}
const tables: Tables = { installations: [], projects: [], sandboxes: [], worktrees: [] };

vi.mock('./db', () => {
  // Minimal chainable drizzle-like stub keyed off the table object identity.
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
      set: (vals: any) => ({ where: async () => updateRows(table, vals) }),
    }),
    delete: (table: any) => ({
      where: async (cond: any) => deleteRows(table, cond),
    }),
  });
  return { getAppDb: () => makeDb() };
});

const listRepoOpenIssues = vi.fn(async (_installationId: number, _repoFullName: string, _page: number) => ({
  issues: [
    {
      number: 12,
      title: 'Fix flaky test',
      url: 'https://github.com/octo/hello/issues/12',
      author: 'ada',
      labels: ['bug'],
      comments: 3,
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-02T00:00:00Z',
    },
  ],
  nextPage: null as number | null,
}));
const listRepoOpenPullRequests = vi.fn(async (_installationId: number, _repoFullName: string, _page: number) => ({
  pullRequests: [
    {
      number: 34,
      title: 'Add factory pages',
      url: 'https://github.com/octo/hello/pull/34',
      author: 'grace',
      baseBranch: 'main',
      headBranch: 'feat/factory',
      createdAt: '2026-07-03T00:00:00Z',
      updatedAt: '2026-07-04T00:00:00Z',
    },
  ],
  nextPage: null as number | null,
}));

vi.mock('./client', () => ({
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
  mintInstallationToken: vi.fn(async () => 'install-token'),
  listRepoOpenIssues: (installationId: number, repoFullName: string, page: number) =>
    listRepoOpenIssues(installationId, repoFullName, page),
  listRepoOpenPullRequests: (installationId: number, repoFullName: string, page: number) =>
    listRepoOpenPullRequests(installationId, repoFullName, page),
}));

const ensureProjectSandbox = vi.fn(async (_row: any, onProgress?: (e: any) => void) => {
  onProgress?.({ phase: 'provisioning', message: 'Provisioning a new sandbox…' });
  return { id: 'sb' };
});
const materializeRepo = vi.fn(async (..._args: any[]) => {
  const onProgress = _args[4] as ((e: any) => void) | undefined;
  onProgress?.({ phase: 'cloning', message: 'Cloning octo/hello…' });
});
const reattachProjectSandbox = vi.fn(async (_id: string) => ({ id: 'sb' }));
const ensureWorktree = vi.fn(async (_sb: any, _workdir: string, opts: { branch: string; baseBranch: string }) => ({
  worktreePath: `/workspace/hello/../worktrees/${opts.branch}`,
  branch: opts.branch,
  baseBranch: opts.baseBranch,
}));
const removeWorktree = vi.fn(async (_sb: any, _workdir: string, _opts: { branch: string; worktreePath: string }) => {});
const runWorktreeSetup = vi.fn(async (_sb: any, _worktreePath: string, _command: string) => {});
const commitAll = vi.fn(async () => ({ committed: true }));
const pushBranch = vi.fn(async () => {});
const createPullRequest = vi.fn(async () => ({ url: 'https://github.com/octo/hello/pull/1' }));
let sandboxEnabled = true;
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
    computeSandboxWorkdir: (repo: string) => `/workspace/${repo.split('/').pop()}`,
    getSandboxProvider: () => 'railway',
    isSandboxEnabled: () => sandboxEnabled,
    ensureProjectSandbox: (row: any, onProgress?: any) => ensureProjectSandbox(row, onProgress),
    materializeRepo: (...args: any[]) => materializeRepo(...(args as [])),
    reattachProjectSandbox: (id: string) => reattachProjectSandbox(id),
    ensureWorktree: (sb: any, workdir: string, opts: any) => ensureWorktree(sb, workdir, opts),
    removeWorktree: (sb: any, workdir: string, opts: any) => removeWorktree(sb, workdir, opts),
    runWorktreeSetup: (sb: any, worktreePath: string, command: string) => runWorktreeSetup(sb, worktreePath, command),
    commitAll: (...args: any[]) => commitAll(...(args as [])),
    pushBranch: (...args: any[]) => pushBranch(...(args as [])),
    createPullRequest: (...args: any[]) => createPullRequest(...(args as [])),
    // Match the real ref validator closely enough for route tests.
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
  signState: (orgId: string, userId: string) => `state.${orgId}.${userId}`,
  verifyState: (state: string | undefined) => {
    if (!state?.startsWith('state.')) return null;
    const [orgId, userId] = state.slice('state.'.length).split('.');
    if (!orgId || !userId) return null;
    return { orgId, userId };
  },
}));

// Partially mock `../auth`: keep all real helpers (getWebAuthUser/webAuthTenant)
// so the harness's middleware-stashed user flows through normally, but make
// `ensureWebAuthUser` simulate cookie-based session resolution on `/auth/*`
// routes the gate skips — it stashes `cookieUser` onto the context the same way
// production resolves a session cookie before scoping the tenant.
let cookieUser: { workosId: string; organizationId?: string } | null = null;
vi.mock('../auth', async () => {
  const actual = (await vi.importActual('../auth')) as typeof AuthModule;
  return {
    ...actual,
    ensureWebAuthUser: async (c: any) => {
      const existing = actual.getWebAuthUser(c);
      if (existing) return existing;
      if (!cookieUser) return undefined;
      const u = cookieUser as { workosId: string; organizationId?: string };
      const withOrg: { workosId: string; organizationId?: string } = {
        workosId: u.workosId,
        organizationId: u.organizationId ?? 'org1',
      };
      c.set('webAuthUser', withOrg);
      return withOrg;
    },
  };
});

import { mountApiRoutes } from '../test-utils';
import { buildGithubRoutes } from './routes';
// The mocked class from the `./sandbox` factory above — routes match on
// `instanceof WorktreeError`, so failure specs must throw this exact class.
import { WorktreeError as MockedWorktreeError } from './sandbox';

// ── Fake table helpers ──────────────────────────────────────────────────
function tableKind(table: any): keyof Tables {
  if (table === installationsRef) return 'installations';
  if (table === worktreesRef) return 'worktrees';
  if (table === sandboxesRef) return 'sandboxes';
  return 'projects';
}
// We can't import the actual schema objects easily into the closure used by the
// mock above, so resolve them lazily here for the helpers.
let installationsRef: any;
let worktreesRef: any;
let sandboxesRef: any;

// Drizzle columns carry their snake_case DB `.name`, but our fake rows use the
// camelCase JS keys. Build a DB-name → JS-key map per table so predicates match.
function dbNameToJsKey(table: any, dbName: string): string {
  for (const [jsKey, col] of Object.entries(table)) {
    if ((col as any)?.name === dbName) return jsKey;
  }
  return dbName;
}

// Apply a mocked `eq`/`and` predicate to a row.
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
  // Conflict targets are columns; match an existing row on all of them (mapped
  // back to JS keys since vals/rows are camelCase).
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
// onConflictDoNothing: insert only when no row matches the conflict target;
// returns the inserted row, or undefined when a conflicting row already exists.
function insertIfAbsent(table: any, vals: any, opts: any): any | undefined {
  const kind = tableKind(table);
  const targets: string[] = (opts?.target ?? [])
    .map((col: any) => (col?.name ? dbNameToJsKey(table, col.name) : undefined))
    .filter(Boolean);
  if (targets.length) {
    const existing = tables[kind].find(row => targets.every(t => row[t] === vals[t]));
    if (existing) return undefined;
  }
  return insertRow(table, vals);
}
function updateRows(table: any, vals: any): void {
  for (const row of tables[tableKind(table)]) Object.assign(row, vals);
}
function deleteRows(table: any, cond?: any): void {
  const kind = tableKind(table);
  tables[kind] = tables[kind].filter(row => !matches(table, row, cond)) as any;
}

// Resolve schema refs after import.
import { listInstallationRepos, listUserInstallations } from './client';
import { githubInstallations, githubProjectSandboxes, githubWorktrees } from './schema';
installationsRef = githubInstallations;
worktreesRef = githubWorktrees;
sandboxesRef = githubProjectSandboxes;

// ── Test harness ─────────────────────────────────────────────────────────
function buildApp(user: { workosId: string; organizationId?: string } | null) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) {
      // Default to an organization so org-scoped GitHub features are enabled;
      // tests that need a personal (no-org) account pass `organizationId` null.
      const withOrg = 'organizationId' in user ? user : { ...user, organizationId: 'org1' };
      c.set('webAuthUser' as never, withOrg as never);
    }
    await next();
  });
  mountApiRoutes(app as any, buildGithubRoutes({ baseUrl: 'http://localhost:4111' }));
  return app;
}

beforeEach(() => {
  tables.installations = [];
  tables.projects = [];
  tables.sandboxes = [];
  tables.worktrees = [];
  featureEnabled = true;
  sandboxEnabled = true;
  cookieUser = null;
  // No Postgres in these unit tests: keep the project lock purely in-process.
  process.env.MASTRACODE_DISTRIBUTED_LOCK = '0';
  ensureProjectSandbox.mockClear();
  materializeRepo.mockClear();
  reattachProjectSandbox.mockClear();
  ensureWorktree.mockClear();
  removeWorktree.mockClear();
  runWorktreeSetup.mockClear();
  commitAll.mockClear();
  pushBranch.mockClear();
  createPullRequest.mockClear();
  listRepoOpenIssues.mockClear();
  listRepoOpenPullRequests.mockClear();
});

afterEach(() => {
  delete process.env.MASTRACODE_DISTRIBUTED_LOCK;
  vi.clearAllMocks();
});

describe('status route', () => {
  it('reports disabled without the feature', async () => {
    featureEnabled = false;
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/status');
    expect(await res.json()).toMatchObject({ enabled: false, connected: false });
  });

  it('reports connected installations for the user', async () => {
    tables.installations.push({
      orgId: 'org1',
      userId: 'u1',
      installationId: 7,
      accountLogin: 'octo',
      accountType: 'User',
    });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/status');
    const json = await res.json();
    expect(json.enabled).toBe(true);
    expect(json.connected).toBe(true);
    expect(json.installations[0].installationId).toBe(7);
  });
});

describe('repos route', () => {
  const install = (installationId: number, accountLogin: string) => {
    tables.installations.push({ orgId: 'org1', userId: 'u1', installationId, accountLogin, accountType: 'User' });
  };

  // The `./client` mock's default implementation must survive these tests
  // (clearAllMocks does not restore implementations).
  const defaultImpl = async (installationId: number) => [
    {
      id: 99,
      fullName: 'octo/hello',
      name: 'hello',
      owner: 'octo',
      defaultBranch: 'main',
      private: false,
      installationId,
    },
  ];
  afterEach(() => {
    vi.mocked(listInstallationRepos).mockImplementation(defaultImpl);
  });

  it('prunes installations GitHub no longer knows (404) and keeps listing the rest', async () => {
    install(7, 'octo');
    install(8, 'stale');
    vi.mocked(listInstallationRepos).mockImplementation(async (installationId: number) => {
      if (installationId === 8) {
        throw Object.assign(new Error('Not Found'), { status: 404 });
      }
      return defaultImpl(installationId);
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await buildApp({ workosId: 'u1' }).request('/web/github/repos');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.repos).toHaveLength(1);
    expect(json.repos[0].fullName).toBe('octo/hello');
    // The stale row is gone; the live one remains.
    expect(tables.installations.map(i => i.installationId)).toEqual([7]);
    expect(String(errorSpy.mock.calls[0]![0])).toContain('stale GitHub installation 8');
    errorSpy.mockRestore();
  });

  it('does not prune on non-404 errors', async () => {
    install(7, 'octo');
    vi.mocked(listInstallationRepos).mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));

    // Hono's default onError turns the rethrown error into a 500.
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/repos');
    expect(res.status).toBe(500);
    expect(tables.installations).toHaveLength(1);
  });
});

describe('auth scoping', () => {
  it('401s when no user is present', async () => {
    const res = await buildApp(null).request('/web/github/repos');
    expect(res.status).toBe(401);
  });

  // Platform-adapter topology: custom apiRoutes run on an isolated sub-app
  // context where the outer gate's stashed user is invisible. The routes must
  // resolve the session cookie themselves (ensureWebAuthUser), not rely on the
  // gate's c.set(...).
  describe('without the gate (isolated custom-route context)', () => {
    it('status resolves the session from the cookie', async () => {
      cookieUser = { workosId: 'u1' };
      tables.installations.push({
        orgId: 'org1',
        userId: 'u1',
        installationId: 7,
        accountLogin: 'octo',
        accountType: 'User',
      });
      const res = await buildApp(null).request('/web/github/status');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.enabled).toBe(true);
      expect(json.connected).toBe(true);
    });

    it('org-tenant routes resolve the session from the cookie', async () => {
      cookieUser = { workosId: 'u1' };
      const res = await buildApp(null).request('/web/github/repos');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ repos: [] });
    });

    it('status still 401s with auth_required when there is no session', async () => {
      cookieUser = null;
      const res = await buildApp(null).request('/web/github/status');
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthorized', reason: 'auth_required' });
    });
  });
});

describe('connect + callback', () => {
  it('redirects connect to the OAuth identify URL with a signed state', async () => {
    // Identify-first: the install page dead-ends for already-installed apps,
    // so connect verifies the user via OAuth and lets the callback decide
    // whether an install is actually needed.
    const res = await buildApp({ workosId: 'u1' }).request('/auth/github/connect');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/login/oauth/authorize');
    expect(res.headers.get('location')).toContain('state=state.org1.u1');
  });

  it('redirects connect?manage=1 straight to the install URL', async () => {
    // "Manage GitHub connection" must land on GitHub's installation page —
    // the identify bounce completes invisibly for already-authorized users.
    const res = await buildApp({ workosId: 'u1' }).request('/auth/github/connect?manage=1');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/installations/new');
    expect(res.headers.get('location')).toContain('state=state.org1.u1');
  });

  it('resolves the session cookie on a cookie-only connect navigation (gate skips /auth/*)', async () => {
    // A top-level browser navigation to /auth/github/connect carries only the
    // session cookie — no Authorization header — and the auth gate skips
    // `/auth/*`, so no user is stashed up front. The route must still resolve
    // the session (via ensureWebAuthUser) and redirect to install, not 401.
    cookieUser = { workosId: 'u1' };
    const res = await buildApp(null).request('/auth/github/connect');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('state=state.org1.u1');
  });

  it('401s on a cookie-only connect navigation when there is no session', async () => {
    cookieUser = null;
    const res = await buildApp(null).request('/auth/github/connect');
    expect(res.status).toBe(401);
  });

  it('persists installations on a cookie-only callback navigation', async () => {
    cookieUser = { workosId: 'u1' };
    const res = await buildApp(null).request('/auth/github/callback?state=state.org1.u1&code=abc');
    expect(res.headers.get('location')).toBe('/?github=connected');
    expect(tables.installations).toHaveLength(1);
  });

  it('rejects a callback whose state belongs to another user', async () => {
    const res = await buildApp({ workosId: 'u1' }).request(
      '/auth/github/callback?state=state.org1.someone-else&code=x',
    );
    expect(res.headers.get('location')).toBe('/?github=error');
    expect(tables.installations).toHaveLength(0);
  });

  it('rejects a callback whose state belongs to another org', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/auth/github/callback?state=state.org2.u1&code=x');
    expect(res.headers.get('location')).toBe('/?github=error');
    expect(tables.installations).toHaveLength(0);
  });

  it('persists installations on a valid callback', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/auth/github/callback?state=state.org1.u1&code=abc');
    expect(res.headers.get('location')).toBe('/?github=connected');
    expect(tables.installations).toHaveLength(1);
  });

  it('does not trust an unverified installation_id without a code', async () => {
    const res = await buildApp({ workosId: 'u1' }).request(
      '/auth/github/callback?state=state.org1.u1&installation_id=999',
    );
    // No code → bounce through OAuth identify, persist nothing.
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/login/oauth/authorize');
    expect(tables.installations).toHaveLength(0);
  });

  it("bounces a GitHub settings 'Save' redirect (no state) through OAuth identify", async () => {
    // Updating an existing installation redirects here with installation_id +
    // setup_action but no signed state. Re-sync via a fresh identify bounce
    // instead of erroring out.
    const res = await buildApp({ workosId: 'u1' }).request(
      '/auth/github/callback?installation_id=7&setup_action=update',
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/login/oauth/authorize');
    expect(res.headers.get('location')).toContain('state=state.org1.u1');
    expect(tables.installations).toHaveLength(0);
  });

  it('redirects a verified user with no installations to the install URL', async () => {
    vi.mocked(listUserInstallations).mockResolvedValueOnce([]);
    const res = await buildApp({ workosId: 'u1' }).request('/auth/github/callback?state=state.org1.u1&code=abc');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/installations/new');
    expect(tables.installations).toHaveLength(0);
  });
});

describe('create project', () => {
  it('inserts a github-sourced project for an owned installation', async () => {
    tables.installations.push({
      orgId: 'org1',
      userId: 'u1',
      installationId: 7,
      accountLogin: 'octo',
      accountType: 'User',
    });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoFullName: 'octo/hello', repoId: 99, installationId: 7 }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.project.source).toBe('github');
    expect(json.project.name).toBe('octo/hello');
    expect(tables.projects).toHaveLength(1);
  });

  it('rejects an invalid repo name', async () => {
    tables.installations.push({
      orgId: 'org1',
      userId: 'u1',
      installationId: 7,
      accountLogin: 'octo',
      accountType: 'User',
    });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoFullName: 'not-a-repo', repoId: 99, installationId: 7 }),
    });
    expect(res.status).toBe(400);
  });

  it('404s when the repo is not accessible to the installation', async () => {
    tables.installations.push({
      orgId: 'org1',
      userId: 'u1',
      installationId: 7,
      accountLogin: 'octo',
      accountType: 'User',
    });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoFullName: 'octo/other-repo', installationId: 7 }),
    });
    expect(res.status).toBe(404);
  });

  it('persists the server-returned defaultBranch, ignoring the client value', async () => {
    tables.installations.push({
      orgId: 'org1',
      userId: 'u1',
      installationId: 7,
      accountLogin: 'octo',
      accountType: 'User',
    });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        repoFullName: 'octo/hello',
        installationId: 7,
        defaultBranch: "main'; rm -rf /; '",
      }),
    });
    expect(res.status).toBe(200);
    expect(tables.projects[0].defaultBranch).toBe('main');
  });

  it('404s when the installation is not owned by the user', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoFullName: 'octo/hello', repoId: 99, installationId: 7 }),
    });
    expect(res.status).toBe(404);
  });
});

describe('ensure (materialize)', () => {
  it('503s when the sandbox is not configured', async () => {
    sandboxEnabled = false;
    tables.projects.push({
      id: 'p1',
      orgId: 'org1',
      userId: 'u1',
      installationId: 7,
      repoFullName: 'octo/hello',
      sandboxWorkdir: '/workspace/hello',
    });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/ensure', { method: 'POST' });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('sandbox_not_configured');
  });

  it('provisions + materializes and returns a resourceId', async () => {
    tables.projects.push({
      id: 'p1',
      orgId: 'org1',
      userId: 'u1',
      installationId: 7,
      repoFullName: 'octo/hello',
      defaultBranch: 'main',
      sandboxWorkdir: '/workspace/hello',
    });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/ensure', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ resourceId: 'p1', githubProjectId: 'p1' });
    expect(ensureProjectSandbox).toHaveBeenCalledOnce();
    expect(materializeRepo).toHaveBeenCalledOnce();
    // A per-user sandbox binding row was created for the caller.
    expect(tables.sandboxes).toHaveLength(1);
    expect(tables.sandboxes[0]).toMatchObject({ githubProjectId: 'p1', userId: 'u1' });
  });

  it('404s for a project the user does not own', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/missing/ensure', {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });

  it('streams server-side progress events when the client accepts an event stream', async () => {
    tables.projects.push({
      id: 'p1',
      orgId: 'org1',
      userId: 'u1',
      installationId: 7,
      repoFullName: 'octo/hello',
      defaultBranch: 'main',
      sandboxWorkdir: '/workspace/hello',
    });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/ensure', {
      method: 'POST',
      headers: { Accept: 'text/event-stream' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const body = await res.text();
    // Progress events surface each server step, then a terminal `done` carries the result.
    expect(body).toContain('event: progress');
    expect(body).toContain('Provisioning a new sandbox…');
    expect(body).toContain('Cloning octo/hello…');
    expect(body).toContain('event: done');
    expect(body).toContain('"resourceId":"p1"');
  });
});

// ── Phase 4: worktree / commit / push / pr git routes ─────────────────────
function seedMaterializedProject(opts: { orgId?: string; userId?: string; setupCommand?: string | null } = {}) {
  const orgId = opts.orgId ?? 'org1';
  const userId = opts.userId ?? 'u1';
  tables.projects.push({
    id: 'p1',
    orgId,
    userId,
    installationId: 7,
    repoFullName: 'octo/hello',
    repoId: 99,
    defaultBranch: 'main',
    sandboxWorkdir: '/workspace/hello',
    setupCommand: opts.setupCommand ?? null,
  });
  tables.sandboxes.push({
    id: 'sbrow-1',
    githubProjectId: 'p1',
    userId,
    sandboxId: 'sb-1',
    sandboxWorkdir: '/workspace/hello',
    materializedAt: new Date(),
  });
}

function postJson(app: ReturnType<typeof buildApp>, path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('issues route', () => {
  it('401s without an authenticated user', async () => {
    seedMaterializedProject();
    const res = await buildApp(null).request('/web/github/projects/p1/issues');
    expect(res.status).toBe(401);
    expect(listRepoOpenIssues).not.toHaveBeenCalled();
  });

  it('403s for a personal (no-org) account', async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1', organizationId: undefined }).request('/web/github/projects/p1/issues');
    expect(res.status).toBe(403);
    expect(listRepoOpenIssues).not.toHaveBeenCalled();
  });

  it('404s for a project owned by another org', async () => {
    seedMaterializedProject({ orgId: 'other-org' });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/issues');
    expect(res.status).toBe(404);
    expect(listRepoOpenIssues).not.toHaveBeenCalled();
  });

  it('lists open issues for the project repo', async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/issues');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.issues).toHaveLength(1);
    expect(json.issues[0]).toMatchObject({ number: 12, title: 'Fix flaky test', labels: ['bug'] });
    expect(json.nextPage).toBeNull();
    expect(listRepoOpenIssues).toHaveBeenCalledWith(7, 'octo/hello', 1);
  });

  it('forwards the requested page and echoes the next page', async () => {
    seedMaterializedProject();
    listRepoOpenIssues.mockResolvedValueOnce({ issues: [], nextPage: 3 });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/issues?page=2');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ issues: [], nextPage: 3 });
    expect(listRepoOpenIssues).toHaveBeenCalledWith(7, 'octo/hello', 2);
  });

  it('400s on a malformed page param', async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/issues?page=zero');
    expect(res.status).toBe(400);
    expect(listRepoOpenIssues).not.toHaveBeenCalled();
  });

  it('502s when GitHub is unavailable', async () => {
    seedMaterializedProject();
    listRepoOpenIssues.mockRejectedValueOnce(new Error('GitHub unavailable'));
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/issues');
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'github_fetch_failed', message: 'GitHub unavailable' });
  });
});

describe('prs route', () => {
  it('401s without an authenticated user', async () => {
    seedMaterializedProject();
    const res = await buildApp(null).request('/web/github/projects/p1/prs');
    expect(res.status).toBe(401);
    expect(listRepoOpenPullRequests).not.toHaveBeenCalled();
  });

  it('404s for a project owned by another org', async () => {
    seedMaterializedProject({ orgId: 'other-org' });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/prs');
    expect(res.status).toBe(404);
    expect(listRepoOpenPullRequests).not.toHaveBeenCalled();
  });

  it('lists open pull requests for the project repo', async () => {
    seedMaterializedProject();
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/prs');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pullRequests).toHaveLength(1);
    expect(json.pullRequests[0]).toMatchObject({ number: 34, title: 'Add factory pages', headBranch: 'feat/factory' });
    expect(json.nextPage).toBeNull();
    expect(listRepoOpenPullRequests).toHaveBeenCalledWith(7, 'octo/hello', 1);
  });

  it('forwards the requested page and echoes the next page', async () => {
    seedMaterializedProject();
    listRepoOpenPullRequests.mockResolvedValueOnce({ pullRequests: [], nextPage: 4 });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/prs?page=3');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ pullRequests: [], nextPage: 4 });
    expect(listRepoOpenPullRequests).toHaveBeenCalledWith(7, 'octo/hello', 3);
  });

  it('502s when GitHub is unavailable', async () => {
    seedMaterializedProject();
    listRepoOpenPullRequests.mockRejectedValueOnce(new Error('GitHub unavailable'));
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/prs');
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'github_fetch_failed' });
  });
});

describe('project settings routes', () => {
  it('401s without an authenticated user', async () => {
    seedMaterializedProject();
    const res = await buildApp(null).request('/web/github/projects/p1/settings');
    expect(res.status).toBe(401);
  });

  it('404s for a project owned by another org', async () => {
    seedMaterializedProject({ orgId: 'other-org' });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/settings');
    expect(res.status).toBe(404);
  });

  it('returns the stored setup command', async () => {
    seedMaterializedProject({ setupCommand: 'pnpm i && pnpm build' });
    const res = await buildApp({ workosId: 'u1' }).request('/web/github/projects/p1/settings');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ setupCommand: 'pnpm i && pnpm build' });
  });

  it('persists a trimmed setup command', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/settings', {
      setupCommand: '  pnpm i && pnpm build  ',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ setupCommand: 'pnpm i && pnpm build' });
    expect(tables.projects[0].setupCommand).toBe('pnpm i && pnpm build');
  });

  it('clears the setup command with an empty string or null', async () => {
    seedMaterializedProject({ setupCommand: 'pnpm i' });
    const app = buildApp({ workosId: 'u1' });
    const res = await postJson(app, '/web/github/projects/p1/settings', { setupCommand: '   ' });
    expect(await res.json()).toEqual({ setupCommand: null });
    expect(tables.projects[0].setupCommand).toBeNull();

    tables.projects[0].setupCommand = 'pnpm i';
    const res2 = await postJson(app, '/web/github/projects/p1/settings', { setupCommand: null });
    expect(await res2.json()).toEqual({ setupCommand: null });
    expect(tables.projects[0].setupCommand).toBeNull();
  });

  it('400s on a non-string setup command', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/settings', {
      setupCommand: 42,
    });
    expect(res.status).toBe(400);
  });

  it('400s on an oversized setup command', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/settings', {
      setupCommand: 'x'.repeat(2001),
    });
    expect(res.status).toBe(400);
  });

  it('400s on a setup command containing control characters', async () => {
    seedMaterializedProject();
    const app = buildApp({ workosId: 'u1' });
    const res = await postJson(app, '/web/github/projects/p1/settings', {
      setupCommand: 'pnpm i \x1b[31m&& rm -rf /',
    });
    expect(res.status).toBe(400);
    expect(tables.projects[0].setupCommand).toBeNull();

    // Newlines and tabs are legitimate in multi-line setup scripts.
    const res2 = await postJson(app, '/web/github/projects/p1/settings', {
      setupCommand: 'pnpm i\npnpm build\t--force',
    });
    expect(res2.status).toBe(200);
  });
});

describe('worktree route', () => {
  it('401s without an authenticated user', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp(null), '/web/github/projects/p1/worktree', { branch: 'feat/x' });
    expect(res.status).toBe(401);
  });

  it('503s when the sandbox is not configured', async () => {
    sandboxEnabled = false;
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/worktree', {
      branch: 'feat/x',
    });
    expect(res.status).toBe(503);
  });

  it('404s for a project owned by another org', async () => {
    seedMaterializedProject({ orgId: 'other-org' });
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/worktree', {
      branch: 'feat/x',
    });
    expect(res.status).toBe(404);
    expect(ensureWorktree).not.toHaveBeenCalled();
  });

  it('400s on an invalid branch name', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/worktree', {
      branch: 'bad branch!',
    });
    expect(res.status).toBe(400);
    expect(ensureWorktree).not.toHaveBeenCalled();
  });

  it('creates a worktree, persists a row, and returns the path', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/worktree', {
      branch: 'feat/x',
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.branch).toBe('feat/x');
    expect(json.baseBranch).toBe('main');
    expect(json.resourceId).toBe('p1');
    expect(reattachProjectSandbox).toHaveBeenCalledWith('sb-1');
    expect(ensureWorktree).toHaveBeenCalledOnce();
    // A freshly minted install token + repo name are passed through so the
    // worktree forks from the latest fetched origin/<base>, not local state.
    expect(ensureWorktree).toHaveBeenCalledWith(expect.anything(), '/workspace/hello', {
      branch: 'feat/x',
      baseBranch: 'main',
      token: 'install-token',
      repoFullName: 'octo/hello',
    });
    expect(tables.worktrees).toHaveLength(1);
    expect(tables.worktrees[0]).toMatchObject({ githubProjectId: 'p1', branch: 'feat/x', userId: 'u1' });
  });

  it('upserts the worktree row on conflict instead of duplicating', async () => {
    seedMaterializedProject();
    const app = buildApp({ workosId: 'u1' });
    await postJson(app, '/web/github/projects/p1/worktree', { branch: 'feat/x' });
    await postJson(app, '/web/github/projects/p1/worktree', { branch: 'feat/x' });
    expect(tables.worktrees).toHaveLength(1);
  });

  it('runs the configured setup command in the fresh worktree', async () => {
    seedMaterializedProject({ setupCommand: 'pnpm i && pnpm build' });
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/worktree', {
      branch: 'feat/x',
    });
    expect(res.status).toBe(200);
    expect(runWorktreeSetup).toHaveBeenCalledOnce();
    expect(runWorktreeSetup).toHaveBeenCalledWith(
      expect.anything(),
      '/workspace/hello/../worktrees/feat/x',
      'pnpm i && pnpm build',
    );
  });

  it('skips the setup command when no command is configured', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/worktree', {
      branch: 'feat/x',
    });
    expect(res.status).toBe(200);
    expect(runWorktreeSetup).not.toHaveBeenCalled();
  });

  it('skips the setup command when reusing an existing worktree', async () => {
    seedMaterializedProject({ setupCommand: 'pnpm i' });
    ensureWorktree.mockResolvedValueOnce({
      worktreePath: '/workspace/hello/../worktrees/feat/x',
      branch: 'feat/x',
      baseBranch: 'main',
      reused: true,
    } as any);
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/worktree', {
      branch: 'feat/x',
    });
    expect(res.status).toBe(200);
    expect(runWorktreeSetup).not.toHaveBeenCalled();
  });

  it('surfaces a setup failure and does not persist the worktree row', async () => {
    seedMaterializedProject({ setupCommand: 'pnpm i' });
    runWorktreeSetup.mockRejectedValueOnce(new MockedWorktreeError('Setup command failed (exit 1)', 'setup-failed'));
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/worktree', {
      branch: 'feat/x',
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'setup-failed' });
    expect(tables.worktrees).toHaveLength(0);
  });
});

describe('worktree delete route', () => {
  it('401s without an authenticated user', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp(null), '/web/github/projects/p1/worktree/delete', { branch: 'feat/x' });
    expect(res.status).toBe(401);
  });

  it('400s on an invalid branch name', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/worktree/delete', {
      branch: 'bad branch!',
    });
    expect(res.status).toBe(400);
    expect(removeWorktree).not.toHaveBeenCalled();
  });

  it('404s for a worktree that was never created', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/worktree/delete', {
      branch: 'feat/unknown',
    });
    expect(res.status).toBe(404);
    expect(removeWorktree).not.toHaveBeenCalled();
  });

  it("404s for another user's worktree", async () => {
    seedMaterializedProject();
    const app = buildApp({ workosId: 'u1' });
    await postJson(app, '/web/github/projects/p1/worktree', { branch: 'feat/x' });
    const res = await postJson(buildApp({ workosId: 'u2' }), '/web/github/projects/p1/worktree/delete', {
      branch: 'feat/x',
    });
    expect(res.status).toBe(404);
    expect(removeWorktree).not.toHaveBeenCalled();
    expect(tables.worktrees).toHaveLength(1);
  });

  it('400s when the worktree row points at the repo root checkout', async () => {
    seedMaterializedProject();
    tables.worktrees.push({
      id: 'wt-root',
      orgId: 'org1',
      userId: 'u1',
      githubProjectId: 'p1',
      branch: 'main',
      baseBranch: 'main',
      worktreePath: '/workspace/hello',
    });
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/worktree/delete', {
      branch: 'main',
    });
    expect(res.status).toBe(400);
    expect(removeWorktree).not.toHaveBeenCalled();
  });

  it('removes the checkout, deletes the row, and returns the path', async () => {
    seedMaterializedProject();
    const app = buildApp({ workosId: 'u1' });
    await postJson(app, '/web/github/projects/p1/worktree', { branch: 'feat/x' });
    expect(tables.worktrees).toHaveLength(1);

    const res = await postJson(app, '/web/github/projects/p1/worktree/delete', { branch: 'feat/x' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      removed: true,
      branch: 'feat/x',
      worktreePath: '/workspace/hello/../worktrees/feat/x',
    });
    expect(removeWorktree).toHaveBeenCalledOnce();
    expect(removeWorktree).toHaveBeenCalledWith(expect.anything(), '/workspace/hello', {
      branch: 'feat/x',
      worktreePath: '/workspace/hello/../worktrees/feat/x',
    });
    expect(tables.worktrees).toHaveLength(0);
  });

  it('keeps the row when the sandbox removal fails', async () => {
    seedMaterializedProject();
    const app = buildApp({ workosId: 'u1' });
    await postJson(app, '/web/github/projects/p1/worktree', { branch: 'feat/x' });
    removeWorktree.mockRejectedValueOnce(
      Object.assign(new Error('git worktree remove failed'), { name: 'WorktreeError', code: 'worktree-failed' }),
    );

    const res = await postJson(app, '/web/github/projects/p1/worktree/delete', { branch: 'feat/x' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(tables.worktrees).toHaveLength(1);
  });
});

describe('commit route', () => {
  it('400s on an empty message', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/commit', {
      message: '   ',
    });
    expect(res.status).toBe(400);
    expect(commitAll).not.toHaveBeenCalled();
  });

  it('400s on an unknown worktreePath', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/commit', {
      message: 'wip',
      worktreePath: '/etc/passwd',
    });
    expect(res.status).toBe(400);
    expect(commitAll).not.toHaveBeenCalled();
  });

  it('commits on the base checkout when no worktreePath is given', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/commit', {
      message: 'wip',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ committed: true });
    expect(commitAll).toHaveBeenCalledOnce();
    // The base repo workdir is used when worktreePath is omitted.
    expect((commitAll.mock.calls[0] as unknown as any[])[1]).toBe('/workspace/hello');
  });

  it('commits in a persisted worktree path', async () => {
    seedMaterializedProject();
    tables.worktrees.push({
      id: 'w1',
      userId: 'u1',
      githubProjectId: 'p1',
      branch: 'feat/x',
      baseBranch: 'main',
      worktreePath: '/workspace/worktrees/feat-x',
    });
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/commit', {
      message: 'wip',
      worktreePath: '/workspace/worktrees/feat-x',
    });
    expect(res.status).toBe(200);
    expect((commitAll.mock.calls[0] as unknown as any[])[1]).toBe('/workspace/worktrees/feat-x');
  });
});

describe('push route', () => {
  it('400s on an invalid branch', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/push', {
      branch: 'bad branch',
    });
    expect(res.status).toBe(400);
    expect(pushBranch).not.toHaveBeenCalled();
  });

  it('mints a token and pushes the branch', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/push', {
      branch: 'feat/x',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ pushed: true, branch: 'feat/x' });
    expect(pushBranch).toHaveBeenCalledOnce();
    // pushBranch(sandbox, workdir, branch, token, repoFullName)
    const call = pushBranch.mock.calls[0] as unknown as any[];
    expect(call[2]).toBe('feat/x');
    expect(call[3]).toBe('install-token');
    expect(call[4]).toBe('octo/hello');
  });
});

describe('pr route', () => {
  it('400s on a missing title', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/pr', {
      branch: 'feat/x',
    });
    expect(res.status).toBe(400);
    expect(createPullRequest).not.toHaveBeenCalled();
  });

  it('400s on an invalid base branch', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/pr', {
      branch: 'feat/x',
      base: 'bad base',
      title: 'My PR',
    });
    expect(res.status).toBe(400);
    expect(createPullRequest).not.toHaveBeenCalled();
  });

  it('opens a PR and returns its URL', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/web/github/projects/p1/pr', {
      branch: 'feat/x',
      title: 'My PR',
      body: 'Adds a thing',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ url: 'https://github.com/octo/hello/pull/1' });
    expect(createPullRequest).toHaveBeenCalledOnce();
    const opts = (createPullRequest.mock.calls[0] as unknown as any[])[2];
    expect(opts).toMatchObject({ token: 'install-token', base: 'main', head: 'feat/x', title: 'My PR' });
  });
});
