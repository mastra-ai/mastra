import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function MetricsCardTopBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-[1fr_auto] gap-4', className)}>{children}</div>;
}
