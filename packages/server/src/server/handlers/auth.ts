/**
 * Auth handlers for EE authentication capabilities.
 *
 * These routes enable Studio to:
 * - Detect available auth capabilities
 * - Initiate SSO login flows
 * - Handle OAuth callbacks
 * - Logout users
 */

import type {
  IUserProvider,
  ISessionProvider,
  ISSOProvider,
  ICredentialsProvider,
  SSOCallbackResult,
} from '@mastra/core/auth';
import type { IRBACProvider, EEUser } from '@mastra/core/auth/ee';
import type { MastraAuthProvider } from '@mastra/core/server';

import { z } from 'zod/v4';
import { supportsSessionRefresh } from '../auth/helpers';
import { MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import {
  capabilitiesResponseSchema,
  ssoLoginQuerySchema,
  ssoCallbackQuerySchema,
  currentUserResponseSchema,
  credentialsSignInBodySchema,
  credentialsSignUpBodySchema,
  refreshResponseSchema,
} from '../schemas/auth';
import { createPublicRoute, createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

type BuildCapabilitiesFn = (auth: any, request: Request, options?: { rbac?: any; apiPrefix?: string }) => Promise<any>;
let _buildCapabilitiesPromise: Promise<BuildCapabilitiesFn | undefined> | undefined;
function loadBuildCapabilities(): Promise<BuildCapabilitiesFn | undefined> {
  if (!_buildCapabilitiesPromise) {
    _buildCapabilitiesPromise = import('@mastra/core/auth/ee')
      .then(m => m.buildCapabilities as BuildCapabilitiesFn)
      .catch(() => {
        console.error(
          '[@mastra/server] EE auth features require @mastra/core >= 1.6.0. Please upgrade: npm install @mastra/core@latest',
        );
        return undefined;
      });
  }
  return _buildCapabilitiesPromise;
}

/**
 * Helper to get auth provider from Mastra instance.
 */
function getAuthProvider(mastra: any): MastraAuthProvider | null {
  const serverConfig = mastra.getServer?.();
  if (!serverConfig?.auth) return null;

  // Auth can be either MastraAuthConfig or MastraAuthProvider
  // If it has authenticateToken method, it's a provider
  if (typeof serverConfig.auth.authenticateToken === 'function') {
    return serverConfig.auth as MastraAuthProvider;
  }

  return null;
}

/**
 * Get the public-facing origin from a request, respecting reverse proxy headers.
 * Behind a proxy (e.g. edge router), request.url contains the internal hostname,
 * so we rely on forwarded headers to reconstruct the real public origin.
 *
 * Assumes the server is behind a trusted proxy (or running locally). When
 * exposed directly to untrusted clients, the Host header is attacker-controlled
 * and must be validated upstream.
 *
 * Priority:
 * 1. X-Forwarded-Host (traditional reverse proxy) → always HTTPS. Knative's
 *    queue-proxy overwrites X-Forwarded-Proto based on the internal HTTP
 *    connection, so X-Forwarded-Proto is ignored here.
 * 2. Host header with X-Forwarded-Proto (AWS ALB, some proxies) → respect proto.
 * 3. Host header alone → use the scheme from request.url (covers both direct
 *    HTTP access and proxies that preserve Host but don't set a proto header).
 * 4. No Host header → fall back to request.url.origin (local dev / direct access).
 */
export function getPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (forwardedHost) {
    return `https://${forwardedHost}`;
  }

  const host = request.headers.get('host');
  if (host) {
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const proto = forwardedProto || new URL(request.url).protocol.replace(':', '');
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

/**
 * Helper to get RBAC provider from Mastra server config.
 */
function getRBACProvider(mastra: any): IRBACProvider<EEUser> | undefined {
  const serverConfig = mastra.getServer?.();
  return serverConfig?.rbac as IRBACProvider<EEUser> | undefined;
}

/**
 * Type guard to check if auth provider implements an interface.
 */
function implementsInterface<T>(auth: unknown, method: keyof T): auth is T {
  return auth !== null && typeof auth === 'object' && method in auth;
}

// ============================================================================
// GET /auth/capabilities
// ============================================================================

export const GET_AUTH_CAPABILITIES_ROUTE = createPublicRoute({
  method: 'GET',
  path: '/auth/capabilities',
  responseType: 'json',
  responseSchema: capabilitiesResponseSchema,
  summary: 'Get auth capabilities',
  description:
    'Returns authentication capabilities and current user info. Used by Studio to determine available features and user state.',
  tags: ['Auth'],
  handler: async ctx => {
    try {
      const { mastra, request, routePrefix } = ctx as any;

      const auth = getAuthProvider(mastra);

      if (!auth) {
        return { enabled: false, login: null };
      }

      const rbac = getRBACProvider(mastra);

      const buildCapabilities = await loadBuildCapabilities();
      if (!buildCapabilities) {
        return { enabled: false, login: null };
      }
      const capabilities = await buildCapabilities(auth, request, { rbac, apiPrefix: routePrefix });

      // If capabilities came back without a user, the session may have expired.
      // Attempt a transparent refresh (same logic as coreAuthMiddleware) and retry.
      if (!('user' in capabilities) && supportsSessionRefresh(auth)) {
        try {
          const sessionId = await auth.getSessionIdFromRequest(request);
          if (sessionId) {
            const refreshedSession = await auth.refreshSession(sessionId);
            if (refreshedSession) {
              const sessionHeaders = await auth.getSessionHeaders(refreshedSession);
              const cookieValue = extractCookieFromHeaders(sessionHeaders);
              if (cookieValue) {
                // Rebuild capabilities with the refreshed cookie
                const refreshedRequest = new Request(request.url, {
                  method: request.method,
                  headers: new Headers(request.headers),
                });
                refreshedRequest.headers.set('Cookie', cookieValue);
                const refreshedCapabilities = await buildCapabilities(auth, refreshedRequest, {
                  rbac,
                  apiPrefix: routePrefix,
                });

                // Attach refresh headers so the adapter can set the new cookie
                if ('user' in refreshedCapabilities) {
                  (refreshedCapabilities as any).__refreshHeaders = sessionHeaders;
                }
                return refreshedCapabilities;
              }
            }
          }
        } catch {
          // Refresh failed — return original unauthenticated capabilities
        }
      }

      return capabilities;
    } catch (error) {
      return handleError(error, 'Error getting auth capabilities');
    }
  },
});

/**
 * Extract a full cookie string from session headers (e.g. Set-Cookie → Cookie).
 */
function extractCookieFromHeaders(headers: Record<string, string>): string | null {
  const setCookie = headers['Set-Cookie'] || headers['set-cookie'];
  if (!setCookie) return null;
  // Set-Cookie value is "name=value; Path=/; ..." — extract "name=value"
  const match = setCookie.match(/^([^;]+)/);
  return match ? (match[1] ?? null) : null;
}

// ============================================================================
// GET /auth/me
// ============================================================================

export const GET_CURRENT_USER_ROUTE = createPublicRoute({
  method: 'GET',
  path: '/auth/me',
  responseType: 'json',
  responseSchema: currentUserResponseSchema,
  summary: 'Get current user',
  description: 'Returns the currently authenticated user, or null if not authenticated.',
  tags: ['Auth'],
  handler: async ctx => {
    try {
      const { mastra, request } = ctx as any;
      const auth = getAuthProvider(mastra);
      const rbac = getRBACProvider(mastra);

      if (!auth || !implementsInterface<IUserProvider>(auth, 'getCurrentUser')) {
        return null;
      }

      const user = await auth.getCurrentUser(request);
      if (!user) return null;

      // Get roles/permissions from RBAC provider if available
      let roles: string[] | undefined;
      let permissions: string[] | undefined;

      if (rbac) {
        try {
          roles = await rbac.getRoles(user);
          permissions = await rbac.getPermissions(user);
        } catch {
          // RBAC not available or failed
        }
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        roles,
        permissions,
      };
    } catch (error) {
      return handleError(error, 'Error getting current user');
    }
  },
});

// ============================================================================
// GET /auth/sso/login
// ============================================================================

export const GET_SSO_LOGIN_ROUTE = createPublicRoute({
  method: 'GET',
  path: '/auth/sso/login',
  responseType: 'datastream-response',
  queryParamSchema: ssoLoginQuerySchema,
  summary: 'Initiate SSO login',
  description: 'Returns the SSO login URL and sets PKCE cookies if needed.',
  tags: ['Auth'],
  handler: async ctx => {
    try {
      const { mastra, redirect_uri, request, routePrefix } = ctx as any;
      const auth = getAuthProvider(mastra);

      if (!auth || !implementsInterface<ISSOProvider>(auth, 'getLoginUrl')) {
        throw new HTTPException(404, { message: 'SSO not configured' });
      }

      // Build OAuth callback URI using the configured route prefix
      const origin = getPublicOrigin(request);
      const raw = ((routePrefix as string) || '/api').trim();
      const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
      const prefix = withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
      const oauthCallbackUri = `${origin}${prefix}/auth/sso/callback`;

      // Encode the post-login redirect in state (where user goes after auth completes)
      // State format: uuid|postLoginRedirect
      // Validate redirect_uri to prevent open-redirect attacks: allow relative paths,
      // same-origin URLs, and localhost URLs (for dev setups where Studio runs on a
      // different port).
      let postLoginRedirect = '/';
      if (redirect_uri) {
        if (!redirect_uri.startsWith('http')) {
          // Relative path — always safe
          postLoginRedirect = redirect_uri;
        } else {
          try {
            const redirectUrl = new URL(redirect_uri);
            const requestOrigin = new URL(origin);
            const isHttps = redirectUrl.protocol === 'http:' || redirectUrl.protocol === 'https:';
            const isSameOrigin = redirectUrl.origin === requestOrigin.origin;
            const isLocalhost =
              redirectUrl.hostname === 'localhost' ||
              redirectUrl.hostname === '127.0.0.1' ||
              redirectUrl.hostname === '[::1]';
            if (isHttps && (isSameOrigin || isLocalhost)) {
              postLoginRedirect = redirect_uri;
            }
          } catch {
            // Malformed URL — fall back to /
          }
        }
      }
      const stateId = crypto.randomUUID();
      const state = `${stateId}|${encodeURIComponent(postLoginRedirect)}`;

      const loginUrl = auth.getLoginUrl(oauthCallbackUri, state);

      // Build response with optional PKCE cookies
      const headers = new Headers({ 'Content-Type': 'application/json' });

      // Check for PKCE cookies (e.g., MastraCloudAuthProvider)
      if (implementsInterface<ISSOProvider>(auth, 'getLoginCookies') && auth.getLoginCookies) {
        const cookies = auth.getLoginCookies(oauthCallbackUri, state);
        if (cookies?.length) {
          // PKCE cookies set for SSO state management
          for (const cookie of cookies) {
            headers.append('Set-Cookie', cookie);
          }
        }
      }

      return new Response(JSON.stringify({ url: loginUrl }), { status: 200, headers });
    } catch (error) {
      return handleError(error, 'Error initiating SSO login');
    }
  },
});

// ============================================================================
// GET /auth/sso/callback
// ============================================================================

export const GET_SSO_CALLBACK_ROUTE = createPublicRoute({
  method: 'GET',
  path: '/auth/sso/callback',
  responseType: 'datastream-response',
  queryParamSchema: ssoCallbackQuerySchema,
  summary: 'Handle SSO callback',
  description: 'Handles the OAuth callback, exchanges code for session, and redirects to the app.',
  tags: ['Auth'],
  handler: async ctx => {
    const { mastra, code, state, request } = ctx as any;

    // Build base URL for redirects (Response.redirect requires absolute URL)
    const baseUrl = getPublicOrigin(request);

    // Extract post-login redirect from state (format: uuid|encodedRedirect)
    let redirectTo = '/';
    let stateId = state || '';
    if (state && state.includes('|')) {
      const [id, encodedRedirect] = state.split('|', 2);
      stateId = id;
      try {
        redirectTo = decodeURIComponent(encodedRedirect);
      } catch {
        redirectTo = '/';
      }
    }

    // Build absolute redirect URL.
    // The redirect_uri was validated at the login endpoint (same-origin or localhost
    // only), so the state should only contain safe URLs. We still apply defense-in-depth
    // checks here: allow http(s) same-origin or localhost, reject everything else.
    let absoluteRedirect: string;
    if (redirectTo.startsWith('http')) {
      try {
        const parsed = new URL(redirectTo);
        const baseOrigin = new URL(baseUrl);
        const isHttps = parsed.protocol === 'http:' || parsed.protocol === 'https:';
        const isSameOrigin = parsed.origin === baseOrigin.origin;
        const isLocalhost =
          parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
        absoluteRedirect = isHttps && (isSameOrigin || isLocalhost) ? redirectTo : `${baseUrl}/`;
      } catch {
        absoluteRedirect = `${baseUrl}/`;
      }
    } else {
      absoluteRedirect = `${baseUrl}${redirectTo}`;
    }

    try {
      const auth = getAuthProvider(mastra);

      if (!auth || !implementsInterface<ISSOProvider>(auth, 'handleCallback')) {
        return Response.redirect(`${absoluteRedirect}?error=sso_not_configured`, 302);
      }

      // Pass cookie header to provider for PKCE validation (if supported)
      const reqCookieHeader = request.headers.get('cookie');
      if (typeof (auth as any).setCallbackCookieHeader === 'function') {
        (auth as any).setCallbackCookieHeader(reqCookieHeader);
      }

      const result = (await auth.handleCallback(code, stateId)) as SSOCallbackResult<EEUser>;
      const user = result.user as EEUser;

      // Build response headers (session cookies, etc.)
      const headers = new Headers();
      headers.set('Location', absoluteRedirect);

      // Set session cookies from the SSO result
      if (result.cookies?.length) {
        for (const cookie of result.cookies) {
          headers.append('Set-Cookie', cookie);
        }
      } else if (implementsInterface<ISessionProvider>(auth, 'createSession') && result.tokens) {
        // Fallback: Create session manually for providers without cookie support
        const session = await auth.createSession(user.id, {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresAt: result.tokens.expiresAt,
          organizationId: (user as any).organizationId,
        });
        const sessionHeaders = auth.getSessionHeaders(session);
        for (const [key, value] of Object.entries(sessionHeaders)) {
          headers.append(key, value);
        }
      }

      return new Response(null, {
        status: 302,
        headers,
      });
    } catch (error) {
      // Redirect with error (use absolute URL)
      const errorMessage = encodeURIComponent(error instanceof Error ? error.message : 'Unknown error');
      return Response.redirect(`${absoluteRedirect}?error=${errorMessage}`, 302);
    }
  },
});

// ============================================================================
// POST /auth/logout
// ============================================================================

export const POST_LOGOUT_ROUTE = createPublicRoute({
  method: 'POST',
  path: '/auth/logout',
  responseType: 'datastream-response',
  summary: 'Logout',
  description: 'Destroys the current session and returns logout redirect URL if available.',
  tags: ['Auth'],
  handler: async ctx => {
    const { mastra, request } = ctx as any;

    try {
      const auth = getAuthProvider(mastra);

      if (!auth) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get session ID and destroy it
      if (implementsInterface<ISessionProvider>(auth, 'getSessionIdFromRequest')) {
        const sessionId = auth.getSessionIdFromRequest(request);
        if (sessionId && implementsInterface<ISessionProvider>(auth, 'destroySession')) {
          await auth.destroySession(sessionId);
        }
      }

      // Get logout URL if available
      let redirectTo: string | undefined;
      if (implementsInterface<ISSOProvider>(auth, 'getLogoutUrl') && auth.getLogoutUrl) {
        // Use public origin (respects X-Forwarded-Host behind reverse proxy)
        const origin = getPublicOrigin(request);
        const logoutUrl = await auth.getLogoutUrl(origin, request);
        redirectTo = logoutUrl ?? undefined;
      }

      // Build response with session clearing headers
      const headers = new Headers({ 'Content-Type': 'application/json' });

      // Clear session cookie
      if (implementsInterface<ISessionProvider>(auth, 'getClearSessionHeaders')) {
        const clearHeaders = auth.getClearSessionHeaders();
        for (const [key, value] of Object.entries(clearHeaders)) {
          headers.append(key, value);
        }
      }

      return new Response(JSON.stringify({ success: true, redirectTo }), {
        status: 200,
        headers,
      });
    } catch (error) {
      return handleError(error, 'Error logging out');
    }
  },
});

// ============================================================================
// POST /auth/refresh
// ============================================================================

export const POST_REFRESH_ROUTE = createPublicRoute({
  method: 'POST',
  path: '/auth/refresh',
  responseType: 'datastream-response',
  responseSchema: refreshResponseSchema,
  summary: 'Refresh session',
  description: 'Refreshes the current session, extending its expiry. Sets a new session cookie on success.',
  tags: ['Auth'],
  handler: async ctx => {
    const { mastra, request } = ctx as any;

    try {
      const auth = getAuthProvider(mastra);

      if (
        !auth ||
        !implementsInterface<ISessionProvider>(auth, 'refreshSession') ||
        !implementsInterface<ISessionProvider>(auth, 'getSessionIdFromRequest')
      ) {
        throw new HTTPException(404, { message: 'Session refresh not configured' });
      }

      // Get session ID from request
      const sessionId = auth.getSessionIdFromRequest(request);
      if (!sessionId) {
        throw new HTTPException(401, { message: 'No session' });
      }

      // Refresh the session
      const newSession = await auth.refreshSession(sessionId);
      if (!newSession) {
        throw new HTTPException(401, { message: 'Session expired' });
      }

      // Build response with new session headers
      const headers = new Headers({ 'Content-Type': 'application/json' });
      if (implementsInterface<ISessionProvider>(auth, 'getSessionHeaders')) {
        const sessionHeaders = auth.getSessionHeaders(newSession);
        for (const [key, value] of Object.entries(sessionHeaders)) {
          headers.append(key, value);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers,
      });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      return handleError(error, 'Error refreshing session');
    }
  },
});

// ============================================================================
// POST /auth/credentials/sign-in
// ============================================================================

export const POST_CREDENTIALS_SIGN_IN_ROUTE = createPublicRoute({
  method: 'POST',
  path: '/auth/credentials/sign-in',
  responseType: 'datastream-response',
  bodySchema: credentialsSignInBodySchema,
  summary: 'Sign in with credentials',
  description: 'Authenticates a user with email and password.',
  tags: ['Auth'],
  handler: async ctx => {
    const { mastra, request, email, password } = ctx as any;

    try {
      const auth = getAuthProvider(mastra);

      if (!auth || !implementsInterface<ICredentialsProvider>(auth, 'signIn')) {
        throw new HTTPException(404, { message: 'Credentials authentication not configured' });
      }

      const result = await auth.signIn(email, password, request);
      const user = result.user as EEUser;

      const responseBody = JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        token: result.token,
      });

      // Build response headers, including cookies from the auth provider
      const headers = new Headers({
        'Content-Type': 'application/json',
      });

      // Forward session cookies from the auth provider
      if (result.cookies?.length) {
        for (const cookie of result.cookies) {
          headers.append('Set-Cookie', cookie);
        }
      }

      return new Response(responseBody, { status: 200, headers });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      // Return a generic error for auth failures to avoid leaking info
      throw new HTTPException(401, { message: 'Invalid email or password' });
    }
  },
});

// ============================================================================
// POST /auth/credentials/sign-up
// ============================================================================

export const POST_CREDENTIALS_SIGN_UP_ROUTE = createPublicRoute({
  method: 'POST',
  path: '/auth/credentials/sign-up',
  responseType: 'datastream-response',
  bodySchema: credentialsSignUpBodySchema,
  summary: 'Sign up with credentials',
  description: 'Creates a new user account with email and password.',
  tags: ['Auth'],
  handler: async ctx => {
    const { mastra, request, email, password, name } = ctx as any;

    try {
      const auth = getAuthProvider(mastra);

      if (!auth || !implementsInterface<ICredentialsProvider>(auth, 'signUp')) {
        throw new HTTPException(404, { message: 'Credentials authentication not configured' });
      }

      const result = await auth.signUp(email, password, name, request);
      const user = result.user as EEUser;

      const responseBody = JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        token: result.token,
      });

      // Build response headers, including cookies from the auth provider
      const headers = new Headers({
        'Content-Type': 'application/json',
      });

      // Forward session cookies from the auth provider
      if (result.cookies?.length) {
        for (const cookie of result.cookies) {
          headers.append('Set-Cookie', cookie);
        }
      }

      return new Response(responseBody, { status: 200, headers });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      const mastra = (ctx as any).mastra;
      mastra?.getLogger?.()?.error('Sign-up error', {
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      });
      throw new HTTPException(400, { message: 'Failed to create account' });
    }
  },
});

