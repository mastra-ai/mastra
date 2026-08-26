import type { ScoreRowData } from '@mastra/core/evals';
import { format } from 'date-fns';

export function buildScoreChartData(scores: ScoreRowData[]): {
  data: Record<string, unknown>[];
  scorerNames: string[];
} {
  const sorted = [...scores].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const scorerNames: string[] = [];
  const data = sorted.map(score => {
    const scorerName = String(score.scorer?.name || score.scorer?.id || 'unknown');
    if (!scorerNames.includes(scorerName)) scorerNames.push(scorerName);
    return { time: format(new Date(score.createdAt), 'h:mm:ss aaa'), [scorerName]: score.score };
  });

  return { data, scorerNames };
}
