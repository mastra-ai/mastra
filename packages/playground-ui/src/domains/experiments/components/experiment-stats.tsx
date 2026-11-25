import type { DatasetExperiment } from '@mastra/client-js';
import { STATUS_LABEL } from './experiment-columns';
import { Spinner } from '@/ds/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { IconCircleCheck } from '@/ds/icons/central/IconCircleCheck';
import { IconCircleX } from '@/ds/icons/central/IconCircleX';
import { IconClock } from '@/ds/icons/central/IconClock';
import { cn } from '@/utils/cn';

type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

// Labels match the experiments list badges so "queued" vs "in progress" reads the same everywhere.
const statusIconMap: Record<RunStatus, { icon: React.ReactNode; label: string }> = {
  pending: { icon: <IconClock className="size-icon-md text-warning-foreground" />, label: STATUS_LABEL.pending },
  running: { icon: <Spinner size="sm" />, label: STATUS_LABEL.running },
  completed: {
    icon: <IconCircleCheck className="size-icon-md text-muted-foreground" />,
    label: STATUS_LABEL.completed,
  },
  failed: { icon: <IconCircleX className="size-icon-md text-destructive-foreground" />, label: STATUS_LABEL.failed },
};

/** Compact status indicator — a small icon with a tooltip describing the run state. */
export function ExperimentStatusIcon({
  status,
  className,
}: {
  status: DatasetExperiment['status'];
  className?: string;
}) {
  const config = statusIconMap[status] ?? statusIconMap.pending;

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
