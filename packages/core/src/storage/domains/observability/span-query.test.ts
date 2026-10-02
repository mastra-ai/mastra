import { describe, expect, it } from 'vitest';
import {
  createSpanQueryPreview,
  encodeSpanQueryCursor,
  parseSpanQueryRequest,
  planSpanQuery,
  spanQueryCostSchema,
  spanQueryRequestSchema,
  spanQueryResponseSchema,
  spanQueryRowSchema,
} from './span-query';
import type { SpanQueryRow } from './span-query';
import {
  digestBinding,
  parseTraceQueryRequest,
  planTraceQuery,
  TRACE_QUERY_FIELD_REGISTRY,
  TRACE_QUERY_MAX_DEPTH,
  TRACE_QUERY_MAX_NODES,
  TraceQueryCursorError,
} from './trace-query';

const timeRange = { from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z' };
const scope = { organizationId: 'org-a', resourceId: 'project-a' };
const where = { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } } as const;
const identity = { ...scope, traceId: 'trace-a', spanId: 'span-a' };
const values = { ...identity, sortValue: '2026-10-01T12:00:00Z' };
const fourByteCharacter = '\u{10400}'; // One Unicode code point, four UTF-8 bytes.
const row: SpanQueryRow = {
  ...identity,
  parentSpanId: 'parent-a',
  name: 'searchProducts',
  spanType: 'tool_call',
  status: 'success',
  startedAt: '2026-10-01T12:00:00Z',
  endedAt: '2026-10-01T12:00:01Z',
  durationMs: 1000,
  entityType: 'tool',
  entityId: 'search-products',
  entityName: null,
  model: null,
  provider: null,
  inputPreview: 'hello',
  inputTruncated: false,
  outputPreview: null,
  outputTruncated: false,
  cost: { state: 'unavailable' },
};

describe('span query contract prototype', () => {
  it('defaults to bounded keyset pagination without accepting authorization in the request', () => {
    expect(parseSpanQueryRequest({ timeRange })).toEqual({
      timeRange,
      orderBy: [{ field: 'startedAt', direction: 'desc' }],
      page: { limit: 100 },
    });
    expect(spanQueryRequestSchema.safeParse({ timeRange, scope }).success).toBe(false);
  });

  it.each([
    { page: { limit: 0 } },
    { page: { limit: 1001 } },
    { page: { limit: 1.5 } },
    { page: { after: '' } },
    { page: { after: 'x'.repeat(8193) } },
    { pagination: { page: 1 } },
    { orderBy: [] },
    { orderBy: [{ field: 'input', direction: 'asc' }] },
    { orderBy: [{ field: 'startedAt', direction: 'sideways' }] },
    {
      orderBy: [
        { field: 'startedAt', direction: 'asc' },
        { field: 'endedAt', direction: 'desc' },
      ],
    },
    { timeRange: { from: timeRange.to, to: timeRange.from } },
    { timeRange: { from: timeRange.from, to: timeRange.from } },
    { timeRange: { from: timeRange.from, to: '2026-11-02T00:00:00Z' } },
    { where: { spans: { some: where } } },
    { where: { op: 'eq', left: { path: 'durationMs' }, right: { literal: '1000' } } },
    { where: { op: 'gt', left: { path: 'name' }, right: { literal: 'a' } } },
    { where: { op: 'eq', left: { path: 'attributes.retry.count' }, right: { literal: 2 } } },
    { where: { op: 'eq', left: { path: 'metadata.customer' }, right: { literal: 'a' } } },
    { where: { op: 'eq', left: { path: 'input' }, right: { literal: 'a' } } },
    { where: { op: 'exists', path: '__proto__' } },
  ])('rejects unsupported or invalid request fields: %j', overrides => {
    expect(spanQueryRequestSchema.safeParse({ timeRange, ...overrides }).success).toBe(false);
  });

  it('guards recursive grammar before parsing, including cyclic objects', () => {
    let deep: unknown = where;
    for (let i = 0; i < TRACE_QUERY_MAX_DEPTH; i++) deep = { op: 'not', arg: deep };
    const cycle: Record<string, unknown> = { op: 'not' };
    cycle.arg = cycle;
    for (const predicate of [deep, cycle, { op: 'and', args: Array(TRACE_QUERY_MAX_NODES).fill(where) }]) {
      expect(() => parseSpanQueryRequest({ timeRange, where: predicate })).toThrowError(
        expect.objectContaining({
          issues: expect.arrayContaining([expect.objectContaining({ code: 'predicate_too_complex' })]),
        }),
      );
    }
  });

  it.each(Object.keys(TRACE_QUERY_FIELD_REGISTRY.spans))('shares the existing span rule for %s', field => {
    const predicate = { op: 'exists', path: field };
    const tracePlan = planTraceQuery(parseTraceQueryRequest({ timeRange, where: { spans: { some: predicate } } }));
    if (tracePlan.where?.type !== 'relation') throw new Error('Expected a span relation');
    expect(planSpanQuery({ timeRange, where: predicate }).where).toEqual(tracePlan.where.predicate);
  });

  it('normalizes equivalent requests and keeps trusted scope separate from a conflicting predicate', () => {
    const predicate = { op: 'eq', left: { path: 'organizationId' }, right: { literal: 'org-b' } };
    const plan = planSpanQuery({ timeRange, where: predicate }, { scope });
    expect(plan.scope).toEqual(scope);
    expect(plan.where).toMatchObject({ field: 'organizationId', value: 'org-b' });
    const alternate = planSpanQuery({
      timeRange: { from: '2026-10-01T05:30:00+05:30', to: '2026-10-02T05:30:00+05:30' },
    });
    expect(alternate.binding).toBe(planSpanQuery({ timeRange }).binding);
  });
});

