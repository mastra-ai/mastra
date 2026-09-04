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

  it('restores the persisted per-mode model over a stale in-memory selection', async () => {
    const { session } = await buildController(storage);
    const thread = await session.thread.create();
    await session.model.switch({ modelId: 'anthropic/claude-opus-4-6' });

    // A second Session over the same storage/thread (e.g. another server
    // replica) that seeded from the boot-time default.
    const { session: replica } = await buildController(storage, 'replica-session');
    await replica.thread.switch({ threadId: thread.id });
    // Simulate a stale in-memory selection (display cache drifted).
    replica.model.set({ modelId: 'openai/gpt-5.5' });

    await replica.model.syncFromPersisted({ modeId: replica.mode.get() });

    expect(replica.model.get()).toBe('anthropic/claude-opus-4-6');
  });

  it('keeps the in-memory selection when no per-mode model was persisted', async () => {
    const { session } = await buildController(storage);
    await session.thread.create();
    expect(session.model.get()).toBe('openai/gpt-5.5');

    await session.model.syncFromPersisted({ modeId: session.mode.get() });

    expect(session.model.get()).toBe('openai/gpt-5.5');
  });

  it('emits model_changed only when the value actually changes', async () => {
    const { session } = await buildController(storage);
    const thread = await session.thread.create();
    await session.model.switch({ modelId: 'anthropic/claude-opus-4-6' });

    const events: string[] = [];
    session.subscribe(event => {
      if (event.type === 'model_changed') events.push(event.modelId);
    });

    // In sync with storage → no event (the single-player TUI case).
    await session.model.syncFromPersisted({ modeId: session.mode.get() });
    expect(events).toEqual([]);

    // Another actor persists a different model for this mode.
    const { session: other } = await buildController(storage, 'other-session');
    await other.thread.switch({ threadId: thread.id });
    await other.model.switch({ modelId: 'openai/gpt-5.2-codex' });

    await session.model.syncFromPersisted({ modeId: session.mode.get() });
    expect(events).toEqual(['openai/gpt-5.2-codex']);
    expect(session.model.get()).toBe('openai/gpt-5.2-codex');
  });

  it('two sessions over the same storage converge after one switches', async () => {
    const { session: a } = await buildController(storage, 'session-a');
    const thread = await a.thread.create();

    const { session: b } = await buildController(storage, 'session-b');
    await b.thread.switch({ threadId: thread.id });

    await a.model.switch({ modelId: 'anthropic/claude-opus-4-6' });
    expect(b.model.get()).not.toBe('anthropic/claude-opus-4-6');

    await b.model.syncFromPersisted({ modeId: b.mode.get() });
    expect(b.model.get()).toBe('anthropic/claude-opus-4-6');
  });
});
