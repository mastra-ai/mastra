import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function MetricsCardTopBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-4 [&>:first-child]:min-w-0 [&>:first-child]:flex-1', className)}>
      {children}
    </div>
  );
}
