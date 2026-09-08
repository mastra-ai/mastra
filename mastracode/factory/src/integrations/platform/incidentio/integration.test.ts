import { afterEach, describe, expect, it, vi } from 'vitest';

import { INCIDENTIO_INCIDENTS_SOURCE_ID } from '../../incidentio/intake.js';
import { PlatformApiClient } from '../api-client.js';
import { PlatformIncidentioIntegration } from './integration.js';

const incident = {
  id: 'incident-1',
  reference: 'INC-42',
  name: 'API unavailable',
  permalink: 'https://app.incident.io/acme/incidents/incident-1',
  visibility: 'public',
  mode: 'standard',
  creator: { user: { id: 'user-1', name: 'Ada Lovelace' } },
  incident_status: { id: 'status-1', name: 'Investigating', category: 'live' },
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T11:00:00Z',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('PlatformIncidentioIntegration', () => {
  it('registers an incident and follow-up reconciliation worker', () => {
    const integration = new PlatformIncidentioIntegration({
      client: new PlatformApiClient({ baseUrl: 'https://integrations.example.com', accessToken: 'platform-secret' }),
      connectionId: 'connection-1',
    });
    const workers = integration.workers({
      storage: { projects: { listAll: async () => [] } },
      rules: { config: {}, workItems: {} },
    } as never);

    expect(workers.map(worker => worker.name)).toEqual(['incidentio-issue-reconcile']);
  });

  it('proxies incident.io requests through the configured Platform connection', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ incidents: [incident], pagination_meta: {} }));
    const client = new PlatformApiClient({
      baseUrl: 'https://integrations.example.com',
      accessToken: 'platform-secret',
      fetchImpl,
    });
    const integration = new PlatformIncidentioIntegration({ client, connectionId: 'connection/1' });

    await expect(
      integration.intake.listItems({
        orgId: 'org-1',
        userId: 'user-1',
        sourceIds: [INCIDENTIO_INCIDENTS_SOURCE_ID],
      }),
    ).resolves.toEqual({
      items: [expect.objectContaining({ title: 'INC-42: API unavailable' })],
      nextCursor: null,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringMatching(
        /^https:\/\/integrations\.example\.com\/v2\/connections\/connection%2F1\/proxy\/v2\/incidents\?/,
      ),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ authorization: 'Bearer platform-secret' }),
      }),
    );
    expect(integration.diagnostics()).toEqual({
      mode: 'platform',
      endpointHost: 'configured-client',
      connectionConfigured: true,
    });
  });

  it('uses MASTRA_INCIDENT_IO_CONNECTION_ID and keeps Platform credentials out of Intake connections', async () => {
    vi.stubEnv('MASTRA_INCIDENT_IO_CONNECTION_ID', 'connection-1');
    vi.stubEnv('MASTRA_SHARED_API_URL', 'https://platform.example.com/v1');
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'platform-secret');
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ incidents: [], pagination_meta: {} }));
    vi.stubGlobal('fetch', fetchImpl);
    const integration = new PlatformIncidentioIntegration();

    const resolved = await integration.intake.resolveIntakeDispatch!({
      orgId: 'org-1',
      externalSource: { type: 'issue', externalId: 'incidentio:incident:incident-1' },
    });
    expect(resolved).toEqual({
      connection: { type: 'oauth', accessToken: 'incidentio-connection:connection-1' },
      sourceId: INCIDENTIO_INCIDENTS_SOURCE_ID,
      issueId: 'incidentio:incident:incident-1',
    });
    expect(JSON.stringify(resolved)).not.toContain('platform-secret');

    await integration.intake.listIssues({
      connection: resolved!.connection,
      sourceIds: [INCIDENTIO_INCIDENTS_SOURCE_ID],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/v2/connections/connection-1/proxy/v2/incidents'),
      expect.any(Object),
    );
  });

  it('requires a Platform connection ID', () => {
    vi.stubEnv('MASTRA_INCIDENT_IO_CONNECTION_ID', '');
    expect(() => new PlatformIncidentioIntegration({
      client: new PlatformApiClient({ baseUrl: 'https://integrations.example.com', accessToken: 'platform-secret' }),
    })).toThrow(/MASTRA_INCIDENT_IO_CONNECTION_ID/);
  });
});
