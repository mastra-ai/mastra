import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import type { Session } from './session';
import { createMockWorkspace } from './test-utils';

function createController(storage: InMemoryStore) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
}

async function seedObservationalMemory(
  storage: InMemoryStore,
  threadId: string,
  resourceId: string,
  observations: string,
) {
  const memoryStorage = (await storage.getStore('memory'))!;
  const record = await memoryStorage.initializeObservationalMemory({
    threadId,
    resourceId,
    scope: 'thread',
    config: {},
  });
  if (observations) {
    await memoryStorage.updateActiveObservations({
      id: record.id,
      observations,
      tokenCount: observations.length,
      lastObservedAt: new Date(),
    });
  }
  return record;
}

describe('AgentController.getObservationalMemoryRecord', () => {
  let storage: InMemoryStore;
  let controller: ReturnType<typeof createController>;
  let session: Session;

  beforeEach(async () => {
    storage = new InMemoryStore();
    controller = createController(storage);
    await controller.init();
    session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  });

  it('returns null when no thread is selected', async () => {
    session.thread.clear();
    const record = await controller.getObservationalMemoryRecord(session);
    expect(record).toBeNull();
  });

  it('returns null when no OM record exists for the thread', async () => {
    await session.thread.create();
    const record = await controller.getObservationalMemoryRecord(session);
    expect(record).toBeNull();
  });

  it('returns the OM record with activeObservations when one exists', async () => {
    const thread = await session.thread.create();
    const resourceId = session.identity.getResourceId();
    const observationText = '- User prefers dark mode\n- User is building a web UI';

    await seedObservationalMemory(storage, thread.id, resourceId, observationText);

    const record = await controller.getObservationalMemoryRecord(session);
    expect(record).not.toBeNull();
    expect(record!.activeObservations).toBe(observationText);
    expect(record!.threadId).toBe(thread.id);
    expect(record!.resourceId).toBe(resourceId);
    expect(record!.generationCount).toBe(0);
  });

  it('returns record for the current thread after switching threads', async () => {
    const threadA = await session.thread.create();
    const threadB = await session.thread.create();
    const resourceId = session.identity.getResourceId();

    await seedObservationalMemory(storage, threadA.id, resourceId, 'Thread A observations');
    await seedObservationalMemory(storage, threadB.id, resourceId, 'Thread B observations');

    // Currently on thread B
    let record = await controller.getObservationalMemoryRecord(session);
    expect(record).not.toBeNull();
    expect(record!.activeObservations).toBe('Thread B observations');

    // Switch to thread A
    await session.thread.switch({ threadId: threadA.id });
    record = await controller.getObservationalMemoryRecord(session);
    expect(record).not.toBeNull();
    expect(record!.activeObservations).toBe('Thread A observations');
  });
});
