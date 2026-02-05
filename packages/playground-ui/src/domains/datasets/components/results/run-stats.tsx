import { DatasetRun } from '@mastra/client-js';
import { Badge } from '@/ds/components/Badge';
import { cn } from '@/lib/utils';
import { CheckIcon, ClockIcon, TimerIcon, XIcon } from 'lucide-react';

export interface RunStatsProps {
  run: DatasetRun;
  className?: string;
}

type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

const statusIconMap: Record<RunStatus, React.ReactNode> = {
  pending: <ClockIcon />,
  running: <TimerIcon />,
  completed: <CheckIcon />,
  failed: <XIcon />,
};

export function RunStats({ run, className }: RunStatsProps) {
  const status = run.status as RunStatus;
  const pendingCount = run.totalItems - run.succeededCount - run.failedCount;

  return (
    <div className={cn('grid justify-items-end gap-3', className)}>
      <div className="flex p-1 px-3 text-ui-lg capitalize text-neutral4 gap-2 items-center bg-surface5 rounded-lg ">
        <span
          className={cn('w-5 h-5 flex items-center justify-center rounded-full text-black', '[&>svg]:w-4 [&>svg]:h-4', {
            'bg-green-700': status === 'completed',
            'bg-red-700': status === 'failed',
            'bg-cyan-600': status === 'running',
            'bg-yellow-600': status === 'pending',
          })}
        >
          {statusIconMap[status]}
        </span>
        {run.status}
      </div>
      <div
        className={cn(
          'flex items-center gap-3 text-neutral3 text-ui-md ',
          '[&>span]:flex [&>span]:gap-1 [&>span]:items-center ',
          '[&_b]:text-neutral4 [&_b]:font-semibold',
        )}
      >
        <span>
          Total: <b>{run.totalItems}</b>
        </span>
        <span>
          Succeeded: <b>{run.succeededCount}</b>
        </span>
        <span>
          Failed: <b>{run.failedCount}</b>
        </span>
        {(status === 'pending' || status === 'running') && (
          <span>
            Pending: <b>{pendingCount}</b>
          </span>
        )}
      </div>

      {/* <div className="flex items-center gap-1.5 text-ui text-neutral4">
        <span className="text-neutral3">{run.targetType}:</span>
        <span className="text-neutral5 font-mono">{run.targetId}</span>
      </div> */}
    </div>
  );
}
