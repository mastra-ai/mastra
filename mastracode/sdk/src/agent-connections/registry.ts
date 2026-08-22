import type { RequestContext } from '@mastra/core/request-context';
import type { AgentConnectionContext } from './thread-state.js';
import { readAgentConnections } from './thread-state.js';
import type { AgentConnectionStatus, AgentPeerIdentity, AvailableAgentPeer, ConnectedAgentPeer } from './types.js';

type NormalizedAgentPeerIdentity = AgentPeerIdentity & { id: string };

export const AGENT_CONNECTIONS_DISCOVERY_CONTEXT_KEY = 'mastracode.agentConnectionPeers';
export const DEFAULT_AGENT_CONNECTION_OFFLINE_TTL_MS = 30_000;

type PeerDiscoverySource = (context: AgentConnectionContext) => Promise<AgentPeerIdentity[]> | AgentPeerIdentity[];

export interface AgentConnectionRegistryOptions {
  offlineTtlMs?: number;
  now?: () => number;
  listPeers?: PeerDiscoverySource;
}

export class AgentConnectionRegistry {
  readonly #offlineTtlMs: number;
  readonly #now: () => number;
  readonly #listPeers?: PeerDiscoverySource;

  constructor(options: AgentConnectionRegistryOptions = {}) {
    this.#offlineTtlMs = options.offlineTtlMs ?? DEFAULT_AGENT_CONNECTION_OFFLINE_TTL_MS;
    this.#now = options.now ?? Date.now;
    this.#listPeers = options.listPeers;
  }

  async listPeers(context: AgentConnectionContext): Promise<AvailableAgentPeer[]> {
    const now = this.#now();
    const connected = await readAgentConnections(context);
    const discovered = await this.#discover(context);
    const byId = new Map<string, AvailableAgentPeer>();

    for (const peer of discovered) {
      const normalized = normalizeDiscoveredPeer(peer, now, this.#offlineTtlMs);
      if (isSelf(normalized, context)) continue;
      byId.set(normalized.id, normalized);
    }

    for (const peer of connected) {
      const discoveredPeer = byId.get(peer.id);
      const statusPeer = discoveredPeer
        ? { ...discoveredPeer, connected: true }
        : connectedPeerToAvailable(peer, now, this.#offlineTtlMs);
      byId.set(peer.id, statusPeer);
    }

    const result = [...byId.values()].sort(comparePeers);
    return result;
  }

  async connectedPeers(context: AgentConnectionContext): Promise<ConnectedAgentPeer[]> {
    const available = await this.listPeers(context);
    const connected = await readAgentConnections(context);
    const connectedIds = new Set(connected.map(peer => peer.id));
    return available
      .filter(peer => connectedIds.has(peer.id))
      .map(peer => {
        const existing = connected.find(item => item.id === peer.id);
        return {
          id: peer.id,
          agentId: peer.agentId,
          resourceId: peer.resourceId,
          threadId: peer.threadId,
          label: peer.label,
          title: peer.title,
          mode: peer.mode,
          status: peer.status,
          pid: peer.pid,
          connectedAt: existing?.connectedAt ?? this.#now(),
          lastSeenAt: peer.lastSeenAt,
          offlineAt: peer.offlineAt,
        };
      })
      .sort(comparePeers);
  }

  async findPeer(context: AgentConnectionContext, id: string): Promise<AvailableAgentPeer | undefined> {
    const peers = await this.listPeers(context);
    return peers.find(peer => peer.id === id);
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
        const normalized = normalizePeerIdentity(peer);
        if (normalized) byId.set(normalized.id, normalized);
      }
    }
    return [...byId.values()].sort(comparePeers);
  }

  async #discoverFromInjectedSource(context: AgentConnectionContext): Promise<AgentPeerIdentity[]> {
    if (!this.#listPeers) return [];
    const peers = await this.#listPeers(context);
    return peers;
  }
}

export function stablePeerId(peer: Omit<AgentPeerIdentity, 'id'> & { id?: string }): string {
  if (peer.id) return peer.id;
  return [peer.agentId ?? 'code-agent', peer.resourceId, peer.threadId].map(part => encodeURIComponent(part)).join(':');
}

function normalizePeerIdentity(peer: unknown): NormalizedAgentPeerIdentity | undefined {
  if (!peer || typeof peer !== 'object') return;
  const candidate = peer as Partial<AgentPeerIdentity>;
  if (!candidate.resourceId || !candidate.threadId) return;
  return {
    id: stablePeerId(candidate as Omit<AgentPeerIdentity, 'id'> & { id?: string }),
    agentId: candidate.agentId,
    resourceId: candidate.resourceId,
    threadId: candidate.threadId,
    label: candidate.label,
    title: candidate.title,
    mode: candidate.mode,
    status: candidate.status,
    pid: candidate.pid,
    lastSeenAt: candidate.lastSeenAt,
    offlineAt: candidate.offlineAt,
  };
}

function normalizeDiscoveredPeer(peer: AgentPeerIdentity, now: number, ttlMs: number): AvailableAgentPeer {
  const candidate = peer as AgentPeerIdentity & { lastSeenAt?: number; status?: AgentConnectionStatus };
  const lastSeenAt = typeof candidate.lastSeenAt === 'number' ? candidate.lastSeenAt : now;
  const status = candidate.status ?? availabilityFromPeer(candidate, lastSeenAt, now, ttlMs);
  return {
    ...peer,
    id: stablePeerId(peer),
    status,
    lastSeenAt,
    offlineAt: status === 'offline' ? now : undefined,
    connected: false,
  };
}

function connectedPeerToAvailable(peer: ConnectedAgentPeer, now: number, ttlMs: number): AvailableAgentPeer {
  const status = availabilityFromPeer(peer, peer.lastSeenAt, now, ttlMs);
  return {
    ...peer,
    status,
    offlineAt: status === 'offline' ? (peer.offlineAt ?? now) : undefined,
    connected: true,
  };
}

function availabilityFromPeer(
  peer: AgentPeerIdentity,
  lastSeenAt: number,
  now: number,
  ttlMs: number,
): AgentConnectionStatus {
  if (typeof peer.pid === 'number') return isProcessAlive(peer.pid) ? 'available' : 'offline';
  return lastSeenAt > 0 && now - lastSeenAt <= ttlMs ? 'available' : 'offline';
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function discoverFromCoreAgent(context: AgentConnectionContext): Promise<AgentPeerIdentity[]> {
  if (!context.runtimeAgent?.discoverThreadPeers) {
    return [];
  }
  const peers = await context.runtimeAgent.discoverThreadPeers({ timeoutMs: 100 });
  if (!Array.isArray(peers)) return [];
  return peers.filter(isPeerLike).map(peer => {
    const candidate = peer as AgentPeerIdentity & { metadata?: { mode?: unknown } };
    const metadata = (peer as { metadata?: unknown }).metadata;
    const mode =
      metadata && typeof metadata === 'object' && typeof (metadata as { mode?: unknown }).mode === 'string'
        ? (metadata as { mode: string }).mode
        : candidate.mode;
    return { ...candidate, mode, status: candidate.status ?? 'available' };
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
