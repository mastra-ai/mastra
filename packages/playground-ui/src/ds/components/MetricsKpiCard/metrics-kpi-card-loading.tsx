import { Spinner } from '../Spinner/spinner';
import { Txt } from '../Txt';

export function MetricsKpiCardLoading({ className }: { className?: string }) {
  return (
    <Txt as="span" className={className}>
      <Spinner size="md" variant="pulse" className="text-placeholder" />
    </Txt>
  );
}
