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
    sendSignal: vi.fn((signal: any, _options?: any) => ({
      accepted: Promise.resolve({ action: 'deliver' as const, runId: 'run-1' }),
      signal,
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
