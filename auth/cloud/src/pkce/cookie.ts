/**
 * PKCE cookie storage utilities.
 * Handles serialization, parsing, and clearing of PKCE verifier cookies.
 *
 * @internal This module is not exported from the main package.
 */

import { PKCEError } from './error';

/**
 * Cookie name for PKCE verifier storage.
 */
export const PKCE_COOKIE_NAME = 'mastra_pkce_verifier';

/**
 * Data stored in the PKCE cookie.
 */
export interface PKCECookieData {
  verifier: string;
  state: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Create a Set-Cookie header value for storing PKCE verifier and state.
 *
 * @param verifier - The code verifier for PKCE
 * @param state - The state parameter for CSRF protection
 * @param isProduction - Whether to add Secure flag (required for HTTPS)
 * @returns Set-Cookie header value
 */
export function setPKCECookie(verifier: string, state: string, isProduction: boolean): string {
  const ttlSeconds = 5 * 60; // 5 minutes
  const data: PKCECookieData = {
    verifier,
    state,
    expiresAt: Date.now() + ttlSeconds * 1000,
  };

  const encoded = encodeURIComponent(JSON.stringify(data));

  let cookie = `${PKCE_COOKIE_NAME}=${encoded}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${ttlSeconds}`;

  if (isProduction) {
    cookie += '; Secure';
  }

  return cookie;
}

/**
 * Parse the PKCE cookie from a Cookie header.
 *
 * @param cookieHeader - The Cookie header value (may be null)
 * @returns Parsed cookie data
 * @throws PKCEError if cookie is missing, expired, or malformed
 */
export function parsePKCECookie(cookieHeader: string | null): PKCECookieData {
  if (!cookieHeader) {
    throw PKCEError.missingVerifier();
  }

  const match = cookieHeader.match(new RegExp(`${PKCE_COOKIE_NAME}=([^;]+)`));

  if (!match?.[1]) {
    throw PKCEError.missingVerifier();
  }

  let data: PKCECookieData;
  try {
    data = JSON.parse(decodeURIComponent(match[1])) as PKCECookieData;
  } catch (e) {
    throw PKCEError.invalid(e instanceof Error ? e : undefined);
  }

  if (data.expiresAt < Date.now()) {
    throw PKCEError.expired();
  }

  return data;
}

/**
 * Create a Set-Cookie header value to clear the PKCE cookie.
 *
 * @returns Set-Cookie header value that expires the cookie
 */
export function clearPKCECookie(): string {
  return `${PKCE_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
