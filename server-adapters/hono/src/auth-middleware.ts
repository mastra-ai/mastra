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
  // Cast to any for EE provider compatibility - runtime checks handle type safety
  const authConfig = mastra.getServer()?.auth as any;
  const customRouteAuthConfig = c.get('customRouteAuthConfig');

  const path = c.req.path;
  const method = c.req.method;

  console.log(`[auth-middleware] ${method} ${path}`);

  if (!authConfig) {
    // No auth config, skip authentication
    console.log('[auth-middleware] No auth config, skipping');
    return next();
  }

  const getHeader = (name: string) => c.req.header(name);

  if (isDevPlaygroundRequest(path, method, getHeader, authConfig)) {
    // Skip authentication for dev playground requests
    console.log('[auth-middleware] Dev playground request, skipping');
    return next();
  }

  const isProtected = isProtectedPath(c.req.path, c.req.method, authConfig, customRouteAuthConfig);
  const isPublic = canAccessPublicly(c.req.path, c.req.method, authConfig);
  console.log(`[auth-middleware] isProtected=${isProtected}, isPublic=${isPublic}`);

  if (!isProtected) {
    console.log('[auth-middleware] Not protected, skipping');
    return next();
  }

  // Skip authentication for public routes
  if (isPublic) {
    console.log('[auth-middleware] Public route, skipping');
    return next();
  }

  // Get token from header or query
  const authHeader = c.req.header('Authorization');
  let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;

  if (!token && c.req.query('apiKey')) {
    token = c.req.query('apiKey') || null;
  }

  // Check if there are cookies (for session-based auth)
  const hasCookies = !!c.req.header('Cookie');

  // Check if this is an EE provider (has getCurrentUser) vs server provider (has authenticateToken)
  const isEEProvider = typeof authConfig.getCurrentUser === 'function';
  const hasTokenAuth = typeof authConfig.authenticateToken === 'function';

  console.log(
    `[auth-middleware] token=${!!token}, hasCookies=${hasCookies}, isEE=${isEEProvider}, hasTokenAuth=${hasTokenAuth}`,
  );

  // Handle missing credentials
  if (!token && !hasCookies) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    let user: unknown;

    // EE provider - use session-based auth via getCurrentUser
    if (isEEProvider && hasCookies) {
      console.log('[auth-middleware] Using EE session auth');
      user = await authConfig.getCurrentUser(c.req.raw);
    }
    // Server provider - use token-based auth
    else if (hasTokenAuth && token) {
      console.log('[auth-middleware] Using token auth');
      user = await authConfig.authenticateToken(token, c.req);
    }
    // Fallback: try token auth with cookies if provider supports it
    else if (hasTokenAuth && hasCookies) {
      console.log('[auth-middleware] Using token auth with cookies');
      user = await authConfig.authenticateToken('', c.req);
    }

    if (!user) {
      console.log('[auth-middleware] No user found');
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    console.log('[auth-middleware] User authenticated');
    // Store user in context
    c.get('requestContext').set('user', user);

    return next();
  } catch (err) {
    console.error('[auth-middleware] Error:', err);
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
};

export const authorizationMiddleware = async (c: ContextWithMastra, next: Next) => {
  const mastra = c.get('mastra');
  // Cast to any for EE provider compatibility - runtime checks handle type safety
  const authConfig = mastra.getServer()?.auth as any;
  const customRouteAuthConfig = c.get('customRouteAuthConfig');

  const path = c.req.path;
  const method = c.req.method;

  console.log(`[authz-middleware] ${method} ${path}`);

  if (!authConfig) {
    // No auth config, skip authorization
    console.log('[authz-middleware] No auth config, skipping');
    return next();
  }

  const getHeader = (name: string) => c.req.header(name);

  if (isDevPlaygroundRequest(path, method, getHeader, authConfig)) {
    // Skip authorization for dev playground requests
    console.log('[authz-middleware] Dev playground request, skipping');
    return next();
  }

  if (!isProtectedPath(c.req.path, c.req.method, authConfig, customRouteAuthConfig)) {
    console.log('[authz-middleware] Not protected, skipping');
    return next();
  }

  // Skip for public routes
  if (canAccessPublicly(path, method, authConfig)) {
    console.log('[authz-middleware] Public route, skipping');
    return next();
  }

  const user = c.get('requestContext').get('user');
  console.log('[authz-middleware] User from context:', user ? JSON.stringify(user, null, 2).slice(0, 200) : 'null');

  const hasAuthorizeUser = 'authorizeUser' in authConfig && typeof authConfig.authorizeUser === 'function';
  const hasAuthorize = 'authorize' in authConfig && typeof authConfig.authorize === 'function';
  const hasCustomRules = 'rules' in authConfig && authConfig.rules && authConfig.rules.length > 0;
  const hasDefaultRules = defaultAuthConfig.rules && defaultAuthConfig.rules.length > 0;

  console.log(
    `[authz-middleware] hasAuthorizeUser=${hasAuthorizeUser}, hasAuthorize=${hasAuthorize}, hasCustomRules=${hasCustomRules}, hasDefaultRules=${hasDefaultRules}`,
  );

  if (hasAuthorizeUser) {
    try {
      const isAuthorized = await authConfig.authorizeUser(user, c.req);
      console.log(`[authz-middleware] authorizeUser result: ${isAuthorized}`);

      if (isAuthorized) {
        return next();
      }

      return c.json({ error: 'Access denied' }, 403);
    } catch (err) {
      console.error('[authz-middleware] authorizeUser error:', err);
      return c.json({ error: 'Authorization error' }, 500);
    }
  }

  // Client-provided authorization function
  if (hasAuthorize) {
    try {
      const isAuthorized = await authConfig.authorize(path, method, user, c);
      console.log(`[authz-middleware] authorize result: ${isAuthorized}`);

      if (isAuthorized) {
        return next();
      }

      return c.json({ error: 'Access denied' }, 403);
    } catch (err) {
      console.error('[authz-middleware] authorize error:', err);
      return c.json({ error: 'Authorization error' }, 500);
    }
  }

  // Custom rule-based authorization
  if (hasCustomRules) {
    const isAuthorized = await checkRules(authConfig.rules, path, method, user);
    console.log(`[authz-middleware] custom rules result: ${isAuthorized}`);

    if (isAuthorized) {
      return next();
    }

    return c.json({ error: 'Access denied' }, 403);
  }

  // Default rule-based authorization
  if (hasDefaultRules) {
    const isAuthorized = await checkRules(defaultAuthConfig.rules, path, method, user);
    console.log(`[authz-middleware] default rules result: ${isAuthorized}`);

    if (isAuthorized) {
      return next();
    }
  }

  console.log('[authz-middleware] No authorization method matched, denying');
  return c.json({ error: 'Access denied' }, 403);
};
