import { describe, expect, it, vi } from 'vitest';

import { createRemoteMastraTUIBackend } from './remote-backend.js';

const capabilities = {
  chat: true,
  threads: true,
  modes: true,
  models: true,
  goals: true,
  permissions: true,
  approvals: true,
  skills: true,
};

describe('createRemoteMastraTUIBackend', () => {
  it('subscribes before hydration and releases buffered events after the snapshot', async () => {
    const order: string[] = [];
    const remoteSession = {
      create: vi.fn(async () => ({ controllerId: 'mastra-code', resourceId: 'project', threadId: 'thread-1' })),
      subscribe: vi.fn(async ({ onEvent }: { onEvent: (event: unknown) => void }) => {
        onEvent({ type: 'tool_approval_required', toolCallId: 'call-1', toolName: 'read', args: {} });
        return { unsubscribe: vi.fn() };
      }),
      state: vi.fn(async () => ({
        controllerId: 'mastra-code',
        resourceId: 'project',
        threadId: 'thread-1',
        modeId: 'build',
        modelId: 'model-1',
        displayState: { isRunning: true },
      })),
      listMessages: vi.fn(async () => [{ id: 'message-1', role: 'user', content: { format: 2, parts: [] } }]),
    };
    const client = {
      getAgentController: vi.fn(() => ({ session: vi.fn(() => remoteSession) })),
      createFeedback: vi.fn(),
    };
    const backend = createRemoteMastraTUIBackend({
      client: client as never,
      controllerId: 'mastra-code',
      resourceId: 'project',
      scope: '/repo',
      tags: { projectPath: '/repo' },
      capabilities,
      subagents: [],
    });

    const connection = await backend.start({
      onSnapshot: snapshot => order.push(`snapshot:${snapshot.threadId}`),
      onEvent: event => order.push(`event:${event.type}`),
    });

    expect(order).toEqual(['snapshot:thread-1', 'event:tool_approval_required']);
    expect(connection.snapshot.messages).toHaveLength(1);
    expect(remoteSession.subscribe).toHaveBeenCalledBefore(remoteSession.state);
  });

  it('does not replay a buffered message lifecycle already represented by the hydration snapshot', async () => {
    const message = {
      id: 'message-1',
      role: 'assistant',
      content: { format: 2, parts: [{ type: 'text', text: 'complete' }] },
    };
    const remoteSession = {
      create: vi.fn(async () => ({})),
      subscribe: vi.fn(async ({ onEvent }: { onEvent: (event: unknown) => void }) => {
        onEvent({ type: 'message_start', message });
        onEvent({ type: 'message_update', message });
        onEvent({ type: 'message_end', message });
        return { unsubscribe: vi.fn() };
      }),
      state: vi.fn(async () => ({ resourceId: 'project', threadId: 'thread-1', messages: [message] })),
      listMessages: vi.fn(async () => [message]),
    };
    const backend = createRemoteMastraTUIBackend({
      client: { getAgentController: () => ({ session: () => remoteSession }) } as never,
      controllerId: 'mastra-code',
      resourceId: 'project',
      capabilities,
      subagents: [],
    });
    const events: unknown[] = [];

    const connection = await backend.start({ onSnapshot: vi.fn(), onEvent: event => events.push(event) });

    expect(connection.snapshot.messages).toEqual([message]);
    expect(events).toEqual([]);
  });

  it('retains lossy terminal events at the hydration boundary', async () => {
    const terminalEvents = [
      { type: 'tool_end', toolCallId: 'tool-1', result: { error: 'denied' }, isError: true },
      { type: 'agent_end', reason: 'error', error: 'model failed' },
    ];
    const remoteSession = {
      create: vi.fn(async () => ({})),
      subscribe: vi.fn(async ({ onEvent }: { onEvent: (event: unknown) => void }) => {
        for (const event of terminalEvents) onEvent(event);
        return { unsubscribe: vi.fn() };
      }),
      state: vi.fn(async () => ({
        resourceId: 'project',
        threadId: 'thread-1',
        messages: [],
        displayState: { isRunning: false, activeTools: {} },
      })),
      listMessages: vi.fn(async () => []),
    };
    const backend = createRemoteMastraTUIBackend({
      client: { getAgentController: () => ({ session: () => remoteSession }) } as never,
      controllerId: 'mastra-code',
      resourceId: 'project',
      capabilities,
      subagents: [],
    });
    const boundaryEvents: unknown[] = [];
    const delivered: unknown[] = [];

    await backend.start({
      onSnapshot: (_snapshot, boundary) => boundaryEvents.push(...(boundary?.bufferedEvents ?? [])),
      onEvent: event => delivered.push(event),
    });

    expect(boundaryEvents).toEqual(terminalEvents);
    expect(delivered).toEqual(terminalEvents);
  });

  it('rehydrates across rapid snapshot-projected changes instead of replaying an intermediate value', async () => {
    const remoteSession = {
      create: vi.fn(async () => ({})),
      subscribe: vi.fn(async ({ onEvent }: { onEvent: (event: unknown) => void }) => {
        onEvent({ type: 'mode_changed', modeId: 'plan' });
        onEvent({ type: 'mode_changed', modeId: 'fast' });
        return { unsubscribe: vi.fn() };
      }),
      state: vi.fn(async () => ({ resourceId: 'project', threadId: 'thread-1', modeId: 'fast' })),
      listMessages: vi.fn(async () => []),
    };
    const backend = createRemoteMastraTUIBackend({
      client: { getAgentController: () => ({ session: () => remoteSession }) } as never,
      controllerId: 'mastra-code',
      resourceId: 'project',
      capabilities,
      subagents: [],
    });
    const snapshots: string[] = [];
    const events: unknown[] = [];

    await backend.start({
      onSnapshot: snapshot => snapshots.push(snapshot.modeId),
      onEvent: event => events.push(event),
    });

    expect(remoteSession.state).toHaveBeenCalledTimes(2);
    expect(snapshots).toEqual(['fast']);
    expect(events).toEqual([]);
  });

  it('does not replay buffered interactive state already represented by the hydration snapshot', async () => {
    const tasks = [{ id: 'task-1', content: 'Inspect', status: 'in_progress' }];
    const remoteSession = {
      create: vi.fn(async () => ({})),
      subscribe: vi.fn(async ({ onEvent }: { onEvent: (event: unknown) => void }) => {
        onEvent({ type: 'tool_start', toolCallId: 'tool-1', toolName: 'view', args: { path: 'a.ts' } });
        onEvent({ type: 'tool_approval_required', toolCallId: 'approval-1', toolName: 'write', args: {} });
        onEvent({
          type: 'tool_suspended',
          toolCallId: 'ask-1',
          toolName: 'ask_user',
          args: {},
          suspendPayload: {},
        });
        onEvent({ type: 'subagent_start', toolCallId: 'sub-1', agentType: 'cortex', task: 'Inspect' });
        onEvent({ type: 'task_updated', tasks });
        return { unsubscribe: vi.fn() };
      }),
      state: vi.fn(async () => ({
        resourceId: 'project',
        threadId: 'thread-1',
        modeId: 'build',
        modelId: 'model-1',
        messages: [],
        displayState: {
          activeTools: { 'tool-1': { name: 'view', args: { path: 'a.ts' }, status: 'running' } },
          pendingApproval: { toolCallId: 'approval-1', toolName: 'write', args: {} },
          pendingSuspensions: {
            'ask-1': { toolCallId: 'ask-1', toolName: 'ask_user', args: {}, suspendPayload: {} },
          },
          activeSubagents: { 'sub-1': { agentType: 'cortex', task: 'Inspect' } },
          tasks,
        },
      })),
      listMessages: vi.fn(async () => []),
    };
    const backend = createRemoteMastraTUIBackend({
      client: { getAgentController: () => ({ session: () => remoteSession }) } as never,
      controllerId: 'mastra-code',
      resourceId: 'project',
      capabilities,
      subagents: [],
    });
    const events: unknown[] = [];

    await backend.start({ onSnapshot: vi.fn(), onEvent: event => events.push(event) });

    expect(events).toEqual([]);
  });

  it('unsubscribes and releases hydration state when the initial snapshot fails', async () => {
    const unsubscribe = vi.fn();
    const remoteSession = {
      create: vi.fn(async () => ({})),
      subscribe: vi.fn(async () => ({ unsubscribe })),
      state: vi.fn(async () => {
        throw new Error('snapshot unavailable');
      }),
      listMessages: vi.fn(),
    };
    const client = {
      getAgentController: vi.fn(() => ({ session: vi.fn(() => remoteSession) })),
      createFeedback: vi.fn(),
    };
    const backend = createRemoteMastraTUIBackend({
      client: client as never,
      controllerId: 'mastra-code',
      resourceId: 'project',
      capabilities,
      subagents: [],
    });

    await expect(backend.start({ onSnapshot: vi.fn(), onEvent: vi.fn() })).rejects.toThrow('snapshot unavailable');
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('coalesces rapid reconnects and applies only the newest authoritative snapshot before buffered events', async () => {
    let subscriptionCallbacks:
      | {
          onEvent(event: any): void;
          onReconnect(): void;
        }
      | undefined;
    let releaseStaleSnapshot!: (value: any) => void;
    const staleSnapshot = new Promise(resolve => {
      releaseStaleSnapshot = resolve;
    });
    const remoteSession = {
      create: vi.fn(async () => ({})),
      subscribe: vi.fn(async (callbacks: typeof subscriptionCallbacks) => {
        subscriptionCallbacks = callbacks;
        return { unsubscribe: vi.fn() };
      }),
      state: vi
        .fn()
        .mockResolvedValueOnce({ resourceId: 'project', threadId: 'initial', messages: [] })
        .mockReturnValueOnce(staleSnapshot)
        .mockResolvedValueOnce({ resourceId: 'project', threadId: 'latest', messages: [] }),
      listMessages: vi.fn(async () => []),
    };
    const backend = createRemoteMastraTUIBackend({
      client: { getAgentController: () => ({ session: () => remoteSession }) } as never,
      controllerId: 'mastra-code',
      resourceId: 'project',
      capabilities,
      subagents: [],
    });
    const order: string[] = [];
    await backend.start({
      onSnapshot: value => order.push(`snapshot:${value.threadId}`),
      onEvent: value => order.push(`event:${value.type}`),
    });

    subscriptionCallbacks!.onReconnect();
    subscriptionCallbacks!.onEvent({ type: 'info', message: 'during-first-reconnect' });
    subscriptionCallbacks!.onReconnect();
    subscriptionCallbacks!.onEvent({ type: 'info', message: 'during-second-reconnect' });
    releaseStaleSnapshot({ resourceId: 'project', threadId: 'stale', messages: [] });

    await vi.waitFor(() => expect(order).toContain('snapshot:latest'));
    expect(order).toEqual(['snapshot:initial', 'snapshot:latest', 'event:info', 'event:info']);
    expect(order).not.toContain('snapshot:stale');
  });

  it('reports and retries a transient reconnect hydration failure', async () => {
    let onReconnect: (() => void) | undefined;
    const remoteSession = {
      create: vi.fn(async () => ({})),
      subscribe: vi.fn(async (callbacks: { onReconnect(): void }) => {
        onReconnect = callbacks.onReconnect;
        return { unsubscribe: vi.fn() };
      }),
      state: vi
        .fn()
        .mockResolvedValueOnce({ resourceId: 'project', threadId: 'initial', messages: [] })
        .mockRejectedValueOnce(new Error('temporary snapshot failure'))
        .mockResolvedValueOnce({ resourceId: 'project', threadId: 'recovered', messages: [] }),
      listMessages: vi.fn(async () => []),
    };
    const backend = createRemoteMastraTUIBackend({
      client: { getAgentController: () => ({ session: () => remoteSession }) } as never,
      controllerId: 'mastra-code',
      resourceId: 'project',
      capabilities,
      subagents: [],
    });
    const snapshots: string[] = [];
    const errors: unknown[] = [];
    await backend.start({
      onSnapshot: value => snapshots.push(value.threadId ?? ''),
      onEvent: vi.fn(),
      onError: error => errors.push(error),
    });

    onReconnect!();

    await vi.waitFor(() => expect(snapshots).toContain('recovered'));
    expect(errors).toHaveLength(1);
    expect(String(errors[0])).toContain('temporary snapshot failure');
  });

  it('rebinds every operation and the event stream after the server changes resource identity', async () => {
    const makeSession = (resourceId: string) => ({
      create: vi.fn(async (input?: { threadId?: string }) => {
        if (resourceId === 'resource-b' && input?.threadId === 'thread-resource-a') {
          throw new Error('Thread not found');
        }
        return { resourceId };
      }),
      subscribe: vi.fn(async () => ({ unsubscribe: vi.fn() })),
      state: vi.fn(async () => ({ resourceId, threadId: `thread-${resourceId}`, messages: [] })),
      listMessages: vi.fn(async () => []),
      setResourceId: vi.fn(async () => ({})),
      listThreads: vi.fn(async () => [{ id: `thread-${resourceId}`, resourceId }]),
      sendSignal: vi.fn(async (input: { id?: string }) => ({ id: input.id ?? 'server-id', accepted: true as const })),
    });
    const sessionA = makeSession('resource-a');
    const sessionB = makeSession('resource-b');
    const sessionFor = vi.fn((resourceId: string) => (resourceId === 'resource-a' ? sessionA : sessionB));
    const backend = createRemoteMastraTUIBackend({
      client: { getAgentController: () => ({ session: sessionFor }) } as never,
      controllerId: 'mastra-code',
      resourceId: 'resource-a',
      capabilities,
      subagents: [],
    });
    await backend.start({ onSnapshot: vi.fn(), onEvent: vi.fn() });

    await backend.setResourceId('resource-b');
    await backend.listThreads();
    await backend.sendSignal({ id: 'signal-b', content: 'continue' });
    const snapshot = await backend.getSnapshot();

    expect(sessionA.setResourceId).toHaveBeenCalledWith('resource-b');
    expect(sessionFor).toHaveBeenCalledWith('resource-b', undefined);
    expect(sessionB.create).toHaveBeenCalledWith({ tags: undefined, threadId: undefined });
    expect(sessionB.subscribe).toHaveBeenCalled();
    expect(sessionB.listThreads).toHaveBeenCalled();
    expect(sessionB.sendSignal).toHaveBeenCalledWith({ id: 'signal-b', content: 'continue' });
    expect(snapshot).toMatchObject({ resourceId: 'resource-b', threadId: 'thread-resource-b' });
  });
});
