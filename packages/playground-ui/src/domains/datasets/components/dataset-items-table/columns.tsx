import { Cell } from '@/ds/components/Table';
import { ColumnDef, Row } from '@tanstack/react-table';
import type { DatasetItem } from '@mastra/client-js';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { Pencil, Trash2 } from 'lucide-react';

export type DatasetItemRow = DatasetItem;

export type DatasetItemsTableMeta = {
  onEdit?: (item: DatasetItem) => void;
  onDelete?: (item: DatasetItem) => void;
};

// Truncate and show full content in tooltip
const JsonCell = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return (
      <Cell>
        <span className="font-mono text-xs text-text-muted">—</span>
      </Cell>
    );
  }
  const jsonStr = JSON.stringify(value, null, 2);
  const truncated = jsonStr.length > 50 ? jsonStr.slice(0, 50) + '...' : jsonStr;

  return (
    <Cell>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="font-mono text-xs cursor-help">{truncated}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-md">
          <pre className="text-xs whitespace-pre-wrap">{jsonStr}</pre>
        </TooltipContent>
      </Tooltip>
    </Cell>
  );
};

const formatDate = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const columns: ColumnDef<DatasetItemRow>[] = [
  {
    header: 'Input',
    accessorKey: 'input',
    cell: ({ row }: { row: Row<DatasetItemRow> }) => {
      const item = row.original;
      return <JsonCell value={item.input} />;
    },
  },
  {
    header: 'Expected Output',
    accessorKey: 'expectedOutput',
    cell: ({ row }: { row: Row<DatasetItemRow> }) => {
      const item = row.original;
      return <JsonCell value={item.expectedOutput} />;
    },
  },
  {
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ row }: { row: Row<DatasetItemRow> }) => {
      const item = row.original;
      return <Cell>{formatDate(item.createdAt)}</Cell>;
    },
  },
  {
    id: 'actions',
    header: '',
    size: 80,
    cell: ({ row, table }) => {
      const item = row.original;
      const meta = table.options.meta as DatasetItemsTableMeta | undefined;

      return (
        <Cell>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => meta?.onEdit?.(item)}>
                  <Icon>
                    <Pencil className="h-4 w-4" />
                  </Icon>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit item</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                  onClick={() => meta?.onDelete?.(item)}
                >
                  <Icon>
                    <Trash2 className="h-4 w-4" />
                  </Icon>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete item</TooltipContent>
            </Tooltip>
          </div>
        </Cell>
      );
    },
  },
];
