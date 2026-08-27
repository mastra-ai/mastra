import { describe, it, expect, beforeEach } from 'vitest';

import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent, AgentControllerOMConfig } from './types';

async function createSession(options: {
  storage: InMemoryStore;
  omConfig?: AgentControllerOMConfig;
  onEvent?: (event: AgentControllerEvent) => void;
}) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage: options.storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    omConfig: options.omConfig,
  });

  await controller.init();
  const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  if (options.onEvent) session.subscribe(options.onEvent);
  return { controller, session };
}

describe('session.om', () => {
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
  });

  it('falls back to omConfig defaults for model ids and thresholds', async () => {
    const { session } = await createSession({
      storage,
      omConfig: {
        defaultObserverModelId: 'openai/gpt-4o',
        defaultReflectorModelId: 'openai/gpt-4o-mini',
        defaultObservationThreshold: 30_000,
        defaultReflectionThreshold: 40_000,
      },
    });

    expect(session.om.observer.modelId()).toBe('openai/gpt-4o');
    expect(session.om.reflector.modelId()).toBe('openai/gpt-4o-mini');
    expect(session.om.observer.threshold()).toBe(30_000);
    expect(session.om.reflector.threshold()).toBe(40_000);
  });

  it('returns undefined when no state value and no omConfig default exist', async () => {
    const { session } = await createSession({ storage });

    expect(session.om.observer.modelId()).toBeUndefined();
    expect(session.om.reflector.modelId()).toBeUndefined();
    expect(session.om.observer.threshold()).toBeUndefined();
    expect(session.om.reflector.threshold()).toBeUndefined();
  });

  it('prefers session-state values over omConfig defaults', async () => {
    const { session } = await createSession({
      storage,
      omConfig: { defaultObserverModelId: 'openai/gpt-4o' },
    });
    await session.state.set({ observerModelId: 'anthropic/claude-sonnet-4' } as any);

    expect(session.om.observer.modelId()).toBe('anthropic/claude-sonnet-4');
  });

  it('observer.switchModel persists to thread settings and emits om_model_changed', async () => {
    const events: AgentControllerEvent[] = [];
    const { session } = await createSession({ storage, onEvent: event => events.push(event) });
    await session.thread.create();

    await session.om.observer.switchModel({ model: 'anthropic/claude-sonnet-4' });

    expect(session.om.observer.modelId()).toBe('anthropic/claude-sonnet-4');
    expect(await session.thread.getSetting({ key: 'observerModelId' })).toBe('anthropic/claude-sonnet-4');
    expect(events).toContainEqual({
      type: 'om_model_changed',
      role: 'observer',
      modelId: 'anthropic/claude-sonnet-4',
    });
  });

  it('reflector.switchModel persists to thread settings and emits om_model_changed', async () => {
    const events: AgentControllerEvent[] = [];
    const { session } = await createSession({ storage, onEvent: event => events.push(event) });
    await session.thread.create();

    await session.om.reflector.switchModel({ model: 'openai/gpt-4o-mini' });

    expect(session.om.reflector.modelId()).toBe('openai/gpt-4o-mini');
    expect(await session.thread.getSetting({ key: 'reflectorModelId' })).toBe('openai/gpt-4o-mini');
    expect(events).toContainEqual({
      type: 'om_model_changed',
      role: 'reflector',
      modelId: 'openai/gpt-4o-mini',
    });
  });

  it('resolves the observer model through the model router gateways', async () => {
    const { session } = await createSession({
      storage,
      omConfig: { defaultObserverModelId: 'openai/gpt-4o' },
    });

    const resolved = session.om.observer.resolvedModel() as { modelId?: string; provider?: string };
    expect(resolved?.provider).toBe('openai');
    expect(resolved?.modelId).toBe('gpt-4o');
  });

  it('returns undefined resolved model when no model id is set', async () => {
    const { session } = await createSession({ storage });

    expect(session.om.observer.resolvedModel()).toBeUndefined();
  });

  it('dynamically resolves auto selections from the current main model', async () => {
    const calls: Array<{ role: string; currentModelId?: string }> = [];
    const { session } = await createSession({
      storage,
      omConfig: {
        observerModel: 'auto',
        reflectorModel: 'auto',
        resolveAutoModelId: ({ role, currentModelId }) => {
          calls.push({ role, currentModelId });
          return currentModelId === 'anthropic/claude-sonnet-4' ? 'anthropic/claude-haiku-4-5' : 'openai/gpt-4o-mini';
        },
      },
    });

    session.model.set({ modelId: 'openai/gpt-4o' });
    expect(session.om.observer.model()).toBe('auto');
    expect(session.om.observer.modelId()).toBe('openai/gpt-4o-mini');

    session.model.set({ modelId: 'anthropic/claude-sonnet-4' });
    expect(session.om.observer.modelId()).toBe('anthropic/claude-haiku-4-5');
    expect(session.om.reflector.modelId()).toBe('anthropic/claude-haiku-4-5');
    expect(calls).toEqual([
      { role: 'observer', currentModelId: 'openai/gpt-4o' },
      { role: 'observer', currentModelId: 'anthropic/claude-sonnet-4' },
      { role: 'reflector', currentModelId: 'anthropic/claude-sonnet-4' },
    ]);
  });

  it('keeps explicit observer and reflector selections independent', async () => {
    const { session } = await createSession({
      storage,
      omConfig: {
        observerModel: 'auto',
        reflectorModel: 'auto',
        resolveAutoModelId: ({ currentModelId }) => currentModelId,
      },
    });
    await session.thread.create();
    session.model.set({ modelId: 'openai/gpt-4o' });

    await session.om.observer.switchModel({ model: 'anthropic/claude-haiku-4-5' });
    session.model.set({ modelId: 'deepseek/deepseek-v4' });

    expect(session.om.observer.model()).toBe('anthropic/claude-haiku-4-5');
    expect(session.om.observer.modelId()).toBe('anthropic/claude-haiku-4-5');
    expect(session.om.reflector.model()).toBe('auto');
    expect(session.om.reflector.modelId()).toBe('deepseek/deepseek-v4');
  });

  it('accepts model: auto and concrete model IDs through the unified switch API', async () => {
    const { session } = await createSession({
      storage,
      omConfig: {
        observerModel: 'auto',
        reflectorModel: 'openai/gpt-4o-mini',
        resolveAutoModelId: ({ currentModelId }) => currentModelId,
      },
    });

    session.model.set({ modelId: 'anthropic/claude-sonnet-4' });
    expect(session.om.observer.model()).toBe('auto');
    expect(session.om.observer.modelId()).toBe('anthropic/claude-sonnet-4');
    expect(session.om.reflector.model()).toBe('openai/gpt-4o-mini');

    await session.om.observer.switchModel({ model: 'openai/gpt-4o' });
    expect(session.om.observer.model()).toBe('openai/gpt-4o');
    await session.om.observer.switchModel({ model: 'auto' });
    expect(session.om.observer.model()).toBe('auto');
    expect(await session.thread.getSetting({ key: 'observerModelSelection' })).toBe('auto');
  });

  it('switches an explicit role back to auto and clears its stale concrete model', async () => {
    const events: AgentControllerEvent[] = [];
    const { session } = await createSession({
      storage,
      onEvent: event => events.push(event),
      omConfig: {
        defaultObserverModelId: 'openai/gpt-4o-mini',
        observerModel: 'auto',
        resolveAutoModelId: ({ currentModelId }) => currentModelId,
      },
    });
    await session.thread.create();
    session.model.set({ modelId: 'anthropic/claude-haiku-4-5' });
    await session.om.reflector.switchModel({ model: 'deepseek/deepseek-v4-flash' });
    await session.om.observer.switchModel({ model: 'openai/gpt-4o' });

    await session.om.observer.switchModel({ model: 'auto' });

    expect(session.om.observer.model()).toBe('auto');
    expect(session.om.observer.modelId()).toBe('anthropic/claude-haiku-4-5');
    expect(session.state.get()).toMatchObject({ observerModelSelection: 'auto' });
    expect((session.state.get() as Record<string, unknown>).observerModelId).toBeUndefined();
    expect(await session.thread.getSetting({ key: 'observerModelId' })).toBeUndefined();
    expect(await session.thread.getSetting({ key: 'observerModelSelection' })).toBe('auto');
    expect(session.om.reflector.model()).toBe('deepseek/deepseek-v4-flash');
    expect(events).toContainEqual({
      type: 'om_model_changed',
      role: 'observer',
      modelId: 'anthropic/claude-haiku-4-5',
    });
  });

  it.each([
    ['returns undefined', () => undefined],
    [
      'throws',
      () => {
        throw new Error('resolver failed');
      },
    ],
  ])('falls back to the concrete role default when auto resolution %s', async (_label, resolveAutoModelId) => {
    const { session } = await createSession({
      storage,
      omConfig: {
        defaultObserverModelId: 'openai/gpt-4o-mini',
        observerModel: 'auto',
        resolveAutoModelId,
      },
    });

    expect(session.om.observer.model()).toBe('auto');
    expect(session.om.observer.modelId()).toBe('openai/gpt-4o-mini');
    expect((session.om.observer.resolvedModel() as { modelId?: string }).modelId).toBe('gpt-4o-mini');
  });

  it('restores auto intent without reviving a stale concrete model', async () => {
    const omConfig: AgentControllerOMConfig = {
      defaultObserverModelId: 'openai/gpt-4o-mini',
      observerModel: 'openai/gpt-4o-mini',
      resolveAutoModelId: ({ currentModelId }) => currentModelId,
    };
    const { session } = await createSession({ storage, omConfig });
    const thread = await session.thread.create();
    session.model.set({ modelId: 'anthropic/claude-haiku-4-5' });
    await session.om.observer.switchModel({ model: 'openai/gpt-4o' });
    await session.om.observer.switchModel({ model: 'auto' });

    const { session: restored } = await createSession({ storage, omConfig });
    restored.model.set({ modelId: 'deepseek/deepseek-v4-flash' });
    await restored.thread.switch({ threadId: thread.id });

    expect(restored.om.observer.model()).toBe('auto');
    expect(restored.om.observer.modelId()).toBe('deepseek/deepseek-v4-flash');
    expect((restored.state.get() as Record<string, unknown>).observerModelId).toBeUndefined();
  });

  it('restores legacy concrete metadata without a selection key as explicit', async () => {
    const { session } = await createSession({ storage });
    const thread = await session.thread.create();
    await session.thread.setSetting({ key: 'observerModelId', value: 'anthropic/claude-sonnet-4' });

    const { session: restored } = await createSession({
      storage,
      omConfig: {
        observerModel: 'auto',
        resolveAutoModelId: () => 'openai/gpt-4o-mini',
      },
    });
    await restored.thread.switch({ threadId: thread.id });

    expect(restored.om.observer.model()).toBe('anthropic/claude-sonnet-4');
    expect(restored.om.observer.modelId()).toBe('anthropic/claude-sonnet-4');
  });
});
