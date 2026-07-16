import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────
vi.mock('drizzle-orm', async () => {
  const actual = (await vi.importActual('drizzle-orm')) as Record<string, unknown>;
  return {
    ...actual,
    eq: (column: any, value: any) => ({ kind: 'eq', column: column?.name, value }),
    and: (...conds: any[]) => ({ kind: 'and', conds: conds.filter(Boolean) }),
  };
});

// In-memory github_projects rows for the `resolveProject` guard.
let projects: Array<Record<string, any>> = [];

function columnJsKey(table: any, columnName: string): string | undefined {
  for (const [jsKey, col] of Object.entries(table)) {
    if ((col as any)?.name === columnName) return jsKey;
  }
  return undefined;
}

function matches(table: any, row: any, cond: any): boolean {
  if (!cond) return true;
  if (cond.kind === 'and') return cond.conds.every((c: any) => matches(table, row, c));
  if (cond.kind === 'eq') {
    const jsKey = columnJsKey(table, cond.column);
    return jsKey !== undefined && row[jsKey] === cond.value;
  }
  return true;
}

vi.mock('../github/db', () => ({
  getAppDb: () => ({
    select: () => ({
      from: (table: any) => ({
        where: async (cond: any) => projects.filter(row => matches(table, row, cond)),
      }),
    }),
  }),
}));

// Capture list queries at the store boundary; routes are exercised end to end.
let listCalls: Array<Record<string, any>> = [];
let listResult: Record<string, any> = { events: [] };

vi.mock('./store', () => ({
  listAuditEvents: async (input: any) => {
    listCalls.push(input);
    return listResult;
  },
}));

// Web auth stays real (disabled in tests → context-var user), but the WorkOS
// availability gate and provider are controllable for the portal-link specs.
let webAuthEnabled = false;

vi.mock('../auth', async () => {
  const actual = (await vi.importActual('../auth')) as Record<string, unknown>;
  return {
    ...actual,
    isWebAuthEnabled: () => webAuthEnabled,
    getWorkOSProvider: () => ({ getWorkOS: () => ({ tag: 'workos-client' }) }),
  };
});

let portalCalls: Array<{ orgId: string; intent: string; returnUrl: string }> = [];
let portalFailure: Error | undefined;

vi.mock('@mastra/auth-workos', () => ({
  MastraAuthWorkos: class {},
  WorkOSAdminPortal: class {
    private returnUrl: string;
    constructor(_workos: unknown, options?: { returnUrl?: string }) {
      this.returnUrl = options?.returnUrl ?? '/';
    }
    async getPortalLink(orgId: string, intent: string): Promise<string> {
      if (portalFailure) throw portalFailure;
      portalCalls.push({ orgId, intent, returnUrl: this.returnUrl });
      return 'https://portal.workos.com/one-time-link';
    }
  },
}));

import { githubProjects } from '../github/schema';
import { mountApiRoutes } from '../test-utils';
import { buildAuditRoutes } from './routes';

// ── Test harness ─────────────────────────────────────────────────────────
function buildApp(user: { workosId: string; organizationId?: string } | null) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('webAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(app as any, buildAuditRoutes({ baseUrl: 'https://web.example.com' }));
  return app;
}

const orgUser = { workosId: 'u1', organizationId: 'org1' };
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function seedProject(overrides: Record<string, any> = {}) {
  projects.push({
    id: PROJECT_ID,
    orgId: 'org1',
    repoFullName: 'acme/repo',
    // Only fields the guard reads matter; keep the mock row minimal.
    ...overrides,
  });
}

beforeEach(() => {
  projects = [];
  listCalls = [];
  listResult = { events: [] };
  webAuthEnabled = false;
  portalCalls = [];
  portalFailure = undefined;
});

