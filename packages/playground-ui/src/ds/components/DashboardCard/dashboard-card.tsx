import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DashboardCardProps = {
  children: ReactNode;
  className?: string;
};

export function DashboardCard({ children, className }: DashboardCardProps) {
  return <div className={cn('border border-border1 rounded-lg p-6 bg-surface2', className)}>{children}</div>;
}
