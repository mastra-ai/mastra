import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DataPanelSectionHeadingProps {
  /** Optional leading icon. Rendered before `children` and sized via `[&>svg]:size-3.5`. */
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Section heading inside a DataPanel.Content (e.g. above a code block or a key-values list).
 * Used by `DataCodeSection` and any consumer that needs a matching small-caps label.
 */
export function DataPanelSectionHeading({ icon, className, children }: DataPanelSectionHeadingProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-ui-sm uppercase tracking-widest text-neutral2 [&>svg]:size-3.5',
        className,
      )}
    >
      {icon}
      {children}
    </div>
  );
}
