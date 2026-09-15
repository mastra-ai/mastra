import { describe, expect, it } from 'vitest';
import { buildTraceQueryRequest, TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS } from './trace-query-filters';

const now = new Date('2026-09-15T12:00:00Z');

describe('buildTraceQueryRequest', () => {
  it('defaults to the last seven days without an empty predicate', () => {
    expect(buildTraceQueryRequest({ tokens: [], now })).toEqual({
      timeRange: { from: '2026-09-08T12:00:00.000Z', to: now.toISOString() },
    });
  });

  it.each(['entityType', 'rootEntityType', 'entityName', 'environment', 'traceId', 'threadId', 'resourceId', 'status'])(
    'serializes single and multiple %s values',
    fieldId => {
      const path = fieldId === 'rootEntityType' ? 'entityType' : fieldId;
      expect(buildTraceQueryRequest({ tokens: [{ fieldId, value: 'success' }], now })?.where).toEqual({
        op: 'and',
        args: [{ op: 'eq', left: { path }, right: { literal: 'success' } }],
      });
      expect(buildTraceQueryRequest({ tokens: [{ fieldId, value: ['success', 'error'] }], now })?.where).toEqual({
        op: 'and',
        args: [{ op: 'in', value: { path }, set: ['success', 'error'] }],
      });
    },
  );

  it('queries entity IDs through related spans', () => {
    expect(buildTraceQueryRequest({ tokens: [{ fieldId: 'entityId', value: 'agent-1' }], now })?.where).toEqual({
      op: 'and',
      args: [{ spans: { some: { op: 'eq', left: { path: 'entityId' }, right: { literal: 'agent-1' } } } }],
    });
  });

  it.each([...TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS])('falls back for active %s filters', fieldId => {
    expect(buildTraceQueryRequest({ tokens: [{ fieldId, value: 'value' }], now })).toBeNull();
    expect(buildTraceQueryRequest({ tokens: [{ fieldId, value: 'Any' }], now })).not.toBeNull();
  });

  it('falls back for running roots and running status tokens', () => {
    expect(buildTraceQueryRequest({ tokens: [], status: 'running', now })).toBeNull();
    expect(buildTraceQueryRequest({ tokens: [{ fieldId: 'status', value: ['success', 'running'] }], now })).toBeNull();
  });

  it('preserves explicit dates and root filters', () => {
    const dateFrom = new Date('2026-09-01T00:00:00Z');
    expect(
      buildTraceQueryRequest({ tokens: [], rootEntityType: 'agent', status: 'error', dateFrom, dateTo: now, now }),
    ).toEqual({
      timeRange: { from: dateFrom.toISOString(), to: now.toISOString() },
      where: {
        op: 'and',
        args: [
          { op: 'eq', left: { path: 'entityType' }, right: { literal: 'agent' } },
          { op: 'eq', left: { path: 'status' }, right: { literal: 'error' } },
        ],
      },
    });
  });
});
