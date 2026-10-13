import { Txt } from '@/ds/components/Txt';

export function MetricsKpiCardNoChange({
  message = 'No previous value to compare',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <Txt as="span" variant="meta" tone="faint" className={className}>
      {message}
    </Txt>
  );
}
