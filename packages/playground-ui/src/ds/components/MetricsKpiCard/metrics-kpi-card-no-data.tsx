import { cn } from '@/lib/utils';

export function MetricsKpiCardNoData({ message = 'No data yet', className }: { message?: string; className?: string }) {
  return <span className={cn('text-sm text-(--text-disabled)', className)}>{message}</span>;
}
