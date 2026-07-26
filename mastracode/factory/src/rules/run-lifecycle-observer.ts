import type { AgentControllerEvent } from '@mastra/core/agent-controller';

import type { AuditStorage } from '../storage/domains/audit/base.js';
import type {
  FactoryRunBindingAddress,
  FactoryRunBindingRecord,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import type { FactoryRules } from './types.js';

export interface FactoryIdleWithoutTransitionEvent {
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  bindingId: string;
  role: string;
  stage: string;
  revision: number;
  threadId: string;
  resourceId: string;
  sessionId: string;
}

type ObservableFactorySession = {
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
};

type RunStartSnapshot = {
  binding: FactoryRunBindingRecord;
  stage: string;
  revision: number;
};

export interface FactoryRunLifecycleObserverOptions {
  storage: WorkItemsStorage;
  audit: Pick<AuditStorage, 'record'>;
  rules: FactoryRules;
  reconcileBinding(binding: FactoryRunBindingRecord): Promise<void>;
  onIdleWithoutTransition?(event: FactoryIdleWithoutTransitionEvent): Promise<void>;
  onError?(error: unknown): void;
}

export class FactoryRunLifecycleObserver {
  readonly #observed = new WeakSet<ObservableFactorySession>();
  readonly #lifecycles = new WeakMap<ObservableFactorySession, Promise<void>>();
  readonly #idleListeners = new Set<(event: FactoryIdleWithoutTransitionEvent) => Promise<void>>();
  readonly #options: FactoryRunLifecycleObserverOptions;

  constructor(options: FactoryRunLifecycleObserverOptions) {
    this.#options = options;
    if (options.onIdleWithoutTransition) this.#idleListeners.add(options.onIdleWithoutTransition);
  }

  subscribeIdle(listener: (event: FactoryIdleWithoutTransitionEvent) => Promise<void>): () => void {
    this.#idleListeners.add(listener);
    return () => this.#idleListeners.delete(listener);
  }

  observe(session: ObservableFactorySession, address: FactoryRunBindingAddress): void {
    if (this.#observed.has(session)) return;
    this.#observed.add(session);

    let snapshot: RunStartSnapshot | undefined;
    let lifecycle = Promise.resolve();
    session.subscribe(event => {
      if (event.type !== 'agent_start' && event.type !== 'agent_end') return;
      lifecycle = lifecycle
        .then(async () => {
          if (event.type === 'agent_start') {
            snapshot = await this.#capture(address);
            return;
          }
          const completedRun = snapshot;
          snapshot = undefined;
          if (event.reason !== 'complete' || !completedRun) return;
          await this.#observeCompletion(address, completedRun);
        })
        .catch(error => {
          snapshot = undefined;
          this.#options.onError?.(error);
        });
      this.#lifecycles.set(session, lifecycle);
    });
  }

  waitForSettled(session: ObservableFactorySession): Promise<void> {
    return this.#lifecycles.get(session) ?? Promise.resolve();
  }

  async #capture(address: FactoryRunBindingAddress): Promise<RunStartSnapshot | undefined> {
    const binding = await this.#options.storage.findActiveRunBinding(address);
    if (!binding) return;
    const item = await this.#options.storage.getForProject(binding.orgId, binding.factoryProjectId, binding.workItemId);
    const stage = item?.stages.length === 1 ? item.stages[0] : undefined;
    return item && stage ? { binding, stage, revision: item.revision } : undefined;
  }

  async #observeCompletion(address: FactoryRunBindingAddress, snapshot: RunStartSnapshot): Promise<void> {
    if (this.#options.rules.supervisor?.observeIdleWithoutTransition === false) return;

    await this.#options.reconcileBinding(snapshot.binding);
    const binding = await this.#options.storage.findActiveRunBinding(address);
    if (!binding || binding.id !== snapshot.binding.id || binding.workItemId !== snapshot.binding.workItemId) return;

    const [item, pendingApprovals] = await Promise.all([
      this.#options.storage.getForProject(binding.orgId, binding.factoryProjectId, binding.workItemId),
      this.#options.storage.listApprovals(binding.orgId, binding.factoryProjectId, ['pending']),
    ]);
    if (
      !item ||
      item.stages.length !== 1 ||
      item.stages[0] !== snapshot.stage ||
      item.revision !== snapshot.revision ||
      pendingApprovals.some(approval => approval.workItemId === item.id)
    ) {
      return;
    }

    const event: FactoryIdleWithoutTransitionEvent = {
      orgId: binding.orgId,
      factoryProjectId: binding.factoryProjectId,
      workItemId: binding.workItemId,
      bindingId: binding.id,
      role: binding.role,
      stage: snapshot.stage,
      revision: snapshot.revision,
      threadId: binding.threadId,
      resourceId: binding.resourceId,
      sessionId: binding.sessionId,
    };
    await Promise.all([
      this.#options.audit.record({
        orgId: event.orgId,
        actorId: `agent:${event.threadId}`,
        actorType: 'agent',
        action: 'factory.run.idle_without_transition',
        targets: [{ type: 'work_item', id: event.workItemId }],
        metadata: {
          bindingId: event.bindingId,
          role: event.role,
          stage: event.stage,
          revision: event.revision,
        },
        factoryProjectId: event.factoryProjectId,
      }),
      ...[...this.#idleListeners].map(listener => listener(event)),
    ]);
  }
}
