import { describe, it, expect, beforeEach } from 'vitest';

import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { HarnessEvent } from './types';

function createHarness(options: { storage: InMemoryStore; onEvent?: (event: HarnessEvent) => void }) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  const harness = new Harness({
    id: 'test-harness',
    storage: options.storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });

  if (options.onEvent) harness.subscribe(options.onEvent);

  return harness;
}

describe('session.subagents.model', () => {
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
  });

  it('returns null when no subagent model is set', () => {
    const harness = createHarness({ storage });
    expect(harness.session.subagents.model.get()).toBeNull();
    expect(harness.session.subagents.model.get({ agentType: 'explore' })).toBeNull();
  });

  it('set (global) persists to thread settings and emits subagent_model_changed', async () => {
    const events: HarnessEvent[] = [];
    const harness = createHarness({ storage, onEvent: event => events.push(event) });
    await harness.init();
    await harness.createThread();

    await harness.session.subagents.model.set({ modelId: 'anthropic/claude-sonnet-4' });

    expect(harness.session.subagents.model.get()).toBe('anthropic/claude-sonnet-4');
    expect(await harness.session.thread.getSetting({ key: 'subagentModelId' })).toBe('anthropic/claude-sonnet-4');
    expect(events).toContainEqual({
      type: 'subagent_model_changed',
      modelId: 'anthropic/claude-sonnet-4',
      scope: 'thread',
      agentType: undefined,
    });
  });

  it('set (per agentType) persists under an agentType-scoped key', async () => {
    const harness = createHarness({ storage });
    await harness.init();
    await harness.createThread();

    await harness.session.subagents.model.set({ modelId: 'openai/gpt-4o-mini', agentType: 'explore' });

    expect(harness.session.subagents.model.get({ agentType: 'explore' })).toBe('openai/gpt-4o-mini');
    expect(await harness.session.thread.getSetting({ key: 'subagentModelId_explore' })).toBe('openai/gpt-4o-mini');
  });

  it('prefers the per-agentType value over the global value', async () => {
    const harness = createHarness({ storage });
    await harness.init();
    await harness.createThread();

    await harness.session.subagents.model.set({ modelId: 'anthropic/claude-sonnet-4' });
    await harness.session.subagents.model.set({ modelId: 'openai/gpt-4o-mini', agentType: 'explore' });

    expect(harness.session.subagents.model.get({ agentType: 'explore' })).toBe('openai/gpt-4o-mini');
    // An agentType with no specific override falls back to the global value.
    expect(harness.session.subagents.model.get({ agentType: 'plan' })).toBe('anthropic/claude-sonnet-4');
  });
});
