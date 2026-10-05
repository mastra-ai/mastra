import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function MetricsKpiCardValueRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-6 items-center gap-2 whitespace-nowrap *:shrink-0', className)}>{children}</div>
  );
}
