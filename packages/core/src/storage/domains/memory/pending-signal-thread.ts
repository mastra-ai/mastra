import { MastraError } from '../../../error';

/**
 * Prefix of the thread id under which a store keeps a thread's pending agent signals.
 *
 * A pending signal is a row of the messages table whose `thread_id` is
 * `pendingSignalThreadId(threadId)` and whose `resourceId` is null. Such a row is not part of
 * any thread: reads by thread or by resource never match it, and every read by message id must
 * exclude it. Only `saveMessages` of the row under its real thread id moves it to that thread,
 * where it becomes a message. The id is persisted, so the prefix cannot change without a
 * migration.
 * @experimental
 */
export const PENDING_SIGNAL_THREAD_PREFIX = 'mastra-pending-signals:';

/**
 * The thread id that holds the pending signals of `threadId`.
 * @experimental
 */
export function pendingSignalThreadId(threadId: string): string {
  return PENDING_SIGNAL_THREAD_PREFIX + threadId;
}

/**
 * Whether `threadId` is a pending-signal thread id. SQL stores test the same prefix by exact
 * comparison of its first characters, never with `LIKE`, whose wildcards and case folding would
 * match other ids.
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
