import type { Agent } from '@mastra/core/agent';
import type { AgentController } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import { MastraWorker } from '@mastra/core/worker';

import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { FactoryRunBindingRecord, WorkItemsStorage } from '../storage/domains/work-items/base.js';

type CurationMemory = {
  runCuration(input: {
    threadId: string;
    resourceId: string;
    requestContext: RequestContext;
    scope: string[];
    prompt?: string;
  }): Promise<unknown>;
};

const DEFAULT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_BINDING_TIMEOUT_MS = 30 * 1000;
const DEFAULT_OPERATION_TIMEOUT_MS = 2 * 60 * 1000;
const CURATION_CONCURRENCY = 4;

export interface FactoryCurationServiceOptions {
  agent: Agent;
  controller: AgentController;
  storage: WorkItemsStorage;
  sourceControlStorage: SourceControlStorageHandle;
  intervalMs?: number;
  bindingTimeoutMs?: number;
  operationTimeoutMs?: number;
}

export class FactoryCurationService extends MastraWorker {
  readonly name = 'factory-curation';
  readonly #agent: Agent;
  readonly #controller: AgentController;
  readonly #storage: WorkItemsStorage;
  readonly #sourceControlStorage: SourceControlStorageHandle;
  readonly #intervalMs: number;
  readonly #bindingTimeoutMs: number;
  readonly #operationTimeoutMs: number;
  #running = false;
  #acceptingWork = true;
  #timer: ReturnType<typeof setInterval> | undefined;
  #sweep: Promise<void> | undefined;
  #stopping: Promise<void> | undefined;
  readonly #operations = new Set<Promise<void>>();
  readonly #abortControllers = new Set<AbortController>();

  get isRunning(): boolean {
    return this.#running;
  }

  constructor(options: FactoryCurationServiceOptions) {
    super();
    this.#agent = options.agent;
    this.#controller = options.controller;
    this.#storage = options.storage;
    this.#sourceControlStorage = options.sourceControlStorage;
    this.#intervalMs = options.intervalMs ?? DEFAULT_SWEEP_INTERVAL_MS;
    this.#bindingTimeoutMs = options.bindingTimeoutMs ?? DEFAULT_BINDING_TIMEOUT_MS;
    this.#operationTimeoutMs = options.operationTimeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS;
  }

