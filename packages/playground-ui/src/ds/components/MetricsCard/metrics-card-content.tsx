import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function MetricsCardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-x-auto ', className)}>{children}</div>;
}
