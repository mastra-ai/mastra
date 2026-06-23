import { describe, expect, it } from 'vitest';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage/mock';
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

  it('inherits the parent Mastra storage when registered', async () => {
    const parentStore = new InMemoryStore();
    // The harness is given a *different* store in its own config; once
    // registered it must read/write through the parent Mastra's store instead.
    const harness = createTestHarness({ storage: new InMemoryStore() });
    // Registering the harness wires it to the parent Mastra's storage.
    new Mastra({ harnesses: { code: harness }, storage: parentStore });

    await harness.init();
    const session = await harness.createSession();
    const thread = await session.thread.create();

    // The thread was persisted through the parent Mastra's store, not the
    // harness's own config.storage.
    const memory = await parentStore.getStore('memory');
    const persisted = await memory!.getThreadById({ threadId: thread.id });
    expect(persisted?.id).toBe(thread.id);
  });

  it('falls back to its own storage when standalone', async () => {
    const ownStore = new InMemoryStore();
    const harness = createTestHarness({ storage: ownStore });

    await harness.init();
    const session = await harness.createSession();
    const thread = await session.thread.create();

    const memory = await ownStore.getStore('memory');
    const persisted = await memory!.getThreadById({ threadId: thread.id });
    expect(persisted?.id).toBe(thread.id);
  });
});
