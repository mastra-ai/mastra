import { createHash, randomUUID } from 'node:crypto';

import type { SendAgentNotificationSignalResult, SendAgentSignalAccepted } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { AgentConnectionRegistry, stablePeerId } from './registry.js';
import {
  isMemoryBacked,
  readAgentConnections,
  readSentAgentSignals,
  writeAgentConnections,
  writeSentAgentSignals,
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
  expectsReply: z.boolean().optional(),
  messageId: z.string().optional(),
  replyTo: z.string().optional(),
  returnPeerId: z.string().optional(),
  routingAction: z.enum(['wake', 'deliver', 'persist', 'discard', 'blocked']).optional(),
  runId: z.string().optional(),
  notification: z.unknown().optional(),
  duplicate: z.boolean().optional(),
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

The target must already be connected and currently available. Use expectsReply to declare whether the peer should send one signal back to this thread. Reuse messageId when retrying the same logical send, and set replyTo to the request messageId when replying. Use priority to indicate urgency: low, medium, high, or urgent.`,
    inputSchema: z.object({
      targetId: z.string().min(1).describe('Connected peer id.'),
      summary: z.string().min(1).describe('Short summary to deliver to the peer.'),
      priority: prioritySchema.default('medium'),
      expectsReply: z.boolean().describe('Whether the peer is expected to send one signal back to this thread.'),
      messageId: z
        .string()
        .min(1)
        .optional()
        .describe('Stable logical message id. Reuse the same id when retrying the same send.'),
      replyTo: z.string().min(1).optional().describe('Message id of the peer request this signal replies to.'),
      payload: z.unknown().optional().describe('Optional structured payload for the peer.'),
    }),
    outputSchema: signalResultSchema,
    execute: async (
      { targetId, summary, priority = 'medium', expectsReply, messageId: inputMessageId, replyTo, payload },
      context,
    ): Promise<AgentSignalSendResult> => {
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
        const currentAgent = agentContext.agent as { resourceId: string; threadId: string; agentId?: string };
        const returnPeerId = stablePeerId({
          agentId: currentAgent.agentId || undefined,
          resourceId: currentAgent.resourceId,
          threadId: currentAgent.threadId,
        });
        const messageId = inputMessageId ?? randomUUID();
        const fingerprint = fingerprintAgentSignal({ targetId, summary, priority, expectsReply, replyTo, payload });
        const sentSignals = await readSentAgentSignals(agentContext);
        const previousSend = sentSignals.find(signal => signal.messageId === messageId);
        if (previousSend) {
          if (previousSend.fingerprint !== fingerprint) {
            return {
              content: `Message id ${messageId} was already used for a different cross-agent signal.`,
              target,
              priority: priority as AgentSignalPriority,
              expectsReply,
              messageId,
              replyTo,
              returnPeerId,
              isError: true,
            };
          }
          return {
            content: `Cross-agent signal ${messageId} was already routed to ${target.label ?? target.title ?? target.id}.`,
            target,
            priority: previousSend.priority,
            expectsReply: previousSend.expectsReply,
            messageId,
            replyTo: previousSend.replyTo,
            returnPeerId: previousSend.returnPeerId,
            routingAction: previousSend.routingAction,
            runId: previousSend.runId,
            duplicate: true,
            isError: false,
          };
        }
        const crossAgentMessaging = {
          expectsReply,
          messageId,
          ...(replyTo ? { replyTo } : {}),
          returnPeerId,
          from: { resourceId: currentAgent.resourceId, threadId: currentAgent.threadId },
          targetId,
        };
        const notification = (await agent.sendNotificationSignal(
          {
            source: 'agent-connection',
            sourceId: returnPeerId,
            kind: 'peer-signal',
            priority: priority as AgentSignalPriority,
            summary,
            dedupeKey: `agent-signal:${returnPeerId}:${messageId}`,
            attributes: {
              expectsReply,
              messageId,
              ...(replyTo ? { replyTo } : {}),
              ...(expectsReply ? { returnPeerId } : {}),
            },
            metadata: { crossAgentMessaging },
            payload: {
              ...(payload === undefined ? {} : { payload }),
              ...crossAgentMessaging,
            },
          },
          {
            resourceId: target.resourceId,
            threadId: target.threadId,
            ifIdle: priority === 'low' ? { behavior: 'persist' } : { behavior: 'wake' },
          },
        )) as SendAgentNotificationSignalResult;
        const accepted = notification.accepted ? await notification.accepted : undefined;
        if (accepted?.action === 'persist') await notification.persisted;
        const routingAction = accepted?.action;
        const runId = accepted && 'runId' in accepted ? accepted.runId : undefined;
        await writeSentAgentSignals(agentContext, [
          ...sentSignals,
          {
            messageId,
            fingerprint,
            targetId,
            priority: priority as AgentSignalPriority,
            expectsReply,
            replyTo,
            returnPeerId,
            routingAction,
            runId,
            sentAt: Date.now(),
          },
        ]);
        return {
          content: formatSignalResult({
            target,
            summary,
            priority: priority as AgentSignalPriority,
            accepted,
            notification,
          }),
          target,
          priority: priority as AgentSignalPriority,
          expectsReply,
          messageId,
          replyTo,
          returnPeerId,
          routingAction,
          runId,
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

function formatSignalResult({
  target,
  summary,
  priority,
  accepted,
  notification,
}: {
  target: ConnectedAgentPeer;
  summary: string;
  priority: AgentSignalPriority;
  accepted?: SendAgentSignalAccepted;
  notification: SendAgentNotificationSignalResult;
}): string {
  const label = target.label ?? target.title ?? target.id;
  switch (accepted?.action) {
    case 'wake':
      return `Woke ${label} with a ${priority} signal in run ${accepted.runId}: ${summary}`;
    case 'deliver':
      return `Delivered ${priority} signal to ${label} in run ${accepted.runId}: ${summary}`;
    case 'persist':
      return `Persisted ${priority} signal for ${label} to process later: ${summary}`;
    case 'discard':
      return `The ${priority} signal to ${label} was discarded: ${summary}`;
    case 'blocked':
      return `The ${priority} signal to ${label} was blocked because thread ${target.threadId} is suspended: ${summary}`;
    default:
      return `Notification policy chose ${notification.decision.action} for ${label}; no signal routing outcome was produced: ${summary}`;
  }
}

function fingerprintAgentSignal(value: {
  targetId: string;
  summary: string;
  priority: string;
  expectsReply: boolean;
  replyTo?: string;
  payload?: unknown;
}): string {
  return createHash('sha256')
    .update(JSON.stringify(sortJsonValue(value)))
    .digest('hex');
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, sortJsonValue(nestedValue)]),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
