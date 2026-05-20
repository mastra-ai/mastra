import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMetricsFilters } from './use-metrics-filters';

export interface ScorerSummary {
  scorer: string;
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface ScoresOverTimePoint {
  time: string;
  [scorer: string]: string | number;
}

export function useScoresMetrics() {
  const client = useMastraClient();
  const { datePreset, customRange, timestamp } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'scores-card', datePreset, customRange],
    queryFn: async () => {
      const filters = {
        timestamp: { start: timestamp.start, end: timestamp.end },
      };

      const scorersMap = await client.listScorers();
      const scorerIds = Object.keys(scorersMap ?? {});

      if (scorerIds.length === 0) {
        return { summaryData: [], overTimeData: [], scorerNames: [], avgScore: null };
      }

      // Fetch summary stats first to determine which scorers have data
      const summaryResults = await Promise.all(
        scorerIds.map(async scorerId => {
          const [avg, min, max, count] = await Promise.all([
            client.getScoreAggregate({ scorerId, aggregation: 'avg', filters }),
            client.getScoreAggregate({ scorerId, aggregation: 'min', filters }),
            client.getScoreAggregate({ scorerId, aggregation: 'max', filters }),
            client.getScoreAggregate({ scorerId, aggregation: 'count', filters }),
          ]);
          return {
            scorer: scorerId,
            avg: avg.value ?? 0,
            min: min.value ?? 0,
            max: max.value ?? 0,
            count: count.value ?? 0,
          };
        }),
      );

      const summaryData: ScorerSummary[] = summaryResults.filter(s => s.count > 0);
      const scorerNames = summaryData.map(s => s.scorer);

      if (summaryData.length === 0) {
        return { summaryData: [], overTimeData: [], scorerNames: [], avgScore: null };
      }

      const totalWeighted = summaryData.reduce((s, d) => s + d.avg * d.count, 0);
      const totalCount = summaryData.reduce((s, d) => s + d.count, 0);
      const avgScore = totalCount ? Math.round((totalWeighted / totalCount) * 100) / 100 : 0;

      const interval = '1h';

      // Fetch hourly time series from the full period for active scorers
      const timeSeriesResults = await Promise.all(
        scorerNames.map(scorerId =>
          client.getScoreTimeSeries({
            scorerId,
            interval,
            aggregation: 'avg',
            filters,
          }),
        ),
      );

      // Collapse all days into a single 24-hour view (00:00–23:00).
      // For each hour-of-day, average the values across all days in the range.
      const hourBuckets = new Map<string, Map<string, { sum: number; count: number }>>();

      for (let i = 0; i < scorerNames.length; i++) {
        const scorerId = scorerNames[i];
        const series = timeSeriesResults[i]?.series ?? [];
        for (const s of series) {
          for (const point of s.points) {
            const ts = new Date(point.timestamp);
            const hourKey = ts.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            if (!hourBuckets.has(hourKey)) {
              hourBuckets.set(hourKey, new Map());
            }
            const scorerMap = hourBuckets.get(hourKey)!;
            if (!scorerMap.has(scorerId)) {
              scorerMap.set(scorerId, { sum: 0, count: 0 });
            }
            const acc = scorerMap.get(scorerId)!;
            acc.sum += point.value;
            acc.count += 1;
          }
        }
      }

      // Build sorted 24h chart data
      const overTimeData: ScoresOverTimePoint[] = Array.from(hourBuckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hourKey, scorerMap]) => {
          const point: ScoresOverTimePoint = { time: hourKey };
          for (const [scorerId, acc] of scorerMap) {
            point[scorerId] = +(acc.sum / acc.count).toFixed(2);
          }
          return point;
        });

      return {
        summaryData,
        overTimeData,
        scorerNames,
        avgScore,
      };
    },
  });
}
