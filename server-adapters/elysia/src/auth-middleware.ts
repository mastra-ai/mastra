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
        headers: { ...result.headers, 'Content-Type': 'application/json' },
      });
    }

    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        if (key.toLowerCase() === 'set-cookie') {
          // Elysia assigns set.headers['set-cookie'] when it serializes ctx.cookie (after hooks run),
          // which would drop a plain write. An accessor keeps the refreshed cookie appended to
          // whatever gets assigned, leaving earlier and later cookies untouched.
          // A lone cookie stays a string: Elysia turns an array into Headers, whose cookies it
          // drops when the handler returns a Response that sets its own cookies.
          let assigned: unknown = ctx.set.headers['set-cookie'];
          Object.defineProperty(ctx.set.headers, 'set-cookie', {
            configurable: true,
            enumerable: true,
            get: () => {
              const cookies = [assigned ?? []].flat() as string[];
              const merged = cookies.includes(value) ? cookies : [...cookies, value];
              return merged.length === 1 ? merged[0] : merged;
            },
            set: next => {
              assigned = next;
            },
          });
        } else {
          ctx.set.headers[key] = value;
        }
      }
    }
  };
}
