import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import { AgentConnectionsStateProcessor } from '../state-processor.js';
import { AGENT_CONNECTIONS_REQUEST_CONTEXT_KEY } from '../thread-state.js';
import type { AgentPeerView, ConnectedAgentPeer } from '../types.js';

const THREAD_ID = 'thread-1';
const RESOURCE_ID = 'resource-1';

const SAVED_PEER: ConnectedAgentPeer = {
  id: 'code-agent:resource-2:thread-2',
  agentId: 'code-agent',
  resourceId: 'resource-2',
  threadId: 'thread-2',
  label: 'Peer One',
  connectedAt: 100,
  lastSeenAt: 1_000,
};

const CONNECTED_VIEW: AgentPeerView = {
  ...SAVED_PEER,
  agentId: 'code-agent',
  relationship: 'saved',
  presence: 'advertised',
  displayStatus: 'connected',
  canAttemptSend: true,
};

const SAVED_VIEW: AgentPeerView = {
  ...SAVED_PEER,
  agentId: 'code-agent',
  relationship: 'saved',
  presence: 'absent',
  displayStatus: 'saved',
  canAttemptSend: false,
};

function createArgs(
  options: {
    peers?: ConnectedAgentPeer[];
    lastSnapshotPeers?: AgentPeerView[];
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
  it('adds system guidance explaining durable relationship and send eligibility', () => {
    const processor = new AgentConnectionsStateProcessor();

    const result = processor.processInput({
      messages: [],
      systemMessages: [{ role: 'system', content: 'base' }],
    } as any);

    const systemMessage = (result as any).systemMessages.at(-1)?.content;
    expect(systemMessage).toContain('relationship=saved');
    expect(systemMessage).toContain('displayStatus is presentational');
    expect(systemMessage).toContain('canAttemptSend=true');
    expect(systemMessage).toContain('agent_disconnect');
  });

  it('emits an initial connected snapshot for a saved advertised peer', async () => {
    const processor = new AgentConnectionsStateProcessor({
      listPeers: () => [{ resourceId: 'resource-2', threadId: 'thread-2', label: 'Peer One' }],
    });

    const result = await processor.computeStateSignal(createArgs({ peers: [SAVED_PEER], hasSnapshot: false }));

    expect(result).toMatchObject({
      id: 'agent-connections',
      mode: 'snapshot',
      tagName: 'connected-agents',
      attributes: { count: 1 },
      value: { peers: [expect.objectContaining({ displayStatus: 'connected', canAttemptSend: true })] },
    });
    expect((result as any).contents).toContain('[connected]');
    expect((result as any).contents).toContain('relationship=saved presence=advertised sendable=true');
  });

  it('renders a saved peer absent from fresh discovery as saved even with recent timestamps', async () => {
    const processor = new AgentConnectionsStateProcessor({ now: () => 1_001 });
    const recentPeer = { ...SAVED_PEER, pid: (globalThis as any).process.pid, lastSeenAt: 1_000 };

    const result = await processor.computeStateSignal(createArgs({ peers: [recentPeer], hasSnapshot: false }));

    expect(result).toMatchObject({
      value: {
        peers: [
          expect.objectContaining({
            relationship: 'saved',
            presence: 'absent',
            displayStatus: 'saved',
            canAttemptSend: false,
          }),
        ],
      },
    });
    expect((result as any).contents).toContain('[saved]');
  });

  it('emits deltas for save, presence changes, and disconnect', async () => {
    const connectedProcessor = new AgentConnectionsStateProcessor({
      listPeers: () => [{ resourceId: 'resource-2', threadId: 'thread-2' }],
    });
    const absentProcessor = new AgentConnectionsStateProcessor();

    const connect = await connectedProcessor.computeStateSignal(
      createArgs({ peers: [SAVED_PEER], lastSnapshotPeers: [] }),
    );
    const presence = await absentProcessor.computeStateSignal(
      createArgs({ peers: [SAVED_PEER], lastSnapshotPeers: [CONNECTED_VIEW] }),
    );
    const disconnect = await absentProcessor.computeStateSignal(
      createArgs({ peers: [], lastSnapshotPeers: [SAVED_VIEW] }),
    );

    expect(connect).toMatchObject({
      mode: 'delta',
      tagName: 'connected-agents-update',
      delta: { ops: [{ op: 'connect', id: SAVED_PEER.id }] },
    });
    expect(presence).toMatchObject({
      mode: 'delta',
      delta: {
        ops: [
          {
            op: 'presence-change',
            id: SAVED_PEER.id,
            presence: 'absent',
            displayStatus: 'saved',
          },
        ],
      },
    });
    expect(disconnect).toMatchObject({
      mode: 'delta',
      delta: { ops: [{ op: 'disconnect', id: SAVED_PEER.id }] },
    });
  });

  it('returns undefined when unchanged and a snapshot is in context', async () => {
    const processor = new AgentConnectionsStateProcessor({
      listPeers: () => [{ resourceId: 'resource-2', threadId: 'thread-2', label: 'Peer One', lastSeenAt: 1_000 }],
    });

    const result = await processor.computeStateSignal(
      createArgs({ peers: [SAVED_PEER], lastSnapshotPeers: [CONNECTED_VIEW] }),
    );

    expect(result).toBeUndefined();
  });

  it('does not emit deltas for timestamp-only churn', async () => {
    const processor = new AgentConnectionsStateProcessor({
      listPeers: () => [{ resourceId: 'resource-2', threadId: 'thread-2', label: 'Peer One', lastSeenAt: 2_000 }],
    });
    const previous = { ...CONNECTED_VIEW, lastSeenAt: 1_000 };

    const result = await processor.computeStateSignal(
      createArgs({ peers: [SAVED_PEER], lastSnapshotPeers: [previous] }),
    );

    expect(result).toBeUndefined();
  });

  it('refreshes saved peer presence from the provider runtime agent', async () => {
    const processor = new AgentConnectionsStateProcessor({
      now: () => 50_000,
      getAgent: () => ({
        discoverThreadPeers: async () => [
          {
            id: SAVED_PEER.id,
            agentId: 'code-agent',
            resourceId: 'resource-2',
            threadId: 'thread-2',
            label: 'Peer One',
          },
        ],
      }),
    });

    const result = await processor.computeStateSignal(
      createArgs({ peers: [SAVED_PEER], lastSnapshotPeers: [SAVED_VIEW] }),
    );

    expect(result).toMatchObject({
      mode: 'delta',
      delta: {
        ops: [
          {
            op: 'presence-change',
            id: SAVED_PEER.id,
            presence: 'advertised',
            displayStatus: 'connected',
          },
        ],
      },
      value: { peers: [expect.objectContaining({ displayStatus: 'connected', lastSeenAt: 50_000 })] },
    });
  });

  it('compacts to a snapshot after enough deltas', async () => {
    const processor = new AgentConnectionsStateProcessor({
      listPeers: () => [{ resourceId: 'resource-2', threadId: 'thread-2', label: 'Changed' }],
    });

    const result = await processor.computeStateSignal(
      createArgs({
        peers: [SAVED_PEER],
        lastSnapshotPeers: [CONNECTED_VIEW],
        deltasSinceSnapshot: Array.from({ length: 10 }, () => ({
          metadata: { state: { mode: 'delta' }, delta: { ops: [] } },
        })),
      }),
    );

    expect(result).toMatchObject({
      mode: 'snapshot',
      tagName: 'connected-agents',
      value: { peers: [expect.objectContaining({ label: 'Changed', displayStatus: 'connected' })] },
    });
  });
});
