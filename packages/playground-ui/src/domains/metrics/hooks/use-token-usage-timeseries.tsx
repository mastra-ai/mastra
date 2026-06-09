import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMetricsFilters } from './use-metrics-filters';

export type TokenUsageTimeSeriesInterval = '1h' | '1d';

export interface TokenTimelinePoint {
  time: string;
  tsMs: number;
  input: number;
  output: number;
  total: number;
  cost: number | null;
  costUnit: string | null;
}

export interface TokenUsageTimeSeriesData {
  data: TokenTimelinePoint[];
  interval: TokenUsageTimeSeriesInterval;
}

type TimeSeriesPoint = {
  timestamp: string | Date;
  value: number;
  estimatedCost?: number | null;
};

type SeriesWithCost = {
  costUnit?: string | null;
  points: TimeSeriesPoint[];
};

type TokenTimelineAccumulator = {
  tsMs: number;
  input: number;
  output: number;
  cost: number | null;
  costUnits: Set<string>;
  hasUnknownCostUnit: boolean;
};

function chooseTokenUsageInterval(datePreset: ReturnType<typeof useMetricsFilters>['datePreset']): TokenUsageTimeSeriesInterval {
  return datePreset === '24h' ? '1h' : '1d';
}

function formatTime(ts: Date, interval: TokenUsageTimeSeriesInterval): string {
  if (interval === '1h') {
    return ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return ts.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

function addSeriesPoints(
  pointMap: Map<number, TokenTimelineAccumulator>,
  series: SeriesWithCost | undefined,
  key: 'input' | 'output',
) {
  for (const point of series?.points ?? []) {
    const tsMs = new Date(point.timestamp).getTime();
    if (!Number.isFinite(tsMs)) continue;

    const existing = pointMap.get(tsMs) ?? {
      tsMs,
      input: 0,
      output: 0,
      cost: null,
      costUnits: new Set<string>(),
      hasUnknownCostUnit: false,
    };

    existing[key] += point.value;

    if (point.estimatedCost != null) {
      existing.cost = (existing.cost ?? 0) + point.estimatedCost;
      if (series?.costUnit) {
        existing.costUnits.add(series.costUnit);
      } else {
        existing.hasUnknownCostUnit = true;
      }
    }

    pointMap.set(tsMs, existing);
  }
}

function toCostUnit(entry: TokenTimelineAccumulator): string | null {
  if (entry.cost == null || entry.hasUnknownCostUnit || entry.costUnits.size !== 1) return null;
  return [...entry.costUnits][0] ?? null;
}

export function useTokenUsageTimeSeries() {
  const client = useMastraClient();
  const { datePreset, filters, filterKey } = useMetricsFilters();
  const interval = chooseTokenUsageInterval(datePreset);

  return useQuery({
    queryKey: ['metrics', 'token-usage-timeseries', filterKey, interval],
    queryFn: async (): Promise<TokenUsageTimeSeriesData> => {
      const [inputRes, outputRes] = await Promise.all([
        client.getMetricTimeSeries({
          name: ['mastra_model_total_input_tokens'],
          interval,
          aggregation: 'sum',
          filters,
        }),
        client.getMetricTimeSeries({
          name: ['mastra_model_total_output_tokens'],
          interval,
          aggregation: 'sum',
          filters,
        }),
      ]);

      const pointMap = new Map<number, TokenTimelineAccumulator>();
      addSeriesPoints(pointMap, inputRes.series[0], 'input');
      addSeriesPoints(pointMap, outputRes.series[0], 'output');

      const data = Array.from(pointMap.values())
        .sort((a, b) => a.tsMs - b.tsMs)
        .map(point => {
          const ts = new Date(point.tsMs);
          return {
            time: formatTime(ts, interval),
            tsMs: point.tsMs,
            input: point.input,
            output: point.output,
            total: point.input + point.output,
            cost: point.cost,
            costUnit: toCostUnit(point),
          };
        });

      return { data, interval };
    },
  });
}
