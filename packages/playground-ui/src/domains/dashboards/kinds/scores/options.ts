import { z } from 'zod/v4';
import type { ResolvedView } from '../../widget-kind';

export const scoresOptionsSchema = z
  .object({
    /** The scores aggregate giving each scorer's mean over the range (the legend). */
    average: z.number().int().min(0),
    /** The scores time series giving each scorer's line. */
    series: z.number().int().min(0),
    emptyMessage: z.string().optional(),
  })
  .strict();

export type ScoresOptions = z.infer<typeof scoresOptionsSchema>;

/** Both indexes must name scores queries of the right request. */
export const scoresIssues = (view: ResolvedView<ScoresOptions>) => {
  const issues: string[] = [];
  const average = view.queries[view.options.average];
  const series = view.queries[view.options.series];
  if (average?.source !== 'scores' || average.request !== 'aggregate') {
    issues.push(`options.average must name a scores aggregate query`);
  }
  if (series?.source !== 'scores' || series.request !== 'timeSeries') {
    issues.push(`options.series must name a scores timeSeries query`);
  }
  return issues;
};
