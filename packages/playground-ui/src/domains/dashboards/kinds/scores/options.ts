import { z } from 'zod/v4';
import { queryRefSchema } from '../../lib/values';
import type { ResolvedView } from '../../widget-kind';

export const scoresOptionsSchema = z
  .object({
    /** Id of the scores aggregate giving each scorer's mean over the range (the legend). */
    average: queryRefSchema,
    /** Id of the scores time series giving each scorer's line. */
    series: queryRefSchema,
    emptyMessage: z.string().optional(),
  })
  .strict();

export type ScoresOptions = z.infer<typeof scoresOptionsSchema>;

/** Both ids must name scores queries of the right request. */
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
  return issues;
};
