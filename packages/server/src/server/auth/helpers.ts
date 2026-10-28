import type { ISessionProvider } from '@mastra/core/auth';
import type { IRBACProvider, EEUser } from '@mastra/core/auth/ee';
import type { Mastra } from '@mastra/core/mastra';
import { CompositeAuth } from '@mastra/core/server';
import type { ApiRoute, IMastraAuthProvider, MastraAuthConfig, MastraAuthRequest } from '@mastra/core/server';

import {
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_USER_KEY,
  MASTRA_USER_PERMISSIONS_KEY,
  MASTRA_USER_ROLES_KEY,
  MASTRA_AUTH_TOKEN_KEY,
  MASTRA_AUTH_MODE_KEY,
} from '../constants';
import { HTTPException } from '../http-exception';
import { CustomRouteMatcher, getCustomRouteAuthConfigMatcher } from './custom-route-matcher';
import { defaultAuthConfig } from './defaults';
import { parse } from './path-pattern';

// Re-export request-context key constants so custom middleware can read namespaced
// auth state without importing internal paths.
export { MASTRA_USER_KEY, MASTRA_USER_PERMISSIONS_KEY, MASTRA_USER_ROLES_KEY } from '../constants';

type CustomRouteAuthDecision = 'protected' | 'public' | 'none';

/**
 * Decide auth for a request from the custom route the custom-route app will dispatch
 * it to (see `CustomRouteMatcher`), not from whichever pattern happens to match.
 *
 * Fails closed:
 * - an exact `METHOD:path` (or `ALL:path`) entry that requires auth always wins, so a
 *   path registered as protected is never served without auth;
 * - `path` may be a raw request path (Express, Koa, Fastify) or one Hono already
 *   decoded, so it's resolved both ways and is only public if every reading lands on
 *   a public route, and protected if any reading lands on a protected one;
 * - if the routes or the path can't be parsed, the request is treated as protected.
 */
const resolveCustomRouteAuth = (
  path: string,
  method: string,
  customRouteAuthConfig: Map<string, boolean>,
): CustomRouteAuthDecision => {
  const upperMethod = method.toUpperCase();
  const methods = upperMethod === 'HEAD' ? ['HEAD', 'GET'] : [upperMethod];
  for (const m of methods) {
    if (customRouteAuthConfig.get(`${m}:${path}`) === true || customRouteAuthConfig.get(`ALL:${path}`) === true) {
      return 'protected';
    }
  }

  // Adapters pin the current request by appending `METHOD:path` to a copy of the map.
  // As the last entry it only decides when no earlier route matches, so resolve the
  // rest with a cached matcher and fall back to it, instead of building a new router
  // for every request path.
  const keys = [...customRouteAuthConfig.keys()];
  const lastKey = keys[keys.length - 1];
  const pinnedKey =
    lastKey !== undefined && methods.some(m => lastKey === `${m}:${path}` || lastKey === `ALL:${path}`)
      ? lastKey
      : undefined;

  let matcher: ReturnType<typeof getCustomRouteAuthConfigMatcher>;
  const candidates = new Set<string>([path]);
  try {
    matcher = getCustomRouteAuthConfigMatcher(pinnedKey ? keys.slice(0, -1) : keys);
    candidates.add(matcher.dispatchPathForRawPath(path));
  } catch {
    return 'protected';
  }

  let matchedPublic = false;
  let unmatched = false;
  for (const candidate of candidates) {
    let key: string | undefined;
    try {
      key = matcher.matchPath(candidate, upperMethod)?.entry.key;
    } catch {
      return 'protected';
    }
    if (key === undefined && pinnedKey && candidate === path) {
      key = pinnedKey;
    }
    if (key === undefined) {
      unmatched = true;
      continue;
    }
    if (customRouteAuthConfig.get(key) !== false) {
      return 'protected';
    }
    matchedPublic = true;
  }

  return matchedPublic && !unmatched ? 'public' : 'none';
};

