import { describe, expect, it } from 'vitest';
import { ObservabilityStorage } from './base';
import {
  STRUCTURED_TRACE_QUERY_MAX_PATH_SEGMENTS,
  createStructuredTraceQueryObservedFieldDescriptor,
  encodeStructuredTraceQueryCursor,
  encodeStructuredTraceQueryDeltaCursor,
  getStructuredTraceQueryDeltaWatermark,
  getStructuredTraceQueryFieldsResponseSchema,
  getStructuredTraceQueryRoot,
  getStructuredTraceQueryValuesResponseSchema,
  normalizeStructuredTraceQueryPath,
  parseGetStructuredTraceQueryFieldsArgs,
  parseGetStructuredTraceQueryValuesArgs,
  parseStructuredQueryThreadsInput,
  parseStructuredTraceQueryRequest,
  planStructuredThreadQuery,
  planStructuredTraceQuery,
  planStructuredTraceQueryObservedFields,
  planStructuredTraceQueryValues,
  serializeStructuredTraceQueryPath,
  structuredTraceQueryPathSchema,
  supportsStructuredThreadQueryExecution,
  supportsStructuredTraceQueryDiscovery,
  supportsStructuredTraceQueryExecution,
} from './structured-trace-query';
import {
  TRACE_QUERY_MAX_DEPTH,
  TRACE_QUERY_MAX_PATH_BYTES,
  TRACE_QUERY_MAX_STRING_BYTES,
  TraceQueryCursorError,
  TraceQueryValidationError,
} from './trace-query';

const baseTimeRange = {
  from: '2026-08-01T00:00:00Z',
  to: '2026-09-01T00:00:00Z',
};

const structuredDiscoveryParsers = [
  {
    name: 'observed fields',
    parse: (timeRange: { from: string; to: string }) =>
      parseGetStructuredTraceQueryFieldsArgs({ timeRange, predicateScope: 'trace' }),
  },
  {
    name: 'values',
    parse: (timeRange: { from: string; to: string }) =>
      parseGetStructuredTraceQueryValuesArgs({ timeRange, predicateScope: 'trace', path: 'metadata.customer.plan' }),
  },
];

const structuredComparison = (path: string | readonly ['metadata', string, ...string[]], literal: unknown) => ({
  op: 'eq' as const,
  left: { path },
  right: { literal },
});

function nestedStructuredNotPredicate(depth: number): unknown {
  let predicate: unknown = structuredComparison('metadata.customer.plan', 'pro');
  for (let index = 0; index < depth; index += 1) predicate = { op: 'not', arg: predicate };
  return predicate;
}

