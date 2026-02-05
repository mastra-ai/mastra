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
  console.log('[auth-cloud] parsePKCECookie called, cookieHeader:', cookieHeader?.slice(0, 100));

  if (!cookieHeader) {
    console.log('[auth-cloud] parsePKCECookie: no cookie header');
    throw PKCEError.missingVerifier();
  }

  const match = cookieHeader.match(new RegExp(`${PKCE_COOKIE_NAME}=([^;]+)`));
  console.log('[auth-cloud] parsePKCECookie: looking for', PKCE_COOKIE_NAME, 'found:', !!match?.[1]);

  if (!match?.[1]) {
    console.log('[auth-cloud] parsePKCECookie: cookie not found in header');
    throw PKCEError.missingVerifier();
  }

  let data: PKCECookieData;
  try {
    data = JSON.parse(decodeURIComponent(match[1])) as PKCECookieData;
    console.log('[auth-cloud] parsePKCECookie: parsed data', { hasVerifier: !!data.verifier, hasState: !!data.state, expiresAt: data.expiresAt });
  } catch (e) {
    console.log('[auth-cloud] parsePKCECookie: JSON parse failed', e);
    throw PKCEError.invalid(e instanceof Error ? e : undefined);
  }

  if (data.expiresAt < Date.now()) {
    console.log('[auth-cloud] parsePKCECookie: cookie expired', { expiresAt: data.expiresAt, now: Date.now() });
    throw PKCEError.expired();
  }

  console.log('[auth-cloud] parsePKCECookie: success');
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
