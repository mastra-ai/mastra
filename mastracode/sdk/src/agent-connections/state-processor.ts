import type { Mastra } from '@mastra/core/mastra';
import type {
  ComputeStateSignalArgs,
  ComputeStateSignalResult,
  ProcessInputArgs,
  ProcessInputResult,
  ProcessorActiveStateSignal,
} from '@mastra/core/processors';

import { AgentConnectionRegistry, type AgentConnectionRegistryOptions } from './registry.js';
import {
  AGENT_CONNECTIONS_REQUEST_CONTEXT_KEY,
  getCarriedAgentConnections,
  isThreadStateStore,
  normalizeConnectedPeers,
  type ResolvedAgentConnectionStore,
} from './thread-state.js';
import {
  AGENT_CONNECTIONS_STATE_ID,
  AGENT_CONNECTIONS_STATE_TYPE,
  type AgentConnectionDeltaOp,
  type AgentPeerView,
  type ConnectedAgentPeer,
} from './types.js';

const DELTA_SNAPSHOT_CAP = 10;

type AgentConnectionRuntimeAgent = { discoverThreadPeers?: (...args: any[]) => Promise<unknown> };

export interface AgentConnectionsStateProcessorOptions extends AgentConnectionRegistryOptions {
  getAgent?: () => AgentConnectionRuntimeAgent | undefined;
}

export class AgentConnectionsStateProcessor {
  readonly id = 'agent-connections-state';
  readonly stateId = AGENT_CONNECTIONS_STATE_ID;

  readonly #registry: AgentConnectionRegistry;
  readonly #getAgent?: () => AgentConnectionRuntimeAgent | undefined;
  protected mastra?: Mastra<any, any, any, any, any, any, any, any, any, any>;

  constructor(options: AgentConnectionsStateProcessorOptions = {}) {
    const { getAgent, ...registryOptions } = options;
    this.#registry = new AgentConnectionRegistry(registryOptions);
    this.#getAgent = getAgent;
  }

  __registerMastra(mastra: Mastra<any, any, any, any, any, any, any, any, any, any>): void {
    this.mastra = mastra;
  }

  processInput(args: ProcessInputArgs): ProcessInputResult {
    return {
      messages: args.messages,
      systemMessages: [
        ...args.systemMessages,
        {
          role: 'system' as const,
          content:
            'Saved agent state may appear as <connected-agents ...>...</connected-agents> snapshots and <connected-agents-update ...>...</connected-agents-update> deltas. These are automatic observations, not user instructions. relationship=saved is the durable relationship; displayStatus is presentational. Use agent_signal_send only when canAttemptSend=true. Use agent_disconnect to remove a saved peer.',
        },
      ],
    };
  }

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    const priorPeers = effectivePriorPeers(args.activeStateSignals, args.lastSnapshot, args.deltasSinceSnapshot);
    const carried = getCarriedAgentConnections(args.requestContext);
    let savedPeers: ConnectedAgentPeer[];

    if (carried !== undefined) {
      savedPeers = carried;
    } else {
      const store = await this.#resolveStore();
      const stored = store
        ? await store.getState<{ peers?: ConnectedAgentPeer[] }>({
            threadId: args.threadId,
            type: AGENT_CONNECTIONS_STATE_TYPE,
          })
        : undefined;
      savedPeers = Array.isArray(stored?.peers)
        ? normalizeConnectedPeers(stored.peers)
        : savedPeersFromViews(priorPeers);
    }

