import { describe, expect, it, vi } from 'vitest';

import { AgentConnectionRegistry, stablePeerId } from '../registry.js';
import { createAgentConnectionTools } from '../tools.js';
import { AGENT_CONNECTIONS_STATE_TYPE } from '../types.js';
import type { AgentConnectionsState, ConnectedAgentPeer } from '../types.js';

const PEER_ID = stablePeerId({ agentId: 'code-agent', resourceId: 'resource-2', threadId: 'thread-2' });
const PEER = { id: PEER_ID, resourceId: 'resource-2', threadId: 'thread-2', label: 'Peer One' };

function savedPeer(overrides: Partial<ConnectedAgentPeer> = {}): ConnectedAgentPeer {
  return {
    id: PEER_ID,
    agentId: 'code-agent',
    resourceId: 'resource-2',
    threadId: 'thread-2',
    label: 'Peer One',
    connectedAt: 100,
    lastSeenAt: 1_000,
    ...overrides,
  };
}

function createContext(initial: ConnectedAgentPeer[] = [], threadId = 'thread-1', state = new Map<string, unknown>()) {
  state.set(`${threadId}:${AGENT_CONNECTIONS_STATE_TYPE}`, { peers: initial });
  return {
    context: {
      agent: { resourceId: 'resource-1', threadId },
      mastra: {
        getStorage: () => ({
          getStore: () => ({
            getState: async ({ threadId: targetThreadId, type }: { threadId: string; type: string }) =>
              state.get(`${targetThreadId}:${type}`),
            setState: async ({
              threadId: targetThreadId,
              type,
              value,
            }: {
              threadId: string;
              type: string;
              value: unknown;
            }) => {
              state.set(`${targetThreadId}:${type}`, value);
            },
          }),
        }),
      },
    } as any,
    getStored: () => state.get(`${threadId}:${AGENT_CONNECTIONS_STATE_TYPE}`) as AgentConnectionsState,
  };
}

function createRegistry(listPeers: () => any[] = () => [PEER]) {
  return new AgentConnectionRegistry({ now: () => 1_000, listPeers });
}

function createSignalRuntime() {
  return vi.fn(async () => ({
    record: { id: 'notification-1' },
    decision: { action: 'deliver' as const },
    accepted: Promise.resolve({ action: 'deliver' as const, runId: 'run-1' }),
  }));
}

