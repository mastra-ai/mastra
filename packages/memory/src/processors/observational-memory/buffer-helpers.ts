/**
 * Async buffering helper functions for Observational Memory.
 *
 * Pure utility functions for buffer key generation, async-enabled config checks,
 * and in-progress buffering detection. These are extracted from the
 * ObservationalMemory class to reduce its size and improve testability.
 */

/**
 * Check if async buffering is enabled for observations.
 * Enabled when `bufferTokens` is set to a positive number.
 */
export function isAsyncObservationEnabled(config: { bufferTokens?: number }): boolean {
  return config.bufferTokens !== undefined && config.bufferTokens > 0;
}

/**
 * Check if async buffering is enabled for reflections.
 * Enabled when `bufferActivation` is set to a positive number.
 */
export function isAsyncReflectionEnabled(config: { bufferActivation?: number }): boolean {
  return config.bufferActivation !== undefined && config.bufferActivation > 0;
}

/**
 * Get the buffer key for observation buffering operations.
 */
export function getObservationBufferKey(lockKey: string): string {
  return `obs:${lockKey}`;
}

/**
 * Get the buffer key for reflection buffering operations.
 */
export function getReflectionBufferKey(lockKey: string): string {
  return `refl:${lockKey}`;
}

/**
 * Check if an async buffering operation is already in progress
 * for the given buffer key.
 */
export function isAsyncBufferingInProgress(bufferKey: string, asyncBufferingOps: Map<string, Promise<void>>): boolean {
  return asyncBufferingOps.has(bufferKey);
}
