import { describe, expect, it, vi } from 'vitest';

import { AgentConnectionRegistry } from '../registry.js';
import { createAgentConnectionTools } from '../tools.js';
import { AGENT_CONNECTIONS_STATE_TYPE } from '../types.js';
import type { AgentConnectionsState, ConnectedAgentPeer } from '../types.js';

function createContext(initial: ConnectedAgentPeer[] = []) {
  const state = new Map<string, unknown>();
  state.set(`thread-1:${AGENT_CONNECTIONS_STATE_TYPE}`, { peers: initial });
  return {
    context: {
      agent: { resourceId: 'resource-1', threadId: 'thread-1' },
      mastra: {
        getStorage: () => ({
          getStore: () => ({
            getState: async ({ threadId, type }: { threadId: string; type: string }) =>
              state.get(`${threadId}:${type}`),
            setState: async ({ threadId, type, value }: { threadId: string; type: string; value: unknown }) => {
              state.set(`${threadId}:${type}`, value);
            },
          }),
        }),
      },
    } as any,
    getStored: () => state.get(`thread-1:${AGENT_CONNECTIONS_STATE_TYPE}`) as AgentConnectionsState,
  };
}

const PEER = { id: 'peer-1', resourceId: 'resource-2', threadId: 'thread-2', label: 'Peer One' };

function createRegistry() {
  return new AgentConnectionRegistry({ now: () => 1_000, listPeers: () => [PEER] });
}

