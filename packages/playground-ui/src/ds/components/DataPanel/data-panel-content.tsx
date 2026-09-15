import type { ReactNode, Ref } from 'react';

import { cn } from '@/lib/utils';

export interface DataPanelContentProps {
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export function DataPanelContent({ children, className, ref }: DataPanelContentProps) {
  return (
    <div ref={ref} className={cn('min-h-0 flex-1 overflow-y-auto p-3', className)}>
      {children}
    </div>
  );
}
