import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

import type { RunsState } from '../../hooks/useFactoryActivity';
import type { ActivityCounts } from '../../periodActivity';
import { ACTIVITY_KINDS, totalOf } from './activityFormat';

export function ActivityTotals({
  totals,
  runs,
  swatches,
}: {
  totals: ActivityCounts;
  runs: RunsState;
  swatches: boolean;
}) {
  return (
    <Txt
      as="span"
      variant="caption"
      tone="muted"
      className="m-0 flex flex-wrap items-center gap-x-3.5 gap-y-1 tabular-nums"
    >
      {ACTIVITY_KINDS.map(({ kind, label, icon: Icon, tone }) => (
        <Tooltip key={kind}>
          <TooltipTrigger render={<span className="inline-flex items-center gap-1.5" />}>
            <span
              aria-hidden
              className={cn(
                'bg-foreground duration-slow ease-out-custom h-2 rounded-[1px] transition-[width,margin,opacity] motion-reduce:transition-none',
                swatches ? ['w-2', tone] : '-mr-1.5 w-0 opacity-0',
              )}
            />
            <Icon aria-hidden className="size-3.5" />
            <span className="text-foreground">{totalOf(kind, totals, runs)}</span>
          </TooltipTrigger>
          <TooltipContent side="top">{label}</TooltipContent>
        </Tooltip>
      ))}
    </Txt>
  );
}
