import { describe, expect, it } from 'vitest';

import { Harness } from './harness';
import type { Session } from './session';
import type { HarnessConfig, HarnessEvent } from './types';

async function createSession<TState extends Record<string, unknown>>(
  config: Partial<HarnessConfig<TState>> = {},
): Promise<{ harness: Harness<TState>; session: Session<TState> }> {
  const harness = new Harness<TState>({
    id: 'test-harness',
    modes: [{ id: 'build', defaultModelId: 'test-model' }],
    ...config,
  } as HarnessConfig<TState>);
  await harness.init();
  const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });
  return { harness, session };
}

describe('Harness session state', () => {
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
    const events: HarnessEvent[] = [];
    session.subscribe((event: HarnessEvent) => {
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
    const { harness, session } = await createSession<{ count: number }>({ initialState: { count: 0 } });

    const requestContext = await (
      harness as unknown as {
        buildRequestContext: (session: Session<{ count: number }>) => Promise<{ get: (key: string) => unknown }>;
      }
    ).buildRequestContext(session);
    const harnessContext = requestContext.get('harness') as {
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

    expect(harnessContext.state).toEqual({ count: 0 });

    await harnessContext.session.state.set({ count: 2 });
    expect(harnessContext.state).toEqual({ count: 0 });
    expect(harnessContext.getState()).toEqual({ count: 2 });

    await harnessContext.setState({ count: 3 });
    const previous = await harnessContext.updateState(state => ({
      updates: { count: state.count + 1 },
      result: state.count,
    }));

    expect(previous).toBe(3);
    expect(harnessContext.session.state.get()).toEqual({ count: 4 });
  });
});
