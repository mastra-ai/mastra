import type { ThemeHistoryResponse } from '@mastra/client-js';

export type ThemeHistoryPoint = ThemeHistoryResponse['points'][number];

export type TrendDirection = 'growing' | 'fading' | 'steady';

/**
 * History points arrive newest-first from the API (`ORDER BY frameId DESC`);
 * every presentation in the panel reads oldest-first.
 */
export function chronologicalHistoryPoints(points: ThemeHistoryPoint[]): ThemeHistoryPoint[] {
  return [...points].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
}

/**
 * Whether a theme is gaining or losing traction across its history. Prefers
 * the clustering pipeline's trend score on the latest point; falls back to
 * comparing the mean trace count of the first and last thirds of the series.
 *
 * Points MUST be in chronological order (see `chronologicalHistoryPoints`) —
 * raw API output is newest-first and would invert the answer.
 */
export function themeTrendDirection(points: ThemeHistoryPoint[]): TrendDirection {
  if (points.length < 2) return 'steady';

  const latestTrend = points[points.length - 1]?.trend;
  if (latestTrend && latestTrend.strength !== 'none') {
    if (latestTrend.popularity > 0) return 'growing';
    if (latestTrend.popularity < 0) return 'fading';
    return 'steady';
  }

  const thirdSize = Math.max(1, Math.floor(points.length / 3));
  const mean = (slice: ThemeHistoryPoint[]) => slice.reduce((sum, point) => sum + point.traceCount, 0) / slice.length;
  const firstMean = mean(points.slice(0, thirdSize));
  const lastMean = mean(points.slice(-thirdSize));
  if (lastMean > firstMean) return 'growing';
  if (lastMean < firstMean) return 'fading';
  return 'steady';
}
