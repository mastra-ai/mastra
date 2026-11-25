import type { CreatedAgentSignal } from './signals';

type ActiveRunSignalScope = 'pending' | 'pre-run';

/**
 * Signals waiting for a thread's active run, keyed by thread key.
 */
export function createActiveRunSignalQueues() {
  const pendingSignalsByThread = new Map<string, CreatedAgentSignal[]>();
  // Signals queued for a run that is starting but has not made its first model
  // request yet. The first LLM step drains these and folds them into that
  // request; `pendingSignalsByThread` follow-ups instead become their own turn.
  const preRunSignalsByThread = new Map<string, CreatedAgentSignal[]>();

  const queuesFor = (scope: ActiveRunSignalScope) =>
    scope === 'pre-run' ? preRunSignalsByThread : pendingSignalsByThread;

  return {
    pendingSignalsByThread,
    preRunSignalsByThread,

    /** Appends to the thread's queue for `scope`. */
    enqueue(scope: ActiveRunSignalScope, key: string, signal: CreatedAgentSignal): void {
      const queues = queuesFor(scope);
      const queue = queues.get(key) ?? [];
      queue.push(signal);
      queues.set(key, queue);
    },

    /** Whether either of the thread's queues holds a signal with this id. */
    includes(key: string, signalId: string): boolean {
      return [preRunSignalsByThread.get(key), pendingSignalsByThread.get(key)].some(queue =>
        queue?.some(signal => signal.id === signalId),
      );
    },
  };
}

export type ActiveRunSignalQueues = ReturnType<typeof createActiveRunSignalQueues>;
