import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconArrowUpRight } from '@mastra/playground-ui/icons/central/IconArrowUpRight';
import { IconDotGrid2x3 } from '@mastra/playground-ui/icons/central/IconDotGrid2x3';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { boardConfigPath, boardIntakePath } from '../../../boardConfig/boardConfigPaths';

/**
 * An order card's title row: its place in the order, its name (a link to its routing unless it is the open board), any
 * actions, and a link to all its rules.
 */
export function OrderCardHeader({
  factoryId,
  boardKey,
  name,
  current,
  place,
  grip,
  dragging,
  children,
}: {
  factoryId: string;
  boardKey: string;
  name: string;
  /** The board whose routing page is open. */
  current: boolean;
  place: number;
  /** The order can change: the place number turns into a drag handle on hover. */
  grip: boolean;
  dragging: boolean;
  children?: ReactNode;
}) {
  return (
    <header className="flex min-h-5.5 items-center gap-2">
      <span
        data-grip={grip ? '' : undefined}
        className={cn(
          'relative flex h-4 min-w-4 shrink-0 items-center justify-center',
          grip && 'cursor-grab touch-none active:cursor-grabbing',
        )}
      >
        <Txt
          as="span"
          variant="meta"
          tone="muted"
          className={cn(
            'bg-background flex h-4 min-w-4 items-center justify-center rounded-lg px-1.25 font-semibold tabular-nums',
            grip && 'group-hover/card:invisible',
            dragging && 'invisible',
          )}
        >
          {place}
        </Txt>
        {grip && (
          <IconDotGrid2x3
            aria-hidden
            className={cn(
              'text-muted-foreground absolute size-icon-xs',
              dragging ? 'visible' : 'invisible group-hover/card:visible',
            )}
          />
        )}
      </span>
      <BoardTitle factoryId={factoryId} boardKey={boardKey} name={name} current={current} />
      <span className="flex-1" />
      {children}
      <Link
        to={boardConfigPath(factoryId, boardKey)}
        aria-label={`All rules on ${name}`}
        className={cn(
          'text-caption text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-sm',
          focusRing,
        )}
      >
        All rules
        <IconArrowUpRight className="size-icon-xs" aria-hidden />
      </Link>
    </header>
  );
}

/** The board's name: plain for the open board, else a link to that board's routing. */
function BoardTitle({
  factoryId,
  boardKey,
  name,
  current,
}: {
  factoryId: string;
  boardKey: string;
  name: string;
  current: boolean;
}) {
  if (current) {
    return (
      <Txt as="h2" variant="card-title-strong" tone="ink" className="min-w-0 truncate">
        {name}
      </Txt>
    );
  }
  return (
    <Link to={boardIntakePath(factoryId, boardKey)} className="min-w-0 truncate hover:underline">
      <Txt as="h2" variant="card-title-strong" tone="ink" className="truncate">
        {name}
      </Txt>
    </Link>
  );
}
