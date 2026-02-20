/**
 * OAuth authorization flow functions.
 *
 * Implements login URL generation and callback handling for
 * Mastra Cloud authentication with PKCE.
 *
 * @internal This module is not exported from the main package.
 */

import { AuthError } from '../error';
import { setPKCECookie, parsePKCECookie, clearPKCECookie } from '../pkce/cookie';
import { generateCodeVerifier, computeCodeChallenge, generateState } from '../pkce/pkce';
import type { LoginUrlResult, CallbackResult } from '../types';
import { fetchWithRetry } from './network';
import { encodeState, decodeState, validateReturnTo } from './state';

/**
 * Options for generating login URL.
 */
export interface LoginUrlOptions {
  /** Mastra Cloud project ID */
  projectId: string;
  /** Base URL of Mastra Cloud API (e.g., 'https://cloud.mastra.ai') */
  cloudBaseUrl: string;
  /** OAuth callback URL (e.g., 'https://myapp.com/auth/callback') */
  callbackUrl: string;
  /** URL to redirect to after successful login */
  returnTo?: string;
  /** Origin of the current request (e.g., 'https://myapp.com') */
  requestOrigin: string;
  /** Whether running in production (affects cookie Secure flag) */
  isProduction?: boolean;
}

/**
 * Options for handling OAuth callback.
 */
export interface CallbackOptions {
  /** Mastra Cloud project ID */
  projectId: string;
  /** Base URL of Mastra Cloud API */
  cloudBaseUrl: string;
  /** OAuth callback URL (must match what was sent to /auth/oss) */
  redirectUri: string;
  /** Authorization code from OAuth callback */
  code: string;
  /** State parameter from OAuth callback */
  state: string;
  /** Cookie header from request (may be null) */
  cookieHeader: string | null;
}

/**
 * Generate a login URL for Mastra Cloud OAuth flow.
 *
 * Creates a URL with PKCE challenge and state parameter for CSRF protection.
 * Returns a PKCE cookie that must be set on the response.
 *
 * @param options - Login URL options
 * @returns URL to redirect to and cookies to set
 */
export function getLoginUrl(options: LoginUrlOptions): LoginUrlResult {
  const { projectId, cloudBaseUrl, callbackUrl, returnTo, requestOrigin, isProduction } = options;

  // Generate PKCE verifier and challenge
  const verifier = generateCodeVerifier();
  const challenge = computeCodeChallenge(verifier);

  // Generate CSRF token for state
  const csrf = generateState();

  // Validate returnTo to prevent open redirect attacks
  const validatedReturnTo = validateReturnTo(returnTo, requestOrigin);

  // Encode state with CSRF and returnTo
  const state = encodeState(csrf, validatedReturnTo);

  // Build authorization URL
  const url = new URL('/auth/oss', cloudBaseUrl);
  url.searchParams.set('project_id', projectId);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('state', state);

  // Create PKCE cookie (stores verifier and CSRF token)
  const isProductionEnv = isProduction ?? process.env.NODE_ENV === 'production';
  const pkceCookie = setPKCECookie(verifier, csrf, isProductionEnv);

  return {
    url: url.toString(),
    cookies: [pkceCookie],
  };
}

/**
 * Handle OAuth callback from Mastra Cloud.
 *
 * Validates state for CSRF, exchanges code for tokens, and returns user info.
 * Returns a cookie to clear the PKCE state.
 *
 * Note: Session cookie is NOT set here - caller (session module) handles that.
 *
 * @param options - Callback options
 * @returns User info, access token, and redirect URL
 * @throws PKCEError if PKCE cookie is missing or expired
 * @throws AuthError if state validation fails or token exchange fails
 */
export async function handleCallback(options: CallbackOptions): Promise<CallbackResult> {
  const { projectId, cloudBaseUrl, redirectUri, code, state, cookieHeader } = options;

  // Parse PKCE cookie (throws PKCEError if missing/expired)
  const pkceData = parsePKCECookie(cookieHeader);

  // Decode state parameter (throws AuthError if malformed)
  const stateData = decodeState(state);

  // Validate CSRF token matches
  if (stateData.csrf !== pkceData.state) {
    throw AuthError.stateMismatch();
  }

  // Exchange code for tokens
  const response = await fetchWithRetry(`${cloudBaseUrl}/auth/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Project-ID': projectId,
    },
    body: JSON.stringify({
      code,
      redirect_uri: redirectUri,
      code_verifier: pkceData.verifier,
    }),
  });

  // Handle error responses
  if (!response.ok) {
    let cloudCode: string | undefined;
    let cloudMessage: string | undefined;

    try {
      const errorBody = (await response.json()) as { code?: string; message?: string };
      cloudCode = errorBody.code;
      cloudMessage = errorBody.message;
    } catch {
      // Could not parse error body
    }

    throw AuthError.tokenExchangeFailed({ cloudCode, cloudMessage });
  }

  // Parse successful response - Cloud returns token only, no user
  const body = (await response.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number;
  };

  // Get user info from /auth/verify endpoint
  const verifyResponse = await fetchWithRetry(`${cloudBaseUrl}/auth/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${body.access_token}`,
      'X-Project-ID': projectId,
    },
  });

  if (!verifyResponse.ok) {
    throw AuthError.verificationFailed();
  }

  // Cloud returns: { sub, email, name?, avatar_url?, role }
  const verifyBody = (await verifyResponse.json()) as {
    sub: string;
    email: string;
    name?: string;
    avatar_url?: string;
    role: string;
  };

  // Clear PKCE cookie (no longer needed)
  const clearCookie = clearPKCECookie();

  return {
    user: {
      id: verifyBody.sub,
      email: verifyBody.email,
      name: verifyBody.name,
      avatar: verifyBody.avatar_url,
      role: verifyBody.role,
    },
    accessToken: body.access_token,
    returnTo: stateData.returnTo,
    cookies: [clearCookie],
  };
}
