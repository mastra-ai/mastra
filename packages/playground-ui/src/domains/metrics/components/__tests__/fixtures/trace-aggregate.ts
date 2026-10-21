import type { AggregateTracesResponse, GetObservabilityCapabilitiesResponse } from '@mastra/client-js';

const baseCapabilities: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityStorageDuckDB',
  capabilities: {
    metrics: true,
    logs: true,
    discovery: {
      entityTypes: true,
      entityNames: true,
      serviceNames: true,
      environments: true,
      tags: true,
      metrics: true,
    },
    deltaPolling: true,
    traceQuery: true,
    traceQueryRootDuration: true,
    traceQueryDiscovery: true,
    traceQueryTenantScope: true,
    threadQuery: true,
    spanQuery: true,
    feedback: true,
  },
};

/** A server that answers `aggregateTraces()`, including root span fields. */
export const traceAggregateCapabilities: GetObservabilityCapabilitiesResponse = {
  ...baseCapabilities,
  capabilities: { ...baseCapabilities.capabilities, traceAggregate: true, traceQueryRootSpanFields: true },
};

/** A server from before trace aggregation: no `traceAggregate` capability at all. */
export const olderServerCapabilities: GetObservabilityCapabilitiesResponse = baseCapabilities;

export const emptyTraceAggregateFixture: AggregateTracesResponse = { rows: [], truncated: false };

export const traceAggregateErrorFixture = { error: 'Trace aggregation failed' };

const HOUR = 60 * 60 * 1000;

const hourBefore = (timeRange: { to: string }, hoursAgo: number) =>
  new Date((Math.floor(Date.parse(timeRange.to) / HOUR) - hoursAgo) * HOUR).toISOString();

/** Two hourly buckets from an app that sets resource and thread ids only: 3 + 4 resources per bucket, but 5 over the range. */
export function distinctIdsSeriesFixture(timeRange: { to: string }): AggregateTracesResponse {
  return {
    rows: [
      {
        bucket: hourBefore(timeRange, 2),
        measures: {
          'countDistinct.resourceId': 3,
          'countDistinct.threadId': 6,
          'countDistinct.userId': 0,
          'countDistinct.sessionId': 0,
        },
      },
      {
        bucket: hourBefore(timeRange, 1),
        measures: {
          'countDistinct.resourceId': 4,
          'countDistinct.threadId': 9,
          'countDistinct.userId': 0,
          'countDistinct.sessionId': 0,
        },
      },
    ],
    truncated: false,
  };
}

export const distinctIdsTotalsFixture: AggregateTracesResponse = {
  rows: [
    {
      measures: {
        'countDistinct.resourceId': 5,
        'countDistinct.threadId': 14,
        'countDistinct.userId': 0,
        'countDistinct.sessionId': 0,
      },
    },
  ],
  truncated: false,
};

/** Range totals from an app that also sets user and session ids. */
export const distinctIdsWithUsersTotalsFixture: AggregateTracesResponse = {
  rows: [
    {
      measures: {
        'countDistinct.resourceId': 5,
        'countDistinct.threadId': 14,
        'countDistinct.userId': 2,
        'countDistinct.sessionId': 3,
      },
    },
  ],
  truncated: false,
};
