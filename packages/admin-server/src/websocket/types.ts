import type { WebSocket } from 'ws';

/**
 * WebSocket event types for real-time updates.
 */
export type WSEventType = 'build:log' | 'build:status' | 'server:log' | 'server:health' | 'deployment:status';

/**
 * Build log event - real-time log lines from a build process.
 */
export interface BuildLogEvent {
  type: 'build:log';
  payload: {
    buildId: string;
    line: string;
    timestamp: string;
    level: 'info' | 'warn' | 'error';
  };
}

/**
 * Build status event - build status changes.
 */
export interface BuildStatusEvent {
  type: 'build:status';
  payload: {
    buildId: string;
    status: 'queued' | 'building' | 'deploying' | 'succeeded' | 'failed' | 'cancelled';
    message?: string;
  };
}

/**
 * Server log event - real-time log lines from a running server.
 */
export interface ServerLogEvent {
  type: 'server:log';
  payload: {
    serverId: string;
    line: string;
    timestamp: string;
    stream: 'stdout' | 'stderr';
  };
}

/**
 * Server health event - health status updates for a running server.
 */
export interface ServerHealthEvent {
  type: 'server:health';
  payload: {
    serverId: string;
    status: 'starting' | 'healthy' | 'unhealthy' | 'stopping';
    lastCheck: string;
    details?: {
      memoryUsageMb?: number;
      cpuPercent?: number;
      uptime?: number;
    };
  };
}

/**
 * Deployment status event - deployment status changes.
 */
export interface DeploymentStatusEvent {
  type: 'deployment:status';
  payload: {
    deploymentId: string;
    status: 'pending' | 'building' | 'running' | 'stopped' | 'failed';
    publicUrl?: string;
  };
}

/**
 * Union type for all WebSocket events.
 */
export type WSEvent = BuildLogEvent | BuildStatusEvent | ServerLogEvent | ServerHealthEvent | DeploymentStatusEvent;

/**
 * Generic WebSocket message format.
 */
export interface WSMessage {
  type: string;
  payload: unknown;
}

/**
 * Subscribe message payload.
 */
export interface SubscribePayload {
  channel: string;
}

/**
 * Unsubscribe message payload.
 */
export interface UnsubscribePayload {
  channel: string;
}

/**
 * Connected confirmation payload.
 */
export interface ConnectedPayload {
  clientId: string;
}

/**
 * Subscribed confirmation payload.
 */
export interface SubscribedPayload {
  channel: string;
}

/**
 * Unsubscribed confirmation payload.
 */
export interface UnsubscribedPayload {
  channel: string;
}

/**
 * Pong response payload (empty).
 */
export interface PongPayload {
  /* empty */
}

/**
 * Client message types (messages sent from client to server).
 */
export type ClientMessageType = 'subscribe' | 'unsubscribe' | 'ping';

/**
 * Server message types (messages sent from server to client).
 */
export type ServerMessageType =
  | 'connected'
  | 'subscribed'
  | 'unsubscribed'
  | 'pong'
  | 'error'
  | 'build:log'
  | 'build:status'
  | 'server:log'
  | 'server:health'
  | 'deployment:status';

/**
 * Connected WebSocket client.
 */
export interface WSClient {
  /**
   * WebSocket connection.
   */
  ws: WebSocket;

  /**
   * Authenticated user ID.
   */
  userId: string;

  /**
   * Channels this client is subscribed to.
   */
  subscriptions: Set<string>;
}

/**
 * WebSocket server configuration.
 */
export interface WSServerConfig {
  /**
   * Path for WebSocket connections (default: '/ws').
   */
  path?: string;
}

/**
 * Channel types for subscriptions.
 * - build:{buildId} - Subscribe to build logs and status for a specific build
 * - server:{serverId} - Subscribe to server logs and health for a specific server
 * - deployment:{deploymentId} - Subscribe to deployment status updates
 */
export type ChannelType = `build:${string}` | `server:${string}` | `deployment:${string}`;

/**
 * Error message sent to clients.
 */
export interface WSErrorMessage {
  type: 'error';
  payload: {
    code: string;
    message: string;
  };
}
