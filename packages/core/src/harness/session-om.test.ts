import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { HarnessEvent, HarnessOMConfig } from './types';

function createHarness(options: {
  storage: InMemoryStore;
  omConfig?: HarnessOMConfig;
  resolveModel?: (modelId: string) => any;
  onEvent?: (event: HarnessEvent) => void;
}) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  const harness = new Harness({
    id: 'test-harness',
    storage: options.storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    omConfig: options.omConfig,
    resolveModel: options.resolveModel,
  });

  if (options.onEvent) harness.session.subscribe(options.onEvent);

  return harness;
}

describe('session.om', () => {
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
  });

  it('falls back to omConfig defaults for model ids and thresholds', () => {
    const harness = createHarness({
      storage,
      omConfig: {
        defaultObserverModelId: 'openai/gpt-4o',
        defaultReflectorModelId: 'openai/gpt-4o-mini',
        defaultObservationThreshold: 30_000,
        defaultReflectionThreshold: 40_000,
      },
    });

    expect(harness.session.om.observer.modelId()).toBe('openai/gpt-4o');
    expect(harness.session.om.reflector.modelId()).toBe('openai/gpt-4o-mini');
    expect(harness.session.om.observer.threshold()).toBe(30_000);
    expect(harness.session.om.reflector.threshold()).toBe(40_000);
  });

  it('returns undefined when no state value and no omConfig default exist', () => {
    const harness = createHarness({ storage });

    expect(harness.session.om.observer.modelId()).toBeUndefined();
    expect(harness.session.om.reflector.modelId()).toBeUndefined();
    expect(harness.session.om.observer.threshold()).toBeUndefined();
    expect(harness.session.om.reflector.threshold()).toBeUndefined();
  });

  it('prefers session-state values over omConfig defaults', async () => {
    const harness = createHarness({
      storage,
      omConfig: { defaultObserverModelId: 'openai/gpt-4o' },
    });
    await harness.session.state.set({ observerModelId: 'anthropic/claude-sonnet-4' } as any);

    expect(harness.session.om.observer.modelId()).toBe('anthropic/claude-sonnet-4');
  });

  it('observer.switchModel persists to thread settings and emits om_model_changed', async () => {
    const events: HarnessEvent[] = [];
    const harness = createHarness({ storage, onEvent: event => events.push(event) });
    await harness.init();
    await harness.createThread();

    await harness.session.om.observer.switchModel({ modelId: 'anthropic/claude-sonnet-4' });

    expect(harness.session.om.observer.modelId()).toBe('anthropic/claude-sonnet-4');
    expect(await harness.session.thread.getSetting({ key: 'observerModelId' })).toBe('anthropic/claude-sonnet-4');
    expect(events).toContainEqual({
      type: 'om_model_changed',
      role: 'observer',
      modelId: 'anthropic/claude-sonnet-4',
    });
  });

  it('reflector.switchModel persists to thread settings and emits om_model_changed', async () => {
    const events: HarnessEvent[] = [];
    const harness = createHarness({ storage, onEvent: event => events.push(event) });
    await harness.init();
    await harness.createThread();

    await harness.session.om.reflector.switchModel({ modelId: 'openai/gpt-4o-mini' });

    expect(harness.session.om.reflector.modelId()).toBe('openai/gpt-4o-mini');
    expect(await harness.session.thread.getSetting({ key: 'reflectorModelId' })).toBe('openai/gpt-4o-mini');
    expect(events).toContainEqual({
      type: 'om_model_changed',
      role: 'reflector',
      modelId: 'openai/gpt-4o-mini',
    });
  });

  it('resolves the observer model via the configured resolver', () => {
    const resolveModel = vi.fn((modelId: string) => ({ modelId }));
    const harness = createHarness({
      storage,
      omConfig: { defaultObserverModelId: 'openai/gpt-4o' },
      resolveModel,
    });

    expect(harness.session.om.observer.resolvedModel()).toMatchObject({ modelId: 'openai/gpt-4o' });
    expect(resolveModel).toHaveBeenCalledWith('openai/gpt-4o');
  });

  it('returns undefined resolved model when no model id is set', () => {
    const resolveModel = vi.fn((modelId: string) => ({ modelId }));
    const harness = createHarness({ storage, resolveModel });

    expect(harness.session.om.observer.resolvedModel()).toBeUndefined();
    expect(resolveModel).not.toHaveBeenCalled();
  });
});
