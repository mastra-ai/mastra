import type { Server as HTTPServer, IncomingMessage } from 'node:http';
import type { MastraAdmin } from '@mastra/admin';
import { WebSocketServer, WebSocket } from 'ws';

import type {
  WSServerConfig,
  WSClient,
  WSMessage,
  SubscribePayload,
  UnsubscribePayload,
  WSEvent,
} from './types';

export * from './types';

/**
 * AdminWebSocketServer configuration with required dependencies.
 */
export interface AdminWebSocketServerConfig extends WSServerConfig {
  /**
   * MastraAdmin instance for authentication and business logic.
   */
  admin: MastraAdmin;

  /**
   * HTTP server to attach WebSocket server to.
   */
  server: HTTPServer;
}

/**
 * AdminWebSocketServer - Real-time WebSocket server for MastraAdmin.
 *
 * Provides real-time streaming of:
 * - Build logs and status updates
 * - Server logs and health status
 * - Deployment status updates
 *
 * Clients can subscribe to channels using the subscribe message:
 * - `build:{buildId}` - Build logs and status
 * - `server:{serverId}` - Server logs and health
 * - `deployment:{deploymentId}` - Deployment status
 *
 * @example
 * ```typescript
 * // Server-side
 * const wsServer = new AdminWebSocketServer({
 *   admin,
 *   server: httpServer,
 *   path: '/ws',
 * });
 *
 * // Client-side
 * const ws = new WebSocket('ws://localhost:3000/ws?token=...');
 * ws.onopen = () => {
 *   ws.send(JSON.stringify({ type: 'subscribe', payload: { channel: 'build:123' } }));
 * };
 * ws.onmessage = (event) => {
 *   const message = JSON.parse(event.data);
 *   if (message.type === 'build:log') {
 *     console.log(message.payload.line);
 *   }
 * };
 * ```
 */
export class AdminWebSocketServer {
  private readonly wss: WebSocketServer;
  private readonly clients: Map<string, WSClient> = new Map();
  private readonly admin: MastraAdmin;

