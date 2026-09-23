import { describe, expect, it, vi } from 'vitest';

import { IncidentioApiClient } from './api.js';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function requestUrl(fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>, call = 0): URL {
  return new URL(String(fetchImpl.mock.calls[call]?.[0]));
}

describe('IncidentioApiClient additional API surfaces', () => {
  it('lists actions with incident filters and normalized pagination', async () => {
    const action = { id: 'action-1', description: 'Roll back the release' };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      json({ actions: [action], pagination_meta: { after: 'action-next', total_record_count: 12 } }),
    );
    const client = new IncidentioApiClient({
      baseUrl: 'https://api.incident.test/',
      accessToken: 'incident-key',
      fetchImpl,
    });

    await expect(
      client.listActions({
        cursor: 'action-cursor',
        pageSize: 42,
        incidentId: 'incident-1',
        incidentMode: 'retrospective',
      }),
    ).resolves.toEqual({ items: [action], nextCursor: 'action-next', total: 12 });

    expect(requestUrl(fetchImpl).pathname).toBe('/v3/actions');
    expect(Object.fromEntries(requestUrl(fetchImpl).searchParams)).toEqual({
      page_size: '42',
      after: 'action-cursor',
      incident_id: 'incident-1',
      incident_mode: 'retrospective',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ authorization: 'Bearer incident-key' }),
      }),
    );
  });

  it('lists incident updates with an optional incident filter', async () => {
    const update = { id: 'update-1', message: 'Mitigation deployed' };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ incident_updates: [update], pagination_meta: { after: 'update-next' } }));
    const client = new IncidentioApiClient({ baseUrl: 'https://api.incident.test', accessToken: 'key', fetchImpl });

    await expect(
      client.listIncidentUpdates({ cursor: 'update-cursor', pageSize: 30, incidentId: 'incident-1' }),
    ).resolves.toEqual({ items: [update], nextCursor: 'update-next' });

    expect(requestUrl(fetchImpl).pathname).toBe('/v2/incident_updates');
    expect(Object.fromEntries(requestUrl(fetchImpl).searchParams)).toEqual({
      page_size: '30',
      after: 'update-cursor',
      incident_id: 'incident-1',
    });
  });

  it('lists alerts, escalations, teams, schedules, and policy findings', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ alerts: [{ id: 'alert-1' }], pagination_meta: { after: 'alert-next' } }))
      .mockResolvedValueOnce(
        json({ escalations: [{ id: 'escalation-1' }], pagination_meta: { after: 'escalation-next' } }),
      )
      .mockResolvedValueOnce(json({ teams: [{ id: 'team-1' }], pagination_meta: { after: 'team-next' } }))
      .mockResolvedValueOnce(
        json({
          schedules: [{ id: 'schedule-1' }],
          pagination_meta: { after: 'schedule-next', total_record_count: 7 },
        }),
      )
      .mockResolvedValueOnce(
        json({ policy_findings: [{ id: 'finding-1' }], pagination_meta: { after: 'finding-next' } }),
      );
    const client = new IncidentioApiClient({ baseUrl: 'https://api.incident.test', accessToken: 'key', fetchImpl });

    await expect(client.listAlerts({ cursor: 'alert-cursor' })).resolves.toEqual({
      items: [{ id: 'alert-1' }],
      nextCursor: 'alert-next',
    });
    await expect(client.listEscalations({ cursor: 'escalation-cursor' })).resolves.toEqual({
      items: [{ id: 'escalation-1' }],
      nextCursor: 'escalation-next',
    });
    await expect(client.listTeams({ cursor: 'team-cursor' })).resolves.toEqual({
      items: [{ id: 'team-1' }],
      nextCursor: 'team-next',
    });
    await expect(client.listSchedules({ cursor: 'schedule-cursor' })).resolves.toEqual({
      items: [{ id: 'schedule-1' }],
      nextCursor: 'schedule-next',
      total: 7,
    });
    await expect(client.listPolicyFindings({ cursor: 'finding-cursor', policyId: 'policy-1' })).resolves.toEqual({
      items: [{ id: 'finding-1' }],
      nextCursor: 'finding-next',
    });

    expect(fetchImpl.mock.calls.map((_, index) => requestUrl(fetchImpl, index).pathname)).toEqual([
      '/v2/alerts',
      '/v2/escalations',
      '/v3/teams',
      '/v2/schedules',
      '/v2/policy_findings',
    ]);
    expect(requestUrl(fetchImpl, 0).searchParams.get('page_size')).toBe('50');
    expect(requestUrl(fetchImpl, 1).searchParams.get('page_size')).toBe('50');
    expect(requestUrl(fetchImpl, 2).searchParams.get('page_size')).toBe('100');
    expect(requestUrl(fetchImpl, 3).searchParams.get('page_size')).toBe('25');
    expect(requestUrl(fetchImpl, 4).searchParams.get('policy_id')).toBe('policy-1');
  });

  it('reads catalog entries, types, and resources', async () => {
    const catalogEntry = { id: 'entry-1', name: 'Payments API' };
    const catalogType = { id: 'type-1', name: 'Service' };
    const catalogResource = { type: 'CatalogEntry', label: 'Catalog entry' };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({
          catalog_entries: [catalogEntry],
          catalog_type: catalogType,
          pagination_meta: { after: 'entry-next', total_record_count: 99 },
        }),
      )
      .mockResolvedValueOnce(json({ catalog_entry: catalogEntry, catalog_type: catalogType }))
      .mockResolvedValueOnce(json({ catalog_types: [catalogType] }))
      .mockResolvedValueOnce(json({ catalog_type: catalogType }))
      .mockResolvedValueOnce(json({ resources: [catalogResource] }));
    const client = new IncidentioApiClient({ baseUrl: 'https://api.incident.test', accessToken: 'key', fetchImpl });

    await expect(
      client.listCatalogEntries('type/1', { cursor: 'entry-cursor', pageSize: 20, identifier: 'payments' }),
    ).resolves.toEqual({
      items: [catalogEntry],
      nextCursor: 'entry-next',
      total: 99,
      catalogType,
    });
    await expect(client.getCatalogEntry('entry/1', { expand: true })).resolves.toEqual({
      entry: catalogEntry,
      catalogType,
    });
    await expect(client.listCatalogTypes()).resolves.toEqual([catalogType]);
    await expect(client.getCatalogType('type/1')).resolves.toEqual(catalogType);
    await expect(client.listCatalogResources()).resolves.toEqual([catalogResource]);

    expect(requestUrl(fetchImpl, 0).pathname).toBe('/v3/catalog_entries');
    expect(Object.fromEntries(requestUrl(fetchImpl, 0).searchParams)).toEqual({
      catalog_type_id: 'type/1',
      page_size: '20',
      after: 'entry-cursor',
      identifier: 'payments',
    });
    expect(requestUrl(fetchImpl, 1).pathname).toBe('/v3/catalog_entries/entry%2F1');
    expect(requestUrl(fetchImpl, 1).searchParams.get('expand')).toBe('true');
    expect(requestUrl(fetchImpl, 2).pathname).toBe('/v3/catalog_types');
    expect(requestUrl(fetchImpl, 3).pathname).toBe('/v3/catalog_types/type%2F1');
    expect(requestUrl(fetchImpl, 4).pathname).toBe('/v3/catalog_resources');
  });

  it.each([
    ['action', 'getAction', '/v3/actions/resource%2F1', 'action'],
    ['alert', 'getAlert', '/v2/alerts/resource%2F1', 'alert'],
    ['escalation', 'getEscalation', '/v2/escalations/resource%2F1', 'escalation'],
    ['team', 'getTeam', '/v3/teams/resource%2F1', 'team'],
    ['schedule', 'getSchedule', '/v2/schedules/resource%2F1', 'schedule'],
    ['policy finding', 'getPolicyFinding', '/v2/policy_findings/resource%2F1', 'policy_finding'],
  ] as const)('gets an encoded %s resource', async (_label, method, expectedPath, responseKey) => {
    const resource = { id: 'resource/1' };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ [responseKey]: resource }));
    const client = new IncidentioApiClient({ baseUrl: 'https://api.incident.test', accessToken: 'key', fetchImpl });

    await expect(client[method]('resource/1') as Promise<unknown>).resolves.toEqual(resource);
    expect(requestUrl(fetchImpl).pathname).toBe(expectedPath);
  });
});
