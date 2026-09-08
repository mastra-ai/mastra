import { describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../../request-context';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

function createSubscription(activeRunId: () => string | null) {
  return {
    stream: [],
    activeRunId: vi.fn(activeRunId),
    abort: vi.fn(),
    unsubscribe: vi.fn(),
  };
}

function createAgentMock(activeRunId: () => string | null) {
  let mastra: unknown;
  return {
    id: 'agent-1',
    getMastraInstance: vi.fn(() => mastra),
    __setLogger: vi.fn(),
    __registerMastra: vi.fn((nextMastra: unknown) => {
      mastra = nextMastra;
    }),
    __registerPrimitives: vi.fn(),
    getConfiguredProcessorWorkflows: vi.fn(async () => []),
    listScorers: vi.fn(async () => []),
    getChannels: vi.fn(() => null),
    subscribeToThread: vi.fn(async () => createSubscription(activeRunId)),
    subscribeQueuedMessages: vi.fn((_scope, listener) => {
      listener({ count: 0 });
      return vi.fn();
    }),
    sendSignal: vi.fn((signal: any, _options?: any) => ({
      accepted: Promise.resolve({ action: 'deliver' as const, runId: 'run-1' }),
      signal,
    })),
    sendMessage: vi.fn((message: any, _options?: any) => ({
      accepted: Promise.resolve({ action: 'deliver' as const, runId: 'run-1' }),
      signal: message,
    })),
    queueMessage: vi.fn((message: any, _options?: any) => ({
      accepted: Promise.resolve({ action: 'deliver' as const, runId: 'run-1' }),
      signal: message,
    })),
  };
}

describe('AgentController signal messages', () => {
  it('captures active signal intent before async acceptance can observe an idle subscription', async () => {
    let activeRunId: string | null = 'run-1';
    const agent = createAgentMock(() => activeRunId);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-1',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const threadId = session.thread.getId()!;
    const subscription = createSubscription(() => activeRunId);

    session.run.ensureAbortController();
    session.run.setRunId({ runId: 'run-1' });
    session.stream.attach({ subscription: subscription as any, key: `agent-1:resource-1:${threadId}` });
    agent.subscribeToThread.mockClear();

    const result = session.sendSignal({
      content: 'steer while active',
      ifActive: { attributes: { path: 'active' } },
      ifIdle: { attributes: { path: 'idle' } },
    });
    activeRunId = null;

    await expect(result.accepted).resolves.toEqual({ accepted: true, runId: 'run-1' });
    expect(agent.subscribeToThread).not.toHaveBeenCalled();
    expect(agent.sendSignal).toHaveBeenCalledTimes(1);
    expect(agent.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ contents: 'steer while active' }),
      expect.objectContaining({
        resourceId: 'resource-1',
        threadId,
        ifActive: { attributes: { path: 'active' } },
        ifIdle: { attributes: { path: 'idle' } },
      }),
    );
  });

  it('declines an armed approval with interruption context before delivering a user signal', async () => {
    let activeRunId: string | null = 'run-1';
    const agent = createAgentMock(() => activeRunId);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-approval-interrupt',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const threadId = session.thread.getId()!;
    const subscription = createSubscription(() => activeRunId);

    session.run.ensureAbortController();
    session.run.setRunId({ runId: 'run-1' });
    session.stream.attach({ subscription: subscription as any, key: `agent-1:resource-1:${threadId}` });
    const approval = session.approval.arm({ toolName: 'request_access' });

    const result = session.sendSignal({ content: 'actually do this first' });

    await expect(approval).resolves.toEqual({
      decision: 'decline',
      requestContext: undefined,
      declineContext: {
        reason: 'interrupted_by_user_message',
        message: 'The pending tool approval was declined because the user sent a new message.',
      },
    });
    await expect(result.accepted).resolves.toEqual({ accepted: true, runId: 'run-1' });
    expect(agent.sendSignal).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh run for a signal sent while a deferred abort is still tearing down', async () => {
    const activeRunId: string | null = 'run-1';
    const agent = createAgentMock(() => activeRunId);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-deferred-abort-signal',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const threadId = session.thread.getId()!;
    const subscription = createSubscription(() => activeRunId);

    session.run.ensureAbortController();
    session.run.setRunId({ runId: 'run-1' });
    session.stream.attach({ subscription: subscription as any, key: `agent-1:resource-1:${threadId}` });
    void session.approval.arm({ toolName: 'request_access' });

    // Aborting a parked approval gate defers the teardown until the gated call
    // has been declined, which keeps the AbortController armed — so the run
    // still looks "running" even though it is on its way out.
    session.abort();
    expect(session.run.isRunning()).toBe(true);
    expect(session.run.isAbortRequested()).toBe(true);
    agent.sendSignal.mockClear();

    await session.sendSignal({ content: 'try again' }).accepted;

    // Joining the dying run would lose the message: `completeDeferredAbort()`
    // terminates it once the decline lands. Only the new-run path supplies the
    // stream options the agent needs to start a run, so their presence proves
    // the signal was not routed onto the run that is going away.
    expect(agent.sendSignal).toHaveBeenCalledTimes(1);
    expect(agent.sendSignal.mock.calls[0]![1]).toEqual(
      expect.objectContaining({ ifIdle: expect.objectContaining({ streamOptions: expect.anything() }) }),
    );
  });

  it('surfaces idle message submission failures instead of waiting forever for agent_end', async () => {
    const agent = createAgentMock(() => null);
    agent.sendMessage.mockReturnValue({
      accepted: Promise.reject(new Error('message failed before stream started')),
      signal: { id: 'signal-1', type: 'user' },
    } as any);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-idle-message-failure',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    await expect(session.sendMessage({ content: 'hello' })).rejects.toThrow('message failed before stream started');
  });

  it('delegates active messages to Agent.sendMessage without aborting the run', async () => {
    let activeRunId: string | null = 'run-1';
    const agent = createAgentMock(() => activeRunId);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-active-message',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const threadId = session.thread.getId()!;
    session.run.ensureAbortController();
    session.run.setRunId({ runId: 'run-1' });
    session.stream.attach({
      subscription: createSubscription(() => activeRunId) as any,
      key: `agent-1:resource-1:${threadId}`,
    });
    agent.sendMessage.mockClear();

    await session.sendMessage({ content: 'continue with the fix' });

    expect(session.run.isAbortRequested()).toBe(false);
    expect(agent.sendMessage).toHaveBeenCalledWith(
      { contents: 'continue with the fix', attributes: { delivery: 'while-active' } },
      expect.objectContaining({ resourceId: 'resource-1', threadId }),
    );
  });

  it('delegates queued messages with files and request context to Agent.queueMessage', async () => {
    const activeRunId: string | null = 'run-1';
    const agent = createAgentMock(() => activeRunId);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-queued-message',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const threadId = session.thread.getId()!;
    session.run.ensureAbortController();
    session.run.setRunId({ runId: 'run-1' });
    session.stream.attach({
      subscription: createSubscription(() => activeRunId) as any,
      key: `agent-1:resource-1:${threadId}`,
    });
    const requestContext = new RequestContext();
    const tracingContext = {} as any;
    const tracingOptions = {} as any;

    await session.queueMessage({
      content: 'run this after the current task',
      files: [{ data: 'hello', mediaType: 'text/plain', filename: 'notes.txt' }],
      requestContext,
      tracingContext,
      tracingOptions,
    });

    expect(agent.queueMessage).toHaveBeenCalledWith(
      [
        { type: 'text', text: 'run this after the current task' },
        { type: 'text', text: '[File: notes.txt]\n```\nhello\n```' },
      ],
      expect.objectContaining({
        resourceId: 'resource-1',
        threadId,
        ifIdle: expect.objectContaining({
          streamOptions: expect.objectContaining({
            requestContext: expect.any(RequestContext),
            tracingContext,
            tracingOptions,
          }),
        }),
      }),
    );
    const queuedRequestContext = (agent.queueMessage.mock.calls[0]?.[1] as any).ifIdle.streamOptions.requestContext;
    expect(queuedRequestContext).not.toBe(requestContext);
    expect(requestContext.get('controller')).toBeUndefined();
  });

  it('propagates an idle queued-message submission failure', async () => {
    const agent = createAgentMock(() => null);
    agent.queueMessage.mockReturnValue({
      accepted: Promise.reject(new Error('queued message failed before stream started')),
      signal: { id: 'signal-1', type: 'user' },
    } as any);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-idle-queued-message-failure',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    await expect(session.queueMessage({ content: 'hello' })).rejects.toThrow(
      'queued message failed before stream started',
    );
  });

  it('waits for agent_end when an idle message starts a run', async () => {
    const agent = createAgentMock(() => null);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-idle-message-completion',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    let settled = false;
    const message = session.sendMessage({ content: 'start a fresh run' }).then(() => {
      settled = true;
    });
    await vi.waitFor(() => expect(agent.sendMessage).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(settled).toBe(false);

    session.emit({ type: 'agent_end', reason: 'complete' });
    await message;
    expect(settled).toBe(true);
  });

  it('starts an idle queued message immediately but waits for its run to finish', async () => {
    const agent = createAgentMock(() => null);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-idle-queued-message',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    let settled = false;
    const queued = session.queueMessage({ content: 'start immediately while idle' }).then(() => {
      settled = true;
    });
    await vi.waitFor(() => expect(agent.queueMessage).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(agent.queueMessage.mock.calls[0]![1]).toEqual(
      expect.objectContaining({ ifIdle: expect.objectContaining({ streamOptions: expect.anything() }) }),
    );

    session.emit({ type: 'agent_end', reason: 'complete' });
    await queued;
    expect(settled).toBe(true);
  });

  it('delegates active queued messages in FIFO submission order', async () => {
    const activeRunId: string | null = 'run-1';
    const agent = createAgentMock(() => activeRunId);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-active-queued-messages',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const threadId = session.thread.getId()!;
    session.run.ensureAbortController();
    session.run.setRunId({ runId: 'run-1' });
    session.stream.attach({
      subscription: createSubscription(() => activeRunId) as any,
      key: `agent-1:resource-1:${threadId}`,
    });
    await session.queueMessage({ content: 'first queued message' });
    await session.queueMessage({ content: 'second queued message' });

    expect(agent.queueMessage.mock.calls.map(([message]) => message)).toEqual([
      'first queued message',
      'second queued message',
    ]);
  });
});
