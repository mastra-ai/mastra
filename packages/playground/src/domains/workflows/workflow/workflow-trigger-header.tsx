import type { GetWorkflowResponse } from '@mastra/client-js';
import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';

import { WorkflowRunStatusIcon } from '../components/workflow-run-status-icon';
import type { WorkflowRunStreamResult } from '../context/workflow-run-context';
import { useTimeDiff } from '@/lib/ai-ui/hooks/use-time-diff';

function formatRunStatus(status?: WorkflowRunStatus) {
  if (!status) return 'Run';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatRunDuration(durationMs: number) {
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

type RunSpan = { startedAt: number; endedAt?: number };

function getRunSpan(result: WorkflowRunStreamResult | null, status?: WorkflowRunStatus): RunSpan | undefined {
  const stepTimes = Object.values(result?.steps ?? {}).flatMap(step =>
    step.startedAt === undefined ? [] : [{ startedAt: step.startedAt, endedAt: step.endedAt }],
  );
  if (stepTimes.length === 0) return undefined;

  const startedAt = Math.min(...stepTimes.map(step => step.startedAt));
  const isActive = status === 'running' || status === 'suspended' || status === 'waiting';
  if (isActive) return { startedAt };

  const endedTimes = stepTimes.flatMap(step => (step.endedAt === undefined ? [] : [step.endedAt]));
  return endedTimes.length === 0 ? undefined : { startedAt, endedAt: Math.max(...endedTimes) };
}

function RunDuration({ span }: { span: RunSpan }) {
  return formatRunDuration(useTimeDiff(span));
}

export function InitialWorkflowHeader({ workflow, workflowId }: { workflow: GetWorkflowResponse; workflowId: string }) {
  const stepsCount = Object.keys(workflow.steps ?? {}).length;

  return (
    <div className="flex w-full items-center gap-2 px-5">
      <Icon className="text-neutral4 shrink-0">
        <WorkflowIcon />
      </Icon>
      <Txt as="span" variant="ui-md" className="text-neutral5 truncate font-semibold">
        {workflow.name ?? workflowId}
      </Txt>
      <CopyButton content={workflow.name ?? workflowId} variant="ghost" className="shrink-0" />
      <Badge className="ml-auto shrink-0">
        {stepsCount} step{stepsCount === 1 ? '' : 's'}
      </Badge>
    </div>
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
    <div className="flex w-full items-start gap-3 px-5">
      {status && (
        <span className="shrink-0 pt-1">
          <WorkflowRunStatusIcon status={status} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <Txt as="span" variant="ui-md" className="text-neutral5 block truncate font-semibold">
          {formatRunStatus(status)}
        </Txt>
        <Txt as="span" variant="ui-xs" className="text-neutral3 block truncate" title={runId}>
          {runId}
        </Txt>
      </div>
      <div className="shrink-0 text-right">
        <Txt as="span" variant="ui-xs" className="text-neutral5 block font-medium">
          {runSpan ? <RunDuration span={runSpan} /> : '—'}
        </Txt>
        <Txt as="span" variant="ui-xs" className="text-neutral3 block">
          {formatRelativeTime(timestamp)}
        </Txt>
      </div>
    </div>
  );
}
