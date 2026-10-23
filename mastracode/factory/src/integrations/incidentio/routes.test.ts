import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth, mountApiRoutes } from '../../routes/test-utils.js';
import type { TestAuthUser } from '../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../../storage/test-utils.js';
import { INCIDENTIO_FOLLOW_UPS_SOURCE_ID } from './intake.js';
import { IncidentioIntegration } from './integration.js';
import { buildIncidentioRoutes } from './routes.js';

// A real integration instance with the network edge spied out: item listing
// and detail resolution run the production mapping code paths against the
// seeded `:memory:` intake storage.
let incidentio!: IncidentioIntegration;
let seed!: FactoryStorageTestSeed;

const followUpItem = {
  source: {
    type: 'issue',
    externalId: 'incidentio:follow-up:01HFOLLOWUP',
    url: 'https://app.incident.io/org/follow-ups/01HFOLLOWUP',
  },
  sourceId: INCIDENTIO_FOLLOW_UPS_SOURCE_ID,
  title: 'INC-42: Add database failover alert',
  status: 'outstanding',
  labels: ['reliability'],
  assignee: 'Grace Hopper',
  createdAt: '2026-09-02T10:00:00Z',
  updatedAt: '2026-09-02T12:00:00Z',
  metadata: {
    identifier: 'INC-42',
    stateType: 'unstarted',
    priority: 'Urgent',
    author: 'Ada Lovelace',
    incidentioItemType: 'follow-up',
    incidentioIncidentId: 'incident-1',
  },
};

const incidentItem = {
  source: {
    type: 'issue',
    externalId: 'incidentio:incident:incident-1',
    url: 'https://app.incident.io/org/incidents/incident-1',
  },
  sourceId: 'incidentio:incidents',
  title: 'INC-42: API unavailable',
  status: 'Investigating',
  labels: [],
  assignee: null,
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: '2026-09-01T11:00:00Z',
  metadata: { identifier: 'INC-42', stateType: 'started', incidentioItemType: 'incident' },
};

const listItems = vi.fn(async () => ({ items: [followUpItem, incidentItem], nextCursor: null }));

// ── Test harness ─────────────────────────────────────────────────────────
function buildApp(
  user: TestAuthUser | null,
  options: {
    authEnabled?: boolean;
    withIncidentio?: boolean;
    withIntake?: boolean;
    ingestFactoryIssues?: (input: unknown) => Promise<unknown>;
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
      ...(options.ingestFactoryIssues ? { ingestFactoryIssues: options.ingestFactoryIssues as never } : {}),
    }),
  );
  return app;
}

const org1 = (): TestAuthUser => ({ workosId: 'u1', organizationId: 'org1' });
const projectA = '11111111-1111-4111-8111-111111111111';

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  incidentio = new IncidentioIntegration({ apiKey: 'incident-key' });
  vi.spyOn(incidentio.intake, 'listItems').mockImplementation(listItems as never);
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
    expect((await app.request('/web/incidentio/issues')).status).toBe(404);
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

describe('issues route', () => {
  beforeEach(async () => {
    await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'project-a' } });
  });

  const bind = (sourceId: string, factoryProjectId: string, board = 'work') =>
    seed.intake.setBinding({ orgId: 'org1', integrationId: 'incidentio', sourceId, factoryProjectId, board });

  it('rejects unauthenticated users', async () => {
    expect((await buildApp(null).request('/web/incidentio/issues')).status).toBe(401);
  });

  it('404s when incident.io intake is disabled in Settings', async () => {
    await seed.intake.saveConfig({ orgId: 'org1', config: { incidentio: { enabled: false, sourceIds: [] } } });
    const res = await buildApp(org1()).request('/web/incidentio/issues');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'incidentio_intake_disabled' });
  });

  it('serves only follow-ups from sources routed to the Factory, never incidents', async () => {
    await bind(INCIDENTIO_FOLLOW_UPS_SOURCE_ID, projectA);

    const res = await buildApp(org1()).request(`/web/incidentio/issues?factoryProjectId=${projectA}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      issues: [
        {
          id: 'incidentio:follow-up:01HFOLLOWUP',
          identifier: 'INC-42',
          title: 'Add database failover alert',
          url: 'https://app.incident.io/org/follow-ups/01HFOLLOWUP',
          author: 'Ada Lovelace',
          state: 'outstanding',
          stateType: 'unstarted',
          priorityLabel: 'Urgent',
          assignee: 'Grace Hopper',
          incident: 'incident-1',
          labels: ['reliability'],
          createdAt: '2026-09-02T10:00:00Z',
          updatedAt: '2026-09-02T12:00:00Z',
          sourceId: INCIDENTIO_FOLLOW_UPS_SOURCE_ID,
        },
      ],
      nextCursor: null,
    });
    expect(listItems).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org1', userId: 'u1', sourceIds: [INCIDENTIO_FOLLOW_UPS_SOURCE_ID] }),
    );
  });

  it('returns an empty page without fetching when no source is bound to the Factory', async () => {
    const res = await buildApp(org1()).request(`/web/incidentio/issues?factoryProjectId=${projectA}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ issues: [], nextCursor: null });
    expect(listItems).not.toHaveBeenCalled();
  });

  it('rejects a malformed pagination cursor', async () => {
    const res = await buildApp(org1()).request('/web/incidentio/issues?after=%00bad%20cursor');
    expect(res.status).toBe(400);
  });

  it('ingests a board-scoped listing through the Factory rules', async () => {
    await bind(INCIDENTIO_FOLLOW_UPS_SOURCE_ID, projectA);
    const ingestFactoryIssues = vi.fn(async () => ({ status: 'committed', ingested: 1 }));

    const res = await buildApp(org1(), { ingestFactoryIssues }).request(
      `/web/incidentio/issues?factoryProjectId=${projectA}`,
    );

    expect(res.status).toBe(200);
    expect(ingestFactoryIssues).toHaveBeenCalledWith({
      orgId: 'org1',
      userId: 'u1',
      factoryProjectId: projectA,
      issues: [
        expect.objectContaining({
          id: 'incidentio:follow-up:01HFOLLOWUP',
          identifier: 'INC-42',
          stateType: 'unstarted',
          assignee: 'Grace Hopper',
          author: 'Ada Lovelace',
          sourceId: INCIDENTIO_FOLLOW_UPS_SOURCE_ID,
        }),
      ],
      intakeBoards: { [INCIDENTIO_FOLLOW_UPS_SOURCE_ID]: 'work' },
    });
  });

  it('does not ingest an unscoped listing', async () => {
    await bind(INCIDENTIO_FOLLOW_UPS_SOURCE_ID, projectA);
    const ingestFactoryIssues = vi.fn(async () => ({ status: 'committed', ingested: 1 }));

    const res = await buildApp(org1(), { ingestFactoryIssues }).request('/web/incidentio/issues');

    expect(res.status).toBe(200);
    expect(ingestFactoryIssues).not.toHaveBeenCalled();
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
    await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'project-a' } });
  });

  it('returns the description for a follow-up from a source routed to the Factory', async () => {
    await seed.intake.setBinding({
      orgId: 'org1',
      integrationId: 'incidentio',
      sourceId: INCIDENTIO_FOLLOW_UPS_SOURCE_ID,
      factoryProjectId: projectA,
      board: 'work',
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
