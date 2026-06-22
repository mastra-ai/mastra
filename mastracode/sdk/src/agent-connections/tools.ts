import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { AgentConnectionRegistry } from './registry.js';
import {
  isMemoryBacked,
  readAgentConnections,
  writeAgentConnections,
  type AgentConnectionContext,
} from './thread-state.js';
import type {
  AgentConnectResult,
  AgentConnectionDeltaOp,
  AgentConnectionListResult,
  AgentSignalPriority,
  AgentSignalSendResult,
  ConnectedAgentPeer,
} from './types.js';

const prioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

const peerSchema = z.object({
  id: z.string(),
  agentId: z.string().optional(),
  resourceId: z.string(),
  threadId: z.string(),
  label: z.string().optional(),
  title: z.string().optional(),
  mode: z.string().optional(),
  status: z.enum(['available', 'offline']),
  pid: z.number().optional(),
  connectedAt: z.number().optional(),
  lastSeenAt: z.number(),
  offlineAt: z.number().optional(),
  connected: z.boolean().optional(),
});

const listResultSchema = z.object({
  content: z.string(),
  available: z.array(peerSchema),
  connected: z.array(peerSchema),
  isError: z.boolean().optional(),
});

const connectResultSchema = z.object({
  content: z.string(),
  connected: z.array(peerSchema),
  changed: z.array(
    z.object({ op: z.string(), id: z.string(), peer: peerSchema.optional(), status: z.string().optional() }),
  ),
  isError: z.boolean().optional(),
});

const signalResultSchema = z.object({
  content: z.string(),
  target: peerSchema.optional(),
  priority: prioritySchema.optional(),
  notification: z.unknown().optional(),
  isError: z.boolean().optional(),
});

export interface AgentConnectionToolsOptions {
  registry?: AgentConnectionRegistry;
  getAgent?: () =>
    | {
        sendNotificationSignal?: (...args: any[]) => Promise<unknown>;
        discoverThreadPeers?: (...args: any[]) => Promise<unknown>;
      }
    | undefined;
}

