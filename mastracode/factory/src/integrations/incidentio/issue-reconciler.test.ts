import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../../boards/index.js';
import { fakeRouteAuth, mountApiRoutes } from '../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { IntegrationContext } from '../base.js';
import { INCIDENTIO_FOLLOW_UPS_SOURCE_ID, INCIDENTIO_INCIDENTS_SOURCE_ID } from './intake.js';
import { IncidentioIntegration } from './integration.js';
import { attachIncidentioIssueReconciler } from './issue-reconciler.js';

const incident = {
  id: 'incident-1',
  reference: 'INC-42',
  name: 'API unavailable',
  summary: 'Requests are failing.',
  visibility: 'public',
  mode: 'standard',
  creator: { user: { id: 'user-1', name: 'Ada Lovelace' } },
  incident_status: { id: 'status-1', name: 'Learning', category: 'learning' },
  incident_type: { id: 'type-1', name: 'Production outage' },
  severity: { id: 'severity-1', name: 'Major', rank: 1 },
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T12:00:00Z',
};

const followUp = {
  id: 'follow-up-1',
  incident_id: 'incident-1',
  title: 'Add database failover alert',
  description: 'Page the primary on replica lag.',
  status: 'completed' as const,
  creator: { workflow: { id: 'workflow-1', name: 'Post-incident workflow' } },
  assignee: { id: 'user-2', name: 'Grace Hopper' },
  labels: ['reliability'],
  priority: { id: 'priority-1', name: 'Urgent', rank: 1 },
  created_at: '2026-09-02T10:00:00Z',
  updated_at: '2026-09-02T12:00:00Z',
};

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('incident.io issue reconciler', () => {
  it('polls and refreshes imported incidents and follow-ups', async () => {
    const seeded = await createFactoryStorageForTests();
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
    for (const externalId of ['incidentio:incident:incident-1', 'incidentio:follow-up:follow-up-1']) {
      await seeded.workItems.upsert({
        orgId: project.orgId,
        userId: project.createdBy,
        factoryProjectId: project.id,
        input: {
          externalSource: { integrationId: 'incidentio', type: 'issue', externalId, url: 'https://app.incident.io' },
          title: 'Stale title',
          stages: ['execute'],
          sessions: {},
          metadata: { stateType: 'unstarted', labels: ['stale'], autoStartCandidate: true },
        },
      });
    }

    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/v2/incidents/incident-1')) return json({ incident });
      if (url.includes('/v3/follow_ups/follow-up-1')) return json({ follow_up: followUp });
      throw new Error(`Unexpected request: ${url}`);
    });
    const integration = new IncidentioIntegration({ apiKey: 'incident-key', fetchImpl });
    const context = {
      storage: { projects: seeded.projects, intake: seeded.intake },
      runtime: {
        configVersion: 'test-v1',
        workItems: seeded.workItems,
        boards: createBoardRegistry(),
      },
    } as unknown as IntegrationContext;
    const reconcile = attachIncidentioIssueReconciler(integration, context);

    // The live incident gets a metadata refresh; the completed follow-up is
    // replayed through the close rules instead of being patched in place.
    await expect(reconcile?.()).resolves.toMatchObject({
      projects: 1,
      checked: 2,
      updated: 1,
      failed: 0,
    });
    const items = await seeded.workItems.list({ orgId: project.orgId, factoryProjectId: project.id });
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalSource: expect.objectContaining({ externalId: 'incidentio:incident:incident-1' }),
          metadata: expect.objectContaining({autoStartCandidate: true}), workItem: expect.objectContaining({ metadata: expect.objectContaining({incidentioItemType: 'incident', incidentioState: 'Learning', incidentioStateType: 'started', incidentioDescription: 'Requests are failing.', priority: 'Major', author: 'Ada Lovelace', labels: ['Major', 'Production outage', 'standard']}) }),
        }),
        // Close handling is a rules-ingress commit, not a metadata patch: the
        // stale metadata stays until the dispatcher applies the transition.
        expect.objectContaining({
          externalSource: expect.objectContaining({ externalId: 'incidentio:follow-up:follow-up-1' }),
          workItem: expect.objectContaining({ metadata: expect.objectContaining({labels: ['stale']}) }),
        }),
      ]),
    );
  });
});

