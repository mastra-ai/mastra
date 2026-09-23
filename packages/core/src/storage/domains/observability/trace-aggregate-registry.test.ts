import { describe, expect, it } from 'vitest';
import {
  getTraceAggregateDimensionDescriptors,
  getTraceAggregateDimensionRule,
  getTraceAggregateMeasureDescriptors,
  isTraceAggregateCanonicalDimension,
  isTraceAggregateCanonicalMeasure,
  isTraceAggregateCountDistinctField,
  isTraceAggregateDimension,
  isTraceQueryMetadataPath,
  parseTraceAggregateMeasure,
  TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX,
  TRACE_AGGREGATE_DIMENSION_REGISTRY,
  TRACE_AGGREGATE_IDENTITY_FIELDS,
  TRACE_AGGREGATE_MAX_DIMENSIONS,
  TRACE_AGGREGATE_MEASURE_REGISTRY,
  TRACE_AGGREGATE_METADATA_DIMENSION_RULE,
  TRACE_QUERY_FIELD_REGISTRY,
  TRACE_QUERY_MAX_PATH_BYTES,
} from '../../index';

const DECISION_4_TRACE_DIMENSIONS = [
  'entityType',
  'entityName',
  'environment',
  'status',
  'serviceName',
  'executionSource',
  'threadId',
  'resourceId',
  'userId',
  'sessionId',
  'organizationId',
  'experimentId',
];

const DECISION_3_MEASURES = [
  'count',
  'duration.avg',
  'duration.min',
  'duration.max',
  'duration.p50',
  'duration.p90',
  'duration.p95',
  'duration.p99',
  'errorCount',
  'errorRate',
];

const PROTOTYPE_KEYS = ['constructor', '__proto__', 'toString', 'hasOwnProperty'];

describe('trace aggregate dimension registry', () => {
  it('declares exactly the Decision 4 trace-scope allowlist, in spec order', () => {
    expect(Object.keys(TRACE_AGGREGATE_DIMENSION_REGISTRY)).toEqual(DECISION_4_TRACE_DIMENSIONS);
    expect(TRACE_AGGREGATE_MAX_DIMENSIONS).toBe(2);
    for (const rule of Object.values(TRACE_AGGREGATE_DIMENSION_REGISTRY)) {
      expect(rule).toEqual({ valueKind: 'string' });
    }
    expect(TRACE_AGGREGATE_METADATA_DIMENSION_RULE).toEqual({ valueKind: 'string' });
  });

  it('accepts every canonical dimension for groupBy and countDistinct', () => {
    for (const path of DECISION_4_TRACE_DIMENSIONS) {
      expect(isTraceAggregateCanonicalDimension(path), path).toBe(true);
      expect(isTraceAggregateDimension(path), path).toBe(true);
      expect(isTraceAggregateCountDistinctField(path), path).toBe(true);
      expect(getTraceAggregateDimensionRule(path)).toEqual({ valueKind: 'string' });
    }
  });

  it('accepts top-level metadata keys, including promoted and sensitive names', () => {
    for (const path of ['metadata.tenant', 'metadata.requestId', 'metadata.api_key']) {
      expect(isTraceAggregateCanonicalDimension(path), path).toBe(false);
      expect(isTraceAggregateDimension(path), path).toBe(true);
      expect(isTraceAggregateCountDistinctField(path), path).toBe(true);
      expect(getTraceAggregateDimensionRule(path)).toBe(TRACE_AGGREGATE_METADATA_DIMENSION_RULE);
    }
  });

  it('rejects nested, empty, bare, and oversized metadata paths as dimensions', () => {
    const oversized = `metadata.${'k'.repeat(TRACE_QUERY_MAX_PATH_BYTES)}`;
    for (const path of ['metadata.customer.id', 'metadata.a.b.c', 'metadata.', 'metadata', oversized]) {
      expect(isTraceAggregateDimension(path), path).toBe(false);
      expect(isTraceAggregateCountDistinctField(path), path).toBe(false);
      expect(getTraceAggregateDimensionRule(path), path).toBeUndefined();
    }

    // The dimension rule is registry-local: it delegates to the top-level metadata path rule
    // and does not consult the `where` planner. Nested metadata support in `where` (OBS-356)
    // lands in a different code path and must not change this result.
    expect(isTraceAggregateDimension('metadata.customer.id')).toBe(isTraceQueryMetadataPath('metadata.customer.id'));
    expect(isTraceAggregateDimension('metadata.customer.id')).toBe(false);
  });

  it('rejects identity fields as dimensions', () => {
    expect(TRACE_AGGREGATE_IDENTITY_FIELDS).toEqual(['traceId', 'spanId', 'runId', 'requestId']);
    for (const field of TRACE_AGGREGATE_IDENTITY_FIELDS) {
      expect(isTraceAggregateDimension(field), field).toBe(false);
      expect(Object.keys(TRACE_AGGREGATE_DIMENSION_REGISTRY)).not.toContain(field);
    }
  });

  it('rejects where-only fields, span-scope fields, and attributes', () => {
    for (const field of ['startedAt', 'endedAt']) {
      expect(Object.keys(TRACE_QUERY_FIELD_REGISTRY.trace)).toContain(field);
      expect(isTraceAggregateDimension(field), field).toBe(false);
      expect(isTraceAggregateCountDistinctField(field), field).toBe(false);
    }
    for (const field of ['name', 'spanType', 'model', 'provider', 'attributes.model', 'durationMs', 'source']) {
      expect(isTraceAggregateDimension(field), field).toBe(false);
      expect(isTraceAggregateCountDistinctField(field), field).toBe(false);
    }
  });

  it('allows traceId for countDistinct but no other identity field', () => {
    expect(isTraceAggregateDimension('traceId')).toBe(false);
    expect(isTraceAggregateCountDistinctField('traceId')).toBe(true);
    for (const field of ['spanId', 'runId', 'requestId']) {
      expect(isTraceAggregateCountDistinctField(field), field).toBe(false);
    }
    expect(isTraceAggregateCountDistinctField('metadata.tenant')).toBe(true);
    expect(isTraceAggregateCountDistinctField('metadata.a.b')).toBe(false);
  });

  it('rejects prototype keys', () => {
    for (const key of PROTOTYPE_KEYS) {
      expect(isTraceAggregateCanonicalDimension(key), key).toBe(false);
      expect(isTraceAggregateDimension(key), key).toBe(false);
      expect(isTraceAggregateCountDistinctField(key), key).toBe(false);
      expect(getTraceAggregateDimensionRule(key), key).toBeUndefined();
    }
  });

  it('lists dimension descriptors in registry order', () => {
    const descriptors = getTraceAggregateDimensionDescriptors();
    expect(descriptors.map(descriptor => descriptor.path)).toEqual(DECISION_4_TRACE_DIMENSIONS);
    for (const descriptor of descriptors) {
      expect(descriptor).toEqual({ path: descriptor.path, valueKind: 'string' });
    }
  });
});

