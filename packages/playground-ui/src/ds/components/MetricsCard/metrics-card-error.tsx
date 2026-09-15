import { cn } from '@/lib/utils';

export function MetricsCardError({
  message = 'Failed to load data',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <p className="text-ui-sm text-accent2">{message}</p>
    </div>
  );
}
