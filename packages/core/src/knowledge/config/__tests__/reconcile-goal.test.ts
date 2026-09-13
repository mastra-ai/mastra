import { describe, expect, it, vi } from 'vitest';

import type { KnowledgeStructureReconcileResult } from '../../../storage/domains/knowledge';
import {
  runKnowledgeReconcileGoal,
  type KnowledgeReconcileGoalState,
  type KnowledgeReconcileGoalStore,
} from '../reconcile-goal';

function memoryStore() {
  const states = new Map<string, KnowledgeReconcileGoalState>();
  const store: KnowledgeReconcileGoalStore = {
    load: async key => structuredClone(states.get(key)),
    save: async (key, state) => {
      states.set(key, structuredClone(state));
    },
  };
  return { states, store };
}

const result: KnowledgeStructureReconcileResult = {
  scopes: { 'org:acme': 'scope-acme' },
  createdScopeIds: ['scope-acme'],
  changed: true,
  accessEpoch: 1,
};

describe('Knowledge reconcile goal', () => {
  it('persists the plan before apply, retries one failure, and records checkpoint progression', async () => {
    const { states, store } = memoryStore();
    const compile = vi.fn(async () => ({ scopes: [{ address: 'org:acme', name: 'Acme' }] }));
    const apply = vi
      .fn<(plan: { scopes: Array<{ address: string; name: string }> }) => Promise<KnowledgeStructureReconcileResult>>()
      .mockRejectedValueOnce(new Error('injected apply failure'))
      .mockImplementationOnce(async () => {
        expect(states.get('goal')?.plan).toEqual({ scopes: [{ address: 'org:acme', name: 'Acme' }] });
        return result;
      });

    const completed = await runKnowledgeReconcileGoal({
      key: 'goal',
      descriptionHash: 'hash',
      store,
      compile,
      apply,
      inspectScope: async () => null,
      judge: async state => state.result?.scopes['org:acme'] === 'scope-acme',
    });

    expect(apply).toHaveBeenCalledTimes(2);
    expect(completed.state).toMatchObject({ checkpoint: 'complete', attempts: 2, judgePassed: true });
    expect(completed.state.progression).toEqual(['compiled', 'applying', 'applied', 'judging', 'complete']);
  });

  it('resumes a persisted applying checkpoint without recompiling', async () => {
    const { states, store } = memoryStore();
    states.set('goal', {
      version: 1,
      descriptionHash: 'hash',
      plan: { scopes: [{ address: 'org:acme', name: 'Acme' }] },
      checkpoint: 'applying',
      progression: ['compiled', 'applying'],
      attempts: 1,
      preExistingScopes: {},
      lastError: 'process stopped',
    });
    const compile = vi.fn();

    const completed = await runKnowledgeReconcileGoal({
      key: 'goal',
      descriptionHash: 'hash',
      store,
      compile,
      apply: async () => result,
      inspectScope: async () => null,
      judge: async () => true,
    });

    expect(compile).not.toHaveBeenCalled();
    expect(completed.state).toMatchObject({ checkpoint: 'complete', attempts: 2 });
  });

  it('never reapplies declarations that existed before compilation', async () => {
    const { store } = memoryStore();
    const apply = vi.fn(async () => ({ ...result, scopes: {} }));

    const completed = await runKnowledgeReconcileGoal({
      key: 'goal',
      descriptionHash: 'hash',
      store,
      compile: async () => ({ scopes: [{ address: 'org:acme', name: 'Changed' }] }),
      apply,
      inspectScope: async () => ({ id: 'scope-acme', deleted: false }),
      judge: async () => true,
    });

    expect(apply).toHaveBeenCalledWith({ scopes: [] });
    expect(completed.result.scopes).toEqual({ 'org:acme': 'scope-acme' });
  });

  it('fails closed when the persisted retry budget is exhausted', async () => {
    const { states, store } = memoryStore();
    states.set('goal', {
      version: 1,
      descriptionHash: 'hash',
      plan: { scopes: [{ address: 'org:acme', name: 'Acme' }] },
      checkpoint: 'applying',
      progression: ['compiled', 'applying'],
      attempts: 2,
      preExistingScopes: {},
      lastError: 'persistent failure',
    });
    const apply = vi.fn();

    await expect(
      runKnowledgeReconcileGoal({
        key: 'goal',
        descriptionHash: 'hash',
        store,
        compile: vi.fn(),
        apply,
        inspectScope: async () => null,
      }),
    ).rejects.toThrow('exhausted its retry budget: persistent failure');
    expect(apply).not.toHaveBeenCalled();
  });

  it('fails closed when the graph-state judge rejects the applied plan', async () => {
    const { states, store } = memoryStore();

    await expect(
      runKnowledgeReconcileGoal({
        key: 'goal',
        descriptionHash: 'hash',
        store,
        compile: async () => ({ scopes: [{ address: 'org:acme', name: 'Acme' }] }),
        apply: async () => result,
        inspectScope: async () => null,
        judge: async () => false,
      }),
    ).rejects.toThrow('graph-state judge rejected');
    expect(states.get('goal')).toMatchObject({ checkpoint: 'applied', judgePassed: false });
  });

  it('returns a completed goal idempotently without applying it again', async () => {
    const { store } = memoryStore();
    const apply = vi.fn(async () => result);
    const input = {
      key: 'goal',
      descriptionHash: 'hash',
      store,
      compile: async () => ({ scopes: [{ address: 'org:acme', name: 'Acme' }] }),
      apply,
      inspectScope: async () => null,
      judge: async () => true,
    };

    await runKnowledgeReconcileGoal(input);
    await runKnowledgeReconcileGoal(input);
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
