import { evaluateMonitors } from '../../evals/monitors';
import { MastraWorker } from '../worker';

export interface MonitorWorkerConfig {
  /** Base interval between evaluation ticks in ms. Default 60_000. */
  intervalMs?: number;
  /**
   * Maximum random jitter (ms) added to each tick delay so multiple
   * leader-less instances don't evaluate in lockstep. Default 5_000.
   */
  jitterMs?: number;
}

/**
 * Periodically evaluates score monitors against recent scores and delivers
 * breach/recovery notifications. Leader-less: every server instance runs the
 * loop with jitter; evaluation is idempotent enough (cooldown windows) that
 * overlapping instances only risk duplicate notifications within the same
 * tick, not crashes.
 *
 * Serverless deployments should not rely on this worker — trigger evaluation
 * via `POST /api/monitors/evaluate` from an external cron instead.
 */
export class MonitorWorker extends MastraWorker {
  readonly name = 'monitor';

  #config: Required<MonitorWorkerConfig>;
  #timer?: ReturnType<typeof setTimeout>;
  #running = false;
  #ticking = false;

  constructor(config: MonitorWorkerConfig = {}) {
    super();
    this.#config = {
      intervalMs: config.intervalMs ?? 60_000,
      jitterMs: config.jitterMs ?? 5_000,
    };
  }

  async start(): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    this.#schedule();
  }

  async stop(): Promise<void> {
    this.#running = false;
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
  }

  get isRunning(): boolean {
    return this.#running;
  }

  #schedule(): void {
    if (!this.#running) return;
    const delay = this.#config.intervalMs + Math.floor(Math.random() * this.#config.jitterMs);
    this.#timer = setTimeout(() => {
      void this.tick().finally(() => this.#schedule());
    }, delay);
    // Don't keep the process alive just for monitor evaluation.
    this.#timer.unref?.();
  }

  /** Runs one evaluation pass. Public so tests and cron hooks can drive it directly. */
  async tick(): Promise<void> {
    if (this.#ticking) return;
    this.#ticking = true;
    try {
      const storage = this.deps?.storage;
      if (!storage) return;
      const [monitorsStore, scoresStore] = await Promise.all([
        storage.getStore('monitors'),
        storage.getStore('scores'),
      ]);
      if (!monitorsStore || !scoresStore) return;
      await evaluateMonitors({
        monitorsStore,
        scoresStore,
        logger: this.deps?.logger,
      });
    } catch (error) {
      this.deps?.logger?.error?.('MonitorWorker: evaluation tick failed', { error });
    } finally {
      this.#ticking = false;
    }
  }
}
