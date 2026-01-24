import type { AdminWebSocketServer } from './index';

/**
 * ServerLogStreamer configuration.
 */
export interface ServerLogStreamerConfig {
  /**
   * WebSocket server for broadcasting logs.
   */
  wsServer: AdminWebSocketServer;
}

/**
 * ServerLogStreamer - Handles real-time broadcasting of server logs via WebSocket.
 *
 * This class provides methods to broadcast server logs and health updates to
 * connected WebSocket clients. It doesn't manage streams directly - instead,
 * it's used by the HealthCheckWorker (or other components) to broadcast logs
 * and health status as they are generated.
 *
 * @example
 * ```typescript
 * const streamer = new ServerLogStreamer({ wsServer });
 *
 * // Broadcast log lines
 * streamer.broadcastLog(serverId, 'Server started on port 3000');
 * streamer.broadcastLog(serverId, 'Error: Connection refused', 'stderr');
 *
 * // Broadcast health updates
 * streamer.broadcastHealth(serverId, 'healthy', { memoryUsageMb: 128 });
 * ```
 */
export class ServerLogStreamer {
  private readonly wsServer: AdminWebSocketServer;

  constructor(config: ServerLogStreamerConfig) {
    this.wsServer = config.wsServer;
  }

  /**
   * Broadcast a server health status change.
   */
  broadcastHealth(
    serverId: string,
    status: 'starting' | 'healthy' | 'unhealthy' | 'stopping',
    details?: {
      memoryUsageMb?: number;
      cpuPercent?: number;
      uptime?: number;
    },
  ): void {
    this.wsServer.broadcast(`server:${serverId}`, {
      type: 'server:health',
      payload: {
        serverId,
        status,
        lastCheck: new Date().toISOString(),
        details,
      },
    });
  }

  /**
   * Broadcast a server log line.
   */
  broadcastLog(serverId: string, line: string, stream: 'stdout' | 'stderr' = 'stdout'): void {
    this.wsServer.broadcast(`server:${serverId}`, {
      type: 'server:log',
      payload: {
        serverId,
        line,
        timestamp: new Date().toISOString(),
        stream,
      },
    });
  }

  /**
   * Broadcast multiple log lines at once.
   */
  broadcastLogs(serverId: string, lines: string[], stream: 'stdout' | 'stderr' = 'stdout'): void {
    for (const line of lines) {
      this.broadcastLog(serverId, line, stream);
    }
  }

  /**
   * Check if there are any subscribers for a server channel.
   */
  hasSubscribers(serverId: string): boolean {
    return this.wsServer.hasSubscribers(`server:${serverId}`);
  }

  /**
   * Get the count of subscribers for a server channel.
   */
  getSubscriberCount(serverId: string): number {
    return this.wsServer.getChannelSubscriberCount(`server:${serverId}`);
  }
}
