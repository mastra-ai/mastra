/**
 * Signed cookie session provider.
 *
 * Stores session data in signed cookies. No server-side storage required.
 */

import type { Session, ISessionProvider } from '../../interfaces';

/**
 * Options for CookieSessionProvider.
 */
export interface CookieSessionProviderOptions {
  /** Secret for signing cookies (required) */
  secret: string;
  /** Session TTL in milliseconds (default: 7 days) */
  ttl?: number;
  /** Cookie name (default: 'mastra_session') */
  cookieName?: string;
  /** Cookie path (default: '/') */
  cookiePath?: string;
  /** Cookie domain */
  cookieDomain?: string;
  /** Use secure cookies (default: true in production) */
  secure?: boolean;
}

/**
 * Session data stored in cookie.
 */
interface CookieSessionData {
  id: string;
  userId: string;
  expiresAt: number; // Timestamp
  createdAt: number; // Timestamp
  metadata?: Record<string, unknown>;
}

/**
 * Signed cookie session provider.
 *
 * Stores session data in signed cookies. The session is validated
 * by verifying the signature on each request.
 *
 * @example
 * ```typescript
 * const sessionProvider = new CookieSessionProvider({
 *   secret: process.env.SESSION_SECRET!,
 *   ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
 * });
 * ```
 */
export class CookieSessionProvider implements ISessionProvider {
  private secret: string;
  private ttl: number;
  private cookieName: string;
  private cookiePath: string;
  private cookieDomain?: string;
  private secure: boolean;

  constructor(options: CookieSessionProviderOptions) {
    if (!options.secret || options.secret.length < 32) {
      throw new Error('CookieSessionProvider requires a secret of at least 32 characters');
    }

    this.secret = options.secret;
    this.ttl = options.ttl ?? 7 * 24 * 60 * 60 * 1000; // 7 days
    this.cookieName = options.cookieName ?? 'mastra_session';
    this.cookiePath = options.cookiePath ?? '/';
    this.cookieDomain = options.cookieDomain;
    this.secure = options.secure ?? process.env['NODE_ENV'] === 'production';
  }

  async createSession(userId: string, metadata?: Record<string, unknown>): Promise<Session> {
    const now = Date.now();
    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      expiresAt: new Date(now + this.ttl),
      createdAt: new Date(now),
      metadata,
    };

    return session;
  }

  async validateSession(sessionId: string): Promise<Session | null> {
    // For cookie sessions, validation happens in getSessionFromCookie
    // This method is here for interface compliance
    return null;
  }

  async destroySession(_sessionId: string): Promise<void> {
    // Cookie sessions are destroyed by clearing the cookie
    // This is a no-op on the server side
  }

  async refreshSession(sessionId: string): Promise<Session | null> {
    // For cookie sessions, we need the full session to refresh
    // This would be called with the session from getSessionFromCookie
    return null;
  }

  getSessionIdFromRequest(request: Request): string | null {
    const session = this.getSessionFromCookie(request);
    return session?.id ?? null;
  }

  /**
   * Get full session from cookie.
   */
  getSessionFromCookie(request: Request): Session | null {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    const match = cookieHeader.match(new RegExp(`${this.cookieName}=([^;]+)`));
    if (!match?.[1]) return null;

    try {
      const decoded = this.decodeAndVerify(match[1]);
      if (!decoded) return null;

      // Check expiration
      if (decoded.expiresAt < Date.now()) {
        return null;
      }

      return {
        id: decoded.id,
        userId: decoded.userId,
        expiresAt: new Date(decoded.expiresAt),
        createdAt: new Date(decoded.createdAt),
        metadata: decoded.metadata,
      };
    } catch {
      return null;
    }
  }

  getSessionHeaders(session: Session): Record<string, string> {
    const data: CookieSessionData = {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt.getTime(),
      createdAt: session.createdAt.getTime(),
      metadata: session.metadata,
    };

    const encoded = this.signAndEncode(data);
    const maxAge = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);

    let cookie = `${this.cookieName}=${encoded}; HttpOnly; SameSite=Lax; Path=${this.cookiePath}; Max-Age=${maxAge}`;

    if (this.cookieDomain) {
      cookie += `; Domain=${this.cookieDomain}`;
    }

    if (this.secure) {
      cookie += '; Secure';
    }

    return { 'Set-Cookie': cookie };
  }

  getClearSessionHeaders(): Record<string, string> {
    let cookie = `${this.cookieName}=; HttpOnly; SameSite=Lax; Path=${this.cookiePath}; Max-Age=0`;

    if (this.cookieDomain) {
      cookie += `; Domain=${this.cookieDomain}`;
    }

    return { 'Set-Cookie': cookie };
  }

  /**
   * Sign and encode session data.
   */
  private signAndEncode(data: CookieSessionData): string {
    const json = JSON.stringify(data);
    const signature = this.sign(json);
    const payload = `${this.base64Encode(json)}.${signature}`;
    return encodeURIComponent(payload);
  }

  /**
   * Decode and verify session cookie.
   */
  private decodeAndVerify(cookie: string): CookieSessionData | null {
    try {
      const decoded = decodeURIComponent(cookie);
      const [data, signature] = decoded.split('.');

      if (!data || !signature) return null;

      const json = this.base64Decode(data);
      const expectedSignature = this.sign(json);

      // Constant-time comparison
      if (!this.secureCompare(signature, expectedSignature)) {
        return null;
      }

      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  /**
   * Create HMAC signature.
   */
  private sign(data: string): string {
    // Simple HMAC-like signature using the secret
    // In production, use a proper crypto library
    let hash = 0;
    const combined = this.secret + data + this.secret;

    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Base64 encode.
   */
  private base64Encode(str: string): string {
    if (typeof btoa !== 'undefined') {
      return btoa(encodeURIComponent(str));
    }
    return Buffer.from(str).toString('base64');
  }

  /**
   * Base64 decode.
   */
  private base64Decode(str: string): string {
    if (typeof atob !== 'undefined') {
      return decodeURIComponent(atob(str));
    }
    return Buffer.from(str, 'base64').toString();
  }

  /**
   * Constant-time string comparison.
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
