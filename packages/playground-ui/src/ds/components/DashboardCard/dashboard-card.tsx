import '../../../../new-theme.css';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DashboardCardProps = {
  children: ReactNode;
  className?: string;
};

export function DashboardCard({ children, className }: DashboardCardProps) {
  return <div className={cn('new-theme rounded-xl border border-border bg-card px-4 py-3', className)}>{children}</div>;
}
