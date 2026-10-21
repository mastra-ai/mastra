import { assert, describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../mock';
import type { CreateMetricRecord } from './metrics';

function makeMetric(traceId: string, value: number): CreateMetricRecord {
  return {
    metricId: `metric-${traceId}`,
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    name: 'mastra_trace_filter_test',
    value,
    traceId,
    labels: {},
  };
}

describe('ObservabilityInMemory metric ID batch filtering', () => {
  describe('when a metric query selects multiple trace IDs', () => {
    it('aggregates only metrics from those traces', async () => {
      const observability = new InMemoryStore().stores.observability;
      assert(observability);
      await observability.batchCreateMetrics({
        metrics: [makeMetric('trace-a', 10), makeMetric('trace-b', 20), makeMetric('trace-c', 30)],
      });

      const result = await observability.getMetricBreakdown({
        name: ['mastra_trace_filter_test'],
        groupBy: ['traceId'],
        aggregation: 'sum',
        filters: { traceIds: ['trace-a', 'trace-c'] },
      });

      expect(
        result.groups
          .map(group => [group.dimensions.traceId, group.value])
          .toSorted(([left], [right]) => String(left).localeCompare(String(right))),
      ).toEqual([
        ['trace-a', 10],
        ['trace-c', 30],
      ]);
    });
  });

  describe('when a metric query selects multiple experiment IDs', () => {
    it('aggregates only metrics from those experiments', async () => {
      const observability = new InMemoryStore().stores.observability;
      assert(observability);
      await observability.batchCreateMetrics({
        metrics: [
          { ...makeMetric('trace-a', 10), experimentId: 'exp-a' },
          { ...makeMetric('trace-b', 20), experimentId: 'exp-b' },
          { ...makeMetric('trace-c', 30), experimentId: 'exp-c' },
          makeMetric('trace-d', 40),
        ],
      });

      const result = await observability.getMetricBreakdown({
        name: ['mastra_trace_filter_test'],
        groupBy: ['experimentId'],
        aggregation: 'sum',
        filters: { experimentIds: ['exp-a', 'exp-c'] },
      });

      expect(
        result.groups
          .map(group => [group.dimensions.experimentId, group.value])
          .toSorted(([left], [right]) => String(left).localeCompare(String(right))),
      ).toEqual([
        ['exp-a', 10],
        ['exp-c', 30],
      ]);
    });
  });
});
