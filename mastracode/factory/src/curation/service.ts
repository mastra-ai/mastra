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
  #timer: ReturnType<typeof setInterval> | undefined;
  #sweep: Promise<void> | undefined;

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
    if (this.#running) return;
    this.#running = true;
    this.#scheduleSweep();
    if (this.#intervalMs <= 0) return;
    this.#timer = setInterval(() => this.#scheduleSweep(), this.#intervalMs);
    this.#timer.unref?.();
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
    this.#running = false;
    clearInterval(this.#timer);
    this.#timer = undefined;
    await this.#sweep?.catch(error => {
      this.deps?.logger.warn('Factory curation sweep failed during shutdown.', { error });
    });
  }

  #scheduleSweep(): void {
    void this.sweep().catch(error => {
      this.deps?.logger.warn('Factory curation sweep failed.', { error });
    });
  }

  async sweep(): Promise<void> {
    if (this.#sweep) return this.#sweep;
    this.#sweep = this.#runSweep().finally(() => {
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
    const bindings =
      input.bindings ?? (await this.#storage.listRunBindings(input.orgId, input.factoryProjectId, input.workItemId));
    await this.#curateBindingsWithTimeout(
      bindings.filter(binding => binding.status === 'active'),
      input.prompt,
    );
  }

  async #runSweep(): Promise<void> {
    await this.#curateBindingsWithTimeout(await this.#storage.listActiveRunBindings());
  }

  async #curateBindingsWithTimeout(bindings: FactoryRunBindingRecord[], prompt?: string): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const operation = this.#curateBindings(bindings, prompt);
    operation.catch(() => {});
    try {
      await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Factory curation operation timed out.')), this.#operationTimeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async #curateBindings(bindings: FactoryRunBindingRecord[], prompt?: string): Promise<void> {
    const unique = new Map<string, FactoryRunBindingRecord>();
    for (const binding of bindings) {
      unique.set(`${binding.orgId}\0${binding.factoryProjectId}\0${binding.resourceId}\0${binding.threadId}`, binding);
    }
    const bindingsToCurate = [...unique.values()];
    for (let offset = 0; offset < bindingsToCurate.length; offset += CURATION_CONCURRENCY) {
      const batch = bindingsToCurate.slice(offset, offset + CURATION_CONCURRENCY);
      const results = await Promise.allSettled(batch.map(binding => this.#curateBindingWithTimeout(binding, prompt)));
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          this.deps?.logger.warn('Factory curation failed for an active binding.', {
            bindingId: batch[index]?.id,
            error: result.reason,
          });
        }
      });
    }
  }

  async #curateBindingWithTimeout(binding: FactoryRunBindingRecord, prompt?: string): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const curation = this.#curateBinding(binding, prompt);
    curation.catch(() => {});
    try {
      await Promise.race([
        curation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Factory curation timed out for binding ${binding.id}.`)), this.#bindingTimeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async #curateBinding(binding: FactoryRunBindingRecord, prompt?: string): Promise<void> {
    const sessionRow = await this.#sourceControlStorage.sessions.getBySessionId(binding.sessionId);
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
    if (!memory) return;
    await memory.runCuration({
      threadId: binding.threadId,
      resourceId: binding.resourceId,
      requestContext,
      scope: [`org:${binding.orgId}`, `resource:${binding.factoryProjectId}`, `thread:${binding.threadId}`],
      ...(prompt ? { prompt } : {}),
    });
  }
}
