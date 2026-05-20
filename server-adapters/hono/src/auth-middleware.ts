import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { coreAuthMiddleware } from '@mastra/server/auth';
import type { Context, MiddlewareHandler } from 'hono';

export interface HonoAuthMiddlewareOptions {
  mastra: Mastra;
  requiresAuth?: boolean;
}

export function createAuthMiddleware({ mastra, requiresAuth = true }: HonoAuthMiddlewareOptions): MiddlewareHandler {
  return async (c: Context, next) => {
    if (!requiresAuth) {
      return next();
    }

    const authConfig = mastra.getServer()?.auth;
    if (!authConfig) {
      return next();
    }

    const requestContext = c.get('requestContext') ?? new RequestContext();
    c.set('requestContext', requestContext);
    c.set('mastra', c.get('mastra') ?? mastra);

    const path = c.req.path;
    const method = c.req.method;
    const customRouteAuthConfig = new Map<string, boolean>(c.get('customRouteAuthConfig') ?? []);
    customRouteAuthConfig.set(`${method}:${path}`, true);

    const authHeader = c.req.header('Authorization');
    let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;
    if (!token) {
      token = c.req.query('apiKey') || null;
    }

    const result = await coreAuthMiddleware({
      path,
      method,
      getHeader: name => c.req.header(name),
      mastra,
      authConfig,
      customRouteAuthConfig,
      requestContext,
      rawRequest: c.req.raw,
      token,
      buildAuthorizeContext: () => c,
    });

    if (result.action === 'next') {
      return next();
    }

    return c.json(result.body as any, result.status as any);
  };
}
