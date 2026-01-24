import { BuildStatus } from '@/types/api';
import { cn } from '@/lib/utils';

interface BuildProgressProps {
  status: BuildStatus;
  className?: string;
}

const statusProgress: Record<BuildStatus, number> = {
  [BuildStatus.QUEUED]: 10,
  [BuildStatus.BUILDING]: 50,
  [BuildStatus.DEPLOYING]: 80,
  [BuildStatus.SUCCEEDED]: 100,
  [BuildStatus.FAILED]: 100,
  [BuildStatus.CANCELLED]: 100,
};

const statusColor: Record<BuildStatus, string> = {
  [BuildStatus.QUEUED]: 'bg-neutral6',
  [BuildStatus.BUILDING]: 'bg-yellow-500',
  [BuildStatus.DEPLOYING]: 'bg-accent1',
  [BuildStatus.SUCCEEDED]: 'bg-green-500',
  [BuildStatus.FAILED]: 'bg-red-500',
  [BuildStatus.CANCELLED]: 'bg-neutral3',
};

export function BuildProgress({ status, className }: BuildProgressProps) {
  const progress = statusProgress[status];
  const color = statusColor[status];
  const isAnimated = status === BuildStatus.BUILDING || status === BuildStatus.DEPLOYING;

  return (
    <div className={cn('w-full h-2 bg-surface4 rounded-full overflow-hidden', className)}>
      <div
        className={cn('h-full transition-all duration-500', color, isAnimated && 'animate-pulse')}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
