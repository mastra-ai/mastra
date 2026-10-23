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
 */
export interface ISessionProvider<TSession extends Session = Session> {
  createSession(userId: string, metadata?: Record<string, unknown>): Promise<TSession>;
  validateSession(sessionId: string): Promise<TSession | null>;
  destroySession(sessionId: string): Promise<void>;
  refreshSession(sessionId: string): Promise<TSession | null>;
  getSessionIdFromRequest(request: Request): string | null;
  getSessionHeaders(session: TSession): Record<string, string>;
  getClearSessionHeaders(): Record<string, string>;
  /**
   * Optional: `Set-Cookie` values expiring legacy copies of the session cookie
   * (for example one an earlier release scoped to a shared parent `Domain`).
   * A browser only deletes a cookie whose exact `(name, Domain, Path)` match,
   * so servers append these to every response that sets or clears the session
   * cookie; otherwise a stale shared-domain copy keeps being sent to every
   * sibling host until it expires.
   */
  getLegacySessionClearCookies?(): string[];
}

export { MemorySessionProvider, type MemorySessionProviderOptions } from './memory';
export { CookieSessionProvider, type CookieSessionProviderOptions } from './cookie';
