import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';

import type { FactoryRunBindingRecord, WorkItemsStorage } from '../storage/domains/work-items/base';
import { defaultFactoryRules } from './defaults';
import { FactoryRunLifecycleObserver } from './run-lifecycle-observer';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const address = {
  orgId: 'org-1',
  factoryProjectId: PROJECT_ID,
  threadId: 'thread-1',
  resourceId: 'resource-1',
  sessionId: 'session-1',
};
const binding: FactoryRunBindingRecord = {
  id: 'binding-1',
  orgId: address.orgId,
  factoryProjectId: address.factoryProjectId,
  workItemId: 'item-1',
  role: 'work',
  threadId: address.threadId,
  resourceId: address.resourceId,
  sessionId: address.sessionId,
  branch: 'factory/issue-1',
  status: 'active',
  createdAt: new Date('2026-07-22T15:00:00Z'),
  revokedAt: null,
};

function makeSession() {
  const listeners = new Set<(event: AgentControllerEvent) => void>();
  return {
    session: {
      subscribe: vi.fn((listener: (event: AgentControllerEvent) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
    },
    emit(event: AgentControllerEvent) {
      for (const listener of listeners) listener(event);
    },
  };
}

function makeObserver(
  options: {
    enabled?: boolean;
    itemAfterReconcile?: { stages: string[]; revision: number } | null;
    approvals?: Array<{ workItemId: string }>;
    bindingAfterReconcile?: FactoryRunBindingRecord | null;
  } = {},
) {
  const startItem = { id: 'item-1', stages: ['planning'], revision: 4 };
  const itemAfterReconcile = options.itemAfterReconcile === undefined ? startItem : options.itemAfterReconcile;
  let itemReads = 0;
  const storage = {
    findActiveRunBinding: vi
      .fn()
      .mockResolvedValueOnce(binding)
      .mockResolvedValue(options.bindingAfterReconcile === undefined ? binding : options.bindingAfterReconcile),
    getForProject: vi.fn(async () => {
      itemReads += 1;
      return itemReads === 1 ? startItem : itemAfterReconcile;
    }),
    listApprovals: vi.fn(async () => options.approvals ?? []),
  } as unknown as WorkItemsStorage;
  const reconcileBinding = vi.fn(async () => {});
  const onIdleWithoutTransition = vi.fn(async () => {});
  const audit = { record: vi.fn(async () => ({ id: 'audit-1' })) };
  const observer = new FactoryRunLifecycleObserver({
    storage,
    audit: audit as never,
    rules: defaultFactoryRules({
      version: 'idle-observer-v1',
      ...(options.enabled === undefined
        ? {}
        : { overrides: { supervisor: { observeIdleWithoutTransition: options.enabled } } }),
    }),
    reconcileBinding,
    onIdleWithoutTransition,
  });
  return { observer, storage, audit, reconcileBinding, onIdleWithoutTransition };
}

async function completeRun(observer: FactoryRunLifecycleObserver, session: ReturnType<typeof makeSession>) {
  session.emit({ type: 'agent_start' });
  session.emit({ type: 'agent_end', reason: 'complete' });
  await observer.waitForSettled(session.session);
}

describe('FactoryRunLifecycleObserver', () => {
  it('emits one bounded idle event after final reconciliation with the default-on setting', async () => {
    const setup = makeObserver();
    const session = makeSession();
    setup.observer.observe(session.session, address);
    setup.observer.observe(session.session, address);

    await completeRun(setup.observer, session);

    expect(session.session.subscribe).toHaveBeenCalledTimes(1);
    expect(setup.reconcileBinding).toHaveBeenCalledWith(binding);
    expect(setup.audit.record).toHaveBeenCalledWith({
      orgId: 'org-1',
      actorId: 'agent:thread-1',
      actorType: 'agent',
      action: 'factory.run.idle_without_transition',
      targets: [{ type: 'work_item', id: 'item-1' }],
      metadata: { bindingId: 'binding-1', role: 'work', stage: 'planning', revision: 4 },
      factoryProjectId: PROJECT_ID,
    });
    expect(setup.onIdleWithoutTransition).toHaveBeenCalledOnce();
    expect(setup.onIdleWithoutTransition).toHaveBeenCalledWith({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: 'item-1',
      bindingId: 'binding-1',
      role: 'work',
      stage: 'planning',
      revision: 4,
      threadId: 'thread-1',
      resourceId: 'resource-1',
      sessionId: 'session-1',
    });
    expect(setup.storage.findActiveRunBinding).toHaveBeenCalledWith(address);
  });

  it('exposes a live subscription seam for the supervisor notification service', async () => {
    const setup = makeObserver();
    const session = makeSession();
    const supervisorListener = vi.fn(async () => {});
    const unsubscribe = setup.observer.subscribeIdle(supervisorListener);
    setup.observer.observe(session.session, address);

    await completeRun(setup.observer, session);
    expect(supervisorListener).toHaveBeenCalledOnce();

    unsubscribe();
    await completeRun(setup.observer, session);
    expect(supervisorListener).toHaveBeenCalledOnce();
  });

  it('emits once for each qualifying agent_end without a persisted completion identity', async () => {
    const setup = makeObserver();
    const session = makeSession();
    setup.observer.observe(session.session, address);

    await completeRun(setup.observer, session);
    await completeRun(setup.observer, session);

    expect(setup.audit.record).toHaveBeenCalledTimes(2);
    expect(setup.onIdleWithoutTransition).toHaveBeenCalledTimes(2);
  });

  it('emits when observation is explicitly enabled and suppresses an explicit opt-out', async () => {
    const enabled = makeObserver({ enabled: true });
    const enabledSession = makeSession();
    enabled.observer.observe(enabledSession.session, address);
    await completeRun(enabled.observer, enabledSession);
    expect(enabled.onIdleWithoutTransition).toHaveBeenCalledOnce();

    const disabled = makeObserver({ enabled: false });
    const disabledSession = makeSession();
    disabled.observer.observe(disabledSession.session, address);
    await completeRun(disabled.observer, disabledSession);
    expect(disabled.reconcileBinding).not.toHaveBeenCalled();
    expect(disabled.audit.record).not.toHaveBeenCalled();
    expect(disabled.onIdleWithoutTransition).not.toHaveBeenCalled();
  });

  it.each(['aborted', 'error', 'suspended'] as const)('ignores an agent_end with reason %s', async reason => {
    const setup = makeObserver();
    const session = makeSession();
    setup.observer.observe(session.session, address);
    session.emit({ type: 'agent_start' });
    session.emit({ type: 'agent_end', reason });
    await setup.observer.waitForSettled(session.session);
    expect(setup.reconcileBinding).not.toHaveBeenCalled();
    expect(setup.onIdleWithoutTransition).not.toHaveBeenCalled();
  });

  it('suppresses runs whose stage or revision changed during final reconciliation', async () => {
    const setup = makeObserver({ itemAfterReconcile: { stages: ['execute'], revision: 5 } });
    const session = makeSession();
    setup.observer.observe(session.session, address);
    await completeRun(setup.observer, session);
    expect(setup.reconcileBinding).toHaveBeenCalledOnce();
    expect(setup.onIdleWithoutTransition).not.toHaveBeenCalled();
  });

  it('suppresses runs with a pending transition approval for the bound item', async () => {
    const setup = makeObserver({ approvals: [{ workItemId: 'item-1' }] });
    const session = makeSession();
    setup.observer.observe(session.session, address);
    await completeRun(setup.observer, session);
    expect(setup.audit.record).not.toHaveBeenCalled();
    expect(setup.onIdleWithoutTransition).not.toHaveBeenCalled();
  });

  it('does not let another item or tenant-scoped binding suppress the observed worker', async () => {
    const setup = makeObserver({ approvals: [{ workItemId: 'item-2' }] });
    const session = makeSession();
    setup.observer.observe(session.session, address);
    await completeRun(setup.observer, session);
    expect(setup.storage.listApprovals).toHaveBeenCalledWith('org-1', PROJECT_ID, ['pending']);
    expect(setup.onIdleWithoutTransition).toHaveBeenCalledOnce();
  });

  it('suppresses completion when the exact tenant-scoped binding is no longer active', async () => {
    const setup = makeObserver({ bindingAfterReconcile: null });
    const session = makeSession();
    setup.observer.observe(session.session, address);
    await completeRun(setup.observer, session);
    expect(setup.storage.findActiveRunBinding).toHaveBeenNthCalledWith(1, address);
    expect(setup.storage.findActiveRunBinding).toHaveBeenNthCalledWith(2, address);
    expect(setup.onIdleWithoutTransition).not.toHaveBeenCalled();
  });
});
