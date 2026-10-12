import type { MastraClient } from '@mastra/client-js';
import type { EntityType } from '@mastra/core/observability';
import type { TraceAggregateRequest, TraceAggregateResponse } from '@mastra/core/storage';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { previousWindow } from './overview-period';
import type { PeriodWindow } from './overview-period';

export interface Latency {
  p95: number | null;
  previousP95: number | null;
}

const P95 = 'duration.p95';

function aggregateTraces(client: MastraClient, window: PeriodWindow, groupBy: string[]) {
  const request: TraceAggregateRequest = {
    timeRange: { from: window.start.toISOString(), to: window.end.toISOString() },
    groupBy,
    measures: [P95],
    limit: 1000,
  };
  return client.request<TraceAggregateResponse>('/observability/traces/aggregate', {
    method: 'POST',
    body: request,
    retries: 0,
  });
}

function p95ByName(response: TraceAggregateResponse, entityType: EntityType) {
  const byName = new Map<string, number | null>();
  for (const row of response.rows) {
    const name = row.dimensions?.entityName;
    if (row.dimensions?.entityType === entityType && name) byName.set(name, row.measures[P95] ?? null);
  }
  return byName;
}

function p95OfType(response: TraceAggregateResponse, entityType: EntityType) {
  return response.rows.find(row => row.dimensions?.entityType === entityType)?.measures[P95] ?? null;
}

async function fetchRootRunLatency(client: MastraClient, entityType: EntityType, window: PeriodWindow) {
  const before = previousWindow(window);
  const [current, previous, currentTotal, previousTotal] = await Promise.all([
    aggregateTraces(client, window, ['entityType', 'entityName']),
    aggregateTraces(client, before, ['entityType', 'entityName']),
    aggregateTraces(client, window, ['entityType']),
    aggregateTraces(client, before, ['entityType']),
  ]);
  const currentByName = p95ByName(current, entityType);
  const previousByName = p95ByName(previous, entityType);
  const byName = new Map<string, Latency>();
  for (const [name, p95] of currentByName) byName.set(name, { p95, previousP95: previousByName.get(name) ?? null });
  const total: Latency = {
    p95: p95OfType(currentTotal, entityType),
    previousP95: p95OfType(previousTotal, entityType),
  };
  return { byName, total };
}

// Storages without trace aggregation answer 501: the query errors and callers drop the p95 column.
export function useRootRunLatency({
  entityType,
  window,
  windowKey,
  enabled,
}: {
  entityType: EntityType;
  window: PeriodWindow;
  windowKey: string;
  enabled: boolean;
}) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['overview', 'root-run-latency', entityType, windowKey],
    queryFn: () => fetchRootRunLatency(client, entityType, window),
    enabled,
    retry: false,
  });
}