describe('span cursor ownership', () => {
  const options = { scope, authorizationBinding: 'permissions-v1' };
  const initial = planSpanQuery({ timeRange, where }, options);
  const after = encodeSpanQueryCursor(initial, values);

  it('round trips the full scoped identity and allows changing page size', () => {
    expect(spanQueryResponseSchema.safeParse({ spans: [], page: { next: after } }).success).toBe(true);
    expect(planSpanQuery({ timeRange, where, page: { after, limit: 2 } }, options)).toMatchObject({
      limit: 2,
      cursor: { ...values, sortValue: '2026-10-01T12:00:00.000Z' },
    });
  });

  it('uses the shared binding regardless of planned object property order', () => {
    expect(initial.binding).toBe(
      digestBinding({
        authorization: options.authorizationBinding,
        scope: { resourceId: scope.resourceId, organizationId: scope.organizationId },
        orderBy: { direction: 'desc', field: 'startedAt' },
        where: Object.fromEntries(Object.entries(initial.where!).reverse()),
        timeRange: { to: initial.timeRange.to, from: initial.timeRange.from },
        result: 'spans',
        version: 1,
      }),
    );
  });

  it('rejects oversized and non-base64url response cursors', () => {
    for (const next of ['', 'a'.repeat(8193), '\u00e9'.repeat(8192), `${after}=`, `${after}\n`]) {
      expect(spanQueryResponseSchema.safeParse({ spans: [], page: { next } }).success).toBe(false);
    }
    expect(spanQueryResponseSchema.safeParse({ spans: [], page: { next: 'a'.repeat(8192) } }).success).toBe(true);
    expect(spanQueryResponseSchema.safeParse({ spans: [], page: { next: null } }).success).toBe(true);
  });

  it.each([
    [{ timeRange, where: { ...where, right: { literal: 'generic' } } }, options],
    [{ timeRange: { ...timeRange, to: '2026-10-03T00:00:00Z' }, where }, options],
    [{ timeRange, where, orderBy: [{ field: 'startedAt', direction: 'asc' }] }, options],
    [{ timeRange, where, orderBy: [{ field: 'endedAt', direction: 'desc' }] }, options],
    [
      { timeRange, where },
      { ...options, scope: { ...scope, organizationId: 'org-b' } },
    ],
    [
      { timeRange, where },
      { ...options, scope: { ...scope, resourceId: 'project-b' } },
    ],
    [
      { timeRange, where },
      { ...options, authorizationBinding: 'permissions-v2' },
    ],
    [{ timeRange, where }, {}],
  ])('rejects replay against different query or authorization bindings', (request, changedOptions) => {
    expect(() => planSpanQuery({ ...request, page: { after } }, changedOptions)).toThrow(TraceQueryCursorError);
  });

  it('rejects malformed, wrong-result and forged cross-tenant cursor values', () => {
    const original = JSON.parse(Buffer.from(after, 'base64url').toString());
    const cursors = [
      'not-json',
      `${after}!`,
      Buffer.from(JSON.stringify({ ...original, result: 'traces' })).toString('base64url'),
      Buffer.from(JSON.stringify({ ...original, values: { ...values, organizationId: 'org-b' } })).toString(
        'base64url',
      ),
    ];
    for (const cursor of cursors) {
      expect(() => planSpanQuery({ timeRange, where, page: { after: cursor } }, options)).toThrow(
        TraceQueryCursorError,
      );
    }
  });

  it('supports local OSS spans with absent tenant fields without conflating null and empty IDs', () => {
    const plan = planSpanQuery({ timeRange });
    const cursor = encodeSpanQueryCursor(plan, { ...values, organizationId: null, resourceId: null });
    expect(planSpanQuery({ timeRange, page: { after: cursor } }).cursor).toMatchObject({
      organizationId: null,
      resourceId: null,
    });
    expect(() => encodeSpanQueryCursor(plan, { ...values, organizationId: '' })).toThrow();
  });
});

