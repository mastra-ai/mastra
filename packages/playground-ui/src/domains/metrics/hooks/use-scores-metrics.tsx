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
// A scorer named "time" would collide — scorer names are code-defined so this is safe in practice.
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
      // Use the old scores API which actually stores eval scores
      const scorersMap = await client.listScorers();
      const scorerIds = Object.keys(scorersMap ?? {});

      if (scorerIds.length === 0) {
        return { summaryData: [], overTimeData: [], scorerNames: [], avgScore: null };
      }

      // Fetch scores for each scorer in parallel
      const allResults = await Promise.all(
        // Limited to 100 most recent scores per scorer; pagination not yet implemented
        scorerIds.map(scorerId => client.listScoresByScorerId({ scorerId, perPage: 100 })),
      );

      // Collect all scores with their scorer name, filtered by selected time range
      const startMs = timestamp.start.getTime();
      const endMs = timestamp.end.getTime();
      const allScores: Array<{ scorerId: string; score: number; createdAt: string }> = [];
      for (let i = 0; i < scorerIds.length; i++) {
        const scores = allResults[i]?.scores ?? [];
        for (const s of scores) {
          const ts = new Date(s.createdAt).getTime();
          if (ts >= startMs && ts <= endMs) {
            allScores.push({
              scorerId: scorerIds[i],
              score: s.score,
              createdAt: s.createdAt,
            });
          }
        }
      }

      if (allScores.length === 0) {
        return { summaryData: [], overTimeData: [], scorerNames: [], avgScore: null };
      }

      // Group by scorer for summary
      const byScorer = new Map<string, number[]>();
      for (const s of allScores) {
        if (!byScorer.has(s.scorerId)) byScorer.set(s.scorerId, []);
        byScorer.get(s.scorerId)!.push(s.score);
      }

      const summaryData: ScorerSummary[] = Array.from(byScorer.entries()).map(([scorer, vals]) => ({
        scorer,
        avg: vals.reduce((a, b) => a + b, 0) / vals.length,
        min: Math.min(...vals),
        max: Math.max(...vals),
        count: vals.length,
      }));

      const scorerNames = summaryData.map(s => s.scorer);
      const avgScore = summaryData.reduce((s, d) => s + d.avg, 0) / summaryData.length;

      // Group by hour + scorer for over-time chart
      const bucketMap = new Map<number, Map<string, number[]>>();
      for (const s of allScores) {
        const ts = new Date(s.createdAt);
        const bucket = Math.floor(ts.getTime() / 3_600_000) * 3_600_000;
        if (!bucketMap.has(bucket)) bucketMap.set(bucket, new Map());
        const scorerMap = bucketMap.get(bucket)!;
        if (!scorerMap.has(s.scorerId)) scorerMap.set(s.scorerId, []);
        scorerMap.get(s.scorerId)!.push(s.score);
      }

      const overTimeData: ScoresOverTimePoint[] = Array.from(bucketMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([bucket, scorerMap]) => {
          const point: ScoresOverTimePoint = {
            time: new Date(bucket).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }),
          };
          for (const name of scorerNames) {
            const vals = scorerMap.get(name);
            if (vals && vals.length > 0) {
              point[name] = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
            }
          }
          return point;
        });

      return {
        summaryData,
        overTimeData,
        scorerNames,
        avgScore: Math.round(avgScore * 100) / 100,
      };
    },
  });
}
