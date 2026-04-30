import { cn } from '@/lib/utils';

export function MetricsCardNoData({ message = 'No data yet', className }: { message?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center h-full', className)}>
      <p className="text-neutral1 text-sm">{message}</p>
    </div>
  );
}
