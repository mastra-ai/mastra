import { describe, expect, it, vi } from 'vitest';

import { MockMemory } from '../memory/mock';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

/**
 * Thread rows belong to controller storage even when the configured memory
 * resolves per caller to a different store: settings, titles and clone
 * bookkeeping are read back from controller rows, so a row written only into a
 * caller's memory reads back as missing.
 */
describe('session settings with a dynamic memory over another store', () => {
  it('round-trips a setting when caller memory uses a different store', async () => {
    const controllerStorage = new InMemoryStore();
    const callerStorage = new InMemoryStore();
    const callerMemory = new MockMemory({ storage: callerStorage } as any);
    const memoryFactory = vi.fn().mockResolvedValue(callerMemory);

    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'two-store-controller',
      resourceId: 'controller-resource',
      storage: controllerStorage,
      memory: memoryFactory as any,
      modes: [{ id: 'build', defaultModelId: 'test-model' }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'two-store-session', ownerId: 'owner-1' });

    const threadId = await session.thread.ensureId();
    await session.thread.setSetting({ key: 'probeKey', value: 'written' });

    await expect(session.thread.getSetting({ key: 'probeKey' })).resolves.toBe('written');

    const controllerStore = await controllerStorage.getStore('memory');
    const controllerRow = await controllerStore!.getThreadById({ threadId });
    expect(controllerRow?.metadata).toMatchObject({ probeKey: 'written' });

    const callerStore = await callerStorage.getStore('memory');
    await expect(callerStore!.getThreadById({ threadId })).resolves.toBeNull();
  });
});
