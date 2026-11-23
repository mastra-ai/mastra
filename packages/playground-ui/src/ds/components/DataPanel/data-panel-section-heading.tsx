import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DataPanelSectionHeadingProps {
  /** Optional leading icon. Rendered before `children` and sized via `[&>svg]:size-icon-sm`. */
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
        'flex items-center gap-1.5 text-caption tracking-widest text-placeholder uppercase [&>svg]:size-icon-sm',
        className,
      )}
    >
      {icon}
      {children}
    </div>
  );
}
