import type { ReactNode, Ref } from 'react';

import { cn } from '@/lib/utils';

export interface DataPanelContentProps {
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
  /** Layout overrides (e.g. padding) for the scroll container. */
  className?: string;
}

export function DataPanelContent({ children, ref, className }: DataPanelContentProps) {
  return (
    <div ref={ref} className={cn('min-h-0 flex-1 overflow-y-auto p-3', className)}>
      {children}
    </div>
  );
}
