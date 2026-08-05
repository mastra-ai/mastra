import { cn } from '@/lib/utils';

export function MetricsKpiCardLabel({ children, className }: { children: string; className?: string }) {
  return <span className={cn('text-ui-md leading-relaxed text-neutral3', className)}>{children}</span>;
}
