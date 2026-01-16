import type { ParsedRequestParams, ServerRoute } from '@mastra/server/server-adapter';
import { MastraServer as MastraServerBase } from '@mastra/server/server-adapter';
import type { INestApplication } from '@nestjs/common';

import { ExpressPlatformAdapter } from './platform/express';
import { FastifyPlatformAdapter } from './platform/fastify';
import type { MastraServerOptions, PlatformAdapter, PlatformType } from './types';

/**
 * Mastra server adapter for NestJS applications.
 *
 * Supports both Express and Fastify platforms. The platform is automatically
 * detected based on the NestJS HTTP adapter in use.
 *
 * @example Express (default)
 * ```typescript
 * import { NestFactory } from '@nestjs/core';
 * import { MastraServer } from '@mastra/nestjs';
 *
 * const app = await NestFactory.create(AppModule);
 * const adapter = new MastraServer({ app, mastra });
 * await adapter.init();
 * await app.listen(3000);
 * ```
 *
 * @example Fastify
 * ```typescript
 * import { NestFactory } from '@nestjs/core';
 * import { FastifyAdapter } from '@nestjs/platform-fastify';
 * import { MastraServer } from '@mastra/nestjs';
 *
 * const app = await NestFactory.create(AppModule, new FastifyAdapter());
 * const adapter = new MastraServer({ app, mastra });
 * await adapter.init();
 * await app.listen(3000, '0.0.0.0');
 * ```
 */
export class MastraServer extends MastraServerBase<INestApplication, unknown, unknown> {
  private platformAdapter: PlatformAdapter;
  private readonly platformType: PlatformType;

  constructor(options: MastraServerOptions) {
    super({
      app: options.app,
      mastra: options.mastra,
      bodyLimitOptions: options.bodyLimitOptions,
      tools: options.tools,
      prefix: options.prefix,
      openapiPath: options.openapiPath,
      taskStore: options.taskStore,
      customRouteAuthConfig: options.customRouteAuthConfig,
      streamOptions: options.streamOptions,
    });

    // Detect platform from NestJS HTTP adapter
    this.platformType = this.detectPlatform(options.app);

    // Create platform-specific adapter
    if (this.platformType === 'fastify') {
      this.platformAdapter = new FastifyPlatformAdapter(this, options);
    } else {
      this.platformAdapter = new ExpressPlatformAdapter(this, options);
    }
  }

  /**
   * Detect which HTTP platform NestJS is using.
   */
  private detectPlatform(app: INestApplication): PlatformType {
    const httpAdapter = app.getHttpAdapter();
    const adapterName = httpAdapter.constructor.name;

    // Check for Fastify adapter by class name
    if (adapterName === 'FastifyAdapter' || adapterName.includes('Fastify')) {
      return 'fastify';
    }

    // Check if the instance has Fastify-specific methods
    try {
      const instance = httpAdapter.getInstance();
      if (instance && typeof instance === 'object') {
        // Fastify has a 'route' method and 'addHook' method
        if (typeof (instance as any).route === 'function' && typeof (instance as any).addHook === 'function') {
          // Additional check: Fastify doesn't have 'use' as its primary middleware method
          // Express has 'use' as a primary method
          if (typeof (instance as any).use !== 'function' || typeof (instance as any).register === 'function') {
            return 'fastify';
          }
        }
      }
    } catch {
      // If we can't access the instance, fall back to Express
    }

    // Default to Express
    return 'express';
  }

  /**
   * Get the detected platform type.
   */
  getPlatformType(): PlatformType {
    return this.platformType;
  }

  /**
   * Get the underlying platform adapter.
   */
  getPlatformAdapter(): PlatformAdapter {
    return this.platformAdapter;
  }

  // Delegate all abstract methods to the platform adapter

  createContextMiddleware(): unknown {
    return this.platformAdapter.createContextMiddleware();
  }

  async stream(route: ServerRoute, response: unknown, result: unknown): Promise<void> {
    return this.platformAdapter.stream(route, response, result);
  }

  async getParams(route: ServerRoute, request: unknown): Promise<ParsedRequestParams> {
    return this.platformAdapter.getParams(route, request);
  }

  async sendResponse(route: ServerRoute, response: unknown, result: unknown, request?: unknown): Promise<void> {
    return this.platformAdapter.sendResponse(route, response, result, request);
  }

  async registerRoute(app: INestApplication, route: ServerRoute, options: { prefix?: string }): Promise<void> {
    return this.platformAdapter.registerRoute(route, options);
  }

  registerContextMiddleware(): void {
    this.platformAdapter.registerContextMiddleware();
  }

  registerAuthMiddleware(): void {
    this.platformAdapter.registerAuthMiddleware();
  }
}

// Re-export types
export type { MastraServerOptions, PlatformType, PlatformAdapter, MastraContext } from './types';
