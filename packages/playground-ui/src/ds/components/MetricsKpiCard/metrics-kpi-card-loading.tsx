import { Spinner } from '@/ds/components/Spinner/spinner';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export function MetricsKpiCardLoading({ className }: { className?: string }) {
  return (
    <Txt as="span" className={className}>
      <Spinner size="md" variant="pulse" className="text-placeholder" />
    </Txt>
  );
}
