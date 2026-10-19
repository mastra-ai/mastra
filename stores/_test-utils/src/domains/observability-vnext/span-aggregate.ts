import { TokenMetrics } from '@mastra/core/observability';
import { planSpanAggregate } from '@mastra/core/storage';
import type {
  SpanAggregateDimension,
  SpanAggregateRequest,
  SpanAggregateResponse,
  TraceQueryTenantScope,
  TrustedSpanAggregatePlan,
} from '@mastra/core/storage';

import { evaluateAggregate } from './trace-aggregate';
import type {
  AggregateScope,
  RawTraceAggregateMetric,
  TraceAggregateExpectedResponse,
  TraceAggregateFixtureData,
} from './trace-aggregate';
import { makeTraceQuerySpan as span, selectSpanQuerySpans, spanQueryDimensionValue } from './trace-query';
import type { RawTraceQuerySpan } from './trace-query';

/**
 * In-memory reference evaluator for `TrustedSpanAggregatePlan`.
 *
 * The population is `selectSpanQuerySpans`, so this evaluator aggregates exactly the spans
 * `querySpans()` pages through. Grouping, measures, `having`, ordering, limits, and buckets are
 * the trace evaluator's (`evaluateAggregate`); only the population, dimension values, and the
 * usage key — `(traceId, spanId)` instead of `traceId` — differ.
 */

const spanKey = (traceId: string, spanId: string) => `${traceId}\u0000${spanId}`;

const spanScope: AggregateScope = {
  dimensionValue: (row, dimension) => spanQueryDimensionValue(row, dimension as SpanAggregateDimension),
  usageKey: row => spanKey(row.traceId!, row.spanId),
  metricKey: metric =>
    metric.traceId === null || metric.spanId === null ? null : spanKey(metric.traceId, metric.spanId),
};

export function evaluateSpanAggregate(
  data: TraceAggregateFixtureData,
  plan: TrustedSpanAggregatePlan,
): SpanAggregateResponse {
  return evaluateAggregate(selectSpanQuerySpans(data, plan), data.metrics ?? [], plan, spanScope);
}

export function evaluateSpanAggregateRequest(
  data: TraceAggregateFixtureData,
  request: SpanAggregateRequest,
  scope?: TraceQueryTenantScope,
): SpanAggregateResponse {
  return evaluateSpanAggregate(data, planSpanAggregate(request, { scope }));
}

// ---------------------------------------------------------------------------------------------
// Shared fixture and conformance cases for `aggregateSpans()`.
//
// Expected responses are derived by hand from the table below — never by running the evaluator —
// so stores can be proven against an independent oracle. Window: 2026-08-01 – 2026-08-03.
//
// | trace | span        | type             | name             | dur   | entity       | parent  | root    | model attr  | notes                    |
// |-------|-------------|------------------|------------------|-------|--------------|---------|---------|-------------|--------------------------|
// | t1    | t1-root     | agent_run        | agent:support    | 10 s  | agent/support| –       | support |             | 08-01 00:00              |
// | t1    | t1-model    | model_generation | llm              | 2 s   | –            | support | support | gpt-4o      | older copy ran 9 s       |
// | t1    | t1-tool     | tool_call        | search           | 3 s   | tool/search  | support | support |             | error                    |
// | t2    | t2-root     | agent_run        | agent:billing    | 20 s  | agent/billing| –       | billing |             | 08-01 01:30              |
// | t2    | t2-model    | model_generation | llm              | 4 s   | –            | billing | billing | gpt-4o-mini |                          |
// | t2    | t2-tool     | tool_call        | search           | 1 s   | tool/search  | billing | billing |             |                          |
// | t3    | t3-root     | workflow_run     | workflow:nightly | 60 s  | wf/nightly   | –       | nightly |             | 08-02 00:00              |
// | t3    | t3-model    | model_generation | llm              | 6 s   | –            | nightly | nightly | (none)      |                          |
// | t3    | t3-pending  | tool_call        | search           | –     | tool/search  | nightly | nightly |             | pending: excluded        |
// | t4    | t4-late     | tool_call        | search           | 1 s   | tool/search  | –       | –       |             | 08-05: outside window    |
//
// Usage (input / output tokens, cost on total rows):
// - t1-model: 100 / 50, 0.25 + 0.5 usd. The output row is written twice under one metricId.
// - t2-model: 200 / 80, input priced 0.125 eur, output neither priced nor failed. A 1000-token input
//   row dated before the window is pruned.
// - t3-model: 40 / 10, input failed to price.
// - t1 also has a 999-token input row with no spanId: it belongs to the trace, not to any span.
// ---------------------------------------------------------------------------------------------

