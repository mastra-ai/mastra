import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

async function createSession(onModelUse?: (modelId: string) => void) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  const harness = new Harness({
    id: 'test-harness',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    modelUseCountTracker: onModelUse,
  });
  await harness.init();
  const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });
  return { session };
}

describe('session.model.switch', () => {
  it('tracks model selection via modelUseCountTracker', async () => {
    const trackModelUse = vi.fn<(modelId: string) => void>();
    const { session } = await createSession(trackModelUse);

    await session.model.switch({ modelId: 'openai/gpt-5.3-codex' });

    expect(trackModelUse).toHaveBeenCalledTimes(1);
    expect(trackModelUse).toHaveBeenCalledWith('openai/gpt-5.3-codex');
  });
});

describe('session.model.displayName', () => {
  it("returns 'unknown' when no model is selected", async () => {
    const { session } = await createSession();

    expect(session.model.hasSelection()).toBe(false);
    expect(session.model.displayName()).toBe('unknown');
  });

  it('returns the last segment of a provider-prefixed model id', async () => {
    const { session } = await createSession();

    await session.model.switch({ modelId: 'anthropic/claude-sonnet-4' });

    expect(session.model.displayName()).toBe('claude-sonnet-4');
  });

  it('returns the whole id when there is no provider prefix', async () => {
    const { session } = await createSession();

    await session.model.switch({ modelId: 'gpt-4o' });

    expect(session.model.displayName()).toBe('gpt-4o');
  });
});
