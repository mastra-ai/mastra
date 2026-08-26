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
        'data-list-top sticky top-0 z-20 col-span-full mx-1 grid grid-cols-subgrid gap-8 bg-surface2 px-5 after:pointer-events-none after:absolute after:-inset-x-1 after:bottom-0 after:h-px after:bg-border1 after:content-[""]',
        hasLeadingCell && 'gap-0 pl-0!',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
