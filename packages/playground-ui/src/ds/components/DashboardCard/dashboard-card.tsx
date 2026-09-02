import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DashboardCardProps = {
  children: ReactNode;
  className?: string;
};

export function DashboardCard({ children, className }: DashboardCardProps) {
  return (
    <div className={cn('rounded-xl border border-gray-alpha-3 bg-gray-alpha-1 px-4 py-3', className)}>{children}</div>
  );
}
