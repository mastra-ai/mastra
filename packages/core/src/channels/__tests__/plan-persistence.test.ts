import { describe, it, expect, beforeEach } from 'vitest';

import type { StorageThreadType } from '../../memory/types';
import { clearPersistedPlan, loadPersistedPlan, savePersistedPlan } from '../plan-persistence';
import type { PersistedPlan } from '../plan-persistence';

// In-memory stand-in for a Mastra memory store. Only implements the surface
// area the persistence helpers actually call: getThreadById / saveThread.
function createFakeMemoryStore() {
  const threads = new Map<string, StorageThreadType>();
  return {
    threads,
    getThreadById: async ({ threadId }: { threadId: string }) => threads.get(threadId) ?? null,
    saveThread: async ({ thread }: { thread: StorageThreadType }) => {
      threads.set(thread.id, thread);
      return thread;
    },
  };
}

// Mock agent stub returning the fake memory store. The persistence helpers
// access only `agent.getMemory()`, so we can keep this minimal.
function createMockAgent(memory: ReturnType<typeof createFakeMemoryStore>) {
  return { getMemory: async () => memory } as any;
}

function seedThread(memory: ReturnType<typeof createFakeMemoryStore>, id: string, metadata: any = {}) {
  const now = new Date();
  memory.threads.set(id, {
    id,
    resourceId: 'res-1',
    title: 't',
    metadata,
    createdAt: now,
    updatedAt: now,
  } as StorageThreadType);
}

function samplePlan(overrides: Partial<PersistedPlan> = {}): PersistedPlan {
  return {
    planId: 'plan-1',
    status: 'active',
    createdAt: 100,
    initialMessage: 'Working…',
    completeMessage: 'Done',
    toolDisplay: 'inline',
    tasks: [{ id: 'task_1', title: 'first', status: 'pending' }],
    ...overrides,
  };
}

describe('plan-persistence', () => {
  let memory: ReturnType<typeof createFakeMemoryStore>;
  let agent: any;

  beforeEach(() => {
    memory = createFakeMemoryStore();
    agent = createMockAgent(memory);
  });

  describe('loadPersistedPlan', () => {
    it('returns null when the thread does not exist', async () => {
      expect(await loadPersistedPlan(agent, 'missing')).toBeNull();
    });

    it('returns null when the thread has no channelPlan metadata', async () => {
      seedThread(memory, 't1', { other: 'value' });
      expect(await loadPersistedPlan(agent, 't1')).toBeNull();
    });

    it('returns the stored plan when present', async () => {
      const plan = samplePlan();
      seedThread(memory, 't1', { channelPlan: plan });
      const loaded = await loadPersistedPlan(agent, 't1');
      expect(loaded).toEqual(plan);
    });

    it('returns null when the agent has no memory configured', async () => {
      const noMemoryAgent = { getMemory: async () => null } as any;
      expect(await loadPersistedPlan(noMemoryAgent, 't1')).toBeNull();
    });
  });

  describe('savePersistedPlan', () => {
    it('writes the plan into thread metadata, preserving other keys', async () => {
      seedThread(memory, 't1', { pendingToolApprovals: { foo: 'bar' } });
      const plan = samplePlan();
      await savePersistedPlan(agent, 't1', plan);
      const stored = memory.threads.get('t1')!.metadata as any;
      expect(stored.channelPlan).toEqual(plan);
      expect(stored.pendingToolApprovals).toEqual({ foo: 'bar' });
    });

    it('overwrites a previously stored plan on the same thread', async () => {
      seedThread(memory, 't1');
      await savePersistedPlan(agent, 't1', samplePlan({ planId: 'plan-a' }));
      await savePersistedPlan(agent, 't1', samplePlan({ planId: 'plan-b' }));
      const stored = memory.threads.get('t1')!.metadata as any;
      expect(stored.channelPlan.planId).toBe('plan-b');
    });

    it('silently no-ops when the thread does not exist', async () => {
      await expect(savePersistedPlan(agent, 'missing', samplePlan())).resolves.toBeUndefined();
    });
  });

  describe('clearPersistedPlan', () => {
    it('removes the channelPlan key while preserving other metadata', async () => {
      seedThread(memory, 't1', { channelPlan: samplePlan(), other: 'keep' });
      await clearPersistedPlan(agent, 't1');
      const stored = memory.threads.get('t1')!.metadata as any;
      expect(stored.channelPlan).toBeUndefined();
      expect(stored.other).toBe('keep');
    });

    it('is a no-op when no plan is stored', async () => {
      seedThread(memory, 't1', { other: 'keep' });
      await clearPersistedPlan(agent, 't1');
      const stored = memory.threads.get('t1')!.metadata as any;
      expect(stored.other).toBe('keep');
    });

    it('round-trips: save then load then clear', async () => {
      seedThread(memory, 't1');
      const plan = samplePlan();
      await savePersistedPlan(agent, 't1', plan);
      expect(await loadPersistedPlan(agent, 't1')).toEqual(plan);
      await clearPersistedPlan(agent, 't1');
      expect(await loadPersistedPlan(agent, 't1')).toBeNull();
    });
  });
});
