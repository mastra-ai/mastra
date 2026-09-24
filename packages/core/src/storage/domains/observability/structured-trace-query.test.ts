import { describe, expect, it } from 'vitest';
import { ObservabilityStorage } from './base';
import {
  STRUCTURED_TRACE_QUERY_MAX_PATH_SEGMENTS,
  createStructuredTraceQueryObservedFieldDescriptor,
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
import { TraceQueryValidationError } from './trace-query';

const baseTimeRange = {
  from: '2026-08-01T00:00:00Z',
  to: '2026-09-01T00:00:00Z',
};

const structuredComparison = (path: string | readonly ['metadata', string, ...string[]], literal: unknown) => ({
  op: 'eq' as const,
  left: { path },
  right: { literal },
});

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

  it('preserves exact literal dotted-key segments in trusted predicates', () => {
    const plan = planStructuredTraceQuery(
      parseStructuredTraceQueryRequest({
        timeRange: baseTimeRange,
        where: structuredComparison(['metadata', 'customer.plan'], 'legacy'),
      }),
    );
    expect(plan.where).toMatchObject({ field: ['metadata', 'customer.plan'], value: 'legacy' });
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
    expect(trace.scope).toEqual(scope);
    expect(thread.scope).toEqual(scope);
    expect(fields.scope).toEqual(scope);
  });
});

describe('structured trace-query discovery', () => {
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

    const discovery = new DiscoveryStorage();
    expect(supportsStructuredTraceQueryExecution(discovery)).toBe(false);
    expect(supportsStructuredThreadQueryExecution(discovery)).toBe(false);
    expect(supportsStructuredTraceQueryDiscovery(discovery)).toBe(true);

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
