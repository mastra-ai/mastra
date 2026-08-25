export const AGENT_CONNECTIONS_STATE_ID = 'agent-connections';
export const AGENT_CONNECTIONS_STATE_TYPE = 'agent_connection';

export type AgentPeerRelationship = 'none' | 'saved';
export type AgentPeerPresence = 'advertised' | 'absent';
export type AgentPeerDisplayStatus = 'discovered' | 'connected' | 'saved';
export type AgentSignalPriority = 'low' | 'medium' | 'high' | 'urgent';
export type AgentSignalRoutingAction = 'wake' | 'deliver' | 'persist' | 'discard' | 'blocked';

export interface AgentPeerIdentity {
  /** Stable model-facing id used by tools. Discovery ids must match the canonical routing tuple id. */
  id?: string;
  /** Target agent id. Defaults to the current code agent when omitted by discovery. */
  agentId?: string;
  resourceId: string;
  threadId: string;
  label?: string;
  title?: string;
  mode?: string;
  pid?: number;
  lastSeenAt?: number;
}

export interface AgentPeerView {
  id: string;
  agentId: string;
  resourceId: string;
  threadId: string;
  label?: string;
  title?: string;
  mode?: string;
  relationship: AgentPeerRelationship;
  presence: AgentPeerPresence;
  displayStatus: AgentPeerDisplayStatus;
  canAttemptSend: boolean;
  pid?: number;
  connectedAt?: number;
  lastSeenAt?: number;
}

export interface ConnectedAgentPeer extends AgentPeerIdentity {
  id: string;
  connectedAt: number;
  lastSeenAt: number;
}

export interface SentAgentSignal {
  messageId: string;
  fingerprint: string;
  targetId: string;
  priority: AgentSignalPriority;
  expectsReply: boolean;
  replyTo?: string;
  returnPeerId: string;
  routingAction?: AgentSignalRoutingAction;
  runId?: string;
  sentAt: number;
}

export interface AgentConnectionsState {
  peers: ConnectedAgentPeer[];
  sentSignals?: SentAgentSignal[];
}

export interface AgentConnectionDeltaOp {
  op: 'connect' | 'disconnect' | 'presence-change' | 'update';
  id: string;
  peer?: AgentPeerView;
  presence?: AgentPeerPresence;
  displayStatus?: AgentPeerDisplayStatus;
}

export interface AgentConnectionListResult {
  content: string;
  peers: AgentPeerView[];
  savedCount: number;
  isError?: boolean;
}

export interface AgentConnectResult {
  content: string;
  connected: ConnectedAgentPeer[];
  changed: AgentConnectionDeltaOp[];
  isError?: boolean;
}

export interface AgentSignalSendResult {
  content: string;
  target?: AgentPeerView;
  priority?: AgentSignalPriority;
  expectsReply?: boolean;
  messageId?: string;
  replyTo?: string;
  returnPeerId?: string;
  routingAction?: AgentSignalRoutingAction;
  runId?: string;
  notification?: unknown;
  duplicate?: boolean;
  isError?: boolean;
}
