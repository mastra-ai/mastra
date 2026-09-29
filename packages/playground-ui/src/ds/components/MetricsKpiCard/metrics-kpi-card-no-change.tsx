import { cn } from '@/lib/utils';

export function MetricsKpiCardNoChange({
  message = 'No previous value to compare',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return <span className={cn('text-meta text-placeholder', className)}>{message}</span>;
}
