import { omError } from './debug';

/**
 * In-process keyed queue for non-blocking extraction/background work.
 * Jobs for the same key run serially; different keys can progress independently.
 */
export class ExtractionCoordinator {
  private queues = new Map<string, Promise<void>>();

  enqueue(key: string, job: () => Promise<void>): Promise<void> {
    const previous = this.queues.get(key) ?? Promise.resolve();

    const next = previous
      .catch(() => {
        // Prior job errors are already logged by their own wrapper. Keep the chain alive.
      })
      .then(async () => {
        try {
          await job();
        } catch (error) {
          omError(`[OM] background extraction job failed for ${key}`, error);
        }
      })
      .finally(() => {
        if (this.queues.get(key) === next) {
          this.queues.delete(key);
        }
      });

    this.queues.set(key, next);
    return next;
  }

  async awaitIdle(key: string, timeoutMs = 30000): Promise<void> {
    const pending = this.queues.get(key);
    if (!pending) return;

    await Promise.race([
      pending,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out waiting for extraction job')), timeoutMs),
      ),
    ]);
  }
}
