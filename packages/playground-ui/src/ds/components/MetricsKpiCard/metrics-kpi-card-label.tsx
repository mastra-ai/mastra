import { cn } from '@/lib/utils';

export function MetricsKpiCardLabel({ children, className }: { children: string; className?: string }) {
  return <span className={cn('text-ui-md text-neutral3 leading-relaxed', className)}>{children}</span>;
}
