import type { MastraDBMessage } from '../../../agent/message-list/state/types';
import { isTransientSignalMessage } from '../../../agent/signals';
import { MastraError } from '../../../error';

/**
 * Prefix of the thread id under which a store keeps a thread's pending agent signals.
 *
 * A pending signal is a row of the messages table whose `thread_id` is
 * `pendingSignalThreadId(threadId)` and whose `resourceId` is null. Such a row is not part of
 * any thread: reads by thread or by resource never match it, and every read by message id must
 * exclude it. A claim moves the row to its real thread id, where it becomes a message, unless
 * the signal is transient. The id is persisted, so the prefix cannot change without a migration.
 * @experimental
 */
export const PENDING_SIGNAL_THREAD_PREFIX = 'mastra-pending-signals:';

/**
 * Values of a message row's signal state column. Null on every other row.
 * - `transient`: set when a transient signal is enqueued. A claim leaves the row under the
 *   pending-signal id, so the signal is never a message of the thread.
 * - `taken`: set by the claim that moved the row into its thread. The next save of the row
 *   clears it, so a close can tell a row no save wrote from a saved message.
 * @experimental
 */
export const PENDING_SIGNAL_STATE = { transient: 'transient', taken: 'taken' } as const;

/**
 * The signal state a store writes when it enqueues `message`.
 * @experimental
 */
export function pendingSignalStateAtEnqueue(message: MastraDBMessage): typeof PENDING_SIGNAL_STATE.transient | null {
  return isTransientSignalMessage(message) ? PENDING_SIGNAL_STATE.transient : null;
}

/**
 * The thread id that holds the pending signals of `threadId`.
 * @experimental
 */
export function pendingSignalThreadId(threadId: string): string {
  return PENDING_SIGNAL_THREAD_PREFIX + threadId;
}

/**
 * Whether `threadId` is a pending-signal thread id. SQL stores test the same prefix by exact
 * comparison of its first characters, never with `LIKE`: SQLite's `LIKE` ignores ASCII case, and a
 * pattern built from a caller's thread id would treat its `_` and `%` as wildcards.
 * @experimental
 */
export function isPendingSignalThreadId(threadId: string | null | undefined): boolean {
  return typeof threadId === 'string' && threadId.startsWith(PENDING_SIGNAL_THREAD_PREFIX);
}

/**
 * The real thread id of a row: the thread a pending signal was sent to, or `threadId` itself
 * for any other row.
 * @experimental
 */
export function threadIdOfPendingSignalRow(threadId: string): string {
  return isPendingSignalThreadId(threadId) ? threadId.slice(PENDING_SIGNAL_THREAD_PREFIX.length) : threadId;
}

/**
 * Rejects a caller-chosen thread id that starts with the pending-signal prefix, so no thread and
 * no message can be stored or read under it.
 * @experimental
 */
export function assertNotPendingSignalThreadId(threadId: string | null | undefined, operation: string): void {
  if (!isPendingSignalThreadId(threadId)) return;
  throw new MastraError({
    id: 'STORAGE_RESERVED_THREAD_ID',
    domain: 'STORAGE',
    category: 'USER',
    text: `${operation}: thread ids starting with "${PENDING_SIGNAL_THREAD_PREFIX}" are reserved for pending agent signals`,
    details: { threadId: threadId!, operation },
  });
}
