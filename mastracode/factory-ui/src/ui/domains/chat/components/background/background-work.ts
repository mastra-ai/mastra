import type { MessageEntry, TimelineEntry } from '../../services/transcript';
import type { ToolPart } from '../transcript-parts';
import { signalPartsText } from '../TranscriptSignals';
import { isRecord } from '../transcript-shared';

const EXECUTE_COMMAND_TOOLS = new Set(['execute_command', 'mastra_workspace_execute_command']);
const STARTED_BACKGROUND_PROCESS = /^Started background process \(PID: ([^)]+)\)/;
const ENDED_TASK_STATUSES = new Set(['completed', 'failed', 'cancelled', 'timed_out']);

/** An `execute_command` call asked to run in the background: its process outlives the call. */
export function isBackgroundLaunch(toolName: string, args: unknown): boolean {
  return EXECUTE_COMMAND_TOOLS.has(toolName) && isRecord(args) && args.background === true;
}

/** The PID a background launch reported, once its call returned. */
export function backgroundLaunchPid(result: unknown): string | undefined {
  return typeof result === 'string' ? STARTED_BACKGROUND_PROCESS.exec(result)?.[1] : undefined;
}

export interface BackgroundTaskRef {
  taskId: string;
  status: string | undefined;
}

/** The background task a call was handed to, from the metadata core keeps on its part. */
export function backgroundTaskOf(part: ToolPart): BackgroundTaskRef | undefined {
  const mastra = isRecord(part.providerMetadata) ? part.providerMetadata.mastra : undefined;
  const task = isRecord(mastra) ? mastra.backgroundTask : undefined;
  if (!isRecord(task) || typeof task.taskId !== 'string') return undefined;
  return { taskId: task.taskId, status: typeof task.status === 'string' ? task.status : undefined };
}

/** A call whose task still runs in the background: its part holds a placeholder, not the result. */
export function isDeferredTask(task: BackgroundTaskRef | undefined): task is BackgroundTaskRef {
  return task !== undefined && !ENDED_TASK_STATUSES.has(task.status ?? '');
}

/** Calls whose work goes on after they returned. They draw their own row, never inside a stretch of finished calls. */
export function isBackgroundCall(part: ToolPart): boolean {
  const { toolName } = part.toolInvocation;
  const args = 'args' in part.toolInvocation ? part.toolInvocation.args : undefined;
  return isBackgroundLaunch(toolName, args) || isDeferredTask(backgroundTaskOf(part));
}

/** The exit or end notice the agent got for a piece of background work. */
export type BackgroundFinishedNotice =
  | {
      kind: 'process';
      pid: string;
      toolCallId?: string;
      exitCode: number;
      summary?: string;
      text: string;
    }
  | {
      kind: 'task';
      taskId: string;
      toolCallId?: string;
      toolName?: string;
      status: string;
      title?: string;
      summary?: string;
      text: string;
    };

/** Reads a background work notice off a `notification` signal; undefined for any other entry. */
export function backgroundFinishedNotice(entry: MessageEntry): BackgroundFinishedNotice | undefined {
  if (entry.message.role !== 'signal') return undefined;
  const signal = entry.message.content.metadata?.signal;
  if (!isRecord(signal) || signal.type !== 'notification' || !isRecord(signal.metadata)) return undefined;
  const completion = signal.metadata.backgroundCompletion;
  if (!isRecord(completion)) return undefined;
  const toolCallId = typeof completion.originToolCallId === 'string' ? completion.originToolCallId : undefined;
  const summary = typeof completion.summary === 'string' && completion.summary ? completion.summary : undefined;
  const text = signalPartsText(entry);
  if (completion.kind === 'process') {
    if (typeof completion.pid !== 'string' || typeof completion.exitCode !== 'number') return undefined;
    return { kind: 'process', pid: completion.pid, toolCallId, exitCode: completion.exitCode, summary, text };
  }
  if (typeof completion.taskId !== 'string' || typeof completion.status !== 'string') return undefined;
  const title = typeof completion.title === 'string' ? completion.title : undefined;
  const toolName = typeof completion.toolName === 'string' ? completion.toolName : undefined;
  return {
    kind: 'task',
    taskId: completion.taskId,
    toolCallId,
    toolName,
    status: completion.status,
    title,
    summary,
    text,
  };
}

/** Exit codes the transcript already reported, by the call that started each process. */
export function backgroundExits(entries: readonly TimelineEntry[]): ReadonlyMap<string, number> {
  const exits = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind !== 'message') continue;
    const notice = backgroundFinishedNotice(entry);
    if (notice?.kind === 'process' && notice.toolCallId) exits.set(notice.toolCallId, notice.exitCode);
  }
  return exits;
}

export interface RunningBackgroundTask extends BackgroundTaskRef {
  toolCallId: string;
  toolName: string;
  args: unknown;
}

/** Calls in the transcript whose background task has not ended. */
export function runningBackgroundTasks(entries: readonly TimelineEntry[]): RunningBackgroundTask[] {
  const tasks: RunningBackgroundTask[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'message') continue;
    for (const part of entry.message.content.parts ?? []) {
      if (part.type !== 'tool-invocation') continue;
      const task = backgroundTaskOf(part);
      if (!isDeferredTask(task)) continue;
      const { toolCallId, toolName } = part.toolInvocation;
      const args = 'args' in part.toolInvocation ? part.toolInvocation.args : undefined;
      tasks.push({ ...task, toolCallId, toolName, args });
    }
  }
  return tasks;
}
