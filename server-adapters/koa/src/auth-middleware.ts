import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { coreAuthMiddleware } from '@mastra/server/auth';
import type { Context, Middleware, Next } from 'koa';

export interface KoaAuthMiddlewareOptions {
  mastra: Mastra;
  requiresAuth?: boolean;
}

function toWebRequest(ctx: Context): globalThis.Request {
  const protocol = ctx.protocol || 'http';
  const host = ctx.host || 'localhost';
  const url = `${protocol}://${host}${ctx.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(ctx.headers)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      value.forEach(v => headers.append(key, v));
    } else {
      headers.set(key, value);
    }
  }

  return new globalThis.Request(url, {
    method: ctx.method,
    headers,
  });
}

export function createAuthMiddleware({ mastra, requiresAuth = true }: KoaAuthMiddlewareOptions): Middleware {
  return async (ctx: Context, next: Next) => {
    if (!requiresAuth) {
      await next();
      return;
    }

    const authConfig = mastra.getServer()?.auth;
    if (!authConfig) {
      await next();
      return;
    }

    ctx.state.requestContext ??= new RequestContext();
    ctx.state.mastra ??= mastra;

    const path = String(ctx.path || '/');
    const method = String(ctx.method || 'GET');
    const customRouteAuthConfig = new Map<string, boolean>(ctx.state.customRouteAuthConfig ?? []);
    customRouteAuthConfig.set(`${method}:${path}`, true);

    const authHeader = ctx.headers.authorization;
    let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;
    if (!token) {
      token = (ctx.query.apiKey as string) || null;
    }

    const result = await coreAuthMiddleware({
      path,
      method,
      getHeader: name => ctx.headers[name.toLowerCase()] as string | undefined,
      mastra,
      authConfig,
      customRouteAuthConfig,
      requestContext: ctx.state.requestContext,
      rawRequest: toWebRequest(ctx),
      token,
      buildAuthorizeContext: () => toWebRequest(ctx),
    });

    if (result.action === 'next') {
      await next();
      return;
    }

    ctx.status = result.status;
    ctx.body = result.body;
  };
}
