import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../../../boards/index.js';
import { createFactoryStorageForTests } from '../../../storage/test-utils.js';
import type { IntegrationContext } from '../../base.js';
import type { PlatformConnectEventDelivery } from '../foundation/events-worker.js';
import { incidentioItemFromPayload } from './connect-events.js';
import { PlatformIncidentioIntegration } from './integration.js';

const PLATFORM_BASE = 'https://integrations.example.com';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** incident.io's live view of INC-42: still being worked on. */
const liveIncident = {
  id: 'incident-1',
  reference: 'INC-42',
  name: 'API unavailable',
  summary: 'Requests are failing.',
  visibility: 'public',
  mode: 'standard',
  creator: { user: { id: 'user-1', name: 'Ada Lovelace' } },
  incident_status: { id: 'status-1', name: 'Investigating', category: 'live' },
  incident_type: { id: 'type-1', name: 'Production outage' },
  severity: { id: 'severity-1', name: 'Major', rank: 1 },
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T12:00:00Z',
};

const liveFollowUp = {
  id: 'follow-up-1',
  incident_id: 'incident-1',
  title: 'Add database failover alert',
  description: 'Page the primary on replica lag.',
  status: 'outstanding' as const,
  creator: { workflow: { id: 'workflow-1', name: 'Post-incident workflow' } },
  assignee: { id: 'user-2', name: 'Grace Hopper' },
  labels: ['reliability'],
  priority: { id: 'priority-1', name: 'Urgent', rank: 1 },
  created_at: '2026-09-02T10:00:00Z',
  updated_at: '2026-09-02T12:00:00Z',
};

/** A webhook claiming INC-42 is closed; only the incident's id may be read from it. */
function incidentWebhook(id = 'incident-1', eventType = 'public_incident.incident_updated_v2') {
  return {
    event_type: eventType,
    [eventType]: { incident: { id, name: 'Forged name', incident_status: { name: 'Closed', category: 'closed' } } },
  };
}

function followUpWebhook(id = 'follow-up-1', eventType = 'public_incident.follow_up_updated_v1') {
  return { event_type: eventType, [eventType]: { id, title: 'Forged title', status: 'completed' } };
}

function delivery(
  payload: unknown,
  overrides: Partial<PlatformConnectEventDelivery> = {},
): PlatformConnectEventDelivery {
  return {
    id: '7001',
    timestamp: 1_700_000_000_000,
    connectionId: 'conn-acme',
    integrationId: 'incident-io',
    eventType: 'public_incident.incident_updated_v2',
    sourceEventId: 'msg_1',
    payload,
    unverified: false,
    dedupeKey: 'msg_1',
    ...overrides,
  };
}

async function setup(options: { tracked?: string[]; incidentResponse?: () => Response } = {}) {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
  for (const externalId of options.tracked ?? ['incidentio:incident:incident-1', 'incidentio:follow-up:follow-up-1']) {
    await seeded.workItems.upsert({
      orgId: project.orgId,
      userId: project.createdBy,
      factoryProjectId: project.id,
      input: {
        externalSource: { integrationId: 'incidentio', type: 'issue', externalId, url: 'https://app.incident.io' },
        title: 'Stale title',
        stages: ['execute'],
        sessions: {},
        metadata: { stateType: 'unstarted', labels: ['stale'] },
      },
    });
  }
  const itemRequests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async input => {
      const target = String(input);
      if (target.endsWith('/v2/projects/proj_factory/connections')) {
        return json({ connections: [{ id: 'conn-acme', integrationId: 'incident-io', status: 'active' }] });
      }
      if (target.includes('/v2/connections/conn-acme/proxy/v2/incidents/incident-1')) {
        itemRequests.push(target);
        return options.incidentResponse?.() ?? json({ incident: liveIncident });
      }
      if (target.includes('/v2/connections/conn-acme/proxy/v3/follow_ups/follow-up-1')) {
        itemRequests.push(target);
        return json({ follow_up: liveFollowUp });
      }
      throw new Error(`Unexpected request: ${target}`);
    }),
  );
  const incidentio = new PlatformIncidentioIntegration({
    connect: { baseUrl: PLATFORM_BASE, projectId: 'proj_factory', accessToken: 'platform-token' },
  });
  const context = {
    storage: { projects: seeded.projects },
    runtime: { configVersion: 'test-v1', workItems: seeded.workItems, boards: createBoardRegistry() },
  } as unknown as IntegrationContext;
  const route = incidentio.connectEventRoute(context)!;
  const card = async (externalId: string) =>
    (await seeded.workItems.list({ orgId: project.orgId, factoryProjectId: project.id })).find(
      item => item.externalSource?.externalId === externalId,
    )!;
  return { route, card, itemRequests };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('incidentioItemFromPayload', () => {
  it('names incidents and follow-ups from the resource under the event type', () => {
    expect(incidentioItemFromPayload(incidentWebhook())).toBe('incidentio:incident:incident-1');
    // Created events put the incident itself under the event type.
    expect(
      incidentioItemFromPayload({
        event_type: 'public_incident.incident_created_v2',
        'public_incident.incident_created_v2': { id: 'incident-2' },
      }),
    ).toBe('incidentio:incident:incident-2');
    expect(incidentioItemFromPayload(followUpWebhook())).toBe('incidentio:follow-up:follow-up-1');
    expect(incidentioItemFromPayload(followUpWebhook('action-1', 'public_incident.action_updated_v1'))).toBe(
      'incidentio:follow-up:action-1',
    );
  });

  it('names nothing for other events or malformed bodies', () => {
    expect(
      incidentioItemFromPayload({
        event_type: 'public_alert.alert_created_v1',
        'public_alert.alert_created_v1': { id: 'alert-1' },
      }),
    ).toBeNull();
    expect(incidentioItemFromPayload({ event_type: 'public_incident.incident_updated_v2' })).toBeNull();
    expect(incidentioItemFromPayload(null)).toBeNull();
    expect(incidentioItemFromPayload('{}')).toBeNull();
  });
});

