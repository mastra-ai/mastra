import { describe, expect, it } from 'vitest';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage/mock';
import { createTestAgent, createTestController } from './test-utils';

describe('AgentController ↔ Mastra registration', () => {
  it('uses its own internal Mastra when standalone', async () => {
    const controller = createTestController({ storage: new InMemoryStore() });
    await controller.init();

    const mastra = controller.getMastra();
    expect(mastra).toBeInstanceOf(Mastra);
  });

  it('configures background tasks on its standalone internal Mastra', async () => {
    const controller = createTestController({
      storage: new InMemoryStore(),
      backgroundTasks: { enabled: true },
    });
    await controller.init();

    expect(controller.getMastra()?.backgroundTaskManager).toBeDefined();
  });

  it('uses the parent Mastra when registered on one', async () => {
    const controller = createTestController({ storage: new InMemoryStore() });

    const mastra = new Mastra({ agentControllers: { code: controller } });

    // Registered before init(): getMastra() resolves to the parent immediately.
    expect(controller.getMastra()).toBe(mastra);
    expect(mastra.getAgentController('code')).toBe(controller);

    // init() must not replace the parent Mastra with a fresh internal one.
    await controller.init();
    expect(controller.getMastra()).toBe(mastra);
  });

  it('hosts multiple independent controllers keyed by id', async () => {
    const code = createTestController({ id: 'code-controller', storage: new InMemoryStore() });
    const support = createTestController({
      id: 'support-controller',
      storage: new InMemoryStore(),
      agent: createTestAgent({ id: 'support-agent', name: 'support-agent' }),
    });

    const mastra = new Mastra({ agentControllers: { code, support } });

    expect(mastra.getAgentController('code')).toBe(code);
    expect(mastra.getAgentController('support')).toBe(support);
    expect(Object.keys(mastra.listAgentControllers())).toEqual(['code', 'support']);

    // getAgentControllerById resolves by the AgentController's own `id` (not the registration key).
    expect(mastra.getAgentControllerById('code-controller')).toBe(code);
    expect(mastra.getAgentControllerById('support-controller')).toBe(support);
    // The registration key is not a valid id lookup, but falls back to a key match.
    expect(mastra.getAgentControllerById('code')).toBe(code);

    // Each controller resolves to the same parent Mastra but stays independent.
    expect(code.getMastra()).toBe(mastra);
    expect(support.getMastra()).toBe(mastra);
    expect(code).not.toBe(support);
  });

  it('registers each controller backing agent on the parent Mastra', async () => {
    const controller = createTestController({ storage: new InMemoryStore() });
    const mastra = new Mastra({ agentControllers: { code: controller } });

    await controller.init();

    // The default mode's agent should be registered on the parent Mastra,
    // reachable by its id, so the parent owns the agent surface.
    const agent = mastra.getAgentById('test-agent');
    expect(agent).toBeDefined();
  });

  it('returns undefined from getAgentController/getAgentControllerById when no controller is registered', () => {
    const mastra = new Mastra({});
    expect(mastra.getAgentController('code')).toBeUndefined();
    expect(mastra.getAgentControllerById('code-controller')).toBeUndefined();
    expect(mastra.listAgentControllers()).toEqual({});
  });

  it('inherits the parent Mastra storage when registered', async () => {
    const parentStore = new InMemoryStore();
    // The controller is given a *different* store in its own config; once
    // registered it must read/write through the parent Mastra's store instead.
    const controller = createTestController({ storage: new InMemoryStore() });
    // Registering the controller wires it to the parent Mastra's storage.
    new Mastra({ agentControllers: { code: controller }, storage: parentStore });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const thread = await session.thread.create();

    // The thread was persisted through the parent Mastra's store, not the
    // controller's own config.storage.
    const memory = await parentStore.getStore('memory');
    const persisted = await memory!.getThreadById({ threadId: thread.id });
    expect(persisted?.id).toBe(thread.id);
  });

  it('falls back to its own storage when standalone', async () => {
    const ownStore = new InMemoryStore();
    const controller = createTestController({ storage: ownStore });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const thread = await session.thread.create();

    const memory = await ownStore.getStore('memory');
    const persisted = await memory!.getThreadById({ threadId: thread.id });
    expect(persisted?.id).toBe(thread.id);
  });

  // Backwards-compatibility: the deprecated `harnesses` config key and
  // `getHarness`/`getHarnessById`/`listHarnesses` accessors must keep resolving
  // to the same AgentController instances as their canonical replacements.
  it('supports the deprecated harnesses config key and getHarness* accessors', () => {
    const controller = createTestController({ id: 'code-controller', storage: new InMemoryStore() });
    const mastra = new Mastra({ harnesses: { code: controller } });

    expect(mastra.getHarness('code')).toBe(controller);
    expect(mastra.getHarness('code')).toBe(mastra.getAgentController('code'));
    expect(mastra.getHarnessById('code-controller')).toBe(controller);
    expect(mastra.listHarnesses()).toEqual(mastra.listAgentControllers());
  });
});
