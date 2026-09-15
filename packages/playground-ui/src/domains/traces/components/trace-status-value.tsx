import { Shimmer } from '@/ds/components/Shimmer';

export type TraceStatusValueStatus = 'success' | 'error' | 'running';

const STATUS_LABELS: Record<TraceStatusValueStatus, string> = {
  success: 'Success',
  error: 'Error',
  running: 'Running',
};

const STATUS_STYLES: Record<TraceStatusValueStatus, string> = {
  success: 'text-accent1',
  error: 'text-error',
  running: 'text-neutral4',
};

export interface TraceStatusValueProps {
  status: TraceStatusValueStatus;
}

export function TraceStatusValue({ status }: TraceStatusValueProps) {
  const label = STATUS_LABELS[status];
  const className = STATUS_STYLES[status];

  return (
    <Shimmer active={status === 'running'} className={className}>
      {label}
    </Shimmer>
  );
}
