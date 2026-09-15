import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Timer } from 'lucide-react';
import { WorkflowRunStatusIcon } from '../components/workflow-run-status-icon';
import type { WorkflowRunStreamResult } from '../context/workflow-run-context';

function formatRunStatus(status?: WorkflowRunStatus) {
  if (!status) return 'Run';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function WorkflowRunStatusBadge({ status }: { status?: WorkflowRunStatus }) {
  return (
    <Badge
      size="md"
      variant={status === 'paused' ? 'yellow' : 'neutral'}
      emphasis="muted"
      icon={status && <WorkflowRunStatusIcon status={status} />}
    >
      {formatRunStatus(status)}
    </Badge>
  );
}

function formatRunDuration(durationMs?: number) {
  if (durationMs === undefined) return '—';
  if (durationMs < 1000) return `${durationMs}ms`;

  const seconds = durationMs / 1000;
  if (seconds < 60) return `${Number(seconds.toPrecision(3))}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function formatRelativeTime(ms?: number) {
  if (!ms || ms <= 0) return '—';
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const seconds = Math.floor(abs / 1000);
  if (seconds < 60) return diff >= 0 ? `in ${seconds}s` : `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return diff >= 0 ? `in ${minutes}m` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return diff >= 0 ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return diff >= 0 ? `in ${days}d` : `${days}d ago`;
}

function getRunDuration(result: WorkflowRunStreamResult | null, status?: WorkflowRunStatus) {
  const stepTimes: Array<{ startedAt: number; endedAt?: number }> = Object.values(result?.steps ?? {}).flatMap(step => {
    const startedAt = 'startedAt' in step ? step.startedAt : undefined;
    if (typeof startedAt !== 'number') return [];
    const endedAt = 'endedAt' in step ? step.endedAt : undefined;
    return [{ startedAt, ...(typeof endedAt === 'number' ? { endedAt } : {}) }];
  });

  if (stepTimes.length === 0) return undefined;

  const startedAt = Math.min(...stepTimes.map(step => step.startedAt));
  const endedTimes = stepTimes.flatMap(step => (step.endedAt ? [step.endedAt] : []));
  const endedAt = endedTimes.length > 0 ? Math.max(...endedTimes) : undefined;
  const isActive = status === 'running' || status === 'suspended' || status === 'waiting';
  const effectiveEndedAt = endedAt ?? (isActive ? Date.now() : undefined);
  return effectiveEndedAt === undefined ? undefined : effectiveEndedAt - startedAt;
}

export function RunWorkflowHeader({
  runId,
  status,
  result,
  timestamp,
}: {
  runId: string;
  status?: WorkflowRunStatus;
  result: WorkflowRunStreamResult | null;
  timestamp?: number;
}) {
  const runDuration = getRunDuration(result, status);

  return (
    <div className="flex w-full flex-col gap-2 px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WorkflowRunStatusBadge status={status} />
        {runDuration !== undefined && (
          <span className="flex items-center gap-1.5 text-ui-xs tabular-nums text-neutral4" title="Run duration">
            <Timer aria-hidden className="size-3.5" />
            {formatRunDuration(runDuration)}
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-1 text-ui-xs text-neutral3">
        <span className="min-w-0 truncate font-mono" title={runId}>
          {runId}
        </span>
        <CopyButton content={runId} tooltip="Copy run ID" variant="ghost" size="icon-sm" className="shrink-0" />
        {timestamp !== undefined && <span className="ml-auto shrink-0">{formatRelativeTime(timestamp)}</span>}
      </div>
    </div>
  );
}
