import { describe, expect, it } from 'vitest';
import { assertNotQueueThreadId, isQueueThreadId, pendingQueueThreadId, takenQueueThreadId } from './queue-thread';

describe('queue thread ids', () => {
  it('builds a pending and a taken id for a thread, both reserved and distinct', () => {
    for (const threadId of ['thread-1', '', 'mastra-queue', 'a:b', '%_']) {
      const pending = pendingQueueThreadId(threadId);
      const taken = takenQueueThreadId(threadId);
      expect(pending).toBe(`mastra-queue:pending:${threadId}`);
      expect(taken).toBe(`mastra-queue:taken:${threadId}`);
      expect(isQueueThreadId(pending)).toBe(true);
      expect(isQueueThreadId(taken)).toBe(true);
    }
    expect(isQueueThreadId('mastra-queue:')).toBe(true);
  });

  // Ids that differ from the prefix by case or by one character are ordinary thread ids.
  it('matches only the exact prefix', () => {
    for (const threadId of [
      'thread-1',
      'mastra-queue',
      'MASTRA-QUEUE:thread-1',
      'mastra_queue:thread-1',
      'mastra-queue-thread-1',
      ' mastra-queue:thread-1',
      'x-mastra-queue:pending:thread-1',
    ]) {
      expect(isQueueThreadId(threadId)).toBe(false);
      expect(() => assertNotQueueThreadId(threadId, 'saveThread')).not.toThrow();
    }
    expect(isQueueThreadId(undefined)).toBe(false);
    expect(isQueueThreadId(null)).toBe(false);
  });

  it('rejects a reserved thread id with a user error naming the operation', () => {
    for (const threadId of [pendingQueueThreadId('thread-1'), takenQueueThreadId('thread-1')]) {
      expect(() => assertNotQueueThreadId(threadId, 'saveThread')).toThrow(
        expect.objectContaining({
          id: 'STORAGE_RESERVED_THREAD_ID',
          category: 'USER',
          message: 'saveThread: thread ids starting with "mastra-queue:" are reserved',
        }),
      );
    }
  });
});
