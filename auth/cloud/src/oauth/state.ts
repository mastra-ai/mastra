/**
 * OAuth state parameter encoding/decoding.
 *
 * The state parameter carries:
 * - csrf: CSRF token for validation
 * - returnTo: URL to redirect after successful login
 *
 * @internal This module is not exported from the main package.
 */

import { AuthError } from '../error';

/**
 * Data encoded in the OAuth state parameter.
 */
export interface StateData {
  /** CSRF token for state validation */
  csrf: string;
  /** URL to redirect to after login */
  returnTo: string;
}

/**
 * Encode state data into a base64url string for OAuth state parameter.
 *
 * @param csrf - CSRF token to include
 * @param returnTo - URL to redirect to after login
 * @returns Base64url encoded state string
 */
export function encodeState(csrf: string, returnTo: string): string {
  const data: StateData = { csrf, returnTo };
  const json = JSON.stringify(data);
  return Buffer.from(json).toString('base64url');
}

/**
 * Decode state parameter back to StateData.
 *
 * @param state - Base64url encoded state string
 * @returns Decoded state data
 * @throws AuthError with code 'invalid_state' if decoding fails
 */
export function decodeState(state: string): StateData {
  try {
    const json = Buffer.from(state, 'base64url').toString();
    const data = JSON.parse(json) as StateData;

    // Validate required fields exist
    if (typeof data.csrf !== 'string' || typeof data.returnTo !== 'string') {
      throw new Error('Missing required fields');
    }

    return data;
  } catch {
    throw AuthError.invalidState();
  }
}

/**
 * Validate and sanitize returnTo URL to prevent open redirect attacks.
 *
 * Safe values:
 * - Relative paths starting with '/' (but not '//')
 * - Absolute URLs with same origin as request
 *
 * @param returnTo - URL from user input (may be undefined)
 * @param requestOrigin - Origin of the current request (e.g., 'https://example.com')
 * @returns Safe redirect URL, defaults to '/' if invalid
 */
export function validateReturnTo(returnTo: string | undefined, requestOrigin: string): string {
  // Default to root for empty/undefined values
  if (!returnTo) {
    return '/';
  }

  // Relative paths starting with '/' are safe (but not protocol-relative '//')
  if (returnTo.startsWith('/') && !returnTo.startsWith('//')) {
    return returnTo;
  }

  // For absolute URLs, validate same origin
  try {
    const parsed = new URL(returnTo);
    const origin = new URL(requestOrigin);

    // Same origin check: protocol + host must match
    if (parsed.origin === origin.origin) {
      return returnTo;
    }
  } catch {
    // Invalid URL, fall through to default
  }

  // Default to root for invalid or cross-origin URLs
  return '/';
}
