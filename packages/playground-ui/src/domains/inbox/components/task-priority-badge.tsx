import { TaskPriority } from '@mastra/core/inbox';
import { Badge } from '../../../ds/components/Badge';
import { ArrowDown, ArrowRight, ArrowUp, AlertTriangle } from 'lucide-react';

export interface TaskPriorityBadgeProps {
  priority: TaskPriority;
}

const priorityConfig: Record<
  TaskPriority,
  {
    label: string;
    variant: 'default' | 'info' | 'success' | 'error';
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  [TaskPriority.LOW]: {
    label: 'Low',
    variant: 'default',
    Icon: ArrowDown,
  },
  [TaskPriority.NORMAL]: {
    label: 'Normal',
    variant: 'default',
    Icon: ArrowRight,
  },
  [TaskPriority.HIGH]: {
    label: 'High',
    variant: 'info',
    Icon: ArrowUp,
  },
  [TaskPriority.URGENT]: {
    label: 'Urgent',
    variant: 'error',
    Icon: AlertTriangle,
  },
};

export function TaskPriorityBadge({ priority }: TaskPriorityBadgeProps) {
  const config = priorityConfig[priority] ?? priorityConfig[TaskPriority.NORMAL];
  const { label, variant, Icon } = config;

  return (
    <Badge variant={variant} icon={<Icon className="h-3 w-3" />}>
      {label}
    </Badge>
  );
}
