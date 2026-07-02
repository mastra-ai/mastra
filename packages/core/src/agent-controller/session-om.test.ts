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

    await session.om.observer.switchModel({ modelId: 'anthropic/claude-sonnet-4' });

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

    await session.om.reflector.switchModel({ modelId: 'openai/gpt-4o-mini' });

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
});
