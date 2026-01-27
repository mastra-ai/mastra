import { Cell } from '@/ds/components/Table';
import { ColumnDef, Row } from '@tanstack/react-table';
import type { DatasetRunResultWithInput } from '@mastra/client-js';
import { Badge } from '@/ds/components/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { useLinkComponent } from '@/lib/framework';
import { useTraceDialogOptional } from '../../context/trace-dialog-context';

export type RunResultRow = DatasetRunResultWithInput;

// Truncate and show full content in tooltip
const JsonCell = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return (
      <Cell>
        <span className="font-mono text-xs text-text-muted">null</span>
      </Cell>
    );
  }
  const jsonStr = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const truncated = jsonStr.length > 60 ? jsonStr.slice(0, 60) + '...' : jsonStr;

  return (
    <Cell>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="font-mono text-xs cursor-help">{truncated}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-lg max-h-64 overflow-auto">
          <pre className="text-xs whitespace-pre-wrap">{jsonStr}</pre>
        </TooltipContent>
      </Tooltip>
    </Cell>
  );
};

const StatusBadge = ({ status }: { status: DatasetRunResultWithInput['status'] }) => {
  const variants: Record<DatasetRunResultWithInput['status'], 'success' | 'error'> = {
    success: 'success',
    error: 'error',
  };

  return <Badge variant={variants[status]}>{status}</Badge>;
};

const formatDuration = (ms: number | undefined) => {
  if (ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const TraceCell = ({ row }: { row: Row<RunResultRow> }) => {
  const { Link, paths } = useLinkComponent();
  const traceDialog = useTraceDialogOptional();
  const result = row.original;

  if (!result.traceId) {
    return (
      <Cell>
        <span className="text-text-muted">—</span>
      </Cell>
    );
  }

  // If context available, open dialog instead of navigating
  if (traceDialog) {
    return (
      <Cell>
        <button onClick={() => traceDialog.openTrace(result.traceId!)} className="text-xs text-accent1 hover:underline">
          View
        </button>
      </Cell>
    );
  }

  // Fallback to link navigation
  return (
    <Cell>
      <Link href={paths.traceLink(result.traceId)} className="text-xs text-accent1 hover:underline">
        View
      </Link>
    </Cell>
  );
};

export const columns: ColumnDef<RunResultRow>[] = [
  {
    header: 'Status',
    accessorKey: 'status',
    size: 100,
    cell: ({ row }: { row: Row<RunResultRow> }) => {
      const result = row.original;
      return (
        <Cell>
          <StatusBadge status={result.status} />
        </Cell>
      );
    },
  },
  {
    header: 'Input',
    accessorKey: 'itemInput',
    cell: ({ row }: { row: Row<RunResultRow> }) => {
      const result = row.original;
      return <JsonCell value={result.itemInput} />;
    },
  },
  {
    header: 'Actual Output',
    accessorKey: 'actualOutput',
    cell: ({ row }: { row: Row<RunResultRow> }) => {
      const result = row.original;
      return <JsonCell value={result.actualOutput} />;
    },
  },
  {
    header: 'Error',
    accessorKey: 'error',
    cell: ({ row }: { row: Row<RunResultRow> }) => {
      const result = row.original;
      if (!result.error) {
        return (
          <Cell>
            <span className="text-text-muted">—</span>
          </Cell>
        );
      }
      return (
        <Cell>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-red-500 cursor-help">
                {result.error.length > 40 ? result.error.slice(0, 40) + '...' : result.error}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-md">
              <span className="text-xs">{result.error}</span>
            </TooltipContent>
          </Tooltip>
        </Cell>
      );
    },
  },
  {
    header: 'Duration',
    accessorKey: 'durationMs',
    size: 100,
    cell: ({ row }: { row: Row<RunResultRow> }) => {
      const result = row.original;
      return (
        <Cell>
          <span className="font-mono text-xs">{formatDuration(result.durationMs)}</span>
        </Cell>
      );
    },
  },
  {
    header: 'Trace',
    accessorKey: 'traceId',
    size: 80,
    cell: TraceCell,
  },
];
