import { Spinner } from '@/ds/components/Spinner/spinner';
import { cn } from '@/lib/utils';

export function MetricsKpiCardLoading({ className }: { className?: string }) {
  return (
    <span className={cn('text-sm', className)}>
      <Spinner size="md" variant="pulse" className="text-neutral1" />
    </span>
  );
}
