import type { ElicitRequestParams } from '@modelcontextprotocol/client';
import { DEFAULT_TASK_POLL_INTERVAL_MS, isTerminalTaskStatus } from '../../shared/tasks';
import type { MCPDetailedTask, MCPTask, MCPTaskInputRequest, MCPTaskInputResponses } from '../../shared/tasks';
import type { MCPInputRequestHandler } from '../types';

/** A task that reached a terminal status. */
export type MCPTerminalTask = Extract<MCPDetailedTask, { status: 'completed' | 'failed' | 'cancelled' }>;

export interface TaskWaitPort {
  get(taskId: string, options: { signal?: AbortSignal }): Promise<MCPDetailedTask>;
  update(taskId: string, inputResponses: MCPTaskInputResponses, options: { signal?: AbortSignal }): Promise<void>;
  cancel(taskId: string): Promise<void>;
  /**
   * Restores the connection after a polling request failed on the transport. Resolves when the
   * next poll may be sent. While the server is down this may reject with an error `isRecoverable`
   * accepts; the outage then continues. Any other rejection ends the wait.
   */
  recover(error: unknown): Promise<void>;
  /** Whether a polling failure is a transport problem worth recovering from. */
  isRecoverable(error: unknown): boolean;
}

export interface TaskWaitOptions {
  signal?: AbortSignal;
  /** Answers `input_required` task requests. Without one, such a task stops the wait. */
  inputRequests?: MCPInputRequestHandler;
  /** Interval used when the server suggests none. */
  pollIntervalMs?: number;
  /** Stops waiting, and cancels the remote task, after this long. */
  maxWaitMs?: number;
  /**
   * How long polling keeps retrying while the server can't be reached (restart, deploy, proxy 5xx).
   * The wait also ends earlier at `maxWaitMs` or the task's TTL. Default 5 minutes.
   */
  maxOutageMs?: number;
  /** Called with the created task, then whenever a poll reports a different status. */
  onStatus?: (task: MCPTask) => void;
  /** For tests. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
}

/** Why a task wait stopped without a terminal task. */
export class TaskWaitError extends Error {
  constructor(
    readonly reason: 'timeout' | 'input_unhandled' | 'input_unsupported' | 'expired' | 'unreachable',
    message: string,
    readonly task: MCPTask,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'TaskWaitError';
  }
}

const DEFAULT_MAX_OUTAGE_MS = 5 * 60_000;
const MAX_OUTAGE_BACKOFF_MS = 30_000;
/** The shortest wait between polls, whatever interval the server suggests, so a server can't make the client spin. */
export const MIN_TASK_POLL_INTERVAL_MS = 100;
/** Polls at least this often, whatever the server suggests. */
export const MAX_TASK_POLL_INTERVAL_MS = 3_600_000;

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Polls a remote task until it reaches a terminal status, answering its input requests on the way.
 *
 * Aborting the signal or exceeding `maxWaitMs` sends `tasks/cancel` (fire-and-forget) and rejects.
 * Each input request key is answered at most once, however many polls list it.
 */
export async function waitForTask(
  port: TaskWaitPort,
  created: MCPTask,
  options: TaskWaitOptions = {},
): Promise<MCPTerminalTask> {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const maxOutageMs = options.maxOutageMs ?? DEFAULT_MAX_OUTAGE_MS;
  const deadline = options.maxWaitMs === undefined ? undefined : now() + options.maxWaitMs;
  const answered = new Set<string>();
  let task: MCPDetailedTask | MCPTask = created;
  // The TTL counts from createdAt. Servers may send ISO 8601 forms Date.parse can't read; count from
  // when this wait started instead, so the TTL backstop still ends the wait.
  const startedAt = now();
  const ttlEndOf = (current: MCPTask): number => {
    if (current.ttlMs === null) return Infinity;
    const createdAt = Date.parse(current.createdAt);
    return (Number.isNaN(createdAt) ? startedAt : createdAt) + current.ttlMs;
  };
  let cancelSent = false;
  const cancel = () => {
    if (cancelSent) return;
    cancelSent = true;
    void port.cancel(created.taskId).catch(() => {});
  };
  const timedOut = () =>
    new TaskWaitError('timeout', `Gave up on MCP task ${task.taskId} after ${options.maxWaitMs}ms`, task);

  // Fires on caller abort or at maxWaitMs. Every operation gets this signal and is raced against it,
  // so a request or input handler that ignores its signal can't keep the call open past either.
  const stop = new AbortController();
  const stopped = new Promise<never>((_, reject) => {
    stop.signal.addEventListener('abort', () => reject(stop.signal.reason), { once: true });
  });
  stopped.catch(() => {});
  const bounded = <T>(operation: Promise<T>): Promise<T> => Promise.race([operation, stopped]);
  const onAbort = () => {
    cancel();
    stop.abort(options.signal!.reason);
  };
  if (options.signal?.aborted) onAbort();
  else options.signal?.addEventListener('abort', onAbort, { once: true });
  const deadlineTimer =
    options.maxWaitMs === undefined
      ? undefined
      : setTimeout(() => {
          cancel();
          stop.abort(timedOut());
        }, options.maxWaitMs);
  deadlineTimer?.unref?.();

  try {
    let reported: MCPTask['status'] | undefined;
    for (;;) {
      if (task.status !== reported) {
        reported = task.status;
        options.onStatus?.(task);
      }
      stop.signal.throwIfAborted();
      if (isTerminalTaskStatus(task.status)) return task as MCPTerminalTask;

      if (task.status === 'input_required' && 'inputRequests' in task) {
        const { inputRequests } = task as Extract<MCPDetailedTask, { status: 'input_required' }>;
        const pending = Object.entries(inputRequests).filter(([key]) => !answered.has(key));
        if (pending.length > 0) {
          const responses = await bounded(answerInputRequests(pending, task, options.inputRequests, stop.signal));
          for (const key of Object.keys(responses)) answered.add(key);
          await bounded(port.update(task.taskId, responses, { signal: stop.signal }));
          // Updates are eventually consistent, so the next poll follows without waiting.
          task = await poll();
          continue;
        }
      }

      // The last poll lands on the TTL deadline, so a result that arrives right at it still counts.
      const ttlLeft = ttlEndOf(task) - now();
      if (ttlLeft <= 0) {
        throw new TaskWaitError('expired', `MCP task ${task.taskId} outlived its ${task.ttlMs}ms TTL`, task);
      }
      let interval = Math.min(pollIntervalOf(task), ttlLeft);
      if (deadline !== undefined) {
        const remaining = deadline - now();
        if (remaining <= 0) {
          cancel();
          throw timedOut();
        }
        interval = Math.min(interval, remaining);
      }
      await bounded(sleep(interval, stop.signal));
      task = await poll();
    }

    function pollIntervalOf(current: MCPTask): number {
      const suggested = current.pollIntervalMs ?? options.pollIntervalMs ?? DEFAULT_TASK_POLL_INTERVAL_MS;
      return Number.isFinite(suggested)
        ? Math.min(MAX_TASK_POLL_INTERVAL_MS, Math.max(MIN_TASK_POLL_INTERVAL_MS, suggested))
        : DEFAULT_TASK_POLL_INTERVAL_MS;
    }

    // A recoverable failure starts an outage: reconnect, back off, and poll again until the server
    // answers or the task could no longer be alive (maxWaitMs, TTL, or maxOutageMs).
    async function poll(): Promise<MCPDetailedTask> {
      let outageStartedAt: number | undefined;
      let backoff: number | undefined;
      for (;;) {
        try {
          return await bounded(port.get(created.taskId, { signal: stop.signal }));
        } catch (error) {
          stop.signal.throwIfAborted();
          if (!port.isRecoverable(error)) throw error;
          const at = now();
          outageStartedAt ??= at;
          if (deadline !== undefined && at >= deadline) {
            cancel();
            throw timedOut();
          }
          const giveUpAt = Math.min(outageStartedAt + maxOutageMs, ttlEndOf(task));
          if (at >= giveUpAt) {
            const seconds = Math.round((at - outageStartedAt) / 1000);
            throw new TaskWaitError(
              'unreachable',
              `Couldn't reach the MCP server for ${seconds}s while waiting for task ${task.taskId}; the task may still finish on the server`,
              task,
              error,
            );
          }
          try {
            await bounded(port.recover(error));
          } catch (recoverError) {
            stop.signal.throwIfAborted();
            // Reconnecting fails the same way while the server is down; anything else ends the wait.
            if (!port.isRecoverable(recoverError)) throw recoverError;
          }
          backoff = Math.min(MAX_OUTAGE_BACKOFF_MS, backoff === undefined ? pollIntervalOf(task) : backoff * 2);
          await bounded(sleep(Math.max(0, Math.min(backoff, giveUpAt - at, (deadline ?? Infinity) - at)), stop.signal));
        }
      }
    }
  } finally {
    clearTimeout(deadlineTimer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

async function answerInputRequests(
  pending: [string, MCPTaskInputRequest][],
  task: MCPTask,
  handler: MCPInputRequestHandler | undefined,
  signal: AbortSignal,
): Promise<MCPTaskInputResponses> {
  if (!handler) {
    throw new TaskWaitError(
      'input_unhandled',
      `MCP task ${task.taskId} needs input, but no inputRequests handler is configured`,
      task,
    );
  }
  const responses: MCPTaskInputResponses = {};
  for (const [key, request] of pending) {
    if (request.method !== 'elicitation/create') {
      throw new TaskWaitError(
        'input_unsupported',
        `MCP task ${task.taskId} sent an unsupported input request '${request.method}'`,
        task,
      );
    }
    responses[key] = await handler({ key, params: request.params as ElicitRequestParams, signal });
  }
  return responses;
}
