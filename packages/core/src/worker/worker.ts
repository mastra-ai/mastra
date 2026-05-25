import type { PubSub } from '../events/pubsub';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { MastraCompositeStore } from '../storage';

/**
 * Infrastructure dependencies provided to workers during initialization.
 */
export interface WorkerDeps {
  pubsub: PubSub;
  storage: MastraCompositeStore;
  logger: IMastraLogger;
  mastra?: Mastra;
}

/**
 * Abstract base class for Mastra workers.
 *
 * Each worker is a self-contained, independently deployable unit of
 * background processing. Concrete implementations include:
 * - OrchestrationWorker: processes workflow events
 * - SchedulerWorker: fires cron-based workflow schedules
 * - BackgroundTaskWorker: manages background tool execution
 *
 * Workers are registered on a Mastra instance and run inline by default.
 * They can also be launched standalone via the CLI for separate deployment.
 */
export abstract class MastraWorker {
  abstract readonly name: string;

  protected mastra?: Mastra;
  protected deps?: WorkerDeps;

  /** Called by Mastra during registration to provide the instance reference. */
  __registerMastra(mastra: Mastra): void {
    this.mastra = mastra;
  }

  /** Initialize with infrastructure deps. Called before start(). */
  async init(deps: WorkerDeps): Promise<void> {
    this.deps = deps;
    if (!this.mastra && deps.mastra) {
      this.mastra = deps.mastra;
    }
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract get isRunning(): boolean;
}
