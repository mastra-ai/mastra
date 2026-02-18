import { coreAuthMiddleware } from '@mastra/server/auth';
import type { AuthMiddlewareContext } from '@mastra/server/auth';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

const buildCtx = (request: FastifyRequest): AuthMiddlewareContext => {
  const mastra = request.mastra;
  const authConfig = mastra.getServer()?.auth!;
  const authHeader = request.headers.authorization;
  let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;
  const query = request.query as Record<string, string>;
  if (!token && query.apiKey) {
    token = query.apiKey || null;
  }

  return {
    path: String(request.url.split('?')[0] || '/'),
    method: String(request.method || 'GET'),
    getHeader: (name: string) => request.headers[name.toLowerCase()] as string | undefined,
    mastra,
    authConfig,
    customRouteAuthConfig: request.customRouteAuthConfig,
    requestContext: request.requestContext,
    rawRequest: request,
    token,
    buildAuthorizeContext: () => ({
      get: (key: string) => {
        if (key === 'mastra') return request.mastra;
        if (key === 'requestContext') return request.requestContext;
        if (key === 'tools') return request.tools;
        if (key === 'taskStore') return request.taskStore;
        if (key === 'customRouteAuthConfig') return request.customRouteAuthConfig;
        return undefined;
      },
      req: request as any,
    }),
  };
};

export const authMiddleware: preHandlerHookHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  const authConfig = request.mastra.getServer()?.auth;
  if (!authConfig) return;

  const result = await coreAuthMiddleware(buildCtx(request));
  if (result.action === 'next') return;
  return reply.status(result.status!).send(result.body);
};
