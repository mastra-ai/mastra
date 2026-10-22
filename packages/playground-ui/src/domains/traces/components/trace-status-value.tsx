import { Badge } from '../../../ds/components/Badge';
import type { BadgeVariant } from '../../../ds/components/Badge';
import { Shimmer } from '../../../ds/components/Shimmer';

export type TraceStatusValueStatus = 'success' | 'error' | 'running';

const STATUS_LABELS: Record<TraceStatusValueStatus, string> = {
  success: 'Success',
  error: 'Error',
  running: 'Running',
};

const STATUS_VARIANTS: Record<TraceStatusValueStatus, BadgeVariant> = {
  success: 'success',
  error: 'destructive',
  running: 'neutral',
};

export interface TraceStatusValueProps {
  status: TraceStatusValueStatus;
}

export function TraceStatusValue({ status }: TraceStatusValueProps) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} emphasis="subtle">
      <Shimmer active={status === 'running'}>{STATUS_LABELS[status]}</Shimmer>
    </Badge>
  );
}
