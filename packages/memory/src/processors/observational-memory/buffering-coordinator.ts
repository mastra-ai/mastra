import type { ObservationalMemoryRecord } from '@mastra/core/storage';

import { getOMLockKey, runOMCommit } from './commit-queue';
import { omDebug } from './debug';
import { isOpActiveInProcess } from './operation-registry';
import type { ResolvedObservationConfig, ResolvedReflectionConfig } from './types';

/**
 * Manages the static buffering state machine for async observation and reflection.
 *
 * Static maps are shared across all ObservationalMemory instances in a process.
 * This is critical because multiple OM instances are created per agent loop step,
 * and they need to share knowledge of in-flight operations.
 */
export class BufferingCoordinator {
  private readonly observationConfig: ResolvedObservationConfig;
  private readonly reflectionConfig: ResolvedReflectionConfig;
  private readonly scope: 'thread' | 'resource';

  /**
   * Track in-flight async buffering operations per resource/thread.
   * Key format: "obs:{lockKey}" or "refl:{lockKey}"
   * Value: Promise that resolves when buffering completes
   */
  static asyncBufferingOps = new Map<string, Promise<void>>();

  /**
   * Observation buffer ops that may still append a buffered chunk.
   * Key format: "obs:{lockKey}"
   * Value: Promise that resolves once the op has persisted its chunk (or ended without one)
   *
   * Above the threshold→blockAfter band, activation waits (bounded) on this phase so the chunk
   * activates instead of being re-observed by the sync pass. It is not needed for safety: storage
   * keeps a chunk appended during activation. An op stays in asyncBufferingOps through its
   * post-persist work (indexing, thread title), which activation never waits for.
   */
  static pendingChunkWrites = new Map<string, Promise<void>>();

  /**
   * Track the last token boundary at which we started buffering.
   * Key format: "obs:{lockKey}" or "refl:{lockKey}"
   */
  static lastBufferedBoundary = new Map<string, number>();

  /**
   * Track the timestamp cursor for buffered messages.
   * Key format: "obs:{lockKey}"
   */
  static lastBufferedAtTime = new Map<string, Date>();

  /**
   * Tracks cycleId for in-flight buffered reflections.
   * Key format: "refl:{lockKey}"
   */
  static reflectionBufferCycleIds = new Map<string, string>();

  constructor(opts: {
    observationConfig: ResolvedObservationConfig;
    reflectionConfig: ResolvedReflectionConfig;
    scope: 'thread' | 'resource';
  }) {
    this.observationConfig = opts.observationConfig;
    this.reflectionConfig = opts.reflectionConfig;
    this.scope = opts.scope;
  }

  getLockKey(threadId: string | null | undefined, resourceId: string | null | undefined): string {
    return getOMLockKey(this.scope, threadId, resourceId);
  }

  isAsyncObservationEnabled(): boolean {
    return this.observationConfig.bufferTokens !== undefined && this.observationConfig.bufferTokens > 0;
  }

  isAsyncReflectionEnabled(): boolean {
    return this.reflectionConfig.bufferActivation !== undefined && this.reflectionConfig.bufferActivation > 0;
  }

  getObservationBufferKey(lockKey: string): string {
    return `obs:${lockKey}`;
  }

  getReflectionBufferKey(lockKey: string): string {
    return `refl:${lockKey}`;
  }

  isAsyncBufferingInProgress(bufferKey: string): boolean {
    return BufferingCoordinator.asyncBufferingOps.has(bufferKey);
  }

  /**
   * Mark an observation buffer op as able to append a chunk. Call the returned release
   * function once it no longer can; releasing more than once is a no-op.
   */
  static trackChunkWrite(bufferKey: string): () => void {
    let resolve!: () => void;
    const pending = new Promise<void>(r => (resolve = r));
    BufferingCoordinator.pendingChunkWrites.set(bufferKey, pending);
    return () => {
      if (BufferingCoordinator.pendingChunkWrites.get(bufferKey) === pending) {
        BufferingCoordinator.pendingChunkWrites.delete(bufferKey);
      }
      resolve();
    };
  }

