import type { MastraAdmin, BuildOrchestrator, AdminLogger } from '@mastra/admin';
import { ConsoleAdminLogger } from '@mastra/admin';

import type { AdminWebSocketServer } from '../websocket';

/**
 * Configuration for the BuildWorker.
 */
export interface BuildWorkerConfig {
  /**
   * MastraAdmin instance for accessing the orchestrator and storage.
   */
  admin: MastraAdmin;

  /**
   * Optional WebSocket server for broadcasting build updates.
   */
  wsServer?: AdminWebSocketServer;

  /**
   * Polling interval in milliseconds (default: 5000).
   */
  intervalMs?: number;

  /**
   * Maximum concurrent builds (default: 3).
   */
  maxConcurrent?: number;

  /**
   * Optional logger instance.
   */
  logger?: AdminLogger;
}

/**
 * BuildWorker - Background worker that processes the build queue.
 *
 * This worker polls the build orchestrator for queued builds and processes them.
 * It broadcasts build status updates via WebSocket when available.
 *
 * @example
 * ```typescript
 * const worker = new BuildWorker({
 *   admin,
 *   wsServer,
 *   intervalMs: 5000,
 *   maxConcurrent: 3,
 * });
 *
 * // Start processing (runs in background)
 * worker.start();
 *
 * // Stop gracefully (waits for active builds)
 * await worker.stop();
 * ```
 */
export class BuildWorker {
  private readonly orchestrator: BuildOrchestrator;
  private readonly wsServer?: AdminWebSocketServer;
  private readonly intervalMs: number;
  private readonly maxConcurrent: number;
  private readonly logger: AdminLogger;
  private readonly activeBuilds: Set<string> = new Set();

  private running = false;
  private processingPromise?: Promise<void>;

  constructor(config: BuildWorkerConfig) {
    this.orchestrator = config.admin.getOrchestrator();
    this.wsServer = config.wsServer;
    this.intervalMs = config.intervalMs ?? 5000;
    this.maxConcurrent = config.maxConcurrent ?? 3;
    this.logger = config.logger ?? new ConsoleAdminLogger('BuildWorker');
  }

  /**
   * Start the build worker.
   * Returns immediately; processing happens in the background.
   */
  start(): void {
    if (this.running) {
      this.logger.warn('BuildWorker already running');
      return;
    }

    this.running = true;
    this.logger.info('BuildWorker started');

    // Start the processing loop
    this.processingPromise = this.processLoop();
  }

  /**
   * Stop the build worker gracefully.
   * Waits for active builds to complete (with timeout).
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.logger.info('BuildWorker stopping...');

    // Wait for the processing loop to exit
    if (this.processingPromise) {
      await this.processingPromise;
    }

    // Wait for active builds to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const start = Date.now();

    while (this.activeBuilds.size > 0 && Date.now() - start < timeout) {
      this.logger.info(`Waiting for ${this.activeBuilds.size} active build(s) to complete...`);
      await this.sleep(1000);
    }

    if (this.activeBuilds.size > 0) {
      this.logger.warn(`Force stopping with ${this.activeBuilds.size} active build(s)`);
    }

    this.logger.info('BuildWorker stopped');
  }

  /**
   * Check if the worker is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get the number of active builds.
   */
  getActiveBuildCount(): number {
    return this.activeBuilds.size;
  }

  /**
   * Get the IDs of active builds.
   */
  getActiveBuilds(): string[] {
    return Array.from(this.activeBuilds);
  }

  /**
   * Main processing loop.
   */
  private async processLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.processQueue();
      } catch (error) {
        this.logger.error('Error processing build queue', { error });
      }

      // Wait before checking queue again
      if (this.running) {
        await this.sleep(this.intervalMs);
      }
    }
  }

  /**
   * Process the next build(s) in the queue.
   */
  private async processQueue(): Promise<void> {
    // Check if we can process more builds
    if (this.activeBuilds.size >= this.maxConcurrent) {
      return;
    }

    const slotsAvailable = this.maxConcurrent - this.activeBuilds.size;

    // Try to process up to `slotsAvailable` builds
    for (let i = 0; i < slotsAvailable; i++) {
      // First check in-memory queue (for recently queued builds)
      const queueStatus = this.orchestrator.getQueueStatus();
      this.logger.debug('Queue status', { queueLength: queueStatus.length, processing: queueStatus.processing });

      if (queueStatus.length > 0) {
        // Process from in-memory queue
        this.logger.info('Processing build from in-memory queue');
        const processed = await this.orchestrator.processNextBuild();
        this.logger.info('Build processed', { processed });
        if (processed) {
          continue;
        }
      }

      // If in-memory queue is empty, check database queue directly
      // This handles builds queued before server restart or missed builds
      const storage = this.orchestrator.getStorage();
      if (storage && 'dequeueNextBuild' in storage) {
        this.logger.debug('Checking database queue');
        const build = await (storage as { dequeueNextBuild: () => Promise<unknown> }).dequeueNextBuild();
        if (build) {
          // Process the build directly via orchestrator
          this.logger.info('Processing build from database queue', { buildId: (build as { id: string }).id });
          await this.orchestrator.processBuildById((build as { id: string }).id);
          continue;
        }
      }

      // No more builds to process
      break;
    }
  }

  /**
   * Broadcast build log via WebSocket.
   */
  broadcastLog(buildId: string, line: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this.wsServer) return;

    this.wsServer.broadcastEvent({
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
   * Broadcast build status change via WebSocket.
   */
  broadcastStatus(
    buildId: string,
    status: 'queued' | 'building' | 'deploying' | 'succeeded' | 'failed' | 'cancelled',
    message?: string,
  ): void {
    if (!this.wsServer) return;

    this.wsServer.broadcastEvent({
      type: 'build:status',
      payload: {
        buildId,
        status,
        message,
      },
    });
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
