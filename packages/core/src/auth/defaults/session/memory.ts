/**
 * In-memory session provider for development.
 *
 * WARNING: Sessions are lost on server restart. Not for production use.
 */

import type { Session, ISessionProvider } from '../../interfaces';

/**
 * Options for MemorySessionProvider.
 */
export interface MemorySessionProviderOptions {
  /** Session TTL in milliseconds (default: 7 days) */
  ttl?: number;
  /** Cookie name (default: 'mastra_session') */
  cookieName?: string;
  /** Cookie path (default: '/') */
  cookiePath?: string;
  /** Cleanup interval in milliseconds (default: 60000) */
  cleanupInterval?: number;
}

/**
 * In-memory session provider.
 *
 * Stores sessions in a Map. Useful for development but not suitable
 * for production as sessions are lost on restart.
 *
 * @example
 * ```typescript
 * const sessionProvider = new MemorySessionProvider({
 *   ttl: 24 * 60 * 60 * 1000, // 24 hours
 * });
 * ```
 */
export class MemorySessionProvider implements ISessionProvider {
  private sessions = new Map<string, Session>();
  private ttl: number;
  private cookieName: string;
  private cookiePath: string;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: MemorySessionProviderOptions = {}) {
    this.ttl = options.ttl ?? 7 * 24 * 60 * 60 * 1000; // 7 days
    this.cookieName = options.cookieName ?? 'mastra_session';
    this.cookiePath = options.cookiePath ?? '/';

    // Start cleanup timer
    const cleanupInterval = options.cleanupInterval ?? 60000;
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupInterval);

    // Log warning
    console.warn(
      '[MemorySessionProvider] Using in-memory sessions. ' +
        'Sessions will be lost on server restart. ' +
        'Use a persistent session provider in production.',
    );
  }

  async createSession(userId: string, metadata?: Record<string, unknown>): Promise<Session> {
    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      expiresAt: new Date(Date.now() + this.ttl),
      createdAt: new Date(),
      metadata,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async validateSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check expiration
    if (session.expiresAt < new Date()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  async destroySession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async refreshSession(sessionId: string): Promise<Session | null> {
    const session = await this.validateSession(sessionId);

    if (!session) {
      return null;
    }

    // Extend expiration
    session.expiresAt = new Date(Date.now() + this.ttl);
    this.sessions.set(sessionId, session);

    return session;
  }

  getSessionIdFromRequest(request: Request): string | null {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    const match = cookieHeader.match(new RegExp(`${this.cookieName}=([^;]+)`));
    return match?.[1] ?? null;
  }

  getSessionHeaders(session: Session): Record<string, string> {
    const maxAge = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
    return {
      'Set-Cookie': `${this.cookieName}=${session.id}; HttpOnly; SameSite=Lax; Path=${this.cookiePath}; Max-Age=${maxAge}`,
    };
  }

  getClearSessionHeaders(): Record<string, string> {
    return {
      'Set-Cookie': `${this.cookieName}=; HttpOnly; SameSite=Lax; Path=${this.cookiePath}; Max-Age=0`,
    };
  }

  /**
   * Clean up expired sessions.
   */
  private cleanup(): void {
    const now = new Date();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt < now) {
        this.sessions.delete(id);
      }
    }
  }

  /**
   * Stop the cleanup timer.
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get the number of active sessions (for debugging).
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}
