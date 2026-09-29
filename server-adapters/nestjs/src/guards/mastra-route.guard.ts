import { Inject, Injectable, Scope } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

import { MASTRA_OPTIONS } from '../constants';
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
    const matchResult = routePath ? this.routeHandler.matchRoute(method, routePath) : undefined;

    if (!matchResult) {
      // Custom routes (`server.apiRoutes`) are authenticated by CustomRouteService once
      // Hono has matched them; otherwise the controller handles 404s.
      return true;
    }

    if (this.authService.isEnabled()) {
      const user = await this.authService.authenticate(request, {
        requestContext: this.requestContext.requestContext,
        response: context.switchToHttp().getResponse<Response>(),
      });
      if (user !== undefined) {
        this.requestContext.setUser(user);
      }
    }

    // Apply rate limiting to matched Mastra routes.
    if (this.options.rateLimitOptions?.enabled !== false) {
      const { limit, windowMs } = this.throttleGuard.getRateLimitSettings(request, undefined, routePath ?? undefined);
      await this.throttleGuard.checkLimit(request, limit, windowMs, routePath ?? undefined);
    }

    return true;
  }
}