const spanRange = { from: '2026-08-01T00:00:00Z', to: '2026-08-03T00:00:00Z' };
const { TOTAL_INPUT: INPUT, TOTAL_OUTPUT: OUTPUT } = TokenMetrics;

const after = (startedAt: string, seconds: number) => new Date(Date.parse(startedAt) + seconds * 1000).toISOString();

interface SpanSpec {
  cursorId: number;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  spanType: string;
  name: string;
  startedAt: string;
  seconds: number | null;
  entity?: { type: string; name: string };
  parent?: { type: string; name: string };
  root: { type: string; name: string } | null;
  model?: string;
  error?: boolean;
  isPending?: boolean;
}

function fixtureSpan(spec: SpanSpec): RawTraceQuerySpan {
  return span(spec.cursorId, spec.traceId, spec.spanId, {
    parentSpanId: spec.parentSpanId ?? null,
    isPending: spec.isPending ?? false,
    name: spec.name,
    spanType: spec.spanType,
    attributes: spec.model ? { model: spec.model, provider: 'openai' } : null,
    error: spec.error ? { message: 'boom' } : null,
    startedAt: spec.startedAt,
    endedAt: spec.seconds === null ? null : after(spec.startedAt, spec.seconds),
    entityType: spec.entity?.type ?? null,
    entityName: spec.entity?.name ?? null,
    parentEntityType: spec.parent?.type ?? null,
    parentEntityName: spec.parent?.name ?? null,
    rootEntityType: spec.root?.type ?? null,
    rootEntityName: spec.root?.name ?? null,
  });
}

function usageMetric(
  metricId: string,
  traceId: string,
  spanId: string | null,
  name: string,
  value: number,
  cost: { estimatedCost: number | null; costUnit?: string; error?: string } = { estimatedCost: null },
  timestamp = '2026-08-01T12:00:00.000Z',
): RawTraceAggregateMetric {
  return {
    metricId,
    timestamp,
    traceId,
    spanId,
    name,
    value,
    estimatedCost: cost.estimatedCost,
    costUnit: cost.costUnit ?? null,
    costMetadata: cost.error ? { error: cost.error } : null,
    provider: 'openai',
    model: null,
    organizationId: null,
    resourceId: null,
  };
}

const t1 = '2026-08-01T00:00:00.000Z';
const t2 = '2026-08-01T01:30:00.000Z';
const t3 = '2026-08-02T00:00:00.000Z';
const support = { type: 'agent', name: 'support' };
const billing = { type: 'agent', name: 'billing' };
const nightly = { type: 'workflow_run', name: 'nightly' };
const search = { type: 'tool', name: 'search' };
const child = (root: { type: string; name: string }) => ({ parent: root, root });

