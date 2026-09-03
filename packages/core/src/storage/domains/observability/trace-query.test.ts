import { describe, expect, it } from 'vitest';
import { ObservabilityStorage } from './base';
import {
  encodeTraceQueryCursor,
  parseTraceQueryRequest,
  planTraceQuery,
  TRACE_QUERY_MAX_DEPTH,
  traceQueryGroupResponseSchema,
  traceQueryRequestSchema,
  traceQueryTraceResponseSchema,
  TraceQueryCursorError,
  TraceQueryValidationError,
  type TraceQueryPredicate,
} from './trace-query';

const baseRequest = {
  timeRange: {
    from: '2026-08-01T00:00:00Z',
    to: '2026-09-01T00:00:00Z',
  },
};

function parsed(request: unknown = baseRequest) {
  return parseTraceQueryRequest(request);
}

function validationError(fn: () => unknown): TraceQueryValidationError {
  try {
    fn();
    throw new Error('Expected a TraceQueryValidationError');
  } catch (error) {
    expect(error).toBeInstanceOf(TraceQueryValidationError);
    return error as TraceQueryValidationError;
  }
}

describe('traceQueryRequestSchema', () => {
  it('normalizes page defaults without coercing values', () => {
    expect(parsed()).toMatchObject({ page: { limit: 100 } });
    expect(traceQueryRequestSchema.safeParse({ ...baseRequest, page: { limit: '10' } }).success).toBe(false);
  });

  it('rejects unknown and experimental request properties', () => {
    for (const property of ['groupBy', 'select', 'result', 'source', 'authorization']) {
      const result = traceQueryRequestSchema.safeParse({ ...baseRequest, [property]: {} });
      expect(result.success, property).toBe(false);
    }
  });

  it('requires ISO timestamps and the exact group shape', () => {
    expect(traceQueryRequestSchema.safeParse({ timeRange: { from: 'yesterday', to: 'tomorrow' } }).success).toBe(false);
    expect(traceQueryRequestSchema.safeParse({ ...baseRequest, group: { by: ['environment'] } }).success).toBe(false);
    expect(traceQueryRequestSchema.safeParse({ ...baseRequest, group: { by: ['threadId'], where: {} } }).success).toBe(
      false,
    );
  });

  it('does not expose truthy or falsy predicates', () => {
    expect(
      traceQueryRequestSchema.safeParse({
        ...baseRequest,
        where: { op: 'truthy', value: { path: 'threadId' } },
      }).success,
    ).toBe(false);
  });
});

