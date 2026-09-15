import { EntityType } from '@mastra/core/observability';
import { describe, it, expect } from 'vitest';

import { buildLogsDrilldownUrl, buildTracesDrilldownUrl, narrowWindowToBucket } from './drilldown';

function parseUrl(url: string) {
  const [path, qs = ''] = url.split('?');
  return { path, params: new URLSearchParams(qs) };
}

describe('buildTracesDrilldownUrl', () => {
  it('maps metrics preset → traces preset', () => {
    const url = buildTracesDrilldownUrl({
      preset: '24h',
      dashboardFilter: {},
      scope: {},
    });
    const { path, params } = parseUrl(url);
    expect(path).toBe('/traces');
    expect(params.get('datePreset')).toBe('last-24h');
  });

  it('maps all supported presets', () => {
    for (const [metricsPreset, tracesPreset] of [
      ['24h', 'last-24h'],
      ['3d', 'last-3d'],
      ['7d', 'last-7d'],
      ['14d', 'last-14d'],
      ['30d', 'last-30d'],
    ] as const) {
      const url = buildTracesDrilldownUrl({
        preset: metricsPreset,
        dashboardFilter: {},
        scope: {},
      });
      expect(parseUrl(url).params.get('datePreset')).toBe(tracesPreset);
    }
  });

  it('uses customRange when preset is custom', () => {
    const from = new Date('2024-01-01T00:00:00Z');
    const to = new Date('2024-01-02T00:00:00Z');
    const url = buildTracesDrilldownUrl({
      preset: 'custom',
      customRange: { from, to },
      dashboardFilter: {},
      scope: {},
    });
    const { params } = parseUrl(url);
    expect(params.get('datePreset')).toBe('custom');
    expect(params.get('dateFrom')).toBe(from.toISOString());
    expect(params.get('dateTo')).toBe(to.toISOString());
  });

  it('uses a node-level window when scope.window is provided (overrides preset)', () => {
    const from = new Date('2024-01-01T14:00:00Z');
    const to = new Date('2024-01-01T15:00:00Z');
    const url = buildTracesDrilldownUrl({
      preset: '7d',
      dashboardFilter: {},
      scope: { window: { from, to } },
    });
    const { params } = parseUrl(url);
    expect(params.get('datePreset')).toBe('custom');
    expect(params.get('dateFrom')).toBe(from.toISOString());
    expect(params.get('dateTo')).toBe(to.toISOString());
  });

  it('carries dashboard dimensional filters through', () => {
    const url = buildTracesDrilldownUrl({
      preset: '24h',
      dashboardFilter: {
        environment: 'prod',
        tags: ['billing', 'retry'],
        serviceName: 'orders',
      },
      scope: {},
    });
    const { params } = parseUrl(url);
    expect(params.get('filterEnvironment')).toBe('prod');
    expect(params.getAll('filterTags')).toEqual(['billing', 'retry']);
    expect(params.get('filterServiceName')).toBe('orders');
  });

  it('scope dimensions override dashboard dimensions', () => {
    const url = buildTracesDrilldownUrl({
      preset: '24h',
      dashboardFilter: { entityName: 'analyst', environment: 'prod' },
      scope: { entityName: 'researcher', rootEntityType: EntityType.AGENT },
    });
    const { params } = parseUrl(url);
    expect(params.get('filterEntityName')).toBe('researcher');
    expect(params.get('rootEntityType')).toBe(EntityType.AGENT);
    // Dashboard-only dim still carried.
    expect(params.get('filterEnvironment')).toBe('prod');
  });

  it('emits status=error on traces drilldowns', () => {
    const url = buildTracesDrilldownUrl({
      preset: '24h',
      dashboardFilter: {},
      scope: { status: 'error', entityName: 'researcher', rootEntityType: EntityType.AGENT },
    });
    const { path, params } = parseUrl(url);
    expect(path).toBe('/traces');
    expect(params.get('status')).toBe('error');
    expect(params.get('filterEntityName')).toBe('researcher');
  });

  it('emits threadId + resourceId', () => {
    const url = buildTracesDrilldownUrl({
      preset: '24h',
      dashboardFilter: {},
      scope: { threadId: 'thread-abc', resourceId: 'resource-xyz' },
    });
    const { params } = parseUrl(url);
    expect(params.get('filterThreadId')).toBe('thread-abc');
    expect(params.get('filterResourceId')).toBe('resource-xyz');
  });

  it('escapes reserved URL chars in filter values', () => {
    const url = buildTracesDrilldownUrl({
      preset: '24h',
      dashboardFilter: {},
      scope: { entityName: 'name with spaces & ampersand' },
    });
    expect(parseUrl(url).params.get('filterEntityName')).toBe('name with spaces & ampersand');
  });

  it('lists traces in branch mode', () => {
    expect(
      parseUrl(buildTracesDrilldownUrl({ preset: '24h', dashboardFilter: {}, scope: {} })).params.get('listMode'),
    ).toBe('branches');
  });

  it('honours a custom traces base path', () => {
    const url = buildTracesDrilldownUrl({
      preset: '24h',
      dashboardFilter: {},
      scope: {},
      tracesBasePath: '/app/observability/traces',
    });
    expect(parseUrl(url).path).toBe('/app/observability/traces');
  });

  it('carries every dashboard dimensional filter through', () => {
    const url = buildTracesDrilldownUrl({
      preset: '24h',
      dashboardFilter: {
        entityName: 'analyst',
        entityId: 'entity-1',
        threadId: 'thread-1',
        resourceId: 'resource-1',
        runId: 'run-1',
        sessionId: 'session-1',
        requestId: 'request-1',
        userId: 'user-1',
        organizationId: 'org-1',
        experimentId: 'experiment-1',
        serviceName: 'orders',
        environment: 'prod',
        tags: ['billing'],
      },
      scope: {},
    });
    const { params } = parseUrl(url);

    expect(Object.fromEntries([...params].filter(([key]) => key.startsWith('filter')))).toEqual({
      filterEntityName: 'analyst',
      filterEntityId: 'entity-1',
      filterThreadId: 'thread-1',
      filterResourceId: 'resource-1',
      filterRunId: 'run-1',
      filterSessionId: 'session-1',
      filterRequestId: 'request-1',
      filterUserId: 'user-1',
      filterOrganizationId: 'org-1',
      filterExperimentId: 'experiment-1',
      filterServiceName: 'orders',
      filterEnvironment: 'prod',
      filterTags: 'billing',
    });
  });

  it('omits filters that are absent or empty', () => {
    const url = buildTracesDrilldownUrl({
      preset: '24h',
      dashboardFilter: { entityName: '', serviceName: undefined, tags: [] },
      scope: {},
    });
    const { params } = parseUrl(url);

    expect([...params.keys()].filter(key => key.startsWith('filter'))).toEqual([]);
  });

  it('drops blank tags rather than emitting empty values', () => {
    const url = buildTracesDrilldownUrl({
      preset: '24h',
      dashboardFilter: { tags: ['billing', '', 'retry'] },
      scope: {},
    });

    expect(parseUrl(url).params.getAll('filterTags')).toEqual(['billing', 'retry']);
  });

  it('omits the status filter unless the card scopes one', () => {
    const url = buildTracesDrilldownUrl({ preset: '24h', dashboardFilter: {}, scope: {} });
    expect(parseUrl(url).params.get('status')).toBeNull();
  });

  it('omits the root entity type when neither the card nor the dashboard sets one', () => {
    const url = buildTracesDrilldownUrl({ preset: '24h', dashboardFilter: {}, scope: {} });
    expect(parseUrl(url).params.get('rootEntityType')).toBeNull();
  });

  it('emits only the custom bounds that are known', () => {
    const from = new Date('2024-01-01T00:00:00Z');

    const onlyFrom = parseUrl(
      buildTracesDrilldownUrl({ preset: 'custom', customRange: { from }, dashboardFilter: {}, scope: {} }),
    ).params;
    expect(onlyFrom.get('datePreset')).toBe('custom');
    expect(onlyFrom.get('dateFrom')).toBe(from.toISOString());
    expect(onlyFrom.get('dateTo')).toBeNull();

    const noRange = parseUrl(buildTracesDrilldownUrl({ preset: 'custom', dashboardFilter: {}, scope: {} })).params;
    expect(noRange.get('datePreset')).toBe('custom');
    expect(noRange.get('dateFrom')).toBeNull();
  });

  it('omits the date preset when it cannot be translated', () => {
    const url = buildTracesDrilldownUrl({
      preset: 'all-time' as never,
      dashboardFilter: {},
      scope: {},
    });
    const { params } = parseUrl(url);

    expect(params.get('datePreset')).toBeNull();
    // The list mode is still set, so the path keeps a query string.
    expect(params.get('listMode')).toBe('branches');
  });
});