describe('incident.io first-sight intake', () => {
  const sources = [INCIDENTIO_INCIDENTS_SOURCE_ID, INCIDENTIO_FOLLOW_UPS_SOURCE_ID];
  /** Real storage, rules and integration; `listFollowUps` answers incident.io's follow-up listing. */
  async function setup(listFollowUps: (after: string | null) => Response) {
    const seeded = await createFactoryStorageForTests();
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/v2/incidents')) return json({ incidents: [incident] });
      if (url.pathname.endsWith('/v3/follow_ups')) return listFollowUps(url.searchParams.get('after'));
      throw new Error(`Unexpected request: ${url.href}`);
    });
    const integration = new IncidentioIntegration({ apiKey: 'incident-key', fetchImpl });
    const context = {
      auth: fakeRouteAuth(),
      storage: { projects: seeded.projects, intake: seeded.intake },
      runtime: { configVersion: 'test-v1', workItems: seeded.workItems, boards: createBoardRegistry() },
    } as unknown as IntegrationContext;
    const project = async (orgId: string, boundSources: string[], selected = sources) => {
      const { id } = await seeded.projects.create({ orgId, userId: 'user-1', input: { name: 'Factory' } });
      await seeded.intake.saveConfig({ orgId, config: { incidentio: { enabled: true, sourceIds: selected } } });
      for (const sourceId of boundSources) {
        await seeded.intake.setSharedBinding({
          orgId,
          integrationId: 'incidentio',
          sourceId,
          factoryProjectId: id,
          labels: null,
        });
      }
      return id;
    };
    const filed = async (orgId: string, factoryProjectId: string) =>
      (await seeded.workItems.listDeferredDecisions(orgId, factoryProjectId)).map(
        entry => (entry.decision as { sourceKey?: string }).sourceKey,
      );
    const sweep = attachIncidentioIssueReconciler(integration, context)!;
    return { integration, context, fetchImpl, project, filed, sweep };
  }
  const outstanding = { ...followUp, status: 'outstanding' as const };

  it('files a follow-up on the sweep, once, only where a selected source is bound, never on a board read', async () => {
    const { integration, context, fetchImpl, project, filed, sweep } = await setup(() =>
      json({ follow_ups: [outstanding], pagination_meta: {} }),
    );
    const bound = await project('org-1', sources);
    const unbound = await project('org-1', []);
    const unselected = await project('org-2', [INCIDENTIO_FOLLOW_UPS_SOURCE_ID], [INCIDENTIO_INCIDENTS_SOURCE_ID]);
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app, integration.routes(context));

    // The incidents source is the board's first page and holds nothing a board shows.
    const read = async (after = '') =>
      (await app.request(`/web/incidentio/issues?factoryProjectId=${bound}${after}`)).json();
    const { nextCursor } = await read();
    expect(await read(`&after=${nextCursor}`)).toMatchObject({ issues: [{ id: 'incidentio:follow-up:follow-up-1' }] });
    expect(await filed('org-1', bound)).toEqual([]);
    fetchImpl.mockClear();

    await expect(sweep()).resolves.toMatchObject({ observed: 1, failed: 0 });
    await expect(sweep()).resolves.toMatchObject({ observed: 1, failed: 0 });
    expect(await filed('org-1', bound)).toEqual(['incidentio:follow-up:follow-up-1']);
    expect(await filed('org-1', unbound)).toEqual([]);
    expect(await filed('org-2', unselected)).toEqual([]);
    // One follow-up listing per sweep, for the one project with a selected source bound; incidents are never listed.
    expect(fetchImpl.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      '/v3/follow_ups',
      '/v3/follow_ups',
    ]);
  });

  it('stops listing a project after five pages', async () => {
    const { fetchImpl, project, sweep } = await setup(() =>
      json({ follow_ups: [outstanding], pagination_meta: { after: 'more' } }),
    );
    await project('org-1', [INCIDENTIO_FOLLOW_UPS_SOURCE_ID]);

    await expect(sweep()).resolves.toMatchObject({ observed: 5, failed: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it('records a project whose listing fails and still files the others', async () => {
    let listings = 0;
    const { project, filed, sweep } = await setup(() => {
      listings += 1;
      return listings === 1
        ? new Response('{}', { status: 500 })
        : json({ follow_ups: [outstanding], pagination_meta: {} });
    });
    const projects = [
      { orgId: 'org-1', id: await project('org-1', [INCIDENTIO_FOLLOW_UPS_SOURCE_ID]) },
      { orgId: 'org-2', id: await project('org-2', [INCIDENTIO_FOLLOW_UPS_SOURCE_ID]) },
    ];

    const summary = await sweep();
    expect(summary).toMatchObject({ observed: 1, failed: 1, errors: [{ projectId: expect.any(String) }] });
    const [failedProject] = projects.filter(({ id }) => id === summary.errors[0]!.projectId);
    const [filedProject] = projects.filter(({ id }) => id !== summary.errors[0]!.projectId);
    expect(await filed(failedProject!.orgId, failedProject!.id)).toEqual([]);
    expect(await filed(filedProject!.orgId, filedProject!.id)).toEqual(['incidentio:follow-up:follow-up-1']);
  });
});
