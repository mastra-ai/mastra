import { describe, expect, it } from 'vitest';
import {
  buildSpanQueryResponse,
  createSpanQueryPreview,
  encodeSpanQueryCursor,
  parseSpanQueryRequest,
  planSpanQuery,
  spanQueryCostSchema,
  spanQueryRequestSchema,
  spanQueryResponseSchema,
  spanQueryRowSchema,
  resolveSpanQueryCost,
} from './span-query';
import type { SpanQueryCostMetric, SpanQueryRow } from './span-query';
import {
  parseTraceQueryRequest,
  TRACE_QUERY_FIELD_REGISTRY,
  TRACE_QUERY_MAX_DEPTH,
  TRACE_QUERY_MAX_NODES,
  TraceQueryCursorError,
} from './trace-query';
import { digestBinding, planTraceQuery } from './trace-query-plan';

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
  entityVersionId: null,
  parentEntityType: null,
  parentEntityId: null,
  parentEntityName: null,
  parentEntityVersionId: null,
  rootEntityType: null,
  rootEntityId: null,
  rootEntityName: null,
  rootEntityVersionId: null,
  threadId: null,
  runId: null,
  sessionId: null,
  userId: null,
  requestId: null,
  serviceName: null,
  experimentId: null,
  environment: null,
  executionSource: null,
  model: null,
  provider: null,
  inputPreview: 'hello',
  outputPreview: null,
  errorPreview: null,
};

describe('span query model cost', () => {
  const input: SpanQueryCostMetric = {
    ...identity,
    name: 'mastra_model_total_input_tokens',
    estimatedCost: 0.01,
    costUnit: 'usd',
    allocation: null,
    costError: false,
  };
  const output: SpanQueryCostMetric = { ...input, name: 'mastra_model_total_output_tokens', estimatedCost: 0.02 };

  it.each([
    [input],
    [input, input, output],
    [input, { ...output, costUnit: 'eur' }],
    [{ ...input, costUnit: 'x'.repeat(17), allocation: 'query_total' }],
    [input, { ...output, costError: true }],
    [input, { ...output, estimatedCost: null }],
    [input, { ...output, estimatedCost: -1 }],
    [{ ...input, allocation: 'query_total' }, output],
  ])('does not present incomplete or conflicting pricing as a total (%#)', (...metrics) => {
    expect(resolveSpanQueryCost(metrics)).toEqual({ state: 'unavailable' });
  });

  it('counts a provider total once when its companion metric is unpriced', () => {
    expect(
      resolveSpanQueryCost([
        { ...input, allocation: 'query_total' },
        { ...output, estimatedCost: null },
      ]),
    ).toEqual({ state: 'available', amount: 0.01, currency: 'usd' });
  });
});

