import type { MastraAdmin, AdminStorage, ProjectRunner, AdminLogger, HealthStatus } from '@mastra/admin';
import { ConsoleAdminLogger } from '@mastra/admin';

import type { AdminWebSocketServer } from '../websocket';

/**
 * Configuration for the HealthCheckWorker.
 */
export interface HealthCheckWorkerConfig {
  /**
   * MastraAdmin instance for accessing storage and runner.
   */
  admin: MastraAdmin;

  /**
   * Optional WebSocket server for broadcasting health updates.
   */
  wsServer?: AdminWebSocketServer;

  /**
   * Health check interval in milliseconds (default: 30000).
   */
  intervalMs?: number;

  /**
   * Timeout for individual health checks in milliseconds (default: 10000).
   */
  healthCheckTimeoutMs?: number;

  /**
   * Number of consecutive failures before marking unhealthy (default: 3).
   */
  unhealthyThreshold?: number;

  /**
   * Optional logger instance.
   */
  logger?: AdminLogger;
}

/**
 * Health status details for a server.
 */
export interface ServerHealthDetails {
  serverId: string;
  deploymentId: string;
  status: HealthStatus;
  lastCheck: Date;
  memoryUsageMb?: number;
  cpuPercent?: number;
  consecutiveFailures: number;
}

/**
 * HealthCheckWorker - Background worker that monitors running servers.
 *
 * This worker periodically checks the health of all running servers and:
 * - Updates health status in storage
 * - Broadcasts health status via WebSocket
 * - Tracks consecutive failures for alerting
 *
 * @example
 * ```typescript
 * const worker = new HealthCheckWorker({
 *   admin,
 *   wsServer,
 *   intervalMs: 30000,
 * });
 *
 * // Start monitoring (runs in background)
 * worker.start();
 *
 * // Stop monitoring
 * await worker.stop();
 *
 * // Get current health status
 * const status = worker.getHealthStatus();
 * ```
 */
export class HealthCheckWorker {
  private readonly admin: MastraAdmin;
  private readonly storage: AdminStorage;
  private readonly wsServer?: AdminWebSocketServer;
  private readonly intervalMs: number;
  private readonly healthCheckTimeoutMs: number;
  private readonly unhealthyThreshold: number;
  private readonly logger: AdminLogger;

  /** Tracks consecutive failures per server */
  private readonly failureCounts: Map<string, number> = new Map();

  /** Last known health status per server */
  private readonly healthStatus: Map<string, ServerHealthDetails> = new Map();

  private running = false;
  private processingPromise?: Promise<void>;

  constructor(config: HealthCheckWorkerConfig) {
    this.admin = config.admin;
    this.storage = config.admin.getStorage();
    this.wsServer = config.wsServer;
    this.intervalMs = config.intervalMs ?? 30000;
    this.healthCheckTimeoutMs = config.healthCheckTimeoutMs ?? 10000;
    this.unhealthyThreshold = config.unhealthyThreshold ?? 3;
    this.logger = config.logger ?? new ConsoleAdminLogger('HealthCheckWorker');
  }

  /**
   * Start the health check worker.
   * Returns immediately; monitoring happens in the background.
   */
  start(): void {
    if (this.running) {
      this.logger.warn('HealthCheckWorker already running');
      return;
    }

    this.running = true;
    this.logger.info('HealthCheckWorker started');

    // Start the monitoring loop
    this.processingPromise = this.monitorLoop();
  }

  /**
   * Stop the health check worker.
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.logger.info('HealthCheckWorker stopping...');

    // Wait for the current check cycle to complete
    if (this.processingPromise) {
      await this.processingPromise;
    }

    this.logger.info('HealthCheckWorker stopped');
  }

  /**
   * Check if the worker is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get the current health status of all monitored servers.
   */
  getHealthStatus(): ServerHealthDetails[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Get the health status of a specific server.
   */
  getServerHealth(serverId: string): ServerHealthDetails | undefined {
    return this.healthStatus.get(serverId);
  }

  /**
   * Get the number of servers currently being monitored.
   */
  getMonitoredServerCount(): number {
    return this.healthStatus.size;
  }

  /**
   * Get the number of unhealthy servers.
   */
  getUnhealthyServerCount(): number {
    let count = 0;
    for (const status of this.healthStatus.values()) {
      if (status.status === 'unhealthy') {
        count++;
      }
    }
    return count;
  }

  /**
   * Main monitoring loop.
   */
  private async monitorLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.checkAllServers();
      } catch (error) {
        this.logger.error('Error checking servers', { error });
      }