export const SPAN_AGGREGATE_FIXTURE_DATA: TraceAggregateFixtureData = {
  spans: [
    fixtureSpan({
      cursorId: 1,
      traceId: 't1',
      spanId: 't1-root',
      spanType: 'agent_run',
      name: 'agent:support',
      startedAt: t1,
      seconds: 10,
      entity: support,
      root: support,
    }),
    fixtureSpan({
      cursorId: 2,
      traceId: 't1',
      spanId: 't1-model',
      parentSpanId: 't1-root',
      spanType: 'model_generation',
      name: 'llm',
      startedAt: after(t1, 1),
      seconds: 9,
      model: 'gpt-4o',
      ...child(support),
    }),
    fixtureSpan({
      cursorId: 3,
      traceId: 't1',
      spanId: 't1-model',
      parentSpanId: 't1-root',
      spanType: 'model_generation',
      name: 'llm',
      startedAt: after(t1, 1),
      seconds: 2,
      model: 'gpt-4o',
      ...child(support),
    }),
    fixtureSpan({
      cursorId: 4,
      traceId: 't1',
      spanId: 't1-tool',
      parentSpanId: 't1-root',
      spanType: 'tool_call',
      name: 'search',
      startedAt: after(t1, 4),
      seconds: 3,
      entity: search,
      error: true,
      ...child(support),
    }),
    fixtureSpan({
      cursorId: 5,
      traceId: 't2',
      spanId: 't2-root',
      spanType: 'agent_run',
      name: 'agent:billing',
      startedAt: t2,
      seconds: 20,
      entity: billing,
      root: billing,
    }),
    fixtureSpan({
      cursorId: 6,
      traceId: 't2',
      spanId: 't2-model',
      parentSpanId: 't2-root',
      spanType: 'model_generation',
      name: 'llm',
      startedAt: after(t2, 1),
      seconds: 4,
      model: 'gpt-4o-mini',
      ...child(billing),
    }),
    fixtureSpan({
      cursorId: 7,
      traceId: 't2',
      spanId: 't2-tool',
      parentSpanId: 't2-root',
      spanType: 'tool_call',
      name: 'search',
      startedAt: after(t2, 6),
      seconds: 1,
      entity: search,
      ...child(billing),
    }),
    fixtureSpan({
      cursorId: 8,
      traceId: 't3',
      spanId: 't3-root',
      spanType: 'workflow_run',
      name: 'workflow:nightly',
      startedAt: t3,
      seconds: 60,
      entity: nightly,
      root: nightly,
    }),
    fixtureSpan({
      cursorId: 9,
      traceId: 't3',
      spanId: 't3-model',
      parentSpanId: 't3-root',
      spanType: 'model_generation',
      name: 'llm',
      startedAt: after(t3, 1),
      seconds: 6,
      ...child(nightly),
    }),
    fixtureSpan({
      cursorId: 10,
      traceId: 't3',
      spanId: 't3-pending',
      parentSpanId: 't3-root',
      spanType: 'tool_call',
      name: 'search',
      startedAt: after(t3, 8),
      seconds: null,
      entity: search,
      isPending: true,
      ...child(nightly),
    }),
    fixtureSpan({
      cursorId: 11,
      traceId: 't4',
      spanId: 't4-late',
      spanType: 'tool_call',
      name: 'search',
      startedAt: '2026-08-05T00:00:00.000Z',
      seconds: 1,
      entity: search,
      root: null,
    }),
  ],
  scores: [],
  feedback: [],
  metrics: [
    usageMetric('m1', 't1', 't1-model', INPUT, 100, { estimatedCost: 0.25, costUnit: 'usd' }),
    usageMetric('m2', 't1', 't1-model', OUTPUT, 50, { estimatedCost: 0.5, costUnit: 'usd' }),
    usageMetric('m2', 't1', 't1-model', OUTPUT, 50, { estimatedCost: 0.5, costUnit: 'usd' }),
    usageMetric('m3', 't1', null, INPUT, 999),
    usageMetric('m4', 't2', 't2-model', INPUT, 200, { estimatedCost: 0.125, costUnit: 'eur' }),
    usageMetric('m5', 't2', 't2-model', OUTPUT, 80),
    usageMetric('m6', 't2', 't2-model', INPUT, 1000, { estimatedCost: 1, costUnit: 'eur' }, '2026-07-31T23:59:59.000Z'),
    usageMetric('m7', 't3', 't3-model', INPUT, 40, { estimatedCost: null, error: 'no_pricing' }),
    usageMetric('m8', 't3', 't3-model', OUTPUT, 10),
  ],
};

export interface SpanAggregateConformanceCase {
  name: string;
  request: SpanAggregateRequest;
  scope?: TraceQueryTenantScope;
  expected: TraceAggregateExpectedResponse;
  tolerance?: Record<string, number>;
}

const llm = 'llm';
const usd = (coverage: number) => ({ coverage, unit: 'usd' });
const eur = (coverage: number) => ({ coverage, unit: 'eur' });
const unpriced = { coverage: 0, unit: null };

