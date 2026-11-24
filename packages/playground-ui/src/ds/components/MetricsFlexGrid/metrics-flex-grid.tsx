import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function MetricsFlexGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap gap-4', className)}>{children}</div>;
}
