import { cn } from '@/lib/utils';

export function MetricsKpiCardLabel({ children, className }: { children: string; className?: string }) {
  return <span className={cn('text-ui-md font-medium text-muted-foreground', className)}>{children}</span>;
}
