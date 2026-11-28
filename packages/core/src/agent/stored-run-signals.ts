import type { CreatedAgentSignal } from './signals';

/** A sender waiting for a reserved run to decide where the signal it queued for that run goes. */
type PreRunSignalWaiter = { resolve: () => void; reject: (error: unknown) => void; settled: Promise<void> };

/**
 * What a thread runtime keeps in memory about signals kept in storage: runs
 * known to store them, senders waiting on a reserved run, the last such run
 * that ended on each thread, and the per-thread chains of writes and
 * end-of-run checks. `T` is the runtime's record of an ended run.
 */
export function createStoredRunSignals<T>(maxEndedRuns = 1000) {
  /** Remote runs whose registration said they keep their signals in storage, so a sender here may store for them. */
  const remoteStoredRunIds = new Set<string>();
  /**
   * Per reserved run id, by signal id, senders whose answer waits for the
   * signal they queued for that run to reach its store, until the run
   * registers or ends.
   */
  const preRunSignalWaiters = new Map<string, Map<string, PreRunSignalWaiter>>();
  /** Per thread key, the last storage-backed run of this process that ended there, with the lease owner it held. */
  const endedRuns = new Map<string, { run: T; leaseOwner: string }>();
  /**
   * Per thread key, the last of this process's writes to stored signals
   * (inserts, cancels). Each write starts after the previous one settled, so
   * writes for a thread commit in call order.
   */
  const writes = new Map<string, Promise<void>>();
  /** Per thread key, the `createdAt` of the last pending row this process inserted, so rows order as sent. */
  const rowTimes = new Map<string, number>();
  /** Per thread key, the last end-of-run check of a storage-backed run, so checks of one thread never overlap. */
  const endOfRunChecks = new Map<string, Promise<void>>();
  /**
   * Per thread key, stored signals an end-of-run check already started a
   * follow-up with. One still unclaimed afterwards waits for the thread's next
   * run instead of starting another follow-up.
   */
  const followUpInputs = new Map<string, Set<string>>();

  const settlePreRunWaiters = (runId: string): void => {
    const waiters = preRunSignalWaiters.get(runId);
    if (!waiters) return;
    preRunSignalWaiters.delete(runId);
    for (const waiter of waiters.values()) waiter.resolve();
  };

  return {
    /** Records whether a remote run's latest registration said it keeps its signals in storage. */
    noteRemoteRun(runId: string, signalsStored: boolean): void {
      if (signalsStored) remoteStoredRunIds.add(runId);
      else remoteStoredRunIds.delete(runId);
    },

    /** Whether the remote run announced that it keeps its signals in storage. */
    isRemoteRunStored(runId: string): boolean {
      return remoteStoredRunIds.has(runId);
    },

    /** Forgets a remote run that no longer holds its thread. */
    forgetRemoteRun(runId: string): void {
      remoteStoredRunIds.delete(runId);
    },

    /**
     * A promise for a sender that queued `signalId` for the reserved run
     * `runId`, settled through the run's waiters. Rejections are handled, since
     * a sender whose reservation lost never reads it. A sender repeating an id
     * that already waits shares its promise: storage keeps one row per id, so
     * the first copy's insert answers both.
     */
    preRunInsertWaiter(runId: string, signalId: string): Promise<void> {
      const waiters = preRunSignalWaiters.get(runId) ?? new Map<string, PreRunSignalWaiter>();
      preRunSignalWaiters.set(runId, waiters);
      const waiting = waiters.get(signalId);
      if (waiting) return waiting.settled;
      let resolve!: () => void;
      let reject!: (error: unknown) => void;
      const settled = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      void settled.catch(() => {});
      waiters.set(signalId, { resolve, reject, settled });
      return settled;
    },

    /**
     * Removes the run's waiters, for a move of its queued signals into its
     * store: `take` hands out the waiter of one signal, `resolveRest` releases
     * the ones whose signal was not taken.
     */
    takePreRunWaiters(runId: string) {
      const waiters = preRunSignalWaiters.get(runId);
      preRunSignalWaiters.delete(runId);
      return {
        take(signalId: string): PreRunSignalWaiter | undefined {
          const waiter = waiters?.get(signalId);
          waiters?.delete(signalId);
          return waiter;
        },
        resolveRest(): void {
          for (const waiter of waiters?.values() ?? []) waiter.resolve();
        },
      };
    },

    /** Releases the senders still waiting on `runId`'s decision: the run registered or ended. */
    settlePreRunWaiters,

    /**
     * Remembers `run` as the thread's last storage-backed run that ended here,
     * with the owner it held the lease under, as the newest entry. A follow-up
     * taking the lease or a run registering on the thread drops its entry; the
     * oldest entry is evicted past `maxEndedRuns` to bound the threads that saw
     * neither.
     */
    rememberEndedRun(key: string, run: T, leaseOwner: string): void {
      endedRuns.delete(key);
      endedRuns.set(key, { run, leaseOwner });
      if (endedRuns.size > maxEndedRuns) {
        endedRuns.delete(endedRuns.keys().next().value!);
      }
    },

    /** The thread's last storage-backed run that ended here, with its lease owner. */
    endedRun(key: string): { run: T; leaseOwner: string } | undefined {
      return endedRuns.get(key);
    },

    /** Forgets the thread's ended run: the thread has a run again. */
    forgetEndedRun(key: string): void {
      endedRuns.delete(key);
    },

    /** Forgets the thread's ended run if it is still `entry`, as read by `endedRun`. */
    forgetEndedRunIfCurrent(key: string, entry: { run: T; leaseOwner: string } | undefined): void {
      if (endedRuns.get(key) === entry) endedRuns.delete(key);
    },

    /** Runs a write to the thread's stored signals after this process's earlier ones settled. */
    runWrite<R>(key: string, write: () => Promise<R>): Promise<R> {
      const result = (writes.get(key) ?? Promise.resolve()).then(write);
      const tail = result.then(
        () => {},
        () => {},
      );
      writes.set(key, tail);
      void tail.then(() => {
        if (writes.get(key) !== tail) return;
        writes.delete(key);
        // Dropped once its time has passed: a row stamped with the current time still sorts after every row this process
        // inserted, while one sent with an earlier `createdAt` keeps that time and can sort before them.
        if ((rowTimes.get(key) ?? 0) < Date.now()) rowTimes.delete(key);
      });
      return result;
    },

    /** Settles once the thread's writes started so far settled; `undefined` when none is in flight. */
    writesSettled(key: string): Promise<void> | undefined {
      return writes.get(key);
    },

    /**
     * Stamps a new pending row of the thread after the last row this process
     * inserted there, since claims order rows by `createdAt`. Returns what
     * records the row's `createdAt` once the store accepted it.
     */
    stampNewRow(key: string, row: { createdAt: Date }): () => void {
      const previous = rowTimes.get(key);
      if (previous !== undefined && row.createdAt.getTime() <= previous) row.createdAt = new Date(previous + 1);
      return () => {
        rowTimes.set(key, Math.max(previous ?? 0, row.createdAt.getTime()));
      };
    },

    /**
     * Runs an end-of-run check of the thread after its earlier ones in this
     * process. A rejection goes to `onError`; the returned promise rejects only when `onError` throws.
     */
    runEndOfRunCheck(key: string, check: () => Promise<void>, onError: (error: unknown) => void): Promise<void> {
      const result = (endOfRunChecks.get(key) ?? Promise.resolve()).then(check);
      const tail = result.catch(onError);
      // The thread's next check waits on a link that always fulfills, so a throwing `onError` stops no later check.
      const link = tail.catch(() => {});
      endOfRunChecks.set(key, link);
      void link.then(() => {
        if (endOfRunChecks.get(key) === link) endOfRunChecks.delete(key);
      });
      return tail;
    },

    /**
     * The first of `leftovers` no follow-up started with yet, marked as used.
     * Ids no longer among the thread's pending `rows` are forgotten first. A
     * row a follow-up started with and left unclaimed waits for the thread's
     * next run.
     */
    takeFollowUpInput(
      key: string,
      leftovers: CreatedAgentSignal[],
      rows: ReadonlyArray<{ id: string }>,
    ): CreatedAgentSignal | undefined {
      const used = followUpInputs.get(key) ?? new Set<string>();
      for (const id of used) if (!rows.some(row => row.id === id)) used.delete(id);

      const signal = leftovers.find(leftover => !used.has(leftover.id));
      if (signal) used.add(signal.id);
      if (used.size) followUpInputs.set(key, used);
      else followUpInputs.delete(key);
      return signal;
    },

    /** Gives back an input whose follow-up never started, so a later check may start one with it. */
    returnFollowUpInput(key: string, signalId: string): void {
      followUpInputs.get(key)?.delete(signalId);
    },

    /** Settles every waiter, then forgets everything. */
    clear(): void {
      remoteStoredRunIds.clear();
      for (const runId of [...preRunSignalWaiters.keys()]) settlePreRunWaiters(runId);
      endedRuns.clear();
      writes.clear();
      rowTimes.clear();
      endOfRunChecks.clear();
      followUpInputs.clear();
    },
  };
}

export type StoredRunSignals<T> = ReturnType<typeof createStoredRunSignals<T>>;
