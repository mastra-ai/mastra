import type { Mastra } from '@mastra/core/mastra';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { MASTRA, MASTRA_OPTIONS } from './constants';
import { NestMastraServer } from './mastra-server.adapter';
import type { MastraModuleOptions } from './mastra.module';
import { ShutdownService } from './services/shutdown.service';

/**
 * Injectable service for accessing Mastra and managing lifecycle.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly mastraService: MastraService) {}
 *
 *   async runAgent() {
 *     const mastra = this.mastraService.getMastra();
 *     const agent = mastra.getAgent('my-agent');
 *     return agent.generate({ messages: [{ role: 'user', content: 'Hello' }] });
 *   }
 * }
 * ```
 */
@Injectable()
export class MastraService {
  private readonly logger = new Logger(MastraService.name);
  private serverAdapter?: NestMastraServer;

  constructor(
    @Inject(MASTRA) private readonly mastra: Mastra,
    @Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions,
    @Inject(ShutdownService) private readonly shutdownService: ShutdownService,
    @Inject(HttpAdapterHost) private readonly httpAdapterHost: HttpAdapterHost,
  ) {
    // Register a real Mastra server adapter so getServerApp() works
    const app = this.httpAdapterHost?.httpAdapter?.getInstance?.();
    if (app) {
      this.serverAdapter = new NestMastraServer(app);
      this.mastra.setMastraServer(this.serverAdapter);
    } else {
      this.logger.warn('Unable to register Mastra server adapter: HTTP adapter instance not available');
    }
  }

  /**
   * Get the Mastra instance.
   */
  getMastra(): Mastra {
    return this.mastra;
  }

  /**
   * Get module options.
   */
  getOptions(): MastraModuleOptions {
    return this.options;
  }

  /**
   * Get an agent by ID.
   */
  getAgent(agentId: string) {
    return this.mastra.getAgent(agentId);
  }

  /**
   * Get a workflow by ID.
   */
  getWorkflow(workflowId: string) {
    return this.mastra.getWorkflow(workflowId);
  }

  /**
   * Check if the service is shutting down.
   */
  get isShuttingDown(): boolean {
    return this.shutdownService.shuttingDown;
  }
}
