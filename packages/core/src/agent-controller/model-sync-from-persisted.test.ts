import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import type { Session } from './session';
import { createMockWorkspace } from './test-utils';

type AgentControllerTestState = { currentModelId?: string };

const agent = () =>
  new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

async function buildController(
  storage: InMemoryStore,
  sessionId = 'test-session',
): Promise<{ controller: AgentController<AgentControllerTestState>; session: Session<AgentControllerTestState> }> {
  const controller = new AgentController<AgentControllerTestState>({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    stateSchema: undefined,
    modes: [
      {
        id: 'build',
        name: 'Build',
        default: true,
        defaultModelId: 'openai/gpt-5.5',
        agent: agent(),
      },
      {
        id: 'plan',
        name: 'Plan',
        defaultModelId: 'openai/gpt-5.2-codex',
        agent: agent(),
      },
    ],
  });
  await controller.init();
  const session = await controller.createSession({ id: sessionId, ownerId: 'test-owner' });
  return { controller, session };
}

describe('SessionModel.syncFromPersisted', () => {
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
  });

  it('restores currentModelId over a stale in-memory selection', async () => {
    const { session } = await buildController(storage);
    const thread = await session.thread.create();
    await session.model.switch('anthropic/claude-opus-4-6');

    const { session: replica } = await buildController(storage, 'replica-session');
    await replica.thread.switch({ threadId: thread.id });
    replica.model.set({ modelId: 'openai/gpt-5.5' });

    await replica.model.syncFromPersisted();

    expect(replica.model.get()).toBe('anthropic/claude-opus-4-6');
  });

  it('migrates a legacy current-mode model over the create-time seed', async () => {
    const { session } = await buildController(storage);
    const thread = await session.thread.create();
    const memory = await storage.getStore('memory');
    await memory!.updateThread({
      id: thread.id,
      title: 'legacy thread',
      metadata: {
        currentModeId: 'plan',
        currentModelId: 'openai/gpt-5.5',
        modelPersistenceVersion: null,
        modeModelId_build: 'openai/gpt-5.2-codex',
        modeModelId_plan: 'anthropic/claude-opus-4-6',
      },
    });

    const { session: replica } = await buildController(storage, 'replica-session');
    await replica.thread.switch({ threadId: thread.id });
    replica.model.set({ modelId: 'openai/gpt-5.5' });

    await replica.model.syncFromPersisted();

    expect(replica.model.get()).toBe('anthropic/claude-opus-4-6');
    expect((await memory!.getThreadById({ threadId: thread.id }))?.metadata).toMatchObject({
      currentModelId: 'anthropic/claude-opus-4-6',
      modelPersistenceVersion: 2,
    });
    expect((await memory!.getThreadById({ threadId: thread.id }))?.metadata).not.toHaveProperty('modeModelId_build');
    expect((await memory!.getThreadById({ threadId: thread.id }))?.metadata).not.toHaveProperty('modeModelId_plan');
  });

  it('does not overwrite a model switch that starts during legacy migration', async () => {
    const { session } = await buildController(storage);
    const thread = await session.thread.create();
    const memory = await storage.getStore('memory');
    const { session: replica } = await buildController(storage, 'replica-session');
    await replica.thread.switch({ threadId: thread.id });
    await memory!.updateThread({
      id: thread.id,
      title: 'legacy thread',
      metadata: {
        currentModeId: 'build',
        currentModelId: 'openai/gpt-5.5',
        modelPersistenceVersion: null,
        modeModelId_build: 'anthropic/claude-opus-4-6',
      },
    });
    const persistedThread = await memory!.getThreadById({ threadId: thread.id });
    let releaseMetadata!: () => void;
    const metadataBlocked = new Promise<void>(resolve => {
      releaseMetadata = resolve;
    });
    const originalGetById = replica.thread.getById.bind(replica.thread);
    vi.spyOn(replica.thread, 'getById')
      .mockImplementationOnce(async () => {
        await metadataBlocked;
        return persistedThread!;
      })
      .mockImplementation(originalGetById);

    const migration = replica.model.syncFromPersisted();
    const modelSwitch = replica.model.switch('openai/gpt-5.2-codex');
    releaseMetadata();
    await Promise.all([migration, modelSwitch]);

    expect(replica.model.get()).toBe('openai/gpt-5.2-codex');
    expect((await memory!.getThreadById({ threadId: thread.id }))?.metadata).toMatchObject({
      currentModelId: 'openai/gpt-5.2-codex',
      modelPersistenceVersion: 2,
    });
    expect((await memory!.getThreadById({ threadId: thread.id }))?.metadata).not.toHaveProperty('modeModelId_build');
  });

  it('keeps the in-memory selection when no model was persisted', async () => {
    const { session } = await buildController(storage);
    const thread = await session.thread.create();
    const memory = await storage.getStore('memory');
    await memory!.updateThread({ id: thread.id, title: 'empty thread', metadata: { currentModelId: null } });
    session.model.set({ modelId: 'openai/gpt-5.2-codex' });

    await session.model.syncFromPersisted();

    expect(session.model.get()).toBe('openai/gpt-5.2-codex');
  });

  it('emits model_changed only when the persisted value changes the selection', async () => {
    const { session } = await buildController(storage);
    const thread = await session.thread.create();
    await session.model.switch('anthropic/claude-opus-4-6');

    const events: string[] = [];
    session.subscribe(event => {
      if (event.type === 'model_changed') events.push(event.modelId);
    });

    await session.model.syncFromPersisted();
    expect(events).toEqual([]);

    const { session: other } = await buildController(storage, 'other-session');
    await other.thread.switch({ threadId: thread.id });
    await other.model.switch('openai/gpt-5.2-codex');

    await session.model.syncFromPersisted();
    expect(events).toEqual(['openai/gpt-5.2-codex']);
    expect(session.model.get()).toBe('openai/gpt-5.2-codex');
  });
});
