import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { isTerminalMcpTaskStatus } from './use-mcp-task-progress';
import type { McpTaskStatus, McpTaskView } from './use-mcp-task-progress';
import { Badge } from '@/ds/components/Badge';
import type { BadgeIndicator, BadgeVariant } from '@/ds/components/Badge';
import { CopyButton } from '@/ds/components/CopyButton';

const STATUS: Record<McpTaskStatus, { label: string; variant: BadgeVariant; indicator?: BadgeIndicator }> = {
  working: { label: 'working', variant: 'info', indicator: 'pulse' },
  input_required: { label: 'input required', variant: 'warning', indicator: 'dot' },
  completed: { label: 'completed', variant: 'success' },
  failed: { label: 'failed', variant: 'destructive' },
  cancelled: { label: 'cancelled', variant: 'neutral' },
};

/** Now, every second, until `endedAt` is known. */
function useClock(endedAt: number | undefined) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (endedAt !== undefined) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [endedAt]);
  return endedAt ?? now;
}

const formatElapsed = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** `task · working · 0:42` for a tool call that continued as an MCP task, with its task id to copy. */
export function McpTaskChip({ task }: { task: McpTaskView }) {
  const { label, variant, indicator } = STATUS[task.status];
  const terminal = isTerminalMcpTaskStatus(task.status);
  const elapsed = useClock(terminal ? task.endedAt : undefined) - Date.parse(task.createdAt);

  return (
    <span className="inline-flex items-center gap-1" data-testid="mcp-task-chip">
      <Badge
        size="sm"
        variant={variant}
        emphasis="subtle"
        indicator={indicator}
        title={`MCP task ${task.taskId} on ${task.serverName}`}
      >
        task · {label} · <span className="font-mono tabular-nums">{formatElapsed(elapsed)}</span>
      </Badge>
      <CopyButton content={task.taskId} tooltip="Copy MCP task id" copyMessage="Copied MCP task id" />
    </span>
  );
}

const BACKGROUND_POLL_MS = 2_000;

/** How the Mastra background task ended, as the MCP task's status; undefined while it runs. */
const BACKGROUND_END: Record<string, McpTaskStatus | undefined> = {
  completed: 'completed',
  failed: 'failed',
  timed_out: 'failed',
  cancelled: 'cancelled',
};

/**
 * The chip for a call deferred to a Mastra background task. The chat stream ends with the turn, so
 * the task's later progress and its end never reach this card; until the progress shows the task
 * ended, the background task is polled for how it ended.
 */
export function BackgroundMcpTaskChip({ task, backgroundTaskId }: { task: McpTaskView; backgroundTaskId: string }) {
  const client = useMastraClient();
  const ended = isTerminalMcpTaskStatus(task.status);
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ['background-task', backgroundTaskId],
    queryFn: () => client.getBackgroundTask(backgroundTaskId),
    enabled: !ended,
    refetchInterval: query => (BACKGROUND_END[query.state.data?.status ?? ''] ? false : BACKGROUND_POLL_MS),
  });
  const backgroundEnd = ended ? undefined : BACKGROUND_END[data?.status ?? ''];
  const completedAt = data?.completedAt ? new Date(data.completedAt).getTime() : undefined;

  return (
    <McpTaskChip
      task={
        backgroundEnd ? { ...task, status: backgroundEnd, endedAt: completedAt ?? task.endedAt ?? dataUpdatedAt } : task
      }
    />
  );
}
