import { coreAuthMiddleware } from '@mastra/server/auth';
import type { AuthMiddlewareContext } from '@mastra/server/auth';
import type { Context, Middleware, Next } from 'koa';

const buildCtx = (ctx: Context): AuthMiddlewareContext => {
  const mastra = ctx.state.mastra;
  const authConfig = mastra.getServer()?.auth!;
  const authHeader = ctx.headers.authorization;
  let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;
  const query = ctx.query as Record<string, string>;
  if (!token && query.apiKey) {
    token = query.apiKey || null;
  }

  return {
    path: String(ctx.path || '/'),
    method: String(ctx.method || 'GET'),
    getHeader: (name: string) => ctx.headers[name.toLowerCase()] as string | undefined,
    mastra,
    authConfig,
    customRouteAuthConfig: ctx.state.customRouteAuthConfig,
    requestContext: ctx.state.requestContext,
    rawRequest: ctx.request,
    token,
    buildAuthorizeContext: () => ({
      get: (key: string) => {
        if (key === 'mastra') return ctx.state.mastra;
        if (key === 'requestContext') return ctx.state.requestContext;
        if (key === 'tools') return ctx.state.tools;
        if (key === 'taskStore') return ctx.state.taskStore;
        if (key === 'customRouteAuthConfig') return ctx.state.customRouteAuthConfig;
        return undefined;
      },
      req: ctx.request as any,
    }),
  };
};

export const authMiddleware: Middleware = async (ctx: Context, next: Next) => {
  const authConfig = ctx.state.mastra.getServer()?.auth;
  if (!authConfig) return next();

  const result = await coreAuthMiddleware(buildCtx(ctx));
  if (result.action === 'next') return next();
  ctx.status = result.status!;
  ctx.body = result.body;
};
