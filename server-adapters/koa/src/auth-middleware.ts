import type { IRBACProvider, EEUser } from '@mastra/core/ee';
import {
  canAccessPublicly,
  checkRules,
  defaultAuthConfig,
  isDevPlaygroundRequest,
  isProtectedPath,
} from '@mastra/server/auth';
import type { Context, Middleware, Next } from 'koa';

export const authenticationMiddleware: Middleware = async (ctx: Context, next: Next) => {
  const mastra = ctx.state.mastra;
  const authConfig = mastra.getServer()?.auth;
  const customRouteAuthConfig = ctx.state.customRouteAuthConfig;

  if (!authConfig) {
    // No auth config, skip authentication
    return next();
  }

  const path = String(ctx.path || '/');
  const method = String(ctx.method || 'GET');
  const getHeader = (name: string) => ctx.headers[name.toLowerCase()] as string | undefined;

  if (isDevPlaygroundRequest(path, method, getHeader, authConfig)) {
    // Skip authentication for dev playground requests
    return next();
  }

  if (!isProtectedPath(path, method, authConfig, customRouteAuthConfig)) {
    return next();
  }

  // Skip authentication for public routes
  if (canAccessPublicly(path, method, authConfig)) {
    return next();
  }

  // Get token from header or query
  const authHeader = ctx.headers.authorization;
  let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;

  const query = ctx.query as Record<string, string>;
  if (!token && query.apiKey) {
    token = query.apiKey || null;
  }

  // Handle missing token
  if (!token) {
    ctx.status = 401;
    ctx.body = { error: 'Authentication required' };
    return;
  }

  try {
    // Verify token and get user data
    let user: unknown;

    // Client provided verify function
    if (typeof authConfig.authenticateToken === 'function') {
      // Note: The auth config function signature accepts HonoRequest, but in practice
      // it should work with any request object that has the necessary properties
      user = await authConfig.authenticateToken(token, ctx.request as any);
    } else {
      throw new Error('No token verification method configured');
    }

    if (!user) {
      ctx.status = 401;
      ctx.body = { error: 'Invalid or expired token' };
      return;
    }

    // Store user in context
    ctx.state.requestContext.set('user', user);

    // Resolve and store user permissions using RBAC provider (EE feature)
    try {
      const serverConfig = mastra.getServer();
      const rbacProvider = serverConfig?.rbac as IRBACProvider<EEUser> | undefined;

      if (rbacProvider) {
        // Use the RBAC provider to resolve permissions
        const permissions = await rbacProvider.getPermissions(user as EEUser);
        ctx.state.requestContext.set('userPermissions', permissions);

        // Also store roles for UI display
        const roles = await rbacProvider.getRoles(user as EEUser);
        ctx.state.requestContext.set('userRoles', roles);
      }
    } catch {
      // RBAC not available or failed, continue without permissions
    }

    return next();
  } catch (err) {
    console.error(err);
    ctx.status = 401;
    ctx.body = { error: 'Invalid or expired token' };
    return;
  }
};

export const authorizationMiddleware: Middleware = async (ctx: Context, next: Next) => {
  const mastra = ctx.state.mastra;
  const authConfig = mastra.getServer()?.auth;
  const customRouteAuthConfig = ctx.state.customRouteAuthConfig;

  if (!authConfig) {
    // No auth config, skip authorization
    return next();
  }

  const path = String(ctx.path || '/');
  const method = String(ctx.method || 'GET');
  const getHeader = (name: string) => ctx.headers[name.toLowerCase()] as string | undefined;

  if (isDevPlaygroundRequest(path, method, getHeader, authConfig)) {
    // Skip authorization for dev playground requests
    return next();
  }

  if (!isProtectedPath(path, method, authConfig, customRouteAuthConfig)) {
    return next();
  }

  // Skip for public routes
  if (canAccessPublicly(path, method, authConfig)) {
    return next();
  }

  const user = ctx.state.requestContext.get('user');

  if ('authorizeUser' in authConfig && typeof authConfig.authorizeUser === 'function') {
    try {
      const isAuthorized = await authConfig.authorizeUser(user, ctx.request as any);

      if (isAuthorized) {
        return next();
      }

      ctx.status = 403;
      ctx.body = { error: 'Access denied' };
      return;
    } catch (err) {
      console.error(err);
      ctx.status = 500;
      ctx.body = { error: 'Authorization error' };
      return;
    }
  }

  // Client-provided authorization function
  if ('authorize' in authConfig && typeof authConfig.authorize === 'function') {
    try {
      // Note: The authorize function signature expects ContextWithMastra as 4th param
      // For Koa, we pass a compatible object with similar structure
      const context = {
        get: (key: string) => {
          if (key === 'mastra') return ctx.state.mastra;
          if (key === 'requestContext') return ctx.state.requestContext;
          if (key === 'tools') return ctx.state.tools;
          if (key === 'taskStore') return ctx.state.taskStore;
          if (key === 'customRouteAuthConfig') return ctx.state.customRouteAuthConfig;
          return undefined;
        },
        req: ctx.request as any,
      } as any;

      const isAuthorized = await authConfig.authorize(path, method, user, context);

      if (isAuthorized) {
        return next();
      }

      ctx.status = 403;
      ctx.body = { error: 'Access denied' };
      return;
    } catch (err) {
      console.error(err);
      ctx.status = 500;
      ctx.body = { error: 'Authorization error' };
      return;
    }
  }

  // Custom rule-based authorization
  if ('rules' in authConfig && authConfig.rules && authConfig.rules.length > 0) {
    const isAuthorized = await checkRules(authConfig.rules, path, method, user);

    if (isAuthorized) {
      return next();
    }

    ctx.status = 403;
    ctx.body = { error: 'Access denied' };
    return;
  }

  // Default rule-based authorization
  if (defaultAuthConfig.rules && defaultAuthConfig.rules.length > 0) {
    const isAuthorized = await checkRules(defaultAuthConfig.rules, path, method, user);

    if (isAuthorized) {
      return next();
    }
  }

  ctx.status = 403;
  ctx.body = { error: 'Access denied' };
};
