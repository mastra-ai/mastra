import type { ReactNode } from 'react';
import { DashboardCard } from '@/ds/components/DashboardCard';
import { cn } from '@/lib/utils';

export function MetricsCardRoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <DashboardCard
      className={cn(
        '2xl:min-w-120 md:min-w-88 xl:min-w-104 grid min-h-72 min-w-80 flex-1 grid-rows-[4rem_1fr] gap-2 lg:min-w-sm',
        className,
      )}
    >
      {children}
    </DashboardCard>
  );
}
