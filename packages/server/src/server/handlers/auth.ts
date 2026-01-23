/**
 * Auth handlers for EE authentication capabilities.
 *
 * These routes enable Studio to:
 * - Detect available auth capabilities
 * - Initiate SSO login flows
 * - Handle OAuth callbacks
 * - Logout users
 */

import { MastraAuthProvider } from '@mastra/core/server';
import {
  buildCapabilities,
  type IUserProvider,
  type ISessionProvider,
  type ISSOProvider,
  type ICredentialsProvider,
  type IRBACProvider,
  type EEUser,
  type SSOCallbackResult,
} from '@mastra/core/ee';

import { HTTPException } from '../http-exception';
import {
  capabilitiesResponseSchema,
  ssoLoginQuerySchema,
  ssoCallbackQuerySchema,
  ssoLoginResponseSchema,
  ssoCallbackResponseSchema,
  logoutResponseSchema,
  currentUserResponseSchema,
  credentialsSignInBodySchema,
  credentialsSignUpBodySchema,
  credentialsResponseSchema,
} from '../schemas/auth';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

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
// GET /api/auth/capabilities
// ============================================================================

export const GET_AUTH_CAPABILITIES_ROUTE = createRoute({
  method: 'GET',
  path: '/api/auth/capabilities',
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

      // Use buildCapabilities from core/ee
      const capabilities = await buildCapabilities(auth, request, { rbac });

      return capabilities;
    } catch (error) {
      return handleError(error, 'Error getting auth capabilities');
    }
  },
});

// ============================================================================
// GET /api/auth/me
// ============================================================================

export const GET_CURRENT_USER_ROUTE = createRoute({
  method: 'GET',
  path: '/api/auth/me',
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
// GET /api/auth/sso/login
// ============================================================================

export const GET_SSO_LOGIN_ROUTE = createRoute({
  method: 'GET',
  path: '/api/auth/sso/login',
  responseType: 'json',
  queryParamSchema: ssoLoginQuerySchema,
  responseSchema: ssoLoginResponseSchema,
  summary: 'Initiate SSO login',
  description: 'Returns the SSO login URL. Client should redirect to this URL to start the auth flow.',
  tags: ['Auth'],
  handler: async ctx => {
    try {
      const { mastra, redirect_uri, request } = ctx as any;
      const auth = getAuthProvider(mastra);

      if (!auth || !implementsInterface<ISSOProvider>(auth, 'getLoginUrl')) {
        throw new HTTPException(404, { message: 'SSO not configured' });
      }

      // Build OAuth callback URI (always /api/auth/sso/callback)
      const requestUrl = new URL(request.url);
      const oauthCallbackUri = `${requestUrl.origin}/api/auth/sso/callback`;

      // Encode the post-login redirect in state (where user goes after auth completes)
      // State format: uuid|postLoginRedirect
      const stateId = crypto.randomUUID();
      const postLoginRedirect = redirect_uri || '/';
      const state = `${stateId}|${encodeURIComponent(postLoginRedirect)}`;

      const loginUrl = auth.getLoginUrl(oauthCallbackUri, state);

      return { url: loginUrl };
    } catch (error) {
      return handleError(error, 'Error initiating SSO login');
    }
  },
});

// ============================================================================
// GET /api/auth/sso/callback
// ============================================================================

export const GET_SSO_CALLBACK_ROUTE = createRoute({
  method: 'GET',
  path: '/api/auth/sso/callback',
  responseType: 'datastream-response',
  queryParamSchema: ssoCallbackQuerySchema,
  summary: 'Handle SSO callback',
  description: 'Handles the OAuth callback, exchanges code for session, and redirects to the app.',
  tags: ['Auth'],
  handler: async ctx => {
    const { mastra, code, state } = ctx as any;

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

    try {
      const auth = getAuthProvider(mastra);

      if (!auth || !implementsInterface<ISSOProvider>(auth, 'handleCallback')) {
        return Response.redirect(redirectTo + '?error=sso_not_configured', 302);
      }

      const result = (await auth.handleCallback(code, stateId)) as SSOCallbackResult<EEUser>;
      const user = result.user as EEUser;

      // Build response headers (session cookies, etc.)
      const headers = new Headers();
      headers.set('Location', redirectTo);

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
      // Redirect with error
      const errorMessage = encodeURIComponent(error instanceof Error ? error.message : 'Unknown error');
      return Response.redirect(redirectTo + `?error=${errorMessage}`, 302);
    }
  },
});

// ============================================================================
// POST /api/auth/logout
// ============================================================================

export const POST_LOGOUT_ROUTE = createRoute({
  method: 'POST',
  path: '/api/auth/logout',
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
        // WorkOS requires absolute URL for redirect_uri and session from request
        const requestUrl = new URL(request.url);
        const logoutUrl = await auth.getLogoutUrl(requestUrl.origin, request);
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
// POST /api/auth/credentials/sign-in
// ============================================================================

export const POST_CREDENTIALS_SIGN_IN_ROUTE = createRoute({
  method: 'POST',
  path: '/api/auth/credentials/sign-in',
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
// POST /api/auth/credentials/sign-up
// ============================================================================

export const POST_CREDENTIALS_SIGN_UP_ROUTE = createRoute({
  method: 'POST',
  path: '/api/auth/credentials/sign-up',
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
