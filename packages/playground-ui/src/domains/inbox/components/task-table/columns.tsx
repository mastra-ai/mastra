import { Badge } from '@/ds/components/Badge';
import { Cell, EntryCell } from '@/ds/components/Table';
import { ColumnDef, Row } from '@tanstack/react-table';
import { TaskPriority } from '@mastra/core/inbox';
import { TaskStatusBadge } from '../task-status-badge';
import { TaskTableColumn } from './types';
import { useLinkComponent } from '@/lib/framework';
import { ArrowUp, ArrowDown, Minus, AlertTriangle } from 'lucide-react';

const priorityConfig: Record<
  number,
  {
    label: string;
    variant: 'default' | 'info' | 'error';
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
    Icon: Minus,
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

function formatDate(date: Date | string | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString();
}

function formatRelativeTime(date: Date | string | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'just now';
}

const NameCell = ({ row }: { row: Row<TaskTableColumn> }) => {
  const { Link, paths } = useLinkComponent();
  const task = row.original;
  const title = task.title || task.type || task.id;
  const description = task.sourceId ? `Source: ${task.sourceId}` : task.type;

  return (
    <EntryCell
      name={
        <Link className="w-full" href={paths.taskLink?.(task.inboxId, task.id) ?? '#'}>
          {title}
        </Link>
      }
      description={description}
    />
  );
};

export const columns: ColumnDef<TaskTableColumn>[] = [
  {
    header: 'Task',
    accessorKey: 'title',
    cell: NameCell,
    size: 300,
  },
  {
    header: 'Status',
    accessorKey: 'status',
    cell: ({ row }) => (
      <Cell>
        <TaskStatusBadge status={row.original.status} />
      </Cell>
    ),
    size: 140,
  },
  {
    header: 'Priority',
    accessorKey: 'priority',
    cell: ({ row }) => {
      const config = priorityConfig[row.original.priority] ?? priorityConfig[TaskPriority.NORMAL];
      const { label, variant, Icon } = config;
      return (
        <Cell>
          <Badge variant={variant} icon={<Icon className="h-3 w-3" />}>
            {label}
          </Badge>
        </Cell>
      );
    },
    size: 120,
  },
  {
    header: 'Type',
    accessorKey: 'type',
    cell: ({ row }) => (
      <Cell>
        <span className="text-text2 text-sm">{row.original.type}</span>
      </Cell>
    ),
    size: 120,
  },
  {
    header: 'Claimed By',
    accessorKey: 'claimedBy',
    cell: ({ row }) => (
      <Cell>
        <span className="text-text2 text-sm">{row.original.claimedBy ?? '-'}</span>
      </Cell>
    ),
    size: 150,
  },
  {
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ row }) => (
      <Cell>
        <span className="text-text2 text-sm" title={formatDate(row.original.createdAt)}>
          {formatRelativeTime(row.original.createdAt)}
        </span>
      </Cell>
    ),
    size: 100,
  },
];
