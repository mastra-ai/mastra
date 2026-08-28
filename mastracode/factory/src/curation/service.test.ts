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
  const getMemory = vi.fn(async () => ({ runCuration }));
  const session = {
    state: {
      get: () => ({ factoryOrgId: 'org-1', factoryProjectId: 'project-1' }),
      set: vi.fn(),
    },
  };
  const createSession = vi.fn(async () => session);
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
    controller: { id: 'code', createSession } as never,
    storage: storage as never,
    sourceControlStorage: sourceControlStorage as never,
    intervalMs: 10,
  });
  return { service, storage, sourceControlStorage, createSession, getMemory, runCuration };
}

describe('FactoryCurationService', () => {
  it('runs curation for each unique active lane during a periodic sweep', async () => {
    const first = binding();
    const { service, runCuration } = harness([
      first,
      { ...first, id: 'duplicate' },
      binding({ id: 'binding-2', threadId: 'thread-2' }),
    ]);

    await service.sweep();

    expect(runCuration).toHaveBeenCalledTimes(2);
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

  it('coalesces overlapping sweeps', async () => {
    const { service, storage } = harness([binding()]);
    await Promise.all([service.sweep(), service.sweep()]);
    expect(storage.listActiveRunBindings).toHaveBeenCalledTimes(1);
  });
});
