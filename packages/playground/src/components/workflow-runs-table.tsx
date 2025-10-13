import { Link } from 'react-router';
import { useMemo, useState } from 'react';
import { Network, Clock, CheckCircle, XCircle, PlayCircle, Circle, Copy, Check } from 'lucide-react';
import { WorkflowRunWithMetadata } from '@/hooks/use-all-workflow-runs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Button } from '@/components/ui/button';

interface WorkflowRunsTableProps {
  runs: WorkflowRunWithMetadata[];
  isLoading: boolean;
}

function getStatusBadge(status: string) {
  const statusLower = status.toLowerCase();

  switch (statusLower) {
    case 'success':
    case 'completed':
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Success
        </Badge>
      );
    case 'failed':
    case 'error':
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case 'running':
    case 'in_progress':
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          <PlayCircle className="h-3 w-3 mr-1" />
          Running
        </Badge>
      );
    case 'canceled':
    case 'cancelled':
      return (
        <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">
          <Circle className="h-3 w-3 mr-1" />
          Canceled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <Circle className="h-3 w-3 mr-1" />
          {status || 'Unknown'}
        </Badge>
      );
  }
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp) return '-';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function CopyableRunId({ runId }: { runId: string }) {
  const { handleCopy, hasCopied } = useCopyToClipboard({ text: runId });

  return (
    <div className="flex items-center gap-2 group" onClick={e => e.stopPropagation()}>
      <span className="font-mono text-xs text-text3">{runId}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          handleCopy();
        }}
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {hasCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-text3" />}
      </Button>
    </div>
  );
}

export function WorkflowRunsTable({ runs, isLoading }: WorkflowRunsTableProps) {
  const [search, setSearch] = useState('');

  const filteredRuns = useMemo(() => {
    if (!search) return runs;
    const searchLower = search.toLowerCase();
    return runs.filter(
      run =>
        run.workflowName.toLowerCase().includes(searchLower) ||
        run.runId.toLowerCase().includes(searchLower) ||
        run.status.toLowerCase().includes(searchLower),
    );
  }, [runs, search]);

  if (isLoading) {
    return <WorkflowRunsTableSkeleton />;
  }

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Network className="h-12 w-12 text-icon3 mb-4" />
        <h3 className="text-lg font-medium text-text2 mb-2">No workflow runs found</h3>
        <p className="text-sm text-text3 max-w-md">
          Workflow runs will appear here once you execute a workflow. Try running a workflow to see its execution
          history.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search by workflow name, run ID, or status..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-md bg-surface2 border-border1"
        />
        <span className="text-sm text-text3">
          {filteredRuns.length} {filteredRuns.length === 1 ? 'run' : 'runs'}
        </span>
      </div>

      <div className="rounded-md border border-border1 bg-surface2">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border1">
              <TableHead className="text-text3 font-medium">Workflow</TableHead>
              <TableHead className="text-text3 font-medium">Run ID</TableHead>
              <TableHead className="text-text3 font-medium">Status</TableHead>
              <TableHead className="text-text3 font-medium">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRuns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-text3 py-8">
                  No runs match your search
                </TableCell>
              </TableRow>
            ) : (
              filteredRuns.map(run => (
                <TableRow
                  key={run.runId}
                  className="border-border1 hover:bg-surface3 transition-colors cursor-pointer"
                  onClick={() => {
                    window.location.href = `/workflows/${run.workflowId}/graph/${run.runId}`;
                  }}
                >
                  <TableCell>
                    <Link
                      to={`/workflows/${run.workflowId}/graph/${run.runId}`}
                      className="font-medium text-text1 hover:text-accent1 transition-colors"
                    >
                      {run.workflowName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <CopyableRunId runId={run.runId} />
                  </TableCell>
                  <TableCell>{getStatusBadge(run.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-text3 text-sm">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(run.timestamp)}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function WorkflowRunsTableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="rounded-md border border-border1">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border1">
              <TableHead>Workflow</TableHead>
              <TableHead>Run ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} className="border-border1">
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
