import type { HttpContext } from '@adonisjs/core/http';
import type { MiddlewareFn, NextFn } from '@adonisjs/core/types/http';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { coreAuthMiddleware, isCustomRoutePublic } from '@mastra/server/auth';
import { toWebRequest } from './utils';

export interface AdonisAuthMiddlewareOptions {
  mastra: Mastra;
  requiresAuth?: boolean;
}

/**
 * AdonisJS route middleware that applies the Mastra server auth config (`server.auth`)
 * to application routes that are not registered by Mastra.
 *
 * @example
 * ```ts
 * router.get('/reports', handler).use(createAuthMiddleware({ mastra }))
 * ```
 */
export function createAuthMiddleware({ mastra, requiresAuth = true }: AdonisAuthMiddlewareOptions): MiddlewareFn {
  return async (ctx: HttpContext, next: NextFn) => {
    if (!requiresAuth) {
      return next();
    }

    const authConfig = mastra.getServer()?.auth;
    if (!authConfig) {
      return next();
    }

    const path = ctx.request.parsedUrl.pathname || '/';
    const method = ctx.request.method();
    const customRouteAuthConfig = new Map<string, boolean>();
    // Don't reclassify a custom route the app declared public (requiresAuth: false).
    if (!isCustomRoutePublic(path, method, customRouteAuthConfig)) {
      customRouteAuthConfig.set(`${method}:${path}`, true);
    }

    const getHeader = (name: string) => {
      const value = ctx.request.request.headers[name.toLowerCase()];
      return Array.isArray(value) ? value.join(', ') : value;
    };

    const authHeader = getHeader('authorization');
    let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;
    if (!token) {
      token = new URLSearchParams(ctx.request.parsedUrl.query ?? '').get('apiKey');
    }

    const result = await coreAuthMiddleware({
      path,
      method,
      getHeader,
      mastra,
      authConfig,
      customRouteAuthConfig,
      requestContext: new RequestContext(),
      rawRequest: toWebRequest(ctx),
      token,
      buildAuthorizeContext: () => toWebRequest(ctx),
    });

    for (const [key, value] of Object.entries(result.headers ?? {})) {
      if (key.toLowerCase() === 'set-cookie') {
        ctx.response.append(key, value);
      } else {
        ctx.response.header(key, value);
      }
    }

    if (result.action === 'next') {
      return next();
    }

    ctx.response.status(result.status);
    ctx.response.send(result.body);
  };
}
