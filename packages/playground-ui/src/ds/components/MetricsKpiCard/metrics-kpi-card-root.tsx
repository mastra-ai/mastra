import type { ReactNode } from 'react';
import { Card } from '@/ds/components/Card';
import { cn } from '@/lib/utils';

export type MetricsKpiCardRootProps = {
  children: ReactNode;
  className?: string;
  /** The reading is loading or being replaced. */
  busy?: boolean;
};

export function MetricsKpiCardRoot({ children, className, busy }: MetricsKpiCardRootProps) {
  return (
    <Card className={cn('min-w-72 flex-1 px-4 py-3', className)} aria-busy={busy || undefined}>
      <div className="grid gap-1.5">{children}</div>
    </Card>
  );
}
