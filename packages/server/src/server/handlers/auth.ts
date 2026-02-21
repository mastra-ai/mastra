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
  IRBACProvider,
  EEUser,
  SSOCallbackResult,
} from '@mastra/core/auth';
import type { MastraAuthProvider } from '@mastra/core/server';

import { HTTPException } from '../http-exception';
import {
  capabilitiesResponseSchema,
  ssoLoginQuerySchema,
  ssoCallbackQuerySchema,
  currentUserResponseSchema,
  credentialsSignInBodySchema,
  credentialsSignUpBodySchema,
} from '../schemas/auth';
import { createPublicRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

type BuildCapabilitiesFn = (auth: any, request: Request, options?: { rbac?: any }) => Promise<any>;
let _buildCapabilitiesPromise: Promise<BuildCapabilitiesFn | undefined> | undefined;
function loadBuildCapabilities(): Promise<BuildCapabilitiesFn | undefined> {
  if (!_buildCapabilitiesPromise) {
    _buildCapabilitiesPromise = import('@mastra/core/auth')
      .then(m => m.buildCapabilities as BuildCapabilitiesFn)
      .catch(() => {
        console.error(
          '[@mastra/server] Auth features require @mastra/core >= 1.6.0. Please upgrade: npm install @mastra/core@latest',
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
 * Behind a proxy (e.g. edge router), request.url contains the internal hostname.
 * X-Forwarded-Host tells us the real public hostname.
 * Always uses https when behind a proxy — Knative's queue-proxy overwrites
 * X-Forwarded-Proto based on the internal HTTP connection, so it's unreliable.
 */
function getPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    return `https://${forwardedHost}`;
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
      const { mastra, request } = ctx as any;
      const auth = getAuthProvider(mastra);
      const rbac = getRBACProvider(mastra);

      const buildCapabilities = await loadBuildCapabilities();
      if (!buildCapabilities) {
        return { enabled: false, login: null };
      }
      const capabilities = await buildCapabilities(auth, request, { rbac });

      return capabilities;
    } catch (error) {
      return handleError(error, 'Error getting auth capabilities');
    }
  },
});

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
      const { mastra, redirect_uri, request } = ctx as any;
      const auth = getAuthProvider(mastra);

      if (!auth || !implementsInterface<ISSOProvider>(auth, 'getLoginUrl')) {
        throw new HTTPException(404, { message: 'SSO not configured' });
      }

      // Build OAuth callback URI (always /api/auth/sso/callback)
      const origin = getPublicOrigin(request);
      const oauthCallbackUri = `${origin}/api/auth/sso/callback`;

      // Encode the post-login redirect in state (where user goes after auth completes)
      // State format: uuid|postLoginRedirect
      const stateId = crypto.randomUUID();
      const postLoginRedirect = redirect_uri || '/';
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

    // Build absolute redirect URL
    const absoluteRedirect = redirectTo.startsWith('http') ? redirectTo : `${baseUrl}${redirectTo}`;

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
      // Extract message from error (handles Better Auth APIError format)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create account';
      throw new HTTPException(400, { message: errorMessage });
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
  POST_CREDENTIALS_SIGN_IN_ROUTE,
  POST_CREDENTIALS_SIGN_UP_ROUTE,
];