/**
 * Check if a request will be handled by a registered custom route that requires
 * authentication. The route that decides is the one the custom-route app dispatches
 * to (first registered match), using Hono's own matching. Returns false when no
 * custom route handles the request.
 */
export const isProtectedCustomRoute = (
  path: string,
  method: string,
  customRouteAuthConfig?: Map<string, boolean>,
): boolean => {
  if (!customRouteAuthConfig || customRouteAuthConfig.size === 0) {
    return false;
  }
  return resolveCustomRouteAuth(path, method, customRouteAuthConfig) === 'protected';
};

const apiRouteMatchers = new WeakMap<
  readonly ApiRoute[],
  { signature: string; matcher: CustomRouteMatcher<ApiRoute> }
>();

/**
 * Find the custom API route Hono dispatches `path` to, with its decoded path params.
 * `path` is in the form Hono's `c.req.path` returns (no query string, decoded once).
 * Matching follows Hono: first registered match wins, case-sensitive, strict
 * trailing slash, and HEAD is served by GET routes.
 */
export const findMatchingCustomRoute = (
  path: string,
  method: string,
  apiRoutes?: ApiRoute[],
): { route: ApiRoute; params: Record<string, string> } | undefined => {
  if (!apiRoutes || apiRoutes.length === 0) return undefined;

  const signature = JSON.stringify(apiRoutes.map(route => `${route.method}:${route.path}`));
  let cached = apiRouteMatchers.get(apiRoutes);
  if (!cached || cached.signature !== signature) {
    cached = { signature, matcher: new CustomRouteMatcher(apiRoutes) };
    apiRouteMatchers.set(apiRoutes, cached);
  }

  try {
    const match = cached.matcher.matchPath(path, method);
    return match ? { route: match.entry, params: match.params } : undefined;
  } catch {
    // Hono can't route these paths either, so no custom route handles the request.
    return undefined;
  }
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

/**
 * Check if a request will be handled by a custom route registered as public
 * (`requiresAuth: false`). Uses the same dispatch-order resolution as
 * `isProtectedCustomRoute`, and returns false (not public) when no custom route
 * handles the request or the answer is ambiguous.
 */
export const isCustomRoutePublic = (
  path: string,
  method: string,
  customRouteAuthConfig?: Map<string, boolean>,
): boolean => {
  if (!customRouteAuthConfig || customRouteAuthConfig.size === 0) {
    return false;
  }
  return resolveCustomRouteAuth(path, method, customRouteAuthConfig) === 'public';
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
  rawRequest: MastraAuthRequest;
  token: string | null;
  buildAuthorizeContext: () => unknown;
  /** When true, force authentication even if the path matches a public pattern. */
  requiresAuth?: boolean;
}

export type AuthResult =
  | { action: 'next'; headers?: Record<string, string> }
  | { action: 'error'; status: number; body: Record<string, unknown>; headers?: Record<string, string> };

const pass: AuthResult = { action: 'next' };

/**
 * Lets an app's `authorize(path, method, user, context)` read `context.get('requestContext')` and
 * `context.get('mastra')` on every adapter, as it can on Hono, so per-caller values (the Knowledge scope) bind
 * the same way everywhere. Hono and NestJS contexts already answer `get`; Express, Fastify and Koa pass a web
 * Request, Elysia its own context, and adapters with no builder pass nothing.
 */
const withAuthorizeVariables = (
  base: unknown,
  ctx: Pick<AuthMiddlewareContext, 'mastra' | 'requestContext' | 'customRouteAuthConfig' | 'rawRequest'>,
): unknown => {
  const variables: Record<string, unknown> = {
    mastra: ctx.mastra,
    requestContext: ctx.requestContext,
    customRouteAuthConfig: ctx.customRouteAuthConfig,
  };
  const get = (key: string) => variables[key];
  if (base === null || base === undefined) {
    return { get, req: ctx.rawRequest };
  }
  if (typeof base === 'object' && typeof (base as { get?: unknown }).get !== 'function') {
    Object.defineProperty(base, 'get', { value: get, configurable: true });
  }
  return base;
};

const adaptToMastraAuthRequest = (request: MastraAuthRequest): MastraAuthRequest => {
  if (!(request instanceof Request)) {
    return request;
  }

  return {
    raw: request,
    headers: request.headers,
    header: name => request.headers.get(name) ?? undefined,
  };
};

export interface GetAuthenticatedUserOptions {
  mastra: Mastra;
  token: string;
  request: MastraAuthRequest;
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

  return (await authConfig.authenticateToken(normalizedToken, request)) as TUser | null;
};

/**
 * Check if an auth config object supports transparent session refresh.
 * Returns true if the auth provider implements the necessary ISessionProvider methods.
 */
export function supportsSessionRefresh(
  authConfig: MastraAuthConfig | IMastraAuthProvider,
): authConfig is (MastraAuthConfig | IMastraAuthProvider) &
  Pick<ISessionProvider, 'refreshSession' | 'getSessionIdFromRequest' | 'getSessionHeaders'> {
  return (
    typeof (authConfig as any).getSessionIdFromRequest === 'function' &&
    typeof (authConfig as any).refreshSession === 'function' &&
    typeof (authConfig as any).getSessionHeaders === 'function'
  );
}

/**
 * Whether auth is bypassed for this path/method: the dev playground (only when no auth
 * provider is configured), paths that are not protected, and public paths (unless the
 * route forces auth with `requiresAuth: true`).
 */
export const isAuthBypassed = ({
  path,
  method,
  getHeader,
  authConfig,
  customRouteAuthConfig,
  requiresAuth,
}: Pick<
  AuthMiddlewareContext,
  'path' | 'method' | 'getHeader' | 'authConfig' | 'customRouteAuthConfig' | 'requiresAuth'
>): boolean => {
  // Only bypass auth for dev playground when no real auth provider is configured.
  // When auth IS configured (has authenticateToken), we need the full auth flow
  // so user/roles/permissions are set in requestContext.
  const hasAuthProvider = typeof authConfig.authenticateToken === 'function';
  if (!hasAuthProvider && isDevPlaygroundRequest(path, method, getHeader, authConfig, customRouteAuthConfig)) {
    return true;
  }

  if (!isProtectedPath(path, method, authConfig, customRouteAuthConfig)) {
    return true;
  }

  // When a route explicitly requires auth (requiresAuth: true), skip the
  // public-path bypass so the user is still authenticated and permissions
  // are injected into the request context.
  return (
    !requiresAuth &&
    (canAccessPublicly(path, method, authConfig) || isCustomRoutePublic(path, method, customRouteAuthConfig))
  );
};

/**
 * Single auth middleware: authenticate → authorize.
 * Skip checks (dev playground, unprotected path, public path) are evaluated once.
 */
export const coreAuthMiddleware = async (ctx: AuthMiddlewareContext): Promise<AuthResult> => {
  const { path, method, mastra, authConfig, customRouteAuthConfig, requestContext, rawRequest, token } = ctx;

  // ── Skip checks (evaluated once) ──

  if (isAuthBypassed(ctx)) {
    return pass;
  }

  // ── Authentication ──

  let user: unknown;
  let refreshHeaders: Record<string, string> | undefined;
  const authRequest = adaptToMastraAuthRequest(rawRequest);

  type ConsumePendingResponseHeadersFn = (request: typeof authRequest) => Record<string, string> | undefined;
  const mergePendingProviderHeaders = (request: typeof authRequest = authRequest) => {
    const consume = (authConfig as { consumePendingResponseHeaders?: ConsumePendingResponseHeadersFn })
      .consumePendingResponseHeaders;
    if (typeof consume !== 'function') return;
    let pending: Record<string, string> | undefined;
    try {
      pending = consume.call(authConfig, request);
    } catch {
      // Forwarding a rotated cookie is best-effort; never fail auth over it.
      return;
    }
    if (!pending) return;
    refreshHeaders = { ...(refreshHeaders ?? {}), ...pending };
  };

  try {
    if (typeof authConfig.authenticateToken === 'function') {
      user = await authConfig.authenticateToken(token ?? '', authRequest);
      mergePendingProviderHeaders();
    } else {
      throw new Error('No token verification method configured');
    }

    // If authentication failed, attempt transparent session refresh before returning 401.
    // This handles expired access tokens without requiring client-side refresh logic.
    if (!user && supportsSessionRefresh(authConfig) && rawRequest instanceof Request) {
      let retryHttpError: HTTPException | undefined;
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
              try {
                const retryAuthRequest = adaptToMastraAuthRequest(refreshedRequest);
                user = await authConfig.authenticateToken(cookieValue, retryAuthRequest);
                mergePendingProviderHeaders(retryAuthRequest);
              } catch (retryErr) {
                retryHttpError = retryErr instanceof HTTPException ? retryErr : undefined;
                throw retryErr;
              }
            }
            if (!user) {
              refreshHeaders = undefined;
            }
          }
        }
      } catch (refreshErr) {
        refreshHeaders = undefined;
        // An explicit HTTP error from the retried authenticateToken goes to the outer handler.
        if (retryHttpError === refreshErr) throw refreshErr;
        mastra.getLogger()?.debug('Session refresh failed, falling back to 401', {
          error: refreshErr instanceof Error ? { message: refreshErr.message } : refreshErr,
        });
      }
    }

    if (!user) {
      return { action: 'error', status: 401, body: { error: 'Invalid or expired token' }, headers: refreshHeaders };
    }

    requestContext.set(MASTRA_USER_KEY, user);
    // Backward-compat: also write the legacy `'user'` key so existing
    // middleware and integrations that read `requestContext.get('user')`
    // (including built-in FGA route enforcement, memory handlers, and the
    // documented public surface) keep working. New code should prefer
    // `MASTRA_USER_KEY` to avoid collisions with caller-supplied keys.
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
        // CompositeAuth validates the authenticating provider's mapper. It can
        // return undefined when that provider never configured a mapper.
        if (resourceId !== undefined || !(authConfig instanceof CompositeAuth)) {
          if (typeof resourceId !== 'string' || !resourceId.trim()) {
            throw new Error('mapUserToResourceId must return a non-empty string for the authenticated user');
          }
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
      // Determine which RBAC provider to use based on auth mode
      const authMode = requestContext.get(MASTRA_AUTH_MODE_KEY);
      const serverConfig = mastra.getServer();
      const studioConfig = mastra.getStudio?.();
      // Use studio RBAC if this is a studio request, otherwise use server RBAC
      const rbacProvider = (authMode === 'studio' ? (studioConfig?.rbac ?? serverConfig?.rbac) : serverConfig?.rbac) as
        | IRBACProvider<EEUser>
        | undefined;

      if (rbacProvider) {
        if (!user || typeof user !== 'object' || !('id' in user)) {
          mastra.getLogger()?.warn('RBAC: authenticated user missing required "id" field, skipping permission loading');
        } else {
          const permissions = await rbacProvider.getPermissions(user as EEUser);
          requestContext.set(MASTRA_USER_PERMISSIONS_KEY, permissions);
          // Backward-compat alias for callers reading the legacy key.
          requestContext.set('userPermissions', permissions);

          const roles = await rbacProvider.getRoles(user as EEUser);
          requestContext.set(MASTRA_USER_ROLES_KEY, roles);
          // Backward-compat alias for callers reading the legacy key.
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
    // Explicit HTTP errors from auth callbacks keep their status/message; anything else is redacted.
    // The HTTPException message is sent to the client, so callers must keep it safe (no internal details).
    if (err instanceof HTTPException && err.status >= 400 && err.status <= 599) {
      return { action: 'error', status: err.status, body: { error: err.message }, headers: refreshHeaders };
    }
    return { action: 'error', status: 401, body: { error: 'Invalid or expired token' }, headers: refreshHeaders };
  }

  // ── Authorization ──

  const authorizationError = await authorizeAuthenticatedUser({
    path,
    method,
    user,
    mastra,
    authConfig,
    customRouteAuthConfig,
    requestContext,
    rawRequest,
    buildAuthorizeContext: ctx.buildAuthorizeContext,
  });
  if (authorizationError) {
    return { action: 'error', ...authorizationError, headers: refreshHeaders };
  }

  return refreshHeaders ? { action: 'next', headers: refreshHeaders } : pass;
};

export interface AuthorizeAuthenticatedUserContext {
  path: string;
  method: string;
  user: unknown;
  mastra: Mastra;
  authConfig: MastraAuthConfig;
  customRouteAuthConfig?: Map<string, boolean>;
  requestContext: AuthMiddlewareContext['requestContext'];
  rawRequest: MastraAuthRequest;
  buildAuthorizeContext: () => unknown;
}

/**
 * The authorization step of server auth for an already authenticated user:
 * `authorizeUser`, `authorize(path, method, user)`, `rules`, or the RBAC default rules.
 * Returns null when the user may access `method path`.
 */
export const authorizeAuthenticatedUser = async (
  ctx: AuthorizeAuthenticatedUserContext,
): Promise<{ status: number; body: Record<string, unknown> } | null> => {
  const { path, method, user, mastra, authConfig, requestContext, rawRequest } = ctx;
  const denied = { status: 403, body: { error: 'Access denied' } };

  if ('authorizeUser' in authConfig && typeof authConfig.authorizeUser === 'function') {
    try {
      const isAuthorized = await authConfig.authorizeUser(user, adaptToMastraAuthRequest(rawRequest));
      return isAuthorized ? null : denied;
    } catch (err) {
      mastra.getLogger()?.error('Authorization error in authorizeUser', {
        error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      });
      return { status: 500, body: { error: 'Authorization error' } };
    }
  }

  if ('authorize' in authConfig && typeof authConfig.authorize === 'function') {
    try {
      const authorizeCtx = withAuthorizeVariables(ctx.buildAuthorizeContext(), {
        mastra,
        requestContext,
        customRouteAuthConfig: ctx.customRouteAuthConfig,
        rawRequest,
      });
      const isAuthorized = await authConfig.authorize(path, method, user, authorizeCtx as any);
      return isAuthorized ? null : denied;
    } catch (err) {
      mastra.getLogger()?.error('Authorization error in authorize', {
        error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
        path,
        method,
      });
      return { status: 500, body: { error: 'Authorization error' } };
    }
  }

  if ('rules' in authConfig && authConfig.rules && authConfig.rules.length > 0) {
    return (await checkRules(authConfig.rules, path, method, user)) ? null : denied;
  }

  // No explicit authorization configured (authorizeUser, authorize, or rules)
  // Check if RBAC is configured - if not, allow authenticated users through
  // (auth-only mode = authenticated users get full access)
  const rbacProvider =
    requestContext.get(MASTRA_AUTH_MODE_KEY) === 'studio'
      ? (mastra.getStudio?.()?.rbac ?? mastra.getServer()?.rbac)
      : mastra.getServer()?.rbac;
  if (rbacProvider) {
    if (defaultAuthConfig.rules && defaultAuthConfig.rules.length > 0) {
      return (await checkRules(defaultAuthConfig.rules, path, method, user)) ? null : denied;
    }
    return denied;
  }

  return null;
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

    // Rule matches, so it decides. A failed condition denies instead of
    // falling through to a broader rule further down the list.
    const condition = rule.condition;
    if (typeof condition === 'function') {
      return await Promise.resolve()
        .then(() => condition(user))
        .then(result => !!result)
        .catch(() => false);
    }
    return !!rule.allow;
  }

  // No matching rules, deny by default
  return false;
};
