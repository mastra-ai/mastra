export const AGENT_CONNECTIONS_STATE_ID = 'agent-connections';
export const AGENT_CONNECTIONS_STATE_TYPE = 'agent_connection';

export type AgentConnectionStatus = 'available' | 'offline';
export type AgentConnectionOperation = 'connect' | 'disconnect';
export type AgentSignalPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface AgentPeerIdentity {
  /** Stable model-facing id used by tools. Derived from routing fields when omitted by discovery. */
  id?: string;
  /** Target agent id. Defaults to the current code agent when omitted by discovery. */
  agentId?: string;
  resourceId: string;
  threadId: string;
  label?: string;
  title?: string;
  mode?: string;
  status?: AgentConnectionStatus;
  pid?: number;
  lastSeenAt?: number;
  offlineAt?: number;
}

export interface AvailableAgentPeer extends AgentPeerIdentity {
  id: string;
  status: AgentConnectionStatus;
  pid?: number;
  lastSeenAt: number;
  offlineAt?: number;
  connected: boolean;
}

export interface ConnectedAgentPeer extends AgentPeerIdentity {
  id: string;
  status: AgentConnectionStatus;
  pid?: number;
  connectedAt: number;
  lastSeenAt: number;
  offlineAt?: number;
}

export interface AgentConnectionsState {
  peers: ConnectedAgentPeer[];
}

export interface AgentConnectionDeltaOp {
  op: 'connect' | 'disconnect' | 'status-change' | 'update';
  id: string;
  peer?: ConnectedAgentPeer;
  status?: AgentConnectionStatus;
}

export interface AgentConnectionListResult {
  content: string;
  available: AvailableAgentPeer[];
  connected: ConnectedAgentPeer[];
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
  target?: ConnectedAgentPeer;
  priority?: AgentSignalPriority;
  notification?: unknown;
  isError?: boolean;
}
