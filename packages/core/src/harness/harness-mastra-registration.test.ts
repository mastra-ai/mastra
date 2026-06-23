import { describe, expect, it } from 'vitest';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import { createTestAgent, createTestHarness } from './test-utils';

describe('Harness ↔ Mastra registration', () => {
  it('uses its own internal Mastra when standalone', async () => {
    const harness = createTestHarness({ storage: new InMemoryStore() });
    await harness.init();

    const mastra = harness.getMastra();
    expect(mastra).toBeInstanceOf(Mastra);
  });

  it('uses the parent Mastra when registered on one', async () => {
    const harness = createTestHarness({ storage: new InMemoryStore() });

    const mastra = new Mastra({ harnesses: { code: harness } });

    // Registered before init(): getMastra() resolves to the parent immediately.
    expect(harness.getMastra()).toBe(mastra);
    expect(mastra.getHarness('code')).toBe(harness);

    // init() must not replace the parent Mastra with a fresh internal one.
    await harness.init();
    expect(harness.getMastra()).toBe(mastra);
  });

  it('hosts multiple independent harnesses keyed by id', async () => {
    const code = createTestHarness({ id: 'code-harness', storage: new InMemoryStore() });
    const support = createTestHarness({
      id: 'support-harness',
      storage: new InMemoryStore(),
      agent: createTestAgent({ id: 'support-agent', name: 'support-agent' }),
    });

    const mastra = new Mastra({ harnesses: { code, support } });

    expect(mastra.getHarness('code')).toBe(code);
    expect(mastra.getHarness('support')).toBe(support);
    expect(Object.keys(mastra.listHarnesses())).toEqual(['code', 'support']);

    // Each harness resolves to the same parent Mastra but stays independent.
    expect(code.getMastra()).toBe(mastra);
    expect(support.getMastra()).toBe(mastra);
    expect(code).not.toBe(support);
  });

  it('registers each harness backing agent on the parent Mastra', async () => {
    const harness = createTestHarness({ storage: new InMemoryStore() });
    const mastra = new Mastra({ harnesses: { code: harness } });

    await harness.init();

    // The default mode's agent should be registered on the parent Mastra,
    // reachable by its id, so the parent owns the agent surface.
    const agent = mastra.getAgentById('test-agent');
    expect(agent).toBeDefined();
  });

  it('returns undefined from getHarness when no harness is registered', () => {
    const mastra = new Mastra({});
    expect(mastra.getHarness('code')).toBeUndefined();
    expect(mastra.listHarnesses()).toEqual({});
  });

  describe('storage inheritance', () => {
    /** Build a storage-less Harness (no `config.storage`). */
    function storagelessHarness(id = 'code') {
      return new Harness({
        id,
        modes: [{ id: 'default', name: 'Default', default: true, agent: createTestAgent() }],
      });
    }

    it('inherits the parent Mastra storage when it has none of its own', async () => {
      const storage = new InMemoryStore();
      const harness = storagelessHarness();
      // The server owns durability; the harness has no storage of its own.
      new Mastra({ harnesses: { code: harness }, storage });

      await harness.init();
      const session = await harness.createSession({ resourceId: 'project-a' });
      const thread = await session.thread.create();

      // The thread must round-trip through the *parent's* storage, not a
      // throwaway in-memory store: a fresh harness on the same Mastra sees it.
      const sibling = storagelessHarness('code-2');
      new Mastra({ harnesses: { 'code-2': sibling }, storage });
      await sibling.init();
      const siblingSession = await sibling.createSession({ resourceId: 'project-a' });
      const threads = await siblingSession.thread.list();

      expect(threads.map(t => t.id)).toContain(thread.id);
    });

    it('prefers an explicit config.storage over the parent Mastra storage', async () => {
      const ownStorage = new InMemoryStore();
      const parentStorage = new InMemoryStore();
      const harness = createTestHarness({ storage: ownStorage });
      new Mastra({ harnesses: { code: harness }, storage: parentStorage });

      await harness.init();
      const session = await harness.createSession({ resourceId: 'project-b' });
      const thread = await session.thread.create();

      // The thread lives in the harness's own storage, so a sibling backed by
      // the *parent* storage must not see it.
      const sibling = createTestHarness({ id: 'code-2', storage: parentStorage });
      await sibling.init();
      const siblingSession = await sibling.createSession({ resourceId: 'project-b' });
      const threads = await siblingSession.thread.list();

      expect(threads.map(t => t.id)).not.toContain(thread.id);
    });

    it('persists nothing when standalone with no storage at all', async () => {
      const harness = storagelessHarness();
      await harness.init();
      const session = await harness.createSession({ resourceId: 'project-c' });
      await session.thread.create();

      // No storage anywhere → list returns empty (in-memory thread binding only).
      const threads = await session.thread.list();
      expect(threads).toEqual([]);
    });
  });
});
