import { cn } from '@/lib/utils';
import { CircleXIcon } from 'lucide-react';

export function MetricsCardError({
  message = 'Failed to load data',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 items-center justify-center', className)}>
      <p className="text-ui-sm text-red-600">{message}</p>
    </div>
  );
}
