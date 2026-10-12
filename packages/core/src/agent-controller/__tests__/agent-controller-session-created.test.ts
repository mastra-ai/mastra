import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { InMemoryStore } from '../../storage/mock';
import { createMockModel } from '../../test-utils/llm-mock';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

function createController(storage: InMemoryStore) {
  const workspace = createMockWorkspace();
  const agent = new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: createMockModel({ mockText: 'ok' }),
  });

  return {
    controller: new AgentController({
      id: 'test-controller',
      storage,
      workspace,
      modes: [{ id: 'build', name: 'Build', default: true, agent, defaultModelId: 'openai/gpt-4o' }],
    }),
    workspace,
  };
}

describe('AgentController.onSessionCreated', () => {
  it('notifies with a fully initialized session', async () => {
    const { controller, workspace } = createController(new InMemoryStore());
    await controller.init();
    const created: Awaited<ReturnType<typeof controller.createSession>>[] = [];
    controller.onSessionCreated(session => {
      created.push(session);
    });

    const session = await controller.createSession({ resourceId: 'resource-1' });

    expect(created).toEqual([session]);
    expect(session.thread.requireId()).toBeDefined();
    expect(session.getWorkspace()).toBe(workspace);
    expect(session.identity.getResourceId()).toBe('resource-1');
  });

  it('notifies when a stored thread is materialized by a new controller', async () => {
    const storage = new InMemoryStore();
    const first = createController(storage);
    await first.controller.init();
    const firstSession = await first.controller.createSession({ resourceId: 'resource-1' });
    const threadId = firstSession.thread.requireId();

    const restarted = createController(storage);
    await restarted.controller.init();
    const created: Awaited<ReturnType<typeof restarted.controller.createSession>>[] = [];
    restarted.controller.onSessionCreated(session => {
      created.push(session);
    });

    const resumed = await restarted.controller.createSession({ resourceId: 'resource-1' });

    expect(created).toEqual([resumed]);
    expect(resumed.thread.requireId()).toBe(threadId);
  });

  it('notifies once for cached and concurrent get-or-create calls', async () => {
    const { controller } = createController(new InMemoryStore());
    await controller.init();
    const created: Awaited<ReturnType<typeof controller.createSession>>[] = [];
    controller.onSessionCreated(session => {
      created.push(session);
    });

    const [first, second, third] = await Promise.all([
      controller.createSession({ resourceId: 'resource-1' }),
      controller.createSession({ resourceId: 'resource-1' }),
      controller.createSession({ resourceId: 'resource-1' }),
    ]);
    const cached = await controller.createSession({ resourceId: 'resource-1' });

    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(third).toBe(cached);
    expect(created).toEqual([first]);
  });

  it('stops notifications after unsubscribe and isolates listener failures', async () => {
    const { controller } = createController(new InMemoryStore());
    await controller.init();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const received = vi.fn();
    controller.onSessionCreated(() => {
      throw new Error('sync failure');
    });
    controller.onSessionCreated(async () => {
      throw new Error('async failure');
    });
    const unsubscribe = controller.onSessionCreated(received);

    await controller.createSession({ resourceId: 'resource-1' });
    await Promise.resolve();
    unsubscribe();
    await controller.createSession({ resourceId: 'resource-2' });

    expect(received).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(4);
    error.mockRestore();
  });

  it('awaits blocking listeners before createSession resolves, without blocking on fire-and-forget ones', async () => {
    const { controller } = createController(new InMemoryStore());
    await controller.init();
    let releaseBlocking: (() => void) | undefined;
    let blockingSettled = false;
    controller.onSessionCreated(
      () =>
        new Promise<void>(resolve => {
          releaseBlocking = () => {
            blockingSettled = true;
            resolve();
          };
        }),
      { blocking: true },
    );
    // A never-resolving fire-and-forget listener must not delay creation.
    controller.onSessionCreated(() => new Promise<void>(() => {}));

    let created = false;
    const creation = controller.createSession({ resourceId: 'resource-1' }).then(session => {
      created = true;
      return session;
    });
    await vi.waitFor(() => expect(releaseBlocking).toBeDefined());
    expect(created).toBe(false);

    releaseBlocking?.();
    await creation;
    expect(blockingSettled).toBe(true);
    expect(created).toBe(true);
  });

  it('runs blocking listeners sequentially in registration order before fire-and-forget ones', async () => {
    const { controller } = createController(new InMemoryStore());
    await controller.init();
    const order: string[] = [];
    controller.onSessionCreated(() => {
      order.push('plain');
    });
    controller.onSessionCreated(
      async () => {
        order.push('blocking-1:start');
        await Promise.resolve();
        order.push('blocking-1:end');
      },
      { blocking: true },
    );
    controller.onSessionCreated(
      async () => {
        order.push('blocking-2');
      },
      { blocking: true },
    );

    await controller.createSession({ resourceId: 'resource-1' });

    expect(order).toEqual(['blocking-1:start', 'blocking-1:end', 'blocking-2', 'plain']);
  });

  it('makes concurrent get-or-create callers await the same blocking initialization', async () => {
    const { controller } = createController(new InMemoryStore());
    await controller.init();
    let release: (() => void) | undefined;
    controller.onSessionCreated(
      () =>
        new Promise<void>(resolve => {
          release = resolve;
        }),
      { blocking: true },
    );

    let settledCount = 0;
    const creations = [
      controller.createSession({ resourceId: 'resource-1' }),
      controller.createSession({ resourceId: 'resource-1' }),
      controller.createSession({ resourceId: 'resource-1' }),
    ].map(promise =>
      promise.then(session => {
        settledCount += 1;
        return session;
      }),
    );
    await vi.waitFor(() => expect(release).toBeDefined());
    expect(settledCount).toBe(0);

    release?.();
    const [first, second, third] = await Promise.all(creations);
    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(settledCount).toBe(3);
  });

  it('removes only one registration when the same listener is registered twice', async () => {
    const { controller } = createController(new InMemoryStore());
    await controller.init();
    const listener = vi.fn();
    controller.onSessionCreated(listener);
    const unsubscribeSecond = controller.onSessionCreated(listener);
    unsubscribeSecond();

    await controller.createSession({ resourceId: 'resource-1' });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('isolates blocking listener failures instead of failing createSession', async () => {
    const { controller } = createController(new InMemoryStore());
    await controller.init();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    controller.onSessionCreated(
      async () => {
        throw new Error('blocking failure');
      },
      { blocking: true },
    );

    const session = await controller.createSession({ resourceId: 'resource-1' });

    expect(session).toBeDefined();
    expect(error).toHaveBeenCalledWith('Error in session-created listener:', expect.any(Error));
    error.mockRestore();
  });

  it('reports threadCreated for a brand-new thread and not for a resumed one', async () => {
    const storage = new InMemoryStore();
    const first = createController(storage);
    await first.controller.init();
    const firstContexts: unknown[] = [];
    first.controller.onSessionCreated((_session, context) => {
      firstContexts.push(context);
    });
    const created = await first.controller.createSession({ resourceId: 'resource-1' });
    expect(firstContexts).toEqual([{ threadCreated: true }]);

    const restarted = createController(storage);
    await restarted.controller.init();
    const restartedContexts: unknown[] = [];
    restarted.controller.onSessionCreated((_session, context) => {
      restartedContexts.push(context);
    });
    const resumed = await restarted.controller.createSession({ resourceId: 'resource-1' });
    expect(resumed.thread.requireId()).toBe(created.thread.requireId());
    expect(restartedContexts).toEqual([{ threadCreated: false }]);
  });

  it('reports threadCreated for an exact thread id only when that thread did not exist', async () => {
    const storage = new InMemoryStore();
    const first = createController(storage);
    await first.controller.init();
    const firstContexts: unknown[] = [];
    first.controller.onSessionCreated(
      (_session, context) => {
        firstContexts.push(context);
      },
      { blocking: true },
    );
    await first.controller.createSession({ resourceId: 'resource-1', threadId: 'thread-new' });
    expect(firstContexts).toEqual([{ threadCreated: true }]);

    const restarted = createController(storage);
    await restarted.controller.init();
    const restartedContexts: unknown[] = [];
    restarted.controller.onSessionCreated(
      (_session, context) => {
        restartedContexts.push(context);
      },
      { blocking: true },
    );
    const resumed = await restarted.controller.createSession({ resourceId: 'resource-1', threadId: 'thread-new' });
    expect(resumed.thread.requireId()).toBe('thread-new');
    expect(restartedContexts).toEqual([{ threadCreated: false }]);
  });

  it('reports threadCreated false when no initial thread is created', async () => {
    const { controller } = createController(new InMemoryStore());
    await controller.init();
    const contexts: unknown[] = [];
    controller.onSessionCreated((_session, context) => {
      contexts.push(context);
    });

    const session = await controller.createSession({ resourceId: 'resource-1', createInitialThread: false });

    expect(session.thread.getId()).toBeNull();
    expect(contexts).toEqual([{ threadCreated: false }]);
  });

  it('awaits before-agent-end listeners before exposing the terminal event', async () => {
    const { controller } = createController(new InMemoryStore());
    await controller.init();
    const session = await controller.createSession({ resourceId: 'resource-1' });
    const events: string[] = [];
    let release: (() => void) | undefined;
    session.subscribe(event => {
      if (event.type === 'agent_end') events.push(event.reason ?? 'complete');
    });
    session.onBeforeAgentEnd(
      () =>
        new Promise<void>(resolve => {
          release = resolve;
        }),
    );

    const completion = session.finishAgentRun('complete');
    await Promise.resolve();
    expect(events).toEqual([]);

    release?.();
    await completion;
    expect(events).toEqual(['complete']);
  });
});