describe('agent connection tools', () => {
  it('lists peers using the explicit peer view contract', async () => {
    const tools = createAgentConnectionTools({ registry: createRegistry() });
    const { context } = createContext();

    const result = await (tools.agent_connections_list as any).execute({}, context);

    expect(result).toMatchObject({
      isError: false,
      savedCount: 0,
      peers: [
        {
          id: PEER_ID,
          label: 'Peer One',
          relationship: 'none',
          presence: 'advertised',
          displayStatus: 'discovered',
          canAttemptSend: false,
        },
      ],
    });
    expect(result).not.toHaveProperty('available');
    expect(result).not.toHaveProperty('connected');
    expect(result.content).toContain(`[discovered]`);
  });

  it('connects only freshly advertised peers and exposes no action input', async () => {
    const tools = createAgentConnectionTools({ registry: createRegistry() });
    const { context, getStored } = createContext();

    expect(Object.keys((tools.agent_connect as any).inputSchema.shape)).toEqual(['ids']);
    await expect((tools.agent_connect as any).execute({ ids: ['missing'] }, context)).resolves.toMatchObject({
      isError: true,
      content: 'Unknown or unadvertised agent peer id: missing',
    });

    const connected = await (tools.agent_connect as any).execute({ ids: [PEER_ID] }, context);
    expect(connected).toMatchObject({ isError: false, changed: [{ op: 'connect', id: PEER_ID }] });
    expect(getStored().peers).toMatchObject([{ id: PEER_ID, resourceId: 'resource-2', threadId: 'thread-2' }]);
  });

  it('validates multi-peer connects atomically and deduplicates ids', async () => {
    const otherPeer = { resourceId: 'resource-3', threadId: 'thread-3', label: 'Peer Two' };
    const otherPeerId = stablePeerId(otherPeer);
    const tools = createAgentConnectionTools({ registry: createRegistry(() => [PEER, otherPeer]) });
    const failed = createContext();

    await expect(
      (tools.agent_connect as any).execute({ ids: [PEER_ID, 'missing'] }, failed.context),
    ).resolves.toMatchObject({
      isError: true,
      content: 'Unknown or unadvertised agent peer id: missing',
      connected: [],
      changed: [],
    });
    expect(failed.getStored().peers).toEqual([]);

    const connected = createContext();
    await expect(
      (tools.agent_connect as any).execute({ ids: [PEER_ID, PEER_ID, otherPeerId] }, connected.context),
    ).resolves.toMatchObject({
      isError: false,
      connected: [{ id: PEER_ID }, { id: otherPeerId }],
      changed: [
        { op: 'connect', id: PEER_ID },
        { op: 'connect', id: otherPeerId },
      ],
    });
    expect(connected.getStored().peers).toHaveLength(2);
  });

  it('rejects a discovery entry whose supplied id does not match its endpoint', async () => {
    const tools = createAgentConnectionTools({
      registry: createRegistry(() => [{ id: PEER_ID, resourceId: 'resource-changed', threadId: 'thread-2' }]),
    });
    const { context, getStored } = createContext();

    await expect((tools.agent_connect as any).execute({ ids: [PEER_ID] }, context)).resolves.toMatchObject({
      isError: true,
      content: `Unknown or unadvertised agent peer id: ${PEER_ID}`,
    });
    expect(getStored().peers).toEqual([]);
  });

  it('disconnects advertised, absent, and historical saved peers idempotently without changing signal history', async () => {
    const historical = savedPeer({ id: 'historical-peer' });
    const tools = createAgentConnectionTools({ registry: createRegistry(() => []) });
    const { context, getStored } = createContext([savedPeer(), historical]);
    const originalSignals = [
      {
        messageId: 'old-message',
        fingerprint: 'fingerprint',
        targetId: PEER_ID,
        priority: 'medium' as const,
        expectsReply: false,
        returnPeerId: 'return-peer',
        sentAt: 1,
      },
    ];
    await context.mastra
      .getStorage()
      .getStore()
      .setState({
        threadId: 'thread-1',
        type: AGENT_CONNECTIONS_STATE_TYPE,
        value: { peers: [savedPeer(), historical], sentSignals: originalSignals },
      });

    const disconnected = await (tools.agent_disconnect as any).execute({ ids: [PEER_ID, 'historical-peer'] }, context);
    expect(disconnected).toMatchObject({
      isError: false,
      disconnectedIds: [PEER_ID, 'historical-peer'],
      alreadyDisconnectedIds: [],
      connected: [],
    });
    expect(getStored()).toEqual({ peers: [], sentSignals: originalSignals });

    await expect(
      (tools.agent_disconnect as any).execute({ ids: [PEER_ID, 'historical-peer'] }, context),
    ).resolves.toMatchObject({
      isError: false,
      disconnectedIds: [],
      alreadyDisconnectedIds: [PEER_ID, 'historical-peer'],
      changed: [],
    });
  });

  it('disconnects only the current sender thread', async () => {
    const state = new Map<string, unknown>();
    const first = createContext([savedPeer()], 'thread-1', state);
    const second = createContext([savedPeer()], 'thread-other', state);
    const tools = createAgentConnectionTools({ registry: createRegistry(() => []) });

    await (tools.agent_disconnect as any).execute({ ids: [PEER_ID] }, first.context);

    expect(first.getStored().peers).toEqual([]);
    expect(second.getStored().peers).toHaveLength(1);
  });

  it('rejects sends to unsaved or saved-but-not-advertised peers before Core routing', async () => {
    const sendNotificationSignal = vi.fn();
    const tools = createAgentConnectionTools({
      registry: createRegistry(() => []),
      getAgent: () => ({ sendNotificationSignal }),
    });
    const unsaved = createContext();
    const saved = createContext([savedPeer()]);
    const input = { targetId: PEER_ID, summary: 'Review', priority: 'medium', expectsReply: false };

    await expect((tools.agent_signal_send as any).execute(input, unsaved.context)).resolves.toMatchObject({
      isError: true,
      content: `Cannot send: peer is not saved: ${PEER_ID}`,
    });
    await expect((tools.agent_signal_send as any).execute(input, saved.context)).resolves.toMatchObject({
      isError: true,
      content: `Cannot send: saved peer is not currently advertised. Peer: ${PEER_ID}`,
    });
    expect(sendNotificationSignal).not.toHaveBeenCalled();
  });

  it('rejects a saved peer when discovery reuses its id for a changed endpoint', async () => {
    const sendNotificationSignal = vi.fn();
    const tools = createAgentConnectionTools({
      registry: createRegistry(() => [{ id: PEER_ID, resourceId: 'resource-changed', threadId: 'thread-2' }]),
      getAgent: () => ({ sendNotificationSignal }),
    });
    const { context } = createContext([savedPeer()]);

    await expect(
      (tools.agent_signal_send as any).execute(
        { targetId: PEER_ID, summary: 'Review', priority: 'medium', expectsReply: false },
        context,
      ),
    ).resolves.toMatchObject({
      isError: true,
      content: `Cannot send: saved peer is not currently advertised. Peer: ${PEER_ID}`,
    });
    expect(sendNotificationSignal).not.toHaveBeenCalled();
  });

  it('sends to a saved and freshly advertised exact endpoint despite diagnostic metadata changes', async () => {
    const sendNotificationSignal = createSignalRuntime();
    const tools = createAgentConnectionTools({
      registry: createRegistry(() => [
        { ...PEER, label: 'Renamed Peer', title: 'New title', mode: 'review', pid: 999, lastSeenAt: 2_000 },
      ]),
      getAgent: () => ({ sendNotificationSignal }),
    });
    const { context } = createContext([savedPeer({ label: 'Old label', pid: 1 })]);

    const result = await (tools.agent_signal_send as any).execute(
      {
        targetId: PEER_ID,
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
      target: { id: PEER_ID, label: 'Renamed Peer', canAttemptSend: true },
      expectsReply: true,
      messageId: 'request-1',
      returnPeerId: 'code-agent:resource-1:thread-1',
      routingAction: 'deliver',
      runId: 'run-1',
      content: 'Delivered high signal to Renamed Peer in run run-1: Please review this',
    });
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'agent-connection',
        kind: 'peer-signal',
        sourceId: 'code-agent:resource-1:thread-1',
        priority: 'high',
        summary: 'Please review this',
        dedupeKey: 'agent-signal:code-agent:resource-1:thread-1:request-1',
        attributes: { expectsReply: true, messageId: 'request-1', returnPeerId: 'code-agent:resource-1:thread-1' },
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
    const { context } = createContext([savedPeer()]);

    const resultPromise = (tools.agent_signal_send as any).execute(
      {
        targetId: PEER_ID,
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
  });

  it('reuses recorded sequential sends by message id and rejects conflicting reuse', async () => {
    const sendNotificationSignal = createSignalRuntime();
    const tools = createAgentConnectionTools({
      registry: createRegistry(),
      getAgent: () => ({ sendNotificationSignal }),
    });
    const { context } = createContext([savedPeer()]);
    const input = {
      targetId: PEER_ID,
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

  it('prevents sending after disconnect and restores eligibility after rediscovery and reconnect', async () => {
    const sendNotificationSignal = createSignalRuntime();
    const tools = createAgentConnectionTools({
      registry: createRegistry(),
      getAgent: () => ({ sendNotificationSignal }),
    });
    const { context } = createContext([savedPeer()]);
    const input = { targetId: PEER_ID, summary: 'Review', priority: 'medium', expectsReply: false };

    await (tools.agent_disconnect as any).execute({ ids: [PEER_ID] }, context);
    await expect((tools.agent_signal_send as any).execute(input, context)).resolves.toMatchObject({
      isError: true,
      content: `Cannot send: peer is not saved: ${PEER_ID}`,
    });

    await (tools.agent_connect as any).execute({ ids: [PEER_ID] }, context);
    await expect((tools.agent_signal_send as any).execute(input, context)).resolves.toMatchObject({ isError: false });
  });
});
