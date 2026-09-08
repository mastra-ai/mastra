import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  INCIDENTIO_FOLLOW_UPS_SOURCE_ID,
  INCIDENTIO_INCIDENTS_SOURCE_ID,
} from './intake.js';
import { IncidentioIntegration } from './integration.js';
import { incidentioReconciliationInterval } from './reconciliation-config.js';

const incident = {
  id: 'incident-1',
  reference: 'INC-42',
  name: 'API unavailable',
  summary: 'Requests are failing.',
  permalink: 'https://app.incident.io/acme/incidents/incident-1',
  visibility: 'public',
  mode: 'standard',
  creator: { user: { id: 'user-1', name: 'Ada Lovelace' } },
  incident_status: { id: 'status-1', name: 'Investigating', category: 'live' },
  incident_type: { id: 'type-1', name: 'Production outage' },
  severity: { id: 'severity-1', name: 'Major', rank: 1 },
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T11:00:00Z',
};

const followUp = {
  id: 'follow-up-1',
  incident_id: 'incident-1',
  title: 'Add database failover alert',
  description: 'Page the primary on replica lag.',
  status: 'outstanding' as const,
  creator: { workflow: { id: 'workflow-1', name: 'Post-incident workflow' } },
  assignee: { id: 'user-2', name: 'Grace Hopper' },
  labels: ['reliability'],
  priority: { id: 'priority-1', name: 'Urgent', rank: 1 },
  external_issue_reference: {
    issue_name: 'ENG-99',
    issue_permalink: 'https://linear.app/acme/issue/ENG-99',
    provider: 'linear',
  },
  created_at: '2026-09-02T10:00:00Z',
  updated_at: '2026-09-02T11:00:00Z',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('IncidentioIntegration', () => {
  it('registers an incident and follow-up reconciliation worker', () => {
    vi.stubEnv('MASTRACODE_INCIDENT_IO_RECONCILE_INTERVAL_MS', '60000');
    const integration = new IncidentioIntegration({ apiKey: 'incident-key' });
    const workers = integration.workers({
      storage: { projects: { listAll: async () => [] } },
      rules: { config: {}, workItems: {} },
    } as never);

    expect(workers.map(worker => worker.name)).toEqual(['incidentio-issue-reconcile']);
    expect(incidentioReconciliationInterval()).toBe(60000);
  });

  it('does not register reconciliation when disabled', () => {
    vi.stubEnv('MASTRACODE_INCIDENT_IO_RECONCILE_ENABLED', 'false');
    const integration = new IncidentioIntegration({ apiKey: 'incident-key' });

    expect(
      integration.workers({
        storage: { projects: { listAll: async () => [] } },
        rules: { config: {}, workItems: {} },
      } as never),
    ).toEqual([]);
  });

  it('requires and uses INCIDENT_IO_API_KEY', async () => {
    vi.stubEnv('INCIDENT_IO_API_KEY', 'incident-key');
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ incidents: [], pagination_meta: {} }));
    const integration = new IncidentioIntegration({ fetchImpl });

    await integration.intake.listItems({
      orgId: 'org-1',
      userId: 'user-1',
      sourceIds: [INCIDENTIO_INCIDENTS_SOURCE_ID],
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/api\.incident\.io\/v2\/incidents\?/),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ authorization: 'Bearer incident-key' }),
      }),
    );
    expect(integration.diagnostics()).toEqual({ mode: 'api-key', endpointHost: 'api.incident.io' });

    vi.stubEnv('INCIDENT_IO_API_KEY', '');
    expect(() => new IncidentioIntegration()).toThrow(/INCIDENT_IO_API_KEY/);
  });

  it('lists incidents and follow-ups as separate Intake sources with composite pagination', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/v2/incidents')) {
        return json({
          incidents: [
            incident,
            { ...incident, id: 'incident-closed', incident_status: { id: 'closed', name: 'Closed', category: 'closed' } },
          ],
          pagination_meta: {},
        });
      }
      if (url.includes('/v3/follow_ups')) {
        return json({ follow_ups: [followUp], pagination_meta: {} });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const integration = new IncidentioIntegration({ apiKey: 'incident-key', fetchImpl });

    await expect(integration.intake.listSources({ orgId: 'org-1', userId: 'user-1' })).resolves.toEqual([
      { id: INCIDENTIO_INCIDENTS_SOURCE_ID, name: 'Incidents', type: 'incident' },
      { id: INCIDENTIO_FOLLOW_UPS_SOURCE_ID, name: 'Incident follow-ups', type: 'follow-up' },
    ]);

    const incidents = await integration.intake.listItems({
      orgId: 'org-1',
      userId: 'user-1',
      sourceIds: [INCIDENTIO_INCIDENTS_SOURCE_ID, INCIDENTIO_FOLLOW_UPS_SOURCE_ID],
    });
    expect(incidents.items).toEqual([
      expect.objectContaining({
        source: {
          type: 'issue',
          externalId: 'incidentio:incident:incident-1',
          url: incident.permalink,
        },
        sourceId: INCIDENTIO_INCIDENTS_SOURCE_ID,
        title: 'INC-42: API unavailable',
        status: 'Investigating',
        labels: ['Major', 'Production outage', 'standard'],
      }),
    ]);
    expect(incidents.nextCursor).not.toBeNull();

    const followUps = await integration.intake.listItems({
      orgId: 'org-1',
      userId: 'user-1',
      sourceIds: [INCIDENTIO_INCIDENTS_SOURCE_ID, INCIDENTIO_FOLLOW_UPS_SOURCE_ID],
      cursor: incidents.nextCursor!,
    });
    expect(followUps).toEqual({
      items: [
        expect.objectContaining({
          source: {
            type: 'issue',
            externalId: 'incidentio:follow-up:follow-up-1',
            url: followUp.external_issue_reference.issue_permalink,
          },
          sourceId: INCIDENTIO_FOLLOW_UPS_SOURCE_ID,
          title: 'ENG-99: Add database failover alert',
          assignee: 'Grace Hopper',
        }),
      ],
      nextCursor: null,
    });
  });

  it('filters labels, resolves dispatch, and returns incident details', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/v2/incidents/incident-1')) return json({ incident });
      if (url.includes('/v2/incidents')) return json({ incidents: [incident], pagination_meta: {} });
      throw new Error(`Unexpected request: ${url}`);
    });
    const integration = new IncidentioIntegration({ apiKey: 'incident-key', fetchImpl });
    const connection = { type: 'oauth' as const, accessToken: 'incident-key' };

    await expect(
      integration.intake.listIssues({
        connection,
        sourceIds: [INCIDENTIO_INCIDENTS_SOURCE_ID],
        labels: ['major', 'STANDARD'],
      }),
    ).resolves.toEqual({
      issues: [expect.objectContaining({ id: 'incidentio:incident:incident-1', stateType: 'started' })],
      nextCursor: null,
    });
    await expect(
      integration.intake.resolveIntakeDispatch!({
        orgId: 'org-1',
        externalSource: { type: 'issue', externalId: 'incidentio:incident:incident-1' },
      }),
    ).resolves.toEqual({
      connection,
      sourceId: INCIDENTIO_INCIDENTS_SOURCE_ID,
      issueId: 'incidentio:incident:incident-1',
    });
    await expect(
      integration.intake.getIssue({ connection, issueId: 'incidentio:incident:incident-1' }),
    ).resolves.toEqual(
      expect.objectContaining({
        identifier: 'INC-42',
        description: 'Requests are failing.',
        comments: [],
      }),
    );
  });

  it('updates follow-up status while preserving its required title', async () => {
    const completedFollowUp = { ...followUp, status: 'completed' as const, updated_at: '2026-09-03T11:00:00Z' };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ follow_up: followUp }))
      .mockResolvedValueOnce(json({ follow_up: completedFollowUp }));
    const integration = new IncidentioIntegration({ apiKey: 'incident-key', fetchImpl });

    await expect(
      integration.intake.updateIssue({
        connection: { type: 'oauth', accessToken: 'incident-key' },
        issueId: 'incidentio:follow-up:follow-up-1',
        state: { kind: 'byType', stateType: 'completed' },
      }),
    ).resolves.toEqual(expect.objectContaining({ state: 'completed', stateType: 'completed' }));
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://api.incident.io/v3/follow_ups/follow-up-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ title: followUp.title, status: 'completed' }),
      }),
    );
  });
});
