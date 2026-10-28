import { describe, expectTypeOf, it } from 'vitest';
import type { DashboardDefinition, DashboardQuery, NormalizedDashboardQuery } from './dashboard';
import type { DashboardFilterNode } from './dashboard-filters';
import type { TraceAggregateMeasure } from './trace-aggregate';

describe('DashboardQuery type', () => {
  it('narrows on source and request', () => {
    const narrow = (query: DashboardQuery) => {
      if (query.source === 'traceAggregate') {
        expectTypeOf(query.measures).toEqualTypeOf<TraceAggregateMeasure[]>();
        expectTypeOf(query.compare).toEqualTypeOf<'previousWindow' | undefined>();
      }
      if (query.source === 'metrics' && query.request === 'percentiles') {
        expectTypeOf(query.name).toEqualTypeOf<string>();
        expectTypeOf(query.percentiles).toEqualTypeOf<number[]>();
      }
      if (query.source === 'scores') {
        expectTypeOf(query.scorerId).toEqualTypeOf<string>();
      }
    };
    expectTypeOf(narrow).toBeFunction();
  });

  it('makes interval optional for stored time series and required defaults present after parsing', () => {
    type MetricsTimeSeries = Extract<DashboardQuery, { source: 'metrics'; request: 'timeSeries' }>;
    expectTypeOf<undefined>().toMatchTypeOf<MetricsTimeSeries['interval']>();
    type NormalizedTrace = Extract<NormalizedDashboardQuery, { source: 'traceAggregate' }>;
    expectTypeOf<NormalizedTrace['limit']>().toEqualTypeOf<number>();
  });

  it('has no timeRange on stored queries', () => {
    type Keys = DashboardQuery extends infer Q ? (Q extends unknown ? keyof Q : never) : never;
    expectTypeOf<'timeRange' extends Keys ? true : false>().toEqualTypeOf<false>();
  });
});

describe('DashboardDefinition type', () => {
  it('uses the filter node shape for defaults', () => {
    expectTypeOf<NonNullable<NonNullable<DashboardDefinition['defaults']>['filters']>>().toEqualTypeOf<
      DashboardFilterNode[]
    >();
  });
});
