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
      decision: { action: 'deliver' },
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
      { targetId: 'peer-1', summary: 'Please review this', priority: 'high' },
      context,
    );

    expect(result).toMatchObject({ isError: false, priority: 'high', target: { id: 'peer-1' } });
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'agent-connection',
        kind: 'peer-signal',
        priority: 'high',
        summary: 'Please review this',
      }),
      expect.objectContaining({ resourceId: 'resource-2', threadId: 'thread-2', ifIdle: { behavior: 'wake' } }),
    );
  });

  it('rejects sends to disconnected peers', async () => {
    const tools = createAgentConnectionTools({
      registry: createRegistry(),
      getAgent: () => ({ sendNotificationSignal: vi.fn() }),
    });
    const { context } = createContext();

    const result = await (tools.agent_signal_send as any).execute(
      { targetId: 'peer-1', summary: 'Please review this', priority: 'medium' },
      context,
    );

    expect(result).toMatchObject({ isError: true, content: 'Agent peer is not connected: peer-1' });
  });
});
