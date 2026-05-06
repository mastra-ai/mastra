import type { Event } from '../../events/types';
import type { WorkflowEventProcessor } from '../../workflows/evented/workflow-event-processor';
import { PullTransport } from '../transport/pull-transport';
import type { WorkerTransport } from '../transport/transport';
import type { StepExecutionStrategy } from '../types';
import { MastraWorker } from '../worker';
import type { WorkerDeps } from '../worker';

const DEFAULT_GROUP = 'mastra-orchestration';

export interface OrchestrationWorkerConfig {
  group?: string;
}

/**
 * Processes workflow events (step.run, step.end, start, cancel, etc.)
 * by delegating to the WorkflowEventProcessor.
 *
 * Subscribes to the PubSub "workflows" topic and routes events to WEP.
 *
 * When MASTRA_STEP_EXECUTION_URL is set, injects HttpRemoteStrategy into
 * WEP so step execution happens over HTTP to the server. Otherwise WEP
 * executes steps directly in-process.
 */
export class OrchestrationWorker extends MastraWorker {
  readonly name = 'orchestration';

  #config: OrchestrationWorkerConfig;
  #transport?: WorkerTransport;
  #processor?: WorkflowEventProcessor;
  #strategy?: StepExecutionStrategy;
  #running = false;

  constructor(config: OrchestrationWorkerConfig = {}) {
    super();
    this.#config = config;
  }

  async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);

    if (!deps.mastra) {
      throw new Error('OrchestrationWorker requires Mastra instance');
    }

    // If MASTRA_STEP_EXECUTION_URL is set, use HttpRemoteStrategy
    // (standalone worker calling back to the server for step execution).
    // The strategy reads MASTRA_WORKER_AUTH_TOKEN itself and forwards it
    // through the server's normal Mastra auth provider — there is no
    // separate "worker secret" gate.
    const remoteUrl = process.env.MASTRA_STEP_EXECUTION_URL;
    if (remoteUrl) {
      const { HttpRemoteStrategy } = await import('../strategies/http-remote-strategy');
      this.#strategy = new HttpRemoteStrategy({
        serverUrl: remoteUrl,
      });
    }

    const { WorkflowEventProcessor } = await import('../../workflows/evented/workflow-event-processor');
    this.#processor = new WorkflowEventProcessor({
      mastra: deps.mastra,
      stepExecutionStrategy: this.#strategy,
    });
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.deps) throw new Error('OrchestrationWorker: call init() before start()');

    const group = this.#config.group ?? DEFAULT_GROUP;
    this.#transport = new PullTransport({ pubsub: this.deps.pubsub, group, logger: this.deps.logger });

    await this.#transport.start({
      route: (event, ack, nack) => this.#processEvent(event, ack, nack),
    });

    this.#running = true;
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
    this.#running = false;

    if (this.#transport) {
      await this.#transport.stop();
      this.#transport = undefined;
    }
  }

  get isRunning(): boolean {
    return this.#running;
  }

  async #processEvent(event: Event, ack?: () => Promise<void>, nack?: () => Promise<void>): Promise<void> {
    if (!this.#processor) {
      throw new Error('OrchestrationWorker not initialized');
    }

    try {
      await this.#processor.process(event, ack);
    } catch (err) {
      this.deps?.logger?.error('OrchestrationWorker: error processing event', {
        type: event.type,
        runId: event.runId,
        error: err,
      });
      if (nack) {
        await nack();
      } else {
        throw err;
      }
    }
  }
}
