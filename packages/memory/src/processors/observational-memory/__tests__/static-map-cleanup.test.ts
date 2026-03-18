import { describe, it, expect, beforeEach } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

// Access private static members via `as any` — matches existing test conventions
const OM = ObservationalMemory as any;

/**
 * Regression tests for OM static map cleanup.
 * Ensures that cleanupStaticMaps uses the correct key for reflectionBufferCycleIds.
 */

function clearAllStaticState(): void {
  OM.asyncBufferingOps.clear();
  OM.lastBufferedBoundary.clear();
  OM.lastBufferedAtTime.clear();
  OM.reflectionBufferCycleIds.clear();
}

describe('OM static map cleanup', () => {
  beforeEach(() => {
    clearAllStaticState();
  });

  describe('cleanupStaticMaps key correctness', () => {
    it('full cleanup removes reflectionBufferCycleIds using the reflection key, not the observation key', () => {
      // Seed static maps with both obs and refl keys for thread-1
      const lockKey = 'thread:thread-1';
      const obsBufKey = `obs:${lockKey}`;
      const reflBufKey = `refl:${lockKey}`;

      OM.lastBufferedBoundary.set(obsBufKey, 1000);
      OM.lastBufferedBoundary.set(reflBufKey, 2000);
      OM.lastBufferedAtTime.set(obsBufKey, new Date());
      OM.asyncBufferingOps.set(obsBufKey, Promise.resolve());
      OM.asyncBufferingOps.set(reflBufKey, Promise.resolve());
      OM.reflectionBufferCycleIds.set(reflBufKey, 'cycle-abc');

      const fakeThis = {
        getLockKey: (_threadId: string, _resourceId?: string | null) => lockKey,
        getObservationBufferKey: (lk: string) => `obs:${lk}`,
        getReflectionBufferKey: (lk: string) => `refl:${lk}`,
        scope: 'thread',
      };

      // Call cleanupStaticMaps with full cleanup (no activatedMessageIds)
      ObservationalMemory.prototype['cleanupStaticMaps'].call(fakeThis, 'thread-1', null);

      // All entries should be removed
      expect(OM.lastBufferedAtTime.has(obsBufKey)).toBe(false);
      expect(OM.lastBufferedBoundary.has(obsBufKey)).toBe(false);
      expect(OM.lastBufferedBoundary.has(reflBufKey)).toBe(false);
      expect(OM.asyncBufferingOps.has(obsBufKey)).toBe(false);
      expect(OM.asyncBufferingOps.has(reflBufKey)).toBe(false);
      // KEY FIX: reflectionBufferCycleIds must be deleted with reflBufKey, not obsBufKey
      expect(OM.reflectionBufferCycleIds.has(reflBufKey)).toBe(false);
    });

    it('partial cleanup is a no-op (sealed IDs are now flag-based)', () => {
      const lockKey = 'thread:thread-1';
      const obsBufKey = `obs:${lockKey}`;

      // Seed some state
      OM.lastBufferedAtTime.set(obsBufKey, new Date());

      const fakeThis = {
        getLockKey: () => lockKey,
        getObservationBufferKey: (lk: string) => `obs:${lk}`,
        getReflectionBufferKey: (lk: string) => `refl:${lk}`,
        scope: 'thread',
      };

      // Partial cleanup: pass activatedMessageIds — should not clear static maps
      ObservationalMemory.prototype['cleanupStaticMaps'].call(fakeThis, 'thread-1', null, ['msg-1', 'msg-3']);

      // Static maps should be untouched (partial cleanup only affected sealedMessageIds, which is gone)
      expect(OM.lastBufferedAtTime.has(obsBufKey)).toBe(true);
    });
  });
});
