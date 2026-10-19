import { planSpanAggregate, spanAggregateResponseSchema } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import {
  evaluateSpanAggregate,
  evaluateSpanAggregateRequest,
  SPAN_AGGREGATE_CONFORMANCE_CASES,
  SPAN_AGGREGATE_FIXTURE_DATA,
} from './span-aggregate';
import { traceAggregateResponseMismatch } from './trace-aggregate';
import { selectSpanQuerySpans } from './trace-query';

const range = { from: '2026-08-01T00:00:00Z', to: '2026-08-03T00:00:00Z' };

describe('span-aggregate reference evaluator', () => {
  it('has unique case names', () => {
    const names = SPAN_AGGREGATE_CONFORMANCE_CASES.map(testCase => testCase.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(SPAN_AGGREGATE_CONFORMANCE_CASES)('$name', testCase => {
    const actual = evaluateSpanAggregateRequest(SPAN_AGGREGATE_FIXTURE_DATA, testCase.request, testCase.scope);
    expect(actual).toEqual(testCase.expected);
    expect(traceAggregateResponseMismatch(actual, testCase)).toBeNull();
  });

  it('hand-written expectations satisfy the response contract and project exactly the requested measures', () => {
    for (const testCase of SPAN_AGGREGATE_CONFORMANCE_CASES) {
      expect(() => spanAggregateResponseSchema.parse(testCase.expected), testCase.name).not.toThrow();
      for (const row of testCase.expected.rows) {
        expect(Object.keys(row.measures), testCase.name).toEqual(testCase.request.measures);
        expect(Object.keys(row.dimensions ?? {}), testCase.name).toEqual(testCase.request.groupBy ?? []);
        expect('bucket' in row, testCase.name).toBe(testCase.request.interval !== undefined);
      }
    }
  });

  it.each([
    undefined,
    { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } },
    { op: 'eq', left: { path: 'rootEntityName' }, right: { literal: 'support' } },
    { op: 'exists', path: 'error' },
  ] as const)('counts exactly the spans querySpans selects for %j', where => {
    const plan = planSpanAggregate({ timeRange: range, where, measures: ['count'] });
    const [row] = evaluateSpanAggregate(SPAN_AGGREGATE_FIXTURE_DATA, plan).rows;
    expect(row!.measures.count).toBe(selectSpanQuerySpans(SPAN_AGGREGATE_FIXTURE_DATA, plan).length);
  });
});
