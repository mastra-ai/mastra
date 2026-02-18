import type { IRBACProvider, EEUser } from '@mastra/core/auth';
import type { Mastra } from '@mastra/core/mastra';
import type { MastraAuthConfig } from '@mastra/core/server';

import { defaultAuthConfig } from './defaults';
import { parse } from './path-pattern';

/**
 * Check if a route is a registered custom route that requires authentication.
 * Returns true only if the route is explicitly registered with requiresAuth: true.
 * Returns false if the route is not in the config or has requiresAuth: false.
 */
export const isProtectedCustomRoute = (
  path: string,
  method: string,
  customRouteAuthConfig?: Map<string, boolean>,
): boolean => {
  if (!customRouteAuthConfig) {
    return false;
  }

  // Check exact match first (fast path for static routes)
  const exactRouteKey = `${method}:${path}`;
  if (customRouteAuthConfig.has(exactRouteKey)) {
    return customRouteAuthConfig.get(exactRouteKey) === true;
  }

  // Check exact match for ALL method
  const allRouteKey = `ALL:${path}`;
  if (customRouteAuthConfig.has(allRouteKey)) {
    return customRouteAuthConfig.get(allRouteKey) === true;
  }

  // Check pattern matches for dynamic routes (e.g., '/users/:id')
  for (const [routeKey, requiresAuth] of customRouteAuthConfig.entries()) {
    const colonIndex = routeKey.indexOf(':');
    if (colonIndex === -1) {
      continue; // Skip malformed keys
    }

    const routeMethod = routeKey.substring(0, colonIndex);
    const routePattern = routeKey.substring(colonIndex + 1);

    // Check if method matches (exact match or ALL)
    if (routeMethod !== method && routeMethod !== 'ALL') {
      continue;
    }

    // Check if path matches the pattern
    if (pathMatchesPattern(path, routePattern)) {
      return requiresAuth === true;
    }
  }

  return false; // Not in config = not a protected custom route
};

/**
 * Check if request is from dev playground
 * @param getHeader - Function to get header value from request
 * @param customRouteAuthConfig - Map of custom route auth configurations
 */
export const isDevPlaygroundRequest = (
  path: string,
  method: string,
  getHeader: (name: string) => string | undefined,
  authConfig: MastraAuthConfig,
  customRouteAuthConfig?: Map<string, boolean>,
): boolean => {
  const protectedAccess = [...(defaultAuthConfig.protected || []), ...(authConfig.protected || [])];
  return (
    process.env.MASTRA_DEV === 'true' &&
    // Allow if path doesn't match protected patterns AND is not a protected custom route
    ((!isAnyMatch(path, method, protectedAccess) && !isProtectedCustomRoute(path, method, customRouteAuthConfig)) ||
      // Or if has playground header
      getHeader('x-mastra-dev-playground') === 'true')
  );
};

export const isCustomRoutePublic = (
  path: string,
  method: string,
  customRouteAuthConfig?: Map<string, boolean>,
): boolean => {
  if (!customRouteAuthConfig) {
    return false;
  }

  // Check exact match first (fast path for static routes)
  const exactRouteKey = `${method}:${path}`;
  if (customRouteAuthConfig.has(exactRouteKey)) {
    return !customRouteAuthConfig.get(exactRouteKey); // True when route opts out of auth
  }

  // Check exact match for ALL method
  const allRouteKey = `ALL:${path}`;
  if (customRouteAuthConfig.has(allRouteKey)) {
    return !customRouteAuthConfig.get(allRouteKey);
  }

  // Check pattern matches for dynamic routes (e.g., '/users/:id')
  for (const [routeKey, requiresAuth] of customRouteAuthConfig.entries()) {
    const colonIndex = routeKey.indexOf(':');
    if (colonIndex === -1) {
      continue; // Skip malformed keys
    }

    const routeMethod = routeKey.substring(0, colonIndex);
    const routePattern = routeKey.substring(colonIndex + 1);

    // Check if method matches (exact match or ALL)
    if (routeMethod !== method && routeMethod !== 'ALL') {
      continue;
    }

    // Check if path matches the pattern
    if (pathMatchesPattern(path, routePattern)) {
      return !requiresAuth; // True when route opts out of auth
    }
  }

  return false;
};

