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

// Flat structure required by Recharts. Scorer names become keys alongside `time`.
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

      // Fetch summary stats and time series for all scorers in parallel
      const [summaryResults, timeSeriesResults] = await Promise.all([
        Promise.all(
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
        ),
        Promise.all(
          scorerIds.map(scorerId =>
            client.getScoreTimeSeries({
              scorerId,
              interval: '1h',
              aggregation: 'avg',
              filters,
            }),
          ),
        ),
      ]);

      const summaryData: ScorerSummary[] = summaryResults.filter(s => s.count > 0);
      const scorerNames = summaryData.map(s => s.scorer);

      if (summaryData.length === 0) {
        return { summaryData: [], overTimeData: [], scorerNames: [], avgScore: null };
      }

      const avgScore = Math.round((summaryData.reduce((s, d) => s + d.avg, 0) / summaryData.length) * 100) / 100;

      // Merge time series into flat Recharts format
      const bucketMap = new Map<string, ScoresOverTimePoint>();
      const rangeSpansDays = timestamp.end.toDateString() !== timestamp.start.toDateString();

      for (let i = 0; i < scorerIds.length; i++) {
        const scorerId = scorerIds[i];
        if (!scorerNames.includes(scorerId)) continue;
        const series = timeSeriesResults[i]?.series ?? [];
        for (const s of series) {
          for (const point of s.points) {
            const ts = new Date(point.timestamp);
            const key = ts.toISOString();
            if (!bucketMap.has(key)) {
              bucketMap.set(key, {
                time: rangeSpansDays
                  ? ts.toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })
                  : ts.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    }),
              });
            }
            bucketMap.get(key)![scorerId] = +point.value.toFixed(2);
          }
        }
      }

      const overTimeData = Array.from(bucketMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, point]) => point);

      return {
        summaryData,
        overTimeData,
        scorerNames,
        avgScore,
      };
    },
  });
}
