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

  // Moves the thread's `from` queue in front of its `to` queue, as a new array.
  // A missing or empty `from` queue moves nothing and is left as it is.
  const moveInFront = (
    from: Map<string, CreatedAgentSignal[]>,
    to: Map<string, CreatedAgentSignal[]>,
    key: string,
  ): CreatedAgentSignal[] => {
    const moved = from.get(key) ?? [];
    if (moved.length > 0) {
      from.delete(key);
      to.set(key, [...moved, ...(to.get(key) ?? [])]);
    }
    return moved;
  };

  return {
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

    /** Whether either of the thread's queues is non-empty. */
    hasSignals(key: string): boolean {
      return (pendingSignalsByThread.get(key)?.length ?? 0) > 0 || (preRunSignalsByThread.get(key)?.length ?? 0) > 0;
    },

    /** Removes and returns the thread's whole queue for `scope`. */
    take(scope: ActiveRunSignalScope, key: string): CreatedAgentSignal[] {
      const queues = queuesFor(scope);
      const queue = queues.get(key);
      if (!queue || queue.length === 0) {
        return [];
      }

      queues.delete(key);
      return queue;
    },

    /** The thread's queued signals, pre-run first, iterated without copying the queues. */
    *queued(key: string): Generator<CreatedAgentSignal> {
      for (const queue of [preRunSignalsByThread.get(key), pendingSignalsByThread.get(key)]) {
        yield* queue ?? [];
      }
    },

    /** Passes each queued signal to `forward`, pre-run first, then drops the thread's queues. */
    handOff(key: string, forward: (signal: CreatedAgentSignal, preRun: boolean) => void): void {
      for (const preRun of [true, false]) {
        const queues = preRun ? preRunSignalsByThread : pendingSignalsByThread;
        for (const signal of queues.get(key) ?? []) forward(signal, preRun);
        queues.delete(key);
      }
    },

    /** Puts pre-run signals a finished run never took in front of the thread's follow-ups. */
    foldPreRunIntoPending(key: string): void {
      moveInFront(preRunSignalsByThread, pendingSignalsByThread, key);
    },

    /** Removes the oldest follow-up, dropping the queue once it is empty. */
    takeNextPending(key: string): CreatedAgentSignal | undefined {
      const queue = pendingSignalsByThread.get(key);
      const signal = queue?.shift();
      if (signal && queue && queue.length === 0) {
        pendingSignalsByThread.delete(key);
      }
      return signal;
    },

    /** Puts a follow-up back at the front of the thread's queue. */
    returnToFront(key: string, signal: CreatedAgentSignal): void {
      const restored = pendingSignalsByThread.get(key) ?? [];
      pendingSignalsByThread.set(key, [signal, ...restored]);
    },

    /**
     * Moves the remaining follow-ups in front of the thread's pre-run signals,
     * for a follow-up run's first model request, and returns them.
     */
    batchPendingIntoPreRun(key: string): CreatedAgentSignal[] {
      return moveInFront(pendingSignalsByThread, preRunSignalsByThread, key);
    },

    /**
     * Requeues after a follow-up run failed to start: `signal`, then whatever
     * was batched into its pre-run queue, then the follow-ups queued since.
     */
    restoreAfterFailedStart(key: string, signal: CreatedAgentSignal | undefined): void {
      const batchedLeftover = preRunSignalsByThread.get(key) ?? [];
      preRunSignalsByThread.delete(key);
      const restored = [...(signal ? [signal] : []), ...batchedLeftover, ...(pendingSignalsByThread.get(key) ?? [])];
      if (restored.length > 0) pendingSignalsByThread.set(key, restored);
    },

    /**
     * Removes matching signals from both of the thread's queues and returns
     * their ids, pre-run first. Each queue is replaced by a new array, or
     * dropped when nothing is left.
     */
    cancel(key: string, matches: (signal: CreatedAgentSignal) => boolean): string[] {
      const cancelled: string[] = [];
      for (const queues of [preRunSignalsByThread, pendingSignalsByThread]) {
        const queue = queues.get(key);
        if (!queue) continue;
        const remaining = queue.filter(signal => {
          if (!matches(signal)) return true;
          cancelled.push(signal.id);
          return false;
        });
        if (remaining.length) queues.set(key, remaining);
        else queues.delete(key);
      }
      return cancelled;
    },

    /** Removes one pre-run signal in place, dropping the queue once it is empty. */
    discardPreRunSignal(key: string, signalId: string): void {
      const queue = preRunSignalsByThread.get(key);
      if (!queue) return;
      const index = queue.findIndex(signal => signal.id === signalId);
      if (index === -1) return;
      queue.splice(index, 1);
      if (queue.length === 0) preRunSignalsByThread.delete(key);
    },

    /** Drops the thread's pre-run queue. */
    discardPreRunQueue(key: string): void {
      preRunSignalsByThread.delete(key);
    },

    clear(): void {
      pendingSignalsByThread.clear();
      preRunSignalsByThread.clear();
    },
  };
}

export type ActiveRunSignalQueues = ReturnType<typeof createActiveRunSignalQueues>;
