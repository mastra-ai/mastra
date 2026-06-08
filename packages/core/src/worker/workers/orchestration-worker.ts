import type { Event } from '../../events/types';
import { WorkflowEventProcessor } from '../../workflows/evented/workflow-event-processor';
import { HttpRemoteStrategy } from '../strategies/http-remote-strategy';
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

    // OrchestrationWorker drives a pull subscription on the workflow topic.
    // Push-only pubsubs (EventEmitter, GCP push subscriptions) deliver events
    // through different paths and must not be paired with this worker.
    const modes = deps.pubsub.supportedModes ?? ['pull'];
    if (!modes.includes('pull')) {
      throw new Error(
        `OrchestrationWorker requires a pull-capable PubSub, but the configured pubsub only supports: ${modes.join(', ')}. ` +
          `Either remove OrchestrationWorker from the workers list or use a pull-capable PubSub (e.g. Redis Streams).`,
      );
    }

    // If MASTRA_STEP_EXECUTION_URL is set, use HttpRemoteStrategy
    // (standalone worker calling back to the server for step execution).
    // The strategy reads MASTRA_WORKER_AUTH_TOKEN itself and forwards it
    // through the server's normal Mastra auth provider — there is no
    // separate "worker secret" gate.
    const remoteUrl = process.env.MASTRA_STEP_EXECUTION_URL;
    if (remoteUrl) {
      this.#strategy = new HttpRemoteStrategy({
        serverUrl: remoteUrl,
      });
    }

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

    try {
      if (this.#transport) {
        await this.#transport.stop();
        this.#transport = undefined;
      }
    } finally {
      this.#running = false;
    }
  }

  get isRunning(): boolean {
    return this.#running;
  }

  async #processEvent(event: Event, ack?: () => Promise<void>, nack?: () => Promise<void>): Promise<void> {
    if (!this.#processor) {
      throw new Error('OrchestrationWorker not initialized');
    }

    // The local processor is used (rather than mastra.handleWorkflowEvent)
    // because it carries the standalone-worker step-execution strategy
    // (HttpRemoteStrategy when MASTRA_STEP_EXECUTION_URL is set), which the
    // shared in-process handler doesn't have.
    const result = await this.#processor.handle(event);
    if (result.ok) {
      try {
        await ack?.();
      } catch (e) {
        this.deps?.logger?.error('OrchestrationWorker: error acking event', { error: e });
      }
      return;
    }

    this.deps?.logger?.error('OrchestrationWorker: error processing event', {
      type: event.type,
      runId: event.runId,
      retry: result.retry,
    });
    if (nack) {
      await nack();
    }
  }
}