describe('planTraceQuery', () => {
  it('normalizes time, defaults ordering, and produces canonical fields', () => {
    const plan = planTraceQuery(
      parsed({
        timeRange: {
          from: '2026-08-01T02:00:00+02:00',
          to: '2026-08-02T02:00:00+02:00',
        },
        where: {
          op: 'eq',
          left: { path: '${environment}' },
          right: { literal: 'production' },
        },
      }),
    );

    expect(plan).toMatchObject({
      result: 'traces',
      timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-02T00:00:00.000Z' },
      orderBy: { field: 'startedAt', direction: 'desc' },
      limit: 100,
      where: { type: 'comparison', field: 'environment', operator: 'eq', value: 'production' },
    });
  });

  it('enforces ordered and maximum time ranges', () => {
    const reversed = validationError(() =>
      planTraceQuery(parsed({ timeRange: { from: '2026-08-02T00:00:00Z', to: '2026-08-01T00:00:00Z' } })),
    );
    expect(reversed.issues).toEqual([expect.objectContaining({ code: 'invalid_time_range', path: ['timeRange'] })]);

    const tooLarge = validationError(() =>
      planTraceQuery(parsed({ timeRange: { from: '2026-07-31T23:59:59Z', to: '2026-09-01T00:00:00Z' } })),
    );
    expect(tooLarge.issues[0]).toMatchObject({ code: 'time_range_too_large', path: ['timeRange'] });
  });

  it('plans recursive trace and same-record collection predicates', () => {
    const plan = planTraceQuery(
      parsed({
        ...baseRequest,
        where: {
          op: 'and',
          args: [
            {
              scores: {
                some: {
                  op: 'and',
                  args: [
                    { op: 'eq', left: { path: 'scorerId' }, right: { literal: 'factuality' } },
                    { op: 'lt', left: { path: 'score' }, right: { literal: 0.6 } },
                  ],
                },
              },
            },
            { spans: { none: { op: 'exists', path: 'error' } } },
          ],
        },
      }),
    );

    expect(plan.where).toEqual({
      type: 'boolean',
      operator: 'and',
      args: [
        {
          type: 'relation',
          collection: 'scores',
          quantifier: 'some',
          predicate: {
            type: 'boolean',
            operator: 'and',
            args: [
              { type: 'comparison', field: 'scorerId', operator: 'eq', value: 'factuality' },
              { type: 'comparison', field: 'score', operator: 'lt', value: 0.6 },
            ],
          },
        },
        {
          type: 'relation',
          collection: 'spans',
          quantifier: 'none',
          predicate: { type: 'presence', field: 'error', operator: 'exists' },
        },
      ],
    });
  });

  it('plans richer score fields with their field-specific semantics', () => {
    const plan = planTraceQuery(
      parsed({
        ...baseRequest,
        where: {
          scores: {
            some: {
              op: 'and',
              args: [
                { op: 'in', value: { path: 'scorerVersion' }, set: ['v1', 'v2'] },
                { op: 'eq', left: { path: 'scoreSource' }, right: { literal: 'automated' } },
                {
                  op: 'gte',
                  left: { path: 'timestamp' },
                  right: { literal: '2026-08-10T02:00:00+02:00' },
                },
                { op: 'exists', path: 'spanId' },
                { op: 'notExists', path: 'parentEntityVersionId' },
                { op: 'eq', left: { path: 'entityVersionId' }, right: { literal: 'entity-v2' } },
                { op: 'notIn', value: { path: 'rootEntityVersionId' }, set: ['root-v1'] },
              ],
            },
          },
        },
      }),
    );

    expect(plan.where).toMatchObject({
      type: 'relation',
      collection: 'scores',
      quantifier: 'some',
      predicate: {
        type: 'boolean',
        operator: 'and',
        args: [
          { type: 'membership', field: 'scorerVersion', operator: 'in', values: ['v1', 'v2'] },
          { type: 'comparison', field: 'scoreSource', operator: 'eq', value: 'automated' },
          { type: 'comparison', field: 'timestamp', operator: 'gte', value: '2026-08-10T00:00:00.000Z' },
          { type: 'presence', field: 'spanId', operator: 'exists' },
          { type: 'presence', field: 'parentEntityVersionId', operator: 'notExists' },
          { type: 'comparison', field: 'entityVersionId', operator: 'eq', value: 'entity-v2' },
          { type: 'membership', field: 'rootEntityVersionId', operator: 'notIn', values: ['root-v1'] },
        ],
      },
    });
  });

  it('rejects unapproved score fields and invalid score operator/type combinations', () => {
    for (const field of ['source', 'scorerName']) {
      const error = validationError(() =>
        planTraceQuery(
          parsed({
            ...baseRequest,
            where: { scores: { some: { op: 'exists', path: field } } },
          }),
        ),
      );
      expect(error.issues[0]).toMatchObject({
        code: 'field_not_allowed',
        path: ['where', 'scores', 'some', 'path'],
      });
    }

    const orderedString = validationError(() =>
      planTraceQuery(
        parsed({
          ...baseRequest,
          where: {
            scores: { some: { op: 'lt', left: { path: 'scoreSource' }, right: { literal: 'manual' } } },
          },
        }),
      ),
    );
    expect(orderedString.issues).toContainEqual(
      expect.objectContaining({ code: 'operator_not_allowed', path: ['where', 'scores', 'some', 'op'] }),
    );

    const comparedSpanId = validationError(() =>
      planTraceQuery(
        parsed({
          ...baseRequest,
          where: { scores: { some: { op: 'eq', left: { path: 'spanId' }, right: { literal: 'span-1' } } } },
        }),
      ),
    );
    expect(comparedSpanId.issues).toContainEqual(
      expect.objectContaining({ code: 'operator_not_allowed', path: ['where', 'scores', 'some', 'op'] }),
    );

    const malformedTimestamp = validationError(() =>
      planTraceQuery(
        parsed({
          ...baseRequest,
          where: {
            scores: {
              some: { op: 'gte', left: { path: 'timestamp' }, right: { literal: 'August 10, 2026' } },
            },
          },
        }),
      ),
    );
    expect(malformedTimestamp.issues).toContainEqual(
      expect.objectContaining({
        code: 'invalid_literal',
        path: ['where', 'scores', 'some', 'right', 'literal'],
      }),
    );
  });

  it('enforces field-specific operators and literal types', () => {
    const badErrorOperator = validationError(() =>
      planTraceQuery(
        parsed({
          ...baseRequest,
          where: { spans: { some: { op: 'eq', left: { path: 'error' }, right: { literal: 'boom' } } } },
        }),
      ),
    );
    expect(badErrorOperator.issues).toContainEqual(
      expect.objectContaining({ code: 'operator_not_allowed', path: ['where', 'spans', 'some', 'op'] }),
    );

    const badScoreLiteral = validationError(() =>
      planTraceQuery(
        parsed({
          ...baseRequest,
          where: { scores: { some: { op: 'lt', left: { path: 'score' }, right: { literal: '0.6' } } } },
        }),
      ),
    );
    expect(badScoreLiteral.issues).toContainEqual(
      expect.objectContaining({ code: 'invalid_literal', path: ['where', 'scores', 'some', 'right', 'literal'] }),
    );
  });

  it('requires field-left/literal-right comparisons and homogeneous membership values', () => {
    const operands = validationError(() =>
      planTraceQuery(
        parsed({
          ...baseRequest,
          where: { op: 'eq', left: { literal: 'production' }, right: { path: 'environment' } },
        }),
      ),
    );
    expect(operands.issues[0]).toMatchObject({ code: 'invalid_operands', path: ['where'] });

    const membership = validationError(() =>
      planTraceQuery(
        parsed({
          ...baseRequest,
          where: { op: 'in', value: { path: 'resourceId' }, set: ['resource-1', 2] },
        }),
      ),
    );
    expect(membership.issues[0]).toMatchObject({ code: 'invalid_literal', path: ['where', 'set'] });
  });

  it('keeps correlation fields queryable and does not infer authorization fields', () => {
    for (const field of ['resourceId', 'threadId'] as const) {
      expect(
        planTraceQuery(
          parsed({
            ...baseRequest,
            where: { op: 'eq', left: { path: field }, right: { literal: `${field}-value` } },
          }),
        ).where,
      ).toMatchObject({ field });
    }

    const organization = validationError(() =>
      planTraceQuery(
        parsed({
          ...baseRequest,
          where: { op: 'eq', left: { path: 'organizationId' }, right: { literal: 'org-1' } },
        }),
      ),
    );
    expect(organization.issues[0]).toMatchObject({ code: 'field_not_allowed' });
  });

  it('rejects grouped orderBy and fixes grouped ordering', () => {
    const error = validationError(() =>
      planTraceQuery(
        parsed({
          ...baseRequest,
          group: { by: ['threadId'] },
          orderBy: [{ field: 'startedAt', direction: 'desc' }],
        }),
      ),
    );
    expect(error.issues[0]).toMatchObject({ code: 'group_order_not_supported', path: ['orderBy'] });

    expect(planTraceQuery(parsed({ ...baseRequest, group: { by: ['threadId'] } }))).toMatchObject({
      result: 'groups',
      orderBy: { field: 'threadId', direction: 'asc' },
    });
  });

  it('bounds recursive predicate complexity', () => {
    let where: TraceQueryPredicate = {
      op: 'eq',
      left: { path: 'traceId' },
      right: { literal: 'trace-1' },
    };
    for (let index = 0; index < TRACE_QUERY_MAX_DEPTH; index += 1) where = { op: 'not', arg: where };

    const error = validationError(() => planTraceQuery(parsed({ ...baseRequest, where })));
    expect(error.issues[0]).toMatchObject({ code: 'predicate_too_complex' });
  });

  it('does not echo query literals in semantic issues', () => {
    const secret = 'sensitive-customer-value';
    const error = validationError(() =>
      planTraceQuery(
        parsed({
          ...baseRequest,
          where: { op: 'eq', left: { path: 'unknown' }, right: { literal: secret } },
        }),
      ),
    );
    expect(JSON.stringify(error.issues)).not.toContain(secret);
  });
});

