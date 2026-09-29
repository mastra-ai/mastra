import { WaypointsIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

import { useThreadTraceRow } from './thread-trace-row-context';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export type ThreadTraceTurnDividerProps = Omit<ComponentProps<'div'>, 'children'>;

/** The hairline that opens each turn: its "Turn N" label and the control that shows its trace. */
export function ThreadTraceTurnDivider({ className, ...props }: ThreadTraceTurnDividerProps) {
  const { turn, isActive, toggleTrace } = useThreadTraceRow();
  const label = isActive ? 'Hide trace' : 'Show trace';

  return (
    <div data-slot="thread-trace-turn-divider" className={cn('flex items-center gap-2 pt-4', className)} {...props}>
      <Txt as="span" variant="caption" tone="muted" className="shrink-0">
        Turn {turn}
      </Txt>
      <div className="h-px flex-1 bg-border" />
      <Button
        variant="ghost"
        size="sm"
        tooltip={label}
        aria-label={`${label} for turn ${turn}`}
        aria-pressed={isActive}
        onClick={toggleTrace}
      >
        <WaypointsIcon />
      </Button>
    </div>
  );
}
