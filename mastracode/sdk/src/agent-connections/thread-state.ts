import type { RequestContext } from '@mastra/core/request-context';

import {
  AGENT_CONNECTIONS_STATE_TYPE,
  type AgentConnectionsState,
  type ConnectedAgentPeer,
  type SentAgentSignal,
} from './types.js';

export const AGENT_CONNECTIONS_REQUEST_CONTEXT_KEY = 'mastracode.agentConnections';

export type ResolvedAgentConnectionStore = {
  getState<T = unknown>(args: { threadId: string; type: string }): Promise<T | undefined>;
  setState<T = unknown>(args: { threadId: string; type: string; value: T }): Promise<void>;
};

export interface AgentConnectionContext {
  agent?: { threadId?: string; resourceId?: string; agentId?: string };
  requestContext?: RequestContext;
  mastra?: { getStorage?: () => any };
  runtimeAgent?: { discoverThreadPeers?: (...args: any[]) => Promise<unknown> };
}

export function isMemoryBacked(agent: AgentConnectionContext['agent']): boolean {
  return Boolean(agent?.threadId && agent?.resourceId);
}

export function isThreadStateStore(value: unknown): value is ResolvedAgentConnectionStore {
  return (
    !!value &&
    typeof (value as ResolvedAgentConnectionStore).getState === 'function' &&
    typeof (value as ResolvedAgentConnectionStore).setState === 'function'
  );
}

export async function resolveAgentConnectionStore(
  context: AgentConnectionContext,
): Promise<ResolvedAgentConnectionStore | undefined> {
  const store = await context.mastra?.getStorage?.()?.getStore?.('threadState');
  return isThreadStateStore(store) ? store : undefined;
}

export function normalizeAgentConnectionsState(value: unknown): AgentConnectionsState {
  if (!value || typeof value !== 'object') return { peers: [] };
  const state = value as { peers?: unknown; sentSignals?: unknown };
  return {
    peers: Array.isArray(state.peers) ? normalizeConnectedPeers(state.peers) : [],
    sentSignals: Array.isArray(state.sentSignals) ? normalizeSentAgentSignals(state.sentSignals) : [],
  };
}

export function normalizeConnectedPeers(peers: unknown[]): ConnectedAgentPeer[] {
  const seen = new Set<string>();
  const normalized: ConnectedAgentPeer[] = [];
  for (const peer of peers) {
    if (!peer || typeof peer !== 'object') continue;
    const candidate = peer as Partial<ConnectedAgentPeer>;
    if (!candidate.id || !candidate.resourceId || !candidate.threadId) continue;
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    normalized.push({
      id: candidate.id,
      agentId: candidate.agentId,
      resourceId: candidate.resourceId,
      threadId: candidate.threadId,
      label: candidate.label,
      title: candidate.title,
      mode: candidate.mode,
      status: candidate.status === 'offline' ? 'offline' : 'available',
      pid: candidate.pid,
      connectedAt: typeof candidate.connectedAt === 'number' ? candidate.connectedAt : Date.now(),
      lastSeenAt: typeof candidate.lastSeenAt === 'number' ? candidate.lastSeenAt : 0,
      offlineAt: typeof candidate.offlineAt === 'number' ? candidate.offlineAt : undefined,
    });
  }
  return sortConnectedPeers(normalized);
}

export function sortConnectedPeers(peers: ConnectedAgentPeer[]): ConnectedAgentPeer[] {
  return [...peers].sort((a, b) => a.id.localeCompare(b.id));
}

export function normalizeSentAgentSignals(signals: unknown[]): SentAgentSignal[] {
  return signals.flatMap(signal => {
    if (!signal || typeof signal !== 'object') return [];
    const candidate = signal as Partial<SentAgentSignal>;
    if (
      !candidate.messageId ||
      !candidate.fingerprint ||
      !candidate.targetId ||
      !candidate.priority ||
      typeof candidate.expectsReply !== 'boolean' ||
      !candidate.returnPeerId ||
      typeof candidate.sentAt !== 'number'
    ) {
      return [];
    }
    return [candidate as SentAgentSignal];
  });
}

async function readAgentConnectionsState(context: AgentConnectionContext): Promise<AgentConnectionsState> {
  const store = await resolveAgentConnectionStore(context);
  const threadId = context.agent?.threadId;
  if (!store || !threadId) return { peers: [] };
  const state = await store.getState<AgentConnectionsState>({ threadId, type: AGENT_CONNECTIONS_STATE_TYPE });
  return normalizeAgentConnectionsState(state);
}

export async function readAgentConnections(context: AgentConnectionContext): Promise<ConnectedAgentPeer[]> {
  return (await readAgentConnectionsState(context)).peers;
}

export async function writeAgentConnections(
  context: AgentConnectionContext,
  peers: ConnectedAgentPeer[],
): Promise<void> {
  const store = await resolveAgentConnectionStore(context);
  const threadId = context.agent?.threadId;
  if (!store || !threadId) return;
  const current = await readAgentConnectionsState(context);
  const state = { ...current, peers: sortConnectedPeers(peers) };
  await store.setState({ threadId, type: AGENT_CONNECTIONS_STATE_TYPE, value: state });
  context.requestContext?.set(AGENT_CONNECTIONS_REQUEST_CONTEXT_KEY, state.peers);
}

export async function readSentAgentSignals(context: AgentConnectionContext): Promise<SentAgentSignal[]> {
  return (await readAgentConnectionsState(context)).sentSignals ?? [];
}

export async function writeSentAgentSignals(
  context: AgentConnectionContext,
  sentSignals: SentAgentSignal[],
): Promise<void> {
  const store = await resolveAgentConnectionStore(context);
  const threadId = context.agent?.threadId;
  if (!store || !threadId) return;
  const current = await readAgentConnectionsState(context);
  await store.setState({
    threadId,
    type: AGENT_CONNECTIONS_STATE_TYPE,
    value: { ...current, sentSignals: sentSignals.slice(-100) },
  });
}

export function getCarriedAgentConnections(
  requestContext: RequestContext | undefined,
): ConnectedAgentPeer[] | undefined {
  const value = requestContext?.get(AGENT_CONNECTIONS_REQUEST_CONTEXT_KEY);
  return Array.isArray(value) ? normalizeConnectedPeers(value) : undefined;
}
