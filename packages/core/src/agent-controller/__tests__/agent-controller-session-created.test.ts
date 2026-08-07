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
