import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function MetricsKpiCardValue({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <strong
      className={cn(
        'text-title font-semibold text-foreground tabular-nums [text-box:trim-both_cap_alphabetic]',
        className,
      )}
    >
      {children}
    </strong>
  );
}
