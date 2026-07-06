import { describe, expect, it } from 'vitest';

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

describe('AgentController session state', () => {
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