  constructor(config: AdminWebSocketServerConfig) {
    this.admin = config.admin;
    this.wss = new WebSocketServer({
      server: config.server,
      path: config.path ?? '/ws',
    });

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  /**
   * Handle new WebSocket connections.
   * Authenticates the connection using the token query parameter.
   */
  private async handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
    const url = new URL(request.url ?? '', `http://${request.headers.host ?? 'localhost'}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    try {
      // Verify token through admin's auth provider
      const auth = this.admin.getAuth();
      if (!auth) {
        ws.close(4001, 'Authentication not configured');
        return;
      }

      // Validate the token
      const tokenResult = await auth.validateToken?.(token);
      if (!tokenResult) {
        ws.close(4001, 'Invalid token');
        return;
      }

      const clientId = crypto.randomUUID();
      const client: WSClient = {
        ws,
        userId: tokenResult.userId,
        subscriptions: new Set(),
      };

      this.clients.set(clientId, client);

      ws.on('message', data => this.handleMessage(clientId, data));
      ws.on('close', () => this.handleClose(clientId));
      ws.on('error', error => this.handleError(clientId, error));

      // Send connected confirmation
      this.send(clientId, {
        type: 'connected',
        payload: { clientId },
      });
    } catch (error) {
      console.error('[AdminWebSocketServer] Authentication error:', error);
      ws.close(4001, 'Authentication failed');
    }
  }

  /**
   * Handle incoming messages from clients.
   */
  private handleMessage(clientId: string, data: WebSocket.Data): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const message: WSMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          void this.handleSubscribe(clientId, message.payload as SubscribePayload);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.payload as UnsubscribePayload);
          break;
        case 'ping':
          this.send(clientId, { type: 'pong', payload: {} });
          break;
        default:
          this.send(clientId, {
            type: 'error',
            payload: {
              code: 'UNKNOWN_MESSAGE_TYPE',
              message: `Unknown message type: ${message.type}`,
            },
          });
      }
    } catch (error) {
      console.error('[AdminWebSocketServer] Message parse error:', error);
      this.send(clientId, {
        type: 'error',
        payload: {
          code: 'INVALID_MESSAGE',
          message: 'Failed to parse message',
        },
      });
    }
  }

  /**
   * Handle subscribe requests.
   * Validates that the user has access to the requested channel.
   */
  private async handleSubscribe(clientId: string, payload: SubscribePayload): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channel } = payload;

    // Validate channel format
    if (!this.isValidChannel(channel)) {
      this.send(clientId, {
        type: 'error',
        payload: {
          code: 'INVALID_CHANNEL',
          message: `Invalid channel format: ${channel}`,
        },
      });
      return;
    }

    // Validate permissions for the channel
    const hasAccess = await this.validateChannelAccess(client.userId, channel);
    if (!hasAccess) {
      this.send(clientId, {
        type: 'error',
        payload: {
          code: 'FORBIDDEN',
          message: `Access denied to channel: ${channel}`,
        },
      });
      return;
    }

    client.subscriptions.add(channel);
    this.send(clientId, {
      type: 'subscribed',
      payload: { channel },
    });
  }

  /**
   * Handle unsubscribe requests.
   */
  private handleUnsubscribe(clientId: string, payload: UnsubscribePayload): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channel } = payload;
    client.subscriptions.delete(channel);
    this.send(clientId, {
      type: 'unsubscribed',
      payload: { channel },
    });
  }

  /**
   * Handle client disconnection.
   */
  private handleClose(clientId: string): void {
    this.clients.delete(clientId);
  }

  /**
   * Handle WebSocket errors.
   */
  private handleError(clientId: string, error: Error): void {
    console.error(`[AdminWebSocketServer] Client ${clientId} error:`, error);
    this.clients.delete(clientId);
  }

  /**
   * Validate channel format.
   */
  private isValidChannel(channel: string): boolean {
    // Valid channels: build:{id}, server:{id}, deployment:{id}
    const validPrefixes = ['build:', 'server:', 'deployment:'];
    return validPrefixes.some(prefix => channel.startsWith(prefix) && channel.length > prefix.length);
  }

  /**
   * Validate that a user has access to a channel.
   * This checks RBAC permissions via MastraAdmin.
   */
  private async validateChannelAccess(userId: string, channel: string): Promise<boolean> {
    try {
      const storage = this.admin.getStorage();

      const [type, id] = channel.split(':');
      if (!id) return false;

      switch (type) {
        case 'build': {
          // Get build -> deployment -> project -> team, then check membership
          const build = await storage.getBuild(id);
          if (!build) return false;

          const deployment = await storage.getDeployment(build.deploymentId);
          if (!deployment) return false;

          const project = await storage.getProject(deployment.projectId);
          if (!project) return false;

          const membership = await storage.getTeamMember(project.teamId, userId);
          return membership !== null;
        }

        case 'server': {
          // Get server -> deployment -> project -> team, then check membership
          const server = await storage.getRunningServer(id);
          if (!server) return false;

          const deployment = await storage.getDeployment(server.deploymentId);
          if (!deployment) return false;

          const project = await storage.getProject(deployment.projectId);
          if (!project) return false;

          const membership = await storage.getTeamMember(project.teamId, userId);
          return membership !== null;
        }

        case 'deployment': {
          // Get deployment -> project -> team, then check membership
          const deployment = await storage.getDeployment(id);
          if (!deployment) return false;

          const project = await storage.getProject(deployment.projectId);
          if (!project) return false;

          const membership = await storage.getTeamMember(project.teamId, userId);
          return membership !== null;
        }

        default:
          return false;
      }
    } catch (error) {
      console.error('[AdminWebSocketServer] Error validating channel access:', error);
      return false;
    }
  }

  /**
   * Send a message to a specific client.
   */
  private send(clientId: string, message: WSMessage): void {
    const client = this.clients.get(clientId);
    if (client?.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast a message to all clients subscribed to a channel.
   */
  broadcast(channel: string, message: WSMessage): void {
    for (const [clientId, client] of this.clients) {
      if (client.subscriptions.has(channel)) {
        this.send(clientId, message);
      }
    }
  }

  /**
   * Broadcast a typed event to all clients subscribed to the appropriate channel.
   */
  broadcastEvent(event: WSEvent): void {
    let channel: string;

    switch (event.type) {
      case 'build:log':
      case 'build:status':
        channel = `build:${event.payload.buildId}`;
        break;
      case 'server:log':
      case 'server:health':
        channel = `server:${event.payload.serverId}`;
        break;
      case 'deployment:status':
        channel = `deployment:${event.payload.deploymentId}`;
        break;
    }

    this.broadcast(channel, event);
  }

  /**
   * Get the current number of connected clients.
   */
  getConnectionCount(): number {
    return this.clients.size;
  }

  /**
   * Get count of clients subscribed to a specific channel.
   */
  getChannelSubscriberCount(channel: string): number {
    let count = 0;
    for (const [, client] of this.clients) {
      if (client.subscriptions.has(channel)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Check if any clients are subscribed to a channel.
   */
  hasSubscribers(channel: string): boolean {
    for (const [, client] of this.clients) {
      if (client.subscriptions.has(channel)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Close all connections and shut down the WebSocket server.
   */
  close(): void {
    // Close all client connections
    for (const [, client] of this.clients) {
      client.ws.close(1001, 'Server shutting down');
    }
    this.clients.clear();

    // Close the WebSocket server
    this.wss.close();
  }
}
