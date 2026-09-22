import { cn } from '@/lib/utils';

export function MetricsKpiCardError({
  message = 'Failed to load data',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return <span className={cn('text-caption text-destructive-fg', className)}>{message}</span>;
}
