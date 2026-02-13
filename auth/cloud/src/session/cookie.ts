/**
 * Session cookie utilities.
 * Handles setting, parsing, and clearing of session cookies.
 *
 * @internal This module is not exported from the main package.
 */

/**
 * Cookie name for session token storage.
 */
export const SESSION_COOKIE_NAME = 'mastra_cloud_session';

/**
 * Create a Set-Cookie header value for storing session token.
 *
 * @param token - The session token
 * @param isProduction - Whether to add Secure flag (required for HTTPS)
 * @returns Set-Cookie header value
 */
export function setSessionCookie(token: string, isProduction: boolean): string {
  const ttlSeconds = 24 * 60 * 60; // 24 hours

  let cookie = `${SESSION_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${ttlSeconds}`;

  if (isProduction) {
    cookie += '; Secure';
  }

  return cookie;
}

/**
 * Parse the session token from a Cookie header.
 *
 * @param cookieHeader - The Cookie header value (may be null)
 * @returns Session token or null if not present
 */
export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match?.[1] ?? null;
}

/**
 * Create a Set-Cookie header value to clear the session cookie.
 *
 * @returns Set-Cookie header value that expires the cookie
 */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
