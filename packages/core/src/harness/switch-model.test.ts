import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

function createHarness(onModelUse?: (modelId: string) => void) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new Harness({
    id: 'test-harness',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    modelUseCountTracker: onModelUse,
  });
}

describe('session.model.switch', () => {
  it('tracks model selection via modelUseCountTracker', async () => {
    const trackModelUse = vi.fn<(modelId: string) => void>();
    const harness = createHarness(trackModelUse);

    await harness.session.model.switch({ modelId: 'openai/gpt-5.3-codex' });

    expect(trackModelUse).toHaveBeenCalledTimes(1);
    expect(trackModelUse).toHaveBeenCalledWith('openai/gpt-5.3-codex');
  });
});

describe('session.model.displayName', () => {
  it("returns 'unknown' when no model is selected", () => {
    const harness = createHarness();

    expect(harness.session.model.hasSelection()).toBe(false);
    expect(harness.session.model.displayName()).toBe('unknown');
  });

  it('returns the last segment of a provider-prefixed model id', async () => {
    const harness = createHarness();

    await harness.session.model.switch({ modelId: 'anthropic/__AI_SDK_ANTHROPIC_MODEL_SONNET__' });

    expect(harness.session.model.displayName()).toBe('__AI_SDK_ANTHROPIC_MODEL_SONNET__');
  });

  it('returns the whole id when there is no provider prefix', async () => {
    const harness = createHarness();

    await harness.session.model.switch({ modelId: '__AI_SDK_OPENAI_MODEL_BASE__' });

    expect(harness.session.model.displayName()).toBe('__AI_SDK_OPENAI_MODEL_BASE__');
  });
});