  /**
   * Clean up static maps for a thread/resource to prevent memory leaks.
   */
  cleanupStaticMaps(threadId: string, resourceId?: string | null, activatedMessageIds?: string[]): void {
    const lockKey = this.getLockKey(threadId, resourceId);
    const obsBufKey = this.getObservationBufferKey(lockKey);
    const reflBufKey = this.getReflectionBufferKey(lockKey);

    if (activatedMessageIds) {
      // Partial cleanup after activation: clear stale boundary/time state for
      // the observation buffer key so the next buffer cycle isn't suppressed.
      BufferingCoordinator.lastBufferedBoundary.delete(obsBufKey);
      BufferingCoordinator.lastBufferedAtTime.delete(obsBufKey);
    } else {
      // Full cleanup: remove all static state for this thread
      BufferingCoordinator.lastBufferedAtTime.delete(obsBufKey);
      BufferingCoordinator.lastBufferedBoundary.delete(obsBufKey);
      BufferingCoordinator.lastBufferedBoundary.delete(reflBufKey);
      BufferingCoordinator.asyncBufferingOps.delete(obsBufKey);
      BufferingCoordinator.asyncBufferingOps.delete(reflBufKey);
      BufferingCoordinator.reflectionBufferCycleIds.delete(reflBufKey);
    }
  }

  /**
   * Check if we've crossed a new bufferTokens interval boundary for async observation.
   */
  shouldTriggerAsyncObservation(
    currentTokens: number,
    lockKey: string,
    record: ObservationalMemoryRecord,
    storage?: { setBufferingObservationFlag(id: string, flag: boolean): Promise<void> },
    messageTokensThreshold?: number,
  ): boolean {
    if (!this.isAsyncObservationEnabled()) return false;

    if (record.isBufferingObservation) {
      if (isOpActiveInProcess(record.id, 'bufferingObservation')) return false;
      omDebug(`[OM:shouldTriggerAsyncObs] isBufferingObservation=true but stale, clearing`);
      if (storage) {
        void runOMCommit(lockKey, () => storage.setBufferingObservationFlag(record.id, false)).catch(() => {});
      }
    }

    const bufferKey = this.getObservationBufferKey(lockKey);
    if (this.isAsyncBufferingInProgress(bufferKey)) return false;

    const bufferTokens = this.observationConfig.bufferTokens!;
    const dbBoundary = record.lastBufferedAtTokens ?? 0;
    const memBoundary = BufferingCoordinator.lastBufferedBoundary.get(bufferKey) ?? 0;
    const lastBoundary = Math.max(dbBoundary, memBoundary);

    const rampPoint = messageTokensThreshold ? messageTokensThreshold - bufferTokens * 1.1 : Infinity;
    const effectiveBufferTokens = currentTokens >= rampPoint ? bufferTokens / 2 : bufferTokens;

    const currentInterval = Math.floor(currentTokens / effectiveBufferTokens);
    const lastInterval = Math.floor(lastBoundary / effectiveBufferTokens);

    const shouldTrigger = currentInterval > lastInterval;

    omDebug(
      `[OM:shouldTriggerAsyncObs] tokens=${currentTokens}, bufferTokens=${bufferTokens}, effectiveBufferTokens=${effectiveBufferTokens}, rampPoint=${rampPoint}, currentInterval=${currentInterval}, lastInterval=${lastInterval}, lastBoundary=${lastBoundary} (db=${dbBoundary}, mem=${memBoundary}), shouldTrigger=${shouldTrigger}`,
    );

    return shouldTrigger;
  }

  /**
   * Await any in-flight async buffering operations for a given thread/resource.
   */
  static async awaitBuffering(
    threadId: string | null | undefined,
    resourceId: string | null | undefined,
    scope: 'thread' | 'resource',
    timeoutMs = 30000,
  ): Promise<void> {
    const lockKey = getOMLockKey(scope, threadId, resourceId);
    const obsKey = `obs:${lockKey}`;
    const reflKey = `refl:${lockKey}`;

    const promises: Promise<void>[] = [];
    const obsOp = BufferingCoordinator.asyncBufferingOps.get(obsKey);
    if (obsOp) promises.push(obsOp);
    const reflOp = BufferingCoordinator.asyncBufferingOps.get(reflKey);
    if (reflOp) promises.push(reflOp);

    if (promises.length === 0) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.allSettled(promises).then(() => undefined),
        new Promise<void>(resolve => {
          timeoutId = setTimeout(resolve, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }
}
