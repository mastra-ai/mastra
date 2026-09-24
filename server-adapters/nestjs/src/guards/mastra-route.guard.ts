import type { Mastra } from '@mastra/core/mastra';
import { Inject, Injectable, Scope } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

import { MASTRA, MASTRA_OPTIONS } from '../constants';
import type { MastraModuleOptions } from '../mastra.module';
import { AuthService } from '../services/auth.service';
import { CustomRouteService } from '../services/custom-route.service';
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
    @Inject(CustomRouteService) private readonly customRoutes: CustomRouteService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();
    const routePath = getMastraRoutePath(request.path, this.options.prefix);
    const matchResult = routePath ? this.routeHandler.matchRoute(method, routePath) : undefined;

    if (!matchResult) {
      // Custom routes from `server.apiRoutes` (registerApiRoute) live outside the prefix.
      const customRoute = this.customRoutes.match(method, request.path);
      if (customRoute) {
        await this.authenticate(context, request, customRoute.requiresAuth !== false);
      }
      // Otherwise let the controller handle 404 logic.
      return true;
    }

    await this.authenticate(context, request);

    // Apply rate limiting to matched Mastra routes.
    if (this.options.rateLimitOptions?.enabled !== false) {
      const { limit, windowMs } = this.throttleGuard.getRateLimitSettings(request, undefined, routePath ?? undefined);
      await this.throttleGuard.checkLimit(request, limit, windowMs, routePath ?? undefined);
    }

    return true;
  }

  private async authenticate(context: ExecutionContext, request: Request, requiresAuth?: boolean): Promise<void> {
    // Run auth if module options enable it, or if the Mastra server has auth
    // configured (unless module options explicitly disable it).
    if (this.options.auth?.enabled === false || !(this.options.auth?.enabled || this.mastra.getServer()?.auth)) {
      return;
    }

    const user = await this.authService.authenticate(request, {
      requestContext: this.requestContext.requestContext,
      response: context.switchToHttp().getResponse<Response>(),
      requiresAuth,
    });
    if (user !== undefined) {
      this.requestContext.setUser(user);
    }
  }
}
