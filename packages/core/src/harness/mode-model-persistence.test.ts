import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

type HarnessTestState = { currentModelId?: string };

const agent = () =>
  new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

function createHarness(storage: InMemoryStore): Harness<HarnessTestState> {
  return new Harness<HarnessTestState>({
    id: 'test-harness',
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
      {
        id: 'fast',
        name: 'Fast',
        defaultModelId: 'cerebras/zai-glm-4.7',
        agent: agent(),
      },
    ],
  });
}

describe('Harness mode-model persistence across restarts', () => {
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
  });

  it('restores the saved mode and falls back to its defaultModelId when no per-mode model was explicitly persisted', async () => {
    // Session 1: start in build, switch to fast (no explicit model change),
    // then "exit" — i.e. simulate reopening with a fresh harness pointed at
    // the same thread.
    const session1 = createHarness(storage);
    await session1.init();
    const thread = await session1.createThread();
    expect(session1.getCurrentModeId()).toBe('build');

    await session1.switchMode({ modeId: 'fast' });
    expect(session1.getCurrentModeId()).toBe('fast');
    expect(session1.getState().currentModelId).toBe('cerebras/zai-glm-4.7');

    // Session 2: reopen and resume the same thread.
    const session2 = createHarness(storage);
    await session2.init();
    await session2.switchThread({ threadId: thread.id });

    expect(session2.getCurrentModeId()).toBe('fast');
    expect(session2.getState().currentModelId).toBe('cerebras/zai-glm-4.7');
  });

  it('restores an explicitly chosen per-mode model on reopen', async () => {
    const session1 = createHarness(storage);
    await session1.init();
    const thread = await session1.createThread();

    await session1.switchMode({ modeId: 'fast' });
    await session1.switchModel({ modelId: 'cerebras/qwen-3-coder-480b' });
    expect(session1.getState().currentModelId).toBe('cerebras/qwen-3-coder-480b');

    const session2 = createHarness(storage);
    await session2.init();
    await session2.switchThread({ threadId: thread.id });

    expect(session2.getCurrentModeId()).toBe('fast');
    expect(session2.getState().currentModelId).toBe('cerebras/qwen-3-coder-480b');
  });

  it('keeps the default mode and its persisted model on reopen when the user never switched modes', async () => {
    const session1 = createHarness(storage);
    await session1.init();
    const thread = await session1.createThread();
    await session1.switchModel({ modelId: 'anthropic/claude-opus-4-6' });

    const session2 = createHarness(storage);
    await session2.init();
    await session2.switchThread({ threadId: thread.id });

    expect(session2.getCurrentModeId()).toBe('build');
    expect(session2.getState().currentModelId).toBe('anthropic/claude-opus-4-6');
  });

  it('emits mode_changed with the correct previousModeId when restoring a mode from thread metadata', async () => {
    const session1 = createHarness(storage);
    await session1.init();
    const thread = await session1.createThread();
    await session1.switchMode({ modeId: 'plan' });

    const session2 = createHarness(storage);
    await session2.init();

    const events: Array<{ type: 'mode_changed'; modeId: string; previousModeId: string }> = [];
    session2.subscribe(event => {
      if (event.type === 'mode_changed') {
        events.push({
          type: event.type,
          modeId: event.modeId,
          previousModeId: event.previousModeId,
        });
      }
    });

    await session2.switchThread({ threadId: thread.id });

    const restoreEvent = events.find(e => e.modeId === 'plan');
    expect(restoreEvent).toBeDefined();
    expect(restoreEvent?.previousModeId).toBe('build');
  });
});
