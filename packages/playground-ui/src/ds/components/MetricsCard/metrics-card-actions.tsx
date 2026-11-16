import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Container for icon buttons / small actions in the top bar of a MetricsCard,
 *  placed between the title and `Total` (which always renders last). Small (28px) buttons sit
 *  centered on the 20px title line without making the top bar taller. Each `MetricsCard.Action`
 *  decides whether it waits for the card's hover. */
export function MetricsCardActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('-my-1 flex shrink-0 items-center gap-1 self-start', className)}>{children}</div>;
}
