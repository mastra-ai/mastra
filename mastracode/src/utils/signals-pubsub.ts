import { PerThreadPubSub } from '@mastra/core/events';

/**
 * Creates a per-thread PubSub for cross-process signal coordination.
 *
 * Each thread gets its own Unix socket (in /tmp for automatic cleanup).
 * Processes on different threads never exchange data. A solo process on a
 * thread has zero serialization overhead — the broker only serializes when
 * another process joins the same thread's socket.
 */
export function createSignalsPubSub(resourceId: string): PerThreadPubSub {
  return new PerThreadPubSub(resourceId);
}
