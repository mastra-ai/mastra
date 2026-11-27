import { describe, expect, it } from 'vitest';
import {
  assertNotPendingSignalThreadId,
  isPendingSignalThreadId,
  pendingSignalThreadId,
  threadIdOfPendingSignalRow,
} from './pending-signal-thread';

describe('pending-signal thread ids', () => {
  it('maps a thread id to its pending-signal id and back', () => {
    for (const threadId of ['thread-1', '', 'mastra-pending-signals', 'a:b', '%_']) {
      const pending = pendingSignalThreadId(threadId);
      expect(pending).toBe(`mastra-pending-signals:${threadId}`);
      expect(isPendingSignalThreadId(pending)).toBe(true);
      expect(threadIdOfPendingSignalRow(pending)).toBe(threadId);
    }
  });

  // Ids that differ from the prefix by case or by one character are ordinary thread ids.
  it('matches only the exact prefix', () => {
    for (const threadId of [
      'thread-1',
      'mastra-pending-signals',
      'MASTRA-PENDING-SIGNALS:thread-1',
      'mastra_pending_signals:thread-1',
      'mastra-pending-signal:thread-1',
      ' mastra-pending-signals:thread-1',
      'x-mastra-pending-signals:thread-1',
    ]) {
      expect(isPendingSignalThreadId(threadId)).toBe(false);
      expect(threadIdOfPendingSignalRow(threadId)).toBe(threadId);
      expect(() => assertNotPendingSignalThreadId(threadId, 'saveThread')).not.toThrow();
    }
    expect(isPendingSignalThreadId(undefined)).toBe(false);
    expect(isPendingSignalThreadId(null)).toBe(false);
  });

  it('rejects a reserved thread id with a user error naming the operation', () => {
    expect(() => assertNotPendingSignalThreadId(pendingSignalThreadId('thread-1'), 'saveThread')).toThrow(
      expect.objectContaining({
        id: 'STORAGE_RESERVED_THREAD_ID',
        category: 'USER',
        message: expect.stringContaining('saveThread'),
      }),
    );
  });
});
