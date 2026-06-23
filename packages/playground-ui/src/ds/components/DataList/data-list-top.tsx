import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type DataListTopProps = ComponentPropsWithoutRef<'div'> & {
  /**
   * Switch to a "leading cell" layout: drops the default gap between children
   * and the default left padding, so a leading cell (e.g. `TopSelectCell`)
   * sits flush against the grid edge and an inner `TopCells` group owns the
   * remaining column spacing. Mirrors how `Row` + `RowButton` compose.
   */
  hasLeadingCell?: boolean;
};

export function DataListTop({ children, className, hasLeadingCell, ...props }: DataListTopProps) {
  return (
    <div
      className={cn(
        'data-list-top mx-1 grid grid-cols-subgrid gap-8 col-span-full relative px-5 bg-surface2 sticky top-0 z-10 after:absolute after:inset-x-[-0.25rem] after:bottom-0 after:h-px after:bg-border1 after:content-[""] after:pointer-events-none',
        hasLeadingCell && 'gap-0 pl-0!',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
