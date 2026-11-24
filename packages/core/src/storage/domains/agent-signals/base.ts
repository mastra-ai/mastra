import { StorageDomain } from '../base';

/**
 * Which queue of a run a signal waits in. `'pre-run'` signals are taken by the
 * run's first model request, `'pending'` signals at the run's drain points.
 */
export type AgentSignalScope = 'pre-run' | 'pending';

export type AgentSignalJSONValue =
  | null
  | string
  | number
  | boolean
  | AgentSignalJSONValue[]
  | { [key: string]: AgentSignalJSONValue };

/**
 * A signal in its JSON form. Created signals carry methods, `Date` fields and
 * binary file data, so callers convert them to this shape before storing them.
 */
export type StoredAgentSignalPayload = { [key: string]: AgentSignalJSONValue };

export interface StoredAgentSignal {
  /** The signal id. Unique across all threads. */
  id: string;
  threadKey: string;
  /** `null` for a thread leftover waiting for the thread's next run. */
  runId: string | null;
  scope: AgentSignalScope;
  /** The run that took this signal into a transcript attempt. */
  claimedBy: string | null;
  signal: StoredAgentSignalPayload;
  /** Set by the store's own clock when the row is inserted. Informational only: it does not define the order. */
  createdAt: Date;
}

export type AgentSignalWriteResult = 'accepted' | 'run-closed';

export type AgentSignalClaimArgs =
  | { threadKey: string; runId: string; scope: 'pending'; leftovers?: false }
  | { threadKey: string; runId: string; scope: 'pre-run'; leftovers?: boolean };

/**
 * Pending signals of agent runs, shared by every process that executes steps
 * of those runs.
 *
 * Besides the signal rows, the domain keeps one marker per `(threadKey, runId)`
 * that records whether the run is closed. `enqueue`, `claim` and the target of
 * `readdress` create the marker open when it does not exist, `closeRun` and the
 * source of `readdress` close it. A marker outlives its run so that a late send
 * is rejected with `'run-closed'`; markers are removed only by `deleteThread`.
 *
 * Rows are ordered by an insertion counter the store assigns, and by nothing
 * else. The order is guaranteed between rows that were visible to the same
 * read. Where the counter is assigned before commit, a later read can return a
 * row with a lower counter than rows returned earlier, so callers must not use
 * the counter or a row's position as a cursor.
 *
 * Calls that touch a run's marker (`enqueue`, `claim`, `readdress`, `closeRun`)
 * are serialized per run: implementations lock the markers involved, sorted by
 * run id when there are several. A row is therefore either seen by the run's
 * close or rejected with `'run-closed'`, and a close never interleaves with a
 * claim.
 *
 * Absence of this domain on a store is meaningful: callers fall back to
 * in-process queues when `getStore('agentSignals')` returns `undefined`, so the
 * composite store does not install a default implementation.
 */
