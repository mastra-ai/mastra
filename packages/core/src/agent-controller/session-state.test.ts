import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { AgentController } from './agent-controller';
import type { Session } from './session';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerConfig, AgentControllerEvent } from './types';

async function createSession<TState extends Record<string, unknown>>(
  config: Partial<AgentControllerConfig<TState>> = {},
): Promise<{ controller: AgentController<TState>; session: Session<TState> }> {
  const controller = new AgentController<TState>({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    modes: [{ id: 'build', defaultModelId: 'test-model' }],
    ...config,
  } as AgentControllerConfig<TState>);
  await controller.init();
  const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  return { controller, session };
}

function retainState<TState>(session: Session<TState>) {
  return (
    session.state as typeof session.state & {
      retain(): typeof session.state & { release(): void };
    }
  ).retain();
}

describe('AgentController session state', () => {
  it.each(['set', 'update', 'setIf'] as const)(
    'fences %s across async validation while preserving host writes',
    async method => {
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const { session } = await createSession({
        initialState: { thinkingLevel: 'low', count: 0 },
        stateSchema: z.object({ thinkingLevel: z.string(), count: z.number() }).superRefine(async state => {
          if (state.thinkingLevel === 'high') {
            entered.resolve();
            await release.promise;
          }
        }),
      });
      session.thread.set({ threadId: 'a' });
      const events: AgentControllerEvent[] = [];
      session.subscribe(event => {
        events.push(event);
      });
      const updates = { thinkingLevel: 'high', count: 1 };
      const write =
        method === 'update'
          ? session.state.update(() => ({ updates, events: [{ type: 'agent_end' }], result: undefined }))
          : method === 'setIf'
            ? session.state.setIf(updates, () => true)
            : session.state.set(updates);
      await entered.promise;
      session.thread.set({ threadId: 'b' });
      events.length = 0;
      release.resolve();
      await write;
      expect(session.state.get()).toEqual({ thinkingLevel: 'low', count: 1 });
      expect(events.filter(event => event.type === 'state_changed')).toEqual([
        { type: 'state_changed', state: { thinkingLevel: 'low', count: 1 }, changedKeys: ['count'] },
      ]);
      expect(events.some(event => event.type === 'agent_end')).toBe(false);
    },
  );

  it('uses source values for queued updaters and shares their order with active writes', async () => {
    const { session } = await createSession({ initialState: { thinkingLevel: 'low', count: 0 } });
    session.thread.set({ threadId: 'a' });
    const source = retainState(session);
    await session.state.set({ thinkingLevel: 'high' });
    expect(source.get().thinkingLevel).toBe('high');
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const first = session.state.update(async () => {
      entered.resolve();
      await release.promise;
      return { updates: { thinkingLevel: 'medium' }, result: undefined };
    });
    await entered.promise;
    const seen: string[] = [];
    const second = source.update(state => {
      seen.push(state.thinkingLevel);
      return { updates: { thinkingLevel: 'max', count: state.count + 1 }, result: undefined };
    });
    session.thread.set({ threadId: 'b' });
    release.resolve();
    await Promise.all([first, second]);
    expect(seen).toEqual(['medium']);
    expect(session.state.get()).toEqual({ thinkingLevel: 'low', count: 1 });
    session.thread.set({ threadId: 'a' });
    expect(session.state.get()).toEqual({ thinkingLevel: 'max', count: 1 });
    await session.state.set({ thinkingLevel: 'high' });
    expect(source.get().thinkingLevel).toBe('high');
    source.release();
  });

  it('reattaches A during validation and publishes its latest committed state', async () => {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const { session } = await createSession({
      initialState: { thinkingLevel: 'low' },
      stateSchema: z.object({ thinkingLevel: z.string() }).superRefine(async state => {
        if (state.thinkingLevel === 'high') {
          entered.resolve();
          await release.promise;
        }
      }),
    });
    session.thread.set({ threadId: 'a' });
    const write = session.state.set({ thinkingLevel: 'high' });
    await entered.promise;
    session.thread.set({ threadId: 'b' });
    session.thread.set({ threadId: 'a' });
    release.resolve();
    await write;
    expect(session.state.get().thinkingLevel).toBe('high');
  });

  it('cancels a guarded write after validation without partially applying it', async () => {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const { session } = await createSession({
      initialState: { thinkingLevel: 'low', count: 0 },
      stateSchema: z.object({ thinkingLevel: z.string(), count: z.number() }).superRefine(async state => {
        if (state.count === 1) {
          entered.resolve();
          await release.promise;
        }
      }),
    });
    let eligible = true;
    const write = session.state.setIf({ thinkingLevel: 'high', count: 1 }, () => eligible);
    await entered.promise;
    eligible = false;
    release.resolve();
    await expect(write).resolves.toBe(false);
    expect(session.state.get()).toEqual({ thinkingLevel: 'low', count: 0 });
  });

  it('rejects late validation without persisting or emitting a partial host update', async () => {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const { session } = await createSession({
      initialState: { thinkingLevel: 'low', count: 0 },
      stateSchema: z.object({ thinkingLevel: z.string(), count: z.number() }).superRefine(async (state, ctx) => {
        if (state.count === 1) {
          entered.resolve();
          await release.promise;
          ctx.addIssue({ code: 'custom', message: 'rejected after navigation' });
        }
      }),
    });
    session.thread.set({ threadId: 'a' });
    const persist = vi.spyOn(session.thread, 'setSettingOn');
    const listener = vi.fn();
    session.subscribe(listener);
    const write = session.state.set({ thinkingLevel: 'high', count: 1 });
    const rejected = expect(write).rejects.toThrow('rejected after navigation');
    await entered.promise;
    session.thread.set({ threadId: 'b' });
    listener.mockClear();
    release.resolve();
    await rejected;
    expect(session.state.get()).toEqual({ thinkingLevel: 'low', count: 0 });
    expect(persist).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'state_changed' }));
    persist.mockRestore();
  });

  it('keeps model and thinking callbacks cancelled when navigation happens during commit', async () => {
    const { session } = await createSession({ initialState: { thinkingLevel: 'low' } });
    session.thread.set({ threadId: 'a' });
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const applyModel = vi.fn();
    const state = session.state as typeof session.state & {
      setWithCommit(
        updates: { thinkingLevel: string },
        commit: () => Promise<void>,
        eligible: () => boolean,
        apply: () => void,
      ): Promise<boolean>;
    };
    const write = state.setWithCommit(
      { thinkingLevel: 'high' },
      async () => {
        entered.resolve();
        await release.promise;
      },
      () => session.thread.getId() === 'a',
      applyModel,
    );
    await entered.promise;
    session.thread.set({ threadId: 'b' });
    release.resolve();
    await expect(write).resolves.toBe(false);
    expect(applyModel).not.toHaveBeenCalled();
    expect(session.state.get().thinkingLevel).toBe('low');
  });

  it('validates transformed preferences against A, not the active B values', async () => {
    const { session } = await createSession({
      initialState: { thinkingLevel: 'low', notifications: false, count: 0 },
      stateSchema: z
        .object({
          thinkingLevel: z.string().transform(value => value.toLowerCase()),
          notifications: z.boolean(),
          count: z.number(),
        })
        .refine(state => state.thinkingLevel !== 'high' || state.notifications, 'High requires notifications'),
    });
    session.thread.set({ threadId: 'a' });
    await session.state.set({ notifications: true });
    const source = retainState(session);
    session.thread.set({ threadId: 'b' });
    await source.set({ thinkingLevel: 'HIGH' });
    expect(source.get()).toEqual({ thinkingLevel: 'high', notifications: true, count: 0 });
    expect(session.state.get()).toEqual({ thinkingLevel: 'low', notifications: false, count: 0 });
    await expect(source.set({ notifications: false, count: 2 })).rejects.toThrow('High requires notifications');
    expect(source.get()).toEqual({ thinkingLevel: 'high', notifications: true, count: 0 });
    expect(session.state.get().count).toBe(0);
    source.release();
  });

  it('routes parked updater effects without ending or populating the active display', async () => {
    const { session } = await createSession({ initialState: { thinkingLevel: 'low' } });
    session.thread.set({ threadId: 'a' });
    const source = retainState(session);
    session.thread.set({ threadId: 'b' });
    session.emit({ type: 'agent_start' });
    const listener = vi.fn();
    session.subscribe(listener);
    await source.update(() => ({
      result: undefined,
      events: [
        { type: 'agent_end' },
        { type: 'tool_start', toolCallId: 'a-tool', toolName: 'test', args: {} },
        {
          type: 'tool_suspended',
          toolCallId: 'a-prompt',
          toolName: 'test',
          args: {},
          suspendPayload: {},
          runId: 'a-run',
        },
        { type: 'workspace_ready', workspaceId: 'workspace', workspaceName: 'Shared workspace' },
      ],
    }));
    expect(session.displayState.get().isRunning).toBe(true);
    expect(session.displayState.get().activeTools.size).toBe(0);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tool_suspended', threadId: 'a', resourceId: session.identity.getResourceId() }),
    );
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'workspace_ready' }));
    source.release();
  });

  it('initializes from schema defaults plus initialState', async () => {
    const { session } = await createSession<{ count: number; label: string }>({
      stateSchema: {
        type: 'object',
        properties: {
          count: { type: 'number', default: 1 },
          label: { type: 'string', default: 'idle' },
        },
        required: ['count', 'label'],
      },
      initialState: { label: 'ready' },
    });

    expect(session.state.get()).toEqual({ count: 1, label: 'ready' });
    expect(session.state.get()).toEqual({ count: 1, label: 'ready' });
  });

  it('get() returns a shallow snapshot', async () => {
    const { session } = await createSession<{ count: number }>({ initialState: { count: 1 } });

    const snapshot = session.state.get() as { count: number };
    snapshot.count = 99;

    expect(session.state.get()).toEqual({ count: 1 });
  });

  it('validates set() updates and emits state_changed events', async () => {
    const { session } = await createSession<{ count: number }>({
      stateSchema: {
        type: 'object',
        properties: { count: { type: 'number', default: 0 } },
        required: ['count'],
      },
    });
    const events: AgentControllerEvent[] = [];
    session.subscribe((event: AgentControllerEvent) => {
      events.push(event);
    });

    await session.state.set({ count: 1 });

    expect(session.state.get()).toEqual({ count: 1 });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'state_changed', state: { count: 1 }, changedKeys: ['count'] }),
    );
  });

  it('does not mutate current state when validation fails', async () => {
    const { session } = await createSession<{ count: number }>({
      stateSchema: {
        type: 'object',
        properties: { count: { type: 'number', default: 0 } },
        required: ['count'],
      },
    });

    await session.state.set({ count: 1 });
    await expect(session.state.set({ count: 'bad' as never })).rejects.toThrow('Invalid state update');

    expect(session.state.get()).toEqual({ count: 1 });
  });

  it('serializes queued updates in order', async () => {
    const { session } = await createSession<{ count: number }>({ initialState: { count: 0 } });
    const observed: number[] = [];
    let releaseFirst!: () => void;

    const first = session.state.update(async state => {
      observed.push(state.count);
      await new Promise<void>(resolve => {
        releaseFirst = resolve;
      });
      return { updates: { count: state.count + 1 }, result: 'first' };
    });
    const second = session.state.update(state => {
      observed.push(state.count);
      return { updates: { count: state.count + 1 }, result: 'second' };
    });

    await Promise.resolve();
    expect(observed).toEqual([0]);

    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toEqual(['first', 'second']);

    expect(observed).toEqual([0, 1]);
    expect(session.state.get()).toEqual({ count: 2 });
  });

  it('exposes session.state and deprecated flattened state accessors in request context', async () => {
    const { controller, session } = await createSession<{ count: number }>({ initialState: { count: 0 } });

    const requestContext = await (
      controller as unknown as {
        buildRequestContext: (session: Session<{ count: number }>) => Promise<{ get: (key: string) => unknown }>;
      }
    ).buildRequestContext(session);
    const controllerContext = requestContext.get('controller') as {
      state: Readonly<{ count: number }>;
      getState: () => Readonly<{ count: number }>;
      setState: (updates: Partial<{ count: number }>) => Promise<void>;
      updateState: <TResult>(
        updater: (state: Readonly<{ count: number }>) => { updates?: Partial<{ count: number }>; result: TResult },
      ) => Promise<TResult>;
      session: {
        state: {
          get: () => Readonly<{ count: number }>;
          set: (updates: Partial<{ count: number }>) => Promise<void>;
          update: <TResult>(
            updater: (state: Readonly<{ count: number }>) => { updates?: Partial<{ count: number }>; result: TResult },
          ) => Promise<TResult>;
        };
      };
    };

    expect(controllerContext.state).toEqual({ count: 0 });

    await controllerContext.session.state.set({ count: 2 });
    expect(controllerContext.state).toEqual({ count: 0 });
    expect(controllerContext.getState()).toEqual({ count: 2 });

    await controllerContext.setState({ count: 3 });
    const previous = await controllerContext.updateState(state => ({
      updates: { count: state.count + 1 },
      result: state.count,
    }));

    expect(previous).toBe(3);
    expect(controllerContext.session.state.get()).toEqual({ count: 4 });
  });
});
