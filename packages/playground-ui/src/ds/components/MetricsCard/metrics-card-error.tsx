import { cn } from '../../../lib/utils';
import { Txt } from '../Txt';

export function MetricsCardError({
  message = 'Failed to load data',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <Txt variant="caption" className="text-destructive-foreground">
        {message}
      </Txt>
    </div>
  );
}
