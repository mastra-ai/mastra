import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Container for icon buttons / small actions in the top bar of a MetricsCard,
 *  placed between `TitleAndDescription` and `Summary` (which always renders last). */
export function MetricsCardActions({
  children,
  reveal = 'always',
  className,
}: {
  children: ReactNode;
  /**
   * `hover`: the actions appear while the card is hovered or one of them has focus, so a page
   * of cards doesn't read as a page of buttons.
   */
  reveal?: 'always' | 'hover';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1 self-center',
        reveal === 'hover' &&
          'opacity-0 transition-opacity duration-150 group-hover/metrics-card:opacity-100 focus-within:opacity-100',
        className,
      )}
    >
      {children}
    </div>
  );
}
