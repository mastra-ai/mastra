import { TaskStatus } from '@mastra/core/inbox';
import { Badge } from '../../../ds/components/Badge';
import { CheckCircle, Clock, XCircle, Play, Pause, RefreshCw, AlertCircle } from 'lucide-react';

export interface TaskStatusBadgeProps {
  status: TaskStatus;
}

const statusConfig: Record<
  TaskStatus,
  {
    label: string;
    variant: 'default' | 'info' | 'success' | 'error';
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  [TaskStatus.PENDING]: {
    label: 'Pending',
    variant: 'default',
    Icon: Clock,
  },
  [TaskStatus.CLAIMED]: {
    label: 'Claimed',
    variant: 'info',
    Icon: RefreshCw,
  },
  [TaskStatus.IN_PROGRESS]: {
    label: 'In Progress',
    variant: 'info',
    Icon: Play,
  },
  [TaskStatus.WAITING_FOR_INPUT]: {
    label: 'Waiting',
    variant: 'info',
    Icon: Pause,
  },
  [TaskStatus.COMPLETED]: {
    label: 'Completed',
    variant: 'success',
    Icon: CheckCircle,
  },
  [TaskStatus.FAILED]: {
    label: 'Failed',
    variant: 'error',
    Icon: XCircle,
  },
  [TaskStatus.CANCELLED]: {
    label: 'Cancelled',
    variant: 'default',
    Icon: AlertCircle,
  },
};

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig[TaskStatus.PENDING];
  const { label, variant, Icon } = config;

  return (
    <Badge variant={variant} icon={<Icon className="h-3 w-3" />}>
      {label}
    </Badge>
  );
}
