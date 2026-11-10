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

  // Expected spans are read off the fixture table by hand, independently of the evaluator's
  // selection helper, so this catches the shared selection drifting from querySpans() semantics
  // (current copies, completed spans, `startedAt` window, `where`).
  it.each([
    [
      'no filter',
      undefined,
      ['t1-root', 't1-model', 't1-tool', 't2-root', 't2-model', 't2-tool', 't3-root', 't3-model'],
    ],
    ['tool calls', { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } }, ['t1-tool', 't2-tool']],
    [
      'a root entity',
      { op: 'eq', left: { path: 'rootEntityName' }, right: { literal: 'support' } },
      ['t1-root', 't1-model', 't1-tool'],
    ],
    ['errored spans', { op: 'exists', path: 'error' }, ['t1-tool']],
  ] as const)('selects and counts the spans querySpans returns for %s', (_label, where, expected) => {
    const plan = planSpanAggregate({ timeRange: range, where, measures: ['count'] });
    const selected = selectSpanQuerySpans(SPAN_AGGREGATE_FIXTURE_DATA, plan).map(span => span.spanId);
    expect([...selected].sort()).toEqual([...expected].sort());
    const [row] = evaluateSpanAggregate(SPAN_AGGREGATE_FIXTURE_DATA, plan).rows;
    expect(row!.measures.count).toBe(expected.length);
  });
});
