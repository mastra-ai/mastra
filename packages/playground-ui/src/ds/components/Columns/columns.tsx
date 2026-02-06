import React from 'react';
import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';

export type ColumnsProps = {
  children: React.ReactNode;
  isSideColumnVisible?: boolean;
  className?: string;
};

/**
 * Two-column layout where the second column conditionally appears.
 * Used for master-detail patterns.
 */
export function Columns({ children, isSideColumnVisible = false, className }: ColumnsProps) {
  return (
    <div
      className={cn(
        'grid h-full overflow-hidden gap-4',
        transitions.allSlow,
        {
          'grid-cols-[1fr]': !isSideColumnVisible,
          'grid-cols-[1fr_auto]': isSideColumnVisible,
        },
        className,
      )}
    >
      {children}
    </div>
  );
}
