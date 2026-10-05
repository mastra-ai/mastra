import { describe, expect, it } from 'vitest';
import { TokenMetrics } from '../../../observability/types/metrics';
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
  TRACE_AGGREGATE_COST_METRIC_NAMES,
  TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX,
  TRACE_AGGREGATE_DIMENSION_REGISTRY,
  TRACE_AGGREGATE_FIXED_MEASURES,
  TRACE_AGGREGATE_IDENTITY_FIELDS,
  TRACE_AGGREGATE_MAX_DIMENSIONS,
  TRACE_AGGREGATE_MEASURE_REGISTRY,
  TRACE_AGGREGATE_METADATA_DIMENSION_RULE,
  TRACE_AGGREGATE_USAGE_METRIC_NAMES,
  TRACE_QUERY_FIELD_REGISTRY,
  TRACE_QUERY_MAX_PATH_BYTES,
} from '../../index';

const TRACE_DIMENSIONS = [
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

const ROOT_MEASURES = [
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

const TOKEN_COST_MEASURES = [
  'tokens.input.sum',
  'tokens.input.avg',
  'tokens.output.sum',
  'tokens.output.avg',
  'tokens.total.sum',
  'tokens.total.avg',
  'tokens.reasoning.sum',
  'tokens.reasoning.avg',
  'tokens.cached.sum',
  'tokens.cached.avg',
  'cost.sum',
  'cost.avg',
];

const ALL_MEASURES = [...ROOT_MEASURES, ...TOKEN_COST_MEASURES];

const PROTOTYPE_KEYS = ['constructor', '__proto__', 'toString', 'hasOwnProperty'];

describe('trace aggregate dimension registry', () => {
  it('declares exactly the trace-scope dimension allowlist, in order', () => {
    expect(Object.keys(TRACE_AGGREGATE_DIMENSION_REGISTRY)).toEqual(TRACE_DIMENSIONS);
    expect(TRACE_AGGREGATE_MAX_DIMENSIONS).toBe(2);
    for (const rule of Object.values(TRACE_AGGREGATE_DIMENSION_REGISTRY)) {
      expect(rule).toEqual({ valueKind: 'string' });
    }
    expect(TRACE_AGGREGATE_METADATA_DIMENSION_RULE).toEqual({ valueKind: 'string' });
  });

  it('accepts every canonical dimension for groupBy and countDistinct', () => {
    for (const path of TRACE_DIMENSIONS) {
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
    expect(descriptors.map(descriptor => descriptor.path)).toEqual(TRACE_DIMENSIONS);
    for (const descriptor of descriptors) {
      expect(descriptor).toEqual({ path: descriptor.path, valueKind: 'string' });
    }
  });
});

describe('trace aggregate measure registry', () => {
  it('declares exactly the root, token, and cost measures, in order', () => {
    expect(Object.keys(TRACE_AGGREGATE_MEASURE_REGISTRY)).toEqual(ALL_MEASURES);
    expect(TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX).toBe('countDistinct.');
  });

  it('matches the fixed-measure enum in the request schema', () => {
    expect(Object.keys(TRACE_AGGREGATE_MEASURE_REGISTRY)).toEqual([...TRACE_AGGREGATE_FIXED_MEASURES]);
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

  it('maps token and cost measures to their token metric names', () => {
    expect(TokenMetrics.TOTAL_INPUT).toBe('mastra_model_total_input_tokens');
    expect(TokenMetrics.TOTAL_OUTPUT).toBe('mastra_model_total_output_tokens');
    expect(TokenMetrics.OUTPUT_REASONING).toBe('mastra_model_output_reasoning_tokens');
    expect(TokenMetrics.INPUT_CACHE_READ).toBe('mastra_model_input_cache_read_tokens');

    const expected = {
      input: [TokenMetrics.TOTAL_INPUT],
      output: [TokenMetrics.TOTAL_OUTPUT],
      total: [TokenMetrics.TOTAL_INPUT, TokenMetrics.TOTAL_OUTPUT],
      reasoning: [TokenMetrics.OUTPUT_REASONING],
      cached: [TokenMetrics.INPUT_CACHE_READ],
    } as const;
    for (const [field, metricNames] of Object.entries(expected)) {
      for (const statistic of ['sum', 'avg'] as const) {
        const name = `tokens.${field}.${statistic}` as keyof typeof TRACE_AGGREGATE_MEASURE_REGISTRY;
        expect(TRACE_AGGREGATE_MEASURE_REGISTRY[name], name).toEqual({
          kind: 'tokens',
          statistic,
          unit: 'tokens',
          approximate: false,
          metricNames,
        });
      }
    }

    // Cost is read from the total rows only: they already hold the sum of their detail rows' costs.
    expect(TRACE_AGGREGATE_COST_METRIC_NAMES).toEqual([TokenMetrics.TOTAL_INPUT, TokenMetrics.TOTAL_OUTPUT]);
    for (const statistic of ['sum', 'avg'] as const) {
      expect(TRACE_AGGREGATE_MEASURE_REGISTRY[`cost.${statistic}`]).toEqual({
        kind: 'cost',
        statistic,
        unit: 'currency',
        approximate: false,
        metricNames: TRACE_AGGREGATE_COST_METRIC_NAMES,
      });
    }

    const referenced = new Set(
      Object.values(TRACE_AGGREGATE_MEASURE_REGISTRY).flatMap(rule => ('metricNames' in rule ? rule.metricNames : [])),
    );
    expect(new Set(TRACE_AGGREGATE_USAGE_METRIC_NAMES)).toEqual(referenced);
  });

  it('parses canonical measures', () => {
    for (const name of ALL_MEASURES) {
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
      'tokens.input',
      'tokens.input.max',
      'tokens.cost.sum',
      'cost',
      'cost.coverage',
      'cost.unit',
      'costUnit',
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
    expect(descriptors.map(descriptor => descriptor.name)).toEqual(ALL_MEASURES);
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
    expect(descriptors.find(descriptor => descriptor.name === 'cost.avg')).toEqual({
      name: 'cost.avg',
      kind: 'cost',
      statistic: 'avg',
      unit: 'currency',
      approximate: false,
    });
  });
});
