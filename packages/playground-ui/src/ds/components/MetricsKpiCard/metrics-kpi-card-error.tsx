import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export function MetricsKpiCardError({
  message = 'Failed to load data',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <Txt as="span" variant="meta" className={cn('text-destructive-indicator', className)}>
      {message}
    </Txt>
  );
}
