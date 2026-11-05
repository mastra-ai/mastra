import { defineWidgetKind } from '../../widget-kind';
import { scoresIssues, scoresOptionsSchema } from './options';
import { scoresDiscover, scoresRequests } from './scores-plan';
import { ScoresWidget } from './scores-widget';

export { scoresOptionsSchema } from './options';
export type { ScoresOptions } from './options';

/** One line per scorer, 0 to 1, with each scorer's mean in the legend. */
export const scoresKind = defineWidgetKind({
  kind: 'scores',
  optionsSchema: scoresOptionsSchema,
  issues: scoresIssues,
  discover: scoresDiscover,
  requests: scoresRequests,
  component: ScoresWidget,
});
