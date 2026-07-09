/**
 * Programmatic goal runner for MastraCode headless runs.
 *
 * `runGoal` starts a goal through the same GoalManager + system-reminder signal
 * path used by the TUI. It resolves only on terminal `goal_evaluation` events;
 * `agent_end` is surfaced to subscribers but is not treated as completion because
 * goal evaluations may arrive after the agent stream ends.
 */
import type { AgentControllerEvent } from '@mastra/core/agent-controller';

import { createGoalReminderSignal } from '../goal-signal.js';
import { GoalManager } from '../tui/goal-manager.js';

import type { MCGoalRun, RunGoalOptions, RunGoalResult, RunGoalStatus } from './types.js';

function exitCodeForStatus(status: RunGoalStatus): number {
  switch (status) {
    case 'done':
      return 0;
    case 'timeout':
      return 2;
    default:
      return 1;
  }
}

class EventQueue<T> {
  #buffer: T[] = [];
  #resolvers: Array<(r: IteratorResult<T>) => void> = [];
  #closed = false;
  readonly #maxBuffer: number;

  constructor(maxBuffer = 10_000) {
    this.#maxBuffer = maxBuffer;
  }

  push(value: T): void {
    if (this.#closed) return;
    const resolve = this.#resolvers.shift();
    if (resolve) {
      resolve({ value, done: false });
      return;
    }
    this.#buffer.push(value);
    if (this.#buffer.length > this.#maxBuffer) this.#buffer.shift();
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    for (const resolve of this.#resolvers.splice(0)) {
      resolve({ value: undefined as unknown as T, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        if (this.#buffer.length > 0) return Promise.resolve({ value: this.#buffer.shift()!, done: false });
        if (this.#closed) return Promise.resolve({ value: undefined as unknown as T, done: true });
        return new Promise<IteratorResult<T>>(resolve => this.#resolvers.push(resolve));
      },
    };
  }
}

function createError(error: unknown): RunGoalResult['error'] {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: 'Error', message: String(error) };
}

function terminalGoalPayload(event: AgentControllerEvent) {
  if (event.type !== 'goal_evaluation') return undefined;
  if (event.payload.pending) return undefined;
  const status = event.payload.status;
  return status === 'done' || status === 'paused' ? event.payload : undefined;
}

/** Start and observe a MastraCode goal in headless mode. */
export function runGoal<TState extends Record<string, unknown>>(options: RunGoalOptions<TState>): MCGoalRun {
  const { controller, session, objective } = options;
  const queue = new EventQueue<AgentControllerEvent>();
  const goalManager = options.goalManager ?? new GoalManager();

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  let aborted = false;
  let unsubscribe: (() => void) | undefined;
  let lastAgentEndReason: string | undefined;
  let resolveResult!: (result: RunGoalResult) => void;

  const result = new Promise<RunGoalResult>(resolve => {
    resolveResult = resolve;
  });

  function finish(status: RunGoalStatus, data: Partial<RunGoalResult> = {}): void {
    if (settled) return;
    settled = true;
    if (timeoutId) clearTimeout(timeoutId);
    unsubscribe?.();
    queue.close();
    resolveResult({
      status,
      objective,
      threadId: session.thread.getId() ?? undefined,
      agentEndReason: lastAgentEndReason,
      exitCode: exitCodeForStatus(status),
      ...data,
    });
  }

  function abort(): void {
    if (settled) return;
    aborted = true;
    session.abort();
    finish('aborted');
  }

  if (options.signal) {
    if (options.signal.aborted) {
      queueMicrotask(() => abort());
    } else {
      options.signal.addEventListener('abort', () => abort(), { once: true });
    }
  }

  void (async () => {
    if (options.timeoutMs) {
      timeoutId = setTimeout(() => {
        session.abort();
        finish('timeout');
      }, options.timeoutMs);
    }

    unsubscribe = session.subscribe(event => {
      if (settled) return;
      queue.push(event);

      if (event.type === 'agent_end') {
        lastAgentEndReason = event.reason;
        return;
      }

      if (event.type === 'error') {
        finish('error', { error: createError(event.error) });
        return;
      }

      const payload = terminalGoalPayload(event);
      if (payload) {
        const status = payload.status === 'done' ? 'done' : 'paused';
        finish(status, {
          goalEvent: event as Extract<AgentControllerEvent, { type: 'goal_evaluation' }>,
          reason: payload.reason ?? payload.results?.[0]?.reason,
          iterations: payload.iteration,
          maxRuns: payload.maxRuns,
        });
      }
    });

    try {
      if (options.resourceId) {
        await controller.setResourceId(session, { resourceId: options.resourceId });
      }

      if (!session.thread.getId()) {
        await session.thread.create();
      }

      const state = {
        controller,
        session,
        goalManager,
        pendingNewThread: false,
        planStartedGoalId: undefined,
      } as any;
      const goal = await goalManager.setGoal(state, objective, options.judgeModelId, options.maxRuns);
      if (!goal) throw new Error('Failed to set goal.');
      await goalManager.saveToThread(state);

      if (aborted || settled) return;
      await session.sendSignal(createGoalReminderSignal(goal)).accepted;
    } catch (error) {
      finish('error', { error: createError(error) });
    }
  })();

  return {
    result,
    abort,
    [Symbol.asyncIterator](): AsyncIterator<AgentControllerEvent> {
      return queue[Symbol.asyncIterator]();
    },
  };
}
