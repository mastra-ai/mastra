import {
  canAccessPublicly,
  checkRules,
  defaultAuthConfig,
  isDevPlaygroundRequest,
  isProtectedPath,
} from '@mastra/server/auth';
import Elysia from 'elysia';

/**
 * Elysia plugin for Mastra authentication and authorization.
 * This plugin adds authentication and authorization checks to all routes.
 *
 * Important: This plugin expects the context middleware to have already run,
 * so that mastra, requestContext, and other properties are available in the context.
 */
export const authPlugin = new Elysia({ name: 'mastra-auth' }).derive(async (ctx: any) => {
  const mastra = ctx.mastra;
  const authConfig = mastra.getServer()?.auth;
  const customRouteAuthConfig = ctx.customRouteAuthConfig;

  if (!authConfig) {
    // No auth config, skip authentication
    return {};
  }

  const url = new URL(ctx.request.url);
  const path = ctx.path || url.pathname;
  const method = ctx.request.method;
  const getHeader = (name: string) => ctx.request.headers.get(name) || undefined;

  // Check if should skip auth (dev playground, public routes)
  if (isDevPlaygroundRequest(path, method, getHeader, authConfig, customRouteAuthConfig)) {
    return {};
  }

  if (!isProtectedPath(path, method, authConfig, customRouteAuthConfig)) {
    return {};
  }

  if (canAccessPublicly(path, method, authConfig)) {
    return {};
  }

  // --- Authentication ---
  const authHeader = ctx.request.headers.get('authorization');
  let token: string | null = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null;

  // Try to get token from query params
  if (!token && ctx.query?.apiKey) {
    token = ctx.query.apiKey;
  }

  if (!token) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let user: unknown;
  try {
    if (typeof authConfig.authenticateToken === 'function') {
      // Pass Elysia request object (Fetch API Request compatible)
      user = await authConfig.authenticateToken(token, ctx.request as any);
    } else {
      return new Response(JSON.stringify({ error: 'No token verification method configured' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Store user in requestContext
    ctx.requestContext.set('user', user);
  } catch (err) {
    mastra.getLogger()?.error('Authentication error', {
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Authorization ---

  // Check authorizeUser (simplified authorization)
  if ('authorizeUser' in authConfig && typeof authConfig.authorizeUser === 'function') {
    try {
      const isAuthorized = await authConfig.authorizeUser(user, ctx.request as any);

      if (!isAuthorized) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return {}; // Authorization passed
    } catch (err) {
      mastra.getLogger()?.error('Authorization error in authorizeUser', {
        error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      });
      return new Response(JSON.stringify({ error: 'Authorization error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Check authorize (path/method-based authorization)
  if ('authorize' in authConfig && typeof authConfig.authorize === 'function') {
    try {
      const isAuthorized = await authConfig.authorize(path, method, user, ctx as any);

      if (!isAuthorized) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return {}; // Authorization passed
    } catch (err) {
      mastra.getLogger()?.error('Authorization error in authorize', {
        error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
        path,
        method,
      });
      return new Response(JSON.stringify({ error: 'Authorization error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Check custom rules
  if ('rules' in authConfig && authConfig.rules && authConfig.rules.length > 0) {
    const isAuthorized = await checkRules(authConfig.rules, path, method, user);

    if (isAuthorized) {
      return {}; // Authorization passed
    }
    return new Response(JSON.stringify({ error: 'Access denied' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check default rules
  if (defaultAuthConfig.rules && defaultAuthConfig.rules.length > 0) {
    const isAuthorized = await checkRules(defaultAuthConfig.rules, path, method, user);

    if (isAuthorized) {
      return {}; // Authorization passed
    }
  }

  return new Response(JSON.stringify({ error: 'Access denied' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
});