describe('agent connection tools', () => {
  it('lists available peers', async () => {
    const tools = createAgentConnectionTools({ registry: createRegistry() });
    const { context } = createContext();

    const result = await (tools.agent_connections_list as any).execute({}, context);

    expect(result.isError).toBe(false);
    expect(result.available).toMatchObject([
      { id: 'peer-1', label: 'Peer One', status: 'available', connected: false },
    ]);
    expect(result.content).toContain('peer-1');
  });

  it('connects and disconnects selected peers', async () => {
    const tools = createAgentConnectionTools({ registry: createRegistry() });
    const { context, getStored } = createContext();

    const connected = await (tools.agent_connect as any).execute({ ids: ['peer-1'], action: 'connect' }, context);
    expect(connected).toMatchObject({ isError: false, changed: [{ op: 'connect', id: 'peer-1' }] });
    expect(getStored().peers).toMatchObject([{ id: 'peer-1', resourceId: 'resource-2', threadId: 'thread-2' }]);

    const disconnected = await (tools.agent_connect as any).execute({ ids: ['peer-1'], action: 'disconnect' }, context);
    expect(disconnected).toMatchObject({
      isError: false,
      changed: [{ op: 'disconnect', id: 'peer-1' }],
      connected: [],
    });
    expect(getStored().peers).toEqual([]);
  });

  it('rejects unknown and offline targets', async () => {
    const offlineRegistry = new AgentConnectionRegistry({
      now: () => 10_000,
      offlineTtlMs: 1,
      listPeers: () => [{ id: 'offline', resourceId: 'resource-2', threadId: 'thread-2', lastSeenAt: 1 } as any],
    });
    const tools = createAgentConnectionTools({ registry: offlineRegistry });
    const { context } = createContext();

    await expect(
      (tools.agent_connect as any).execute({ ids: ['missing'], action: 'connect' }, context),
    ).resolves.toMatchObject({
      isError: true,
      content: 'Unknown agent peer id: missing',
    });
    await expect(
      (tools.agent_connect as any).execute({ ids: ['offline'], action: 'connect' }, context),
    ).resolves.toMatchObject({
      isError: true,
      content: 'Agent peer is offline: offline',
    });
  });

  it('sends notification signals only to connected available peers', async () => {
    const sendNotificationSignal = vi.fn(async () => ({
      record: { id: 'notification-1' },
      decision: { action: 'deliver' as const },
      accepted: Promise.resolve({ action: 'deliver' as const, runId: 'run-1' }),
    }));
    const tools = createAgentConnectionTools({
      registry: createRegistry(),
      getAgent: () => ({ sendNotificationSignal }),
    });
    const { context } = createContext([
      {
        id: 'peer-1',
        resourceId: 'resource-2',
        threadId: 'thread-2',
        label: 'Peer One',
        status: 'available',
        connectedAt: 100,
        lastSeenAt: 1_000,
      },
    ]);

    const result = await (tools.agent_signal_send as any).execute(
      {
        targetId: 'peer-1',
        summary: 'Please review this',
        priority: 'high',
        expectsReply: true,
        messageId: 'request-1',
      },
      context,
    );

    expect(result).toMatchObject({
      isError: false,
      priority: 'high',
      target: { id: 'peer-1' },
      expectsReply: true,
      messageId: 'request-1',
      returnPeerId: 'code-agent:resource-1:thread-1',
      routingAction: 'deliver',
      runId: 'run-1',
      content: 'Delivered high signal to Peer One in run run-1: Please review this',
    });
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'agent-connection',
        kind: 'peer-signal',
        sourceId: 'code-agent:resource-1:thread-1',
        priority: 'high',
        summary: 'Please review this',
        dedupeKey: 'agent-signal:code-agent:resource-1:thread-1:request-1',
        attributes: {
          expectsReply: true,
          messageId: 'request-1',
          returnPeerId: 'code-agent:resource-1:thread-1',
        },
        metadata: {
          crossAgentMessaging: expect.objectContaining({
            expectsReply: true,
            messageId: 'request-1',
            returnPeerId: 'code-agent:resource-1:thread-1',
            targetId: 'peer-1',
          }),
        },
      }),
      expect.objectContaining({ resourceId: 'resource-2', threadId: 'thread-2', ifIdle: { behavior: 'wake' } }),
    );
  });

  it('awaits persisted signals and reports the routing outcome', async () => {
    let finishPersist!: () => void;
    const persisted = new Promise<void>(resolve => {
      finishPersist = resolve;
    });
    const sendNotificationSignal = vi.fn(async () => ({
      record: { id: 'notification-1' },
      decision: { action: 'deliver' as const },
      accepted: Promise.resolve({ action: 'persist' as const }),
      persisted,
    }));
    const tools = createAgentConnectionTools({
      registry: createRegistry(),
      getAgent: () => ({ sendNotificationSignal }),
    });
    const { context } = createContext([
      {
        id: 'peer-1',
        resourceId: 'resource-2',
        threadId: 'thread-2',
        label: 'Peer One',
        status: 'available',
        connectedAt: 100,
        lastSeenAt: 1_000,
      },
    ]);

    const resultPromise = (tools.agent_signal_send as any).execute(
      {
        targetId: 'peer-1',
        summary: 'Read this later',
        priority: 'low',
        expectsReply: false,
        messageId: 'reply-1',
        replyTo: 'request-1',
      },
      context,
    );
    let settled = false;
    void resultPromise.then(() => {
      settled = true;
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(settled).toBe(false);

    finishPersist();
    await expect(resultPromise).resolves.toMatchObject({
      isError: false,
      messageId: 'reply-1',
      replyTo: 'request-1',
      routingAction: 'persist',
      content: 'Persisted low signal for Peer One to process later: Read this later',
    });
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'agent-signal:code-agent:resource-1:thread-1:reply-1',
        attributes: { expectsReply: false, messageId: 'reply-1', replyTo: 'request-1' },
      }),
      expect.anything(),
    );
  });

  it('deduplicates retries by message id and rejects conflicting reuse', async () => {
    const sendNotificationSignal = vi.fn(async () => ({
      record: { id: 'notification-1' },
      decision: { action: 'deliver' as const },
      accepted: Promise.resolve({ action: 'deliver' as const, runId: 'run-1' }),
    }));
    const tools = createAgentConnectionTools({
      registry: createRegistry(),
      getAgent: () => ({ sendNotificationSignal }),
    });
    const { context } = createContext([
      {
        id: 'peer-1',
        resourceId: 'resource-2',
        threadId: 'thread-2',
        label: 'Peer One',
        status: 'available',
        connectedAt: 100,
        lastSeenAt: 1_000,
      },
    ]);
    const input = {
      targetId: 'peer-1',
      summary: 'Review once',
      priority: 'medium',
      expectsReply: true,
      messageId: 'stable-message',
      payload: { first: 1, second: 2 },
    };

    await expect((tools.agent_signal_send as any).execute(input, context)).resolves.toMatchObject({
      isError: false,
      messageId: 'stable-message',
      routingAction: 'deliver',
    });
    await expect(
      (tools.agent_signal_send as any).execute({ ...input, payload: { second: 2, first: 1 } }, context),
    ).resolves.toMatchObject({
      isError: false,
      duplicate: true,
      messageId: 'stable-message',
      routingAction: 'deliver',
    });
    await expect(
      (tools.agent_signal_send as any).execute({ ...input, summary: 'Different payload' }, context),
    ).resolves.toMatchObject({
      isError: true,
      messageId: 'stable-message',
      content: 'Message id stable-message was already used for a different cross-agent signal.',
    });
    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);
  });

  it('rejects sends to disconnected peers', async () => {
    const tools = createAgentConnectionTools({
      registry: createRegistry(),
      getAgent: () => ({ sendNotificationSignal: vi.fn() }),
    });
    const { context } = createContext();

    const result = await (tools.agent_signal_send as any).execute(
      { targetId: 'peer-1', summary: 'Please review this', priority: 'medium', expectsReply: false },
      context,
    );

    expect(result).toMatchObject({ isError: true, content: 'Agent peer is not connected: peer-1' });
  });
});