describe('span query contract', () => {
  it('accepts rows from older adapters and ignores their legacy metrics argument', () => {
    const legacyRow = {
      ...identity,
      parentSpanId: row.parentSpanId,
      name: row.name,
      spanType: row.spanType,
      status: row.status,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      durationMs: row.durationMs,
      entityType: row.entityType,
      entityId: row.entityId,
      entityName: row.entityName,
      model: null,
      provider: null,
    };
    // Published adapters invoke this function with their older selected-row shape.
    const result = buildSpanQueryResponse(
      planSpanQuery({ timeRange }),
      [legacyRow as Parameters<typeof buildSpanQueryResponse>[1][number]],
      [{ ...identity, inputPreview: 'legacy input', outputPreview: null, errorPreview: null }],
      [],
    );
    expect(result.spans[0]).toMatchObject({
      ...legacyRow,
      threadId: null,
      parentEntityName: null,
      inputPreview: 'legacy input',
    });
    expect(Object.values(result.spans[0]!)).not.toContain(undefined);
    expect(result.spans[0]).not.toHaveProperty('cost');
    expect(result.spans[0]).not.toHaveProperty('inputTruncated');
  });

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
    { where: { spans: { some: where } } },
  ])('rejects unsupported or invalid request fields: %j', overrides => {
    expect(spanQueryRequestSchema.safeParse({ timeRange, ...overrides }).success).toBe(false);
  });

  it('accepts time ranges of any positive width', () => {
    const wide = { from: '2025-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z' };
    expect(parseSpanQueryRequest({ timeRange: wide }).timeRange).toEqual(wide);
  });

  it.each([
    [{ op: 'eq', left: { path: 'durationMs' }, right: { literal: '1000' } }, 'invalid_literal'],
    [{ op: 'gt', left: { path: 'name' }, right: { literal: 'a' } }, 'operator_not_allowed'],
    [{ op: 'eq', left: { path: 'attributes.retry.count' }, right: { literal: 2 } }, 'field_not_allowed'],
    [{ op: 'eq', left: { path: 'metadata.customer' }, right: { literal: 'a' } }, 'field_not_allowed'],
    [{ op: 'eq', left: { path: 'input' }, right: { literal: 'a' } }, 'field_not_allowed'],
    [{ op: 'exists', path: '__proto__' }, 'field_not_allowed'],
  ])('preserves the planner issue for invalid span predicate %j', (predicate, code) => {
    expect(() => planSpanQuery({ timeRange, where: predicate })).toThrowError(
      expect.objectContaining({ issues: expect.arrayContaining([expect.objectContaining({ code })]) }),
    );
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

  it.each(Object.keys(TRACE_QUERY_FIELD_REGISTRY.spans).filter(field => !['model', 'provider'].includes(field)))(
    'shares the existing span rule for %s',
    field => {
      const predicate = { op: 'exists', path: field };
      const tracePlan = planTraceQuery(parseTraceQueryRequest({ timeRange, where: { spans: { some: predicate } } }));
      if (tracePlan.where?.type !== 'relation') throw new Error('Expected a span relation');
      expect(planSpanQuery({ timeRange, where: predicate }).where).toEqual(tracePlan.where.predicate);
    },
  );

  it.each(['model', 'provider'])('rejects direct %s filters while retaining nested trace support', field => {
    const predicate = { op: 'eq', left: { path: field }, right: { literal: 'example' } };
    expect(() => planSpanQuery({ timeRange, where: predicate })).toThrow();
    expect(() =>
      planTraceQuery(parseTraceQueryRequest({ timeRange, where: { spans: { some: predicate } } })),
    ).not.toThrow();
  });

  it.each([
    'traceId',
    'spanId',
    'parentSpanId',
    'threadId',
    'resourceId',
    'requestId',
    'serviceName',
    'experimentId',
    'environment',
    'executionSource',
    'parentEntityType',
    'parentEntityId',
    'parentEntityName',
    'rootEntityType',
    'rootEntityId',
    'rootEntityName',
  ])('accepts dedicated string filters for %s', field => {
    for (const op of ['eq', 'ne'])
      expect(
        planSpanQuery({ timeRange, where: { op, left: { path: field }, right: { literal: 'example' } } }).where,
      ).toMatchObject({ field, operator: op });
    for (const op of ['in', 'notIn'])
      expect(planSpanQuery({ timeRange, where: { op, value: { path: field }, set: ['example'] } }).where).toMatchObject(
        { field, operator: op },
      );
    for (const op of ['exists', 'notExists'])
      expect(planSpanQuery({ timeRange, where: { op, path: field } }).where).toMatchObject({ field, operator: op });
    expect(() =>
      planSpanQuery({ timeRange, where: { op: 'matches', left: { path: field }, right: { literal: 'example' } } }),
    ).toThrow();
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

  it('round trips numeric and empty time to first chunk cursors and rejects other kinds', () => {
    const request = { timeRange, where, orderBy: [{ field: 'timeToFirstChunkMs', direction: 'asc' }] } as const;
    const plan = planSpanQuery(request, options);
    for (const sortValue of [250, 0, null]) {
      const cursor = encodeSpanQueryCursor(plan, { ...values, sortValue });
      expect(planSpanQuery({ ...request, page: { after: cursor } }, options).cursor).toEqual({ ...values, sortValue });
    }
    const timestampCursor = encodeSpanQueryCursor(plan, values);
    expect(() => planSpanQuery({ ...request, page: { after: timestampCursor } }, options)).toThrowError(
      expect.objectContaining<Partial<TraceQueryCursorError>>({ code: 'TRACE_QUERY_CURSOR_MALFORMED' }),
    );
    const numericCursor = encodeSpanQueryCursor(initial, { ...values, sortValue: 250 });
    expect(() => planSpanQuery({ timeRange, where, page: { after: numericCursor } }, options)).toThrowError(
      expect.objectContaining<Partial<TraceQueryCursorError>>({ code: 'TRACE_QUERY_CURSOR_MALFORMED' }),
    );
    for (const orderBy of [
      [{ field: 'timeToFirstChunkMs', direction: 'desc' }],
      [{ field: 'startedAt', direction: 'asc' }],
    ] as const) {
      const cursor = encodeSpanQueryCursor(plan, { ...values, sortValue: 250 });
      expect(() =>
        planSpanQuery({ timeRange, where, orderBy: [...orderBy], page: { after: cursor } }, options),
      ).toThrowError(expect.objectContaining<Partial<TraceQueryCursorError>>({ code: 'TRACE_QUERY_CURSOR_CONFLICT' }));
    }
  });

  it('encodes an empty time to first chunk as a null cursor value', () => {
    const plan = planSpanQuery({
      timeRange,
      orderBy: [{ field: 'timeToFirstChunkMs', direction: 'desc' }],
      page: { limit: 1 },
    });
    const { inputPreview: _input, outputPreview: _output, errorPreview: _error, ...selected } = row;
    const rows = ['span-a', 'span-b'].map(spanId => ({ ...selected, spanId, timeToFirstChunkMs: null }));
    const response = buildSpanQueryResponse(plan, rows, []);
    const cursor = JSON.parse(Buffer.from(response.page.next!, 'base64url').toString());
    expect(cursor.values.sortValue).toBeNull();
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
    ['2026-10-01T12:00:00.000100Z', '2026-10-01T12:00:01.000600Z', 1000.5],
    ['2026-10-01T12:00:00.000Z', '2026-10-01T12:00:01.000Z', 1000.5],
    ['2026-10-01T12:00:00.000900Z', '2026-10-01T12:00:01.000100Z', 999.2],
  ])('accepts sub-millisecond duration precision for %s to %s', (startedAt, endedAt, durationMs) => {
    expect(spanQueryRowSchema.safeParse({ ...row, startedAt, endedAt, durationMs }).success).toBe(true);
  });

  it.each([999, 1001])('rejects a duration discrepancy of at least one millisecond: %s', durationMs => {
    expect(spanQueryRowSchema.safeParse({ ...row, durationMs }).success).toBe(false);
  });

  it.each([
    { status: 'running' },
    { endedAt: null },
    { endedAt: '2026-10-01T11:59:59Z' },
    { durationMs: 999 },
    { inputPreview: null, inputTruncated: true },
    { errorPreview: null, errorTruncated: true },
    { input: 'full-payload-is-not-a-list-field' },
  ])('rejects invalid result states: %j', overrides => {
    expect(spanQueryRowSchema.safeParse({ ...row, ...overrides }).success).toBe(false);
  });

  it.each<[string | null, string | null, boolean]>([
    [null, null, false],
    ['', null, false],
    ['short preview', 'short preview', false],
    ['x'.repeat(500), 'x'.repeat(500), false],
    ['x'.repeat(100), 'x'.repeat(100), false],
    [`${'x'.repeat(100)}…`, `${'x'.repeat(100)}…`, true],
    [`${'x'.repeat(99)}…`, `${'x'.repeat(99)}…`, true],
  ])('maps a stored preview to its value and truncation state %#', (input, value, truncated) => {
    expect(createSpanQueryPreview(input)).toEqual({ value, truncated });
  });

  it('accepts custom previews without a length limit', () => {
    expect(spanQueryRowSchema.safeParse({ ...row, outputPreview: fourByteCharacter.repeat(500) }).success).toBe(true);
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