export const SPAN_AGGREGATE_CONFORMANCE_CASES: SpanAggregateConformanceCase[] = [
  {
    // Also the `querySpans()` parity case: 8 is the number of rows it pages through for this window.
    name: 'counts current completed spans and the traces they belong to',
    request: { timeRange: spanRange, measures: ['count', 'countDistinct.traceId'] },
    expected: { rows: [{ measures: { count: 8, 'countDistinct.traceId': 3 } }], truncated: false },
  },
  {
    name: 'groups by span type with the current copy of a retried span',
    request: { timeRange: spanRange, groupBy: ['spanType'], measures: ['count', 'errorRate', 'duration.max'] },
    expected: {
      rows: [
        { dimensions: { spanType: 'model_generation' }, measures: { count: 3, errorRate: 0, 'duration.max': 6000 } },
        { dimensions: { spanType: 'agent_run' }, measures: { count: 2, errorRate: 0, 'duration.max': 20000 } },
        { dimensions: { spanType: 'tool_call' }, measures: { count: 2, errorRate: 0.5, 'duration.max': 3000 } },
        { dimensions: { spanType: 'workflow_run' }, measures: { count: 1, errorRate: 0, 'duration.max': 60000 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'attributes tokens and cost to the span that emitted them, grouped by calling agent',
    request: {
      timeRange: spanRange,
      where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'model_generation' } },
      groupBy: ['parentEntityName'],
      measures: ['count', 'tokens.total.sum', 'tokens.input.avg', 'cost.sum'],
      orderBy: { field: 'parentEntityName', direction: 'asc' },
    },
    expected: {
      rows: [
        {
          dimensions: { parentEntityName: 'billing' },
          measures: { count: 1, 'tokens.total.sum': 280, 'tokens.input.avg': 200, 'cost.sum': 0.125 },
          cost: eur(1),
        },
        {
          dimensions: { parentEntityName: 'nightly' },
          measures: { count: 1, 'tokens.total.sum': 50, 'tokens.input.avg': 40, 'cost.sum': null },
          cost: unpriced,
        },
        {
          dimensions: { parentEntityName: 'support' },
          measures: { count: 1, 'tokens.total.sum': 150, 'tokens.input.avg': 100, 'cost.sum': 0.75 },
          cost: usd(1),
        },
      ],
      truncated: false,
    },
  },
  {
    name: 'averages usage over usage-bearing spans when grouping by root entity',
    request: { timeRange: spanRange, groupBy: ['rootEntityName'], measures: ['count', 'tokens.total.avg', 'cost.avg'] },
    expected: {
      rows: [
        {
          dimensions: { rootEntityName: 'billing' },
          measures: { count: 3, 'tokens.total.avg': 280, 'cost.avg': 0.125 },
          cost: eur(1),
        },
        {
          dimensions: { rootEntityName: 'support' },
          measures: { count: 3, 'tokens.total.avg': 150, 'cost.avg': 0.75 },
          cost: usd(1),
        },
        {
          dimensions: { rootEntityName: 'nightly' },
          measures: { count: 2, 'tokens.total.avg': 50, 'cost.avg': null },
          cost: unpriced,
        },
      ],
      truncated: false,
    },
  },
  {
    name: 'reports mixed cost units without a sum',
    request: { timeRange: spanRange, measures: ['count', 'tokens.total.sum', 'cost.sum', 'cost.avg'] },
    expected: {
      rows: [
        {
          measures: { count: 8, 'tokens.total.sum': 480, 'cost.sum': null, 'cost.avg': null },
          cost: { coverage: 2 / 3, unit: 'mixed' },
        },
      ],
      truncated: false,
    },
  },
  {
    name: 'leaves spans without usage out of token measures',
    request: {
      timeRange: spanRange,
      where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'agent_run' } },
      measures: ['count', 'tokens.total.sum', 'cost.sum'],
    },
    expected: {
      rows: [
        { measures: { count: 2, 'tokens.total.sum': null, 'cost.sum': null }, cost: { coverage: null, unit: null } },
      ],
      truncated: false,
    },
  },
  {
    name: 'filters groups with having and orders by a measure',
    request: {
      timeRange: spanRange,
      groupBy: ['name'],
      measures: ['count', 'duration.avg'],
      having: { op: 'gte', left: { path: 'count' }, right: { literal: 2 } },
      orderBy: { field: 'duration.avg', direction: 'desc' },
    },
    expected: {
      rows: [
        { dimensions: { name: llm }, measures: { count: 3, 'duration.avg': 4000 } },
        { dimensions: { name: 'search' }, measures: { count: 2, 'duration.avg': 2000 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'buckets surviving groups by span start',
    request: {
      timeRange: spanRange,
      where: { op: 'in', value: { path: 'spanType' }, set: ['model_generation', 'tool_call'] },
      groupBy: ['spanType'],
      interval: '1d',
      measures: ['count'],
    },
    expected: {
      rows: [
        { dimensions: { spanType: 'model_generation' }, bucket: '2026-08-01T00:00:00.000Z', measures: { count: 2 } },
        { dimensions: { spanType: 'model_generation' }, bucket: '2026-08-02T00:00:00.000Z', measures: { count: 1 } },
        { dimensions: { spanType: 'tool_call' }, bucket: '2026-08-01T00:00:00.000Z', measures: { count: 2 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'filters on parent entity context and sorts null dimensions last',
    request: {
      timeRange: spanRange,
      where: { op: 'eq', left: { path: 'parentEntityName' }, right: { literal: 'support' } },
      groupBy: ['entityName'],
      measures: ['count', 'countDistinct.traceId'],
    },
    expected: {
      rows: [
        { dimensions: { entityName: 'search' }, measures: { count: 1, 'countDistinct.traceId': 1 } },
        { dimensions: { entityName: null }, measures: { count: 1, 'countDistinct.traceId': 1 } },
      ],
      truncated: false,
    },
  },
  {
    name: 'groups by two span dimensions and truncates to the limit',
    request: { timeRange: spanRange, groupBy: ['rootEntityType', 'spanType'], measures: ['count'], limit: 2 },
    expected: {
      rows: [
        { dimensions: { rootEntityType: 'agent', spanType: 'agent_run' }, measures: { count: 2 } },
        { dimensions: { rootEntityType: 'agent', spanType: 'model_generation' }, measures: { count: 2 } },
      ],
      truncated: true,
    },
  },
];
