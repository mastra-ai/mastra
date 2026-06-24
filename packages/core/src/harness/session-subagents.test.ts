import { describe, it, expect, beforeEach } from 'vitest';

import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { HarnessEvent } from './types';

async function createSession(options: { storage: InMemoryStore; onEvent?: (event: HarnessEvent) => void }) {
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

  await harness.init();
  const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });
  if (options.onEvent) session.subscribe(options.onEvent);
  return { harness, session };
}

describe('session.subagents.model', () => {
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
  });

  it('returns null when no subagent model is set', async () => {
    const { session } = await createSession({ storage });
    expect(session.subagents.model.get()).toBeNull();
    expect(session.subagents.model.get({ agentType: 'explore' })).toBeNull();
  });

  it('set (global) persists to thread settings and emits subagent_model_changed', async () => {
    const events: HarnessEvent[] = [];
    const { session } = await createSession({ storage, onEvent: event => events.push(event) });
    await session.thread.create();

    await session.subagents.model.set({ modelId: 'anthropic/claude-sonnet-4' });

    expect(session.subagents.model.get()).toBe('anthropic/claude-sonnet-4');
    expect(await session.thread.getSetting({ key: 'subagentModelId' })).toBe('anthropic/claude-sonnet-4');
    expect(events).toContainEqual({
      type: 'subagent_model_changed',
      modelId: 'anthropic/claude-sonnet-4',
      scope: 'thread',
      agentType: undefined,
    });
  });

  it('set (per agentType) persists under an agentType-scoped key', async () => {
    const { session } = await createSession({ storage });
    await session.thread.create();

    await session.subagents.model.set({ modelId: 'openai/gpt-4o-mini', agentType: 'explore' });

    expect(session.subagents.model.get({ agentType: 'explore' })).toBe('openai/gpt-4o-mini');
    expect(await session.thread.getSetting({ key: 'subagentModelId_explore' })).toBe('openai/gpt-4o-mini');
  });

  it('prefers the per-agentType value over the global value', async () => {
    const { session } = await createSession({ storage });
    await session.thread.create();

    await session.subagents.model.set({ modelId: 'anthropic/claude-sonnet-4' });
    await session.subagents.model.set({ modelId: 'openai/gpt-4o-mini', agentType: 'explore' });

    expect(session.subagents.model.get({ agentType: 'explore' })).toBe('openai/gpt-4o-mini');
    // An agentType with no specific override falls back to the global value.
    expect(session.subagents.model.get({ agentType: 'plan' })).toBe('anthropic/claude-sonnet-4');
  });
});
