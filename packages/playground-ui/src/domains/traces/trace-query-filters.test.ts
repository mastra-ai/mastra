import { describe, expect, it } from 'vitest';
import {
  buildTraceQueryRequest,
  clampTraceDiscoveryTimeRange,
  TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS,
} from './trace-query-filters';

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

  it.each([...TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS])('ignores obsolete %s filters', fieldId => {
    expect(buildTraceQueryRequest({ tokens: [{ fieldId, value: 'value' }], now }).where).toBeUndefined();
  });

  it('ignores unsupported running status filters', () => {
    expect(buildTraceQueryRequest({ tokens: [], status: 'running', now }).where).toBeUndefined();
    expect(buildTraceQueryRequest({ tokens: [{ fieldId: 'status', value: ['running'] }], now }).where).toBeUndefined();
  });

  it('retains error when mixed with running', () => {
    expect(buildTraceQueryRequest({ tokens: [{ fieldId: 'status', value: ['running', 'error'] }], now }).where).toEqual(
      {
        op: 'and',
        args: [{ op: 'eq', left: { path: 'status' }, right: { literal: 'error' } }],
      },
    );
  });

  it('retains all supported statuses when mixed with running', () => {
    expect(
      buildTraceQueryRequest({ tokens: [{ fieldId: 'status', value: ['running', 'success', 'error'] }], now }).where,
    ).toEqual({
      op: 'and',
      args: [{ op: 'in', value: { path: 'status' }, set: ['success', 'error'] }],
    });
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

  it('turns discovered metadata tokens into predicates on the metadata path', () => {
    expect(buildTraceQueryRequest({ tokens: [{ fieldId: 'metadata.region', value: 'eu-west' }], now })?.where).toEqual({
      op: 'and',
      args: [{ op: 'eq', left: { path: 'metadata.region' }, right: { literal: 'eu-west' } }],
    });
    expect(
      buildTraceQueryRequest({ tokens: [{ fieldId: 'metadata.region', value: ['eu-west', 'us-east'] }], now })?.where,
    ).toEqual({
      op: 'and',
      args: [{ op: 'in', value: { path: 'metadata.region' }, set: ['eu-west', 'us-east'] }],
    });
  });

  it('drops a bare metadata prefix with no key', () => {
    expect(buildTraceQueryRequest({ tokens: [{ fieldId: 'metadata.', value: 'x' }], now }).where).toBeUndefined();
  });
});

describe('clampTraceDiscoveryTimeRange', () => {
  const to = '2026-09-15T12:00:00.000Z';

  it('keeps ranges of 31 days or less untouched', () => {
    const range = { from: '2026-09-01T00:00:00.000Z', to };
    expect(clampTraceDiscoveryTimeRange(range)).toBe(range);
  });

  it('clamps wider ranges to the 31 days ending at to', () => {
    expect(clampTraceDiscoveryTimeRange({ from: '2026-01-01T00:00:00.000Z', to })).toEqual({
      from: '2026-08-15T12:00:00.000Z',
      to,
    });
  });

  it('falls back to the 31-day window when from is not before to', () => {
    expect(clampTraceDiscoveryTimeRange({ from: to, to })).toEqual({ from: '2026-08-15T12:00:00.000Z', to });
  });
});
