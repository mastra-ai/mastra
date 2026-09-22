import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth } from '../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../../storage/test-utils.js';
import { buildIncidentioAgentTools, INCIDENTIO_UNTRUSTED_CONTENT_NOTICE } from './agent-tools.js';
import { IncidentioApiError } from './api.js';
import { INCIDENTIO_FOLLOW_UPS_SOURCE_ID } from './intake.js';
import { IncidentioIntegration } from './integration.js';

// A real integration instance backed by seeded `:memory:` storage. Only the
// network edges (the intake capability calls) are spied out, so the project →
// org resolution and exposure gating run the production paths.
let seed!: FactoryStorageTestSeed;
let incidentio!: IncidentioIntegration;

const fetchDetail = vi.fn();

let PROJECT_ID = '';
const ORG_ID = 'org-1';
const ITEM_REF = 'incidentio:follow-up:01HFOLLOWUP';

function requestContextFor(resourceId: string | undefined, factoryProjectId?: string): RequestContext {
  const ctx = new RequestContext();
  if (resourceId !== undefined) {
    ctx.set('controller', {
      resourceId,
      getState: () => ({ factoryProjectId }),
    });
  }
  return ctx;
}

function boardRunRequestContext(factoryProjectId: string): RequestContext {
  return requestContextFor('work-item-session-id', factoryProjectId);
}

async function seedProject(): Promise<void> {
  const project = await seed.projects.create({
    orgId: ORG_ID,
    userId: 'user-1',
    input: { name: 'Acme app' },
  });
  PROJECT_ID = project.id;
  await routeSourceToProject(PROJECT_ID);
}

/** Select the follow-ups source in Settings and bind it to the given Factory. */
async function routeSourceToProject(factoryProjectId: string): Promise<void> {
  await seed.intake.saveConfig({
    orgId: ORG_ID,
    config: { incidentio: { enabled: true, sourceIds: [INCIDENTIO_FOLLOW_UPS_SOURCE_ID] } },
  });
  await seed.intake.setBinding({
    orgId: ORG_ID,
    integrationId: 'incidentio',
    sourceId: INCIDENTIO_FOLLOW_UPS_SOURCE_ID,
    factoryProjectId,
    board: 'work',
  });
}

const followUpDetail = {
  id: ITEM_REF,
  identifier: 'INC-42',
  title: 'Add database failover alert',
  description: 'Page the primary on replica lag.',
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
  comments: [],
};

beforeEach(async () => {
  PROJECT_ID = '';
  seed = await createFactoryStorageForTests();
  incidentio = new IncidentioIntegration({ apiKey: 'incident-key' });
  incidentio.initialize({ projects: seed.projects, auth: fakeRouteAuth(), intake: seed.intake });
  vi.spyOn(incidentio.intake, 'getIssue').mockImplementation(input => fetchDetail(input.issueId));
  fetchDetail.mockReset();
});

describe('buildIncidentioAgentTools — exposure gating', () => {
  it('exposes the read tool for org-owned factory projects', async () => {
    await seedProject();
    const tools = await buildIncidentioAgentTools({ incidentio, requestContext: requestContextFor(PROJECT_ID) });
    // Read-only surface: incident.io has no comment API for follow-ups, so no
    // mutating tool may leak into the agent tool record.
    expect(Object.keys(tools)).toEqual(['incidentio_get_issue']);
  });

  it('exposes nothing when the host runs without web auth', async () => {
    await seedProject();
    incidentio.initialize({ projects: seed.projects, auth: fakeRouteAuth({ enabled: false }), intake: seed.intake });
    const tools = await buildIncidentioAgentTools({ incidentio, requestContext: requestContextFor(PROJECT_ID) });
    expect(tools).toEqual({});
  });

  it('exposes the tools on board runs, where the resourceId is a session id', async () => {
    await seedProject();
    const tools = await buildIncidentioAgentTools({
      incidentio,
      requestContext: boardRunRequestContext(PROJECT_ID),
    });
    expect(Object.keys(tools)).toEqual(['incidentio_get_issue']);
  });

  it('exposes nothing for resources that are not factory projects', async () => {
    const tools = await buildIncidentioAgentTools({
      incidentio,
      requestContext: requestContextFor('local-default'),
    });
    expect(tools).toEqual({});
  });

  it('exposes nothing when there is no controller context', async () => {
    const tools = await buildIncidentioAgentTools({ incidentio, requestContext: requestContextFor(undefined) });
    expect(tools).toEqual({});
  });
});

