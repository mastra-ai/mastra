import type { Agent } from '@mastra/core/agent';
import type { AgentController } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import { MastraWorker } from '@mastra/core/worker';

import type { FactoryRunBindingRecord, WorkItemsStorage } from '../storage/domains/work-items/base.js';

type CurationMemory = {
  runCuration(input: {
    threadId: string;
    resourceId: string;
    requestContext: RequestContext;
    scope: { organizationId: string; resourceId: string };
    prompt?: string;
  }): Promise<unknown>;
};

const DEFAULT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export interface FactoryCurationServiceOptions {
  agent: Agent;
  controller: AgentController;
  storage: WorkItemsStorage;
  intervalMs?: number;
}

export class FactoryCurationService extends MastraWorker {
  readonly name = 'factory-curation';
  readonly #agent: Agent;
  readonly #controller: AgentController;
  readonly #storage: WorkItemsStorage;
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
    this.#intervalMs = options.intervalMs ?? DEFAULT_SWEEP_INTERVAL_MS;
  }

  async start(): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    if (this.#intervalMs <= 0) return;
    this.#timer = setInterval(() => void this.sweep(), this.#intervalMs);
    this.#timer.unref?.();
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
    this.#running = false;
    clearInterval(this.#timer);
    this.#timer = undefined;
    await this.#sweep;
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
  }): Promise<void> {
    const bindings = await this.#storage.listRunBindings(input.orgId, input.factoryProjectId, input.workItemId);
    await this.#curateBindings(
      bindings.filter(binding => binding.status === 'active'),
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
    await Promise.allSettled([...unique.values()].map(binding => this.#curateBinding(binding, prompt)));
  }

  async #curateBinding(binding: FactoryRunBindingRecord, prompt?: string): Promise<void> {
    const session = await this.#controller.createSession({
      id: binding.sessionId,
      resourceId: binding.resourceId,
      ownerId: binding.resourceId,
      threadId: binding.threadId,
      tags: {
        factoryOrgId: binding.orgId,
        factoryProjectId: binding.factoryProjectId,
      },
    });
    const state = session.state.get();
    const requestContext = new RequestContext();
    requestContext.set('controller', {
      controllerId: this.#controller.id,
      harnessId: this.#controller.id,
      state,
      getState: () => session.state.get(),
      threadId: binding.threadId,
      resourceId: binding.resourceId,
      session,
    });
    const memory = (await this.#agent.getMemory({ requestContext })) as CurationMemory | undefined;
    if (!memory) return;
    await memory.runCuration({
      threadId: binding.threadId,
      resourceId: binding.resourceId,
      requestContext,
      scope: { organizationId: binding.orgId, resourceId: binding.factoryProjectId },
      ...(prompt ? { prompt } : {}),
    });
  }
}
