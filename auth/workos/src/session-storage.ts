/**
 * Hono/Web Request session storage adapter for WorkOS AuthKit.
 *
 * Implements the SessionStorage interface for standard Web Request/Response
 * objects used by Hono and other modern frameworks.
 */

import { CookieSessionStorage } from '@workos/authkit-session';
import type { AuthKitConfig } from '@workos/authkit-session';

/**
 * Session storage adapter for Web Request/Response (used by Hono).
 *
 * Extracts session cookies from standard Request objects and
 * builds Set-Cookie headers for Response objects.
 */
export class WebSessionStorage extends CookieSessionStorage<Request, Response> {
  constructor(config: AuthKitConfig) {
    super(config);
  }

  /**
   * Extract the encrypted session cookie from a Request.
   *
   * @param request - Standard Web Request object
   * @returns The encrypted session string or null if not present
   */
  async getSession(request: Request): Promise<string | null> {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
      return null;
    }

    // Parse cookies
    const cookies = cookieHeader.split(';').reduce(
      (acc, cookie) => {
        const [name, ...valueParts] = cookie.trim().split('=');
        if (name) {
          // Rejoin in case value contains '='
          acc[name] = decodeURIComponent(valueParts.join('='));
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    return cookies[this.cookieName] || null;
  }
}