export const isProtectedPath = (
  path: string,
  method: string,
  authConfig: MastraAuthConfig,
  customRouteAuthConfig?: Map<string, boolean>,
): boolean => {
  const protectedAccess = [...(defaultAuthConfig.protected || []), ...(authConfig.protected || [])];
  return isAnyMatch(path, method, protectedAccess) || isProtectedCustomRoute(path, method, customRouteAuthConfig);
};

export const canAccessPublicly = (path: string, method: string, authConfig: MastraAuthConfig): boolean => {
  // Check if this path+method combination is publicly accessible
  const publicAccess = [...(defaultAuthConfig.public || []), ...(authConfig.public || [])];

  return isAnyMatch(path, method, publicAccess);
};

const isAnyMatch = (
  path: string,
  method: string,
  patterns: MastraAuthConfig['protected'] | MastraAuthConfig['public'],
): boolean => {
  if (!patterns) {
    return false;
  }

  for (const patternPathOrMethod of patterns) {
    if (patternPathOrMethod instanceof RegExp) {
      if (patternPathOrMethod.test(path)) {
        return true;
      }
    }

    if (typeof patternPathOrMethod === 'string' && pathMatchesPattern(path, patternPathOrMethod)) {
      return true;
    }

    if (Array.isArray(patternPathOrMethod) && patternPathOrMethod.length === 2) {
      const [pattern, methodOrMethods] = patternPathOrMethod;
      if (pathMatchesPattern(path, pattern) && matchesOrIncludes(methodOrMethods, method)) {
        return true;
      }
    }
  }

  return false;
};

export const pathMatchesPattern = (path: string, pattern: string): boolean => {
  // Use regexparam for battle-tested path matching
  // Supports:
  // - Exact paths: '/api/users'
  // - Wildcards: '/api/agents/*' matches '/api/agents/123'
  // - Path parameters: '/users/:id' matches '/users/123'
  // - Optional parameters: '/users/:id?' matches '/users' and '/users/123'
  // - Mixed patterns: '/api/:version/users/:id/profile'
  const { pattern: regex } = parse(pattern);
  return regex.test(path);
};

export const pathMatchesRule = (path: string, rulePath: string | RegExp | string[] | undefined): boolean => {
  if (!rulePath) return true; // No path specified means all paths

  if (typeof rulePath === 'string') {
    return pathMatchesPattern(path, rulePath);
  }

  if (rulePath instanceof RegExp) {
    return rulePath.test(path);
  }

  if (Array.isArray(rulePath)) {
    return rulePath.some(p => pathMatchesPattern(path, p));
  }

  return false;
};

export const matchesOrIncludes = (values: string | string[], value: string): boolean => {
  if (typeof values === 'string') {
    return values === value;
  }

  if (Array.isArray(values)) {
    return values.includes(value);
  }

  return false;
};

// ── Core auth middleware ──
// Framework-agnostic auth logic extracted from adapter middlewares.
// Each adapter builds an AuthMiddlewareContext and delegates to coreAuthMiddleware.

export interface AuthMiddlewareContext {
  path: string;
  method: string;
  getHeader: (name: string) => string | undefined;
  mastra: Mastra;
  authConfig: MastraAuthConfig;
  customRouteAuthConfig?: Map<string, boolean>;
  requestContext: { get: (key: string) => unknown; set: (key: string, value: unknown) => void };
  rawRequest: unknown;
  token: string | null;
  buildAuthorizeContext: () => unknown;
}

export type AuthResult = { action: 'next' } | { action: 'error'; status: number; body: Record<string, unknown> };

const pass: AuthResult = { action: 'next' };

/**
 * Single auth middleware: authenticate → authorize.
 * Skip checks (dev playground, unprotected path, public path) are evaluated once.
 */
