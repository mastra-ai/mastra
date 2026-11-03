import { z } from 'zod/v4';
import { queryRefSchema } from '../../lib/values';
import type { ResolvedView } from '../../widget-kind';

export const scoresOptionsSchema = z
  .object({
    /** Id of the scores aggregate giving each scorer's mean over the range, sent as the Scores card sends it. */
    average: queryRefSchema,
    /** Id of the scores time series giving each scorer's line. */
    series: queryRefSchema,
    emptyMessage: z.string().optional(),
  })
  .strict();

export type ScoresOptions = z.infer<typeof scoresOptionsSchema>;

/**
 * Both ids must name scores queries of the right request, and when both name a scorer it must be the
 * same one, since each scorer's mean and line are drawn together.
 */
export const scoresIssues = (view: ResolvedView<ScoresOptions>) => {
  const issues: string[] = [];
  const average = view.queries.find(q => q.id === view.options.average);
  const series = view.queries.find(q => q.id === view.options.series);
  if (average?.source !== 'scores' || average.request !== 'aggregate') {
    issues.push(`options.average must name a scores aggregate query`);
  }
  if (series?.source !== 'scores' || series.request !== 'timeSeries') {
    issues.push(`options.series must name a scores timeSeries query`);
  }
  const averageScorer = average?.source === 'scores' ? average.scorerId : undefined;
  const seriesScorer = series?.source === 'scores' ? series.scorerId : undefined;
  if (averageScorer && seriesScorer && averageScorer !== seriesScorer) {
    issues.push(
      `options.average names scorer '${averageScorer}' but options.series names '${seriesScorer}'; they must match`,
    );
  }
  return issues;
};
