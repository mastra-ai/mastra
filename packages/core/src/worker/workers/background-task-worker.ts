import { BackgroundTaskManager } from '../../background-tasks/manager';
import type { Mastra } from '../../mastra';
import { MastraWorker } from '../worker';
import type { WorkerDeps } from '../worker';

/**
 * Minimal shape of a tool callable usable for cross-process static
 * background-task execution. We intentionally avoid pulling the full
 * `ToolAction` generic into this file — only `execute` is needed.
 */
type StaticToolLike = {
  execute?: (
    args: Record<string, unknown>,
    options: { toolCallId: string; messages: unknown[]; abortSignal?: AbortSignal },
  ) => Promise<unknown>;
};

export interface BackgroundTaskWorkerConfig {
  globalConcurrency?: number;
  perAgentConcurrency?: number;
  backpressure?: 'queue' | 'reject' | 'fallback-sync';
  defaultTimeoutMs?: number;
}

/**
 * Manages background tool execution for agents. Handles task queuing,
 * concurrency limits, and lifecycle. Subscribes to PubSub internally
 * via BackgroundTaskManager's own subscription mechanism.
 */
export class BackgroundTaskWorker extends MastraWorker {
  readonly name = 'backgroundTasks';

  #manager?: BackgroundTaskManager;
  #ownsManager = false;
  #config: BackgroundTaskWorkerConfig;
  #running = false;

  constructor(config: BackgroundTaskWorkerConfig = {}) {
    super();
    this.#config = config;
  }

  async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);

    // Reuse Mastra's existing BackgroundTaskManager when available so the
    // worker shares the per-task `taskContexts` registry populated by the
    // producer. Spinning up a second manager subscribes the same WORKER_GROUP
    // twice, runs `recoverStaleTasks` twice, and breaks per-task closures —
    // any task dispatched from the producer that lands on this worker's
    // duplicate manager has no `taskContexts` entry.
    const existing = deps.mastra?.backgroundTaskManager;
    if (existing) {
      this.#manager = existing;
      this.#ownsManager = false;
      return;
    }

    this.#manager = new BackgroundTaskManager({
      enabled: true,
      globalConcurrency: this.#config.globalConcurrency,
      perAgentConcurrency: this.#config.perAgentConcurrency,
      backpressure: this.#config.backpressure,
      defaultTimeoutMs: this.#config.defaultTimeoutMs,
    });
    this.#ownsManager = true;

    if (deps.mastra) {
      this.#manager.__registerMastra(deps.mastra);
      this.#wireStaticTools(deps.mastra);
    }
  }

  /**
   * Populate the manager's static executor registry from tools registered
   * on `Mastra`, so that cross-process dispatches can be resolved by tool
   * name on this worker. Mirrors the wiring Mastra does for its own
   * managed background-task manager — the worker owns a separate manager
   * instance, so it has to populate its own registry.
   */
  #wireStaticTools(mastra: Mastra): void {
    const listTools = (mastra as unknown as { listTools?: () => Record<string, StaticToolLike> }).listTools;
    const tools = listTools?.call(mastra);
    if (!tools || !this.#manager) return;
    for (const [name, tool] of Object.entries(tools)) {
      if (!tool || typeof tool.execute !== 'function') continue;
      const execute = tool.execute.bind(tool);
      this.#manager.registerStaticExecutor(name, {
        execute: async (args, options) => {
          return execute(args, {
            toolCallId: '',
            messages: [],
            abortSignal: options?.abortSignal,
          });
        },
      });
    }
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.#manager || !this.deps) {
      throw new Error('BackgroundTaskWorker: call init() before start()');
    }
    // When sharing Mastra's manager, Mastra has already fired off init() in
    // its constructor as fire-and-forget. Don't re-await it here — that would
    // surface init errors twice (the constructor's `.catch` already reports
    // them) and serialize startWorkers() behind the manager's full bootstrap.
    if (this.#ownsManager) {
      await this.#manager.init(this.deps.pubsub);
    }
    this.#running = true;
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
    // Only tear down the manager if this worker owns it. When sharing Mastra's
    // manager, Mastra's stopWorkers() / shutdown is responsible.
    if (this.#manager && this.#ownsManager) {
      await this.#manager.shutdown();
    }
    this.#running = false;
  }

  get isRunning(): boolean {
    return this.#running;
  }

  /** Expose the underlying manager for direct API access. */
  get manager(): BackgroundTaskManager | undefined {
    return this.#manager;
  }
}
