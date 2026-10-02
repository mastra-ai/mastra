import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';

export const DEFAULT_SCORERS_LABEL = (
  <span className="flex items-center gap-1.5 [&>svg]:size-3.5 [&>svg]:shrink-0">
    <ScorersIcon />
    Default scorers
  </span>
);
export const DEFAULT_SCORERS_HELPER_TEXT =
  'Pre-selected when running experiments on this dataset. Items can override them.';
