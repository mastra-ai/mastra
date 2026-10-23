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
   * next poll may be sent; rejects to give up.
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
  /** Consecutive transport failures tolerated while polling. */
  maxRecoveries?: number;
  /** For tests. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
}

/** Why a task wait stopped without a terminal task. */
export class TaskWaitError extends Error {
  constructor(
    readonly reason: 'timeout' | 'input_unhandled' | 'input_unsupported' | 'expired',
    message: string,
    readonly task: MCPTask,
  ) {
    super(message);
    this.name = 'TaskWaitError';
  }
}

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
  const maxRecoveries = options.maxRecoveries ?? 3;
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
    let failures = 0;
    for (;;) {
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

    async function poll(): Promise<MCPDetailedTask> {
      for (;;) {
        try {
          const next = await port.get(created.taskId, { signal: options.signal });
          failures = 0;
          return next;
        } catch (error) {
          options.signal?.throwIfAborted();
          if (!port.isRecoverable(error) || failures >= maxRecoveries) throw error;
          failures++;
          await port.recover(error);
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
