import { useEffect, useState } from 'react';
import type { ActivityStatus } from '@/ds/components/ai/activity';

export type McpTaskStatus = 'working' | 'input_required' | 'completed' | 'failed' | 'cancelled';

/** What `@mastra/mcp`'s client writes to a task-backed tool's output stream (`MCPTaskProgress`). */
export interface McpTaskProgress {
  type: 'mcp-task';
  taskId: string;
  status: McpTaskStatus;
  createdAt: string;
  serverName: string;
}

const STATUSES: ReadonlySet<string> = new Set(['working', 'input_required', 'completed', 'failed', 'cancelled']);

export const isTerminalMcpTaskStatus = (status: McpTaskStatus) =>
  status === 'completed' || status === 'failed' || status === 'cancelled';

function isMcpTaskProgress(value: unknown): value is McpTaskProgress {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    entry.type === 'mcp-task' &&
    typeof entry.taskId === 'string' &&
    typeof entry.createdAt === 'string' &&
    typeof entry.serverName === 'string' &&
    typeof entry.status === 'string' &&
    STATUSES.has(entry.status)
  );
}

/** While a tool call runs, its progress writes accumulate as the call's `result` array. */
function latestProgress(result: unknown): McpTaskProgress | undefined {
  if (!Array.isArray(result)) return undefined;
  for (let index = result.length - 1; index >= 0; index--) {
    if (isMcpTaskProgress(result[index])) return result[index];
  }
  return undefined;
}

export interface McpTaskView extends McpTaskProgress {
  /** When the card saw the task end; the elapsed time stops here. */
  endedAt?: number;
}

/**
 * The MCP task behind a tool call, if the call continued as one. The final result replaces the
 * progress writes, so the last one seen is kept for as long as the card is mounted; its terminal
 * status then comes from how the call ended. Progress isn't saved with the thread, so a reloaded
 * card has no task to show.
 */
export function useMcpTaskProgress(result: unknown, status: ActivityStatus): McpTaskView | undefined {
  const live = latestProgress(result);
  const [seen, setSeen] = useState(live);
  if (live && (live.taskId !== seen?.taskId || live.status !== seen.status)) setSeen(live);

  const task = live ?? seen;
  const ended = task && !live && status !== 'running';
  const taskStatus: McpTaskStatus | undefined = !task
    ? undefined
    : ended && !isTerminalMcpTaskStatus(task.status)
      ? status === 'error'
        ? 'failed'
        : 'completed'
      : task.status;
  const terminal = taskStatus !== undefined && isTerminalMcpTaskStatus(taskStatus);

  const [endedAt, setEndedAt] = useState<number>();
  useEffect(() => {
    if (terminal && endedAt === undefined) setEndedAt(Date.now());
  }, [terminal, endedAt]);

  return task && taskStatus ? { ...task, status: taskStatus, endedAt } : undefined;
}