  async start(): Promise<void> {
    const stopping = this.#stopping;
    if (stopping) await stopping;
    if (this.#running) return;
    this.#running = true;
    this.#acceptingWork = true;
    this.#scheduleSweep();
    if (this.#intervalMs <= 0) return;
    this.#timer = setInterval(() => this.#scheduleSweep(), this.#intervalMs);
    this.#timer.unref?.();
  }

  async stop(): Promise<void> {
    if (this.#stopping) return this.#stopping;
    const stopping = this.#stop();
    this.#stopping = stopping;
    try {
      await stopping;
    } finally {
      if (this.#stopping === stopping) this.#stopping = undefined;
    }
  }

  async #stop(): Promise<void> {
    this.#running = false;
    this.#acceptingWork = false;
    clearInterval(this.#timer);
    this.#timer = undefined;
    for (const controller of this.#abortControllers) controller.abort();
    const operations = [...this.#operations];
    if (operations.length === 0) return;
    const results = await Promise.allSettled(operations);
    for (const result of results) {
      if (result.status === 'rejected') {
        this.deps?.logger.warn('Factory curation operation failed during shutdown.', { error: result.reason });
      }
    }
  }

  #scheduleSweep(): void {
    void this.sweep().catch(error => {
      this.deps?.logger.warn('Factory curation sweep failed.', { error });
    });
  }

  async sweep(): Promise<void> {
    if (!this.#acceptingWork) return;
    if (this.#sweep) return this.#sweep;
    const operation = this.#trackOperation(this.#runOperation(signal => this.#runSweep(signal)));
    this.#sweep = operation.finally(() => {
      this.#sweep = undefined;
    });
    return this.#sweep;
  }

  async curateWorkItem(input: {
    orgId: string;
    factoryProjectId: string;
    workItemId: string;
    prompt?: string;
    bindings?: FactoryRunBindingRecord[];
  }): Promise<void> {
    if (!this.#acceptingWork) return;
    return this.#trackOperation(this.#runOperation(signal => this.#curateWorkItem(input, signal)));
  }

  async #curateWorkItem(
    input: {
      orgId: string;
      factoryProjectId: string;
      workItemId: string;
      prompt?: string;
      bindings?: FactoryRunBindingRecord[];
    },
    signal: AbortSignal,
  ): Promise<void> {
    const bindings =
      input.bindings ?? (await this.#storage.listRunBindings(input.orgId, input.factoryProjectId, input.workItemId));
    if (signal.aborted) return;
    await this.#curateBindings(
      bindings.filter(binding => binding.status === 'active'),
      input.prompt,
      signal,
    );
  }

  async #runSweep(signal: AbortSignal): Promise<void> {
    const bindings = await this.#storage.listActiveRunBindings();
    if (signal.aborted) return;
    await this.#curateBindings(bindings, undefined, signal);
  }

  #trackOperation(operation: Promise<void>): Promise<void> {
    this.#operations.add(operation);
    void operation.then(
      () => this.#operations.delete(operation),
      () => this.#operations.delete(operation),
    );
    return operation;
  }

  async #runOperation(operation: (signal: AbortSignal) => Promise<void>): Promise<void> {
    const controller = new AbortController();
    this.#abortControllers.add(controller);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const work = operation(controller.signal);
    work.catch(() => {});
    try {
      await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Factory curation operation timed out.'));
          }, this.#operationTimeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      this.#abortControllers.delete(controller);
    }
  }

  async #curateBindings(
    bindings: FactoryRunBindingRecord[],
    prompt: string | undefined,
    signal: AbortSignal,
  ): Promise<void> {
    const lanes = new Map<string, FactoryRunBindingRecord[]>();
    for (const binding of bindings) {
      // Curation targets memory by this scope and thread; work-item IDs do not create separate memory lanes.
      const key = `${binding.orgId}\0${binding.factoryProjectId}\0${binding.resourceId}\0${binding.threadId}`;
      const lane = lanes.get(key);
      if (lane) lane.push(binding);
      else lanes.set(key, [binding]);
    }
    const bindingsToCurate: FactoryRunBindingRecord[] = [];
    for (const lane of lanes.values()) {
      const sessionIds = new Set(lane.map(binding => binding.sessionId));
      if (sessionIds.size > 1) {
        this.deps?.logger.warn('Factory curation skipped a lane with conflicting session authorities.', {
          bindingIds: lane.map(binding => binding.id).sort(),
          sessionIds: [...sessionIds].sort(),
        });
        continue;
      }
      bindingsToCurate.push(lane.reduce((selected, binding) => (binding.id < selected.id ? binding : selected)));
    }
    for (let offset = 0; offset < bindingsToCurate.length && !signal.aborted; offset += CURATION_CONCURRENCY) {
      const batch = bindingsToCurate.slice(offset, offset + CURATION_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(binding => this.#curateBindingWithTimeout(binding, prompt, signal)),
      );
      results.forEach((result, index) => {
        if (result.status === 'rejected' && !signal.aborted) {
          this.deps?.logger.warn('Factory curation failed for an active binding.', {
            bindingId: batch[index]?.id,
            error: result.reason,
          });
        }
      });
    }
  }

  async #curateBindingWithTimeout(
    binding: FactoryRunBindingRecord,
    prompt: string | undefined,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    const curation = this.#curateBinding(binding, prompt, controller.signal);
    curation.catch(() => {});
    try {
      await Promise.race([
        curation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`Factory curation timed out for binding ${binding.id}.`));
          }, this.#bindingTimeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  }

  async #curateBinding(
    binding: FactoryRunBindingRecord,
    prompt: string | undefined,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) return;
    const sessionRow = await this.#sourceControlStorage.sessions.getBySessionId(binding.sessionId);
    if (signal.aborted) return;
    if (!sessionRow || sessionRow.orgId !== binding.orgId) {
      throw new Error(`Factory curation cannot resolve session authority for ${binding.sessionId}.`);
    }
    const requestContext = new RequestContext();
    requestContext.set('user', { workosId: sessionRow.userId, organizationId: sessionRow.orgId });
    const state = {
      factoryOrgId: binding.orgId,
      factoryProjectId: binding.factoryProjectId,
    };
    requestContext.set('controller', {
      controllerId: this.#controller.id,
      harnessId: this.#controller.id,
      state,
      getState: () => state,
      threadId: binding.threadId,
      resourceId: binding.resourceId,
    });
    const memory = (await this.#agent.getMemory({ requestContext })) as CurationMemory | undefined;
    if (!memory || signal.aborted) return;
    await memory.runCuration({
      threadId: binding.threadId,
      resourceId: binding.resourceId,
      requestContext,
      scope: [`org:${binding.orgId}`, `resource:${binding.factoryProjectId}`, `thread:${binding.threadId}`],
      ...(prompt ? { prompt } : {}),
    });
  }
}
