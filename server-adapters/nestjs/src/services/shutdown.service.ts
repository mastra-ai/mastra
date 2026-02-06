import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnApplicationShutdown, OnModuleDestroy } from '@nestjs/common';
import type { Response } from 'express';

import { MASTRA_OPTIONS } from '../constants';
import type { MastraModuleOptions } from '../mastra.module';

/**
 * Service that manages graceful shutdown.
 * Tracks in-flight requests and waits for them to complete before shutdown.
 */
@Injectable()
export class ShutdownService implements OnModuleDestroy, OnApplicationShutdown {
  private readonly logger = new Logger(ShutdownService.name);
  private readonly activeRequests = new Map<string, { startTime: number; path: string }>();
  private readonly sseClients = new Set<Response>();
  private isShuttingDown = false;
  private shutdownResolve: (() => void) | null = null;

  constructor(@Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions) {}

  /**
   * Check if the service is shutting down.
   * Use this to reject new requests during shutdown.
   */
  get shuttingDown(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Get the number of active requests.
   */
  get activeRequestCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Register a new request.
   * Returns a unique request ID for tracking.
   */
  registerRequest(path: string): string {
    const requestId = randomUUID();
    this.activeRequests.set(requestId, {
      startTime: Date.now(),
      path,
    });
    return requestId;
  }

  /**
   * Mark a request as complete.
   */
  completeRequest(requestId: string): void {
    this.activeRequests.delete(requestId);

    // If we're shutting down and no more requests, resolve
    if (this.isShuttingDown && this.activeRequests.size === 0 && this.shutdownResolve) {
      this.shutdownResolve();
    }
  }

  /**
   * Register an SSE client for shutdown notifications.
   * Returns an unregister function.
   */
  registerSseClient(response: Response): () => void {
    this.sseClients.add(response);
    const unregister = () => {
      this.sseClients.delete(response);
    };
    response.once('close', unregister);
    return unregister;
  }

  /**
   * Notify all connected SSE clients about shutdown.
   */
  notifySseClients(): void {
    for (const res of this.sseClients) {
      if (res.writableFinished) {
        this.sseClients.delete(res);
        continue;
      }

      try {
        res.write(`event: shutdown\n`);
        res.write(`data: ${JSON.stringify({ message: 'Server is shutting down' })}\n\n`);
        res.end();
      } catch (error) {
        this.logger.warn(`Failed to notify SSE client: ${error instanceof Error ? error.message : String(error)}`);
        this.sseClients.delete(res);
      }
    }
  }

  /**
   * Called when the module is being destroyed.
   * Marks the service as shutting down.
   */
  onModuleDestroy(): void {
    this.isShuttingDown = true;
    this.logger.log('Module destroy initiated, marking as shutting down');
  }

  /**
   * Called when the application is shutting down.
   * Waits for in-flight requests to complete.
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.isShuttingDown = true;
    const timeoutMs = this.options.shutdownOptions?.timeoutMs ?? 30000;

    if (this.options.shutdownOptions?.notifyClients !== false) {
      this.notifySseClients();
    }

    if (this.activeRequests.size === 0) {
      this.logger.log(`Shutdown (${signal}): No active requests, proceeding immediately`);
      return;
    }

    this.logger.log(
      `Shutdown (${signal}): Waiting for ${this.activeRequests.size} active requests (timeout: ${timeoutMs}ms)`,
    );

    for (const [id, info] of this.activeRequests) {
      const elapsed = Date.now() - info.startTime;
      this.logger.debug(`  - ${id}: ${info.path} (running for ${elapsed}ms)`);
    }

    // Wait for requests to complete or timeout
    const waitForRequests = new Promise<void>(resolve => {
      this.shutdownResolve = resolve;
      if (this.activeRequests.size === 0) {
        resolve();
      }
    });

    const timeout = new Promise<void>(resolve => {
      setTimeout(() => {
        if (this.activeRequests.size > 0) {
          this.logger.warn(`Shutdown timeout: ${this.activeRequests.size} requests still active, forcing shutdown`);
          // Log which requests are still running
          for (const [id, info] of this.activeRequests) {
            const elapsed = Date.now() - info.startTime;
            this.logger.warn(`  - ${id}: ${info.path} (running for ${elapsed}ms)`);
          }
        }
        resolve();
      }, timeoutMs);
    });

    await Promise.race([waitForRequests, timeout]);

    this.logger.log('Shutdown complete');
  }
}
