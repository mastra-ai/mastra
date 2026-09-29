import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export function MetricsKpiCardNoData({ message = 'No data yet', className }: { message?: string; className?: string }) {
  return (
    <Txt as="span" variant="meta" tone="faint" className={className}>
      {message}
    </Txt>
  );
}
