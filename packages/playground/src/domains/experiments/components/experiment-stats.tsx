import type { DatasetExperiment } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { cn } from '@mastra/playground-ui/utils/cn';
import { CheckIcon, ClockIcon, TimerIcon, XIcon } from 'lucide-react';

export interface ExperimentStatsProps {
  experiment: DatasetExperiment;
  className?: string;
}

type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

const statusConfigMap: Record<RunStatus, { icon: React.ReactNode; variant: 'success' | 'error' | 'info' | 'warning' }> =
  {
    pending: { icon: <ClockIcon />, variant: 'warning' },
    running: { icon: <TimerIcon />, variant: 'info' },
    completed: { icon: <CheckIcon />, variant: 'success' },
    failed: { icon: <XIcon />, variant: 'error' },
  };

export function ExperimentStatusBadge({ status }: { status: DatasetExperiment['status'] }) {
  const config = statusConfigMap[status as RunStatus] ?? statusConfigMap.pending;

  return (
    <Badge variant={config.variant} icon={config.icon} className="capitalize">
      {status}
    </Badge>
  );
}

export function ExperimentStats({ experiment, className }: ExperimentStatsProps) {
  const status = experiment.status as RunStatus;
  const pendingCount = experiment.totalItems - experiment.succeededCount - experiment.failedCount;

  return (
    <div className={cn('grid justify-items-end gap-3', className)}>
      <div
        className={cn(
          'flex items-center gap-3 text-neutral3 text-ui-md ',
          '[&>span]:flex [&>span]:gap-1 [&>span]:items-center ',
          '[&_b]:text-neutral4 [&_b]:font-semibold',
        )}
      >
        <span>
          Total: <b>{experiment.totalItems}</b>
        </span>
        <span>
          Succeeded: <b>{experiment.succeededCount}</b>
        </span>
        <span>
          Failed: <b>{experiment.failedCount}</b>
        </span>
        {(status === 'pending' || status === 'running') && (
          <span>
            Pending: <b>{pendingCount}</b>
          </span>
        )}
      </div>

      {/* <div className="flex items-center gap-1.5 text-ui text-neutral4">
        <span className="text-neutral3">{experiment.targetType}:</span>
        <span className="text-neutral5 font-mono">{experiment.targetId}</span>
      </div> */}
    </div>
  );
}
