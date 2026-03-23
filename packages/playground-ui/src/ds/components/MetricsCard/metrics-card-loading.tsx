import { cn } from '@/lib/utils';
import { Spinner } from '@/ds/components/Spinner/spinner';
import { Colors } from '@/ds/tokens';

export function MetricsCardLoading({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Spinner size="md" color={Colors.neutral1} />
    </div>
  );
}
