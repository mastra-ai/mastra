import { cn } from '@/lib/utils';

export function MetricsCardError({
  message = 'Failed to load data',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <p className="text-ui-sm text-red-400">{message}</p>
    </div>
  );
}
