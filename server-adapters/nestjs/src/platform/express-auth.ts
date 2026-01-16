import {
  canAccessPublicly,
  checkRules,
  defaultAuthConfig,
  isDevPlaygroundRequest,
  isProtectedPath,
} from '@mastra/server/auth';
import type { NextFunction, Request, Response } from 'express';

/**
 * Express authentication middleware for Mastra.
 * Verifies tokens and stores user in request context.
 */
export const expressAuthenticationMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const mastra = res.locals.mastra;
  const authConfig = mastra?.getServer()?.auth;
  const customRouteAuthConfig = res.locals.customRouteAuthConfig;

  if (!authConfig) {
    return next();
  }

  const path = req.path;
  const method = req.method;
  const getHeader = (name: string) => req.headers[name.toLowerCase()] as string | undefined;

  if (isDevPlaygroundRequest(path, method, getHeader, authConfig)) {
    return next();
  }

  if (!isProtectedPath(req.path, req.method, authConfig, customRouteAuthConfig)) {
    return next();
  }

  if (canAccessPublicly(req.path, req.method, authConfig)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;

  if (!token && req.query.apiKey) {
    token = (req.query.apiKey as string) || null;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    let user: unknown;

    if (typeof authConfig.authenticateToken === 'function') {
      user = await authConfig.authenticateToken(token, req as any);
    } else {
      throw new Error('No token verification method configured');
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    res.locals.requestContext.set('user', user);

    return next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Express authorization middleware for Mastra.
 * Checks if authenticated user has permission to access the resource.
 */
export const expressAuthorizationMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const mastra = res.locals.mastra;
  const authConfig = mastra?.getServer()?.auth;
  const customRouteAuthConfig = res.locals.customRouteAuthConfig;

  if (!authConfig) {
    return next();
  }

  const path = req.path;
  const method = req.method;
  const getHeader = (name: string) => req.headers[name.toLowerCase()] as string | undefined;

  if (isDevPlaygroundRequest(path, method, getHeader, authConfig)) {
    return next();
  }

  if (!isProtectedPath(req.path, req.method, authConfig, customRouteAuthConfig)) {
    return next();
  }

  if (canAccessPublicly(path, method, authConfig)) {
    return next();
  }

  const user = res.locals.requestContext.get('user');

  if ('authorizeUser' in authConfig && typeof authConfig.authorizeUser === 'function') {
    try {
      const isAuthorized = await authConfig.authorizeUser(user, req as any);
      if (isAuthorized) {
        return next();
      }
      return res.status(403).json({ error: 'Access denied' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Authorization error' });
    }
  }

  if ('authorize' in authConfig && typeof authConfig.authorize === 'function') {
    try {
      const context = {
        get: (key: string) => {
          if (key === 'mastra') return res.locals.mastra;
          if (key === 'requestContext') return res.locals.requestContext;
          if (key === 'tools') return res.locals.tools;
          if (key === 'taskStore') return res.locals.taskStore;
          if (key === 'customRouteAuthConfig') return res.locals.customRouteAuthConfig;
          return undefined;
        },
        req: req as any,
      } as any;

      const isAuthorized = await authConfig.authorize(path, method, user, context);
      if (isAuthorized) {
        return next();
      }
      return res.status(403).json({ error: 'Access denied' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Authorization error' });
    }
  }

  if ('rules' in authConfig && authConfig.rules && authConfig.rules.length > 0) {
    const isAuthorized = await checkRules(authConfig.rules, path, method, user);
    if (isAuthorized) {
      return next();
    }
    return res.status(403).json({ error: 'Access denied' });
  }

  if (defaultAuthConfig.rules && defaultAuthConfig.rules.length > 0) {
    const isAuthorized = await checkRules(defaultAuthConfig.rules, path, method, user);
    if (isAuthorized) {
      return next();
    }
  }

  return res.status(403).json({ error: 'Access denied' });
};
