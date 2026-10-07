import type { DatasetExperiment } from '@mastra/client-js';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { CircleCheckIcon, CircleXIcon, ClockIcon } from 'lucide-react';

export interface ExperimentStatsProps {
  experiment: DatasetExperiment;
  className?: string;
}

type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

const statusIconMap: Record<RunStatus, { icon: React.ReactNode; label: string }> = {
  pending: { icon: <ClockIcon className="size-4 text-warning-foreground" />, label: 'Pending' },
  running: { icon: <Spinner size="sm" />, label: 'Running' },
  completed: { icon: <CircleCheckIcon className="size-4 text-muted-foreground" />, label: 'Completed' },
  failed: { icon: <CircleXIcon className="size-4 text-destructive-foreground" />, label: 'Failed' },
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
          'text-muted-foreground',
          'flex items-center gap-3',
          '[&>span]:flex [&>span]:items-center [&>span]:gap-1',
        )}
      >
        <Txt as="span" variant="caption">
          Total:{' '}
          <Txt as="b" variant="column" tone="muted">
            {experiment.totalItems}
          </Txt>
        </Txt>
        <Txt as="span" variant="caption">
          Processed:{' '}
          <Txt as="b" variant="column" tone="muted">
            {experiment.succeededCount}
          </Txt>
        </Txt>
        <Txt as="span" variant="caption">
          Errored:{' '}
          <Txt as="b" variant="column" tone="muted">
            {experiment.failedCount}
          </Txt>
        </Txt>
        {(status === 'pending' || status === 'running') && (
          <Txt as="span" variant="caption">
            Pending:{' '}
            <Txt as="b" variant="column" tone="muted">
              {pendingCount}
            </Txt>
          </Txt>
        )}
      </div>
    </div>
  );
}