describe('PlatformIncidentioIntegration events', () => {
  it("updates a tracked incident's card from incident.io, not from the event's payload", async () => {
    const { route, card, itemRequests } = await setup();

    await route.handle(delivery(incidentWebhook()));

    expect(itemRequests).toEqual([expect.stringContaining('/v2/incidents/incident-1')]);
    expect((await card('incidentio:incident:incident-1')).workItem.metadata).toMatchObject({
      incidentioState: 'Investigating',
      incidentioStateType: 'started',
    });
    // Only the named incident is reconciled.
    expect((await card('incidentio:follow-up:follow-up-1')).workItem.metadata).toMatchObject({ labels: ['stale'] });
  });

  it('re-fetches a tracked follow-up when incident.io reports a change to it', async () => {
    const { route, card, itemRequests } = await setup();

    await route.handle(delivery(followUpWebhook(), { eventType: 'public_incident.follow_up_updated_v1' }));

    expect(itemRequests).toEqual([expect.stringContaining('/v3/follow_ups/follow-up-1')]);
    expect((await card('incidentio:follow-up:follow-up-1')).workItem.metadata).toMatchObject({
      labels: expect.arrayContaining(['reliability']),
    });
  });

  it('treats an unverified event only as a reason to re-fetch the incident', async () => {
    const { route, card, itemRequests } = await setup();

    await route.handle(delivery(incidentWebhook(), { unverified: true }));

    expect(itemRequests).toHaveLength(1);
    const metadata = (await card('incidentio:incident:incident-1')).workItem.metadata;
    expect(metadata).toMatchObject({ incidentioState: 'Investigating' });
    expect(JSON.stringify(metadata)).not.toContain('Forged');
  });

  it('ignores an incident Factory does not track', async () => {
    const { route, itemRequests } = await setup({ tracked: ['incidentio:incident:incident-1'] });

    await route.handle(delivery(incidentWebhook('incident-9')));

    expect(itemRequests).toEqual([]);
  });

  it('ignores events that name no incident or follow-up', async () => {
    const { route, itemRequests } = await setup();

    await route.handle(
      delivery(
        { event_type: 'public_alert.alert_created_v1', 'public_alert.alert_created_v1': { id: 'incident-1' } },
        { eventType: 'public_alert.alert_created_v1' },
      ),
    );

    expect(itemRequests).toEqual([]);
  });

  it('fails the delivery when incident.io cannot be read, so the worker retries it', async () => {
    const { route } = await setup({ incidentResponse: () => json({ error: 'unavailable' }, 503) });

    await expect(route.handle(delivery(incidentWebhook()))).rejects.toThrow(
      /incidentio:incident:incident-1 could not be reconciled/,
    );
  });
});
