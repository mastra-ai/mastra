import type { ContextWithMastra } from '@mastra/core/server';
import { coreAuthMiddleware } from '@mastra/server/auth';
import type { AuthMiddlewareContext } from '@mastra/server/auth';
import type { Next } from 'hono';

const buildCtx = (c: ContextWithMastra): AuthMiddlewareContext => {
  const mastra = c.get('mastra');
  const authConfig = mastra.getServer()?.auth!;
  const authHeader = c.req.header('Authorization');
  let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;
  if (!token && c.req.query('apiKey')) {
    token = c.req.query('apiKey') || null;
  }

  return {
    path: c.req.path,
    method: c.req.method,
    getHeader: (name: string) => c.req.header(name),
    mastra,
    authConfig,
    customRouteAuthConfig: c.get('customRouteAuthConfig'),
    requestContext: c.get('requestContext'),
    rawRequest: c.req,
    token,
    buildAuthorizeContext: () => c,
  };
};

export const authMiddleware = async (c: ContextWithMastra, next: Next) => {
  const authConfig = c.get('mastra').getServer()?.auth;
  if (!authConfig) return next();

  const result = await coreAuthMiddleware(buildCtx(c));
  if (result.action === 'next') return next();
  return c.json(result.body!, result.status as any);
};
