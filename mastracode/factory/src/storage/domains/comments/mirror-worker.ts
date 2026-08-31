/**
 * Drains the comment-mirror deliveries that have come due.
 *
 * Unlike the reconcile workers this one takes no lease: a delivery is claimed
 * row by row inside `updateAtomic`, so every replica can drain at once and two
 * of them never post the same comment. That also makes the interval a latency
 * knob rather than a correctness one.
 */

import { MastraWorker } from '@mastra/core/worker';
import type { WorkerDeps } from '@mastra/core/worker';

import type { CommentsDomain } from './domain.js';

export const DEFAULT_MIRROR_RETRY_INTERVAL_MS = 30_000;
const MIRRORS_PER_TICK = 50;

export interface CommentMirrorWorkerConfig {
  comments: Pick<CommentsDomain, 'retryDueMirrors'>;
  intervalMs?: number;
}

export class CommentMirrorWorker extends MastraWorker {
  readonly name = 'comment-mirror-retry';

  readonly #comments: Pick<CommentsDomain, 'retryDueMirrors'>;
  readonly #intervalMs: number;

  #running = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #inFlight: Promise<void> | undefined;

  constructor(config: CommentMirrorWorkerConfig) {
    super();
    this.#comments = config.comments;
    this.#intervalMs = config.intervalMs ?? DEFAULT_MIRROR_RETRY_INTERVAL_MS;
    if (!Number.isFinite(this.#intervalMs) || this.#intervalMs <= 0) {
      throw new Error('Comment mirror retry interval must be a positive number.');
    }
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.deps) throw new Error('CommentMirrorWorker: call init() before start()');
    this.#running = true;
    // Drain on boot: a restart is exactly when a mirror was most likely dropped.
    this.#schedule(0);
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
    this.#running = false;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    await this.#inFlight;
  }

  get isRunning(): boolean {
    return this.#running;
  }

  #schedule(delayMs: number): void {
    if (!this.#running) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      const run = this.#tick().finally(() => {
        this.#inFlight = undefined;
        this.#schedule(this.#intervalMs);
      });
      this.#inFlight = run;
    }, delayMs);
    this.#timer.unref?.();
  }

  async #tick(): Promise<void> {
    try {
      const attempted = await this.#comments.retryDueMirrors(MIRRORS_PER_TICK);
      if (attempted > 0) this.deps?.logger.info('Retried due comment mirrors', { attempted });
    } catch (error) {
      this.deps?.logger.error('Comment mirror retry cycle failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
