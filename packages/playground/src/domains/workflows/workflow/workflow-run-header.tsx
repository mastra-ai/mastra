import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { formatDistanceToNowStrict } from 'date-fns';
import { Timer } from 'lucide-react';
import { WorkflowRunStatusIcon } from '../components/workflow-run-status-icon';
import type { WorkflowRunStreamResult } from '../context/workflow-run-context';
import { useTimeDiff } from '@/lib/ai-ui/hooks/use-time-diff';

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

function formatRunDuration(durationMs: number) {
  if (durationMs < 1000) return `${durationMs}ms`;

  const seconds = durationMs / 1000;
  if (seconds < 60) return `${Number(seconds.toPrecision(3))}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

const isRunInProgress = (status?: WorkflowRunStatus) =>
  status === 'running' || status === 'suspended' || status === 'waiting';

type RunSpan = { startedAt: number; endedAt?: number };

function getRunSpan(result: WorkflowRunStreamResult | null, status?: WorkflowRunStatus): RunSpan | undefined {
  const stepSpans = Object.values(result?.steps ?? {}).flatMap(step => {
    const startedAt = 'startedAt' in step ? step.startedAt : undefined;
    if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) return [];
    const endedAt = 'endedAt' in step ? step.endedAt : undefined;
    const hasValidEnd = typeof endedAt === 'number' && Number.isFinite(endedAt) && endedAt >= startedAt;
    return [{ startedAt, ...(hasValidEnd ? { endedAt } : {}) }];
  });
  if (stepSpans.length === 0) return undefined;

  const startedAt = Math.min(...stepSpans.map(span => span.startedAt));
  if (isRunInProgress(status)) return { startedAt };

  const endedTimes = stepSpans.flatMap(span => (span.endedAt === undefined ? [] : [span.endedAt]));
  return endedTimes.length === 0 ? undefined : { startedAt, endedAt: Math.max(...endedTimes) };
}

function RunDuration({ span }: { span: RunSpan }) {
  return (
    <span className="text-ui-xs text-neutral4 flex items-center gap-1.5 tabular-nums" title="Run duration">
      <Timer aria-hidden className="size-3.5" />
      {formatRunDuration(useTimeDiff(span))}
    </span>
  );
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
  const runSpan = getRunSpan(result, status);

  return (
    <div className="flex w-full flex-col gap-2 px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WorkflowRunStatusBadge status={status} />
        {runSpan && <RunDuration span={runSpan} />}
      </div>
      <div className="text-ui-xs text-neutral3 flex min-w-0 items-center gap-1">
        <span className="min-w-0 truncate font-mono" title={runId}>
          {runId}
        </span>
        <CopyButton content={runId} tooltip="Copy run ID" variant="ghost" size="icon-sm" className="shrink-0" />
        {timestamp !== undefined && Number.isFinite(timestamp) ? (
          <span className="ml-auto shrink-0">{formatDistanceToNowStrict(timestamp, { addSuffix: true })}</span>
        ) : null}
      </div>
    </div>
  );
}
