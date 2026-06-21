import { describe, it, expect } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { HarnessEvent } from './types';

function createHarness(storage: InMemoryStore) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new Harness({
    id: 'test-harness',
    storage,
    modes: [
      { id: 'build', name: 'Build', default: true, agent, defaultModelId: 'openai/gpt-4o' },
      { id: 'plan', name: 'Plan', agent, defaultModelId: 'anthropic/claude-sonnet-4' },
    ],
  });
}

describe('Harness.createSession — cross-session isolation', () => {
  it('gives each session an independent current thread', async () => {
    const harness = createHarness(new InMemoryStore());
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    const b = await harness.createSession({ resourceId: 'user-b' });

    expect(a.thread.getId()).toBeDefined();
    expect(b.thread.getId()).toBeDefined();
    expect(a.thread.getId()).not.toBe(b.thread.getId());
  });

  it('isolates mode switches between sessions', async () => {
    const harness = createHarness(new InMemoryStore());
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    const b = await harness.createSession({ resourceId: 'user-b' });

    expect(a.mode.get()).toBe('build');
    expect(b.mode.get()).toBe('build');

    await a.mode.switch({ modeId: 'plan' });

    // Only session a moved to plan; b is untouched.
    expect(a.mode.get()).toBe('plan');
    expect(b.mode.get()).toBe('build');
  });

  it('isolates model selection between sessions', async () => {
    const harness = createHarness(new InMemoryStore());
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    const b = await harness.createSession({ resourceId: 'user-b' });

    await a.model.switch({ modelId: 'cerebras/zai-glm-4.7' });

    expect(a.model.get()).toBe('cerebras/zai-glm-4.7');
    // b still resolves its mode default, unaffected by a's override.
    expect(b.model.get()).toBe('openai/gpt-4o');
  });

  it('isolates session state between sessions', async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      name: 'test-agent',
      instructions: 'You are a test agent.',
      model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
    });
    const harness = new Harness<{ counter: number }>({
      id: 'test-harness',
      storage,
      initialState: { counter: 0 },
      modes: [{ id: 'build', name: 'Build', default: true, agent }],
    });
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    const b = await harness.createSession({ resourceId: 'user-b' });

    await a.state.set({ counter: 5 });

    expect(a.state.get().counter).toBe(5);
    expect(b.state.get().counter).toBe(0);
  });

  it('isolates event buses between sessions', async () => {
    const harness = createHarness(new InMemoryStore());
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    const b = await harness.createSession({ resourceId: 'user-b' });

    const aEvents: HarnessEvent[] = [];
    const bEvents: HarnessEvent[] = [];
    a.subscribe(event => {
      aEvents.push(event);
    });
    b.subscribe(event => {
      bEvents.push(event);
    });

    await a.mode.switch({ modeId: 'plan' });

    expect(aEvents.some(e => e.type === 'mode_changed')).toBe(true);
    expect(bEvents.some(e => e.type === 'mode_changed')).toBe(false);
  });
});
