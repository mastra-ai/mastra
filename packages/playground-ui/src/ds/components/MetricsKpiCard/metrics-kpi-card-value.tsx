import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function MetricsKpiCardValue({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <strong className={cn('font-mono text-title font-semibold text-foreground tabular-nums', className)}>
      {children}
    </strong>
  );
}
