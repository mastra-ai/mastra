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
