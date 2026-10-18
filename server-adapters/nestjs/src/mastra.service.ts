import type { Mastra } from '@mastra/core/mastra';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { MASTRA, MASTRA_OPTIONS } from './constants';
import { NestMastraServer } from './mastra-server.adapter';
import type { MastraModuleOptions } from './mastra.module';
import { RouteHandlerService } from './services/route-handler.service';
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
export class MastraService implements OnModuleInit {
  private readonly logger = new Logger(MastraService.name);
  private serverAdapter?: NestMastraServer;

  constructor(
    @Inject(MASTRA) private readonly mastra: Mastra,
    @Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions,
    @Inject(ShutdownService) private readonly shutdownService: ShutdownService,
    @Inject(HttpAdapterHost) private readonly httpAdapterHost: HttpAdapterHost,
    @Inject(RouteHandlerService) private readonly routeHandler: RouteHandlerService,
  ) {
    this.initializeServerAdapter();
  }

  onModuleInit(): void {
    this.initializeServerAdapter();
  }

  private initializeServerAdapter(): void {
    if (this.serverAdapter) {
      return;
    }

    const adapterType = this.httpAdapterHost?.httpAdapter?.getType?.();
    if (adapterType && adapterType !== 'express') {
      throw new Error(
        `MastraModule requires NestJS to use the Express HTTP adapter. Received "${adapterType}". ` +
          'Install @nestjs/platform-express and bootstrap with the Express platform.',
      );
    }

    const app = this.httpAdapterHost?.httpAdapter?.getInstance?.();
    if (!app) {
      this.logger.warn('Unable to register Mastra server adapter: HTTP adapter instance not available');
      return;
    }

    this.serverAdapter = new NestMastraServer(app, this.routeHandler);
    this.mastra.setMastraServer(this.serverAdapter);
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
