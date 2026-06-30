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
  });
  return { getAppDb: () => makeDb() };
});

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

import { mountGithubRoutes } from './routes';

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

// Resolve schema refs after import.
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
  mountGithubRoutes(app as any, { baseUrl: 'http://localhost:4111' });
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
  commitAll.mockClear();
  pushBranch.mockClear();
  createPullRequest.mockClear();
});

afterEach(() => {
  delete process.env.MASTRACODE_DISTRIBUTED_LOCK;
  vi.clearAllMocks();
});

describe('status route', () => {
  it('reports disabled without the feature', async () => {
    featureEnabled = false;
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/status');
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
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/status');
    const json = await res.json();
    expect(json.enabled).toBe(true);
    expect(json.connected).toBe(true);
    expect(json.installations[0].installationId).toBe(7);
  });
});

describe('auth scoping', () => {
  it('401s when no user is present', async () => {
    const res = await buildApp(null).request('/api/web/github/repos');
    expect(res.status).toBe(401);
  });
});

describe('connect + callback', () => {
  it('redirects connect to the install URL with a signed state', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/auth/github/connect');
    expect(res.status).toBe(302);
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
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/projects', {
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
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/projects', {
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
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/projects', {
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
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/projects', {
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
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/projects', {
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
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/projects/p1/ensure', { method: 'POST' });
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
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/projects/p1/ensure', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ resourceId: 'p1', githubProjectId: 'p1' });
    expect(ensureProjectSandbox).toHaveBeenCalledOnce();
    expect(materializeRepo).toHaveBeenCalledOnce();
    // A per-user sandbox binding row was created for the caller.
    expect(tables.sandboxes).toHaveLength(1);
    expect(tables.sandboxes[0]).toMatchObject({ githubProjectId: 'p1', userId: 'u1' });
  });

  it('404s for a project the user does not own', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/projects/missing/ensure', {
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
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/projects/p1/ensure', {
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
function seedMaterializedProject(opts: { orgId?: string; userId?: string } = {}) {
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

describe('worktree route', () => {
  it('401s without an authenticated user', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp(null), '/api/web/github/projects/p1/worktree', { branch: 'feat/x' });
    expect(res.status).toBe(401);
  });

  it('503s when the sandbox is not configured', async () => {
    sandboxEnabled = false;
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/api/web/github/projects/p1/worktree', {
      branch: 'feat/x',
    });
    expect(res.status).toBe(503);
  });

  it('404s for a project owned by another org', async () => {
    seedMaterializedProject({ orgId: 'other-org' });
    const res = await postJson(buildApp({ workosId: 'u1' }), '/api/web/github/projects/p1/worktree', {
      branch: 'feat/x',
    });
    expect(res.status).toBe(404);
    expect(ensureWorktree).not.toHaveBeenCalled();
  });

  it('400s on an invalid branch name', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/api/web/github/projects/p1/worktree', {
      branch: 'bad branch!',
    });
    expect(res.status).toBe(400);
    expect(ensureWorktree).not.toHaveBeenCalled();
  });

  it('creates a worktree, persists a row, and returns the path', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/api/web/github/projects/p1/worktree', {
      branch: 'feat/x',
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.branch).toBe('feat/x');
    expect(json.baseBranch).toBe('main');
    expect(json.resourceId).toBe('p1');
    expect(reattachProjectSandbox).toHaveBeenCalledWith('sb-1');
    expect(ensureWorktree).toHaveBeenCalledOnce();
    expect(tables.worktrees).toHaveLength(1);
    expect(tables.worktrees[0]).toMatchObject({ githubProjectId: 'p1', branch: 'feat/x', userId: 'u1' });
  });

  it('upserts the worktree row on conflict instead of duplicating', async () => {
    seedMaterializedProject();
    const app = buildApp({ workosId: 'u1' });
    await postJson(app, '/api/web/github/projects/p1/worktree', { branch: 'feat/x' });
    await postJson(app, '/api/web/github/projects/p1/worktree', { branch: 'feat/x' });
    expect(tables.worktrees).toHaveLength(1);
  });
});

describe('commit route', () => {
  it('400s on an empty message', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/api/web/github/projects/p1/commit', {
      message: '   ',
    });
    expect(res.status).toBe(400);
    expect(commitAll).not.toHaveBeenCalled();
  });

  it('400s on an unknown worktreePath', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/api/web/github/projects/p1/commit', {
      message: 'wip',
      worktreePath: '/etc/passwd',
    });
    expect(res.status).toBe(400);
    expect(commitAll).not.toHaveBeenCalled();
  });

  it('commits on the base checkout when no worktreePath is given', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/api/web/github/projects/p1/commit', {
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
    const res = await postJson(buildApp({ workosId: 'u1' }), '/api/web/github/projects/p1/commit', {
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
    const res = await postJson(buildApp({ workosId: 'u1' }), '/api/web/github/projects/p1/push', {
      branch: 'bad branch',
    });
    expect(res.status).toBe(400);
    expect(pushBranch).not.toHaveBeenCalled();
  });

  it('mints a token and pushes the branch', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/api/web/github/projects/p1/push', {
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
    const res = await postJson(buildApp({ workosId: 'u1' }), '/api/web/github/projects/p1/pr', {
      branch: 'feat/x',
    });
    expect(res.status).toBe(400);
    expect(createPullRequest).not.toHaveBeenCalled();
  });

  it('400s on an invalid base branch', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/api/web/github/projects/p1/pr', {
      branch: 'feat/x',
      base: 'bad base',
      title: 'My PR',
    });
    expect(res.status).toBe(400);
    expect(createPullRequest).not.toHaveBeenCalled();
  });

  it('opens a PR and returns its URL', async () => {
    seedMaterializedProject();
    const res = await postJson(buildApp({ workosId: 'u1' }), '/api/web/github/projects/p1/pr', {
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
