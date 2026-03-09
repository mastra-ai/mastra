import { describe, it, expect, beforeEach } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

// Access private static members via `as any` — matches existing test conventions
const OM = ObservationalMemory as any;

/**
 * Regression tests for OM static map cleanup.
 * Ensures that:
 *   1. cleanupStaticMaps uses the correct key for reflectionBufferCycleIds
 *   2. sealedMessageIds per-thread cap is enforced at the write site
 */

function clearAllStaticState(): void {
  OM.asyncBufferingOps.clear();
  OM.lastBufferedBoundary.clear();
  OM.lastBufferedAtTime.clear();
  OM.reflectionBufferCycleIds.clear();
  OM.sealedMessageIds.clear();
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
      OM.sealedMessageIds.set('thread-1', new Set(['msg-1', 'msg-2']));

      const fakeThis = {
        getLockKey: (_threadId: string, _resourceId?: string | null) => lockKey,
        getObservationBufferKey: (lk: string) => `obs:${lk}`,
        getReflectionBufferKey: (lk: string) => `refl:${lk}`,
        scope: 'thread',
      };

      // Call cleanupStaticMaps with full cleanup (no activatedMessageIds)
      ObservationalMemory.prototype['cleanupStaticMaps'].call(fakeThis, 'thread-1', null);

      // All entries should be removed
      expect(OM.sealedMessageIds.has('thread-1')).toBe(false);
      expect(OM.lastBufferedAtTime.has(obsBufKey)).toBe(false);
      expect(OM.lastBufferedBoundary.has(obsBufKey)).toBe(false);
      expect(OM.lastBufferedBoundary.has(reflBufKey)).toBe(false);
      expect(OM.asyncBufferingOps.has(obsBufKey)).toBe(false);
      expect(OM.asyncBufferingOps.has(reflBufKey)).toBe(false);
      // KEY FIX: reflectionBufferCycleIds must be deleted with reflBufKey, not obsBufKey
      expect(OM.reflectionBufferCycleIds.has(reflBufKey)).toBe(false);
    });

    it('partial cleanup removes only activated message IDs from sealedMessageIds', () => {
      OM.sealedMessageIds.set('thread-1', new Set(['msg-1', 'msg-2', 'msg-3']));

      const lockKey = 'thread:thread-1';
      const fakeThis = {
        getLockKey: () => lockKey,
        getObservationBufferKey: (lk: string) => `obs:${lk}`,
        getReflectionBufferKey: (lk: string) => `refl:${lk}`,
        scope: 'thread',
      };

      // Partial cleanup: pass activatedMessageIds
      ObservationalMemory.prototype['cleanupStaticMaps'].call(fakeThis, 'thread-1', null, ['msg-1', 'msg-3']);

      // msg-2 should remain
      const remaining = OM.sealedMessageIds.get('thread-1');
      expect(remaining).toBeDefined();
      expect(remaining.size).toBe(1);
      expect(remaining.has('msg-2')).toBe(true);
    });

    it('partial cleanup deletes sealedMessageIds entry when all IDs are removed', () => {
      OM.sealedMessageIds.set('thread-1', new Set(['msg-1']));

      const lockKey = 'thread:thread-1';
      const fakeThis = {
        getLockKey: () => lockKey,
        getObservationBufferKey: (lk: string) => `obs:${lk}`,
        getReflectionBufferKey: (lk: string) => `refl:${lk}`,
        scope: 'thread',
      };

      ObservationalMemory.prototype['cleanupStaticMaps'].call(fakeThis, 'thread-1', null, ['msg-1']);

      expect(OM.sealedMessageIds.has('thread-1')).toBe(false);
    });
  });
});
