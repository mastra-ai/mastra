import type { Agent } from '@mastra/core/agent';
import type { AgentController } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import { MastraWorker } from '@mastra/core/worker';

import type { SourceControlStorage } from '../storage/domains/source-control/base.js';
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

export interface FactoryCurationServiceOptions {
  agent: Agent;
  controller: AgentController;
  storage: WorkItemsStorage;
  sourceControlStorage: SourceControlStorage;
  intervalMs?: number;
}

export class FactoryCurationService extends MastraWorker {
  readonly name = 'factory-curation';
  readonly #agent: Agent;
  readonly #controller: AgentController;
  readonly #storage: WorkItemsStorage;
  readonly #sourceControlStorage: SourceControlStorage;
  readonly #intervalMs: number;
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
    includeRevoked?: boolean;
  }): Promise<void> {
    const bindings = await this.#storage.listRunBindings(input.orgId, input.factoryProjectId, input.workItemId);
    await this.#curateBindings(
      bindings.filter(binding => binding.status === 'active' || input.includeRevoked === true),
      input.prompt,
    );
  }

  async #runSweep(): Promise<void> {
    await this.#curateBindings(await this.#storage.listActiveRunBindings());
  }

  async #curateBindings(bindings: FactoryRunBindingRecord[], prompt?: string): Promise<void> {
    const unique = new Map<string, FactoryRunBindingRecord>();
    for (const binding of bindings) {
      unique.set(`${binding.orgId}\0${binding.factoryProjectId}\0${binding.resourceId}\0${binding.threadId}`, binding);
    }
    const bindingsToCurate = [...unique.values()];
    const results = await Promise.allSettled(bindingsToCurate.map(binding => this.#curateBinding(binding, prompt)));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.deps?.logger.warn('Factory curation failed for an active binding.', {
          bindingId: bindingsToCurate[index]?.id,
          error: result.reason,
        });
      }
    });
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
