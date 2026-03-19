/**
 * Session lifecycle functions.
 * Handles token verification, session validation, and logout.
 *
 * @internal This module is not exported from the main package.
 */

import { AuthError } from '../error';
import { fetchWithRetry } from '../oauth/network';
import type { CloudSession, VerifyResponse } from '../types';

/**
 * Options for verifyToken.
 */
export interface VerifyTokenOptions {
  projectId: string;
  cloudBaseUrl: string;
  token: string;
}

/**
 * Options for validateSession and destroySession.
 */
export interface SessionOptions {
  projectId: string;
  cloudBaseUrl: string;
  sessionToken: string;
}

/**
 * Verify an access token with Cloud API.
 *
 * @param options - Verification options
 * @returns User and role information
 * @throws AuthError with code 'verification_failed' if verification fails
 * @throws AuthError with code 'network_error' if network request fails
 */
export async function verifyToken(options: VerifyTokenOptions): Promise<VerifyResponse> {
  const { projectId, cloudBaseUrl, token } = options;

  const response = await fetchWithRetry(`${cloudBaseUrl}/auth/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Project-ID': projectId,
    },
  });

  if (!response.ok) {
    throw AuthError.verificationFailed();
  }

  // Cloud returns different shapes for user tokens vs project API tokens:
  // User token: { sub, email, name?, avatar_url?, role }
  // Project API token: { valid: true, role: "api", token_type: "project_api_token" }
  const body = (await response.json()) as {
    // User token fields
    sub?: string;
    email?: string;
    name?: string;
    avatar_url?: string;
    role: string;
    // Project API token fields
    valid?: boolean;
    token_type?: string;
  };

  // Project API token - no user info, just role
  if (body.token_type === 'project_api_token') {
    return {
      user: {
        id: 'api-token',
        email: undefined,
        name: undefined,
        avatar: undefined,
      },
      role: body.role,
    };
  }

  // User token - full user info
  return {
    user: {
      id: body.sub!,
      email: body.email!,
      name: body.name,
      avatar: body.avatar_url,
    },
    role: body.role,
  };
}

/**
 * Validate an existing session with Cloud API.
 *
 * @param options - Session options
 * @returns Session data if valid, null otherwise
 */
export async function validateSession(options: SessionOptions): Promise<CloudSession | null> {
  const { projectId, cloudBaseUrl, sessionToken } = options;

  try {
    const response = await fetchWithRetry(`${cloudBaseUrl}/auth/session/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
        'X-Project-ID': projectId,
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as CloudSession;
  } catch {
    // Any error (network, parsing) returns null
    return null;
  }
}

/**
 * Destroy a session with Cloud API.
 * Note: X-Project-ID not required for this endpoint.
 *
 * @param options - Session options
 */
export async function destroySession(options: SessionOptions): Promise<void> {
  const { cloudBaseUrl, sessionToken } = options;

  await fetchWithRetry(`${cloudBaseUrl}/auth/session/destroy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  // Ignore response - void return per spec
}

/**
 * Get the logout URL for redirecting users.
 *
 * @param cloudBaseUrl - Cloud API base URL
 * @param postLogoutRedirectUri - URL to redirect to after logout (required)
 * @param idTokenHint - The access token (required by Cloud)
 * @returns Full logout URL with redirect and token parameters
 */
export function getLogoutUrl(cloudBaseUrl: string, postLogoutRedirectUri: string, idTokenHint: string): string {
  const url = new URL('/auth/logout', cloudBaseUrl);
  url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
  url.searchParams.set('id_token_hint', idTokenHint);
  return url.toString();
}
