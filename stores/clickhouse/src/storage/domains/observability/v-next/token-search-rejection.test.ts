import {
  parseTraceQueryRequest,
  parseTraceAggregateRequest,
  planTraceQuery,
  planSpanQuery,
  planTraceAggregate,
  planSpanAggregate,
} from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { compileClickHouseSpanQuery } from './span-query';
import { compileClickHouseTraceAggregate, compileClickHouseSpanAggregate } from './trace-aggregate';
import { compileClickHouseTraceQueryKeys } from './trace-query';

const timeRange = { from: '2026-01-01T00:00:00.000Z', to: '2026-01-02T00:00:00.000Z' };
const options = { allowTokenSearch: true };

describe('unsupported indexed token search', () => {
  it.each(['all', 'input', 'output', 'error', 'inputPreview', 'outputPreview', 'errorPreview'] as const)(
    'rejects %s before executing list or aggregate SQL',
    field => {
      const token = { op: 'hasAllTokens', left: { path: field }, right: { literal: 'needle' } } as const;
      const where = { op: 'and', args: [token] } as const;
      const tracesWhere = { spans: { some: where } };
      const tracePlan = planTraceQuery(parseTraceQueryRequest({ timeRange, where: tracesWhere }), options);
      if (tracePlan.result !== 'traces') throw new Error('Expected a trace list plan');
      const compile = [
        () => compileClickHouseTraceQueryKeys(tracePlan),
        () => compileClickHouseSpanQuery(planSpanQuery({ timeRange, where }, options)),
        () =>
          compileClickHouseTraceAggregate(
            planTraceAggregate(
              parseTraceAggregateRequest({ timeRange, where: tracesWhere, measures: ['count'] }),
              options,
            ),
          ),
        () => compileClickHouseSpanAggregate(planSpanAggregate({ timeRange, where, measures: ['count'] }, options)),
      ];
      for (const run of compile) {
        expect(run).toThrow(
          expect.objectContaining({ name: 'TraceQueryUnsupportedError', code: 'TRACE_QUERY_UNSUPPORTED' }),
        );
      }
    },
  );
});
