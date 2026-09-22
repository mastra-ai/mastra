import { cn } from '@/lib/utils';

export function MetricsKpiCardLabel({ children, className }: { children: string; className?: string }) {
  return <span className={cn('text-body text-muted-foreground', className)}>{children}</span>;
}
