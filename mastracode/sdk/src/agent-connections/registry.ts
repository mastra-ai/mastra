import type { RequestContext } from '@mastra/core/request-context';
import type { AgentConnectionContext } from './thread-state.js';
import { readAgentConnections } from './thread-state.js';
import type { AgentPeerIdentity, AgentPeerView, ConnectedAgentPeer } from './types.js';

type NormalizedAgentPeerIdentity = Omit<AgentPeerIdentity, 'id' | 'agentId'> & { id: string; agentId: string };

export const AGENT_CONNECTIONS_DISCOVERY_CONTEXT_KEY = 'mastracode.agentConnectionPeers';
export const DEFAULT_AGENT_CONNECTION_OFFLINE_TTL_MS = 30_000;

type PeerDiscoverySource = (context: AgentConnectionContext) => Promise<AgentPeerIdentity[]> | AgentPeerIdentity[];

export interface AgentConnectionRegistryOptions {
  /** Retained for configuration compatibility. Presence now requires a fresh discovery advertisement. */
  offlineTtlMs?: number;
  now?: () => number;
  listPeers?: PeerDiscoverySource;
}

export class AgentConnectionRegistry {
  readonly #now: () => number;
  readonly #listPeers?: PeerDiscoverySource;

  constructor(options: AgentConnectionRegistryOptions = {}) {
    this.#now = options.now ?? Date.now;
    this.#listPeers = options.listPeers;
  }

  async discoverPeers(context: AgentConnectionContext): Promise<AgentPeerView[]> {
    const discovered = await this.#discover(context);
    return discovered
      .filter(peer => !isSelf(peer, context))
      .map(peer => discoveredPeerToView(peer))
      .sort(comparePeers);
  }

  async listPeers(context: AgentConnectionContext, savedPeers?: ConnectedAgentPeer[]): Promise<AgentPeerView[]> {
    const saved = savedPeers ?? (await readAgentConnections(context));
    const discovered = await this.discoverPeers(context);
    const byId = new Map<string, AgentPeerView>(discovered.map(peer => [peer.id, peer]));

    for (const peer of saved) {
      const canonicalId = stablePeerId(peer);
      const discoveredPeer = peer.id === canonicalId ? byId.get(peer.id) : undefined;
      if (discoveredPeer && sameEndpoint(peer, discoveredPeer)) {
        byId.set(peer.id, {
          ...discoveredPeer,
          relationship: 'saved',
          displayStatus: 'connected',
          canAttemptSend: true,
          connectedAt: peer.connectedAt,
        });
      } else {
        byId.set(peer.id, savedPeerToAbsentView(peer));
      }
    }

    return [...byId.values()].sort(comparePeers);
  }

  async connectedPeers(context: AgentConnectionContext, savedPeers?: ConnectedAgentPeer[]): Promise<AgentPeerView[]> {
    return (await this.listPeers(context, savedPeers)).filter(peer => peer.relationship === 'saved');
  }

  async findPeer(context: AgentConnectionContext, id: string): Promise<AgentPeerView | undefined> {
    return (await this.listPeers(context)).find(peer => peer.id === id);
  }

  async findDiscoveredPeer(context: AgentConnectionContext, id: string): Promise<AgentPeerView | undefined> {
    return (await this.discoverPeers(context)).find(peer => peer.id === id);
  }

  async #discover(context: AgentConnectionContext): Promise<NormalizedAgentPeerIdentity[]> {
    const injected = await this.#discoverFromInjectedSource(context);
    const core = await discoverFromCoreAgent(context);
    const requestContext = discoverFromRequestContext(context.requestContext);
    const env = discoverFromEnv();
    const sources = [injected, core, requestContext, env];
    const byId = new Map<string, NormalizedAgentPeerIdentity>();
    for (const peers of sources) {
      for (const peer of peers) {
        const normalized = normalizePeerIdentity(peer, this.#now());
        if (normalized) byId.set(normalized.id, normalized);
      }
    }
    return [...byId.values()].sort(comparePeers);
  }

  async #discoverFromInjectedSource(context: AgentConnectionContext): Promise<AgentPeerIdentity[]> {
    if (!this.#listPeers) return [];
    return this.#listPeers(context);
  }
}

