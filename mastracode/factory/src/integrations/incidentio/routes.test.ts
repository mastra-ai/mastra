import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth, mountApiRoutes } from '../../routes/test-utils.js';
import type { TestAuthUser } from '../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../../storage/test-utils.js';
import { INCIDENTIO_FOLLOW_UPS_SOURCE_ID } from './intake.js';
import { IncidentioIntegration } from './integration.js';
import { buildIncidentioRoutes } from './routes.js';

// A real integration instance with the network edge spied out: detail
// resolution runs the production code path against the seeded `:memory:`
// intake storage.
let incidentio!: IncidentioIntegration;
let seed!: FactoryStorageTestSeed;

// ── Test harness ─────────────────────────────────────────────────────────
function buildApp(
  user: TestAuthUser | null,
  options: {
    authEnabled?: boolean;
    withIncidentio?: boolean;
    withIntake?: boolean;
  } = {},
) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app,
    buildIncidentioRoutes({
      incidentio: (options.withIncidentio ?? true) ? incidentio : undefined,
      auth: fakeRouteAuth({ enabled: options.authEnabled ?? true }),
      intake: (options.withIntake ?? true) ? seed.intake : undefined,
    }),
  );
  return app;
}

const org1 = (): TestAuthUser => ({ workosId: 'u1', organizationId: 'org1' });
const projectA = '11111111-1111-4111-8111-111111111111';
const createProject = async (id: string) => {
  const now = new Date();
  await seed.storage.ops.insertOne('factory_projects', {
    id,
    org_id: 'org1',
    created_by: 'u1',
    name: id,
    created_at: now,
    updated_at: now,
  });
};

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  incidentio = new IncidentioIntegration({ apiKey: 'incident-key' });
  await seed.intake.saveConfig({
    orgId: 'org1',
    config: { incidentio: { enabled: true, sourceIds: [INCIDENTIO_FOLLOW_UPS_SOURCE_ID] } },
  });
  vi.clearAllMocks();
});

describe('status route', () => {
  it('reports disabled without web auth and serves only the status route', async () => {
    const routes = buildIncidentioRoutes({
      incidentio,
      auth: fakeRouteAuth({ enabled: false }),
      intake: seed.intake,
    });
    expect(routes).toHaveLength(1);
    const app = buildApp(org1(), { authEnabled: false });
    const res = await app.request('/web/incidentio/status');
    expect(await res.json()).toMatchObject({ enabled: false, configured: true, reason: 'missing_config' });
    expect((await app.request(`/web/incidentio/issues/detail?factoryProjectId=${projectA}`)).status).toBe(404);
  });

  it('reports disabled without the integration instance', async () => {
    const res = await buildApp(org1(), { withIncidentio: false }).request('/web/incidentio/status');
    expect(await res.json()).toMatchObject({
      enabled: false,
      configured: false,
      reason: 'missing_config',
      diagnostics: { incidentioConfigured: false, factoryAuthEnabled: true },
    });
  });

  it('reports ready when configured', async () => {
    const res = await buildApp(org1()).request('/web/incidentio/status');
    expect(await res.json()).toEqual({
      enabled: true,
      configured: true,
      reason: 'ready',
      diagnostics: { incidentioConfigured: true, factoryAuthEnabled: true },
    });
  });

  it('surfaces the credential mode so the SPA can tell an API key from Platform connections', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('factoryAuthUser' as never, org1() as never);
      await next();
    });
    mountApiRoutes(
      app,
      buildIncidentioRoutes({
        incidentio,
        mode: 'api-key',
        auth: fakeRouteAuth({ enabled: true }),
        intake: seed.intake,
      }),
    );
    const res = await app.request('/web/incidentio/status');
    expect(await res.json()).toMatchObject({ enabled: true, configured: true, mode: 'api-key', reason: 'ready' });
  });

  it('requires an organization', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/web/incidentio/status');
    expect(await res.json()).toMatchObject({
      enabled: true,
      organizationRequired: true,
      reason: 'organization_required',
    });
  });

  it('401s unauthenticated users when enabled', async () => {
    const res = await buildApp(null).request('/web/incidentio/status');
    expect(res.status).toBe(401);
  });
});

describe('issue detail route', () => {
  const detailUrl = `/web/incidentio/issues/detail?factoryProjectId=${projectA}&issueRef=incidentio:follow-up:01HFOLLOWUP`;

  const followUpDetail = {
    id: 'incidentio:follow-up:01HFOLLOWUP',
    identifier: 'INC-42',
    title: 'Add database failover alert',
    url: 'https://app.incident.io/org/follow-ups/01HFOLLOWUP',
    author: 'Ada Lovelace',
    state: 'outstanding',
    stateType: 'unstarted',
    priority: 'Urgent',
    assignee: 'Grace Hopper',
    source: 'Follow-up',
    labels: ['reliability'],
    commentCount: 0,
    createdAt: '2026-09-02T10:00:00Z',
    updatedAt: '2026-09-02T12:00:00Z',
    description: 'Page the primary on replica lag.',
    comments: [],
  };

  beforeEach(async () => {
    await createProject(projectA);
  });

  it('returns the description for a follow-up from a source routed to the Factory', async () => {
    await seed.intake.setBinding({
      orgId: 'org1',
      integrationId: 'incidentio',
      sourceId: INCIDENTIO_FOLLOW_UPS_SOURCE_ID,
      factoryProjectId: projectA,
    });
    vi.spyOn(incidentio.intake, 'getIssue').mockResolvedValue(followUpDetail);

    const res = await buildApp(org1()).request(detailUrl);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      issue: {
        identifier: 'INC-42',
        title: 'Add database failover alert',
        url: 'https://app.incident.io/org/follow-ups/01HFOLLOWUP',
        description: 'Page the primary on replica lag.',
      },
    });
  });

  it('reads like a missing item when its source is not routed to the Factory', async () => {
    // The account can see the whole workspace, but no follow-up source is
    // bound to this Factory — the caller must not read arbitrary items
    // through the detail route.
    vi.spyOn(incidentio.intake, 'getIssue').mockResolvedValue(followUpDetail);

    const res = await buildApp(org1()).request(detailUrl);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'issue_not_found' });
  });

  it('rejects a malformed item reference', async () => {
    const res = await buildApp(org1()).request(
      `/web/incidentio/issues/detail?factoryProjectId=${projectA}&issueRef=../../etc/passwd`,
    );
    expect(res.status).toBe(400);
  });
});
