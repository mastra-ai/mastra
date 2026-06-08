import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DataListTopProps = {
  children: ReactNode;
  className?: string;
  /**
   * Switch to a "leading cell" layout: drops the default gap between children
   * and the default left padding, so a leading cell (e.g. `TopSelectCell`)
   * sits flush against the grid edge and an inner `TopCells` group owns the
   * remaining column spacing. Mirrors how `Row` + `RowButton` compose.
   */
  hasLeadingCell?: boolean;
};

export function DataListTop({ children, className, hasLeadingCell }: DataListTopProps) {
  return (
    <div
      className={cn(
        'mx-1 grid grid-cols-subgrid gap-8 col-span-full border-b border-border1 px-5 bg-surface2 sticky top-0 z-10',
        hasLeadingCell && 'gap-0 pl-0!',
        className,
      )}
    >
      {children}
    </div>
  );
}