export const coreAuthMiddleware = async (ctx: AuthMiddlewareContext): Promise<AuthResult> => {
  const { path, method, getHeader, mastra, authConfig, customRouteAuthConfig, requestContext, rawRequest, token } = ctx;

  // ── Skip checks (evaluated once) ──

  if (isDevPlaygroundRequest(path, method, getHeader, authConfig, customRouteAuthConfig)) {
    return pass;
  }

  if (!isProtectedPath(path, method, authConfig, customRouteAuthConfig)) {
    return pass;
  }

  if (canAccessPublicly(path, method, authConfig)) {
    return pass;
  }

  // ── Authentication ──

  let user: unknown;

  try {
    if (typeof authConfig.authenticateToken === 'function') {
      user = await authConfig.authenticateToken(token ?? '', rawRequest as any);
    } else {
      throw new Error('No token verification method configured');
    }

    if (!user) {
      return { action: 'error', status: 401, body: { error: 'Invalid or expired token' } };
    }

    requestContext.set('user', user);

    try {
      const serverConfig = mastra.getServer();
      const rbacProvider = serverConfig?.rbac as IRBACProvider<EEUser> | undefined;

      if (rbacProvider) {
        const permissions = await rbacProvider.getPermissions(user as EEUser);
        requestContext.set('userPermissions', permissions);

        const roles = await rbacProvider.getRoles(user as EEUser);
        requestContext.set('userRoles', roles);
      }
    } catch {
      // RBAC not available or failed, continue without permissions
    }
  } catch (err) {
    mastra.getLogger()?.error('Authentication error', {
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return { action: 'error', status: 401, body: { error: 'Invalid or expired token' } };
  }

  // ── Authorization ──

  if ('authorizeUser' in authConfig && typeof authConfig.authorizeUser === 'function') {
    try {
      const isAuthorized = await authConfig.authorizeUser(user, rawRequest as any);

      if (!isAuthorized) {
        return { action: 'error', status: 403, body: { error: 'Access denied' } };
      }
    } catch (err) {
      mastra.getLogger()?.error('Authorization error in authorizeUser', {
        error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      });
      return { action: 'error', status: 500, body: { error: 'Authorization error' } };
    }
  } else if ('authorize' in authConfig && typeof authConfig.authorize === 'function') {
    try {
      const authorizeCtx = ctx.buildAuthorizeContext();
      const isAuthorized = await authConfig.authorize(path, method, user, authorizeCtx as any);

      if (!isAuthorized) {
        return { action: 'error', status: 403, body: { error: 'Access denied' } };
      }
    } catch (err) {
      mastra.getLogger()?.error('Authorization error in authorize', {
        error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
        path,
        method,
      });
      return { action: 'error', status: 500, body: { error: 'Authorization error' } };
    }
  } else if ('rules' in authConfig && authConfig.rules && authConfig.rules.length > 0) {
    const isAuthorized = await checkRules(authConfig.rules, path, method, user);

    if (!isAuthorized) {
      return { action: 'error', status: 403, body: { error: 'Access denied' } };
    }
  } else {
    // No explicit authorization configured (authorizeUser, authorize, or rules)
    // Check if RBAC is configured - if not, allow authenticated users through
    // (auth-only mode = authenticated users get full access)
    const rbacProvider = mastra.getServer()?.rbac;
    if (rbacProvider) {
      if (defaultAuthConfig.rules && defaultAuthConfig.rules.length > 0) {
        const isAuthorized = await checkRules(defaultAuthConfig.rules, path, method, user);

        if (!isAuthorized) {
          return { action: 'error', status: 403, body: { error: 'Access denied' } };
        }
      } else {
        return { action: 'error', status: 403, body: { error: 'Access denied' } };
      }
    }
  }

  return pass;
};

// Check authorization rules
export const checkRules = async (
  rules: MastraAuthConfig['rules'],
  path: string,
  method: string,
  user: unknown,
): Promise<boolean> => {
  // Go through rules in order (first match wins)
  for (const i in rules || []) {
    const rule = rules?.[i]!;
    // Check if rule applies to this path
    if (!pathMatchesRule(path, rule.path)) {
      continue;
    }

    // Check if rule applies to this method
    if (rule.methods && !matchesOrIncludes(rule.methods, method)) {
      continue;
    }

    // Rule matches, check conditions
    const condition = rule.condition;
    if (typeof condition === 'function') {
      const allowed = await Promise.resolve()
        .then(() => condition(user))
        .catch(() => false);

      if (allowed) {
        return true;
      }
    } else if (rule.allow) {
      return true;
    }
  }

  // No matching rules, deny by default
  return false;
};
