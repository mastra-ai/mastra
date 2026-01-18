/**
 * Auth handlers for EE authentication capabilities.
 *
 * These routes enable Studio to:
 * - Detect available auth capabilities
 * - Initiate SSO login flows
 * - Handle OAuth callbacks
 * - Manage credentials login/signup
 * - Handle logout
 *
 * NOTE: These handlers require access to the raw Request object for proper
 * cookie and header handling. This will be added when the auth provider is
 * integrated into the Mastra server configuration.
 */

import type { MastraAuthProvider, EEUser } from '@mastra/core/ee';
import { buildPublicCapabilities } from '@mastra/core/ee';

import { HTTPException } from '../http-exception';
import {
  capabilitiesResponseSchema,
  ssoLoginQuerySchema,
  ssoCallbackQuerySchema,
  ssoLoginResponseSchema,
  logoutResponseSchema,
  currentUserResponseSchema,
  credentialsSignInBodySchema,
  credentialsSignUpBodySchema,
} from '../schemas/auth';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';

/**
 * Helper to get auth provider from Mastra instance.
 * This function will need to be updated once auth provider is integrated into Mastra config.
 *
 * @param mastra - Mastra instance
 * @returns Auth provider or null if not configured
 */
function getAuthProvider(mastra: any): MastraAuthProvider<EEUser> | null {
  // TODO: Once auth is integrated into Mastra config, access it properly
  // For now, return null to indicate auth is not configured
  // This should become: return mastra.getAuthProvider?.() ?? null;
  return null;
}

/**
 * Validates a redirect URL to prevent open redirect attacks.
 * Only allows same-origin paths (starting with '/').
 * Rejects URLs with protocols or external hosts.
 *
 * @param url - URL to validate
 * @returns Validated path or '/' if invalid
 */