// ============================================================================
// GET /auth/roles/:roleId/permissions
// ============================================================================

const rolePermissionsPathSchema = z.object({ roleId: z.string() });
const rolePermissionsResponseSchema = z.object({ roleId: z.string(), permissions: z.array(z.string()) });

export const GET_ROLE_PERMISSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/auth/roles/:roleId/permissions',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: rolePermissionsPathSchema,
  responseSchema: rolePermissionsResponseSchema,
  summary: 'Get permissions for a role',
  description:
    'Returns the resolved permissions for a specific role. Only accessible by admin users. Used by the "View as role" feature.',
  tags: ['Auth'],
  handler: async ctx => {
    try {
      const { mastra, requestContext, roleId } = ctx as any;

      // Check that the caller is an admin
      const callerPermissions: string[] = requestContext?.get(MASTRA_USER_PERMISSIONS_KEY) ?? [];
      const isAdmin = callerPermissions.some((p: string) => p === '*' || p === '*:*');
      if (!isAdmin) {
        throw new HTTPException(403, { message: 'Admin access required' });
      }

      const rbac = getRBACProvider(mastra);
      if (!rbac?.getPermissionsForRole) {
        throw new HTTPException(404, { message: 'RBAC provider does not support role permission resolution' });
      }

      const permissions = await rbac.getPermissionsForRole(roleId);
      return { roleId, permissions };
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      return handleError(error, 'Error getting role permissions');
    }
  },
});

// ============================================================================
// Export all auth routes
// ============================================================================

export const AUTH_ROUTES = [
  GET_AUTH_CAPABILITIES_ROUTE,
  GET_CURRENT_USER_ROUTE,
  GET_SSO_LOGIN_ROUTE,
  GET_SSO_CALLBACK_ROUTE,
  POST_LOGOUT_ROUTE,
  POST_REFRESH_ROUTE,
  POST_CREDENTIALS_SIGN_IN_ROUTE,
  POST_CREDENTIALS_SIGN_UP_ROUTE,
  GET_ROLE_PERMISSIONS_ROUTE,
] as const;
