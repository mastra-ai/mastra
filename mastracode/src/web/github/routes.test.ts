import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    userId: string;
    installationId: number;
    accountLogin: string | null;
    accountType: string | null;
  }>;
  projects: Array<Record<string, any>>;
  worktrees: Array<Record<string, any>>;
}
const tables: Tables = { installations: [], projects: [], worktrees: [] };

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
          onConflictDoNothing: async () => insertRow(table, vals),
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

const ensureProjectSandbox = vi.fn(async (_row: any) => ({ id: 'sb' }));
const materializeRepo = vi.fn(async () => {});
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
    ensureProjectSandbox: (row: any) => ensureProjectSandbox(row),
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
  signState: (userId: string) => `state.${userId}`,
  verifyState: (state: string | undefined) => (state?.startsWith('state.') ? state.slice('state.'.length) : null),
}));

import { mountGithubRoutes } from './routes';

// ── Fake table helpers ──────────────────────────────────────────────────
function tableKind(table: any): keyof Tables {
  if (table === installationsRef) return 'installations';
  if (table === worktreesRef) return 'worktrees';
  return 'projects';
}
// We can't import the actual schema objects easily into the closure used by the
// mock above, so resolve them lazily here for the helpers.
let installationsRef: any;
let worktreesRef: any;

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
function updateRows(table: any, vals: any): void {
  for (const row of tables[tableKind(table)]) Object.assign(row, vals);
}

// Resolve schema refs after import.
import { githubInstallations, githubWorktrees } from './schema';
installationsRef = githubInstallations;
worktreesRef = githubWorktrees;

// ── Test harness ─────────────────────────────────────────────────────────
function buildApp(user: { workosId: string } | null) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('webAuthUser' as never, user as never);
    await next();
  });
  mountGithubRoutes(app as any, { baseUrl: 'http://localhost:4111' });
  return app;
}

beforeEach(() => {
  tables.installations = [];
  tables.projects = [];
  tables.worktrees = [];
  featureEnabled = true;
  sandboxEnabled = true;
  ensureProjectSandbox.mockClear();
  materializeRepo.mockClear();
  reattachProjectSandbox.mockClear();
  ensureWorktree.mockClear();
  commitAll.mockClear();
  pushBranch.mockClear();
  createPullRequest.mockClear();
});

afterEach(() => vi.clearAllMocks());

describe('status route', () => {
  it('reports disabled without the feature', async () => {
    featureEnabled = false;
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/status');
    expect(await res.json()).toMatchObject({ enabled: false, connected: false });
  });

  it('reports connected installations for the user', async () => {
    tables.installations.push({ userId: 'u1', installationId: 7, accountLogin: 'octo', accountType: 'User' });
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
    expect(res.headers.get('location')).toContain('state=state.u1');
  });

  it('rejects a callback whose state belongs to another user', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/auth/github/callback?state=state.someone-else&code=x');
    expect(res.headers.get('location')).toBe('/?github=error');
    expect(tables.installations).toHaveLength(0);
  });

  it('persists installations on a valid callback', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/auth/github/callback?state=state.u1&code=abc');
    expect(res.headers.get('location')).toBe('/?github=connected');
    expect(tables.installations).toHaveLength(1);
  });

  it('does not trust an unverified installation_id without a code', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/auth/github/callback?state=state.u1&installation_id=999');
    // No code → bounce through OAuth identify, persist nothing.
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/login/oauth/authorize');
    expect(tables.installations).toHaveLength(0);
  });
});

describe('create project', () => {
  it('inserts a github-sourced project for an owned installation', async () => {
    tables.installations.push({ userId: 'u1', installationId: 7, accountLogin: 'octo', accountType: 'User' });
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
    tables.installations.push({ userId: 'u1', installationId: 7, accountLogin: 'octo', accountType: 'User' });
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoFullName: 'not-a-repo', repoId: 99, installationId: 7 }),
    });
    expect(res.status).toBe(400);
  });

  it('404s when the repo is not accessible to the installation', async () => {
    tables.installations.push({ userId: 'u1', installationId: 7, accountLogin: 'octo', accountType: 'User' });
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repoFullName: 'octo/other-repo', installationId: 7 }),
    });
    expect(res.status).toBe(404);
  });

  it('persists the server-returned defaultBranch, ignoring the client value', async () => {
    tables.installations.push({ userId: 'u1', installationId: 7, accountLogin: 'octo', accountType: 'User' });
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
    tables.projects.push({ id: 'p1', userId: 'u1', installationId: 7, repoFullName: 'octo/hello' });
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/projects/p1/ensure', { method: 'POST' });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('sandbox_not_configured');
  });

  it('provisions + materializes and returns a resourceId', async () => {
    tables.projects.push({ id: 'p1', userId: 'u1', installationId: 7, repoFullName: 'octo/hello' });
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/projects/p1/ensure', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ resourceId: 'p1', githubProjectId: 'p1' });
    expect(ensureProjectSandbox).toHaveBeenCalledOnce();
    expect(materializeRepo).toHaveBeenCalledOnce();
  });

  it('404s for a project the user does not own', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/api/web/github/projects/missing/ensure', {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });
});

// ── Phase 4: worktree / commit / push / pr git routes ─────────────────────
function seedMaterializedProject(userId = 'u1') {
  tables.projects.push({
    id: 'p1',
    userId,
    installationId: 7,
    repoFullName: 'octo/hello',
    repoId: 99,
    defaultBranch: 'main',
    sandboxId: 'sb-1',
    sandboxWorkdir: '/workspace/hello',
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

  it('404s for a project owned by another user', async () => {
    seedMaterializedProject('someone-else');
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
