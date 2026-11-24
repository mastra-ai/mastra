import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export function MetricsCardNoData({ message = 'No data yet', className }: { message?: string; className?: string }) {
  return (
    <div className={cn('flex h-full items-center justify-center', className)}>
      <Txt tone="faint">{message}</Txt>
    </div>
  );
}
