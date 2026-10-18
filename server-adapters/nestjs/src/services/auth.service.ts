import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { MastraAuthConfig } from '@mastra/core/server';
import { coreAuthMiddleware, MASTRA_USER_KEY } from '@mastra/server/auth';
import { ForbiddenException, HttpException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';

import { MASTRA, MASTRA_OPTIONS } from '../constants';
import type { MastraModuleOptions } from '../mastra.module';
import { toWebRequest } from '../utils/to-web-request';
import { CustomRouteService } from './custom-route.service';

export interface AuthenticateOptions {
  /** Request context that receives the user, auth token, and mapped resource ID. */
  requestContext?: RequestContext;
  /** Response used to forward session refresh headers (e.g. Set-Cookie). */
  response?: Response;
  /** Force authentication even for publicly accessible paths. */
  requiresAuth?: boolean;
  /** Set when `requiresAuth` comes from a matched `server.apiRoutes` entry. */
  customRoute?: boolean;
}

/**
 * Service that handles authentication for Mastra routes.
 * Delegates to the shared `coreAuthMiddleware` so NestJS behaves like the
 * other server adapters (cookie sessions, session refresh, RBAC,
 * `mapUserToResourceId`).
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(MASTRA) private readonly mastra: Mastra,
    @Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions,
    @Inject(CustomRouteService) private readonly customRoutes: CustomRouteService,
  ) {}

  /**
   * Whether Mastra auth should run: module options enable it, or the Mastra
   * server has auth configured (unless module options explicitly disable it).
   */
  isEnabled(): boolean {
    if (this.options.auth?.enabled === false) return false;
    return Boolean(this.options.auth?.enabled || this.mastra.getServer()?.auth);
  }

  /**
   * Check authentication for a request.
   * Returns the authenticated user if auth succeeds, undefined if no auth required.
   * Throws UnauthorizedException or ForbiddenException if auth fails.
   */
  async authenticate(request: Request, options: AuthenticateOptions = {}): Promise<unknown> {
    const authConfig = this.mastra.getServer()?.auth as MastraAuthConfig | undefined;
    if (!authConfig) {
      return undefined;
    }

    const requestContext = options.requestContext ?? new RequestContext();
    const path = request.path;
    const method = request.method;
    let customRouteAuthConfig = this.customRoutes.customRouteAuthConfig;
    if (options.customRoute && options.requiresAuth !== undefined) {
      // The custom route was matched by Hono's router, which supports patterns the
      // shared path matcher does not. Pin its auth requirement to the concrete path.
      customRouteAuthConfig = new Map(customRouteAuthConfig);
      customRouteAuthConfig.set(`${method.toUpperCase()}:${path}`, options.requiresAuth);
    }
    const webRequest = toWebRequest(request);

    const result = await coreAuthMiddleware({
      path,
      method,
      getHeader: name => {
        const value = request.headers[name.toLowerCase()];
        return Array.isArray(value) ? value[0] : value;
      },
      mastra: this.mastra,
      authConfig,
      customRouteAuthConfig,
      requestContext,
      rawRequest: webRequest,
      token: this.extractToken(request) ?? null,
      buildAuthorizeContext: () => ({
        get: (key: string) => {
          if (key === 'mastra') return this.mastra;
          if (key === 'customRouteAuthConfig') return customRouteAuthConfig;
          return undefined;
        },
        req: webRequest,
      }),
      requiresAuth: options.requiresAuth,
    });

    if (result.headers && options.response) {
      for (const [key, value] of Object.entries(result.headers)) {
        if (key.toLowerCase() === 'set-cookie') {
          options.response.append(key, value);
        } else {
          options.response.setHeader(key, value);
        }
      }
    }

    if (result.action === 'error') {
      const message = typeof result.body.error === 'string' ? result.body.error : 'Access denied';
      if (result.status === 401) throw new UnauthorizedException(message);
      if (result.status === 403) throw new ForbiddenException(message);
      throw new HttpException(result.body, result.status);
    }

    const user = requestContext.get(MASTRA_USER_KEY);
    if (user !== undefined) {
      // Express Request doesn't have a `user` property natively
      (request as any).user = user;
    }
    return user;
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

    // Optional backward-compatibility path for legacy integrations.
    if (this.options.auth?.allowQueryApiKey) {
      const apiKey = request.query.apiKey;
      if (typeof apiKey === 'string') {
        return apiKey;
      }
      if (Array.isArray(apiKey)) {
        const firstApiKey = apiKey.find((value): value is string => typeof value === 'string');
        if (firstApiKey) {
          return firstApiKey;
        }
      }
    }

    return undefined;
  }
}