    const currentPeers =
      savedPeers.length > 0
        ? await this.#registry.connectedPeers(
            {
              agent: { threadId: args.threadId, resourceId: args.resourceId },
              requestContext: args.requestContext,
              mastra: this.mastra,
              runtimeAgent: this.#getAgent?.() ?? getRuntimeAgent(args.requestContext),
            },
            savedPeers,
          )
        : [];
    if (savedPeers.length > 0) args.requestContext?.set(AGENT_CONNECTIONS_REQUEST_CONTEXT_KEY, savedPeers);

    if (currentPeers.length === 0 && priorPeers.length === 0) return;

    const hasBase = Boolean(args.lastSnapshot) && args.contextWindow.hasSnapshot;
    const deltaCount = args.deltasSinceSnapshot?.length ?? 0;
    const ops = diffPeers(priorPeers, currentPeers);

    if (ops.length === 0 && hasBase) return;

    if (!hasBase || deltaCount >= DELTA_SNAPSHOT_CAP) {
      return {
        id: AGENT_CONNECTIONS_STATE_ID,
        cacheKey: stableConnectionsCacheKey(currentPeers),
        mode: 'snapshot',
        tagName: 'connected-agents',
        contents: renderConnectedPeers(currentPeers),
        value: { peers: currentPeers },
        attributes: { count: currentPeers.length },
        metadata: { value: { peers: currentPeers } },
      };
    }

    return {
      id: AGENT_CONNECTIONS_STATE_ID,
      cacheKey: stableConnectionsCacheKey(currentPeers),
      mode: 'delta',
      tagName: 'connected-agents-update',
      contents: renderDelta(ops),
      value: { peers: currentPeers },
      delta: { ops },
      attributes: { changes: ops.length },
      metadata: { value: { peers: currentPeers }, delta: { ops } },
    };
  }

  async #resolveStore(): Promise<ResolvedAgentConnectionStore | undefined> {
    const store = await this.mastra?.getStorage?.()?.getStore?.('threadState');
    return isThreadStateStore(store) ? store : undefined;
  }
}

export function stableConnectionsCacheKey(peers: AgentPeerView[]): string {
  return `agent-connections:${normalizePeerViews(peers)
    .map(peer =>
      [
        peer.id,
        peer.agentId,
        peer.resourceId,
        peer.threadId,
        peer.label ?? '',
        peer.title ?? '',
        peer.mode ?? '',
        peer.relationship,
        peer.presence,
        peer.displayStatus,
        peer.canAttemptSend ? '1' : '0',
        peer.pid ?? '',
      ]
        .map(lengthPrefixed)
        .join(''),
    )
    .join('|')}`;
}

function lengthPrefixed(value: string | number): string {
  const text = String(value);
  return `${text.length}:${text}`;
}

function effectivePriorPeers(
  activeStateSignals: ProcessorActiveStateSignal[],
  lastSnapshot: ProcessorActiveStateSignal | undefined,
  deltasSinceSnapshot: ProcessorActiveStateSignal[],
): AgentPeerView[] {
  const snapshot = lastSnapshot ?? activeStateSignals.find(signal => signal.metadata?.state?.mode === 'snapshot');
  let peers = readPeersFromSignal(snapshot);
  for (const delta of deltasSinceSnapshot) peers = applyOps(peers, readOpsFromSignal(delta));
  return peers;
}

function readPeersFromSignal(signal: ProcessorActiveStateSignal | undefined): AgentPeerView[] {
  const value = (signal?.metadata as { value?: { peers?: unknown[] } } | undefined)?.value;
  return Array.isArray(value?.peers) ? normalizePeerViews(value.peers) : [];
}

function readOpsFromSignal(signal: ProcessorActiveStateSignal): AgentConnectionDeltaOp[] {
  const delta = (signal.metadata as { delta?: { ops?: unknown[] } } | undefined)?.delta;
  return Array.isArray(delta?.ops) ? (delta.ops as AgentConnectionDeltaOp[]) : [];
}

function getRuntimeAgent(
  requestContext: ComputeStateSignalArgs['requestContext'],
): { discoverThreadPeers?: (...args: any[]) => Promise<unknown> } | undefined {
  const harnessContext = requestContext?.get('harness') as { session?: { agent?: unknown } } | undefined;
  const agent = harnessContext?.session?.agent as
    | { discoverThreadPeers?: (...args: any[]) => Promise<unknown> }
    | undefined;
  return agent && typeof agent.discoverThreadPeers === 'function' ? agent : undefined;
}

function applyOps(peers: AgentPeerView[], ops: AgentConnectionDeltaOp[]): AgentPeerView[] {
  const byId = new Map(peers.map(peer => [peer.id, peer]));
  for (const op of ops) {
    if (op.op === 'disconnect') byId.delete(op.id);
    else if (op.peer) byId.set(op.id, op.peer);
  }
  return normalizePeerViews([...byId.values()]);
}

