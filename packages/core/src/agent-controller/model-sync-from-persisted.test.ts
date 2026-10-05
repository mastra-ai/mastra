import { describe, it, expect, beforeEach } from 'vitest';
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
    await session.model.switch({ modelId: 'anthropic/claude-opus-4-6' });

    const { session: replica } = await buildController(storage, 'replica-session');
    await replica.thread.switch({ threadId: thread.id });
    replica.model.set({ modelId: 'openai/gpt-5.5' });

    await replica.model.syncFromPersisted();

    expect(replica.model.get()).toBe('anthropic/claude-opus-4-6');
  });

  it('falls back to the legacy current-mode model key', async () => {
    const { session } = await buildController(storage);
    const thread = await session.thread.create();
    const memory = await storage.getStore('memory');
    await memory!.updateThread({
      id: thread.id,
      title: 'legacy thread',
      metadata: {
        currentModeId: 'plan',
        currentModelId: null,
        modeModelId_plan: 'anthropic/claude-opus-4-6',
      },
    });

    const { session: replica } = await buildController(storage, 'replica-session');
    await replica.thread.switch({ threadId: thread.id });
    replica.model.set({ modelId: 'openai/gpt-5.5' });

    await replica.model.syncFromPersisted();

    expect(replica.model.get()).toBe('anthropic/claude-opus-4-6');
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
    await session.model.switch({ modelId: 'anthropic/claude-opus-4-6' });

    const events: string[] = [];
    session.subscribe(event => {
      if (event.type === 'model_changed') events.push(event.modelId);
    });

    await session.model.syncFromPersisted();
    expect(events).toEqual([]);

    const { session: other } = await buildController(storage, 'other-session');
    await other.thread.switch({ threadId: thread.id });
    await other.model.switch({ modelId: 'openai/gpt-5.2-codex' });

    await session.model.syncFromPersisted();
    expect(events).toEqual(['openai/gpt-5.2-codex']);
    expect(session.model.get()).toBe('openai/gpt-5.2-codex');
  });
});
