import { Link } from 'react-router';
import { ChevronRight, CheckCircle2, XCircle, Circle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import type { Trace } from '@/types/api';
import { cn } from '@/lib/utils';

const statusConfig: Record<Trace['status'], { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  ok: { icon: CheckCircle2, color: 'text-green-500' },
  error: { icon: XCircle, color: 'text-red-500' },
  unset: { icon: Circle, color: 'text-neutral6' },
};

interface TraceTableProps {
  traces: Trace[];
  projectId: string;
}

export function TraceTable({ traces, projectId }: TraceTableProps) {
  const formatDuration = (ms: number | null) => {
    if (ms === null) return '-';
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Trace</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Started</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {traces.map(trace => {
          const statusInfo = statusConfig[trace.status];
          const StatusIcon = statusInfo.icon;

          return (
            <TableRow key={trace.traceId}>
              <TableCell>
                <div>
                  <div className="font-medium">{trace.name}</div>
                  <div className="text-sm text-neutral6 font-mono">{trace.traceId.slice(0, 16)}...</div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <StatusIcon className={cn('h-4 w-4', statusInfo.color)} />
                  <span className="capitalize">{trace.status}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="font-mono text-sm">{formatDuration(trace.durationMs)}</span>
              </TableCell>
              <TableCell className="text-neutral6">
                {format(new Date(trace.startTime), 'MMM d, HH:mm:ss.SSS')}
              </TableCell>
              <TableCell>
                <Link
                  to={`/projects/${projectId}/observability/traces/${trace.traceId}`}
                  className="text-accent1 hover:text-accent2"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
