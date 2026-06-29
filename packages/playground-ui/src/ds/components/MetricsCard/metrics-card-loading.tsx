import { Spinner } from '@/ds/components/Spinner/spinner';
import { cn } from '@/lib/utils';

export function MetricsCardLoading({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Spinner size="md" variant="pulse" className="text-neutral1" />
    </div>
  );
}
