import type { ReactNode } from 'react';
import { DashboardCard } from '@/ds/components/DashboardCard';
import { cn } from '@/lib/utils';

export function MetricsKpiCardRoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <DashboardCard className={cn('flex-1 min-w-72', className)}>
      <div className="grid gap-1">{children}</div>
    </DashboardCard>
  );
}
