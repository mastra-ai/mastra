import type { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import type { FactoryRunBindingRecord } from '../storage/domains/work-items/base.js';
import { FactoryCurationService } from './service.js';

function binding(overrides: Partial<FactoryRunBindingRecord> = {}): FactoryRunBindingRecord {
  return {
    id: 'binding-1',
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    workItemId: 'item-1',
    role: 'work',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    sessionId: 'session-1',
    branch: 'factory/item-1',
    status: 'active',
    createdAt: new Date('2026-08-28T00:00:00Z'),
    revokedAt: null,
    ...overrides,
  };
}

function harness(bindings: FactoryRunBindingRecord[]) {
  const runCuration = vi.fn(async () => ({ outcome: 'ran' as const }));
  const getMemory = vi.fn(async (_input: { requestContext: RequestContext }) => ({ runCuration }));
  const storage = {
    listActiveRunBindings: vi.fn(async () => bindings),
    listRunBindings: vi.fn(async () => bindings),
  };
  const sourceControlStorage = {
    sessions: {
      getBySessionId: vi.fn(async () => ({ userId: 'user-1', orgId: 'org-1' })),
    },
  };
  const service = new FactoryCurationService({
    agent: { getMemory } as never,
    controller: { id: 'code' } as never,
    storage: storage as never,
    sourceControlStorage: sourceControlStorage as never,
    intervalMs: 10,
  });
  return { service, storage, sourceControlStorage, getMemory, runCuration };
}

describe('FactoryCurationService', () => {
  it('runs curation for each unique active lane during a periodic sweep', async () => {
    const first = binding();
    const { service, getMemory, runCuration } = harness([
      first,
      { ...first, id: 'duplicate' },
      binding({ id: 'binding-2', threadId: 'thread-2' }),
    ]);

    await service.sweep();

    expect(runCuration).toHaveBeenCalledTimes(2);
    const requestContext = getMemory.mock.calls[0]?.[0]?.requestContext;
    expect(requestContext.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
    expect(requestContext.get('controller')).toMatchObject({
      state: { factoryOrgId: 'org-1', factoryProjectId: 'project-1' },
    });
    expect(runCuration).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        scope: ['org:org-1', 'resource:project-1', 'thread:thread-1'],
      }),
    );
  });

  it('curates active work-item bindings with the card-transition prompt', async () => {
    const active = binding();
    const revoked = binding({ id: 'binding-2', threadId: 'thread-2', status: 'revoked', revokedAt: new Date() });
    const { service, storage, runCuration } = harness([active, revoked]);

    await service.curateWorkItem({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItemId: 'item-1',
      prompt: 'Factory card moved from planning to execute.',
    });

    expect(storage.listRunBindings).toHaveBeenCalledWith('org-1', 'project-1', 'item-1');
    expect(runCuration).toHaveBeenCalledTimes(1);
    expect(runCuration).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Factory card moved from planning to execute.' }),
    );
  });

  it('uses the transition binding snapshot even after terminal cleanup revokes storage rows', async () => {
    const activeAtCommit = binding();
    const { service, storage, runCuration } = harness([binding({ status: 'revoked', revokedAt: new Date() })]);

    await service.curateWorkItem({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItemId: 'item-1',
      bindings: [activeAtCommit],
    });

    expect(storage.listRunBindings).not.toHaveBeenCalled();
    expect(runCuration).toHaveBeenCalledOnce();
  });

  it('runs an immediate sweep when started', async () => {
    const { service, storage } = harness([binding()]);

    await service.start();
    await vi.waitFor(() => expect(storage.listActiveRunBindings).toHaveBeenCalledOnce());
    await service.stop();

    expect(service.isRunning).toBe(false);
  });

  it('refuses bindings whose persisted session authority does not match', async () => {
    const { service, sourceControlStorage, runCuration } = harness([binding()]);
    sourceControlStorage.sessions.getBySessionId.mockResolvedValueOnce({ userId: 'user-1', orgId: 'wrong-org' });

    await service.sweep();

    expect(runCuration).not.toHaveBeenCalled();
  });

  it('coalesces overlapping sweeps', async () => {
    const { service, storage } = harness([binding()]);
    await Promise.all([service.sweep(), service.sweep()]);
    expect(storage.listActiveRunBindings).toHaveBeenCalledTimes(1);
  });

  it('releases the sweep slot when a curator never settles', async () => {
    vi.useFakeTimers();
    const never = new Promise<never>(() => {});
    const storage = {
      listActiveRunBindings: vi.fn(async () => [binding()]),
      listRunBindings: vi.fn(async () => [binding()]),
    };
    const service = new FactoryCurationService({
      agent: { getMemory: vi.fn(async () => ({ runCuration: vi.fn(() => never) })) } as never,
      controller: { id: 'code' } as never,
      storage: storage as never,
      sourceControlStorage: {
        sessions: { getBySessionId: vi.fn(async () => ({ userId: 'user-1', orgId: 'org-1' })) },
      } as never,
      bindingTimeoutMs: 10,
    });

    try {
      const first = service.sweep();
      await vi.advanceTimersByTimeAsync(10);
      await first;
      const second = service.sweep();
      await vi.advanceTimersByTimeAsync(10);
      await second;
      expect(storage.listActiveRunBindings).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    [binding({ id: 'binding-a', sessionId: 'session-a' }), binding({ id: 'binding-b', sessionId: 'session-b' })],
    [binding({ id: 'binding-b', sessionId: 'session-b' }), binding({ id: 'binding-a', sessionId: 'session-a' })],
  ])('fails closed for conflicting session authorities regardless of storage order', async (...bindings) => {
    const { service, sourceControlStorage, runCuration } = harness(bindings);

    await service.sweep();

    expect(sourceControlStorage.sessions.getBySessionId).not.toHaveBeenCalled();
    expect(runCuration).not.toHaveBeenCalled();
  });

  it('aborts queued curation work during shutdown before another external call starts', async () => {
    vi.useFakeTimers();
    const runCuration = vi.fn(async () => ({ outcome: 'ran' as const }));
    let resolveMemory!: (memory: { runCuration: typeof runCuration }) => void;
    const getMemory = vi.fn(
      () =>
        new Promise<{ runCuration: typeof runCuration }>(resolve => {
          resolveMemory = resolve;
        }),
    );
    const guardedService = new FactoryCurationService({
      agent: { getMemory } as never,
      controller: { id: 'code' } as never,
      storage: {
        listActiveRunBindings: vi.fn(async () => [binding()]),
        listRunBindings: vi.fn(async () => [binding()]),
      } as never,
      sourceControlStorage: {
        sessions: { getBySessionId: vi.fn(async () => ({ userId: 'user-1', orgId: 'org-1' })) },
      } as never,
      bindingTimeoutMs: 10,
    });

    try {
      const curation = guardedService.curateWorkItem({
        orgId: 'org-1',
        factoryProjectId: 'project-1',
        workItemId: 'item-1',
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(getMemory).toHaveBeenCalledOnce();
      const stopping = guardedService.stop();
      await vi.advanceTimersByTimeAsync(10);
      await stopping;
      resolveMemory({ runCuration });
      await curation;
      await Promise.resolve();

      expect(runCuration).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits only to the binding bound when shutdown finds curation already running', async () => {
    vi.useFakeTimers();
    const never = new Promise<never>(() => {});
    const runCuration = vi.fn(() => never);
    const service = new FactoryCurationService({
      agent: { getMemory: vi.fn(async () => ({ runCuration })) } as never,
      controller: { id: 'code' } as never,
      storage: {
        listActiveRunBindings: vi.fn(async () => [binding()]),
        listRunBindings: vi.fn(async () => [binding()]),
      } as never,
      sourceControlStorage: {
        sessions: { getBySessionId: vi.fn(async () => ({ userId: 'user-1', orgId: 'org-1' })) },
      } as never,
      bindingTimeoutMs: 10,
      operationTimeoutMs: 20,
    });

    try {
      const curation = service.curateWorkItem({
        orgId: 'org-1',
        factoryProjectId: 'project-1',
        workItemId: 'item-1',
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(runCuration).toHaveBeenCalledOnce();
      const stopping = service.stop();
      await vi.advanceTimersByTimeAsync(9);
      let stopped = false;
      void stopping.then(() => {
        stopped = true;
      });
      await Promise.resolve();
      expect(stopped).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await stopping;
      await curation;
    } finally {
      vi.useRealTimers();
    }
  });

  it('bounds a hanging binding-list operation before authority lookup', async () => {
    vi.useFakeTimers();
    const never = new Promise<never>(() => {});
    const getBySessionId = vi.fn();
    const getMemory = vi.fn();
    const service = new FactoryCurationService({
      agent: { getMemory } as never,
      controller: { id: 'code' } as never,
      storage: {
        listActiveRunBindings: vi.fn(() => never),
        listRunBindings: vi.fn(() => never),
      } as never,
      sourceControlStorage: { sessions: { getBySessionId } } as never,
      operationTimeoutMs: 10,
    });

    try {
      const sweep = service.sweep();
      const rejection = expect(sweep).rejects.toThrow('Factory curation operation timed out.');
      await vi.advanceTimersByTimeAsync(10);
      await rejection;
      expect(getBySessionId).not.toHaveBeenCalled();
      expect(getMemory).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects transition-driven curation after shutdown', async () => {
    const { service, storage, runCuration } = harness([binding()]);

    await service.stop();
    await service.curateWorkItem({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItemId: 'item-1',
    });

    expect(storage.listRunBindings).not.toHaveBeenCalled();
    expect(runCuration).not.toHaveBeenCalled();
  });
});