describe('bounded result contract', () => {
  it('accepts a completed row, preserves actual zero cost, and rejects invented zero for unknown cost', () => {
    expect(spanQueryRowSchema.safeParse(row).success).toBe(true);
    for (const cost of [
      { state: 'available', amount: 0, currency: 'USD' },
      { state: 'missing' },
      { state: 'unavailable' },
    ]) {
      expect(spanQueryCostSchema.safeParse(cost).success).toBe(true);
    }
    for (const cost of [
      { state: 'missing', amount: 0 },
      { state: 'available' },
      { state: 'available', amount: -1, currency: 'USD' },
      { state: 'available', amount: Infinity, currency: 'USD' },
    ]) {
      expect(spanQueryCostSchema.safeParse(cost).success).toBe(false);
    }
  });

  it.each([
    { status: 'running' },
    { endedAt: null },
    { endedAt: '2026-10-01T11:59:59Z' },
    { durationMs: 999 },
    { inputPreview: null, inputTruncated: true },
    { outputPreview: fourByteCharacter.repeat(257) },
    { input: 'full-payload-is-not-a-list-field' },
  ])('rejects invalid result states: %j', overrides => {
    expect(spanQueryRowSchema.safeParse({ ...row, ...overrides }).success).toBe(false);
  });

  it.each<[string | null, string | null, boolean]>([
    [null, null, false],
    ['', '', false],
    ['{malformed', '{malformed', false],
    [fourByteCharacter.repeat(256), fourByteCharacter.repeat(256), false],
    [fourByteCharacter.repeat(257), fourByteCharacter.repeat(256), true],
    ['x'.repeat(257), 'x'.repeat(256), true],
  ])('preserves the expected preview and truncation state for input %#', (input, value, truncated) => {
    expect(createSpanQueryPreview(input)).toEqual({ value, truncated });
  });

  it('rejects duplicate logical rows but permits matching IDs in different trusted resources', () => {
    expect(spanQueryResponseSchema.safeParse({ spans: [row, row], page: { next: null } }).success).toBe(false);
    expect(
      spanQueryResponseSchema.safeParse({ spans: [row, { ...row, resourceId: 'project-b' }], page: { next: null } })
        .success,
    ).toBe(true);
    expect(spanQueryResponseSchema.safeParse({ spans: [], page: { next: null } }).success).toBe(true);
  });
});
