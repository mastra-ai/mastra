import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMergedRequestContext } from '@/domains/request-context';

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

export function useScoreMetrics() {
  const client = useMastraClient();
  const requestContext = useMergedRequestContext();

  return useQuery({
    queryKey: ['score-metrics', requestContext],
    queryFn: async () => {
      const scorersMap = await client.listScorers(requestContext);
      const scorerIds = Object.keys(scorersMap ?? {});

      if (scorerIds.length === 0) {
        return { summaryData: [], overTimeData: [], scorerNames: [], avgScore: null, prevAvgScore: null };
      }

      // Fetch scores from the new observability scores API.
      // Fetch per-scorer to keep queries bounded.
      const allResults = await Promise.all(
        scorerIds.map(scorerId =>
          client.listScores({
            filters: { scorerId },
            pagination: { page: 0, perPage: 100 },
            orderBy: { field: 'timestamp', direction: 'DESC' },
          }),
        ),
      );

      const allScores: Array<{ scorerId: string; score: number; timestamp: string }> = [];
      for (let i = 0; i < scorerIds.length; i++) {
        const scores = allResults[i]?.scores ?? [];
        for (const s of scores) {
          allScores.push({
            scorerId: s.scorerId,
            score: s.score,
            timestamp: typeof s.timestamp === 'string' ? s.timestamp : new Date(s.timestamp).toISOString(),
          });
        }
      }

      if (allScores.length === 0) {
        return { summaryData: [], overTimeData: [], scorerNames: [], avgScore: null, prevAvgScore: null };
      }

      // Split scores into current period (recent half) and previous period (older half)
      const sorted = [...allScores].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const midpoint = Math.floor(sorted.length / 2);
      const prevScores = sorted.slice(0, midpoint);

      // Group by scorer for summary (uses all scores)
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

      // Compute previous period avg score
      let prevAvgScore: number | null = null;
      if (prevScores.length > 0) {
        const prevByScorer = new Map<string, number[]>();
        for (const s of prevScores) {
          if (!prevByScorer.has(s.scorerId)) prevByScorer.set(s.scorerId, []);
          prevByScorer.get(s.scorerId)!.push(s.score);
        }
        const prevScorerAvgs = Array.from(prevByScorer.values()).map(
          vals => vals.reduce((a, b) => a + b, 0) / vals.length,
        );
        prevAvgScore = prevScorerAvgs.reduce((a, b) => a + b, 0) / prevScorerAvgs.length;
        prevAvgScore = Math.round(prevAvgScore * 100) / 100;
      }

      // Group by time bucket + scorer for over-time chart
      // Pick bucket size based on data range: minutes, hours, or days
      const timestamps = allScores.map(s => new Date(s.timestamp).getTime());
      const rangeMs = Math.max(...timestamps) - Math.min(...timestamps);
      let bucketMs: number;
      if (rangeMs < 3_600_000) {
        bucketMs = 60_000; // < 1 hour: minute buckets
      } else if (rangeMs < 86_400_000) {
        bucketMs = 3_600_000; // < 1 day: hour buckets
      } else {
        bucketMs = 86_400_000; // multi-day: day buckets
      }

      const bucketMap = new Map<number, Map<string, number[]>>();
      for (const s of allScores) {
        const ts = new Date(s.timestamp);
        const bucket = Math.floor(ts.getTime() / bucketMs) * bucketMs;
        if (!bucketMap.has(bucket)) bucketMap.set(bucket, new Map());
        const scorerMap = bucketMap.get(bucket)!;
        if (!scorerMap.has(s.scorerId)) scorerMap.set(s.scorerId, []);
        scorerMap.get(s.scorerId)!.push(s.score);
      }

      const sortedBuckets = Array.from(bucketMap.entries()).sort(([a], [b]) => a - b);
      // Determine date range to decide label format
      const minTs = sortedBuckets.length > 0 ? sortedBuckets[0][0] : 0;
      const maxTs = sortedBuckets.length > 0 ? sortedBuckets[sortedBuckets.length - 1][0] : 0;
      const spanDays = (maxTs - minTs) / 86_400_000;

      const overTimeData: ScoresOverTimePoint[] = sortedBuckets.map(([bucket, scorerMap]) => {
        const d = new Date(bucket);
        let timeLabel: string;
        if (spanDays > 1) {
          // Multi-day: show "Mar 20 14:00"
          timeLabel =
            d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
            ' ' +
            d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        } else {
          // Single day: just show time
          timeLabel = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        const point: ScoresOverTimePoint = { time: timeLabel };
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
        prevAvgScore,
      };
    },
  });
}
