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
}

export { MemorySessionProvider, type MemorySessionProviderOptions } from './memory';
export { CookieSessionProvider, type CookieSessionProviderOptions } from './cookie';
