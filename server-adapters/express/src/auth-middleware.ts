import {
  canAccessPublicly,
  checkRules,
  defaultAuthConfig,
  isDevPlaygroundRequest,
  isProtectedPath,
} from '@mastra/server/auth';
import type { NextFunction, Request, Response } from 'express';

export const authenticationMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const mastra = res.locals.mastra;
  const authConfig = mastra.getServer()?.auth;
  const customRouteAuthConfig = res.locals.customRouteAuthConfig;

  if (!authConfig) {
    // No auth config, skip authentication
    return next();
  }

  const path = req.path;
  const method = req.method;
  const getHeader = (name: string) => req.headers[name.toLowerCase()] as string | undefined;

  if (isDevPlaygroundRequest(path, method, getHeader, authConfig)) {
    // Skip authentication for dev playground requests
    return next();
  }

  if (!isProtectedPath(req.path, req.method, authConfig, customRouteAuthConfig)) {
    return next();
  }

  // Skip authentication for public routes
  if (canAccessPublicly(req.path, req.method, authConfig)) {
    return next();
  }

  // Get token from header or query
  const authHeader = req.headers.authorization;
  let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;

  if (!token && req.query.apiKey) {
    token = (req.query.apiKey as string) || null;
  }

  // Handle missing token
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Verify token and get user data
    let user: unknown;

    // Client provided verify function
    if (typeof authConfig.authenticateToken === 'function') {
      // Note: Express doesn't have HonoRequest, so we pass the Express Request
      // The auth config function signature accepts HonoRequest, but in practice
      // it should work with any request object that has the necessary properties
      user = await authConfig.authenticateToken(token, req as any);
    } else {
      throw new Error('No token verification method configured');
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Store user in context
    res.locals.requestContext.set('user', user);

    return next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authorizationMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const mastra = res.locals.mastra;
  const authConfig = mastra.getServer()?.auth;
  const customRouteAuthConfig = res.locals.customRouteAuthConfig;

  if (!authConfig) {
    // No auth config, skip authorization
    return next();
  }

  const path = req.path;
  const method = req.method;
  const getHeader = (name: string) => req.headers[name.toLowerCase()] as string | undefined;

  if (isDevPlaygroundRequest(path, method, getHeader, authConfig)) {
    // Skip authorization for dev playground requests
    return next();
  }

  if (!isProtectedPath(req.path, req.method, authConfig, customRouteAuthConfig)) {
    return next();
  }

  // Skip for public routes
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

  // Client-provided authorization function
  if ('authorize' in authConfig && typeof authConfig.authorize === 'function') {
    try {
      // Note: The authorize function signature expects ContextWithMastra as 4th param
      // For Express, we pass a compatible object with similar structure
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

  // Custom rule-based authorization
  if ('rules' in authConfig && authConfig.rules && authConfig.rules.length > 0) {
    const isAuthorized = await checkRules(authConfig.rules, path, method, user);

    if (isAuthorized) {
      return next();
    }

    return res.status(403).json({ error: 'Access denied' });
  }

  // Default rule-based authorization
  if (defaultAuthConfig.rules && defaultAuthConfig.rules.length > 0) {
    const isAuthorized = await checkRules(defaultAuthConfig.rules, path, method, user);

    if (isAuthorized) {
      return next();
    }
  }

  return res.status(403).json({ error: 'Access denied' });
};
