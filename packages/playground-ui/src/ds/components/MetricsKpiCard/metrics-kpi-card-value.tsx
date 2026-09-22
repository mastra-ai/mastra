import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function MetricsKpiCardValue({ children, className }: { children: ReactNode; className?: string }) {
  return <strong className={cn('text-title text-muted-foreground', className)}>{children}</strong>;
}
