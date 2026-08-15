import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  it('restores OM progress from the durable record without scanning messages', async () => {
    const threadA = await session.thread.create();
    const threadB = await session.thread.create();
    const resourceId = session.identity.getResourceId();
    const memoryStorage = (await storage.getStore('memory'))!;
    const record = await memoryStorage.initializeObservationalMemory({
      threadId: threadA.id,
      resourceId,
      scope: 'thread',
      config: {
        observation: { messageTokens: 12_000 },
        reflection: { observationTokens: 24_000 },
      },
    });
    Object.assign(record, {
      pendingMessageTokens: 6_000,
      observationTokenCount: 8_000,
      generationCount: 3,
      isBufferingObservation: true,
      isBufferingReflection: false,
      bufferedObservationChunks: [
        {
          id: 'chunk-1',
          cycleId: 'cycle-1',
          observations: 'Buffered observation',
          tokenCount: 500,
          messageIds: ['message-1'],
          messageTokens: 1_500,
          lastObservedAt: new Date(),
          createdAt: new Date(),
        },
      ],
      bufferedReflection: 'Buffered reflection',
      bufferedReflectionInputTokens: 700,
      bufferedReflectionTokens: 350,
    });
    const listMessagesSpy = vi.spyOn(memoryStorage, 'listMessages');
    const events: any[] = [];
    session.subscribe(event => events.push(event));

    await session.thread.switch({ threadId: threadA.id });
    await controller.loadOMProgress(session);

    expect(listMessagesSpy).not.toHaveBeenCalled();
    expect(events.find(event => event.type === 'om_status')).toMatchObject({
      windows: {
        active: {
          messages: { tokens: 6_000, threshold: 12_000 },
          observations: { tokens: 8_000, threshold: 24_000 },
        },
        buffered: {
          observations: {
            status: 'running',
            chunks: 1,
            messageTokens: 1_500,
            observationTokens: 500,
          },
          reflection: {
            status: 'complete',
            inputObservationTokens: 700,
            observationTokens: 350,
          },
        },
      },
      generationCount: 3,
      stepNumber: 0,
    });

    await session.thread.switch({ threadId: threadB.id });
  });
});
