import { cn } from '@/lib/utils';

export function MetricsKpiCardLabel({ children, className }: { children: string; className?: string }) {
  return <span className={cn('text-subheading text-foreground', className)}>{children}</span>;
}