describe('trace aggregate measure registry', () => {
  it('declares exactly the Decision 3 v1 measures, in spec order', () => {
    expect(Object.keys(TRACE_AGGREGATE_MEASURE_REGISTRY)).toEqual(DECISION_3_MEASURES);
    expect(TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX).toBe('countDistinct.');
  });

  it('marks only percentiles as approximate and assigns units', () => {
    const approximate = Object.entries(TRACE_AGGREGATE_MEASURE_REGISTRY)
      .filter(([, rule]) => rule.approximate)
      .map(([name]) => name);
    expect(approximate).toEqual(['duration.p50', 'duration.p90', 'duration.p95', 'duration.p99']);

    expect(TRACE_AGGREGATE_MEASURE_REGISTRY.count).toEqual({ kind: 'count', unit: 'count', approximate: false });
    expect(TRACE_AGGREGATE_MEASURE_REGISTRY.errorCount).toEqual({ kind: 'error', unit: 'count', approximate: false });
    expect(TRACE_AGGREGATE_MEASURE_REGISTRY.errorRate).toEqual({ kind: 'error', unit: 'ratio', approximate: false });
    for (const statistic of ['avg', 'min', 'max', 'p50', 'p90', 'p95', 'p99'] as const) {
      expect(TRACE_AGGREGATE_MEASURE_REGISTRY[`duration.${statistic}`]).toEqual({
        kind: 'duration',
        statistic,
        unit: 'milliseconds',
        approximate: statistic.startsWith('p'),
      });
    }
  });

  it('parses canonical measures', () => {
    for (const name of DECISION_3_MEASURES) {
      expect(isTraceAggregateCanonicalMeasure(name), name).toBe(true);
      expect(parseTraceAggregateMeasure(name)).toEqual({
        type: 'canonical',
        measure: name,
        rule: TRACE_AGGREGATE_MEASURE_REGISTRY[name as keyof typeof TRACE_AGGREGATE_MEASURE_REGISTRY],
      });
    }
  });

  it('parses countDistinct over traceId, canonical dimensions, and top-level metadata', () => {
    expect(parseTraceAggregateMeasure('countDistinct.traceId')).toEqual({ type: 'countDistinct', field: 'traceId' });
    expect(parseTraceAggregateMeasure('countDistinct.threadId')).toEqual({ type: 'countDistinct', field: 'threadId' });
    expect(parseTraceAggregateMeasure('countDistinct.metadata.tenant')).toEqual({
      type: 'countDistinct',
      field: 'metadata.tenant',
    });
    expect(isTraceAggregateCanonicalMeasure('countDistinct.traceId')).toBe(false);
  });

  it('rejects unknown, malformed, and out-of-scope measures', () => {
    for (const name of [
      'countDistinct.metadata.a.b',
      'countDistinct.spanId',
      'countDistinct.runId',
      'countDistinct.requestId',
      'countDistinct.startedAt',
      'countDistinct',
      'countDistinct.',
      'countdistinct.traceId',
      'duration.p75',
      'duration',
      'tokens.input.sum',
      'cost.sum',
      'errorrate',
      'Count',
      '',
      ...PROTOTYPE_KEYS,
      ...PROTOTYPE_KEYS.map(key => `${TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX}${key}`),
    ]) {
      expect(isTraceAggregateCanonicalMeasure(name), name).toBe(false);
      expect(parseTraceAggregateMeasure(name), name).toBeUndefined();
    }
  });

  it('lists measure descriptors in registry order with rule fields', () => {
    const descriptors = getTraceAggregateMeasureDescriptors();
    expect(descriptors.map(descriptor => descriptor.name)).toEqual(DECISION_3_MEASURES);
    expect(descriptors[0]).toEqual({ name: 'count', kind: 'count', unit: 'count', approximate: false });
    expect(descriptors.find(descriptor => descriptor.name === 'duration.p95')).toEqual({
      name: 'duration.p95',
      kind: 'duration',
      statistic: 'p95',
      unit: 'milliseconds',
      approximate: true,
    });
    expect(descriptors.find(descriptor => descriptor.name === 'errorRate')).toEqual({
      name: 'errorRate',
      kind: 'error',
      unit: 'ratio',
      approximate: false,
    });
  });
});
