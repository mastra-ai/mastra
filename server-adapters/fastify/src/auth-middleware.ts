import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { coreAuthMiddleware } from '@mastra/server/auth';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

export interface FastifyAuthMiddlewareOptions {
  mastra: Mastra;
  requiresAuth?: boolean;
}

function toWebRequest(request: FastifyRequest): globalThis.Request {
  const protocol = request.protocol || 'http';
  const host = request.headers.host || 'localhost';
  const url = `${protocol}://${host}${request.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      value.forEach(v => headers.append(key, v));
    } else {
      headers.set(key, value);
    }
  }

  return new globalThis.Request(url, {
    method: request.method,
    headers,
  });
}

export function createAuthMiddleware({
  mastra,
  requiresAuth = true,
}: FastifyAuthMiddlewareOptions): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requiresAuth) {
      return;
    }

    const authConfig = mastra.getServer()?.auth;
    if (!authConfig) {
      return;
    }

    request.requestContext ??= new RequestContext();
    request.mastra ??= mastra;

    const path = String(request.url.split('?')[0] || '/');
    const method = String(request.method || 'GET');
    const customRouteAuthConfig = new Map<string, boolean>(request.customRouteAuthConfig ?? []);
    customRouteAuthConfig.set(`${method}:${path}`, true);

    const authHeader = request.headers.authorization;
    let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;
    const query = request.query as Record<string, string>;
    if (!token && query.apiKey) {
      token = query.apiKey || null;
    }

    const result = await coreAuthMiddleware({
      path,
      method,
      getHeader: name => request.headers[name.toLowerCase()] as string | undefined,
      mastra,
      authConfig,
      customRouteAuthConfig,
      requestContext: request.requestContext,
      rawRequest: toWebRequest(request),
      token,
      buildAuthorizeContext: () => toWebRequest(request),
    });

    if (result.action === 'error') {
      return reply.status(result.status).send(result.body);
    }
  };
}