export function createAgentConnectionTools(options: AgentConnectionToolsOptions = {}) {
  const registry = options.registry ?? new AgentConnectionRegistry();

  const agentConnectionsListTool = createTool({
    id: 'agent_connections_list',
    description: `List peer MastraCode agents that this thread can connect to.

Returns currently available peers plus already-connected peers that may now be offline. Use agent_connect with a returned peer id to connect or disconnect.`,
    inputSchema: z.object({}),
    outputSchema: listResultSchema,
    execute: async (_input, context): Promise<AgentConnectionListResult> => {
      const agentContext = context as AgentConnectionContext;
      try {
        if (!isMemoryBacked(agentContext.agent)) {
          return noMemoryListResult();
        }
        const runtimeAgent = options.getAgent?.();
        const registryContext = { ...agentContext, runtimeAgent };
        const available = await registry.listPeers(registryContext);
        const connected = await registry.connectedPeers(registryContext);
        return {
          content: formatPeerList(available, connected),
          available,
          connected,
          isError: false,
        };
      } catch (error) {
        return {
          content: `Failed to list agent connections: ${errorMessage(error)}`,
          available: [],
          connected: [],
          isError: true,
        };
      }
    },
  });

  const agentConnectTool = createTool({
    id: 'agent_connect',
    description: `Connect or disconnect peer MastraCode agents by stable id.

Use agent_connections_list first, then pass peer ids from that result. Connected agents are persisted per thread and surfaced through connected-agent state signals.`,
    inputSchema: z.object({
      ids: z.array(z.string().min(1)).min(1).describe('Peer ids returned by agent_connections_list.'),
      action: z
        .enum(['connect', 'disconnect'])
        .default('connect')
        .describe('Whether to connect or disconnect the peers.'),
    }),
    outputSchema: connectResultSchema,
    execute: async ({ ids, action = 'connect' }, context): Promise<AgentConnectResult> => {
      const agentContext = context as AgentConnectionContext;
      try {
        if (!isMemoryBacked(agentContext.agent)) {
          return noMemoryConnectResult();
        }
        const current = await readAgentConnections(agentContext);
        const registryContext = { ...agentContext, runtimeAgent: options.getAgent?.() };
        const byId = new Map(current.map(peer => [peer.id, peer]));
        const changed: AgentConnectionDeltaOp[] = [];
        const now = Date.now();

        if (action === 'disconnect') {
          for (const id of ids) {
            if (byId.delete(id)) changed.push({ op: 'disconnect', id });
          }
        } else {
          for (const id of ids) {
            const peer = await registry.findPeer(registryContext, id);
            if (!peer) return errorConnectResult(`Unknown agent peer id: ${id}`, current, changed);
            if (peer.status === 'offline') return errorConnectResult(`Agent peer is offline: ${id}`, current, changed);
            const connectedPeer: ConnectedAgentPeer = {
              id: peer.id,
              agentId: peer.agentId,
              resourceId: peer.resourceId,
              threadId: peer.threadId,
              label: peer.label,
              title: peer.title,
              mode: peer.mode,
              status: peer.status,
              pid: peer.pid,
              connectedAt: byId.get(peer.id)?.connectedAt ?? now,
              lastSeenAt: peer.lastSeenAt,
              offlineAt: peer.offlineAt,
            };
            byId.set(peer.id, connectedPeer);
            changed.push({ op: 'connect', id: peer.id, peer: connectedPeer });
          }
        }

        const connected = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
        await writeAgentConnections(agentContext, connected);
        return {
          content: formatConnectResult(action, changed, connected),
          connected,
          changed,
          isError: false,
        };
      } catch (error) {
        return {
          content: `Failed to update agent connections: ${errorMessage(error)}`,
          connected: [],
          changed: [],
          isError: true,
        };
      }
    },
  });

  const agentSignalSendTool = createTool({
    id: 'agent_signal_send',
    description: `Send a prioritized notification signal to a connected peer agent.

The target must already be connected and currently available. Use priority to indicate urgency: low, medium, high, or urgent.`,
    inputSchema: z.object({
      targetId: z.string().min(1).describe('Connected peer id.'),
      summary: z.string().min(1).describe('Short summary to deliver to the peer.'),
      priority: prioritySchema.default('medium'),
      payload: z.unknown().optional().describe('Optional structured payload for the peer.'),
    }),
    outputSchema: signalResultSchema,
    execute: async ({ targetId, summary, priority = 'medium', payload }, context): Promise<AgentSignalSendResult> => {
      const agentContext = context as AgentConnectionContext;
      try {
        if (!isMemoryBacked(agentContext.agent)) {
          return { content: 'Agent signals require a memory-backed thread.', isError: true };
        }
        const runtimeAgent = options.getAgent?.();
        const connected = await registry.connectedPeers({ ...agentContext, runtimeAgent });
        const target = connected.find(peer => peer.id === targetId);
        if (!target) return { content: `Agent peer is not connected: ${targetId}`, isError: true };
        if (target.status === 'offline')
          return { content: `Agent peer is offline: ${targetId}`, target, isError: true };
        const agent = options.getAgent?.();
        if (!agent?.sendNotificationSignal) {
          return {
            content: 'Agent signal sending is unavailable because no connected agent runtime is registered.',
            target,
            isError: true,
          };
        }
        const notification = await agent.sendNotificationSignal(
          {
            source: 'agent-connection',
            kind: 'peer-signal',
            priority: priority as AgentSignalPriority,
            summary,
            payload: {
              ...(payload === undefined ? {} : { payload }),
              from: { resourceId: agentContext.agent?.resourceId, threadId: agentContext.agent?.threadId },
              targetId,
            },
          },
          {
            resourceId: target.resourceId,
            threadId: target.threadId,
            ifIdle: priority === 'low' ? { behavior: 'persist' } : { behavior: 'wake' },
          },
        );
        return {
          content: `Sent ${priority} signal to ${target.label ?? target.title ?? target.id}: ${summary}`,
          target,
          priority: priority as AgentSignalPriority,
          notification,
          isError: false,
        };
      } catch (error) {
        return { content: `Failed to send agent signal: ${errorMessage(error)}`, isError: true };
      }
    },
  });

  return {
    agent_connections_list: agentConnectionsListTool,
    agent_connect: agentConnectTool,
    agent_signal_send: agentSignalSendTool,
  };
}

function noMemoryListResult(): AgentConnectionListResult {
  return { content: 'Agent connections require a memory-backed thread.', available: [], connected: [], isError: true };
}

function noMemoryConnectResult(): AgentConnectResult {
  return { content: 'Agent connections require a memory-backed thread.', connected: [], changed: [], isError: true };
}

function errorConnectResult(
  content: string,
  connected: ConnectedAgentPeer[],
  changed: AgentConnectionDeltaOp[],
): AgentConnectResult {
  return { content, connected, changed, isError: true };
}

function formatPeerList(
  available: Awaited<ReturnType<AgentConnectionRegistry['listPeers']>>,
  connected: ConnectedAgentPeer[],
): string {
  if (available.length === 0) return 'No peer agents are available or connected.';
  const lines = available.map(peer => {
    const marker = peer.connected ? 'connected' : 'available';
    const label = peer.label ?? peer.title ?? peer.id;
    return `- ${peer.id} [${marker}, ${peer.status}] ${label} (${peer.resourceId}/${peer.threadId})`;
  });
  return `Agent peers:\n${lines.join('\n')}\nConnected: ${connected.length}`;
}

function formatConnectResult(
  action: 'connect' | 'disconnect',
  changed: AgentConnectionDeltaOp[],
  connected: ConnectedAgentPeer[],
): string {
  const verb = action === 'connect' ? 'Connected' : 'Disconnected';
  if (changed.length === 0) return `${verb} 0 agents. Connected agents: ${connected.length}`;
  return `${verb} ${changed.length} agent${changed.length === 1 ? '' : 's'}: ${changed.map(change => change.id).join(', ')}. Connected agents: ${connected.length}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
