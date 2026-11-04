import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function MetricsKpiCardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', className)}>{children}</div>;
}
