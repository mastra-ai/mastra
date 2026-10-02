import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../../../boards/index.js';
import { INCIDENTIO_INCIDENTS_SOURCE_ID } from '../../incidentio/intake.js';
import { decodeScopedSourceId, encodeScopedSourceId, PlatformIncidentioIntegration } from './integration.js';

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

function connection(id: string, accountLabel: string | null = null, status: 'active' | 'needs_reauth' = 'active') {
  return { id, integrationId: 'incident-io', status, accountLabel };
}

function fetchRouter(routes: Array<{ match: (url: string) => boolean; respond: (url: string) => Response }>) {
  return vi.fn<typeof fetch>().mockImplementation(async input => {
    const url = String(input);
    const route = routes.find(candidate => candidate.match(url));
    if (!route) throw new Error(`Unexpected fetch: ${url}`);
    return route.respond(url);
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PlatformIncidentioIntegration', () => {
  it('registers an incident and follow-up reconciliation worker', () => {
    const integration = new PlatformIncidentioIntegration({
      clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-secret' },
    });
    const workers = integration.workers({
      storage: { projects: { listAll: async () => [] } },
      runtime: { configVersion: 'test-v1', workItems: {}, boards: createBoardRegistry() },
    } as never);

    expect(workers.map(worker => worker.name)).toEqual(['incidentio-issue-reconcile']);
  });

  it('discovers incident-io connections and proxies through each one', async () => {
    const fetchImpl = fetchRouter([
      {
        match: url => url.includes('/v2/connections?providerKey=incident-io'),
        respond: () => json({ connections: [connection('connection/1', 'acme')] }),
      },
      {
        match: url => url.includes('/proxy/v2/incidents'),
        respond: () => json({ incidents: [incident], pagination_meta: {} }),
      },
    ]);
    const integration = new PlatformIncidentioIntegration({
      clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-secret', fetchImpl },
    });

    const page = await integration.intake.listItems({
      orgId: 'org-1',
      userId: 'user-1',
      sourceIds: [INCIDENTIO_INCIDENTS_SOURCE_ID],
    });
    expect(page.items).toEqual([
      expect.objectContaining({
        title: 'INC-42: API unavailable',
        sourceId: encodeScopedSourceId('connection/1', INCIDENTIO_INCIDENTS_SOURCE_ID),
        metadata: expect.objectContaining({ connectionId: 'connection/1' }),
      }),
    ]);
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
      configured: true,
      mode: 'platform',
      endpointHost: 'integrations.example.com',
    });
  });

  it('lists connection-scoped sources for every active connection', async () => {
    const fetchImpl = fetchRouter([
      {
        match: url => url.includes('/v2/connections?providerKey=incident-io'),
        respond: () =>
          json({
            connections: [
              connection('connection-b', 'beta'),
              connection('connection-a', 'acme'),
              connection('connection-c', 'stale', 'needs_reauth'),
            ],
          }),
      },
    ]);
    const integration = new PlatformIncidentioIntegration({
      clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-secret', fetchImpl },
    });

    const sources = await integration.intake.listSources({ orgId: 'org-1', userId: 'user-1' });
    // Two active connections, two sources each; needs_reauth is excluded and
    // connections are ordered deterministically.
    expect(sources).toHaveLength(4);
    expect(sources.map(source => decodeScopedSourceId(source.id)?.connectionId)).toEqual([
      'connection-a',
      'connection-a',
      'connection-b',
      'connection-b',
    ]);
    expect(sources[0]).toEqual(
      expect.objectContaining({
        name: 'Incidents (acme)',
        metadata: expect.objectContaining({ connectionId: 'connection-a', account: 'acme' }),
      }),
    );
  });

  it('pages across connections and keeps items scoped to the owning connection', async () => {
    const fetchImpl = fetchRouter([
      {
        match: url => url.includes('/v2/connections?providerKey=incident-io'),
        respond: () => json({ connections: [connection('connection-a', 'acme'), connection('connection-b', 'beta')] }),
      },
      {
        match: url => url.includes('/connection-a/proxy/v2/incidents'),
        respond: () => json({ incidents: [incident], pagination_meta: {} }),
      },
      {
        match: url => url.includes('/connection-b/proxy/v2/incidents'),
        respond: () =>
          json({ incidents: [{ ...incident, id: 'incident-2', reference: 'INC-77' }], pagination_meta: {} }),
      },
    ]);
    const integration = new PlatformIncidentioIntegration({
      clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-secret', fetchImpl },
    });
    const sourceIds = [
      encodeScopedSourceId('connection-a', INCIDENTIO_INCIDENTS_SOURCE_ID),
      encodeScopedSourceId('connection-b', INCIDENTIO_INCIDENTS_SOURCE_ID),
    ];

    const first = await integration.intake.listItems({ orgId: 'org-1', userId: 'user-1', sourceIds });
    expect(first.items).toEqual([expect.objectContaining({ title: 'INC-42: API unavailable' })]);
    expect(first.nextCursor).not.toBeNull();

    const second = await integration.intake.listItems({
      orgId: 'org-1',
      userId: 'user-1',
      sourceIds,
      cursor: first.nextCursor!,
    });
    expect(second.items).toEqual([
      expect.objectContaining({
        title: 'INC-77: API unavailable',
        metadata: expect.objectContaining({ connectionId: 'connection-b' }),
      }),
    ]);
    expect(second.nextCursor).toBeNull();
  });

  it('resumes at the sorted successor when the cursor connection disappears between pages', async () => {
    // Page cursors are keyed by connection ID, not index: when the cursor's
    // connection disappears between pages, paging resumes at its sorted
    // successor instead of replaying an earlier connection or skipping one.
    let listCalls = 0;
    const fetchImpl = fetchRouter([
      {
        match: url => url.includes('/v2/connections?providerKey=incident-io'),
        respond: () => {
          listCalls += 1;
          const connections =
            listCalls > 1
              ? [connection('connection-a', 'acme'), connection('connection-c', 'gamma')]
              : [connection('connection-a', 'acme'), connection('connection-b', 'beta')];
          return json({ connections });
        },
      },
      {
        match: url => url.includes('/connection-a/proxy/v2/incidents'),
        respond: () => json({ incidents: [incident], pagination_meta: {} }),
      },
      {
        match: url => url.includes('/connection-c/proxy/v2/incidents'),
        respond: () =>
          json({ incidents: [{ ...incident, id: 'incident-3', reference: 'INC-99' }], pagination_meta: {} }),
      },
    ]);
    const integration = new PlatformIncidentioIntegration({
      clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-secret', fetchImpl },
    });
    const sourceIds = [
      encodeScopedSourceId('connection-a', INCIDENTIO_INCIDENTS_SOURCE_ID),
      encodeScopedSourceId('connection-b', INCIDENTIO_INCIDENTS_SOURCE_ID),
      encodeScopedSourceId('connection-c', INCIDENTIO_INCIDENTS_SOURCE_ID),
    ];

    const first = await integration.intake.listItems({ orgId: 'org-1', userId: 'user-1', sourceIds });
    expect(first.items).toEqual([
      expect.objectContaining({ metadata: expect.objectContaining({ connectionId: 'connection-a' }) }),
    ]);

    // The cursor points at connection-b, which is gone by the second page;
    // paging resumes at connection-c (its sorted successor), never back at
    // connection-a.
    const second = await integration.intake.listItems({
      orgId: 'org-1',
      userId: 'user-1',
      sourceIds,
      cursor: first.nextCursor!,
    });
    expect(second.items).toEqual([
      expect.objectContaining({
        title: 'INC-99: API unavailable',
        metadata: expect.objectContaining({ connectionId: 'connection-c' }),
      }),
    ]);
    expect(second.nextCursor).toBeNull();
  });

  it('resolves dispatches against the sole connection and keeps Platform credentials out of Intake connections', async () => {
    const fetchImpl = fetchRouter([
      {
        match: url => url.includes('/v2/connections?providerKey=incident-io'),
        respond: () => json({ connections: [connection('connection-1', 'acme')] }),
      },
      {
        match: url => url.includes('/proxy/v2/incidents'),
        respond: () => json({ incidents: [], pagination_meta: {} }),
      },
    ]);
    const integration = new PlatformIncidentioIntegration({
      clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-secret', fetchImpl },
    });

    const resolved = await integration.intake.resolveIntakeDispatch!({
      orgId: 'org-1',
      externalSource: { type: 'issue', externalId: 'incidentio:incident:incident-1' },
    });
    expect(resolved).toEqual({
      connection: { type: 'oauth', accessToken: 'incidentio-connection:connection-1' },
      sourceId: encodeScopedSourceId('connection-1', INCIDENTIO_INCIDENTS_SOURCE_ID),
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

  it('probes each connection to resolve a dispatch when multiple accounts are connected', async () => {
    const fetchImpl = fetchRouter([
      {
        match: url => url.includes('/v2/connections?providerKey=incident-io'),
        respond: () => json({ connections: [connection('connection-a', 'acme'), connection('connection-b', 'beta')] }),
      },
      {
        match: url => url.includes('/connection-a/proxy/v2/incidents/incident-1'),
        respond: () => json({ type: 'not_found' }, 404),
      },
      {
        match: url => url.includes('/connection-b/proxy/v2/incidents/incident-1'),
        respond: () => json({ incident }),
      },
    ]);
    const integration = new PlatformIncidentioIntegration({
      clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-secret', fetchImpl },
    });

    const resolved = await integration.intake.resolveIntakeDispatch!({
      orgId: 'org-1',
      externalSource: { type: 'issue', externalId: 'incidentio:incident:incident-1' },
    });
    expect(resolved).toEqual(
      expect.objectContaining({
        connection: { type: 'oauth', accessToken: 'incidentio-connection:connection-b' },
        issueId: 'incidentio:incident:incident-1',
      }),
    );
  });

  it('reads issues through the connection encoded in the Intake connection token', async () => {
    const fetchImpl = fetchRouter([
      {
        match: url => url.includes('/v2/connections?providerKey=incident-io'),
        respond: () => json({ connections: [connection('connection-a', 'acme'), connection('connection-b', 'beta')] }),
      },
      {
        match: url => url.includes('/connection-b/proxy/v2/incidents/incident-2'),
        respond: () => json({ incident: { ...incident, id: 'incident-2' } }),
      },
    ]);
    const integration = new PlatformIncidentioIntegration({
      clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-secret', fetchImpl },
    });

    const issue = await integration.intake.getIssue({
      connection: { type: 'oauth', accessToken: 'incidentio-connection:connection-b' },
      sourceId: encodeScopedSourceId('connection-b', INCIDENTIO_INCIDENTS_SOURCE_ID),
      issueId: 'incidentio:incident:incident-2',
    });
    expect(issue).toEqual(expect.objectContaining({ identifier: 'INC-42' }));
  });

  it('drops foreign-scoped source ids when the sole-connection fallback resolves the connection', async () => {
    const fetchImpl = fetchRouter([
      {
        match: url => url.includes('/v2/connections?providerKey=incident-io'),
        respond: () => json({ connections: [connection('connection-a', 'acme')] }),
      },
      {
        match: url => url.includes('/connection-a/proxy/v2/incidents'),
        respond: () => json({ incidents: [incident], pagination_meta: {} }),
      },
    ]);
    const integration = new PlatformIncidentioIntegration({
      clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-secret', fetchImpl },
    });

    // No connection id in the token: the fallback resolves the sole active
    // connection. A source id scoped to a different connection must be
    // dropped, not unwrapped and read against connection-a.
    const page = await integration.intake.listIssues({
      connection: { type: 'oauth', accessToken: 'some-legacy-token' },
      sourceIds: [encodeScopedSourceId('connection-gone', INCIDENTIO_INCIDENTS_SOURCE_ID)],
    });
    expect(page.issues).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalledWith(expect.stringContaining('/proxy/v2/incidents'), expect.any(Object));
  });

  it('rejects a connection token whose id is not among the discovered active connections', async () => {
    const fetchImpl = fetchRouter([
      {
        match: url => url.includes('/v2/connections?providerKey=incident-io'),
        respond: () => json({ connections: [connection('connection-a', 'acme')] }),
      },
    ]);
    const integration = new PlatformIncidentioIntegration({
      clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-secret', fetchImpl },
    });

    // A correctly prefixed but foreign token must not mint a proxy request
    // that would ride the Platform bearer credential to another connection.
    await expect(
      integration.intake.getIssue({
        connection: { type: 'oauth', accessToken: 'incidentio-connection:connection-foreign' },
        issueId: 'incidentio:incident:incident-2',
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchImpl).not.toHaveBeenCalledWith(expect.stringContaining('connection-foreign'), expect.any(Object));
  });

  it('rejects ambiguous requests when multiple accounts are connected and no connection is identified', async () => {
    const fetchImpl = fetchRouter([
      {
        match: url => url.includes('/v2/connections?providerKey=incident-io'),
        respond: () => json({ connections: [connection('connection-a'), connection('connection-b')] }),
      },
    ]);
    const integration = new PlatformIncidentioIntegration({
      clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-secret', fetchImpl },
    });

    await expect(
      integration.intake.listIssues({
        connection: { type: 'oauth', accessToken: 'some-foreign-token' },
        sourceIds: [INCIDENTIO_INCIDENTS_SOURCE_ID],
      }),
    ).rejects.toThrow(/identify a connection/);
  });

  it('does not require a deploy-time connection ID', () => {
    vi.stubEnv('MASTRA_SHARED_API_URL', 'https://platform.example.com/v1');
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'platform-secret');
    expect(() => new PlatformIncidentioIntegration()).not.toThrow();
  });
});
