import type { RequestContext } from '@mastra/core/request-context';
import { getEffectivePermission, MASTRA_AUTH_MODE_KEY } from '@mastra/server/server-adapter';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { ForbiddenException, Inject, Injectable, Scope } from '@nestjs/common';
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

      const permissionError = await this.checkRoutePermission(matchResult.route, this.requestContext.requestContext);
      if (permissionError) {
        throw new ForbiddenException(permissionError.message);
      }
    }

    // Apply rate limiting to matched Mastra routes.
    if (this.options.rateLimitOptions?.enabled !== false) {
      const { limit, windowMs } = this.throttleGuard.getRateLimitSettings(request, undefined, routePath ?? undefined);
      await this.throttleGuard.checkLimit(request, limit, windowMs, routePath ?? undefined);
    }

    return true;
  }

  /** Mirrors `MastraServer.checkRoutePermission`, which this adapter cannot inherit. */
  private async checkRoutePermission(
    route: ServerRoute,
    requestContext: RequestContext,
  ): Promise<{ message: string } | null> {
    const server = this.options.mastra.getServer();
    const rbac =
      requestContext.get(MASTRA_AUTH_MODE_KEY) === 'studio'
        ? (this.options.mastra.getStudio?.()?.rbac ?? server?.rbac)
        : server?.rbac;
    if (!rbac) return null;

    const required = getEffectivePermission(route);
    if (!required) return null;

    const hasPermission = await loadHasPermission();
    if (!hasPermission) return null;

    const permissions = Array.isArray(required) ? required : [required];
    const userPermissions = requestContext.get('userPermissions') as string[] | undefined;
    if (userPermissions && permissions.some(permission => hasPermission(userPermissions, permission))) return null;

    return {
      message: `Missing required permission: ${permissions.join(' or ')}`,
    };
  }
}

type HasPermissionFn = (userPerms: string[], required: string) => boolean;
let hasPermissionPromise: Promise<HasPermissionFn | undefined> | undefined;
function loadHasPermission(): Promise<HasPermissionFn | undefined> {
  hasPermissionPromise ??= import('@mastra/core/auth/ee')
    .then(m => m.hasPermission)
    .catch(() => {
      console.error(
        '[@mastra/nestjs] Auth features require @mastra/core >= 1.6.0. Please upgrade: npm install @mastra/core@latest',
      );
      return undefined;
    });
  return hasPermissionPromise;
}
