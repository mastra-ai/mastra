import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DashboardCardProps = {
  children: ReactNode;
  className?: string;
};

export function DashboardCard({ children, className }: DashboardCardProps) {
  return (
    <div className={cn('border border-border1 rounded-xl px-4 py-3 bg-surface-overlay-soft', className)}>
      {children}
    </div>
  );
}
