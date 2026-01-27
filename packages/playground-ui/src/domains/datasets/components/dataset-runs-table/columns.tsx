import { Cell } from '@/ds/components/Table';
import { ColumnDef, Row } from '@tanstack/react-table';
import type { DatasetRun } from '@mastra/client-js';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { Eye } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

export type DatasetRunRow = DatasetRun;

export type DatasetRunsTableMeta = {
  onViewRun?: (run: DatasetRun) => void;
};

const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const StatusBadge = ({ status }: { status: DatasetRun['status'] }) => {
  const variants: Record<DatasetRun['status'], 'default' | 'success' | 'error' | 'info'> = {
    pending: 'default',
    running: 'info',
    completed: 'success',
    failed: 'error',
  };

  return <Badge variant={variants[status]}>{status}</Badge>;
};

export const columns: ColumnDef<DatasetRunRow>[] = [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: ({ row }: { row: Row<DatasetRunRow> }) => {
      const run = row.original;
      return (
        <Cell>
          <span className="font-mono text-xs">{run.name || run.id.slice(0, 8)}</span>
        </Cell>
      );
    },
  },
  {
    header: 'Status',
    accessorKey: 'status',
    cell: ({ row }: { row: Row<DatasetRunRow> }) => {
      const run = row.original;
      return (
        <Cell>
          <StatusBadge status={run.status} />
        </Cell>
      );
    },
  },
  {
    header: 'Target',
    accessorKey: 'targetId',
    cell: ({ row }: { row: Row<DatasetRunRow> }) => {
      const run = row.original;
      return (
        <Cell>
          <span className="text-xs">{run.targetType === 'AGENT' && run.targetId ? run.targetId : '—'}</span>
        </Cell>
      );
    },
  },
  {
    header: 'Progress',
    accessorKey: 'completedCount',
    cell: ({ row }: { row: Row<DatasetRunRow> }) => {
      const run = row.original;
      return (
        <Cell>
          <span className="font-mono text-xs">
            {run.completedCount}/{run.itemCount}
          </span>
        </Cell>
      );
    },
  },
  {
    header: 'Started',
    accessorKey: 'createdAt',
    cell: ({ row }: { row: Row<DatasetRunRow> }) => {
      const run = row.original;
      return <Cell className="text-xs">{formatDate(run.createdAt)}</Cell>;
    },
  },
  {
    header: 'Completed',
    accessorKey: 'completedAt',
    cell: ({ row }: { row: Row<DatasetRunRow> }) => {
      const run = row.original;
      return <Cell className="text-xs">{formatDate(run.completedAt)}</Cell>;
    },
  },
  {
    id: 'actions',
    header: '',
    size: 60,
    cell: ({ row, table }) => {
      const run = row.original;
      const meta = table.options.meta as DatasetRunsTableMeta | undefined;

      return (
        <Cell>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => meta?.onViewRun?.(run)}>
                <Icon>
                  <Eye className="h-4 w-4" />
                </Icon>
              </Button>
            </TooltipTrigger>
            <TooltipContent>View results</TooltipContent>
          </Tooltip>
        </Cell>
      );
    },
  },
];
