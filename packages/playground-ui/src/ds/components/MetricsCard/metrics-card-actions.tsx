import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Container for icon buttons / small actions in the top bar of a MetricsCard,
 *  placed between `TitleAndDescription` and `Summary` (which always renders last). */
export function MetricsCardActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex shrink-0 items-center gap-1 self-center', className)}>{children}</div>;
}
