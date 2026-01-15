import type { ContextWithMastra } from '@mastra/core/server';
import {
  canAccessPublicly,
  checkRules,
  defaultAuthConfig,
  isDevPlaygroundRequest,
  isProtectedPath,
} from '@mastra/server/auth';
import type { Next } from 'hono';

export const authenticationMiddleware = async (c: ContextWithMastra, next: Next) => {
  const mastra = c.get('mastra');
  const authConfig = mastra.getServer()?.auth;
  const customRouteAuthConfig = c.get('customRouteAuthConfig');

  if (!authConfig) {
    // No auth config, skip authentication
    return next();
  }

  const path = c.req.path;
  const method = c.req.method;
  const getHeader = (name: string) => c.req.header(name);

  if (isDevPlaygroundRequest(path, method, getHeader, authConfig)) {
    // Skip authentication for dev playground requests
    return next();
  }

  if (!isProtectedPath(c.req.path, c.req.method, authConfig, customRouteAuthConfig)) {
    return next();
  }

  // Skip authentication for public routes
  if (canAccessPublicly(c.req.path, c.req.method, authConfig)) {
    return next();
  }

  // Get token from header or query
  const authHeader = c.req.header('Authorization');
  let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;

  if (!token && c.req.query('apiKey')) {
    token = c.req.query('apiKey') || null;
  }

  // Check if there are cookies that might contain session tokens
  const hasCookies = !!c.req.header('Cookie');

  // Handle missing token - but allow through if cookies are present
  // (auth provider may use cookie-based sessions like Better Auth)
  if (!token && !hasCookies) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    // Verify token and get user data
    let user: unknown;

    // Client provided verify function
    if (typeof authConfig.authenticateToken === 'function') {
      // Pass empty string if no token but cookies present - provider will check cookies
      user = await authConfig.authenticateToken(token || '', c.req);
    } else {
      throw new Error('No token verification method configured');
    }

    if (!user) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Store user in context
    c.get('requestContext').set('user', user);

    return next();
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
};

export const authorizationMiddleware = async (c: ContextWithMastra, next: Next) => {
  const mastra = c.get('mastra');
  const authConfig = mastra.getServer()?.auth;
  const customRouteAuthConfig = c.get('customRouteAuthConfig');

  if (!authConfig) {
    // No auth config, skip authorization
    return next();
  }

  const path = c.req.path;
  const method = c.req.method;
  const getHeader = (name: string) => c.req.header(name);

  if (isDevPlaygroundRequest(path, method, getHeader, authConfig)) {
    // Skip authorization for dev playground requests
    return next();
  }

  if (!isProtectedPath(c.req.path, c.req.method, authConfig, customRouteAuthConfig)) {
    return next();
  }

  // Skip for public routes
  if (canAccessPublicly(path, method, authConfig)) {
    return next();
  }

  const user = c.get('requestContext').get('user');

  if ('authorizeUser' in authConfig && typeof authConfig.authorizeUser === 'function') {
    try {
      const isAuthorized = await authConfig.authorizeUser(user, c.req);

      if (isAuthorized) {
        return next();
      }

      return c.json({ error: 'Access denied' }, 403);
    } catch (err) {
      console.error(err);
      return c.json({ error: 'Authorization error' }, 500);
    }
  }

  // Client-provided authorization function
  if ('authorize' in authConfig && typeof authConfig.authorize === 'function') {
    try {
      const isAuthorized = await authConfig.authorize(path, method, user, c);

      if (isAuthorized) {
        return next();
      }

      return c.json({ error: 'Access denied' }, 403);
    } catch (err) {
      console.error(err);
      return c.json({ error: 'Authorization error' }, 500);
    }
  }

  // Custom rule-based authorization
  if ('rules' in authConfig && authConfig.rules && authConfig.rules.length > 0) {
    const isAuthorized = await checkRules(authConfig.rules, path, method, user);

    if (isAuthorized) {
      return next();
    }

    return c.json({ error: 'Access denied' }, 403);
  }

  // Default rule-based authorization
  if (defaultAuthConfig.rules && defaultAuthConfig.rules.length > 0) {
    const isAuthorized = await checkRules(defaultAuthConfig.rules, path, method, user);

    if (isAuthorized) {
      return next();
    }
  }

  return c.json({ error: 'Access denied' }, 403);
};
