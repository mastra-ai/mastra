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
  let cancelSent = false;
  const cancel = () => {
    if (cancelSent) return;
    cancelSent = true;
    void port.cancel(created.taskId).catch(() => {});
  };
  const onAbort = () => cancel();
  options.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    let task: MCPDetailedTask | MCPTask = created;
    let reported: MCPTask['status'] | undefined;
    for (;;) {
      if (task.status !== reported) {
        reported = task.status;
        options.onStatus?.(task);
      }
      options.signal?.throwIfAborted();
      if (isTerminalTaskStatus(task.status)) return task as MCPTerminalTask;

      if (task.status === 'input_required' && 'inputRequests' in task) {
        const { inputRequests } = task as Extract<MCPDetailedTask, { status: 'input_required' }>;
        const pending = Object.entries(inputRequests).filter(([key]) => !answered.has(key));
        if (pending.length > 0) {
          const responses = await answerInputRequests(pending, task, options);
          for (const key of Object.keys(responses)) answered.add(key);
          await port.update(task.taskId, responses, { signal: options.signal });
          // Updates are eventually consistent, so the next poll follows without waiting.
          task = await poll();
          continue;
        }
      }

      const expiresAt = task.ttlMs === null ? undefined : Date.parse(task.createdAt) + task.ttlMs;
      if (expiresAt !== undefined && now() > expiresAt) {
        throw new TaskWaitError('expired', `MCP task ${task.taskId} outlived its ${task.ttlMs}ms TTL`, task);
      }
      let interval = task.pollIntervalMs ?? options.pollIntervalMs ?? DEFAULT_TASK_POLL_INTERVAL_MS;
      if (deadline !== undefined) {
        const remaining = deadline - now();
        if (remaining <= 0) {
          cancel();
          throw new TaskWaitError('timeout', `Gave up on MCP task ${task.taskId} after ${options.maxWaitMs}ms`, task);
        }
        interval = Math.min(interval, remaining);
      }
      await sleep(interval, options.signal);
      task = await poll();
    }

    // A recoverable failure starts an outage: reconnect, back off, and poll again until the server
    // answers or the task could no longer be alive (maxWaitMs, TTL, or maxOutageMs).
    async function poll(): Promise<MCPDetailedTask> {
      let outageStartedAt: number | undefined;
      let backoff: number | undefined;
      for (;;) {
        try {
          return await port.get(created.taskId, { signal: options.signal });
        } catch (error) {
          options.signal?.throwIfAborted();
          if (!port.isRecoverable(error)) throw error;
          const at = now();
          outageStartedAt ??= at;
          if (deadline !== undefined && at >= deadline) {
            cancel();
            throw new TaskWaitError('timeout', `Gave up on MCP task ${task.taskId} after ${options.maxWaitMs}ms`, task);
          }
          const ttlEnd = task.ttlMs === null ? Infinity : Date.parse(task.createdAt) + task.ttlMs;
          const giveUpAt = Math.min(outageStartedAt + maxOutageMs, ttlEnd);
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
            await port.recover(error);
          } catch (recoverError) {
            // Reconnecting fails the same way while the server is down; anything else ends the wait.
            if (!port.isRecoverable(recoverError)) throw recoverError;
          }
          const interval = task.pollIntervalMs ?? options.pollIntervalMs ?? DEFAULT_TASK_POLL_INTERVAL_MS;
          backoff = Math.min(MAX_OUTAGE_BACKOFF_MS, backoff === undefined ? interval : backoff * 2);
          await sleep(Math.max(0, Math.min(backoff, giveUpAt - at, (deadline ?? Infinity) - at)), options.signal);
        }
      }
    }
  } finally {
    options.signal?.removeEventListener('abort', onAbort);
  }
}

async function answerInputRequests(
  pending: [string, MCPTaskInputRequest][],
  task: MCPTask,
  options: TaskWaitOptions,
): Promise<MCPTaskInputResponses> {
  const handler = options.inputRequests;
  if (!handler) {
    throw new TaskWaitError(
      'input_unhandled',
      `MCP task ${task.taskId} needs input, but no inputRequests handler is configured`,
      task,
    );
  }
  const signal = options.signal ?? new AbortController().signal;
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
