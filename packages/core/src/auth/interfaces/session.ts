/**
 * Session provider interface for EE authentication.
 * Enables session management in Studio.
 */

/**
 * Session object representing an authenticated session.
 */
export interface Session {
  /** Unique session identifier */
  id: string;
  /** User ID this session belongs to */
  userId: string;
  /** When the session expires */
  expiresAt: Date;
  /** When the session was created */
  createdAt: Date;
  /** Additional session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Provider interface for session management.
 *
 * Implement this interface to enable:
 * - Session creation on login
 * - Session validation on requests
 * - Session destruction on logout
 * - Session refresh for long-lived sessions
 *
 * @example
 * ```typescript
 * class CookieSessionProvider implements ISessionProvider {
 *   async createSession(userId: string) {
 *     const session = {
 *       id: crypto.randomUUID(),
 *       userId,
 *       expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
 *       createdAt: new Date(),
 *     };
 *     await this.store.set(session.id, session);
 *     return session;
 *   }
 *
 *   getSessionHeaders(session: Session) {
 *     return {
 *       'Set-Cookie': `session=${session.id}; HttpOnly; SameSite=Lax; Path=/`,
 *     };
 *   }
 * }
 * ```
 */
export interface ISessionProvider<TSession extends Session = Session> {
  /**
   * Create a new session for a user.
   *
   * @param userId - User to create session for
   * @param metadata - Optional session metadata
   * @returns Created session object
   */
  createSession(userId: string, metadata?: Record<string, unknown>): Promise<TSession>;

  /**
   * Validate a session and return it if valid.
   *
   * @param sessionId - Session ID to validate
   * @returns Session object or null if invalid/expired
   */
  validateSession(sessionId: string): Promise<TSession | null>;

  /**
   * Destroy a session (logout).
   *
   * @param sessionId - Session ID to destroy
   */
  destroySession(sessionId: string): Promise<void>;

  /**
   * Refresh a session, extending its expiry.
   *
   * @param sessionId - Session ID to refresh
   * @returns Updated session or null if invalid
   */
  refreshSession(sessionId: string): Promise<TSession | null>;

  /**
   * Extract session ID from an incoming request.
   *
   * @param request - Incoming HTTP request
   * @returns Session ID or null if not present
   */
  getSessionIdFromRequest(request: Request): string | null;

  /**
   * Create response headers to set session cookie/token.
   *
   * @param session - Session to encode in headers
   * @returns Headers object to merge into response
   */
  getSessionHeaders(session: TSession): Record<string, string>;

  /**
   * Create response headers to clear session (for logout).
   *
   * @returns Headers object to clear session
   */
  getClearSessionHeaders(): Record<string, string>;
}
