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
    sendSignal: vi.fn((signal: any, _options?: any) => ({
      accepted: Promise.resolve({ action: 'deliver' as const, runId: 'run-1' }),
      persisted: Promise.resolve(),
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

function mockThreadOwner(session: any, threadId: string, resourceId = 'resource-1') {
  vi.spyOn(session.thread, 'getById').mockResolvedValue({ id: threadId, resourceId } as any);
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

  it('observes persistence when a signal submitted to an active run is routed after it becomes idle', async () => {
    let activeRunId: string | null = 'run-1';
    const agent = createAgentMock(() => activeRunId);
    let resolveAccepted!: (value: { action: 'persist' }) => void;
    const accepted = new Promise<{ action: 'persist' }>(resolve => {
      resolveAccepted = resolve;
    });
    agent.sendSignal.mockReturnValue({
      accepted,
      persisted: Promise.resolve(),
      signal: { id: 'completion-idle', type: 'notification' },
    } as any);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-active-to-idle-persist',
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
    const events: any[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    const result = session.sendSignal(
      {
        id: 'completion-idle',
        type: 'notification',
        contents: 'background task completed',
      },
      {
        ifActive: { behavior: 'deliver' },
        ifIdle: { behavior: 'persist' },
      },
    );
    await vi.waitFor(() => expect(agent.sendSignal).toHaveBeenCalledOnce());
    activeRunId = null;
    resolveAccepted({ action: 'persist' });

    await expect(result.accepted).resolves.toEqual({ accepted: true, runId: undefined });
    expect(events.filter(event => event.type === 'message_start')).toHaveLength(1);
    expect(events.filter(event => event.type === 'message_end')).toHaveLength(1);
  });

  it('persists an active notification signal without interrupting an armed approval', async () => {
    let activeRunId: string | null = 'run-1';
    const agent = createAgentMock(() => activeRunId);
    const persisted = Promise.resolve();
    agent.sendSignal.mockReturnValue({
      accepted: Promise.resolve({ action: 'persist' as const }),
      persisted,
      signal: { id: 'completion-1', type: 'notification' },
    } as any);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-notification-persist',
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
    const events: any[] = [];
    session.subscribe(event => {
      events.push(event);
    });
    let approvalSettled = false;
    void session.approval.arm({ toolName: 'request_access' }).then(() => {
      approvalSettled = true;
    });

    const result = session.sendSignal(
      {
        id: 'completion-1',
        type: 'notification',
        contents: 'background task completed',
      },
      {
        ifActive: { behavior: 'persist' },
        ifIdle: { behavior: 'persist' },
      },
    );

    await expect(result.accepted).resolves.toEqual({ accepted: true, runId: undefined });
    expect(approvalSettled).toBe(false);
    expect(agent.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'completion-1', type: 'notification' }),
      expect.objectContaining({ ifActive: { behavior: 'persist' } }),
    );
    const signalMessages = events
      .filter(event => event.type === 'message_end')
      .map(event => event.message)
      .filter(message => message.role === 'signal');
    expect(signalMessages).toEqual([
      expect.objectContaining({
        id: 'completion-1',
        role: 'signal',
        content: expect.objectContaining({
          metadata: expect.objectContaining({ signal: expect.objectContaining({ type: 'notification' }) }),
        }),
      }),
    ]);
  });

  it('persists an explicit-thread signal without emitting it into the session current thread', async () => {
    const agent = createAgentMock(() => null);
    agent.sendSignal.mockReturnValue({
      accepted: Promise.resolve({ action: 'persist' as const }),
      persisted: Promise.resolve(),
      signal: { id: 'completion-1', type: 'notification' },
    } as any);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-explicit-thread',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    session.thread.set({ threadId: 'current-thread' });
    mockThreadOwner(session, 'origin-thread');
    const events: any[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    const result = session.sendSignalToThread(
      {
        id: 'completion-1',
        type: 'notification',
        contents: 'background task completed',
      },
      { resourceId: 'resource-1', threadId: 'origin-thread' },
    );

    await expect(result.accepted).resolves.toEqual({ accepted: true });
    expect(agent.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'completion-1', type: 'notification' }),
      {
        resourceId: 'resource-1',
        threadId: 'origin-thread',
        ifActive: { behavior: 'persist' },
        ifIdle: { behavior: 'persist' },
      },
    );
    expect(events.filter(event => event.type === 'message_end')).toEqual([]);
  });

  it.each([
    { name: 'resource', targetResourceId: 'resource-2', threadResourceId: 'resource-2' },
    { name: 'thread owner', targetResourceId: 'resource-1', threadResourceId: 'resource-2' },
  ])('rejects an explicit signal targeting a foreign $name', async ({ targetResourceId, threadResourceId }) => {
    const agent = createAgentMock(() => null);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-foreign-explicit-thread',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    mockThreadOwner(session, 'foreign-thread', threadResourceId);

    const result = session.sendSignalToThread(
      {
        id: 'completion-foreign',
        type: 'notification',
        contents: 'background task completed',
      },
      { resourceId: targetResourceId, threadId: 'foreign-thread' },
    );

    await expect(result.accepted).rejects.toThrow('Thread not found: foreign-thread');
    expect(agent.sendSignal).not.toHaveBeenCalled();
  });

  it('emits a persisted explicit-thread signal into the matching session thread', async () => {
    const agent = createAgentMock(() => null);
    agent.sendSignal.mockReturnValue({
      accepted: Promise.resolve({ action: 'persist' as const }),
      persisted: Promise.resolve(),
      signal: { id: 'completion-2', type: 'notification' },
    } as any);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-explicit-thread-match',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    session.thread.set({ threadId: 'current-thread' });
    mockThreadOwner(session, 'current-thread');
    const events: any[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    const result = session.sendSignalToThread(
      {
        id: 'completion-2',
        type: 'notification',
        contents: 'background task completed',
      },
      { resourceId: 'resource-1', threadId: 'current-thread' },
    );

    await expect(result.accepted).resolves.toEqual({ accepted: true });
    expect(events.filter(event => event.type === 'message_start')).toHaveLength(1);
    expect(events.filter(event => event.type === 'message_end')).toHaveLength(1);
  });

  it('does not emit an explicit-thread signal when persistence is discarded', async () => {
    const agent = createAgentMock(() => null);
    agent.sendSignal.mockReturnValue({
      accepted: Promise.resolve({ action: 'discard' as const }),
      signal: { id: 'completion-discarded', type: 'notification' },
    } as any);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-explicit-thread-discard',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    session.thread.set({ threadId: 'current-thread' });
    mockThreadOwner(session, 'current-thread');
    const events: any[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    const result = session.sendSignalToThread(
      {
        id: 'completion-discarded',
        type: 'notification',
        contents: 'background task completed',
      },
      { resourceId: 'resource-1', threadId: 'current-thread' },
    );

    await expect(result.accepted).resolves.toEqual({ accepted: true });
    expect(events.filter(event => event.type === 'message_start')).toEqual([]);
    expect(events.filter(event => event.type === 'message_end')).toEqual([]);
  });

  it('does not emit an active signal when persistence is discarded', async () => {
    const agent = createAgentMock(() => 'run-1');
    agent.sendSignal.mockReturnValue({
      accepted: Promise.resolve({ action: 'discard' as const }),
      signal: { id: 'completion-discarded', type: 'notification' },
    } as any);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-notification-discard',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const threadId = session.thread.getId()!;
    session.run.ensureAbortController();
    session.run.setRunId({ runId: 'run-1' });
    session.stream.attach({
      subscription: createSubscription(() => 'run-1') as any,
      key: `agent-1:resource-1:${threadId}`,
    });
    const events: any[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    const result = session.sendSignal(
      {
        id: 'completion-discarded',
        type: 'notification',
        contents: 'background task completed',
      },
      {
        ifActive: { behavior: 'persist' },
        ifIdle: { behavior: 'persist' },
      },
    );

    await expect(result.accepted).resolves.toEqual({ accepted: true, runId: undefined });
    expect(events.filter(event => event.type === 'message_start')).toEqual([]);
    expect(events.filter(event => event.type === 'message_end')).toEqual([]);
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

  it('forwards untilIdle into idle-run stream options', async () => {
    const agent = createAgentMock(() => null);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-until-idle',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const result = session.sendSignal({ content: 'wait for background work', untilIdle: { maxIdleMs: 1_000 } });
    await expect(result.accepted).resolves.toEqual({ accepted: true, runId: undefined });

    expect(agent.sendSignal).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ifIdle: expect.objectContaining({
          streamOptions: expect.objectContaining({ untilIdle: { maxIdleMs: 1_000 } }),
        }),
      }),
    );
  });

  it('forwards an explicit false untilIdle into idle-run stream options', async () => {
    const agent = createAgentMock(() => null);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-without-until-idle',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const result = session.sendSignal({ content: 'do not wait for background work', untilIdle: false });
    await expect(result.accepted).resolves.toEqual({ accepted: true, runId: undefined });

    expect(agent.sendSignal).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ifIdle: expect.objectContaining({
          streamOptions: expect.objectContaining({ untilIdle: false }),
        }),
      }),
    );
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

    session.abort();
    expect(session.run.isRunning()).toBe(true);
    expect(session.run.isAbortRequested()).toBe(true);
    agent.sendSignal.mockClear();

    await session.sendSignal({ content: 'try again' }).accepted;

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
