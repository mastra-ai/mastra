import type { ReactNode } from 'react';
import { DashboardCard } from '@/ds/components/DashboardCard';
import { cn } from '@/lib/utils';

export function MetricsCardRoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <DashboardCard
      className={cn(
        'flex-1 grid grid-rows-[4rem_1fr] min-h-72 gap-2 min-w-80 md:min-w-[22rem] lg:min-w-[24rem] xl:min-w-[26rem] 2xl:min-w-[30rem]',
        className,
      )}
    >
      {children}
    </DashboardCard>
  );
}
