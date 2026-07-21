import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────

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
// capability gate and provider are controllable for the portal-link specs.
// `isWebAuthEnabled` is pinned true so the specs prove the portal link gates
// on the adapter *kind* (WorkOS), not on auth being enabled — under
// better-auth, auth is enabled but the portal link must still 404.
let workosAuthActive = false;

vi.mock('../auth', async () => {
  const actual = (await vi.importActual('../auth')) as Record<string, unknown>;
  return {
    ...actual,
    isWebAuthEnabled: () => true,
    isWorkOSAuth: () => workosAuthActive,
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

import type { SourceControlStorageHandle } from '../storage/domains/source-control/base';
import { seedFactoryStorageForTests } from '../storage/test-utils';
import type { FactoryStorageTestSeed } from '../storage/test-utils';
import { mountApiRoutes } from '../test-utils';
import { buildAuditRoutes } from './routes';

// ── Test harness ─────────────────────────────────────────────────────────
let seed!: FactoryStorageTestSeed;
let githubStorage!: SourceControlStorageHandle;

function buildApp(
  user: { workosId: string; organizationId?: string } | null,
  storage: SourceControlStorageHandle | null = githubStorage,
) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('webAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app as any,
    buildAuditRoutes({ baseUrl: 'https://web.example.com', githubStorage: storage ?? undefined }),
  );
  return app;
}

const orgUser = { workosId: 'u1', organizationId: 'org1' };
const UNKNOWN_PROJECT_ID = '11111111-1111-4111-8111-111111111111';
let PROJECT_ID = UNKNOWN_PROJECT_ID;

async function seedProject(overrides: Record<string, any> = {}) {
  const project = await githubStorage.projects.upsert({
    orgId: 'org1',
    createdByUserId: 'u1',
    installationExternalId: '1',
    repositorySlug: 'acme/repo',
    repositoryExternalId: '1',
    defaultBranch: 'main',
    sandboxProvider: 'local',
    sandboxWorkdir: '/tmp/acme-repo',
    ...overrides,
  });
  PROJECT_ID = project.id;
}

beforeEach(async () => {
  seed = await seedFactoryStorageForTests();
  githubStorage = seed.sourceControl.forIntegration('github');
  PROJECT_ID = UNKNOWN_PROJECT_ID;
  listCalls = [];
  listResult = { events: [] };
  workosAuthActive = false;
  portalCalls = [];
  portalFailure = undefined;
});

// ── GET /web/factory/repositories/:id/audit ─────────────────────────────────
describe('GET /web/factory/repositories/:id/audit', () => {
  it('401s when unauthenticated', async () => {
    const res = await buildApp(null).request(`/web/factory/repositories/${PROJECT_ID}/audit`);
    expect(res.status).toBe(401);
    expect(listCalls).toHaveLength(0);
  });

  it('403s for personal (no-org) accounts', async () => {
    const res = await buildApp({ workosId: 'u1' }).request(`/web/factory/repositories/${PROJECT_ID}/audit`);
    expect(res.status).toBe(403);
  });

  it("404s when the project isn't in the caller's org", async () => {
    await seedProject({ orgId: 'other-org' });
    const res = await buildApp(orgUser).request(`/web/factory/repositories/${PROJECT_ID}/audit`);
    expect(res.status).toBe(404);
    expect(listCalls).toHaveLength(0);
  });

  it('503s when GitHub storage is unavailable', async () => {
    const res = await buildApp(orgUser, null).request(`/web/factory/repositories/${PROJECT_ID}/audit`);
    expect(res.status).toBe(503);
    expect(listCalls).toHaveLength(0);
  });

  it('404s on a non-uuid project id', async () => {
    const res = await buildApp(orgUser).request('/web/factory/repositories/not-a-uuid/audit');
    expect(res.status).toBe(404);
  });

  it('returns the event page scoped to the org and project', async () => {
    await seedProject();
    listResult = {
      events: [{ id: 'e1', action: 'factory.work_item.created' }],
      nextCursor: '2026-07-15T00:00:00.000Z_e1',
    };
    const res = await buildApp(orgUser).request(`/web/factory/repositories/${PROJECT_ID}/audit`);
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
  });

  it('passes actions/actor/before/limit filters through to the store', async () => {
    await seedProject();
    const query = new URLSearchParams({
      actions: 'factory.work_item.created, factory.git.push,',
      actor: 'u2',
      before: '2026-07-15T00:00:00.000Z_e9',
      limit: '25',
    });
    const res = await buildApp(orgUser).request(`/web/factory/repositories/${PROJECT_ID}/audit?${query}`);
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
    await seedProject();
    await buildApp(orgUser).request(`/web/factory/repositories/${PROJECT_ID}/audit?limit=lots`);
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

  it('404s when the active auth adapter is not WorkOS (e.g. better-auth) so the UI hides the button', async () => {
    workosAuthActive = false;
    const res = await buildApp(orgUser).request('/web/audit/portal-link');
    expect(res.status).toBe(404);
    expect(portalCalls).toHaveLength(0);
  });

  it('returns a one-time audit_logs portal URL for the org', async () => {
    workosAuthActive = true;
    const res = await buildApp(orgUser).request('/web/audit/portal-link');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://portal.workos.com/one-time-link' });
    expect(portalCalls).toEqual([
      { orgId: 'org1', intent: 'audit_logs', returnUrl: 'https://web.example.com/factory/audit' },
    ]);
  });

  it('502s when the portal link cannot be generated', async () => {
    workosAuthActive = true;
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
