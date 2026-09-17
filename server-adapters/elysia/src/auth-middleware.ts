import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { coreAuthMiddleware } from '@mastra/server/auth';

export interface ElysiaAuthMiddlewareOptions {
  mastra: Mastra;
  requiresAuth?: boolean;
}

export function createAuthMiddleware({
  mastra,
  requiresAuth = true,
}: ElysiaAuthMiddlewareOptions): (ctx: any) => Promise<globalThis.Response | void> {
  return async (ctx: any) => {
    if (!requiresAuth) {
      return;
    }

    const authConfig = mastra.getServer()?.auth;
    if (!authConfig) {
      return;
    }

    ctx.requestContext ??= new RequestContext();
    ctx.mastra ??= mastra;

    const url = new URL(ctx.request.url);
    const path = url.pathname;
    const method = ctx.request.method;
    const customRouteAuthConfig = new Map<string, boolean>(ctx.customRouteAuthConfig ?? []);
    customRouteAuthConfig.set(`${method}:${path}`, true);

    const authHeader = ctx.request.headers.get('authorization');
    let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;
    if (!token && ctx.query?.apiKey) {
      token = ctx.query.apiKey;
    }

    const result = await coreAuthMiddleware({
      path,
      method,
      getHeader: name => ctx.request.headers.get(name) || undefined,
      mastra,
      authConfig,
      customRouteAuthConfig,
      requestContext: ctx.requestContext,
      rawRequest: ctx.request,
      token,
      buildAuthorizeContext: () => ctx,
    });

    if (result.action === 'error') {
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}