describe('incidentio_get_issue', () => {
  it('returns the full follow-up detail', async () => {
    await seedProject();
    fetchDetail.mockResolvedValueOnce(followUpDetail);
    const tools = await buildIncidentioAgentTools({ incidentio, requestContext: requestContextFor(PROJECT_ID) });
    const result = await (tools.incidentio_get_issue!.execute as any)({ issue: ` ${ITEM_REF} ` });
    expect(result).toEqual({ notice: INCIDENTIO_UNTRUSTED_CONTENT_NOTICE, ...followUpDetail });
    expect(fetchDetail).toHaveBeenCalledWith(ITEM_REF);
  });

  it('reports unknown items as a tool error', async () => {
    await seedProject();
    fetchDetail.mockResolvedValueOnce(null);
    const tools = await buildIncidentioAgentTools({ incidentio, requestContext: requestContextFor(PROJECT_ID) });
    const result = await (tools.incidentio_get_issue!.execute as any)({ issue: ITEM_REF });
    expect(result).toEqual({
      error: `incident.io item "${ITEM_REF}" was not found on the connected accounts.`,
    });
  });

  it('reports unresolvable references as a tool error', async () => {
    await seedProject();
    const tools = await buildIncidentioAgentTools({ incidentio, requestContext: requestContextFor(PROJECT_ID) });
    const result = await (tools.incidentio_get_issue!.execute as any)({ issue: 'not-a-reference' });
    expect(result).toEqual({
      error: 'incident.io item "not-a-reference" was not found on the connected accounts.',
    });
    expect(fetchDetail).not.toHaveBeenCalled();
  });

  it('maps credential rejections to an operator-facing error', async () => {
    await seedProject();
    fetchDetail.mockRejectedValueOnce(new IncidentioApiError('incident.io API request failed (401)', 401));
    const tools = await buildIncidentioAgentTools({ incidentio, requestContext: requestContextFor(PROJECT_ID) });
    const result = await (tools.incidentio_get_issue!.execute as any)({ issue: ITEM_REF });
    expect(result).toEqual({
      error: 'incident.io rejected the connected credentials. Ask the operator to reconnect incident.io.',
    });
  });

  it('surfaces non-auth failures with the underlying message', async () => {
    await seedProject();
    fetchDetail.mockRejectedValueOnce(new IncidentioApiError('incident.io API request failed (500)', 500));
    const tools = await buildIncidentioAgentTools({ incidentio, requestContext: requestContextFor(PROJECT_ID) });
    const result = await (tools.incidentio_get_issue!.execute as any)({ issue: ITEM_REF });
    expect(result).toEqual({
      error: 'Failed to fetch incident.io item: incident.io API request failed (500)',
    });
  });
});

describe('incidentio_get_issue — Factory routing authorization', () => {
  const notFound = { error: `incident.io item "${ITEM_REF}" was not found on the connected accounts.` };

  it("refuses items whose source is routed to a different Factory's boards", async () => {
    // Two projects in the same org; the follow-ups source is bound only to
    // the other one. A board run for this project must not read it.
    const project = await seed.projects.create({ orgId: ORG_ID, userId: 'user-1', input: { name: 'Acme app' } });
    const other = await seed.projects.create({ orgId: ORG_ID, userId: 'user-1', input: { name: 'Other app' } });
    await routeSourceToProject(other.id);
    const tools = await buildIncidentioAgentTools({ incidentio, requestContext: requestContextFor(project.id) });
    const result = await (tools.incidentio_get_issue!.execute as any)({ issue: ITEM_REF });
    expect(result).toEqual(notFound);
    expect(fetchDetail).not.toHaveBeenCalled();
  });

  it('refuses items when no incident.io source is bound to the Factory at all', async () => {
    const project = await seed.projects.create({ orgId: ORG_ID, userId: 'user-1', input: { name: 'Acme app' } });
    await seed.intake.saveConfig({
      orgId: ORG_ID,
      config: { incidentio: { enabled: true, sourceIds: [INCIDENTIO_FOLLOW_UPS_SOURCE_ID] } },
    });
    const tools = await buildIncidentioAgentTools({ incidentio, requestContext: requestContextFor(project.id) });
    const result = await (tools.incidentio_get_issue!.execute as any)({ issue: ITEM_REF });
    expect(result).toEqual(notFound);
    expect(fetchDetail).not.toHaveBeenCalled();
  });

  it('refuses items when incident.io intake is disabled in Settings', async () => {
    await seedProject();
    await seed.intake.saveConfig({ orgId: ORG_ID, config: { incidentio: { enabled: false, sourceIds: [] } } });
    const tools = await buildIncidentioAgentTools({ incidentio, requestContext: requestContextFor(PROJECT_ID) });
    const result = await (tools.incidentio_get_issue!.execute as any)({ issue: ITEM_REF });
    expect(result).toEqual(notFound);
    expect(fetchDetail).not.toHaveBeenCalled();
  });

  it('reads items normally on board runs for the Factory the source is routed to', async () => {
    await seedProject();
    fetchDetail.mockResolvedValueOnce(followUpDetail);
    const tools = await buildIncidentioAgentTools({
      incidentio,
      requestContext: boardRunRequestContext(PROJECT_ID),
    });
    const result = await (tools.incidentio_get_issue!.execute as any)({ issue: ITEM_REF });
    expect(result).toEqual({ notice: INCIDENTIO_UNTRUSTED_CONTENT_NOTICE, ...followUpDetail });
  });
});
