import { cn } from '@/lib/utils';
import { Spinner } from '@/ds/components/Spinner/spinner';
import { Colors } from '@/ds/tokens';

export function MetricsKpiCardLoading({ className }: { className?: string }) {
  return (
    <span className={cn('text-sm', className)}>
      <Spinner size="md" color={Colors.neutral1} />
    </span>
  );
}
