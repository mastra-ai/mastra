import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';
import { IconArrowUpRight } from '@/ds/icons/central/IconArrowUpRight';
import { IconDotGrid2x3 } from '@/ds/icons/central/IconDotGrid2x3';
import { focusRing } from '@/ds/primitives/transitions';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/utils/cn';

/**
 * An order card's title row: its place in the order, its name (a link to its routing unless it is the open board), any
 * actions, and a link to all its rules.
 */
export function OrderCardHeader({
  name,
  current,
  place,
  grip,
  dragging,
  routingHref,
  rulesHref,
  LinkComponent: Link,
  children,
}: {
  name: string;
  /** The board whose routing page is open. */
  current: boolean;
  place: number;
  /** The order can change: the place number turns into a drag handle on hover. */
  grip: boolean;
  dragging: boolean;
  /** The board's routing page, its name links to unless it is the open board. */
  routingHref: string;
  /** All the board's rules. */
  rulesHref: string;
  LinkComponent: LinkComponent;
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
            'flex h-4 min-w-4 items-center justify-center rounded-lg bg-background px-1.25 font-semibold tabular-nums',
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
              'absolute size-icon-xs text-muted-foreground',
              dragging ? 'visible' : 'invisible group-hover/card:visible',
            )}
          />
        )}
      </span>
      <BoardTitle name={name} current={current} href={routingHref} LinkComponent={Link} />
      <span className="flex-1" />
      {children}
      <Link
        href={rulesHref}
        aria-label={`All rules on ${name}`}
        className={cn(
          'flex items-center gap-1 rounded-sm text-caption text-muted-foreground hover:text-foreground',
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
  name,
  current,
  href,
  LinkComponent: Link,
}: {
  name: string;
  current: boolean;
  href: string;
  LinkComponent: LinkComponent;
}) {
  if (current) {
    return (
      <Txt as="h2" variant="card-title-strong" tone="ink" className="min-w-0 truncate">
        {name}
      </Txt>
    );
  }
  return (
    <Link href={href} className="min-w-0 truncate hover:underline">
      <Txt as="h2" variant="card-title-strong" tone="ink" className="truncate">
        {name}
      </Txt>
    </Link>
  );
}
