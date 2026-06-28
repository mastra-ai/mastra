import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────
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
}
const tables: Tables = { installations: [], projects: [] };

vi.mock('./db', () => {
  // Minimal chainable drizzle-like stub keyed off the table object identity.
  const makeDb = () => ({
    select: () => ({
      from: (table: any) => ({
        where: async () => filterRows(table),
      }),
    }),
    insert: (table: any) => ({
      values: (vals: any) => {
        const chain = {
          onConflictDoNothing: async () => insertRow(table, vals),
          onConflictDoUpdate: () => ({ returning: async () => [insertRow(table, vals)] }),
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
  mintInstallationToken: vi.fn(async () => 'install-token'),
}));

const ensureProjectSandbox = vi.fn(async (_row: any) => ({ id: 'sb' }));
const materializeRepo = vi.fn(async () => {});
let sandboxEnabled = true;
vi.mock('./sandbox', () => ({
  computeSandboxWorkdir: (repo: string) => `/workspace/${repo.split('/').pop()}`,
  getSandboxProvider: () => 'railway',
  isSandboxEnabled: () => sandboxEnabled,
  ensureProjectSandbox: (row: any) => ensureProjectSandbox(row),
  materializeRepo: (...args: any[]) => materializeRepo(...(args as [])),
  MaterializeError: class extends Error {
    code: string;
    constructor(m: string, code: string) {
      super(m);
      this.code = code;
    }
  },
}));

let featureEnabled = true;
vi.mock('./config', () => ({
  isGithubFeatureEnabled: () => featureEnabled,
  signState: (userId: string) => `state.${userId}`,
  verifyState: (state: string | undefined) => (state?.startsWith('state.') ? state.slice('state.'.length) : null),
}));

import { mountGithubRoutes } from './routes';

// ── Fake table helpers ──────────────────────────────────────────────────
function tableKind(table: any): keyof Tables {
  return table === installationsRef ? 'installations' : 'projects';
}
// We can't import the actual schema objects easily into the closure used by the
// mock above, so resolve them lazily here for the helpers.
let installationsRef: any;
function filterRows(table: any): any[] {
  return [...tables[tableKind(table)]];
}
function insertRow(table: any, vals: any): any {
  const kind = tableKind(table);
  const row = { id: `id-${tables[kind].length + 1}`, ...vals };
  tables[kind].push(row as any);
  return row;
}
function updateRows(table: any, vals: any): void {
  for (const row of tables[tableKind(table)]) Object.assign(row, vals);
}

// Resolve schema refs after import.
import { githubInstallations } from './schema';
installationsRef = githubInstallations;

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
  featureEnabled = true;
  sandboxEnabled = true;
  ensureProjectSandbox.mockClear();
  materializeRepo.mockClear();
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
