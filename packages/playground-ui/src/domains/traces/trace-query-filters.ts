import type { QueryTracesInput } from '@mastra/client-js';
import type { TraceQueryPredicate, TraceQueryScalarPredicate } from '@mastra/core/storage';
import type { buildTraceListFilters } from './trace-filters';

export const TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS = new Set([
  'tags',
  'runId',
  'sessionId',
  'requestId',
  'userId',
  'organizationId',
  'serviceName',
  'experimentId',
]);

export function buildTraceQueryRequest({
  rootEntityType,
  status,
  dateFrom,
  dateTo,
  tokens,
  now,
}: Parameters<typeof buildTraceListFilters>[0] & { now: Date }): Pick<QueryTracesInput, 'timeRange' | 'where'> {
  const args: TraceQueryPredicate[] = [];
  const predicate = (path: string, values: string[]): TraceQueryScalarPredicate =>
    values.length === 1 && values[0] !== undefined
      ? { op: 'eq', left: { path }, right: { literal: values[0] } }
      : { op: 'in', value: { path }, set: values };

  if (rootEntityType) args.push(predicate('entityType', [rootEntityType]));
  if (status && status !== 'running') args.push(predicate('status', [status]));

  for (const token of tokens) {
    const values = (Array.isArray(token.value) ? token.value : [token.value]).filter(
      (value): value is string => typeof value === 'string' && Boolean(value.trim()) && value !== 'Any',
    );
    if (!values.length) continue;
    if (TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS.has(token.fieldId)) continue;
    // Discovered metadata fields: the field id is already the predicate path (`metadata.<key>`).
    if (token.fieldId.startsWith('metadata.') && token.fieldId.length > 'metadata.'.length) {
      args.push(predicate(token.fieldId, values));
      continue;
    }
    switch (token.fieldId) {
      case 'entityId':
        // The query API matches entity IDs on any span, not only the root span.
        args.push({ spans: { some: predicate('entityId', values) } });
        break;
      case 'rootEntityType':
      case 'entityType':
        args.push(predicate('entityType', values));
        break;
      case 'status': {
        const supportedStatuses = values.filter(value => value !== 'running');
        if (supportedStatuses.length) args.push(predicate('status', supportedStatuses));
        break;
      }
      case 'entityName':
      case 'environment':
      case 'traceId':
      case 'threadId':
      case 'resourceId':
        args.push(predicate(token.fieldId, values));
        break;
      default:
        break;
    }
  }

  return {
    timeRange: {
      from: (dateFrom ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).toISOString(),
      to: (dateTo ?? now).toISOString(),
    },
    ...(args.length ? { where: { op: 'and' as const, args } } : {}),
  };
}

export const TRACE_QUERY_DISCOVERY_MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

/** Discovery endpoints reject ranges wider than 31 days (and `from >= to`); clamp
 *  the page's selected range so wide custom ranges still get field suggestions
 *  for the most recent window. */
export function clampTraceDiscoveryTimeRange(timeRange: { from: string; to: string }): { from: string; to: string } {
  const to = new Date(timeRange.to).getTime();
  const from = new Date(timeRange.from).getTime();
  const minFrom = to - TRACE_QUERY_DISCOVERY_MAX_RANGE_MS;
  if (from >= minFrom && from < to) return timeRange;
  return { from: new Date(minFrom).toISOString(), to: timeRange.to };
}
