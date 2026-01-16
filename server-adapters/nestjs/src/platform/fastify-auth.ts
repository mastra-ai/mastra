import {
  canAccessPublicly,
  checkRules,
  defaultAuthConfig,
  isDevPlaygroundRequest,
  isProtectedPath,
} from '@mastra/server/auth';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Fastify authentication middleware for Mastra.
 * Verifies tokens and stores user in request context.
 */
export const fastifyAuthenticationMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  const mastra = (request as any).mastra;
  const authConfig = mastra?.getServer()?.auth;
  const customRouteAuthConfig = (request as any).customRouteAuthConfig;

  if (!authConfig) {
    return;
  }

  const path = request.url.split('?')[0] || request.url;
  const method = request.method;
  const getHeader = (name: string) => request.headers[name.toLowerCase()] as string | undefined;

  if (isDevPlaygroundRequest(path, method, getHeader, authConfig)) {
    return;
  }

  if (!isProtectedPath(path, method, authConfig, customRouteAuthConfig)) {
    return;
  }

  if (canAccessPublicly(path, method, authConfig)) {
    return;
  }

  const authHeader = request.headers.authorization;
  let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;

  if (!token) {
    const query = request.query as Record<string, string>;
    if (query.apiKey) {
      token = query.apiKey || null;
    }
  }

  if (!token) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  try {
    let user: unknown;

    if (typeof authConfig.authenticateToken === 'function') {
      user = await authConfig.authenticateToken(token, request as any);
    } else {
      throw new Error('No token verification method configured');
    }

    if (!user) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    (request as any).requestContext.set('user', user);
  } catch (err) {
    console.error(err);
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
};

/**
 * Fastify authorization middleware for Mastra.
 * Checks if authenticated user has permission to access the resource.
 */
export const fastifyAuthorizationMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  const mastra = (request as any).mastra;
  const authConfig = mastra?.getServer()?.auth;
  const customRouteAuthConfig = (request as any).customRouteAuthConfig;

  if (!authConfig) {
    return;
  }

  const path = request.url.split('?')[0] || request.url;
  const method = request.method;
  const getHeader = (name: string) => request.headers[name.toLowerCase()] as string | undefined;

  if (isDevPlaygroundRequest(path, method, getHeader, authConfig)) {
    return;
  }

  if (!isProtectedPath(path, method, authConfig, customRouteAuthConfig)) {
    return;
  }

  if (canAccessPublicly(path, method, authConfig)) {
    return;
  }

  const user = (request as any).requestContext.get('user');

  if ('authorizeUser' in authConfig && typeof authConfig.authorizeUser === 'function') {
    try {
      const isAuthorized = await authConfig.authorizeUser(user, request as any);
      if (isAuthorized) {
        return;
      }
      return reply.status(403).send({ error: 'Access denied' });
    } catch (err) {
      console.error(err);
      return reply.status(500).send({ error: 'Authorization error' });
    }
  }

  if ('authorize' in authConfig && typeof authConfig.authorize === 'function') {
    try {
      const context = {
        get: (key: string) => {
          if (key === 'mastra') return (request as any).mastra;
          if (key === 'requestContext') return (request as any).requestContext;
          if (key === 'tools') return (request as any).tools;
          if (key === 'taskStore') return (request as any).taskStore;
          if (key === 'customRouteAuthConfig') return (request as any).customRouteAuthConfig;
          return undefined;
        },
        req: request as any,
      } as any;

      const isAuthorized = await authConfig.authorize(path, method, user, context);
      if (isAuthorized) {
        return;
      }
      return reply.status(403).send({ error: 'Access denied' });
    } catch (err) {
      console.error(err);
      return reply.status(500).send({ error: 'Authorization error' });
    }
  }

  if ('rules' in authConfig && authConfig.rules && authConfig.rules.length > 0) {
    const isAuthorized = await checkRules(authConfig.rules, path, method, user);
    if (isAuthorized) {
      return;
    }
    return reply.status(403).send({ error: 'Access denied' });
  }

  if (defaultAuthConfig.rules && defaultAuthConfig.rules.length > 0) {
    const isAuthorized = await checkRules(defaultAuthConfig.rules, path, method, user);
    if (isAuthorized) {
      return;
    }
  }

  return reply.status(403).send({ error: 'Access denied' });
};
