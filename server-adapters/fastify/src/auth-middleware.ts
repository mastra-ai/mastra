import {
  canAccessPublicly,
  checkRules,
  defaultAuthConfig,
  isDevPlaygroundRequest,
  isProtectedPath,
} from '@mastra/server/auth';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

export const authenticationMiddleware: preHandlerHookHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  const mastra = request.mastra;
  const authConfig = mastra.getServer()?.auth;
  const customRouteAuthConfig = request.customRouteAuthConfig;

  if (!authConfig) {
    // No auth config, skip authentication
    return;
  }

  const path = String(request.url.split('?')[0] || '/');
  const method = String(request.method || 'GET');
  const getHeader = (name: string) => request.headers[name.toLowerCase()] as string | undefined;

  if (isDevPlaygroundRequest(path, method, getHeader, authConfig)) {
    // Skip authentication for dev playground requests
    return;
  }

  if (!isProtectedPath(path, method, authConfig, customRouteAuthConfig)) {
    return;
  }

  // Skip authentication for public routes
  if (canAccessPublicly(path, method, authConfig)) {
    return;
  }

  // Get token from header or query
  const authHeader = request.headers.authorization;
  let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;

  const query = request.query as Record<string, string>;
  if (!token && query.apiKey) {
    token = query.apiKey || null;
  }

  // Handle missing token
  if (!token) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  try {
    // Verify token and get user data
    let user: unknown;

    // Client provided verify function
    if (typeof authConfig.authenticateToken === 'function') {
      // Note: The auth config function signature accepts HonoRequest, but in practice
      // it should work with any request object that has the necessary properties
      user = await authConfig.authenticateToken(token, request as any);
    } else {
      throw new Error('No token verification method configured');
    }

    if (!user) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    // Store user in context
    request.requestContext.set('user', user);

    return;
  } catch (err) {
    console.error(err);
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
};

export const authorizationMiddleware: preHandlerHookHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  const mastra = request.mastra;
  const authConfig = mastra.getServer()?.auth;
  const customRouteAuthConfig = request.customRouteAuthConfig;

  if (!authConfig) {
    // No auth config, skip authorization
    return;
  }

  const path = String(request.url.split('?')[0] || '/');
  const method = String(request.method || 'GET');
  const getHeader = (name: string) => request.headers[name.toLowerCase()] as string | undefined;

  if (isDevPlaygroundRequest(path, method, getHeader, authConfig)) {
    // Skip authorization for dev playground requests
    return;
  }

  if (!isProtectedPath(path, method, authConfig, customRouteAuthConfig)) {
    return;
  }

  // Skip for public routes
  if (canAccessPublicly(path, method, authConfig)) {
    return;
  }

  const user = request.requestContext.get('user');

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

  // Client-provided authorization function
  if ('authorize' in authConfig && typeof authConfig.authorize === 'function') {
    try {
      // Note: The authorize function signature expects ContextWithMastra as 4th param
      // For Fastify, we pass a compatible object with similar structure
      const context = {
        get: (key: string) => {
          if (key === 'mastra') return request.mastra;
          if (key === 'requestContext') return request.requestContext;
          if (key === 'tools') return request.tools;
          if (key === 'taskStore') return request.taskStore;
          if (key === 'customRouteAuthConfig') return request.customRouteAuthConfig;
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

  // Custom rule-based authorization
  if ('rules' in authConfig && authConfig.rules && authConfig.rules.length > 0) {
    const isAuthorized = await checkRules(authConfig.rules, path, method, user);

    if (isAuthorized) {
      return;
    }

    return reply.status(403).send({ error: 'Access denied' });
  }

  // Default rule-based authorization
  if (defaultAuthConfig.rules && defaultAuthConfig.rules.length > 0) {
    const isAuthorized = await checkRules(defaultAuthConfig.rules, path, method, user);

    if (isAuthorized) {
      return;
    }
  }

  return reply.status(403).send({ error: 'Access denied' });
};
