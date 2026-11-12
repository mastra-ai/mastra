import type { AgentControllerSubagent, Session } from '@mastra/core/agent-controller';
import type { BackgroundTask, BackgroundTaskManagerConfig } from '@mastra/core/background-tasks';
import type { RequestContext } from '@mastra/core/request-context';
import { SUBAGENT_TOOL_NAME } from '../tool-names.js';
import type { BackgroundCompletionEvents, BackgroundTaskCompletionEvent } from './background-completion-events.js';

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

export interface BackgroundNoticeDeliveryOptions {
  /** False to only persist the notice to its thread, never starting a new turn. Default: true. */
  wake?: boolean;
}

export interface BackgroundNoticeDelivery {
  /**
   * Wakes the agent when the notice's thread is the session's current thread,
   * and persists it to the thread otherwise. Holds it while no session runs
   * the thread's resource yet.
   */
  deliver(
    target: BackgroundNoticeTarget,
    signal: BackgroundNoticeSignal,
    options?: BackgroundNoticeDeliveryOptions,
  ): Promise<void>;
  /** Retries the held notices. Call when a session is created. */
  flush(): Promise<void>;
}

type HeldNotice = { target: BackgroundNoticeTarget; signal: BackgroundNoticeSignal; wake: boolean };

export interface BackgroundNoticeDeliveryHooks {
  /**
   * Finds the live session that runs the notice's thread. Default: {@link findSessionForThread}. Undefined holds
   * the notice until a session runs the thread; null drops it, for a thread no session will ever run.
   */
  resolveSession?(target: BackgroundNoticeTarget): Promise<Session | null | undefined>;
  /**
   * The request context a woken run uses, for hosts whose runs need an identity the session doesn't carry.
   * Undefined saves the notice to the thread instead of waking it.
   */
  wakeRequestContext?(session: Session, target: BackgroundNoticeTarget): Promise<RequestContext | undefined>;
}

export function createBackgroundNoticeDelivery(
  getRouter: () => BackgroundCompletionRouter,
  hooks: BackgroundNoticeDeliveryHooks = {},
): BackgroundNoticeDelivery {
  const held: HeldNotice[] = [];
  const hold = (notice: HeldNotice) => {
    held.push(notice);
    if (held.length > MAX_HELD_NOTICES) held.shift();
  };

  const send = async ({ target, signal, wake }: HeldNotice): Promise<boolean> => {
    const session = hooks.resolveSession
      ? await hooks.resolveSession(target)
      : await findSessionForThread(getRouter(), target);
    // Dropped: nothing will ever take it, so holding it would only push out notices that can be delivered.
    if (session === null) return true;
    if (!session) return false;
    if (wake && session.thread.getId() === target.threadId) {
      const requestContext = hooks.wakeRequestContext ? await hooks.wakeRequestContext(session, target) : undefined;
      const woken =
        hooks.wakeRequestContext && !requestContext
          ? undefined
          : await session
              .sendSignal(signal, { ifIdle: { behavior: 'wake' }, requireDelivery: true, requestContext })
              .accepted.catch(() => undefined);
      // A wake that could not start or that the thread refused never reached the
      // thread. Save the notice instead; it has the event's id, so it is saved once.
      if (woken && woken.action !== 'blocked' && woken.action !== 'discard') return true;
    }
    await session.sendSignalToThread(signal, target).accepted;
    return true;
  };

  return {
    async deliver(target, signal, options) {
      const notice = { target, signal, wake: options?.wake ?? true };
      let sent: boolean;
      try {
        sent = await send(notice);
      } catch (error) {
        // A later session retries it, as `flush` does for notices held earlier.
        hold(notice);
        throw error;
      }
      if (!sent) hold(notice);
    },
    async flush() {
      for (const notice of held.splice(0)) {
        // A failed send (for example storage not ready yet) is retried on the
        // next session, within the cap.
        const sent = await send(notice).catch(() => false);
        if (!sent) hold(notice);
      }
    },
  };
}

const RESTART_FAILURE_MESSAGE = 'Worker process terminated before task completed';
const MAX_SUMMARY_LENGTH = 80;

type TaskStatus = 'completed' | 'failed' | 'cancelled';
/** Why a task ended without finishing its work, when no one asked it to stop. */
type Interruption = 'restart' | 'shutdown';

