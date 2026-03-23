import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { useMergedRequestContext } from '@/domains/request-context';

export interface EvaluationScorerSummary {
  scorer: string;
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface EvaluationScoresOverTimePoint {
  time: string;
  [scorer: string]: string | number;
}

export function useEvaluationScoreMetrics() {
  const client = useMastraClient();
  const requestContext = useMergedRequestContext();

  return useQuery({
    queryKey: ['evaluation-score-metrics', requestContext],
    queryFn: async () => {
      const scorersMap = await client.listScorers(requestContext);
      const scorerIds = Object.keys(scorersMap ?? {});

      if (scorerIds.length === 0) {
        return { summaryData: [], overTimeData: [], scorerNames: [], avgScore: null, prevAvgScore: null };
      }

      const allResults = await Promise.all(
        scorerIds.map(scorerId => client.listScoresByScorerId({ scorerId, perPage: 100 })),
      );

      const allScores: Array<{ scorerId: string; score: number; createdAt: string }> = [];
      for (let i = 0; i < scorerIds.length; i++) {
        const scores = allResults[i]?.scores ?? [];
        for (const s of scores) {
          allScores.push({
            scorerId: scorerIds[i],
            score: s.score,
            createdAt: s.createdAt,
          });
        }
      }

      if (allScores.length === 0) {
        return { summaryData: [], overTimeData: [], scorerNames: [], avgScore: null, prevAvgScore: null };
      }

      // Split scores into current period (recent half) and previous period (older half)
      const sorted = [...allScores].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const midpoint = Math.floor(sorted.length / 2);
      const prevScores = sorted.slice(0, midpoint);

      // Group by scorer for summary (uses all scores)
      const byScorer = new Map<string, number[]>();
      for (const s of allScores) {
        if (!byScorer.has(s.scorerId)) byScorer.set(s.scorerId, []);
        byScorer.get(s.scorerId)!.push(s.score);
      }

      const summaryData: EvaluationScorerSummary[] = Array.from(byScorer.entries()).map(([scorer, vals]) => ({
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
        const prevScorerAvgs = Array.from(prevByScorer.values()).map(vals => vals.reduce((a, b) => a + b, 0) / vals.length);
        prevAvgScore = prevScorerAvgs.reduce((a, b) => a + b, 0) / prevScorerAvgs.length;
        prevAvgScore = Math.round(prevAvgScore * 100) / 100;
      }

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

      const overTimeData: EvaluationScoresOverTimePoint[] = Array.from(bucketMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([bucket, scorerMap]) => {
          const point: EvaluationScoresOverTimePoint = {
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
        prevAvgScore,
      };
    },
  });
}
