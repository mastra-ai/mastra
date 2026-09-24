import type { ClientScoreRowData } from '@mastra/client-js';
import { formatDate } from '@mastra/playground-ui/utils/date-format';

export function buildScoreChartData(scores: ClientScoreRowData[]): {
  data: Record<string, unknown>[];
  scorerNames: string[];
} {
  const sorted = [...scores].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const scorerNames: string[] = [];
  const data = sorted.map(score => {
    const scorerName = String(score.scorer?.name || score.scorer?.id || 'unknown');
    if (!scorerNames.includes(scorerName)) scorerNames.push(scorerName);
    return { time: formatDate(score.createdAt, 'time') ?? '', [scorerName]: score.score };
  });

  return { data, scorerNames };
}