function summarize(text: string): string {
  const firstLine = text.trim().split('\n')[0]?.trim() ?? '';
  return firstLine.length > MAX_SUMMARY_LENGTH ? `${firstLine.slice(0, MAX_SUMMARY_LENGTH - 1)}…` : firstLine;
}

/** Names a task for people: the subagent's name and task, or the tool name. */
function describeTask(
  task: BackgroundTask,
  subagents: readonly Pick<AgentControllerSubagent, 'id' | 'name'>[],
): { title: string; summary?: string; label: string } {
  if (task.toolName === SUBAGENT_TOOL_NAME) {
    const agentType = typeof task.args?.agentType === 'string' ? task.args.agentType : undefined;
    const name = subagents.find(subagent => subagent.id === agentType)?.name ?? agentType ?? 'Subagent';
    const summary = typeof task.args?.task === 'string' ? summarize(task.args.task) : undefined;
    return { title: name, summary: summary || undefined, label: `${name} subagent` };
  }
  return { title: task.toolName, label: `${task.toolName} call` };
}

function taskNoticeContents(
  task: BackgroundTask,
  status: TaskStatus,
  label: string,
  interruption: Interruption | undefined,
): string {
  const call = `the original ${task.toolName} call (${task.toolCallId})`;
  if (interruption) return `Background ${label} was interrupted by a ${interruption} before it finished. See ${call}.`;
  if (status === 'cancelled') return `Background ${label} was cancelled. See ${call}.`;
  if (status === 'failed') return `Background ${label} failed. The error is in ${call}.`;
  return `Background ${label} finished. Its result is in ${call}.`;
}

export interface BackgroundCompletionCallbackOptions {
  /** Subagent definitions, to name background subagent tasks. */
  subagents?: readonly Pick<AgentControllerSubagent, 'id' | 'name'>[];
  /**
   * True while the task manager shuts down. Tasks it stops then are reported
   * as interrupted, and their notices are only persisted: waking an agent
   * would start a run in a process that is going away.
   */
  isShuttingDown?: () => boolean;
}

/**
 * Background task callbacks that tell the task's thread it finished.
 *
 * The first argument is the notice delivery, or (older call shape) a function
 * returning the session router, in which case a delivery is created for it.
 */
export function createBackgroundCompletionCallbacks(
  delivery: BackgroundNoticeDelivery | (() => BackgroundCompletionRouter),
  events?: BackgroundCompletionEvents,
  options: BackgroundCompletionCallbackOptions = {},
): Pick<BackgroundTaskManagerConfig, 'onTaskComplete' | 'onTaskFailed' | 'onTaskCancelled'> {
  // The older `(getController, events)` shape stays accepted because this module
  // is reachable through the package's public `./*` subpath export.
  const notices = typeof delivery === 'function' ? createBackgroundNoticeDelivery(delivery) : delivery;

  const deliver = async (task: BackgroundTask, status: TaskStatus) => {
    if (!task.resourceId || !task.threadId) return;
    const eventId = `background-task:${task.id}:${status}`;
    const { title, summary, label } = describeTask(task, options.subagents ?? []);
    const event: BackgroundTaskCompletionEvent = {
      kind: 'task',
      id: eventId,
      taskId: task.id,
      originRunId: task.runId,
      originToolCallId: task.toolCallId,
      resourceId: task.resourceId,
      threadId: task.threadId,
      toolName: task.toolName,
      status,
      title,
      ...(summary ? { summary } : {}),
    };
    const interruption: Interruption | undefined =
      status === 'failed' && task.error?.message === RESTART_FAILURE_MESSAGE
        ? 'restart'
        : status !== 'completed' && options.isShuttingDown?.()
          ? 'shutdown'
          : undefined;
    try {
      await notices.deliver(
        { resourceId: task.resourceId, threadId: task.threadId },
        {
          id: eventId,
          type: 'notification',
          tagName: 'notification',
          contents: taskNoticeContents(task, status, label, interruption),
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
              ...(interruption ? { interrupted: interruption } : {}),
            },
          },
        },
        // Nothing is waiting on an interrupted task, and the user who cancelled a
        // task already knows; the agent sees either notice on its next turn.
        { wake: !interruption && status !== 'cancelled' },
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
