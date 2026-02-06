import type { Mastra } from '@mastra/core/mastra';
import {
  isProtectedPath,
  canAccessPublicly,
  isDevPlaygroundRequest,
  checkRules,
  defaultAuthConfig,
} from '@mastra/server/auth';
import { Inject, Injectable, Logger, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

import { MASTRA, MASTRA_OPTIONS } from '../constants';
import type { MastraModuleOptions } from '../mastra.module';

/**
 * Service that handles authentication for Mastra routes.
 * Called after route matching to check if auth is required.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(MASTRA) private readonly mastra: Mastra,
    @Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions,
  ) {}

  /**
   * Check authentication for a request based on the matched route.
   * Returns the authenticated user if auth succeeds, undefined if no auth required.
   * Throws UnauthorizedException or ForbiddenException if auth fails.
   *
   * Type assertions (`as any`) are used because `@mastra/server/auth` types
   * are Hono-centric. The runtime values work with Express requests.
   */
  async authenticate(request: Request): Promise<unknown> {
    const authConfig = this.mastra.getServer()?.auth;
    const customRouteAuthConfig = this.options.customRouteAuthConfig;
    const method = request.method;
    const path = request.path;

    // No auth config means no authentication required
    if (!authConfig) {
      return undefined;
    }

    const getHeader = (name: string): string | undefined => {
      const value = request.headers[name.toLowerCase()];
      return Array.isArray(value) ? value[0] : value;
    };

    // Check if this is a dev playground request (skip auth in dev mode)
    if (isDevPlaygroundRequest(path, method, getHeader, authConfig, customRouteAuthConfig)) {
      return undefined;
    }

    // Check if this path needs protection
    if (!isProtectedPath(path, method, authConfig, customRouteAuthConfig)) {
      return undefined;
    }

    // Check if the route can be accessed publicly
    if (canAccessPublicly(path, method, authConfig)) {
      return undefined;
    }

    // Auth is required - authenticate the request
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      // Validate token using Mastra's auth system
      let user: unknown;

      if (typeof (authConfig as any).authenticateToken === 'function') {
        user = await (authConfig as any).authenticateToken(token, request as any);
      } else {
        throw new Error('No token verification method configured');
      }

      if (!user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      // Express Request doesn't have a `user` property natively
      (request as any).user = user;

      // Perform authorization check
      await this.authorize(request, path, method, user, authConfig);

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error('Authentication error:', error instanceof Error ? error.message : 'Unknown error');
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Check authorization for an authenticated user.
   * `authConfig` is typed as `any` because `@mastra/server/auth` doesn't
   * export a standalone type for the auth config object.
   */
  private async authorize(
    request: Request,
    path: string,
    method: string,
    user: unknown,
    authConfig: any,
  ): Promise<void> {
    // Client-provided authorizeUser function
    if ('authorizeUser' in authConfig && typeof authConfig.authorizeUser === 'function') {
      const isAuthorized = await authConfig.authorizeUser(user, request as any);
      if (!isAuthorized) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }

    // Client-provided authorize function
    if ('authorize' in authConfig && typeof authConfig.authorize === 'function') {
      // Build a context object similar to Express adapter
      const context = {
        get: (key: string) => {
          if (key === 'mastra') return this.mastra;
          if (key === 'customRouteAuthConfig') return this.options.customRouteAuthConfig;
          return undefined;
        },
        req: request as any,
      } as any;

      const isAuthorized = await authConfig.authorize(path, method, user, context);
      if (!isAuthorized) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }

    // Custom rule-based authorization
    if ('rules' in authConfig && authConfig.rules && authConfig.rules.length > 0) {
      const isAuthorized = await checkRules(authConfig.rules, path, method, user);
      if (!isAuthorized) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }

    // Default rule-based authorization
    if (defaultAuthConfig.rules && defaultAuthConfig.rules.length > 0) {
      const isAuthorized = await checkRules(defaultAuthConfig.rules, path, method, user);
      if (!isAuthorized) {
        throw new ForbiddenException('Access denied');
      }
    }
  }

  /**
   * Extract authentication token from request.
   * Supports Authorization header (Bearer token) and API key query param.
   */
  private extractToken(request: Request): string | undefined {
    // Check Authorization header first
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Fall back to API key in query params
    if (request.query.apiKey) {
      return request.query.apiKey as string;
    }

    return undefined;
  }
}
