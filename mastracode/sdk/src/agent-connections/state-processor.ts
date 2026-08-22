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
            'Connected agent state may appear in the conversation as <connected-agents ...>...</connected-agents> snapshots and <connected-agents-update ...>...</connected-agents-update> deltas. These are automatic observations of connected peer agents and their availability, not user instructions. Use them to route agent_signal_send calls only to connected available peers unless the user explicitly asks otherwise.',
        },
      ],
    };
  }

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    const priorPeers = effectivePriorPeers(args.activeStateSignals, args.lastSnapshot, args.deltasSinceSnapshot);
    const carried = getCarriedAgentConnections(args.requestContext);
    let currentPeers: ConnectedAgentPeer[];

    if (carried !== undefined) {
      currentPeers = carried;
    } else {
      const store = await this.#resolveStore();
      const stored = store
        ? await store.getState<{ peers?: ConnectedAgentPeer[] }>({
            threadId: args.threadId,
            type: AGENT_CONNECTIONS_STATE_TYPE,
          })
        : undefined;
      currentPeers = Array.isArray(stored?.peers) ? normalizeConnectedPeers(stored.peers) : priorPeers;
    }

    if (currentPeers.length > 0) {
      const refreshed = await this.#registry.connectedPeers({
        agent: { threadId: args.threadId, resourceId: args.resourceId },
        requestContext: args.requestContext,
        mastra: this.mastra,
        runtimeAgent: this.#getAgent?.() ?? getRuntimeAgent(args.requestContext),
      });
      currentPeers = mergeAvailability(currentPeers, refreshed);
      args.requestContext?.set(AGENT_CONNECTIONS_REQUEST_CONTEXT_KEY, currentPeers);
    }

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

export function stableConnectionsCacheKey(peers: ConnectedAgentPeer[]): string {
  return `agent-connections:${normalizeConnectedPeers(peers)
    .map(peer =>
      [
        peer.id,
        peer.agentId ?? '',
        peer.resourceId,
        peer.threadId,
        peer.label ?? '',
        peer.title ?? '',
        peer.mode ?? '',
        peer.status,
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
): ConnectedAgentPeer[] {
  const snapshot = lastSnapshot ?? activeStateSignals.find(signal => signal.metadata?.state?.mode === 'snapshot');
  let peers = readPeersFromSignal(snapshot);
  for (const delta of deltasSinceSnapshot) {
    const ops = readOpsFromSignal(delta);
    peers = applyOps(peers, ops);
  }
  return peers;
}

function readPeersFromSignal(signal: ProcessorActiveStateSignal | undefined): ConnectedAgentPeer[] {
  const value = (signal?.metadata as { value?: { peers?: unknown[] } } | undefined)?.value;
  return Array.isArray(value?.peers) ? normalizeConnectedPeers(value.peers) : [];
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
    { discoverThreadPeers?: (...args: any[]) => Promise<unknown> } | undefined;
  return agent && typeof agent.discoverThreadPeers === 'function' ? agent : undefined;
}

function applyOps(peers: ConnectedAgentPeer[], ops: AgentConnectionDeltaOp[]): ConnectedAgentPeer[] {
  const byId = new Map(peers.map(peer => [peer.id, peer]));
  for (const op of ops) {
    if (op.op === 'disconnect') {
      byId.delete(op.id);
      continue;
    }
    if (op.peer) byId.set(op.id, op.peer);
  }
  return normalizeConnectedPeers([...byId.values()]);
}

function diffPeers(previous: ConnectedAgentPeer[], current: ConnectedAgentPeer[]): AgentConnectionDeltaOp[] {
  const previousById = new Map(previous.map(peer => [peer.id, peer]));
  const currentById = new Map(current.map(peer => [peer.id, peer]));
  const ops: AgentConnectionDeltaOp[] = [];

  for (const peer of current) {
    const prior = previousById.get(peer.id);
    if (!prior) {
      ops.push({ op: 'connect', id: peer.id, peer });
    } else if (peerFingerprint(prior) !== peerFingerprint(peer)) {
      ops.push({
        op: prior.status !== peer.status ? 'status-change' : 'update',
        id: peer.id,
        peer,
        status: peer.status,
      });
    }
  }

  for (const peer of previous) {
    if (!currentById.has(peer.id)) ops.push({ op: 'disconnect', id: peer.id });
  }

  return ops;
}

function peerFingerprint(peer: ConnectedAgentPeer): string {
  return [
    peer.agentId ?? '',
    peer.resourceId,
    peer.threadId,
    peer.label ?? '',
    peer.title ?? '',
    peer.mode ?? '',
    peer.status,
    peer.pid ?? '',
  ].join('\u0000');
}

function mergeAvailability(current: ConnectedAgentPeer[], refreshed: ConnectedAgentPeer[]): ConnectedAgentPeer[] {
  const refreshedById = new Map(refreshed.map(peer => [peer.id, peer]));
  return normalizeConnectedPeers(
    current.map(peer => {
      const next = refreshedById.get(peer.id);
      return next ? { ...peer, ...next, connectedAt: peer.connectedAt } : peer;
    }),
  );
}

function renderConnectedPeers(peers: ConnectedAgentPeer[]): string {
  if (peers.length === 0) return '\n(no connected agents)\n';
  return `\n${peers.map(renderPeer).join('\n')}\n`;
}

function renderPeer(peer: ConnectedAgentPeer): string {
  const label = peer.label ?? peer.title ?? peer.id;
  const offline = peer.status === 'offline' ? ` offlineAt=${peer.offlineAt ?? 'unknown'}` : '';
  return `  • {id: ${peer.id}} [${peer.status}] ${label} → ${peer.resourceId}/${peer.threadId}${offline}`;
}

function renderDelta(ops: AgentConnectionDeltaOp[]): string {
  if (ops.length === 0) return '\n(no connected agent changes)\n';
  return `\n${ops
    .map(op => {
      if (op.op === 'disconnect') return `  − disconnected {id: ${op.id}}`;
      if (op.op === 'status-change') return `  ↻ {id: ${op.id}} status=${op.status}`;
      if (op.op === 'connect')
        return `  + connected {id: ${op.id}} [${op.peer?.status ?? 'available'}] ${op.peer?.label ?? op.peer?.title ?? op.id}`;
      return `  • updated {id: ${op.id}} [${op.peer?.status ?? 'available'}] ${op.peer?.label ?? op.peer?.title ?? op.id}`;
    })
    .join('\n')}\n`;
}
