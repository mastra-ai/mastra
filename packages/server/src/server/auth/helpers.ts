import type { ISessionProvider } from '@mastra/core/auth';
import type { IRBACProvider, EEUser } from '@mastra/core/auth/ee';
import type { Mastra } from '@mastra/core/mastra';
import type { ApiRoute, MastraAuthConfig, MastraAuthProvider } from '@mastra/core/server';
import type { HonoRequest } from 'hono';

import { MASTRA_RESOURCE_ID_KEY, MASTRA_AUTH_TOKEN_KEY } from '../constants';
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
 * Find a matching custom API route for the given path and method.
 * Returns the matched route and any extracted path parameters.
 */
export const findMatchingCustomRoute = (
  path: string,
  method: string,
  apiRoutes?: ApiRoute[],
): { route: ApiRoute; params: Record<string, string> } | undefined => {
  if (!apiRoutes) return undefined;

  for (const route of apiRoutes) {
    if (route.method !== method && route.method !== 'ALL') continue;

    const { keys, pattern: regex } = parse(route.path);
    const match = regex.exec(path);
    if (!match) continue;

    const params: Record<string, string> = {};
    if (keys && keys.length > 0) {
      for (let i = 0; i < keys.length; i++) {
        if (match[i + 1] !== undefined) {
          params[keys[i]!] = match[i + 1]!;
        }
      }
    }

    return { route, params };
  }

  return undefined;
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

// NOTE: This uses isProtectedCustomRoute (default-allow for unknown paths) rather than
// !isCustomRoutePublic (default-deny). This is intentional — all registered server and
// custom routes are auth-checked via registerRoute/checkRouteAuth regardless of this
// function. The '/api/*' protected pattern exists as a user-facing override mechanism.
// The old default-deny logic incorrectly blocked non-API paths (e.g. '/', '/agents')
// which prevented the studio login page from loading in production.
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

export type AuthResult =
  | { action: 'next'; headers?: Record<string, string> }
  | { action: 'error'; status: number; body: Record<string, unknown>; headers?: Record<string, string> };

const pass: AuthResult = { action: 'next' };

export interface GetAuthenticatedUserOptions {
  mastra: Mastra;
  token: string;
  request: Request | HonoRequest;
}

export const getAuthenticatedUser = async <TUser = unknown>({
  mastra,
  token,
  request,
}: GetAuthenticatedUserOptions): Promise<TUser | null> => {
  const normalizedToken = token.replace(/^Bearer\s+/i, '').trim();
  if (!normalizedToken) {
    return null;
  }

  const authConfig = mastra.getServer()?.auth;
  if (!authConfig || typeof authConfig.authenticateToken !== 'function') {
    return null;
  }

  return (await authConfig.authenticateToken(normalizedToken, request as any)) as TUser | null;
};

/**
 * Check if an auth config object supports transparent session refresh.
 * Returns true if the auth provider implements the necessary ISessionProvider methods.
 */
export function supportsSessionRefresh(
  authConfig: MastraAuthConfig | MastraAuthProvider,
): authConfig is (MastraAuthConfig | MastraAuthProvider) &
  Pick<ISessionProvider, 'refreshSession' | 'getSessionIdFromRequest' | 'getSessionHeaders'> {
  return (
    typeof (authConfig as any).getSessionIdFromRequest === 'function' &&
    typeof (authConfig as any).refreshSession === 'function' &&
    typeof (authConfig as any).getSessionHeaders === 'function'
  );
}

/**
 * Single auth middleware: authenticate → authorize.
 * Skip checks (dev playground, unprotected path, public path) are evaluated once.
 */
export const coreAuthMiddleware = async (ctx: AuthMiddlewareContext): Promise<AuthResult> => {
  const { path, method, getHeader, mastra, authConfig, customRouteAuthConfig, requestContext, rawRequest, token } = ctx;

  // ── Skip checks (evaluated once) ──

  // Only bypass auth for dev playground when no real auth provider is configured.
  // When auth IS configured (has authenticateToken), we need the full auth flow
  // so user/roles/permissions are set in requestContext.
  const hasAuthProvider = typeof authConfig.authenticateToken === 'function';
  if (!hasAuthProvider && isDevPlaygroundRequest(path, method, getHeader, authConfig, customRouteAuthConfig)) {
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
  let refreshHeaders: Record<string, string> | undefined;

  try {
    if (typeof authConfig.authenticateToken === 'function') {
      user = await authConfig.authenticateToken(token ?? '', rawRequest as any);
    } else {
      throw new Error('No token verification method configured');
    }

    // If authentication failed, attempt transparent session refresh before returning 401.
    // This handles expired access tokens without requiring client-side refresh logic.
    if (!user && supportsSessionRefresh(authConfig) && rawRequest instanceof Request) {
      try {
        const sessionId = authConfig.getSessionIdFromRequest(rawRequest);
        if (sessionId) {
          const newSession = await authConfig.refreshSession(sessionId);
          if (newSession) {
            // Refresh succeeded — build updated session headers and re-authenticate.
            // We create a synthetic request with the new session cookie so
            // authenticateToken (which reads cookies from the request) picks up
            // the refreshed session instead of the expired one.
            refreshHeaders = authConfig.getSessionHeaders(newSession);
            const refreshedCookie = Object.entries(refreshHeaders)
              .filter(([k]) => k.toLowerCase() === 'set-cookie')
              .map(([, v]) => v.split(';')[0]) // Extract name=value before attributes
              .join('; ');
            if (refreshedCookie) {
              const refreshedRequest = new Request(rawRequest.url, {
                method: rawRequest.method,
                headers: new Headers(rawRequest.headers),
              });
              refreshedRequest.headers.set('Cookie', refreshedCookie);
              // Pass the refreshed cookie value as the token so authenticateToken
              // picks up the new session instead of the stale original.
              // Auth providers typically read cookies from the request object, but
              // some may also inspect the token parameter directly.
              const cookieValue = refreshedCookie.includes('=')
                ? refreshedCookie.split('=').slice(1).join('=')
                : refreshedCookie;
              user = await authConfig.authenticateToken(cookieValue, refreshedRequest as any);
            }
            if (!user) {
              refreshHeaders = undefined;
            }
          }
        }
      } catch (refreshErr) {
        refreshHeaders = undefined;
        mastra.getLogger()?.debug('Session refresh failed, falling back to 401', {
          error: refreshErr instanceof Error ? { message: refreshErr.message } : refreshErr,
        });
      }
    }

    if (!user) {
      return { action: 'error', status: 401, body: { error: 'Invalid or expired token' }, headers: refreshHeaders };
    }

    requestContext.set('user', user);

    // Store the raw auth token so downstream code (e.g., editor MCP client
    // resolution) can forward it when connecting to auth-protected MCP servers.
    // The token may arrive via Authorization header, apiKey query param, or
    // cookie (SimpleAuth sets `mastra-token`). Check all sources so the
    // forwarded value is available regardless of how the user authenticated.
    let effectiveToken = token;
    if (!effectiveToken && rawRequest instanceof Request) {
      const cookieHeader = rawRequest.headers.get('cookie');
      if (cookieHeader) {
        const match = cookieHeader.match(/mastra-token=([^;]+)/);
        if (match?.[1]) effectiveToken = match[1];
      }
    }
    if (effectiveToken) {
      requestContext.set(MASTRA_AUTH_TOKEN_KEY, effectiveToken);
    }

    if (typeof authConfig.mapUserToResourceId === 'function') {
      try {
        const resourceId = authConfig.mapUserToResourceId(user);
        if (resourceId) {
          requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
        }
      } catch (mapError) {
        mastra.getLogger()?.error('mapUserToResourceId failed', {
          error: mapError instanceof Error ? { message: mapError.message, stack: mapError.stack } : mapError,
        });
        return {
          action: 'error',
          status: 500,
          body: { error: 'Failed to map authenticated user to a resource ID' },
          headers: refreshHeaders,
        };
      }
    }

    try {
      const serverConfig = mastra.getServer();
      const rbacProvider = serverConfig?.rbac as IRBACProvider<EEUser> | undefined;

      if (rbacProvider) {
        if (!user || typeof user !== 'object' || !('id' in user)) {
          mastra.getLogger()?.warn('RBAC: authenticated user missing required "id" field, skipping permission loading');
        } else {
          const permissions = await rbacProvider.getPermissions(user as EEUser);
          requestContext.set('userPermissions', permissions);

          const roles = await rbacProvider.getRoles(user as EEUser);
          requestContext.set('userRoles', roles);
        }
      }
    } catch (rbacError) {
      mastra.getLogger()?.error('RBAC: failed to load user permissions/roles', {
        error: rbacError instanceof Error ? { message: rbacError.message, stack: rbacError.stack } : rbacError,
      });
    }
  } catch (err) {
    mastra.getLogger()?.error('Authentication error', {
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return { action: 'error', status: 401, body: { error: 'Invalid or expired token' }, headers: refreshHeaders };
  }

  // ── Authorization ──

  if ('authorizeUser' in authConfig && typeof authConfig.authorizeUser === 'function') {
    try {
      const isAuthorized = await authConfig.authorizeUser(user, rawRequest as any);

      if (!isAuthorized) {
        return { action: 'error', status: 403, body: { error: 'Access denied' }, headers: refreshHeaders };
      }
    } catch (err) {
      mastra.getLogger()?.error('Authorization error in authorizeUser', {
        error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      });
      return { action: 'error', status: 500, body: { error: 'Authorization error' }, headers: refreshHeaders };
    }
  } else if ('authorize' in authConfig && typeof authConfig.authorize === 'function') {
    try {
      const authorizeCtx = ctx.buildAuthorizeContext();
      const isAuthorized = await authConfig.authorize(path, method, user, authorizeCtx as any);

      if (!isAuthorized) {
        return { action: 'error', status: 403, body: { error: 'Access denied' }, headers: refreshHeaders };
      }
    } catch (err) {
      mastra.getLogger()?.error('Authorization error in authorize', {
        error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
        path,
        method,
      });
      return { action: 'error', status: 500, body: { error: 'Authorization error' }, headers: refreshHeaders };
    }
  } else if ('rules' in authConfig && authConfig.rules && authConfig.rules.length > 0) {
    const isAuthorized = await checkRules(authConfig.rules, path, method, user);

    if (!isAuthorized) {
      return { action: 'error', status: 403, body: { error: 'Access denied' }, headers: refreshHeaders };
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
          return { action: 'error', status: 403, body: { error: 'Access denied' }, headers: refreshHeaders };
        }
      } else {
        return { action: 'error', status: 403, body: { error: 'Access denied' }, headers: refreshHeaders };
      }
    }
  }

  return refreshHeaders ? { action: 'next', headers: refreshHeaders } : pass;
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
