import type { ReactNode } from 'react';
import { overlaySurfaceStyle, raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/utils/cn';

/** One board in the intake order: its header over its rules for new issues and pull requests. */
export function OrderBoardCard({
  name,
  current,
  dragging,
  header,
  children,
}: {
  name: string;
  /** The board whose routing page is open. */
  current: boolean;
  /** Being dragged: it lifts off the order. */
  dragging: boolean;
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <article
      aria-label={name}
      aria-current={current ? 'true' : undefined}
      className={cn(
        'group/card flex flex-col gap-1.75 rounded-2xl px-3.25 pt-2.75 pb-3',
        'transition-shadow duration-normal ease-out-custom motion-reduce:transition-none',
        dragging ? overlaySurfaceStyle : raisedSurfaceStyle,
        current && 'outline -outline-offset-1 outline-foreground',
      )}
    >
      {header}
      <hr className="border-border" />
      {children}
    </article>
  );
}
