import type { TraceQueryPredicate, TraceQueryRequest, TraceQueryScalarPredicate } from '@mastra/core/storage';
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
}: Parameters<typeof buildTraceListFilters>[0] & { now: Date }): Pick<TraceQueryRequest, 'timeRange' | 'where'> {
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
    switch (token.fieldId) {
      case 'entityId':
        // The query API matches entity IDs on any span, not only the root span.
        args.push({ spans: { some: predicate('entityId', values) } });
        break;
      case 'rootEntityType':
      case 'entityType':
        args.push(predicate('entityType', values));
        break;
      case 'status':
        if (values.includes('running')) break;
        args.push(predicate('status', values));
        break;
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
