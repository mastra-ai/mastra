import { describe, expect, it } from 'vitest';
import { encodeThreadQueryCursor, planThreadRowsQuery, threadQueryRequestSchema } from './thread-query';
import { planThreadQuery, queryThreadsInputSchema } from './trace-query';

const range = { from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z' };
const request = { timeRange: { traces: range } };
const scope = { organizationId: 'org', resourceId: 'resource' };

describe('thread row contract', () => {
  it('requires exactly one positive time selector and defaults to last activity', () => {
    expect(planThreadRowsQuery(request)).toMatchObject({
      result: 'threadRows',
      orderBy: { field: 'endedAt', direction: 'desc' },
      limit: 100,
    });
    for (const timeRange of [
      {},
      { traces: range, threads: { ...range, field: 'endedAt' } },
      { traces: { ...range, to: range.from } },
      { threads: range },
    ]) {
      expect(threadQueryRequestSchema.safeParse({ timeRange }).success).toBe(false);
    }
    expect(planThreadRowsQuery({ timeRange: { threads: { ...range, field: 'startedAt' } } }).timeRange).toMatchObject({
      mode: 'threads',
      field: 'startedAt',
    });
  });

  it('keeps legacy identity planning separate from full-history row requests', () => {
    expect(planThreadQuery(queryThreadsInputSchema.parse({ traces: { timeRange: range } }))).toMatchObject({
      result: 'threads',
    });
    expect(() => planThreadRowsQuery({ traces: { timeRange: range } })).toThrow();
    expect(() => planThreadRowsQuery({ ...request, where: { traces: { some: {} } } })).toThrow();
  });

  it('accepts direct context/count predicates but rejects JSON and related search', () => {
    for (const field of ['threadId', 'firstTraceId', 'lastTraceId', 'executionSource', 'requestId']) {
      expect(
        planThreadRowsQuery({ ...request, where: { op: 'eq', left: { path: field }, right: { literal: 'a' } } }).where,
      ).toMatchObject({ field, value: 'a' });
    }
    expect(
      planThreadRowsQuery({ ...request, where: { op: 'gte', left: { path: 'traceCount' }, right: { literal: 3 } } })
        .where,
    ).toMatchObject({ field: 'traceCount', value: 3 });
    for (const field of ['model', 'provider', 'metadata.x', 'inputPreview', 'durationMs']) {
      expect(() =>
        planThreadRowsQuery({ ...request, where: { op: 'eq', left: { path: field }, right: { literal: 'a' } } }),
      ).toThrow();
    }
  });

  it('binds cursors to the mode, window, predicates, order and authorization', () => {
    const plan = planThreadRowsQuery(request, { scope, authorizationBinding: 'grant' });
    const after = encodeThreadQueryCursor(plan, { organizationId: 'org', threadId: 'thread', sortValue: range.from });
    expect(
      planThreadRowsQuery({ ...request, page: { after, limit: 10 } }, { scope, authorizationBinding: 'grant' }).cursor,
    ).toMatchObject({ threadId: 'thread' });
    for (const changed of [
      { timeRange: { threads: { ...range, field: 'endedAt' } } },
      { timeRange: { traces: { ...range, to: '2026-10-03T00:00:00Z' } } },
      { ...request, orderBy: [{ field: 'startedAt', direction: 'asc' }] },
      { ...request, where: { op: 'exists', path: 'userId' } },
    ])
      expect(() =>
        planThreadRowsQuery({ ...changed, page: { after } }, { scope, authorizationBinding: 'grant' }),
      ).toThrow();
    expect(() =>
      planThreadRowsQuery({ ...request, page: { after } }, { scope, authorizationBinding: 'different' }),
    ).toThrow();
    expect(() =>
      planThreadRowsQuery({ ...request, page: { after } }, { scope: { ...scope, resourceId: 'other' } }),
    ).toThrow();
  });
});
