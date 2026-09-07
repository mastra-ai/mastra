import type { DatasetExperiment } from '@mastra/client-js';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { cn } from '@mastra/playground-ui/utils/cn';
import { CircleCheckIcon, CircleXIcon, ClockIcon } from 'lucide-react';

export interface ExperimentStatsProps {
  experiment: DatasetExperiment;
  className?: string;
}

type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

const statusIconMap: Record<RunStatus, { icon: React.ReactNode; label: string }> = {
  pending: { icon: <ClockIcon className="text-warning1 size-4" />, label: 'Pending' },
  running: { icon: <Spinner size="sm" />, label: 'Running' },
  completed: { icon: <CircleCheckIcon className="text-neutral3 size-4" />, label: 'Completed' },
  failed: { icon: <CircleXIcon className="text-error size-4" />, label: 'Failed' },
};

/** Compact status indicator — a small icon with a tooltip describing the run state. */
export function ExperimentStatusIcon({
  status,
  className,
}: {
  status: DatasetExperiment['status'];
  className?: string;
}) {
  const config = statusIconMap[status as RunStatus] ?? statusIconMap.pending;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span tabIndex={0} className={cn('flex shrink-0 items-center', className)}>
            {config.icon}
          </span>
        }
      />
      <TooltipContent>{config.label}</TooltipContent>
    </Tooltip>
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
          Processed: <b>{experiment.succeededCount}</b>
        </span>
        <span>
          Errored: <b>{experiment.failedCount}</b>
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