export abstract class AgentSignalsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'AGENT_SIGNALS',
    });
  }

  /**
   * Whether every process of a deployment reads and writes the same rows. A
   * sender in a process other than the one executing the run may only insert
   * directly when this is `true`.
   */
  get sharedAcrossProcesses(): boolean {
    return true;
  }

  /**
   * Store a signal for a run, or as a thread leftover when `runId` is `null`.
   *
   * Checks run in this order:
   * 1. `runId` names a closed run of the thread: stores nothing and returns
   *    `'run-closed'`.
   * 2. A row with the same `id` exists: returns `'accepted'` and leaves that row
   *    as is, whatever run, thread or scope this call names.
   * 3. Otherwise inserts the row and returns `'accepted'`.
   *
   * Leftovers are always accepted. Idempotency holds only while the row
   * exists: once it is deleted (consumed, cancelled, or dropped when its run
   * closed or was readdressed), the same id can be stored again. Callers must
   * make sure a signal is inserted by exactly one process.
   */
  abstract enqueue(row: {
    id: string;
    threadKey: string;
    runId: string | null;
    scope: AgentSignalScope;
    signal: StoredAgentSignalPayload;
  }): Promise<AgentSignalWriteResult>;

  /**
   * Mark as claimed by `runId` every unclaimed row of the thread addressed to
   * `runId` with `scope`, and return all rows of `scope` the run has claimed.
   * Repeating the call returns the rows claimed earlier plus any newly claimed
   * ones.
   *
   * With `leftovers: true` (only for `'pre-run'`), the claiming run takes over
   * the thread before claiming. In one atomic step, for every other open run of
   * the thread, its unclaimed rows are readdressed to `runId` as `'pre-run'`, its
   * claimed rows are deleted, and it is closed. The thread's leftovers are
   * readdressed the same way. A thread has one active run at a time, so any
   * other open run either ended without closing or is a reservation that lost;
   * closing it makes late sends to it return `'run-closed'`. The takeover is
   * serialized with `enqueue`, `claim`, `readdress` and `closeRun` on those runs:
   * implementations lock their markers together with the claiming run's,
   * sorted by run id.
   *
   * Known limit of the takeover: a row another run claimed in a step whose
   * result was never saved, in a run that never closed, is deleted and not
   * delivered.
   *
   * A closed run claims nothing, with or without `leftovers`: the call returns
   * an empty list and changes nothing.
   */
  abstract claim(args: AgentSignalClaimArgs): Promise<StoredAgentSignal[]>;

  /** Delete rows by id. Missing ids are ignored. */
  abstract delete(args: { ids: string[] }): Promise<void>;

  /**
   * Close a run in one atomic step: delete its rows listed in `consumedIds`,
   * release its other rows as leftovers (`runId` and `claimedBy` set to `null`,
   * scope kept), and mark the run closed.
   *
   * Only rows addressed to `runId` on `threadKey` are touched: an id in
   * `consumedIds` that belongs to another run, another thread, or a leftover is
   * ignored. Valid for a run with no marker or rows yet. On a run that is
   * already closed, the listed rows still addressed to it are deleted and the
   * rest released, so repeating a close has the same effect.
   */
  abstract closeRun(args: { threadKey: string; runId: string; consumedIds: string[] }): Promise<void>;

  /**
   * Delete the given rows of the thread that are not claimed, and return their
   * ids in no particular order. Claimed rows, rows of other threads and missing
   * ids are skipped. A cancelled id can be stored again by `enqueue`.
   */
  abstract cancel(args: { threadKey: string; ids: string[] }): Promise<string[]>;

  /**
   * Hand the unclaimed rows of `fromRunId` to `toRunId` and close `fromRunId`.
   *
   * When `toRunId` is open, the rows move to it with their scope and order kept,
   * and the call returns `'accepted'`. When `toRunId` is closed, the rows are
   * deleted and the call returns `'run-closed'`; the caller reports those
   * signals as not delivered. Rows `fromRunId` has claimed stay addressed to it
   * until its `closeRun`. Implementations lock both markers, sorted by run id.
   *
   * When `fromRunId === toRunId`, nothing changes and nothing is closed: the
   * call returns `'run-closed'` if the run is closed and `'accepted'` otherwise.
   */
  abstract readdress(args: { threadKey: string; fromRunId: string; toRunId: string }): Promise<AgentSignalWriteResult>;

  /**
   * Unclaimed rows of the thread, in insertion order. A string `runId` returns
   * the rows addressed to that run, `null` returns the leftovers, and omitting
   * it returns every pending row of the thread.
   */
  abstract listPending(args: { threadKey: string; runId?: string | null }): Promise<StoredAgentSignal[]>;

  /**
   * Delete every row and run marker of the thread. A run still open when its
   * thread is deleted can recreate its marker with a later call; nothing
   * deletes that marker again.
   */
  abstract deleteThread(args: { threadKey: string }): Promise<void>;
}
