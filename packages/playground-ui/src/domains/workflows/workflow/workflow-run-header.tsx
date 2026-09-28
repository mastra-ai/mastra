import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { Pause, Timer } from 'lucide-react';
import { WorkflowRunStatusIcon } from '../components/workflow-run-status-icon';
import type { WorkflowRunStreamResult } from '../context/workflow-run-context';
import type { WorkflowRunTiming } from '../context/workflow-step-timing';
import { resolveRunTiming } from '../context/workflow-step-timing';
import { Badge } from '@/ds/components/Badge';
import { CopyButton } from '@/ds/components/CopyButton';
import { RelativeTimestamp } from '@/ds/components/RelativeTimestamp';
import { Txt } from '@/ds/components/Txt';
import { useTimeDiff } from '@/hooks/use-time-diff';
import { formatDuration } from '@/utils/duration';

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

function RunDuration({ span, spansSuspension }: Omit<WorkflowRunTiming, 'waitingSince'>) {
  const elapsed = formatDuration(useTimeDiff(span));

  return (
    <span
      className="flex items-center gap-1.5 text-meta text-muted-foreground"
      title={spansSuspension ? 'Run duration, including time spent suspended' : 'Run duration'}
    >
      <Timer aria-hidden className="size-3.5" />
      <Txt as="span" variant="meta" font="mono">
        {elapsed}
      </Txt>
    </span>
  );
}

function RunWaiting({ since }: { since: number }) {
  const waiting = formatDuration(useTimeDiff({ startedAt: since }));

  return (
    <span className="flex items-center gap-1.5 text-meta text-accent3 tabular-nums" title="Waiting for input">
      <Pause aria-hidden className="size-3.5" />
      {waiting}
    </span>
  );
}

export function RunWorkflowHeader({
  runId,
  status,
  result,
  timestamp,
  resourceId,
}: {
  runId: string;
  status?: WorkflowRunStatus;
  result: WorkflowRunStreamResult | null;
  timestamp?: number;
  resourceId?: string;
}) {
  const timing = resolveRunTiming(result?.steps, status);

  return (
    <div className="flex w-full flex-col gap-2 px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <WorkflowRunStatusBadge status={status} />
          {resourceId && (
            <Badge size="md" variant="neutral" emphasis="muted" className="min-w-0">
              <span className="min-w-0 truncate" title={`Resource ${resourceId}`}>
                {resourceId}
              </span>
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {timing?.waitingSince !== undefined && <RunWaiting since={timing.waitingSince} />}
          {timing && <RunDuration span={timing.span} spansSuspension={timing.spansSuspension} />}
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-1 text-meta text-muted-foreground">
        <Txt as="span" variant="meta" font="mono" className="min-w-0 truncate" title={runId}>
          {runId}
        </Txt>
        <CopyButton content={runId} tooltip="Copy run ID" variant="ghost" size="icon-sm" className="shrink-0" />
        {timestamp !== undefined && Number.isFinite(timestamp) ? (
          <RelativeTimestamp value={timestamp} className="ml-auto shrink-0" />
        ) : null}
      </div>
    </div>
  );
}
