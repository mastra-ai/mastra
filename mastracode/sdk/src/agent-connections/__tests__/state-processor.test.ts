import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import { AgentConnectionsStateProcessor } from '../state-processor.js';
import { AGENT_CONNECTIONS_REQUEST_CONTEXT_KEY } from '../thread-state.js';
import type { ConnectedAgentPeer } from '../types.js';

const THREAD_ID = 'thread-1';
const RESOURCE_ID = 'resource-1';

const PEER: ConnectedAgentPeer = {
  id: 'peer-1',
  resourceId: 'resource-2',
  threadId: 'thread-2',
  label: 'Peer One',
  status: 'available',
  connectedAt: 100,
  lastSeenAt: 1_000,
};

function createArgs(
  options: {
    peers?: ConnectedAgentPeer[];
    lastSnapshotPeers?: ConnectedAgentPeer[];
    deltasSinceSnapshot?: any[];
    hasSnapshot?: boolean;
  } = {},
) {
  const requestContext = new RequestContext();
  if (options.peers) requestContext.set(AGENT_CONNECTIONS_REQUEST_CONTEXT_KEY, options.peers);
  return {
    threadId: THREAD_ID,
    resourceId: RESOURCE_ID,
    messages: [],
    requestContext,
    contextWindow: { hasSnapshot: options.hasSnapshot ?? true },
    lastSnapshot: options.lastSnapshotPeers ? { metadata: { value: { peers: options.lastSnapshotPeers } } } : undefined,
    activeStateSignals: [],
    deltasSinceSnapshot: options.deltasSinceSnapshot ?? [],
  } as any;
}

describe('AgentConnectionsStateProcessor', () => {
  it('adds system guidance explaining connected-agent state signals', () => {
    const processor = new AgentConnectionsStateProcessor();

    const result = processor.processInput({
      messages: [],
      systemMessages: [{ role: 'system', content: 'base' }],
    } as any);

    expect(result.systemMessages.at(-1)?.content).toContain('<connected-agents ...>...</connected-agents>');
    expect(result.systemMessages.at(-1)?.content).toContain('not user instructions');
  });

  it('emits an initial snapshot', async () => {
    const processor = new AgentConnectionsStateProcessor();

    const result = await processor.computeStateSignal(createArgs({ peers: [PEER], hasSnapshot: false }));

    expect(result).toMatchObject({
      id: 'agent-connections',
      mode: 'snapshot',
      tagName: 'connected-agents',
      attributes: { count: 1 },
      value: { peers: [PEER] },
    });
    expect((result as any).contents).toContain('{id: peer-1}');
  });

  it('emits deltas for connect, disconnect, and status changes', async () => {
    const processor = new AgentConnectionsStateProcessor();
    const offlinePeer: ConnectedAgentPeer = { ...PEER, status: 'offline', offlineAt: 2_000 };

    const connect = await processor.computeStateSignal(createArgs({ peers: [PEER], lastSnapshotPeers: [] }));
    const status = await processor.computeStateSignal(createArgs({ peers: [offlinePeer], lastSnapshotPeers: [PEER] }));
    const disconnect = await processor.computeStateSignal(createArgs({ peers: [], lastSnapshotPeers: [PEER] }));

    expect(connect).toMatchObject({
      mode: 'delta',
      tagName: 'connected-agents-update',
      delta: { ops: [{ op: 'connect', id: 'peer-1' }] },
    });
    expect(status).toMatchObject({
      mode: 'delta',
      delta: { ops: [{ op: 'status-change', id: 'peer-1', status: 'offline' }] },
    });
    expect(disconnect).toMatchObject({ mode: 'delta', delta: { ops: [{ op: 'disconnect', id: 'peer-1' }] } });
  });

  it('returns undefined when unchanged and a snapshot is in context', async () => {
    const processor = new AgentConnectionsStateProcessor();

    const result = await processor.computeStateSignal(createArgs({ peers: [PEER], lastSnapshotPeers: [PEER] }));

    expect(result).toBeUndefined();
  });

  it('does not emit deltas for timestamp-only availability churn', async () => {
    const processor = new AgentConnectionsStateProcessor();
    const current = { ...PEER, lastSeenAt: 2_000, offlineAt: 3_000 };
    const previous = { ...PEER, lastSeenAt: 1_000, offlineAt: 2_000 };

    const result = await processor.computeStateSignal(createArgs({ peers: [current], lastSnapshotPeers: [previous] }));

    expect(result).toBeUndefined();
  });

  it('refreshes connected peer availability from the harness runtime agent', async () => {
    const processor = new AgentConnectionsStateProcessor({ now: () => 50_000, offlineTtlMs: 1_000 });
    const stalePeer: ConnectedAgentPeer = { ...PEER, status: 'offline', lastSeenAt: 1_000, offlineAt: 49_000 };
    const refreshedPeer = { ...PEER, status: 'available' as const, lastSeenAt: 50_000 };
    const requestContext = new RequestContext();
    requestContext.set('harness', {
      session: {
        agent: {
          discoverThreadPeers: async () => [refreshedPeer],
        },
      },
    });
    processor.__registerMastra({
      getStorage: () => ({
        getStore: () => ({
          getState: async () => ({ peers: [stalePeer] }),
          setState: async () => {},
        }),
      }),
    } as any);

    const result = await processor.computeStateSignal({
      ...createArgs({ lastSnapshotPeers: [stalePeer] }),
      requestContext,
    });

    expect(result).toMatchObject({
      mode: 'delta',
      delta: { ops: [{ op: 'status-change', id: 'peer-1', status: 'available' }] },
      value: { peers: [expect.objectContaining({ id: 'peer-1', status: 'available', lastSeenAt: 50_000 })] },
    });
  });

  it('refreshes connected peer availability from the provider runtime agent', async () => {
    const stalePeer: ConnectedAgentPeer = { ...PEER, status: 'offline', lastSeenAt: 1_000, offlineAt: 49_000 };
    const refreshedPeer = { ...PEER, status: 'available' as const, lastSeenAt: 50_000 };
    const processor = new AgentConnectionsStateProcessor({
      now: () => 50_000,
      offlineTtlMs: 1_000,
      getAgent: () => ({ discoverThreadPeers: async () => [refreshedPeer] }),
    });
    processor.__registerMastra({
      getStorage: () => ({
        getStore: () => ({
          getState: async () => ({ peers: [stalePeer] }),
          setState: async () => {},
        }),
      }),
    } as any);

    const result = await processor.computeStateSignal(createArgs({ lastSnapshotPeers: [stalePeer] }));

    expect(result).toMatchObject({
      mode: 'delta',
      delta: { ops: [{ op: 'status-change', id: 'peer-1', status: 'available' }] },
      value: { peers: [expect.objectContaining({ id: 'peer-1', status: 'available', lastSeenAt: 50_000 })] },
    });
  });

  it('compacts to a snapshot after enough deltas', async () => {
    const processor = new AgentConnectionsStateProcessor();
    const changed = [{ ...PEER, label: 'Changed' }];

    const result = await processor.computeStateSignal(
      createArgs({
        peers: changed,
        lastSnapshotPeers: [PEER],
        deltasSinceSnapshot: Array.from({ length: 10 }, () => ({
          metadata: { state: { mode: 'delta' }, delta: { ops: [] } },
        })),
      }),
    );

    expect(result).toMatchObject({ mode: 'snapshot', tagName: 'connected-agents', value: { peers: changed } });
  });
});