describe('structured trace-query paths', () => {
  it('normalizes canonical dotted paths and preserves exact tuple segments', () => {
    expect(normalizeStructuredTraceQueryPath(' metadata.customer.plan ')).toEqual(['metadata', 'customer', 'plan']);
    expect(normalizeStructuredTraceQueryPath('${metadata.customer.plan}')).toEqual(['metadata', 'customer', 'plan']);
    expect(normalizeStructuredTraceQueryPath(['metadata', 'customer.plan'])).toEqual(['metadata', 'customer.plan']);
    expect(getStructuredTraceQueryRoot('metadata.customer.plan')).toBe('metadata');
    expect(serializeStructuredTraceQueryPath('metadata.customer.plan')).toBe('metadata.customer.plan');
    expect(serializeStructuredTraceQueryPath(['metadata', 'customer.plan'])).toBe('["metadata","customer.plan"]');
  });

  it('reserves tuples for literal dotted keys', () => {
    expect(structuredTraceQueryPathSchema.safeParse(['metadata', 'customer.plan']).success).toBe(true);
    expect(structuredTraceQueryPathSchema.safeParse(['metadata', 'customer', 'plan']).success).toBe(false);
    expect(structuredTraceQueryPathSchema.safeParse(['attributes', 'customer.plan']).success).toBe(false);
    expect(structuredTraceQueryPathSchema.safeParse([]).success).toBe(false);
  });

  it('rejects empty, NUL, over-depth, over-segment-byte, and over-path-byte paths', () => {
    expect(structuredTraceQueryPathSchema.safeParse('metadata..plan').success).toBe(false);
    expect(structuredTraceQueryPathSchema.safeParse('metadata.customer\0.plan').success).toBe(false);
    expect(
      structuredTraceQueryPathSchema.safeParse(
        `metadata.${Array.from({ length: STRUCTURED_TRACE_QUERY_MAX_PATH_SEGMENTS }, () => 'a').join('.')}`,
      ).success,
    ).toBe(false);
    expect(structuredTraceQueryPathSchema.safeParse(['metadata', `${'a'.repeat(129)}.key`]).success).toBe(false);
    expect(structuredTraceQueryPathSchema.safeParse(`metadata.${'a'.repeat(120)}.suffix`).success).toBe(false);
  });

  it('counts multibyte canonical and exact path limits in UTF-8 bytes', () => {
    const exactSegmentAtLimit = `${'é'.repeat(58)}.xy`;
    const canonicalPathAtLimit = `metadata.${'é'.repeat(59)}x`;

    expect(Buffer.byteLength(`metadata.${exactSegmentAtLimit}`, 'utf8')).toBe(TRACE_QUERY_MAX_PATH_BYTES);
    expect(structuredTraceQueryPathSchema.safeParse(['metadata', exactSegmentAtLimit]).success).toBe(true);
    expect(structuredTraceQueryPathSchema.safeParse(['metadata', `${exactSegmentAtLimit}z`]).success).toBe(false);
    expect(Buffer.byteLength(canonicalPathAtLimit, 'utf8')).toBe(TRACE_QUERY_MAX_PATH_BYTES);
    expect(structuredTraceQueryPathSchema.safeParse(canonicalPathAtLimit).success).toBe(true);
    expect(structuredTraceQueryPathSchema.safeParse(`${canonicalPathAtLimit}y`).success).toBe(false);
  });
});

