import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';
import { AgentConnectionRegistry, AGENT_CONNECTIONS_DISCOVERY_CONTEXT_KEY, stablePeerId } from '../registry.js';
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

function savedPeer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'code-agent:resource-2:thread-2',
    agentId: 'code-agent',
    resourceId: 'resource-2',
    threadId: 'thread-2',
    label: 'Saved Peer',
    connectedAt: 5,
    lastSeenAt: 1_000,
    ...overrides,
  };
}

describe('AgentConnectionRegistry', () => {
  it('normalizes missing agent ids and percent-encodes canonical peer ids', () => {
    expect(stablePeerId({ resourceId: 'resource:a', threadId: 'thread/b' })).toBe('code-agent:resource%3Aa:thread%2Fb');
  });

  it('lists freshly advertised unsaved peers as discovered in deterministic order', async () => {
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
      {
        agentId: 'code-agent',
        label: 'A',
        relationship: 'none',
        presence: 'advertised',
        displayStatus: 'discovered',
        canAttemptSend: false,
        lastSeenAt: 1_000,
      },
      {
        agentId: 'code-agent',
        label: 'B',
        relationship: 'none',
        presence: 'advertised',
        displayStatus: 'discovered',
        canAttemptSend: false,
        lastSeenAt: 1_000,
      },
    ]);
  });

  it('ignores discovery entries whose supplied id does not match the canonical endpoint tuple', async () => {
    const registry = new AgentConnectionRegistry({
      listPeers: () => [{ id: 'alias', resourceId: 'resource-2', threadId: 'thread-2' }],
    });

    await expect(registry.listPeers(createContext())).resolves.toEqual([]);
  });

  it('renders saved advertised peers as connected and saved absent peers as saved', async () => {
    const registry = new AgentConnectionRegistry({
      now: () => 10_000,
      listPeers: () => [{ resourceId: 'resource-2', threadId: 'thread-2', label: 'Fresh label' }],
    });
    const context = createContext([
      savedPeer(),
      savedPeer({
        id: 'code-agent:resource-3:thread-3',
        resourceId: 'resource-3',
        threadId: 'thread-3',
        label: 'Absent',
        pid: (globalThis as any).process.pid,
        lastSeenAt: 9_999,
      }),
    ]);

    const peers = await registry.listPeers(context);

    expect(peers).toMatchObject([
      {
        id: 'code-agent:resource-2:thread-2',
        label: 'Fresh label',
        relationship: 'saved',
        presence: 'advertised',
        displayStatus: 'connected',
        canAttemptSend: true,
        connectedAt: 5,
      },
      {
        id: 'code-agent:resource-3:thread-3',
        relationship: 'saved',
        presence: 'absent',
        displayStatus: 'saved',
        canAttemptSend: false,
        pid: (globalThis as any).process.pid,
        lastSeenAt: 9_999,
      },
    ]);
  });

  it('keeps historical noncanonical saved ids separate from canonical discovery', async () => {
    const registry = new AgentConnectionRegistry({
      now: () => 20_000,
      listPeers: () => [{ resourceId: 'resource-2', threadId: 'thread-2', label: 'Canonical discovery' }],
    });
    const context = createContext([savedPeer({ id: 'historical-peer-id', label: 'Historical saved record' })]);

    const peers = await registry.listPeers(context);

    expect(peers).toMatchObject([
      {
        id: 'code-agent:resource-2:thread-2',
        relationship: 'none',
        presence: 'advertised',
        displayStatus: 'discovered',
        canAttemptSend: false,
      },
      {
        id: 'historical-peer-id',
        relationship: 'saved',
        presence: 'absent',
        displayStatus: 'saved',
        canAttemptSend: false,
      },
    ]);
  });

  it('uses request-context discovery and filters the current thread', async () => {
    const registry = new AgentConnectionRegistry({ now: () => 20 });
    const context = createContext();
    context.requestContext.set(AGENT_CONNECTIONS_DISCOVERY_CONTEXT_KEY, [
      { resourceId: 'resource-1', threadId: 'thread-1' },
      { resourceId: 'resource-2', threadId: 'thread-2' },
    ]);

    const peers = await registry.listPeers(context);

    expect(peers.map(peer => peer.id)).toEqual(['code-agent:resource-2:thread-2']);
  });

  it('discovers peers through the core agent pubsub discovery API', async () => {
    const registry = new AgentConnectionRegistry({ now: () => 30_000 });
    const peers = await registry.listPeers({
      ...createContext(),
      runtimeAgent: {
        discoverThreadPeers: async () => [
          {
            id: 'code-agent:resource%3A2:thread%2F2',
            agentId: 'code-agent',
            resourceId: 'resource:2',
            threadId: 'thread/2',
            label: 'PubSub Peer',
            title: 'Peer Thread',
            metadata: { mode: 'build' },
          },
        ],
      },
    });

    expect(peers).toMatchObject([
      {
        id: 'code-agent:resource%3A2:thread%2F2',
        resourceId: 'resource:2',
        threadId: 'thread/2',
        label: 'PubSub Peer',
        title: 'Peer Thread',
        mode: 'build',
        presence: 'advertised',
      },
    ]);
  });
});
