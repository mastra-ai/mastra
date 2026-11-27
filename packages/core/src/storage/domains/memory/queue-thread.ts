import { MastraError } from '../../../error';

/**
 * Prefix of the reserved thread ids under which a store keeps a thread's queued messages. A row
 * under one of them has no `resourceId` and is not part of any thread. The ids are persisted, so
 * the prefix cannot change without a migration.
 * @experimental
 */
export const QUEUE_THREAD_PREFIX = 'mastra-queue:';

const PENDING_QUEUE_THREAD_PREFIX = `${QUEUE_THREAD_PREFIX}pending:`;
const TAKEN_QUEUE_THREAD_PREFIX = `${QUEUE_THREAD_PREFIX}taken:`;

/**
 * The thread id that holds the signals sent to `threadId` and not yet taken by a run.
 * @experimental
 */
export function pendingQueueThreadId(threadId: string): string {
  return PENDING_QUEUE_THREAD_PREFIX + threadId;
}

/**
 * The thread id that holds the signals a run of `threadId` took and has not yet saved or closed.
 * @experimental
 */
export function takenQueueThreadId(threadId: string): string {
  return TAKEN_QUEUE_THREAD_PREFIX + threadId;
}

/**
 * Whether `threadId` is one of the reserved queue thread ids.
 * @experimental
 */
export function isQueueThreadId(threadId: string | null | undefined): boolean {
  return typeof threadId === 'string' && threadId.startsWith(QUEUE_THREAD_PREFIX);
}

/**
 * Rejects a caller-chosen thread id that starts with `QUEUE_THREAD_PREFIX`, so no thread and no
 * message can be stored or read under it.
 * @experimental
 */
export function assertNotQueueThreadId(threadId: string | null | undefined, operation: string): void {
  if (!isQueueThreadId(threadId)) return;
  throw new MastraError({
    id: 'STORAGE_RESERVED_THREAD_ID',
    domain: 'STORAGE',
    category: 'USER',
    text: `${operation}: thread ids starting with "${QUEUE_THREAD_PREFIX}" are reserved`,
    details: { threadId: threadId!, operation },
  });
}
