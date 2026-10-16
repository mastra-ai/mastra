import { ComboboxItem } from '@mastra/playground-ui/components/Combobox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import type { ScorerOption } from './experiment-trigger-options';

/** A scorer in the Scorers list, with its description as a tooltip when it has one. */
export function ScorerItem({ scorer }: { scorer: ScorerOption }) {
  const row = <ComboboxItem value={scorer}>{scorer.label}</ComboboxItem>;
  if (!scorer.description) return row;

  return (
    <Tooltip>
      <TooltipTrigger render={row} />
      <TooltipContent side="right" className="max-w-64">
        {scorer.description}
      </TooltipContent>
    </Tooltip>
  );
}
