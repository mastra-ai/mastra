import type {
  BackgroundProcessExitEvent,
  BackgroundTaskCompletionEvent,
} from '@mastra/code-sdk/agents/background-completion-events';
import { parseBackgroundProcessPid } from '@mastra/code-sdk/agents/background-processes';
import { builtinSubagents } from '@mastra/code-sdk/agents/subagents/index';
import { MC_TOOLS } from '@mastra/code-sdk/tool-names';

const SUBAGENT_TOOL_NAME = 'subagent';

export type BackgroundActivityStatus = 'accepted' | 'completed' | 'failed' | 'cancelled';

export interface BackgroundActivity {
  id: string;
  /** Task id, or `process:<pid>` for a background shell. Also the activity's key in the map. */
  taskId: string;
  /** Set for background shells started with `execute_command`; tasks leave it unset. */
  kind?: 'process';
  pid?: string;
  exitCode?: number;
  toolCallId: string;
  toolName: string;
  /** What the user recognizes the work by: the shell's description or the subagent's task. */
  label?: string;
  resourceId: string;
  threadId: string;
  status: BackgroundActivityStatus;
  createdAt: number;
  completedAt?: number;
}

export interface BackgroundToolContext {
  toolName: string;
  resourceId: string;
  threadId: string;
  createdAt: number;
  args?: unknown;
}

export { parseBackgroundProcessPid };

export function processActivityKey(pid: string): string {
  return `process:${pid}`;
}

function firstLine(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const line = value.trim().split('\n')[0]?.trim();
  return line || undefined;
}

/** The label a background call shows in the activity list. */
export function describeBackgroundCall(toolName: string, args: unknown): string | undefined {
  const record = args && typeof args === 'object' ? (args as Record<string, unknown>) : {};
  if (toolName === MC_TOOLS.EXECUTE_COMMAND) return firstLine(record.description) ?? firstLine(record.command);
  if (toolName === SUBAGENT_TOOL_NAME) {
    const task = firstLine(record.task);
    const agentType = firstLine(record.agentType);
    // Named like the completion card; custom subagents fall back to their id.
    const name = builtinSubagents.find(subagent => subagent.id === agentType)?.name ?? agentType;
    return task && name ? `${name}: ${task}` : (task ?? name);
  }
  return undefined;
}

export function acceptBackgroundActivity(
  activities: Map<string, BackgroundActivity>,
  taskId: string,
  toolCallId: string,
  context: BackgroundToolContext,
): void {
  const existing = activities.get(taskId);
  if (existing?.status === 'completed' || existing?.status === 'failed' || existing?.status === 'cancelled') return;

  activities.set(taskId, {
    id: existing?.id ?? `background-task:${taskId}`,
    taskId,
    toolCallId,
    toolName: context.toolName,
    label: describeBackgroundCall(context.toolName, context.args),
    resourceId: context.resourceId,
    threadId: context.threadId,
    status: 'accepted',
    createdAt: existing?.createdAt ?? context.createdAt,
  });
}

export function completeBackgroundActivity(
  activities: Map<string, BackgroundActivity>,
  event: BackgroundTaskCompletionEvent,
): void {
  const existing = activities.get(event.taskId);
  if (existing?.status === 'cancelled' && event.status !== 'cancelled') return;
  activities.set(event.taskId, {
    id: existing?.id ?? `background-task:${event.taskId}`,
    taskId: event.taskId,
    toolCallId: event.originToolCallId,
    toolName: event.toolName,
    label: existing?.label,
    resourceId: event.resourceId,
    threadId: event.threadId,
    status: event.status,
    createdAt: existing?.createdAt ?? Date.now(),
    completedAt: Date.now(),
  });
}

export function startBackgroundProcessActivity(
  activities: Map<string, BackgroundActivity>,
  pid: string,
  toolCallId: string,
  context: BackgroundToolContext,
): void {
  const key = processActivityKey(pid);
  // The exit can be reported before the call's result for a command that ends at once.
  if (activities.get(key)?.toolCallId === toolCallId) return;
  activities.set(key, {
    id: key,
    taskId: key,
    kind: 'process',
    pid,
    toolCallId,
    toolName: context.toolName,
    label: describeBackgroundCall(context.toolName, context.args),
    resourceId: context.resourceId,
    threadId: context.threadId,
    status: 'accepted',
    createdAt: context.createdAt,
  });
}

export function finishBackgroundProcessActivity(
  activities: Map<string, BackgroundActivity>,
  event: BackgroundProcessExitEvent,
): void {
  const key = processActivityKey(event.pid);
  const existing = activities.get(key);
  const sameProcess = existing && (!event.toolCallId || existing.toolCallId === event.toolCallId);
  if (!sameProcess && (!event.resourceId || !event.threadId)) return;
  const now = Date.now();
  activities.set(key, {
    id: key,
    taskId: key,
    kind: 'process',
    pid: event.pid,
    exitCode: event.exitCode,
    toolCallId: event.toolCallId ?? existing?.toolCallId ?? '',
    toolName: MC_TOOLS.EXECUTE_COMMAND,
    label: (sameProcess ? existing.label : undefined) ?? event.command,
    resourceId: (sameProcess ? existing.resourceId : event.resourceId) ?? '',
    threadId: (sameProcess ? existing.threadId : event.threadId) ?? '',
    status: event.killed ? 'cancelled' : event.exitCode === 0 ? 'completed' : 'failed',
    createdAt: (sameProcess ? existing.createdAt : undefined) ?? now,
    completedAt: now,
  });
}

export function compareBackgroundActivities(a: BackgroundActivity, b: BackgroundActivity): number {
  if (a.status === 'accepted' && b.status !== 'accepted') return -1;
  if (a.status !== 'accepted' && b.status === 'accepted') return 1;
  return b.createdAt - a.createdAt;
}

export function getBackgroundActivitiesForTarget(
  activities: Map<string, BackgroundActivity>,
  resourceId: string,
  threadId: string | null,
): BackgroundActivity[] {
  if (!threadId) return [];
  return [...activities.values()].filter(
    activity => activity.resourceId === resourceId && activity.threadId === threadId,
  );
}

export function clearCompletedBackgroundActivitiesForTarget(
  activities: Map<string, BackgroundActivity>,
  resourceId: string,
  threadId: string | null,
): void {
  if (!threadId) return;
  for (const [taskId, activity] of activities) {
    if (activity.resourceId === resourceId && activity.threadId === threadId && activity.status !== 'accepted') {
      activities.delete(taskId);
    }
  }
}
