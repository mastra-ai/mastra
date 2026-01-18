/**
 * WorkOS session provider implementation using WorkOS AuthKit.
 *
 * Implements the ISessionProvider interface for encrypted cookie-based sessions.
 * Sessions are managed via WorkOS AuthKit and stored in encrypted cookies.
 *
 * @module auth-workos/session
 */

import type { ISessionProvider, Session } from '@mastra/core/ee';
import type { AuthService, AuthKitConfig } from '@workos/authkit-session';

/**
 * WorkOS session provider using AuthKit encrypted cookie sessions.
 *
 * Sessions are stored entirely in encrypted cookies, so they:
 * - Persist across server restarts
 * - Require no server-side session storage
 * - Are automatically validated and refreshed by AuthKit
 *
 * The actual session management is handled by WorkOS AuthKit's AuthService.
 * This provider implements the ISessionProvider interface for compatibility.
 *
 * @example
 * ```typescript
 * const sessionProvider = new WorkOSSessionProvider(authService, config);
 * const session = await sessionProvider.createSession('user-123');
 * const headers = sessionProvider.getSessionHeaders(session);
 * // headers contains Set-Cookie header with encrypted session
 * ```
 */
export class WorkOSSessionProvider implements ISessionProvider<Session> {
  constructor(
    private authService: AuthService<Request, Response>,
    private config: AuthKitConfig,
  ) {}

  /**
   * Create a new session for a user.
   *
   * Note: With AuthKit, sessions are typically created via handleCallback.
   * This method creates a basic session structure for compatibility.
   *
   * @param userId - User ID to create session for
   * @param metadata - Optional session metadata
   * @returns Created session object
   */
  async createSession(userId: string, metadata?: Record<string, unknown>): Promise<Session> {
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.cookieMaxAge * 1000);

    return {
      id: sessionId,
      userId,
      createdAt: now,
      expiresAt,
      metadata,
    };
  }

  /**
   * Validate a session and return it if valid.
   *
   * Note: With AuthKit, session validation is handled via withAuth().
   * This method is kept for interface compatibility.
   *
   * @param sessionId - Session ID to validate
   * @returns Session object or null if invalid
   */
  async validateSession(sessionId: string): Promise<Session | null> {
    // AuthKit handles validation internally via withAuth()
    // The encrypted cookie contains all session data
    // This method cannot be fully implemented without the request context
    return null;
  }

  /**
   * Destroy a session (logout).
   *
   * With AuthKit, session destruction is handled via signOut().
   * The actual cookie clearing happens via getClearSessionHeaders().
   *
   * @param sessionId - Session ID to destroy
   */
  async destroySession(sessionId: string): Promise<void> {
    // AuthKit handles session clearing via signOut()
    // The actual cookie clearing happens in the response headers
    // This is a no-op since we can't modify cookies without response context
  }

  /**
   * Refresh a session, extending its expiry.
   *
   * Note: AuthKit handles refresh automatically in withAuth().
   * This method is kept for interface compatibility.
   *
   * @param sessionId - Session ID to refresh
   * @returns Updated session or null if invalid
   */
  async refreshSession(sessionId: string): Promise<Session | null> {
    // AuthKit handles refresh automatically when calling withAuth()
    // The refreshed session data is returned via the response
    return null;
  }

  /**
   * Extract session ID from an incoming request.
   *
   * Note: With AuthKit, sessions are encrypted and the ID is not exposed.
   * Use withAuth() to validate and access session data.
   *
   * @param request - Incoming HTTP request
   * @returns Session ID or null (always null with AuthKit)
   */
  getSessionIdFromRequest(request: Request): string | null {
    // With AuthKit, the session ID is not exposed directly
    // The session is managed via encrypted cookies
    // Use authService.withAuth(request) to access session data
    return null;
  }

  /**
   * Create response headers to set session cookie.
   *
   * @param session - Session to encode in headers
   * @returns Headers object with Set-Cookie header
   */
  getSessionHeaders(session: Session): Record<string, string> {
    // Check if session has attached cookie from handleCallback
    const sessionCookie = (session as any)._sessionCookie;
    if (sessionCookie) {
      return {
        'Set-Cookie': Array.isArray(sessionCookie) ? sessionCookie[0] : sessionCookie,
      };
    }

    // For manual session creation, we can't generate the encrypted cookie
    // without going through AuthKit's session creation flow
    // Return empty headers - caller should use handleCallback for SSO
    return {};
  }

  /**
   * Create response headers to clear session (for logout).
   *
   * @returns Headers object with cookie clearing directive
   */
  getClearSessionHeaders(): Record<string, string> {
    const cookieParts = [`${this.config.cookieName}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];

    if (this.config.cookieDomain) {
      cookieParts.push(`Domain=${this.config.cookieDomain}`);
    }

    return {
      'Set-Cookie': cookieParts.join('; '),
    };
  }
}
