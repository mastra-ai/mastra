/**
 * In-memory session provider for development and testing.
 *
 * WARNING: This provider stores sessions in memory and should NOT be used in production.
 * Sessions will be lost on server restart and do not scale across multiple instances.
 *
 * For production use, implement a session provider backed by Redis, PostgreSQL, or similar.
 */

import type { ISessionProvider, Session } from '../../interfaces/session.js';

/**
 * Configuration options for MemorySessionProvider.
 */
export interface MemorySessionConfig {
  /**
   * Session time-to-live in milliseconds.
   * @default 86400000 (24 hours)
   */
  ttl?: number;

  /**
   * Cookie name for session ID.
   * @default 'mastra_session'
   */
  cookieName?: string;

  /**
   * Cookie domain (optional).
   * @default undefined
   */
  cookieDomain?: string;

  /**
   * Cookie path.
   * @default '/'
   */
  cookiePath?: string;
}

/**
 * In-memory session storage for development and testing.
 *
 * Features:
 * - Stores sessions in a Map (lost on restart)
 * - Automatic session expiry validation
 * - Cookie-based session ID transport
 * - Session refresh extends TTL
 *
 * @example
 * ```typescript
 * const sessionProvider = new MemorySessionProvider({
 *   ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
 *   cookieName: 'session',
 * });
 *
 * const session = await sessionProvider.createSession('user-123');
 * const headers = sessionProvider.getSessionHeaders(session);
 * // Set-Cookie: session=abc...; HttpOnly; SameSite=Lax; Path=/
 * ```
 */
export class MemorySessionProvider implements ISessionProvider<Session> {
  private sessions: Map<string, Session>;
  private readonly ttl: number;
  private readonly cookieName: string;
  private readonly cookieDomain?: string;
  private readonly cookiePath: string;

  constructor(config: MemorySessionConfig = {}) {
    this.sessions = new Map();
    this.ttl = config.ttl ?? 24 * 60 * 60 * 1000; // 24 hours default
    this.cookieName = config.cookieName ?? 'mastra_session';
    this.cookieDomain = config.cookieDomain;
    this.cookiePath = config.cookiePath ?? '/';
  }

  /**
   * Create a new session for a user.
   */
  async createSession(userId: string, metadata?: Record<string, unknown>): Promise<Session> {
    const id = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttl);

    const session: Session = {
      id,
      userId,
      expiresAt,
      createdAt: now,
      metadata,
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Validate a session and return it if valid.
   * Returns null if session doesn't exist or is expired.
   */
  async validateSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Destroy a session (logout).
   */
  async destroySession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  /**
   * Refresh a session, extending its expiry.
   */
  async refreshSession(sessionId: string): Promise<Session | null> {
    const session = await this.validateSession(sessionId);

    if (!session) {
      return null;
    }

    // Extend expiry
    session.expiresAt = new Date(Date.now() + this.ttl);
    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * Extract session ID from incoming request cookie.
   */
  getSessionIdFromRequest(request: Request): string | null {
    const cookieHeader = request.headers.get('cookie');

    if (!cookieHeader) {
      return null;
    }

    // Parse cookie header
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith(`${this.cookieName}=`));

    if (!sessionCookie) {
      return null;
    }

    // Extract session ID
    const sessionId = sessionCookie.substring(`${this.cookieName}=`.length);
    return sessionId || null;
  }

  /**
   * Create Set-Cookie header for session.
   */
  getSessionHeaders(session: Session): Record<string, string> {
    const cookie = [
      `${this.cookieName}=${session.id}`,
      'HttpOnly',
      'SameSite=Lax',
      `Path=${this.cookiePath}`,
      `Max-Age=${Math.floor(this.ttl / 1000)}`,
    ];

    if (this.cookieDomain) {
      cookie.push(`Domain=${this.cookieDomain}`);
    }

    // Only set Secure in production (HTTPS)
    if (process.env.NODE_ENV === 'production') {
      cookie.push('Secure');
    }

    return {
      'Set-Cookie': cookie.join('; '),
    };
  }

  /**
   * Create Set-Cookie header to clear session (logout).
   */
  getClearSessionHeaders(): Record<string, string> {
    const cookie = [`${this.cookieName}=`, 'HttpOnly', 'SameSite=Lax', `Path=${this.cookiePath}`, 'Max-Age=0'];

    if (this.cookieDomain) {
      cookie.push(`Domain=${this.cookieDomain}`);
    }

    if (process.env.NODE_ENV === 'production') {
      cookie.push('Secure');
    }

    return {
      'Set-Cookie': cookie.join('; '),
    };
  }

  /**
   * Generate a cryptographically secure session ID.
   */
  private generateSessionId(): string {
    // Use Web Crypto API (Node.js 16+)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback to Node.js crypto
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    return nodeCrypto.randomBytes(16).toString('hex');
  }

  /**
   * Get the current number of active sessions (for debugging).
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Clear all sessions (for testing).
   */
  clearAllSessions(): void {
    this.sessions.clear();
  }
}