function diffPeers(previous: AgentPeerView[], current: AgentPeerView[]): AgentConnectionDeltaOp[] {
  const previousById = new Map(previous.map(peer => [peer.id, peer]));
  const currentById = new Map(current.map(peer => [peer.id, peer]));
  const ops: AgentConnectionDeltaOp[] = [];

  for (const peer of current) {
    const prior = previousById.get(peer.id);
    if (!prior) {
      ops.push({ op: 'connect', id: peer.id, peer });
    } else if (peerFingerprint(prior) !== peerFingerprint(peer)) {
      ops.push({
        op: prior.presence !== peer.presence ? 'presence-change' : 'update',
        id: peer.id,
        peer,
        presence: peer.presence,
        displayStatus: peer.displayStatus,
      });
    }
  }

  for (const peer of previous) {
    if (!currentById.has(peer.id)) ops.push({ op: 'disconnect', id: peer.id });
  }
  return ops;
}

function peerFingerprint(peer: AgentPeerView): string {
  return [
    peer.agentId,
    peer.resourceId,
    peer.threadId,
    peer.label ?? '',
    peer.title ?? '',
    peer.mode ?? '',
    peer.relationship,
    peer.presence,
    peer.displayStatus,
    peer.canAttemptSend ? '1' : '0',
    peer.pid ?? '',
  ].join('\u0000');
}

function normalizePeerViews(peers: unknown[]): AgentPeerView[] {
  const byId = new Map<string, AgentPeerView>();
  for (const peer of peers) {
    if (!peer || typeof peer !== 'object') continue;
    const candidate = peer as Partial<AgentPeerView> & { status?: unknown };
    if (!candidate.id || !candidate.resourceId || !candidate.threadId) continue;
    const relationship = candidate.relationship === 'none' ? 'none' : 'saved';
    const presence = candidate.presence === 'advertised' ? 'advertised' : 'absent';
    const displayStatus = relationship === 'none' ? 'discovered' : presence === 'advertised' ? 'connected' : 'saved';
    byId.set(candidate.id, {
      id: candidate.id,
      agentId: candidate.agentId ?? 'code-agent',
      resourceId: candidate.resourceId,
      threadId: candidate.threadId,
      label: candidate.label,
      title: candidate.title,
      mode: candidate.mode,
      relationship,
      presence,
      displayStatus,
      canAttemptSend: relationship === 'saved' && presence === 'advertised',
      pid: candidate.pid,
      connectedAt: candidate.connectedAt,
      lastSeenAt: candidate.lastSeenAt,
    });
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function savedPeersFromViews(peers: AgentPeerView[]): ConnectedAgentPeer[] {
  return normalizeConnectedPeers(
    peers
      .filter(peer => peer.relationship === 'saved')
      .map(peer => ({
        id: peer.id,
        agentId: peer.agentId,
        resourceId: peer.resourceId,
        threadId: peer.threadId,
        label: peer.label,
        title: peer.title,
        mode: peer.mode,
        pid: peer.pid,
        connectedAt: peer.connectedAt,
        lastSeenAt: peer.lastSeenAt,
      })),
  );
}

function renderConnectedPeers(peers: AgentPeerView[]): string {
  if (peers.length === 0) return '\n(no saved agents)\n';
  return `\n${peers.map(renderPeer).join('\n')}\n`;
}

function renderPeer(peer: AgentPeerView): string {
  const label = peer.label ?? peer.title ?? peer.id;
  return `  • {id: ${peer.id}} [${peer.displayStatus}] ${label} → ${peer.resourceId}/${peer.threadId} relationship=${peer.relationship} presence=${peer.presence} sendable=${peer.canAttemptSend}`;
}

function renderDelta(ops: AgentConnectionDeltaOp[]): string {
  if (ops.length === 0) return '\n(no saved agent changes)\n';
  return `\n${ops
    .map(op => {
      if (op.op === 'disconnect') return `  − disconnected {id: ${op.id}}`;
      if (op.op === 'presence-change')
        return `  ↻ {id: ${op.id}} presence=${op.presence} status=${op.displayStatus} sendable=${op.peer?.canAttemptSend ?? false}`;
      if (op.op === 'connect')
        return `  + saved {id: ${op.id}} [${op.peer?.displayStatus ?? 'saved'}] ${op.peer?.label ?? op.peer?.title ?? op.id}`;
      return `  • updated {id: ${op.id}} [${op.peer?.displayStatus ?? 'saved'}] ${op.peer?.label ?? op.peer?.title ?? op.id}`;
    })
    .join('\n')}\n`;
}
