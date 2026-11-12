import type { AgentControllerSubagent, Session } from '@mastra/core/agent-controller';
import type { BackgroundTask, BackgroundTaskManagerConfig } from '@mastra/core/background-tasks';
import type { BackgroundCompletionEvents } from './background-completion-events.js';

interface BackgroundCompletionRouter<TState = unknown> {
  getSession(sessionId: string): Promise<Session<TState> | undefined>;
  /** Live sessions to search when no session is addressed by the thread or resource id. */
  listLiveSessions?(): Iterable<Session<TState>>;
}

export type BackgroundNoticeSignal = Parameters<Session['sendSignalToThread']>[0];

export interface BackgroundNoticeTarget {
  resourceId: string;
  threadId: string;
}

/**
 * Find the live session a thread runs in. Factory sessions are addressed by
 * their thread id; Mastra Code sessions by their resource id, or, after
 * switching resources, by being the live session on that thread. Only a
 * session working on the same resource qualifies, so a thread is never run by
 * a session of another resource.
 */
export async function findSessionForThread<TState>(
  controller: BackgroundCompletionRouter<TState>,
  { resourceId, threadId }: { resourceId: string; threadId: string },
): Promise<Session<TState> | undefined> {
  for (const sessionId of new Set([threadId, resourceId])) {
    const session = await controller.getSession(sessionId);
    if (session?.identity.getResourceId() === resourceId) return session;
  }
  // A session that switched resources stays registered under its original id;
  // only one working on the task's own thread qualifies, never a neighbour on a
  // shared resource.
  for (const session of controller.listLiveSessions?.() ?? []) {
    if (session.identity.getResourceId() === resourceId && session.thread.getId() === threadId) return session;
  }
  return undefined;
}

// Recovery after a restart can report many orphaned tasks before any session
// exists; past this many, the oldest notices are dropped.
const MAX_HELD_NOTICES = 100;

export interface BackgroundNoticeDelivery {
  /**
   * Wakes the agent when the notice's thread is the session's current thread,
   * and persists it to the thread otherwise. Holds it while no session runs
   * the thread's resource yet.
   */
  deliver(target: BackgroundNoticeTarget, signal: BackgroundNoticeSignal): Promise<void>;
  /** Retries the held notices. Call when a session is created. */
  flush(): Promise<void>;
}

export function createBackgroundNoticeDelivery(getRouter: () => BackgroundCompletionRouter): BackgroundNoticeDelivery {
  const held: Array<{ target: BackgroundNoticeTarget; signal: BackgroundNoticeSignal }> = [];

  const send = async (target: BackgroundNoticeTarget, signal: BackgroundNoticeSignal): Promise<boolean> => {
    const session = await findSessionForThread(getRouter(), target);
    if (!session) return false;
    if (session.thread.getId() === target.threadId) {
      await session.sendSignal(signal, { ifIdle: { behavior: 'wake' } }).accepted;
    } else {
      await session.sendSignalToThread(signal, target).accepted;
    }
    return true;
  };

  return {
    async deliver(target, signal) {
      if (await send(target, signal)) return;
      held.push({ target, signal });
      if (held.length > MAX_HELD_NOTICES) held.shift();
    },
    async flush() {
      for (const notice of held.splice(0)) {
        try {
          if (!(await send(notice.target, notice.signal))) held.push(notice);
        } catch {
          // The thread is gone or rejected the notice; retrying would fail the same way.
        }
      }
    },
  };
}

const RESTART_FAILURE_MESSAGE = 'Worker process terminated before task completed';
const MAX_SUMMARY_LENGTH = 80;

function summarize(text: string): string {
  const firstLine = text.trim().split('\n')[0]?.trim() ?? '';
  return firstLine.length > MAX_SUMMARY_LENGTH ? `${firstLine.slice(0, MAX_SUMMARY_LENGTH - 1)}…` : firstLine;
}

/** Names a task for people: the subagent's name and task, or the tool name. */
function describeTask(
  task: BackgroundTask,
  subagents: readonly Pick<AgentControllerSubagent, 'id' | 'name'>[],
): { title: string; summary?: string; label: string } {
  if (task.toolName === 'subagent') {
    const agentType = typeof task.args?.agentType === 'string' ? task.args.agentType : undefined;
    const name = subagents.find(subagent => subagent.id === agentType)?.name ?? agentType ?? 'Subagent';
    const summary = typeof task.args?.task === 'string' ? summarize(task.args.task) : undefined;
    return { title: name, summary: summary || undefined, label: `${name} subagent` };
  }
  return { title: task.toolName, label: `${task.toolName} call` };
}

function taskNoticeContents(
  task: BackgroundTask,
  status: 'completed' | 'failed' | 'cancelled',
  label: string,
  interrupted: boolean,
): string {
  const call = `the original ${task.toolName} call (${task.toolCallId})`;
  if (interrupted) return `Background ${label} was interrupted by a restart before it finished. See ${call}.`;
  if (status === 'cancelled') return `Background ${label} was cancelled. See ${call}.`;
  if (status === 'failed') return `Background ${label} failed. The error is in ${call}.`;
  return `Background ${label} finished. Its result is in ${call}.`;
}

export function createBackgroundCompletionCallbacks(
  delivery: BackgroundNoticeDelivery,
  events?: BackgroundCompletionEvents,
  options: { subagents?: readonly Pick<AgentControllerSubagent, 'id' | 'name'>[] } = {},
): Pick<BackgroundTaskManagerConfig, 'onTaskComplete' | 'onTaskFailed' | 'onTaskCancelled'> {
  const deliver = async (task: BackgroundTask, status: 'completed' | 'failed' | 'cancelled') => {
    if (!task.resourceId || !task.threadId) return;
    const eventId = `background-task:${task.id}:${status}`;
    const event = {
      id: eventId,
      taskId: task.id,
      originRunId: task.runId,
      originToolCallId: task.toolCallId,
      resourceId: task.resourceId,
      threadId: task.threadId,
      toolName: task.toolName,
      status,
    };
    const { title, summary, label } = describeTask(task, options.subagents ?? []);
    const interrupted = status === 'failed' && task.error?.message === RESTART_FAILURE_MESSAGE;
    try {
      await delivery.deliver(
        { resourceId: task.resourceId, threadId: task.threadId },
        {
          id: eventId,
          type: 'notification',
          tagName: 'notification',
          contents: taskNoticeContents(task, status, label, interrupted),
          attributes: {
            source: 'background-work',
            kind: `background-task-${status}`,
            priority: status === 'failed' ? 'high' : 'low',
            status,
          },
          metadata: {
            backgroundCompletion: {
              eventId,
              taskId: task.id,
              originRunId: task.runId,
              originToolCallId: task.toolCallId,
              toolName: task.toolName,
              status,
              title,
              ...(summary ? { summary } : {}),
              ...(interrupted ? { interrupted: true } : {}),
            },
          },
        },
      );
    } finally {
      events?.publish(event);
    }
  };

  return {
    onTaskComplete: task => deliver(task, 'completed'),
    onTaskFailed: task => deliver(task, 'failed'),
    onTaskCancelled: task => deliver(task, 'cancelled'),
  };
}