export function stablePeerId(peer: Omit<AgentPeerIdentity, 'id'> & { id?: string }): string {
  return [peer.agentId ?? 'code-agent', peer.resourceId, peer.threadId].map(part => encodeURIComponent(part)).join(':');
}

function normalizePeerIdentity(peer: unknown, now: number): NormalizedAgentPeerIdentity | undefined {
  if (!peer || typeof peer !== 'object') return;
  const candidate = peer as Partial<AgentPeerIdentity>;
  if (!candidate.resourceId || !candidate.threadId) return;
  const agentId = candidate.agentId ?? 'code-agent';
  const id = stablePeerId({ agentId, resourceId: candidate.resourceId, threadId: candidate.threadId });
  if (candidate.id && candidate.id !== id) return;
  return {
    id,
    agentId,
    resourceId: candidate.resourceId,
    threadId: candidate.threadId,
    label: candidate.label,
    title: candidate.title,
    mode: candidate.mode,
    pid: candidate.pid,
    lastSeenAt: typeof candidate.lastSeenAt === 'number' ? candidate.lastSeenAt : now,
  };
}

function discoveredPeerToView(peer: NormalizedAgentPeerIdentity): AgentPeerView {
  return {
    ...peer,
    relationship: 'none',
    presence: 'advertised',
    displayStatus: 'discovered',
    canAttemptSend: false,
  };
}

function savedPeerToAbsentView(peer: ConnectedAgentPeer): AgentPeerView {
  return {
    id: peer.id,
    agentId: peer.agentId ?? 'code-agent',
    resourceId: peer.resourceId,
    threadId: peer.threadId,
    label: peer.label,
    title: peer.title,
    mode: peer.mode,
    relationship: 'saved',
    presence: 'absent',
    displayStatus: 'saved',
    canAttemptSend: false,
    pid: peer.pid,
    connectedAt: peer.connectedAt,
    lastSeenAt: peer.lastSeenAt,
  };
}

function sameEndpoint(a: AgentPeerIdentity, b: AgentPeerIdentity): boolean {
  return (
    (a.agentId ?? 'code-agent') === (b.agentId ?? 'code-agent') &&
    a.resourceId === b.resourceId &&
    a.threadId === b.threadId
  );
}

async function discoverFromCoreAgent(context: AgentConnectionContext): Promise<AgentPeerIdentity[]> {
  if (!context.runtimeAgent?.discoverThreadPeers) return [];
  const peers = await context.runtimeAgent.discoverThreadPeers({ timeoutMs: 100 });
  if (!Array.isArray(peers)) return [];
  return peers.filter(isPeerLike).map(peer => {
    const candidate = peer as AgentPeerIdentity & { metadata?: { mode?: unknown } };
    const metadata = (peer as { metadata?: unknown }).metadata;
    const mode =
      metadata && typeof metadata === 'object' && typeof (metadata as { mode?: unknown }).mode === 'string'
        ? (metadata as { mode: string }).mode
        : candidate.mode;
    return { ...candidate, mode };
  });
}

function discoverFromRequestContext(requestContext: RequestContext | undefined): AgentPeerIdentity[] {
  const value = requestContext?.get(AGENT_CONNECTIONS_DISCOVERY_CONTEXT_KEY);
  if (Array.isArray(value)) return value.filter(isPeerLike) as AgentPeerIdentity[];
  if (value && typeof value === 'object') {
    const peers = (value as { peers?: unknown }).peers;
    if (Array.isArray(peers)) return peers.filter(isPeerLike) as AgentPeerIdentity[];
  }
  return [];
}

function discoverFromEnv(): AgentPeerIdentity[] {
  const raw = process.env.MASTRACODE_AGENT_CONNECTION_PEERS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    const peers = Array.isArray(parsed) ? parsed : (parsed as { peers?: unknown })?.peers;
    return Array.isArray(peers) ? (peers.filter(isPeerLike) as AgentPeerIdentity[]) : [];
  } catch {
    return [];
  }
}

function isPeerLike(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as AgentPeerIdentity).resourceId === 'string' &&
    typeof (value as AgentPeerIdentity).threadId === 'string'
  );
}

function isSelf(peer: AgentPeerIdentity, context: AgentConnectionContext): boolean {
  return peer.resourceId === context.agent?.resourceId && peer.threadId === context.agent?.threadId;
}

function comparePeers(a: { id: string }, b: { id: string }): number {
  return a.id.localeCompare(b.id);
}
