import { describe, expect, it, vi } from 'vitest';
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
  return {
    id: 'agent-1',
    getMastraInstance: vi.fn(() => undefined),
    subscribeToThread: vi.fn(async () => createSubscription(activeRunId)),
    sendSignal: vi.fn(signal => ({
      accepted: Promise.resolve({ action: 'deliver' as const, runId: 'run-1' }),
      signal,
    })),
  };
}

describe('AgentController signal messages', () => {
  it('initializes a session workspace on the first signal before dispatching to the agent', async () => {
    const agent = createAgentMock(() => null);
    const workspace = createMockWorkspace();
    const steps: string[] = [];
    vi.spyOn(workspace, 'init').mockImplementation(async () => {
      steps.push('workspace.init');
    });
    agent.sendSignal.mockImplementation(signal => {
      steps.push('agent.sendSignal');
      return {
        accepted: Promise.resolve({ action: 'deliver' as const, runId: 'run-1' }),
        signal,
      };
    });
    const controller = new AgentController({
      id: 'controller-lazy-workspace',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
      workspace,
    });
    const events: any[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    expect(workspace.init).not.toHaveBeenCalled();

    await expect(session.sendSignal({ content: 'hello' }).accepted).resolves.toEqual({
      accepted: true,
      runId: undefined,
    });

    expect(steps).toEqual(['workspace.init', 'agent.sendSignal']);
    expect(events).toEqual(
      expect.arrayContaining([
        { type: 'workspace_status_changed', status: 'ready' },
        { type: 'workspace_ready', workspaceId: workspace.id, workspaceName: workspace.name },
      ]),
    );
  });

  it('shares one workspace initialization attempt across concurrent first signals', async () => {
    const agent = createAgentMock(() => null);
    const workspace = createMockWorkspace();
    let resolveInit: (() => void) | undefined;
    const initSpy = vi.spyOn(workspace, 'init').mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveInit = resolve;
        }),
    );
    const controller = new AgentController({
      id: 'controller-concurrent-workspace',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
      workspace,
    });

    const first = session.sendSignal({ content: 'first' });
    const second = session.sendSignal({ content: 'second' });
    await vi.waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1));
    resolveInit?.();

    await Promise.all([first.accepted, second.accepted]);
    expect(agent.sendSignal).toHaveBeenCalledTimes(2);
  });

  it('emits an error and retries workspace initialization without blocking signal delivery', async () => {
    const agent = createAgentMock(() => null);
    const workspace = createMockWorkspace();
    const initSpy = vi
      .spyOn(workspace, 'init')
      .mockRejectedValueOnce(new Error('workspace unavailable'))
      .mockResolvedValueOnce();
    const controller = new AgentController({
      id: 'controller-workspace-retry',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({
      id: 'test-session',
      ownerId: 'test-owner',
      workspace,
    });
    const events: any[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await expect(session.sendSignal({ content: 'first' }).accepted).resolves.toEqual({
      accepted: true,
      runId: undefined,
    });
    await expect(session.sendSignal({ content: 'second' }).accepted).resolves.toEqual({
      accepted: true,
      runId: undefined,
    });

    expect(initSpy).toHaveBeenCalledTimes(2);
    expect(agent.sendSignal).toHaveBeenCalledTimes(2);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'workspace_status_changed', status: 'error' }),
        expect.objectContaining({ type: 'workspace_error', error: new Error('workspace unavailable') }),
        { type: 'workspace_status_changed', status: 'ready' },
        { type: 'workspace_ready', workspaceId: workspace.id, workspaceName: workspace.name },
      ]),
    );
  });

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

  it('surfaces idle signal submission failures instead of waiting forever for agent_end', async () => {
    const agent = createAgentMock(() => null);
    agent.sendSignal.mockReturnValue({
      accepted: Promise.reject(new Error('signal failed before stream started')),
      signal: { id: 'signal-1', type: 'user-message' },
    } as any);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-idle-signal-failure',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent: agent as any }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    await expect(session.sendMessage({ content: 'hello' })).rejects.toThrow('signal failed before stream started');
  });
});
