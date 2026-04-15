import { describe, it, expect, beforeEach } from 'vitest';

import { BufferingCoordinator } from '../buffering-coordinator';

const BC = BufferingCoordinator as any;

/**
 * Regression tests for BufferingCoordinator static map cleanup.
 * Ensures that cleanupStaticMaps uses the correct key for reflectionBufferCycleIds.
 */

function clearAllStaticState(): void {
  BC.asyncBufferingOps.clear();
  BC.lastBufferedBoundary.clear();
  BC.lastBufferedAtTime.clear();
  BC.reflectionBufferCycleIds.clear();
}

describe('BufferingCoordinator static map cleanup', () => {
  beforeEach(() => {
    clearAllStaticState();
  });

  describe('cleanupStaticMaps key correctness', () => {
    it('full cleanup removes reflectionBufferCycleIds using the reflection key, not the observation key', () => {
      // Seed static maps with both obs and refl keys for thread-1
      const lockKey = 'thread:thread-1';
      const obsBufKey = `obs:${lockKey}`;
      const reflBufKey = `refl:${lockKey}`;

      BC.lastBufferedBoundary.set(obsBufKey, 1000);
      BC.lastBufferedBoundary.set(reflBufKey, 2000);
      BC.lastBufferedAtTime.set(obsBufKey, new Date());
      BC.asyncBufferingOps.set(obsBufKey, Promise.resolve());
      BC.asyncBufferingOps.set(reflBufKey, Promise.resolve());
      BC.reflectionBufferCycleIds.set(reflBufKey, 'cycle-abc');

      const coordinator = new BufferingCoordinator({
        observationConfig: { messageTokens: 30000 } as any,
        reflectionConfig: { observationTokens: 40000 } as any,
        scope: 'thread',
      });

      // Call cleanupStaticMaps with full cleanup (no activatedMessageIds)
      coordinator.cleanupStaticMaps('thread-1', null);

      // All entries should be removed
      expect(BC.lastBufferedAtTime.has(obsBufKey)).toBe(false);
      expect(BC.lastBufferedBoundary.has(obsBufKey)).toBe(false);
      expect(BC.lastBufferedBoundary.has(reflBufKey)).toBe(false);
      expect(BC.asyncBufferingOps.has(obsBufKey)).toBe(false);
      expect(BC.asyncBufferingOps.has(reflBufKey)).toBe(false);
      // KEY FIX: reflectionBufferCycleIds must be deleted with reflBufKey, not obsBufKey
      expect(BC.reflectionBufferCycleIds.has(reflBufKey)).toBe(false);
    });

    it('partial cleanup clears stale observation boundary/time for the buffer key', () => {
      const lockKey = 'thread:thread-1';
      const obsBufKey = `obs:${lockKey}`;

      // Seed some state
      BC.lastBufferedAtTime.set(obsBufKey, new Date());
      BC.lastBufferedBoundary.set(obsBufKey, 'boundary-value');

      const coordinator = new BufferingCoordinator({
        observationConfig: { messageTokens: 30000 } as any,
        reflectionConfig: { observationTokens: 40000 } as any,
        scope: 'thread',
      });

      // Partial cleanup: pass activatedMessageIds — should clear stale observation state
      coordinator.cleanupStaticMaps('thread-1', null, ['msg-1', 'msg-3']);

      // After activation, stale observation boundary/time should be cleared
      // so the next buffer cycle isn't suppressed or delayed
      expect(BC.lastBufferedAtTime.has(obsBufKey)).toBe(false);
      expect(BC.lastBufferedBoundary.has(obsBufKey)).toBe(false);
    });
  });
});
