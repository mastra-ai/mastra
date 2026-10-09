import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Agent } from '../agent';
import type { PublicSchema } from '../schema';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerThinkingLevel } from './types';

async function createSession(
  onModelUse?: (modelId: string) => void,
  storage = new InMemoryStore(),
  stateSchema: PublicSchema = z.object({
    thinkingLevel: z.enum(['off', 'low', 'medium', 'high', 'xhigh', 'max']).optional(),
  }),
) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  const controller = new AgentController<{ thinkingLevel?: AgentControllerThinkingLevel }>({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    stateSchema,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    modelUseCountTracker: onModelUse,
  });
  await controller.init();
  const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  return { controller, session };
}

describe('session.model.switch', () => {
  it('persists and restores the model and thinking level together', async () => {
    const storage = new InMemoryStore();
    const { session } = await createSession(undefined, storage);
    const thread = await session.thread.create();
    const snapshots: unknown[] = [];
    session.subscribe(event => {
      if (event.type === 'model_changed' || event.type === 'state_changed') {
        snapshots.push({ event, modelId: session.model.get(), thinkingLevel: session.state.get().thinkingLevel });
      }
    });
    const memory = (await storage.getStore('memory'))!;
    const save = vi.spyOn(memory, 'saveThread');

    await session.model.switch('openai/gpt-5.5', { thinkingLevel: 'high' });

    expect(save).toHaveBeenCalledTimes(1);
    expect((await session.thread.getById({ threadId: thread.id }))?.metadata).toMatchObject({
      currentModelId: 'openai/gpt-5.5',
      thinkingLevel: 'high',
    });
    expect(snapshots).toEqual([
      {
        event: { type: 'state_changed', state: { thinkingLevel: 'high' }, changedKeys: ['thinkingLevel'] },
        modelId: 'openai/gpt-5.5',
        thinkingLevel: 'high',
      },
      {
        event: { type: 'model_changed', modelId: 'openai/gpt-5.5', thinkingLevel: 'high' },
        modelId: 'openai/gpt-5.5',
        thinkingLevel: 'high',
      },
    ]);
    const { session: restored } = await createSession(undefined, storage);
    await restored.thread.switch({ threadId: thread.id });
    expect(restored.model.get()).toBe('openai/gpt-5.5');
    expect(restored.state.get().thinkingLevel).toBe('high');
  });

  it.each(['off', 'low', 'medium', 'high', 'xhigh', 'max', undefined] as const)(
    'includes unchanged thinking level %s for model-only switches and keeps set ephemeral',
    async thinkingLevel => {
      const { session } = await createSession();
      await session.thread.create();
      await session.model.switch('openai/gpt-5.5', { thinkingLevel });
      const events: unknown[] = [];
      session.subscribe(event => {
        if (event.type === 'model_changed') events.push(event);
      });
      await session.model.switch('anthropic/claude-opus-4-6');
      session.model.set({ modelId: 'openai/gpt-4o' });
      expect(session.state.get().thinkingLevel).toBe(thinkingLevel);
      expect(events).toStrictEqual([{ type: 'model_changed', modelId: 'anthropic/claude-opus-4-6', thinkingLevel }]);
      expect(await session.thread.getSetting({ key: 'currentModelId' })).toBe('anthropic/claude-opus-4-6');
      expect(await session.thread.getSetting({ key: 'thinkingLevel' })).toBe(thinkingLevel);
    },
  );

  it.each(['high', undefined] as const)(
    'includes the current thinking level %s when re-syncing a changed persisted model',
    async thinkingLevel => {
      const { session } = await createSession();
      await session.thread.create();
      await session.model.switch('openai/gpt-5.5', { thinkingLevel });
      session.model.set({ modelId: 'openai/gpt-4o' });
      const events: unknown[] = [];
      session.subscribe(event => {
        if (event.type === 'model_changed') events.push(event);
      });

      await session.model.syncFromPersisted();

      expect(events).toStrictEqual([{ type: 'model_changed', modelId: 'openai/gpt-5.5', thinkingLevel }]);
    },
  );

  it.each([
    ['openai/gpt-4o', 'low'],
    ['openai/gpt-5.5', 'low'],
    ['openai/gpt-4o', undefined],
  ] as const)(
    'synchronizes the persisted pair from another session to %s/high from %s',
    async (modelId, initialLevel) => {
      const trackModelUse = vi.fn();
      const storage = new InMemoryStore();
      const { controller, session } = await createSession(trackModelUse, storage);
      const thread = await session.thread.create();
      await session.model.switch('openai/gpt-4o', { thinkingLevel: initialLevel });
      const writer = await controller.createSession({ id: 'writer-session', ownerId: 'test-owner', scope: 'writer' });
      await writer.thread.switch({ threadId: thread.id });
      await writer.model.switch(modelId, { thinkingLevel: 'high' });
      trackModelUse.mockClear();
      const memory = (await storage.getStore('memory'))!;
      const save = vi.spyOn(memory, 'saveThread');
      const snapshots: unknown[] = [];
      session.subscribe(event => {
        if (event.type === 'state_changed' || event.type === 'model_changed') {
          snapshots.push({ event, modelId: session.model.get(), thinkingLevel: session.state.get().thinkingLevel });
        }
      });

      await session.model.syncFromPersisted();
      await session.model.syncFromPersisted();

      expect(session.model.get()).toBe(modelId);
      expect(session.state.get().thinkingLevel).toBe('high');
      expect(snapshots).toEqual([
        {
          event: { type: 'state_changed', state: { thinkingLevel: 'high' }, changedKeys: ['thinkingLevel'] },
          modelId,
          thinkingLevel: 'high',
        },
        { event: { type: 'model_changed', modelId, thinkingLevel: 'high' }, modelId, thinkingLevel: 'high' },
      ]);
      expect(save).not.toHaveBeenCalled();
      expect(trackModelUse).not.toHaveBeenCalled();
    },
  );

  it('clears a thinking override removed by another session without changing the model', async () => {
    const { controller, session } = await createSession();
    const thread = await session.thread.create();
    await session.model.switch('openai/gpt-5.5', { thinkingLevel: 'high' });
    const writer = await controller.createSession({ id: 'writer-session', ownerId: 'test-owner', scope: 'writer' });
    await writer.thread.switch({ threadId: thread.id });
    await writer.state.set({ thinkingLevel: undefined });
    const listener = vi.fn();
    session.subscribe(event => {
      if (event.type === 'model_changed') listener(event);
    });

    await session.model.syncFromPersisted();

    expect(session.model.get()).toBe('openai/gpt-5.5');
    expect(session.state.get().thinkingLevel).toBeUndefined();
    expect(listener).toHaveBeenCalledExactlyOnceWith({
      type: 'model_changed',
      modelId: 'openai/gpt-5.5',
      thinkingLevel: undefined,
    });
  });

  it('uses the state schema default when a persisted thinking override is removed', async () => {
    const storage = new InMemoryStore();
    const schema = z.object({ thinkingLevel: z.enum(['low', 'high']).default('low') });
    const { session } = await createSession(undefined, storage, schema);
    const thread = await session.thread.create();
    await session.model.switch('openai/gpt-4o', { thinkingLevel: 'high' });
    const { controller } = await createSession(undefined, storage);
    const writer = await controller.createSession({ id: 'writer-session', ownerId: 'test-owner', scope: 'writer' });
    await writer.thread.switch({ threadId: thread.id });
    await writer.model.switch('openai/gpt-5.5');
    await writer.state.set({ thinkingLevel: undefined });
    const listener = vi.fn();
    session.subscribe(event => {
      if (event.type === 'model_changed') listener(event);
    });

    await session.model.syncFromPersisted();
    await session.model.syncFromPersisted();

    expect(session.model.get()).toBe('openai/gpt-5.5');
    expect(session.state.get().thinkingLevel).toBe('low');
    expect(listener).toHaveBeenCalledExactlyOnceWith({
      type: 'model_changed',
      modelId: 'openai/gpt-5.5',
      thinkingLevel: 'low',
    });
    expect(await session.thread.getSetting({ key: 'thinkingLevel' })).toBeUndefined();
  });

  it('rejects invalid persisted thinking before applying either selection', async () => {
    const { controller, session } = await createSession();
    const thread = await session.thread.create();
    await session.model.switch('openai/gpt-4o', { thinkingLevel: 'low' });
    const writer = await controller.createSession({ id: 'writer-session', ownerId: 'test-owner', scope: 'writer' });
    await writer.thread.switch({ threadId: thread.id });
    await writer.model.switch('openai/gpt-5.5');
    await writer.thread.setSetting({ key: 'thinkingLevel', value: 'invalid' });
    const listener = vi.fn();
    session.subscribe(listener);

    await expect(session.model.syncFromPersisted()).rejects.toThrow('Invalid state update');

    expect(session.model.get()).toBe('openai/gpt-4o');
    expect(session.state.get().thinkingLevel).toBe('low');
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not apply a persisted pair after the thread changes during validation', async () => {
    let release = () => {};
    let entered = () => {};
    const validationStarted = new Promise<void>(resolve => {
      entered = resolve;
    });
    const validationGate = new Promise<void>(resolve => {
      release = resolve;
    });
    const schema = z.object({ thinkingLevel: z.string().optional() }).superRefine(async state => {
      if (state.thinkingLevel === 'high') {
        entered();
        await validationGate;
      }
    });
    const storage = new InMemoryStore();
    const { session } = await createSession(undefined, storage, schema);
    const thread = await session.thread.create();
    await session.model.switch('openai/gpt-4o', { thinkingLevel: 'low' });
    const { controller } = await createSession(undefined, storage);
    const writer = await controller.createSession({ id: 'writer-session', ownerId: 'test-owner', scope: 'writer' });
    await writer.thread.switch({ threadId: thread.id });
    await writer.model.switch('openai/gpt-5.5', { thinkingLevel: 'high' });
    const listener = vi.fn();
    session.subscribe(listener);

    const syncing = session.model.syncFromPersisted();
    await validationStarted;
    session.thread.set({ threadId: 'newly-bound-thread' });
    release();
    await syncing;

    expect(session.model.get()).toBe('openai/gpt-4o');
    expect(session.state.get().thinkingLevel).toBe('low');
    expect(listener).not.toHaveBeenCalled();
  });

  it('serializes concurrent model and thinking selections as pairs', async () => {
    const { session } = await createSession();
    await session.thread.create();
    const pairs: unknown[] = [];
    session.subscribe(event => {
      if (event.type === 'model_changed')
        pairs.push([event.modelId, event.thinkingLevel, session.state.get().thinkingLevel]);
    });
    await Promise.all([
      session.model.switch('openai/gpt-5.5', { thinkingLevel: 'high' }),
      session.model.switch('anthropic/claude-opus-4-6', { thinkingLevel: 'low' }),
    ]);
    expect(pairs).toEqual([
      ['openai/gpt-5.5', 'high', 'high'],
      ['anthropic/claude-opus-4-6', 'low', 'low'],
    ]);
    expect(await session.thread.getSetting({ key: 'currentModelId' })).toBe('anthropic/claude-opus-4-6');
    expect(await session.thread.getSetting({ key: 'thinkingLevel' })).toBe('low');
  });

  it('does not apply either selection if persistence fails', async () => {
    const storage = new InMemoryStore();
    const { session } = await createSession(undefined, storage);
    await session.thread.create();
    await session.model.switch('openai/gpt-5.5', { thinkingLevel: 'low' });
    const memory = (await storage.getStore('memory'))!;
    vi.spyOn(memory, 'saveThread').mockRejectedValueOnce(new Error('write failed'));
    const listener = vi.fn();
    session.subscribe(listener);
    await expect(session.model.switch('anthropic/claude-opus-4-6', { thinkingLevel: 'high' })).rejects.toThrow(
      'write failed',
    );
    expect(session.model.get()).toBe('openai/gpt-5.5');
    expect(session.state.get().thinkingLevel).toBe('low');
    expect(listener).not.toHaveBeenCalled();
  });

  it.each([z.object({ thinkingLevel: z.literal('off').optional() }), z.object({})])(
    'rejects unsupported state schemas before changing the model',
    async stateSchema => {
      const { session } = await createSession(undefined, new InMemoryStore(), stateSchema);
      await session.thread.create();
      session.model.set({ modelId: 'openai/gpt-4o' });
      const listener = vi.fn();
      session.subscribe(listener);
      await expect(session.model.switch('openai/gpt-5.5', { thinkingLevel: 'high' })).rejects.toThrow();
      expect(session.model.get()).toBe('openai/gpt-4o');
      expect(await session.thread.getSetting({ key: 'currentModelId' })).toBeUndefined();
      expect(listener).not.toHaveBeenCalled();
    },
  );

  it('applies a pair without a bound thread', async () => {
    const { session } = await createSession();
    await session.model.switch('openai/gpt-5.5', { thinkingLevel: 'off' });
    expect(session.model.get()).toBe('openai/gpt-5.5');
    expect(session.state.get().thinkingLevel).toBe('off');
  });

  it.each([undefined, { thinkingLevel: 'high' }] as const)(
    'rejects an unbound switch with options %s canceled before it starts',
    async options => {
      const trackModelUse = vi.fn();
      const { session } = await createSession(trackModelUse);
      session.thread.clear();
      session.model.set({ modelId: 'openai/gpt-4o' });
      await session.state.set({ thinkingLevel: 'low' });
      const listener = vi.fn();
      session.subscribe(listener);

      const switching = session.model.switch('openai/gpt-5.5', options);
      session.thread.set({ threadId: 'newly-bound-thread' });
      await expect(switching).rejects.toThrow('Model switch canceled');

      expect(session.model.get()).toBe('openai/gpt-4o');
      expect(session.state.get().thinkingLevel).toBe('low');
      expect(listener).not.toHaveBeenCalled();
      expect(trackModelUse).not.toHaveBeenCalled();

      session.thread.clear();
      await session.model.switch('anthropic/claude-opus-4-6');
      expect(session.model.get()).toBe('anthropic/claude-opus-4-6');
      expect(trackModelUse).toHaveBeenCalledExactlyOnceWith('anthropic/claude-opus-4-6');
    },
  );

  it('rejects a bound paired switch canceled before committing anything', async () => {
    const trackModelUse = vi.fn();
    const storage = new InMemoryStore();
    const { session } = await createSession(trackModelUse, storage);
    const thread = await session.thread.create();
    await session.model.switch('openai/gpt-4o', { thinkingLevel: 'low' });
    trackModelUse.mockClear();
    const memory = (await storage.getStore('memory'))!;
    const save = vi.spyOn(memory, 'saveThread');

    const switching = session.model.switch('openai/gpt-5.5', { thinkingLevel: 'high' });
    session.thread.set({ threadId: 'newly-bound-thread' });
    await expect(switching).rejects.toThrow('Model switch canceled');

    expect((await memory.getThreadById({ threadId: thread.id }))?.metadata).toMatchObject({
      currentModelId: 'openai/gpt-4o',
      thinkingLevel: 'low',
    });
    expect(save).not.toHaveBeenCalled();
    expect(trackModelUse).not.toHaveBeenCalled();
  });

  it('preserves a model-only write to its captured thread after navigation before it starts', async () => {
    const trackModelUse = vi.fn();
    const storage = new InMemoryStore();
    const { session } = await createSession(trackModelUse, storage);
    const thread = await session.thread.create();
    await session.model.switch('openai/gpt-4o', { thinkingLevel: 'low' });
    trackModelUse.mockClear();
    const listener = vi.fn();
    session.subscribe(listener);

    const switching = session.model.switch('openai/gpt-5.5');
    session.thread.set({ threadId: 'newly-bound-thread' });
    await expect(switching).resolves.toBeUndefined();

    expect((await session.thread.getById({ threadId: thread.id }))?.metadata).toMatchObject({
      currentModelId: 'openai/gpt-5.5',
      thinkingLevel: 'low',
    });
    expect(session.model.get()).toBe('openai/gpt-4o');
    expect(session.state.get().thinkingLevel).toBe('low');
    expect(listener).not.toHaveBeenCalled();
    expect(trackModelUse).toHaveBeenCalledExactlyOnceWith('openai/gpt-5.5');
  });

  it.each([undefined, { thinkingLevel: 'high' }] as const)(
    'preserves a captured-thread commit with options %s after navigation during the write',
    async options => {
      const trackModelUse = vi.fn();
      const storage = new InMemoryStore();
      const { session } = await createSession(trackModelUse, storage);
      const thread = await session.thread.create();
      await session.model.switch('openai/gpt-4o', { thinkingLevel: 'low' });
      trackModelUse.mockClear();
      const memory = (await storage.getStore('memory'))!;
      const save = memory.saveThread.bind(memory);
      let release = () => {};
      let entered = () => {};
      const writeStarted = new Promise<void>(resolve => {
        entered = resolve;
      });
      const writeGate = new Promise<void>(resolve => {
        release = resolve;
      });
      vi.spyOn(memory, 'saveThread').mockImplementationOnce(async args => {
        entered();
        await writeGate;
        return save(args);
      });
      const listener = vi.fn();
      session.subscribe(listener);

      const switching = session.model.switch('openai/gpt-5.5', options);
      await writeStarted;
      session.thread.set({ threadId: 'newly-bound-thread' });
      release();
      await expect(switching).resolves.toBeUndefined();

      expect((await memory.getThreadById({ threadId: thread.id }))?.metadata).toMatchObject({
        currentModelId: 'openai/gpt-5.5',
        thinkingLevel: options?.thinkingLevel ?? 'low',
      });
      expect(session.model.get()).toBe('openai/gpt-4o');
      expect(session.state.get().thinkingLevel).toBe('low');
      expect(listener).not.toHaveBeenCalled();
      expect(trackModelUse).toHaveBeenCalledExactlyOnceWith('openai/gpt-5.5');
    },
  );

  it('rejects an unbound switch after a thread is bound during validation', async () => {
    let release = () => {};
    let entered = () => {};
    const validationStarted = new Promise<void>(resolve => {
      entered = resolve;
    });
    const validationGate = new Promise<void>(resolve => {
      release = resolve;
    });
    const schema = z.object({ thinkingLevel: z.string().optional() }).superRefine(async state => {
      if (state.thinkingLevel === 'high') {
        entered();
        await validationGate;
      }
    });
    const trackModelUse = vi.fn();
    const { session } = await createSession(trackModelUse, new InMemoryStore(), schema);
    session.thread.clear();
    const listener = vi.fn();
    session.subscribe(listener);
    const switching = session.model.switch('openai/gpt-5.5', { thinkingLevel: 'high' });
    await validationStarted;
    session.thread.set({ threadId: 'newly-bound-thread' });
    release();
    await expect(switching).rejects.toThrow('Model switch canceled');
    expect(session.model.get()).not.toBe('openai/gpt-5.5');
    expect(session.state.get().thinkingLevel).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
    expect(trackModelUse).not.toHaveBeenCalled();
  });

  it('does not restore stale thinking over a switch completed during hydration', async () => {
    const storage = new InMemoryStore();
    const { session } = await createSession(undefined, storage);
    await session.thread.create();
    await session.model.switch('openai/gpt-4o', { thinkingLevel: 'low' });
    const memory = (await storage.getStore('memory'))!;
    const read = memory.getThreadById.bind(memory);
    let release = () => {};
    let entered = () => {};
    const readStarted = new Promise<void>(resolve => {
      entered = resolve;
    });
    const readGate = new Promise<void>(resolve => {
      release = resolve;
    });
    vi.spyOn(memory, 'getThreadById').mockImplementationOnce(async args => {
      const staleThread = await read(args);
      entered();
      await readGate;
      return staleThread;
    });
    const restoring = session.thread.loadMetadata();
    await readStarted;
    await session.model.switch('openai/gpt-5.5', { thinkingLevel: 'high' });
    release();
    await restoring;
    expect(session.model.get()).toBe('openai/gpt-5.5');
    expect(session.state.get().thinkingLevel).toBe('high');
    expect(await session.thread.getSetting({ key: 'thinkingLevel' })).toBe('high');
  });

  it.each(['high', undefined] as const)(
    'preserves concurrent thinking updates to %s during model-only saves',
    async thinkingLevel => {
      const storage = new InMemoryStore();
      const { session } = await createSession(undefined, storage);
      await session.thread.create();
      await session.model.switch('openai/gpt-4o', { thinkingLevel: 'low' });
      const memory = (await storage.getStore('memory'))!;
      const save = memory.saveThread.bind(memory);
      let release = () => {};
      let entered = () => {};
      const saveStarted = new Promise<void>(resolve => {
        entered = resolve;
      });
      const saveGate = new Promise<void>(resolve => {
        release = resolve;
      });
      vi.spyOn(memory, 'saveThread').mockImplementationOnce(async args => {
        entered();
        await saveGate;
        return save(args);
      });
      const switching = session.model.switch('openai/gpt-5.5');
      await saveStarted;
      const thinking = session.state.set({ thinkingLevel });
      release();
      await Promise.all([switching, thinking]);
      expect(session.model.get()).toBe('openai/gpt-5.5');
      expect(session.state.get().thinkingLevel).toBe(thinkingLevel);
      expect(await session.thread.getSetting({ key: 'currentModelId' })).toBe('openai/gpt-5.5');
      expect(await session.thread.getSetting({ key: 'thinkingLevel' })).toBe(thinkingLevel);
    },
  );

  it('restores schema prerequisites before persisted thinking', async () => {
    const storage = new InMemoryStore();
    const { session } = await createSession(undefined, storage);
    const thread = await session.thread.create();
    await session.model.switch('openai/gpt-5.5', { thinkingLevel: 'high' });
    await session.thread.setSetting({ key: 'observerModelId', value: 'openai/gpt-4o' });
    const schema = z
      .object({
        thinkingLevel: z.enum(['off', 'low', 'medium', 'high', 'xhigh', 'max']).optional(),
        observerModelId: z.string().optional(),
      })
      .refine(state => state.thinkingLevel !== 'high' || !!state.observerModelId);
    const { session: restored } = await createSession(undefined, storage, schema);
    await restored.thread.switch({ threadId: thread.id });
    expect(restored.model.get()).toBe('openai/gpt-5.5');
    expect(restored.state.get()).toMatchObject({ thinkingLevel: 'high', observerModelId: 'openai/gpt-4o' });
  });

  it('restores the model when a narrowed state schema rejects saved OM overrides', async () => {
    const storage = new InMemoryStore();
    const { session } = await createSession(undefined, storage);
    const thread = await session.thread.create();
    await session.model.switch('openai/gpt-5.5', { thinkingLevel: 'high' });
    await session.thread.setSetting({ key: 'observerModelId', value: 'openai/gpt-4o' });
    const schema = z
      .object({ thinkingLevel: z.enum(['off', 'low', 'medium', 'high', 'xhigh', 'max']).optional() })
      .strict();
    const { session: restored } = await createSession(undefined, storage, schema);
    await restored.thread.switch({ threadId: thread.id });
    expect(restored.model.get()).toBe('openai/gpt-5.5');
    expect(restored.state.get().thinkingLevel).toBe('high');
  });

  it('serializes token-usage persistence with a paired model switch', async () => {
    const storage = new InMemoryStore();
    const { controller, session } = await createSession(undefined, storage);
    await session.thread.create();
    await session.model.switch('openai/gpt-4o', { thinkingLevel: 'low' });
    session.setTokenUsage({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    const memory = (await storage.getStore('memory'))!;
    const save = memory.saveThread.bind(memory);
    let release = () => {};
    let entered = () => {};
    const saveStarted = new Promise<void>(resolve => {
      entered = resolve;
    });
    const saveGate = new Promise<void>(resolve => {
      release = resolve;
    });
    const saveSpy = vi.spyOn(memory, 'saveThread').mockImplementationOnce(async args => {
      entered();
      await saveGate;
      return save(args);
    });
    const persisting = controller['persistTokenUsage'](session);
    await saveStarted;
    const switching = session.model.switch('openai/gpt-5.5', { thinkingLevel: 'high' });
    try {
      await new Promise<void>(resolve => setImmediate(resolve));
      expect(saveSpy).toHaveBeenCalledTimes(1);
    } finally {
      release();
    }
    await Promise.all([persisting, switching]);
    expect(await session.thread.getSetting({ key: 'currentModelId' })).toBe('openai/gpt-5.5');
    expect(await session.thread.getSetting({ key: 'thinkingLevel' })).toBe('high');
    expect(await session.thread.getSetting({ key: 'tokenUsage' })).toEqual(session.getTokenUsage());
  });

  it('tracks model selection via modelUseCountTracker', async () => {
    const trackModelUse = vi.fn<(modelId: string) => void>();
    const { session } = await createSession(trackModelUse);

    await session.model.switch('openai/gpt-5.3-codex');

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

    await session.model.switch('anthropic/claude-sonnet-4');

    expect(session.model.displayName()).toBe('claude-sonnet-4');
  });

  it('returns the whole id when there is no provider prefix', async () => {
    const { session } = await createSession();

    await session.model.switch('gpt-4o');

    expect(session.model.displayName()).toBe('gpt-4o');
  });
});
