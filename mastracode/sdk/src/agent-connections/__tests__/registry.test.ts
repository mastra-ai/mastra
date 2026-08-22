import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';
import { AgentConnectionRegistry, AGENT_CONNECTIONS_DISCOVERY_CONTEXT_KEY } from '../registry.js';
import { AGENT_CONNECTIONS_STATE_TYPE } from '../types.js';

function createContext(storedPeers: unknown[] = []) {
  const state = new Map<string, unknown>();
  state.set(`thread-1:${AGENT_CONNECTIONS_STATE_TYPE}`, { peers: storedPeers });
  const requestContext = new RequestContext();
  return {
    agent: { resourceId: 'resource-1', threadId: 'thread-1' },
    requestContext,
    mastra: {
      getStorage: () => ({
        getStore: () => ({
          getState: async ({ threadId, type }: { threadId: string; type: string }) => state.get(`${threadId}:${type}`),
          setState: async ({ threadId, type, value }: { threadId: string; type: string; value: unknown }) => {
            state.set(`${threadId}:${type}`, value);
          },
        }),
      }),
    },
  } as any;
}

describe('AgentConnectionRegistry', () => {
  it('lists discovered peers with deterministic ids and order', async () => {
    const registry = new AgentConnectionRegistry({
      now: () => 1_000,
      listPeers: () => [
        { resourceId: 'resource-b', threadId: 'thread-b', label: 'B' },
        { resourceId: 'resource-a', threadId: 'thread-a', label: 'A' },
      ],
    });

    const peers = await registry.listPeers(createContext());

    expect(peers.map(peer => peer.id)).toEqual(['code-agent:resource-a:thread-a', 'code-agent:resource-b:thread-b']);
    expect(peers).toMatchObject([
      { label: 'A', status: 'available', connected: false, lastSeenAt: 1_000 },
      { label: 'B', status: 'available', connected: false, lastSeenAt: 1_000 },
    ]);
  });

  it('merges connected peers and keeps missing ones as offline', async () => {
    const registry = new AgentConnectionRegistry({
      now: () => 10_000,
      offlineTtlMs: 1_000,
      listPeers: () => [{ id: 'live', resourceId: 'resource-2', threadId: 'thread-2', label: 'Live' }],
    });
    const context = createContext([
      {
        id: 'live',
        resourceId: 'resource-2',
        threadId: 'thread-2',
        label: 'Live old',
        status: 'available',
        connectedAt: 5,
        lastSeenAt: 9_500,
      },
      {
        id: 'stale',
        resourceId: 'resource-3',
        threadId: 'thread-3',
        label: 'Stale',
        status: 'available',
        connectedAt: 6,
        lastSeenAt: 1_000,
      },
    ]);

    const peers = await registry.listPeers(context);

    expect(peers).toMatchObject([
      { id: 'live', label: 'Live', status: 'available', connected: true },
      { id: 'stale', label: 'Stale', status: 'offline', connected: true, offlineAt: 10_000 },
    ]);
  });

  it('uses request-context discovery and filters the current thread', async () => {
    const registry = new AgentConnectionRegistry({ now: () => 20 });
    const context = createContext();
    context.requestContext.set(AGENT_CONNECTIONS_DISCOVERY_CONTEXT_KEY, [
      { id: 'self', resourceId: 'resource-1', threadId: 'thread-1' },
      { id: 'peer', resourceId: 'resource-2', threadId: 'thread-2' },
    ]);

    const peers = await registry.listPeers(context);

    expect(peers.map(peer => peer.id)).toEqual(['peer']);
  });

  it('uses process liveness when discovered peers include a pid', async () => {
    const registry = new AgentConnectionRegistry({
      now: () => 10_000,
      offlineTtlMs: 1,
      listPeers: () => [
        {
          id: 'current-process',
          resourceId: 'resource-2',
          threadId: 'thread-2',
          pid: (globalThis as any).process.pid,
          lastSeenAt: 1,
        },
      ],
    });

    const peers = await registry.listPeers(createContext());

    expect(peers).toMatchObject([{ id: 'current-process', status: 'available', pid: (globalThis as any).process.pid }]);
  });

  it('discovers peers through the core agent pubsub discovery API', async () => {
    const registry = new AgentConnectionRegistry({ now: () => 30_000 });
    const peers = await registry.listPeers({
      ...createContext(),
      runtimeAgent: {
        discoverThreadPeers: async () => [
          {
            id: 'code-agent:resource-2:thread-2',
            agentId: 'code-agent',
            resourceId: 'resource-2',
            threadId: 'thread-2',
            label: 'PubSub Peer',
            title: 'Peer Thread',
            metadata: { mode: 'build' },
          },
        ],
      },
    });

    expect(peers).toMatchObject([
      {
        id: 'code-agent:resource-2:thread-2',
        resourceId: 'resource-2',
        threadId: 'thread-2',
        label: 'PubSub Peer',
        title: 'Peer Thread',
        mode: 'build',
        status: 'available',
      },
    ]);
  });
});
