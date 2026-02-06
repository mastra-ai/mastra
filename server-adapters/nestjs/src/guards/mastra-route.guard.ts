import type { Mastra } from '@mastra/core/mastra';
import { Inject, Injectable, Scope } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { MASTRA, MASTRA_OPTIONS } from '../constants';
import type { MastraModuleOptions } from '../mastra.module';
import { AuthService } from '../services/auth.service';
import { RequestContextService } from '../services/request-context.service';
import { RouteHandlerService } from '../services/route-handler.service';
import { getMastraRoutePath } from '../utils/route-path';
import { MastraThrottleGuard } from './mastra-throttle.guard';

/**
 * Guard for Mastra routes handled by MastraController.
 * Runs route matching to avoid authenticating non-Mastra paths,
 * then enforces auth + rate limiting for matched Mastra routes.
 */
@Injectable({ scope: Scope.REQUEST })
export class MastraRouteGuard implements CanActivate {
  constructor(
    @Inject(MASTRA) private readonly mastra: Mastra,
    @Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions,
    @Inject(RouteHandlerService) private readonly routeHandler: RouteHandlerService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(MastraThrottleGuard) private readonly throttleGuard: MastraThrottleGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();
    const routePath = getMastraRoutePath(request.path, this.options.prefix);

    // If not a Mastra route, allow controller to handle 404 logic.
    const matchResult = this.routeHandler.matchRoute(method, routePath);
    if (!matchResult) {
      return true;
    }

    // Run Mastra's internal auth if explicitly enabled via module options
    // or if the Mastra server instance has auth configured.
    if (this.options.auth?.enabled || this.mastra.getServer()?.auth) {
      const user = await this.authService.authenticate(request);
      if (user !== undefined) {
        this.requestContext.setUser(user);
      }
    }

    // Apply rate limiting to matched Mastra routes.
    if (this.options.rateLimitOptions?.enabled !== false) {
      const limit = request.path.includes('/generate')
        ? (this.options.rateLimitOptions?.generateLimit ?? 10)
        : (this.options.rateLimitOptions?.defaultLimit ?? 100);
      const windowMs = this.options.rateLimitOptions?.windowMs ?? 60000;
      await this.throttleGuard.checkLimit(request, limit, windowMs);
    }

    return true;
  }
}