// ── GET /web/factory/projects/:id/audit ─────────────────────────────────
describe('GET /web/factory/projects/:id/audit', () => {
  it('401s when unauthenticated', async () => {
    const res = await buildApp(null).request(`/web/factory/projects/${PROJECT_ID}/audit`);
    expect(res.status).toBe(401);
    expect(listCalls).toHaveLength(0);
  });

  it('403s for personal (no-org) accounts', async () => {
    const res = await buildApp({ workosId: 'u1' }).request(`/web/factory/projects/${PROJECT_ID}/audit`);
    expect(res.status).toBe(403);
  });

  it("404s when the project isn't in the caller's org", async () => {
    seedProject({ orgId: 'other-org' });
    const res = await buildApp(orgUser).request(`/web/factory/projects/${PROJECT_ID}/audit`);
    expect(res.status).toBe(404);
    expect(listCalls).toHaveLength(0);
  });

  it('404s on a non-uuid project id', async () => {
    const res = await buildApp(orgUser).request('/web/factory/projects/not-a-uuid/audit');
    expect(res.status).toBe(404);
  });

  it('returns the event page scoped to the org and project', async () => {
    seedProject();
    listResult = {
      events: [{ id: 'e1', action: 'factory.work_item.created' }],
      nextCursor: '2026-07-15T00:00:00.000Z_e1',
    };
    const res = await buildApp(orgUser).request(`/web/factory/projects/${PROJECT_ID}/audit`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(listResult);
    expect(listCalls).toEqual([
      {
        orgId: 'org1',
        githubProjectId: PROJECT_ID,
        actions: undefined,
        actorId: undefined,
        before: undefined,
        limit: undefined,
      },
    ]);
    // Sanity: the guard read the real table shape.
    expect(columnJsKey(githubProjects, 'org_id')).toBe('orgId');
  });

  it('passes actions/actor/before/limit filters through to the store', async () => {
    seedProject();
    const query = new URLSearchParams({
      actions: 'factory.work_item.created, factory.git.push,',
      actor: 'u2',
      before: '2026-07-15T00:00:00.000Z_e9',
      limit: '25',
    });
    const res = await buildApp(orgUser).request(`/web/factory/projects/${PROJECT_ID}/audit?${query}`);
    expect(res.status).toBe(200);
    expect(listCalls).toEqual([
      {
        orgId: 'org1',
        githubProjectId: PROJECT_ID,
        actions: ['factory.work_item.created', 'factory.git.push'],
        actorId: 'u2',
        before: '2026-07-15T00:00:00.000Z_e9',
        limit: 25,
      },
    ]);
  });

  it('ignores an unparseable limit', async () => {
    seedProject();
    await buildApp(orgUser).request(`/web/factory/projects/${PROJECT_ID}/audit?limit=lots`);
    expect(listCalls[0]?.limit).toBeUndefined();
  });
});

// ── GET /web/audit/portal-link ───────────────────────────────────────────
describe('GET /web/audit/portal-link', () => {
  it('401s when unauthenticated', async () => {
    const res = await buildApp(null).request('/web/audit/portal-link');
    expect(res.status).toBe(401);
  });

  it('403s for personal (no-org) accounts', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/web/audit/portal-link');
    expect(res.status).toBe(403);
  });

  it("404s when WorkOS auth isn't configured so the UI hides the button", async () => {
    webAuthEnabled = false;
    const res = await buildApp(orgUser).request('/web/audit/portal-link');
    expect(res.status).toBe(404);
    expect(portalCalls).toHaveLength(0);
  });

  it('returns a one-time audit_logs portal URL for the org', async () => {
    webAuthEnabled = true;
    const res = await buildApp(orgUser).request('/web/audit/portal-link');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://portal.workos.com/one-time-link' });
    expect(portalCalls).toEqual([
      { orgId: 'org1', intent: 'audit_logs', returnUrl: 'https://web.example.com/factory/audit' },
    ]);
  });

  it('502s when the portal link cannot be generated', async () => {
    webAuthEnabled = true;
    portalFailure = new Error('workos down');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await buildApp(orgUser).request('/web/audit/portal-link');
    expect(res.status).toBe(502);
    expect(warnSpy).toHaveBeenCalledWith('[Audit] Failed to generate WorkOS Admin Portal link', {
      error: 'workos down',
    });
    warnSpy.mockRestore();
  });
});