describe('structured trace-query planning', () => {
  it('plans nested metadata in trace, span, score, and feedback scopes', () => {
    const where = {
      op: 'and' as const,
      args: [
        structuredComparison('metadata.customer.plan', 'pro'),
        { spans: { some: structuredComparison('metadata.model.family', 'gpt') } },
        { scores: { some: structuredComparison('metadata.evaluator.version', 3) } },
        { feedback: { some: structuredComparison('metadata.review.approved', true) } },
      ],
    };
    const plan = planStructuredTraceQuery(parseStructuredTraceQueryRequest({ timeRange: baseTimeRange, where }));

    expect(plan.where).toEqual({
      type: 'boolean',
      operator: 'and',
      args: [
        { type: 'comparison', field: ['metadata', 'customer', 'plan'], operator: 'eq', value: 'pro' },
        {
          type: 'relation',
          collection: 'spans',
          quantifier: 'some',
          predicate: { type: 'comparison', field: ['metadata', 'model', 'family'], operator: 'eq', value: 'gpt' },
        },
        {
          type: 'relation',
          collection: 'scores',
          quantifier: 'some',
          predicate: { type: 'comparison', field: ['metadata', 'evaluator', 'version'], operator: 'eq', value: 3 },
        },
        {
          type: 'relation',
          collection: 'feedback',
          quantifier: 'some',
          predicate: {
            type: 'comparison',
            field: ['metadata', 'review', 'approved'],
            operator: 'eq',
            value: true,
          },
        },
      ],
    });
    expect(plan.structuredRoots).toEqual(['metadata']);
  });

  it('keeps canonical nesting distinct from exact literal dotted-key segments', () => {
    const canonical = planStructuredTraceQuery(
      parseStructuredTraceQueryRequest({
        timeRange: baseTimeRange,
        where: structuredComparison('metadata.customer.plan', 'pro'),
      }),
    );
    const exact = planStructuredTraceQuery(
      parseStructuredTraceQueryRequest({
        timeRange: baseTimeRange,
        where: structuredComparison(['metadata', 'customer.plan'], 'pro'),
      }),
    );

    expect(canonical.where).toMatchObject({ field: ['metadata', 'customer', 'plan'], value: 'pro' });
    expect(exact.where).toMatchObject({ field: ['metadata', 'customer.plan'], value: 'pro' });
    expect(canonical.binding).not.toBe(exact.binding);
  });

  it('enforces the structured string-literal UTF-8 byte limit', () => {
    const atLimit = 'é'.repeat(TRACE_QUERY_MAX_STRING_BYTES / 2);
    const request = (literal: string) => ({
      timeRange: baseTimeRange,
      where: structuredComparison('metadata.customer.plan', literal),
    });

    expect(Buffer.byteLength(atLimit, 'utf8')).toBe(TRACE_QUERY_MAX_STRING_BYTES);
    expect(() => parseStructuredTraceQueryRequest(request(atLimit))).not.toThrow();
    expect(() => parseStructuredTraceQueryRequest(request(`${atLimit}a`))).toThrow(TraceQueryValidationError);
  });

  it('keeps deprecated grouped requests supported', () => {
    const plan = planStructuredTraceQuery(
      parseStructuredTraceQueryRequest({
        timeRange: baseTimeRange,
        group: { by: ['threadId'] },
      }),
    );

    expect(plan).toMatchObject({
      result: 'groups',
      paginationMode: 'keyset',
      orderBy: { field: 'threadId', direction: 'asc' },
    });
  });

  it('keeps canonical field and collection operator semantics', () => {
    const plan = planStructuredTraceQuery(
      parseStructuredTraceQueryRequest({
        timeRange: baseTimeRange,
        where: {
          op: 'and',
          args: [
            structuredComparison('environment', 'production'),
            { op: 'includes', path: 'tags', value: 'release' },
            {
              spans: {
                some: {
                  op: 'gt',
                  left: { path: 'durationMs' },
                  right: { literal: 100 },
                },
              },
            },
          ],
        },
      }),
    );
    expect(plan.where).toMatchObject({
      type: 'boolean',
      args: [
        { type: 'comparison', field: 'environment', value: 'production' },
        { type: 'collection', field: 'tags', operator: 'includes', value: 'release' },
        { collection: 'spans', predicate: { field: 'durationMs', operator: 'gt', value: 100 } },
      ],
    });
    expect(plan.structuredRoots).toEqual([]);
  });

  it('plans nested metadata in thread trace selections and thread predicates', () => {
    const plan = planStructuredThreadQuery(
      parseStructuredQueryThreadsInput({
        traces: {
          timeRange: baseTimeRange,
          where: structuredComparison('metadata.customer.plan', 'pro'),
        },
        where: {
          traces: { some: structuredComparison(['metadata', 'literal.dot'], true) },
        },
      }),
    );
    expect(plan.traces.where).toMatchObject({ field: ['metadata', 'customer', 'plan'], value: 'pro' });
    expect(plan.where).toEqual({
      type: 'relation',
      collection: 'traces',
      quantifier: 'some',
      predicate: {
        type: 'comparison',
        field: ['metadata', 'literal.dot'],
        operator: 'eq',
        value: true,
      },
    });
    expect(plan.structuredRoots).toEqual(['metadata']);
  });

  it('rejects unknown structured roots before storage execution', () => {
    expect(() =>
      planStructuredTraceQuery(
        parseStructuredTraceQueryRequest({
          timeRange: baseTimeRange,
          where: structuredComparison('attributes.customer.plan', 'pro'),
        }),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<TraceQueryValidationError>>({
        issues: [expect.objectContaining({ code: 'field_not_allowed' })],
      }),
    );
  });

  it('rejects unknown structured roots in thread predicates', () => {
    expect(() =>
      planStructuredThreadQuery(
        parseStructuredQueryThreadsInput({
          traces: { timeRange: baseTimeRange },
          where: { traces: { some: structuredComparison('attributes.customer.plan', 'pro') } },
        }),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<TraceQueryValidationError>>({
        issues: [expect.objectContaining({ code: 'field_not_allowed' })],
      }),
    );
  });

  it('rejects over-complex trace and nested thread predicates through public parsers', () => {
    const overDepth = nestedStructuredNotPredicate(TRACE_QUERY_MAX_DEPTH + 1);

    for (const parse of [
      () => parseStructuredTraceQueryRequest({ timeRange: baseTimeRange, where: overDepth }),
      () =>
        parseStructuredQueryThreadsInput({
          traces: { timeRange: baseTimeRange },
          where: { traces: { some: overDepth } },
        }),
    ]) {
      expect(parse).toThrowError(
        expect.objectContaining<Partial<TraceQueryValidationError>>({
          issues: [expect.objectContaining({ code: 'predicate_too_complex' })],
        }),
      );
    }
  });

  it.each([
    { set: ['pro', 'free', 'pro'], expected: ['free', 'pro'] },
    { set: [10, 2, 10], expected: [2, 10] },
    { set: [true, false, true], expected: [false, true] },
  ])('preserves $expected scalar membership types', ({ set, expected }) => {
    const plan = planStructuredTraceQuery(
      parseStructuredTraceQueryRequest({
        timeRange: baseTimeRange,
        where: { op: 'in', value: { path: 'metadata.membership.value' }, set },
      }),
    );
    expect(plan.where).toEqual({
      type: 'membership',
      field: ['metadata', 'membership', 'value'],
      operator: 'in',
      values: expected,
    });
  });

  it('rejects mixed scalar membership types', () => {
    expect(() =>
      planStructuredTraceQuery(
        parseStructuredTraceQueryRequest({
          timeRange: baseTimeRange,
          where: { op: 'in', value: { path: 'metadata.membership.value' }, set: ['pro', 1] },
        }),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<TraceQueryValidationError>>({
        issues: [expect.objectContaining({ code: 'invalid_literal', path: ['where', 'set'] })],
      }),
    );
  });

  it('normalizes membership sets and object insertion order for stable bindings', () => {
    const setPlans = [
      [true, false, true],
      [false, true],
    ].map(set =>
      planStructuredTraceQuery(
        parseStructuredTraceQueryRequest({
          timeRange: baseTimeRange,
          where: { op: 'in', value: { path: 'metadata.flags.enabled' }, set },
        }),
      ),
    );
    expect(setPlans[0]?.binding).toBe(setPlans[1]?.binding);

    const leftFirst = structuredComparison('metadata.customer.plan', 'pro');
    const rightFirst = {
      right: { literal: 'pro' },
      left: { path: 'metadata.customer.plan' },
      op: 'eq' as const,
    };
    const objectPlans = [leftFirst, rightFirst].map(where =>
      planStructuredTraceQuery(parseStructuredTraceQueryRequest({ timeRange: baseTimeRange, where })),
    );
    expect(objectPlans[0]?.binding).toBe(objectPlans[1]?.binding);
  });

  it('uses presence operators for missing/null/object/array semantics and rejects scalar null/object/array literals', () => {
    const plan = planStructuredTraceQuery(
      parseStructuredTraceQueryRequest({
        timeRange: baseTimeRange,
        where: { op: 'notExists', path: 'metadata.customer.plan' },
      }),
    );
    expect(plan.where).toEqual({
      type: 'presence',
      field: ['metadata', 'customer', 'plan'],
      operator: 'notExists',
    });
    expect(() =>
      planStructuredTraceQuery(
        parseStructuredTraceQueryRequest({
          timeRange: baseTimeRange,
          where: structuredComparison('metadata.customer.plan', null),
        }),
      ),
    ).toThrowError(expect.objectContaining({ issues: [expect.objectContaining({ code: 'invalid_literal' })] }));
    expect(
      parseStructuredTraceQueryRequest.bind(undefined, {
        timeRange: baseTimeRange,
        where: structuredComparison('metadata.customer.plan', { nested: true }),
      }),
    ).toThrow(TraceQueryValidationError);
    expect(
      parseStructuredTraceQueryRequest.bind(undefined, {
        timeRange: baseTimeRange,
        where: structuredComparison('metadata.customer.plan', ['pro']),
      }),
    ).toThrow(TraceQueryValidationError);
  });

  it('copies tenant scope into trace, thread, and discovery plans', () => {
    const scope = { organizationId: 'org-1', resourceId: 'resource-1' };
    const trace = planStructuredTraceQuery(parseStructuredTraceQueryRequest({ timeRange: baseTimeRange }), { scope });
    const thread = planStructuredThreadQuery(
      parseStructuredQueryThreadsInput({ traces: { timeRange: baseTimeRange } }),
      { scope },
    );
    const fields = planStructuredTraceQueryObservedFields(
      parseGetStructuredTraceQueryFieldsArgs({ timeRange: baseTimeRange, predicateScope: 'trace' }),
      { scope },
    );
    const values = planStructuredTraceQueryValues(
      parseGetStructuredTraceQueryValuesArgs({
        timeRange: baseTimeRange,
        predicateScope: 'trace',
        path: ['metadata', 'customer.plan'],
      }),
      { scope },
    );
    expect(trace.scope).toEqual(scope);
    expect(thread.scope).toEqual(scope);
    expect(fields.scope).toEqual(scope);
    expect(values).toMatchObject({
      scope,
      path: ['metadata', 'customer.plan'],
      structuredRoots: ['metadata'],
    });
  });
});

describe('structured trace-query pagination and cursors', () => {
  it('produces representative keyset, page, delta, group, and thread plans', () => {
    const keyset = planStructuredTraceQuery(parseStructuredTraceQueryRequest({ timeRange: baseTimeRange }));
    const page = planStructuredTraceQuery(
      parseStructuredTraceQueryRequest({ timeRange: baseTimeRange, pagination: { page: 2, perPage: 25 } }),
    );
    const delta = planStructuredTraceQuery(
      parseStructuredTraceQueryRequest({ timeRange: baseTimeRange, mode: 'delta' }),
    );
    const groups = planStructuredTraceQuery(
      parseStructuredTraceQueryRequest({ timeRange: baseTimeRange, group: { by: ['threadId'] } }),
    );
    const threads = planStructuredThreadQuery(
      parseStructuredQueryThreadsInput({ traces: { timeRange: baseTimeRange }, page: { limit: 25 } }),
    );

    expect(keyset).toMatchObject({ result: 'traces', paginationMode: 'keyset', limit: 100 });
    expect(page).toMatchObject({ result: 'traces', paginationMode: 'page', page: 2, perPage: 25 });
    expect(delta).toMatchObject({ result: 'traces', paginationMode: 'delta' });
    expect(groups).toMatchObject({ result: 'groups', paginationMode: 'keyset', limit: 100 });
    expect(threads).toMatchObject({ result: 'threads', limit: 25 });
  });

  it('round-trips keyset cursors and rejects structured binding mismatches', () => {
    const where = structuredComparison('metadata.customer.plan', 'pro');
    const scope = { organizationId: 'org-1', resourceId: 'resource-1' };
    const options = { scope, authorizationBinding: 'authorization-a' };
    const plan = planStructuredTraceQuery(
      parseStructuredTraceQueryRequest({ timeRange: baseTimeRange, where }),
      options,
    );
    if (plan.result !== 'traces' || plan.paginationMode !== 'keyset') throw new Error('Expected keyset trace plan');
    const after = encodeStructuredTraceQueryCursor(plan, {
      result: 'traces',
      sortValue: '2026-08-15T00:00:00.000Z',
      traceId: 'trace-1',
    });
    const resume = (resumeWhere: ReturnType<typeof structuredComparison>, resumeOptions = options) =>
      planStructuredTraceQuery(
        parseStructuredTraceQueryRequest({ timeRange: baseTimeRange, where: resumeWhere, page: { after } }),
        resumeOptions,
      );

    expect(resume(where).cursor).toEqual({ sortValue: '2026-08-15T00:00:00.000Z', traceId: 'trace-1' });
    expect(() => resume(structuredComparison(['metadata', 'customer.plan'], 'pro'))).toThrow(TraceQueryCursorError);
    expect(() => resume(where, { ...options, scope: { organizationId: 'org-2' } })).toThrow(TraceQueryCursorError);
    expect(() => resume(where, { ...options, authorizationBinding: 'authorization-b' })).toThrow(TraceQueryCursorError);
    expect(() =>
      planStructuredTraceQuery(
        parseStructuredTraceQueryRequest({ timeRange: baseTimeRange, where, page: { after: 'malformed' } }),
        options,
      ),
    ).toThrow(TraceQueryCursorError);
  });

  it('round-trips delta cursors and rejects path and adapter mismatches', () => {
    const where = structuredComparison('metadata.customer.plan', 'pro');
    const page = planStructuredTraceQuery(
      parseStructuredTraceQueryRequest({ timeRange: baseTimeRange, where, pagination: {} }),
    );
    if (page.paginationMode !== 'page') throw new Error('Expected numbered-page trace plan');
    const after = encodeStructuredTraceQueryDeltaCursor(page, 'pg', 'watermark-1');
    const delta = planStructuredTraceQuery(
      parseStructuredTraceQueryRequest({ timeRange: baseTimeRange, where, mode: 'delta', after }),
    );
    if (delta.paginationMode !== 'delta') throw new Error('Expected delta trace plan');

    expect(delta.deltaCursor).toEqual({ adapter: 'pg', watermark: 'watermark-1' });
    expect(getStructuredTraceQueryDeltaWatermark(delta, 'pg')).toBe('watermark-1');
    expect(() => getStructuredTraceQueryDeltaWatermark(delta, 'duckdb')).toThrow(TraceQueryCursorError);
    expect(() =>
      planStructuredTraceQuery(
        parseStructuredTraceQueryRequest({
          timeRange: baseTimeRange,
          where: structuredComparison(['metadata', 'customer.plan'], 'pro'),
          mode: 'delta',
          after,
        }),
      ),
    ).toThrow(TraceQueryCursorError);
  });
});

describe('structured trace-query discovery', () => {
  describe.each(structuredDiscoveryParsers)('$name parser', ({ parse }) => {
    it.each([
      {
        timeRange: { from: '2026-09-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
        code: 'invalid_time_range',
        message: '`from` must be earlier than `to`',
      },
      {
        timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-02T00:00:00Z' },
        code: 'time_range_too_large',
        message: 'The time range cannot exceed 31 days',
      },
    ])('preserves the $code issue', ({ timeRange, code, message }) => {
      expect(() => parse(timeRange)).toThrowError(
        expect.objectContaining<Partial<TraceQueryValidationError>>({
          issues: [{ code, path: ['timeRange'], message }],
        }),
      );
    });

    it('accepts an exact 31-day range', () => {
      expect(() => parse(baseTimeRange)).not.toThrow();
    });
  });

  it('derives configured roots and exact value paths inside planners', () => {
    const fields = planStructuredTraceQueryObservedFields(
      parseGetStructuredTraceQueryFieldsArgs({ timeRange: baseTimeRange, predicateScope: 'spans' }),
    );
    const values = planStructuredTraceQueryValues(
      parseGetStructuredTraceQueryValuesArgs({
        timeRange: baseTimeRange,
        predicateScope: 'feedback',
        path: ['metadata', 'literal.dot'],
      }),
    );
    expect(fields.structuredRoots).toEqual(['metadata']);
    expect(values.structuredRoots).toEqual(['metadata']);
    expect(values.path).toEqual(['metadata', 'literal.dot']);
  });

  it('keeps canonical non-metadata value discovery unstructured', () => {
    const values = planStructuredTraceQueryValues(
      parseGetStructuredTraceQueryValuesArgs({
        timeRange: baseTimeRange,
        predicateScope: 'trace',
        path: 'environment',
      }),
    );

    expect(values.path).toBe('environment');
    expect(values.structuredRoots).toEqual([]);
  });

  it('preserves observed scalar kinds and typed values', () => {
    const fields = getStructuredTraceQueryFieldsResponseSchema.parse({
      canonicalFields: [],
      observedFields: [
        createStructuredTraceQueryObservedFieldDescriptor('metadata.customer.plan', 'string', 2),
        createStructuredTraceQueryObservedFieldDescriptor('metadata.retries', 'number', 1),
        createStructuredTraceQueryObservedFieldDescriptor(['metadata', 'literal.dot'], 'boolean', 1),
      ],
      observedFieldsTruncated: false,
    });
    const values = getStructuredTraceQueryValuesResponseSchema.parse({
      values: [
        { value: 'pro', count: 2 },
        { value: 3, count: 1 },
        { value: true, count: 1 },
      ],
      valuesTruncated: false,
    });
    expect(fields.observedFields.map(field => field.valueKind)).toEqual(['string', 'number', 'boolean']);
    expect(values.values.map(value => value.value)).toEqual(['pro', 3, true]);
    expect(
      getStructuredTraceQueryFieldsResponseSchema.safeParse({
        canonicalFields: [],
        observedFields: [
          {
            path: 'metadata.enabled',
            valueKind: 'boolean',
            operators: ['gt'],
            valueSuggestions: true,
            occurrences: 1,
          },
        ],
        observedFieldsTruncated: false,
      }).success,
    ).toBe(false);
  });

  it('rejects value discovery for unknown roots', () => {
    expect(() =>
      planStructuredTraceQueryValues(
        parseGetStructuredTraceQueryValuesArgs({
          timeRange: baseTimeRange,
          predicateScope: 'trace',
          path: 'attributes.customer.plan',
        }),
      ),
    ).toThrowError(expect.objectContaining({ issues: [expect.objectContaining({ code: 'field_not_allowed' })] }));
  });
});

describe('structured storage capabilities', () => {
  class TraceOnlyStorage extends ObservabilityStorage {
    getStructuredTraceQueryFeatures() {
      return ['trace-query-structured-paths'] as const;
    }

    async queryStructuredTraces() {
      return { traces: [], page: { next: null } };
    }
  }

  class ThreadStorage extends ObservabilityStorage {
    getStructuredTraceQueryFeatures() {
      return ['thread-query-structured-paths'] as const;
    }

    async queryStructuredThreads() {
      return { threads: [], page: { next: null } };
    }
  }

  class DiscoveryStorage extends ObservabilityStorage {
    getStructuredTraceQueryFeatures() {
      return ['trace-query-structured-discovery'] as const;
    }

    async getStructuredTraceQueryObservedFields() {
      return { observedFields: [], observedFieldsTruncated: false };
    }

    async getStructuredTraceQueryValues() {
      return { values: [], valuesTruncated: false };
    }
  }

  class PartialDiscoveryStorage extends ObservabilityStorage {
    getStructuredTraceQueryFeatures() {
      return ['trace-query-structured-discovery'] as const;
    }

    async getStructuredTraceQueryObservedFields() {
      return { observedFields: [], observedFieldsTruncated: false };
    }
  }

  class FeatureOnlyStorage extends ObservabilityStorage {
    getStructuredTraceQueryFeatures() {
      return ['trace-query-structured-paths'] as const;
    }
  }

  class MethodOnlyStorage extends ObservabilityStorage {
    getStructuredTraceQueryFeatures() {
      return ['thread-query-structured-paths'] as const;
    }

    async queryStructuredTraces() {
      return { traces: [], page: { next: null } };
    }
  }

  it('narrows only the capability whose exact feature and methods are present', () => {
    const traceOnly = new TraceOnlyStorage();
    expect(supportsStructuredTraceQueryExecution(traceOnly)).toBe(true);
    expect(supportsStructuredThreadQueryExecution(traceOnly)).toBe(false);
    expect(supportsStructuredTraceQueryDiscovery(traceOnly)).toBe(false);

    const thread = new ThreadStorage();
    expect(supportsStructuredTraceQueryExecution(thread)).toBe(false);
    expect(supportsStructuredThreadQueryExecution(thread)).toBe(true);
    expect(supportsStructuredTraceQueryDiscovery(thread)).toBe(false);

    const discovery = new DiscoveryStorage();
    expect(supportsStructuredTraceQueryExecution(discovery)).toBe(false);
    expect(supportsStructuredThreadQueryExecution(discovery)).toBe(false);
    expect(supportsStructuredTraceQueryDiscovery(discovery)).toBe(true);

    expect(supportsStructuredTraceQueryDiscovery(new PartialDiscoveryStorage())).toBe(false);
    expect(supportsStructuredTraceQueryExecution(new FeatureOnlyStorage())).toBe(false);
    expect(supportsStructuredTraceQueryExecution(new MethodOnlyStorage())).toBe(false);
  });

  it('does not require legacy storage subclasses to implement structured methods', () => {
    const legacy = new ObservabilityStorage();
    expect(supportsStructuredTraceQueryExecution(legacy)).toBe(false);
    expect(supportsStructuredThreadQueryExecution(legacy)).toBe(false);
    expect(supportsStructuredTraceQueryDiscovery(legacy)).toBe(false);
  });
});