function validateRedirectUrl(url: string): string {
  // Default to '/' for safety
  if (!url || typeof url !== 'string') {
    return '/';
  }

  // Trim whitespace
  url = url.trim();

  // Must start with '/' to be a same-origin path
  if (!url.startsWith('/')) {
    return '/';
  }

  // Reject protocol-relative URLs (//example.com)
  if (url.startsWith('//')) {
    return '/';
  }

  // Reject URLs with protocols (http://, https://, javascript:, data:, etc.)
  if (url.includes(':')) {
    return '/';
  }

  // Valid same-origin path
  return url;
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
  handler: async ({ mastra }) => {
    try {
      const authProvider = getAuthProvider(mastra);

      // If no auth provider, return disabled state
      if (!authProvider) {
        return {
          enabled: false,
          login: null,
        } as const;
      }

      // TODO: Once Request object is available in handler context, use buildCapabilities
      // For now, return only public capabilities
      // const capabilities = await buildCapabilities(authProvider, request);
      const capabilities = buildPublicCapabilities(authProvider);

      return capabilities as any;
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
  handler: async ({ mastra }) => {
    try {
      const authProvider = getAuthProvider(mastra);

      if (!authProvider?.user) {
        return null;
      }

      // TODO: Once Request object is available, get current user
      // const user = await authProvider.user.getCurrentUser(request);
      // For now, return null as we can't authenticate without request
      return null;
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
  handler: async ({ mastra, redirect_uri }) => {
    try {
      const authProvider = getAuthProvider(mastra);

      if (!authProvider?.sso) {
        throw new HTTPException(404, { message: 'SSO not configured' });
      }

      // TODO: Get request URL from Request object once available
      // For now, use a placeholder - this needs the actual request origin
      const origin = process.env.PUBLIC_URL || 'http://localhost:4111';
      const oauthCallbackUri = `${origin}/api/auth/sso/callback`;

      // Encode the post-login redirect in state (where user goes after auth completes)
      // State format: uuid|postLoginRedirect
      const stateId = crypto.randomUUID();
      const postLoginRedirect = redirect_uri || '/';
      const state = `${stateId}|${encodeURIComponent(postLoginRedirect)}`;

      const loginUrl = authProvider.sso.getLoginUrl(oauthCallbackUri, state);

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
  handler: async ({ mastra, code, state }) => {
    // Extract post-login redirect from state (format: uuid|encodedRedirect)
    let redirectTo = '/';
    let stateId = state || '';
    if (state && state.includes('|')) {
      const [id, encodedRedirect] = state.split('|', 2);
      stateId = id!;
      try {
        const decodedRedirect = decodeURIComponent(encodedRedirect!);
        // Validate redirect to prevent open redirect attacks
        redirectTo = validateRedirectUrl(decodedRedirect);
      } catch {
        redirectTo = '/';
      }
    }

    try {
      const authProvider = getAuthProvider(mastra);

      if (!authProvider?.sso) {
        return Response.redirect(redirectTo + '?error=sso_not_configured', 302);
      }

      const result = await authProvider.sso.handleCallback(code, stateId);

      // Build response headers (session cookies, etc.)
      const headers = new Headers();
      headers.set('Location', redirectTo);

      // Set session cookies from the SSO result
      if (result.cookies) {
        for (const cookieValue of Object.values(result.cookies)) {
          headers.append('Set-Cookie', cookieValue);
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
  responseSchema: logoutResponseSchema,
  summary: 'Logout',
  description: 'Destroys the current session and returns logout redirect URL if available.',
  tags: ['Auth'],
  handler: async ({ mastra }) => {
    try {
      const authProvider = getAuthProvider(mastra);

      if (!authProvider) {
        // No auth configured, just return success
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get session ID from request and destroy it if session provider is available
      // TODO: Once Request object is available in handler context, use it to get session
      // For now, we'll return the clearing headers regardless
      // const sessionId = authProvider.session?.getSessionIdFromRequest(request);
      // if (sessionId && authProvider.session) {
      //   await authProvider.session.destroySession(sessionId);
      // }

      // Get logout URL if available
      let redirectTo: string | undefined;
      if (authProvider.sso?.getLogoutUrl) {
        redirectTo = authProvider.sso.getLogoutUrl('/');
      }

      // Build response with cookie clearing headers
      const headers = new Headers({
        'Content-Type': 'application/json',
      });

      // Get session clearing headers from the session provider
      if (authProvider.session) {
        const clearHeaders = authProvider.session.getClearSessionHeaders();
        for (const [key, value] of Object.entries(clearHeaders)) {
          headers.append(key, value);
        }
      }

      const responseBody = JSON.stringify({
        success: true,
        redirectTo,
      });

      return new Response(responseBody, {
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
  handler: async ({ mastra, email, password }) => {
    try {
      const authProvider = getAuthProvider(mastra);

      if (!authProvider?.credentials) {
        throw new HTTPException(404, { message: 'Credentials authentication not configured' });
      }

      // TODO: Pass Request object once available
      // For now, pass undefined - credentials providers may not require it
      const result = await authProvider.credentials.signIn(email, password, undefined);
      const user = result.user;

      const responseBody = JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
      });

      // Build response headers, including cookies from the auth provider
      const headers = new Headers({
        'Content-Type': 'application/json',
      });

      // Forward session cookies from the auth provider
      if (result.cookies) {
        for (const cookieValue of Object.values(result.cookies)) {
          headers.append('Set-Cookie', cookieValue);
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
  handler: async ({ mastra, email, password, name }) => {
    try {
      const authProvider = getAuthProvider(mastra);

      if (!authProvider?.credentials) {
        throw new HTTPException(404, { message: 'Credentials authentication not configured' });
      }

      // Check if sign up is enabled
      if (authProvider.credentials.isSignUpEnabled && !authProvider.credentials.isSignUpEnabled()) {
        throw new HTTPException(403, { message: 'Sign up is disabled' });
      }

      // TODO: Pass Request object once available
      const result = await authProvider.credentials.signUp(email, password, name, undefined);
      const user = result.user;

      const responseBody = JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
      });

      // Build response headers, including cookies from the auth provider
      const headers = new Headers({
        'Content-Type': 'application/json',
      });

      // Forward session cookies from the auth provider
      if (result.cookies) {
        for (const cookieValue of Object.values(result.cookies)) {
          headers.append('Set-Cookie', cookieValue);
        }
      }

      return new Response(responseBody, { status: 201, headers });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      // Return generic error to avoid leaking info
      throw new HTTPException(400, { message: 'Failed to create account' });
    }
  },
});
