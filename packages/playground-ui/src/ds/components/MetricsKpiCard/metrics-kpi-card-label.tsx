import { cn } from '@/lib/utils';

export function MetricsKpiCardLabel({ children, className }: { children: string; className?: string }) {
  return <span className={cn('text-body font-medium text-foreground', className)}>{children}</span>;
}
