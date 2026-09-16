import { MastraServerBase } from '@mastra/core/server';
import type { ServerRoute } from '@mastra/server/server-adapter';
import type { Application } from 'express';

import type { RouteHandlerService } from './services/route-handler.service';

/**
 * Mastra server adapter wrapper for NestJS.
 * Provides app access and delegates dynamic route registration to the catch-all controller.
 */
export class NestMastraServer extends MastraServerBase<Application> {
  constructor(
    app: Application,
    private readonly routeHandler: RouteHandlerService,
  ) {
    super({ app, name: 'NestMastraServer' });
  }

  async registerRoute(_app: Application, route: ServerRoute, _options?: { prefix?: string }): Promise<void> {
    this.routeHandler.registerRoute(route);
  }
}