describe('trace-query cursors', () => {
  it('round-trips trace and group keyset values', () => {
    const tracePlan = planTraceQuery(parsed());
    const traceCursor = encodeTraceQueryCursor(tracePlan, {
      result: 'traces',
      sortValue: '2026-08-03T00:00:00.000Z',
      traceId: 'trace-3',
    });
    expect(planTraceQuery(parsed({ ...baseRequest, page: { after: traceCursor } }))).toMatchObject({
      cursor: { sortValue: '2026-08-03T00:00:00.000Z', traceId: 'trace-3' },
    });

    const groupPlan = planTraceQuery(parsed({ ...baseRequest, group: { by: ['threadId'] } }));
    const groupCursor = encodeTraceQueryCursor(groupPlan, { result: 'groups', threadId: 'thread-2' });
    expect(
      planTraceQuery(parsed({ ...baseRequest, group: { by: ['threadId'] }, page: { after: groupCursor } })),
    ).toMatchObject({ cursor: { threadId: 'thread-2' } });
  });

  it('distinguishes malformed cursors from binding conflicts', () => {
    expect(() => planTraceQuery(parsed({ ...baseRequest, page: { after: 'not-json' } }))).toThrowError(
      expect.objectContaining<Partial<TraceQueryCursorError>>({ code: 'TRACE_QUERY_CURSOR_MALFORMED' }),
    );

    const plan = planTraceQuery(parsed());
    const cursor = encodeTraceQueryCursor(plan, {
      result: 'traces',
      sortValue: '2026-08-03T00:00:00.000Z',
      traceId: 'trace-3',
    });
    expect(() =>
      planTraceQuery(parsed({ ...baseRequest, where: { op: 'exists', path: 'threadId' }, page: { after: cursor } })),
    ).toThrowError(expect.objectContaining<Partial<TraceQueryCursorError>>({ code: 'TRACE_QUERY_CURSOR_CONFLICT' }));
  });

  it('binds established shared authorization state only when supplied', () => {
    const plan = planTraceQuery(parsed(), { authorizationBinding: 'scope-a' });
    const cursor = encodeTraceQueryCursor(plan, {
      result: 'traces',
      sortValue: '2026-08-03T00:00:00.000Z',
      traceId: 'trace-3',
    });

    expect(() =>
      planTraceQuery(parsed({ ...baseRequest, page: { after: cursor } }), { authorizationBinding: 'scope-b' }),
    ).toThrowError(expect.objectContaining<Partial<TraceQueryCursorError>>({ code: 'TRACE_QUERY_CURSOR_CONFLICT' }));
  });
});

describe('trace-query responses and storage capability', () => {
  it('enforces fixed trace and group projections', () => {
    const trace = {
      traceId: 'trace-1',
      rootSpanId: 'span-1',
      threadId: null,
      resourceId: null,
      startedAt: '2026-08-01T00:00:00Z',
      endedAt: '2026-08-01T00:00:01Z',
      entityName: null,
      entityType: null,
      environment: null,
      status: 'success',
    };
    expect(traceQueryTraceResponseSchema.safeParse({ traces: [trace], page: { next: null } }).success).toBe(true);
    expect(
      traceQueryTraceResponseSchema.safeParse({ traces: [{ ...trace, scores: [] }], page: { next: null } }).success,
    ).toBe(false);
    expect(
      traceQueryGroupResponseSchema.safeParse({ groups: [{ threadId: 'thread-1', count: 1 }], page: { next: null } })
        .success,
    ).toBe(false);
  });

  it('fails closed for stores that do not implement advanced trace queries', async () => {
    const storage = new ObservabilityStorage();
    await expect(storage.queryTraces(planTraceQuery(parsed()))).rejects.toMatchObject({
      id: 'OBSERVABILITY_STORAGE_QUERY_TRACES_NOT_IMPLEMENTED',
    });
  });
});