describe('buildLogsDrilldownUrl', () => {
  it('translates status: error → filterLevel=error', () => {
    const url = buildLogsDrilldownUrl({
      preset: '24h',
      dashboardFilter: {},
      scope: { status: 'error', rootEntityType: EntityType.AGENT },
    });
    const { path, params } = parseUrl(url);
    expect(path).toBe('/logs');
    expect(params.get('filterLevel')).toBe('error');
    expect(params.get('rootEntityType')).toBe(EntityType.AGENT);
  });

  it('never emits `status` param for logs', () => {
    const url = buildLogsDrilldownUrl({
      preset: '24h',
      dashboardFilter: {},
      scope: { status: 'error' },
    });
    expect(parseUrl(url).params.get('status')).toBeNull();
  });

  it('honours a custom logs base path', () => {
    const url = buildLogsDrilldownUrl({
      preset: '24h',
      dashboardFilter: {},
      scope: {},
      logsBasePath: '/app/observability/logs',
    });
    expect(parseUrl(url).path).toBe('/app/observability/logs');
  });

  it('falls back to a bare path when nothing can be filtered', () => {
    expect(buildLogsDrilldownUrl({ preset: 'all-time' as never, dashboardFilter: {}, scope: {} })).toBe('/logs');
  });

  it('carries every dashboard dimensional filter through', () => {
    const url = buildLogsDrilldownUrl({
      preset: '24h',
      dashboardFilter: {
        entityName: 'analyst',
        threadId: 'thread-1',
        resourceId: 'resource-1',
        runId: 'run-1',
        sessionId: 'session-1',
        requestId: 'request-1',
        userId: 'user-1',
        organizationId: 'org-1',
        experimentId: 'experiment-1',
        serviceName: 'orders',
        environment: 'prod',
        tags: ['billing'],
      },
      scope: {},
    });
    const { params } = parseUrl(url);

    expect(Object.fromEntries([...params].filter(([key]) => key.startsWith('filter')))).toEqual({
      filterEntityName: 'analyst',
      filterThreadId: 'thread-1',
      filterResourceId: 'resource-1',
      filterRunId: 'run-1',
      filterSessionId: 'session-1',
      filterRequestId: 'request-1',
      filterUserId: 'user-1',
      filterOrganizationId: 'org-1',
      filterExperimentId: 'experiment-1',
      filterServiceName: 'orders',
      filterEnvironment: 'prod',
      filterTags: 'billing',
    });
  });

  it('lets the card scope override the dashboard dimensions', () => {
    const url = buildLogsDrilldownUrl({
      preset: '24h',
      dashboardFilter: { entityName: 'analyst', threadId: 'thread-1', resourceId: 'resource-1' },
      scope: { entityName: 'researcher', threadId: 'thread-2', resourceId: 'resource-2' },
    });
    const { params } = parseUrl(url);

    expect(params.get('filterEntityName')).toBe('researcher');
    expect(params.get('filterThreadId')).toBe('thread-2');
    expect(params.get('filterResourceId')).toBe('resource-2');
  });

  it('only translates an error status into a level filter', () => {
    for (const status of ['running', 'success'] as const) {
      const url = buildLogsDrilldownUrl({ preset: '24h', dashboardFilter: {}, scope: { status } });
      expect(parseUrl(url).params.get('filterLevel')).toBeNull();
    }
  });

  it('uses a node-level window when the card scopes one', () => {
    const from = new Date('2024-01-01T14:00:00Z');
    const to = new Date('2024-01-01T15:00:00Z');
    const url = buildLogsDrilldownUrl({
      preset: '7d',
      dashboardFilter: {},
      scope: { window: { from, to } },
    });
    const { params } = parseUrl(url);

    expect(params.get('datePreset')).toBe('custom');
    expect(params.get('dateFrom')).toBe(from.toISOString());
    expect(params.get('dateTo')).toBe(to.toISOString());
  });
});

describe('narrowWindowToBucket', () => {
  it('narrows to the surrounding UTC hour for 1h interval', () => {
    const ts = Date.UTC(2024, 0, 1, 14, 37, 12);
    const { from, to } = narrowWindowToBucket(ts, '1h');
    expect(from.toISOString()).toBe('2024-01-01T14:00:00.000Z');
    expect(to.toISOString()).toBe('2024-01-01T15:00:00.000Z');
    expect(to.getTime() - from.getTime()).toBe(60 * 60 * 1000);
  });

  it('narrows to the surrounding UTC day for 1d interval', () => {
    const ts = Date.UTC(2024, 0, 1, 14, 37, 12);
    const { from, to } = narrowWindowToBucket(ts, '1d');
    expect(from.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(to.toISOString()).toBe('2024-01-02T00:00:00.000Z');
  });
});
