import { cn } from '../../../lib/utils';
import { Spinner } from '../Spinner/spinner';

export function MetricsCardLoading({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Spinner size="md" variant="pulse" className="text-placeholder" />
    </div>
  );
}