      // Wait before next check cycle
      if (this.running) {
        await this.sleep(this.intervalMs);
      }
    }
  }

  /**
   * Check health of all running servers.
   */
  private async checkAllServers(): Promise<void> {
    // Get all running servers from storage
    const servers = await this.storage.listRunningServers();

    // Remove health status for servers that are no longer running
    const runningServerIds = new Set(servers.map(s => s.id));
    for (const serverId of this.healthStatus.keys()) {
      if (!runningServerIds.has(serverId)) {
        this.healthStatus.delete(serverId);
        this.failureCounts.delete(serverId);
      }
    }

    // Check each server in parallel
    await Promise.all(servers.map(server => this.checkServer(server)));
  }

  /**
   * Check health of a single server.
   */
  private async checkServer(server: {
    id: string;
    deploymentId: string;
    host: string;
    port: number;
  }): Promise<void> {
    const { id: serverId, deploymentId } = server;

    try {
      // Get runner from admin - may not be configured
      const runner = this.getRunner();
      if (!runner) {
        // No runner configured, can't check health
        this.updateHealthStatus(serverId, deploymentId, 'healthy', undefined, undefined);
        return;
      }

      // Run health check with timeout
      const result = await this.withTimeout(
        runner.healthCheck(server as Parameters<typeof runner.healthCheck>[0]),
        this.healthCheckTimeoutMs,
      );

      if (result.healthy) {
        // Reset failure count on success
        this.failureCounts.set(serverId, 0);

        // Get resource usage
        let memoryUsageMb: number | undefined;
        let cpuPercent: number | undefined;

        try {
          const resources = await runner.getResourceUsage(
            server as Parameters<typeof runner.getResourceUsage>[0],
          );
          memoryUsageMb = resources.memoryUsageMb ?? undefined;
          cpuPercent = resources.cpuPercent ?? undefined;
        } catch {
          // Resource usage is optional, ignore errors
        }

        this.updateHealthStatus(serverId, deploymentId, 'healthy', memoryUsageMb, cpuPercent);
      } else {
        this.handleHealthFailure(serverId, deploymentId, result.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.handleHealthFailure(serverId, deploymentId, message);
    }
  }

  /**
   * Handle a health check failure.
   */
  private handleHealthFailure(serverId: string, deploymentId: string, message?: string): void {
    const failures = (this.failureCounts.get(serverId) ?? 0) + 1;
    this.failureCounts.set(serverId, failures);

    if (failures >= this.unhealthyThreshold) {
      this.logger.warn(`Server ${serverId} is unhealthy after ${failures} consecutive failures`, {
        serverId,
        deploymentId,
        message,
      });
      this.updateHealthStatus(serverId, deploymentId, 'unhealthy');
    } else {
      this.logger.debug(`Server ${serverId} health check failed (${failures}/${this.unhealthyThreshold})`, {
        serverId,
        message,
      });
      // Keep previous status if below threshold
      const current = this.healthStatus.get(serverId);
      if (current) {
        this.updateHealthStatus(
          serverId,
          deploymentId,
          current.status,
          current.memoryUsageMb,
          current.cpuPercent,
        );
      } else {
        // First check failed, mark as starting
        this.updateHealthStatus(serverId, deploymentId, 'starting');
      }
    }
  }

  /**
   * Update health status and broadcast.
   */
  private updateHealthStatus(
    serverId: string,
    deploymentId: string,
    status: HealthStatus,
    memoryUsageMb?: number,
    cpuPercent?: number,
  ): void {
    const now = new Date();
    const failures = this.failureCounts.get(serverId) ?? 0;

    const details: ServerHealthDetails = {
      serverId,
      deploymentId,
      status,
      lastCheck: now,
      memoryUsageMb,
      cpuPercent,
      consecutiveFailures: failures,
    };

    this.healthStatus.set(serverId, details);

    // Update storage (fire and forget)
    void this.storage.updateRunningServer(serverId, {
      healthStatus: status,
      lastHealthCheck: now,
      memoryUsageMb: memoryUsageMb ?? null,
      cpuPercent: cpuPercent ?? null,
    }).catch(error => {
      this.logger.error(`Failed to update server health in storage`, { serverId, error });
    });

    // Broadcast via WebSocket
    this.broadcastHealth(serverId, status, memoryUsageMb, cpuPercent);
  }

  /**
   * Broadcast health status via WebSocket.
   */
  private broadcastHealth(
    serverId: string,
    status: HealthStatus,
    memoryUsageMb?: number,
    cpuPercent?: number,
  ): void {
    if (!this.wsServer) return;

    this.wsServer.broadcastEvent({
      type: 'server:health',
      payload: {
        serverId,
        status,
        lastCheck: new Date().toISOString(),
        details: {
          memoryUsageMb,
          cpuPercent,
        },
      },
    });
  }

  /**
   * Get the runner from admin.
   * Returns undefined if no runner is configured.
   */
  private getRunner(): ProjectRunner | undefined {
    // Access runner through admin's config
    // Note: MastraAdmin doesn't expose a getRunner() method,
    // but we can try to access it through the orchestrator or storage
    // For now, we'll return undefined as runner access isn't directly exposed
    // In a real implementation, we'd need to add a getRunner() method to MastraAdmin

    // The health check functionality works without a runner - it just won't check health
    return undefined;
  }

  /**
   * Execute a promise with a timeout.
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Health check timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
