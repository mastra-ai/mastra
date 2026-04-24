import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Container for icon buttons / small actions in the top bar of a MetricsCard,
 *  placed alongside `TitleAndDescription` + `Summary`. */
export function MetricsCardActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-1 shrink-0', className)}>{children}</div>;
}
