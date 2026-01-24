import type { AdminWebSocketServer } from './index';

/**
 * BuildLogStreamer configuration.
 */
export interface BuildLogStreamerConfig {
  /**
   * WebSocket server for broadcasting logs.
   */
  wsServer: AdminWebSocketServer;
}

/**
 * BuildLogStreamer - Handles real-time broadcasting of build logs via WebSocket.
 *
 * This class provides methods to broadcast build logs and status updates to
 * connected WebSocket clients. It doesn't manage streams directly - instead,
 * it's used by the BuildOrchestrator (or BuildWorker) to broadcast logs as
 * they are generated.
 *
 * @example
 * ```typescript
 * const streamer = new BuildLogStreamer({ wsServer });
 *
 * // Broadcast log lines as they come in
 * streamer.broadcastLog(buildId, 'Installing dependencies...');
 * streamer.broadcastLog(buildId, 'Build complete!');
 *
 * // Broadcast status changes
 * streamer.broadcastStatus(buildId, 'succeeded');
 * ```
 */
export class BuildLogStreamer {
  private readonly wsServer: AdminWebSocketServer;

  constructor(config: BuildLogStreamerConfig) {
    this.wsServer = config.wsServer;
  }

  /**
   * Broadcast a build status change.
   */
  broadcastStatus(
    buildId: string,
    status: 'queued' | 'building' | 'deploying' | 'succeeded' | 'failed' | 'cancelled',
    message?: string,
  ): void {
    this.wsServer.broadcast(`build:${buildId}`, {
      type: 'build:status',
      payload: {
        buildId,
        status,
        message,
      },
    });
  }

  /**
   * Broadcast a build log line.
   */
  broadcastLog(buildId: string, line: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    this.wsServer.broadcast(`build:${buildId}`, {
      type: 'build:log',
      payload: {
        buildId,
        line,
        timestamp: new Date().toISOString(),
        level,
      },
    });
  }

  /**
   * Broadcast multiple log lines at once.
   */
  broadcastLogs(buildId: string, lines: string[], level: 'info' | 'warn' | 'error' = 'info'): void {
    for (const line of lines) {
      this.broadcastLog(buildId, line, level);
    }
  }

  /**
   * Check if there are any subscribers for a build channel.
   */
  hasSubscribers(buildId: string): boolean {
    return this.wsServer.hasSubscribers(`build:${buildId}`);
  }

  /**
   * Get the count of subscribers for a build channel.
   */
  getSubscriberCount(buildId: string): number {
    return this.wsServer.getChannelSubscriberCount(`build:${buildId}`);
  }
}
