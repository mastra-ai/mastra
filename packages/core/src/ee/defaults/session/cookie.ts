/**
 * Cookie-based session provider using encrypted cookies for production use.
 *
 * This provider stores session data entirely in encrypted cookies using AES-256-GCM.
 * No server-side session storage is required, making it ideal for stateless deployments.
 *
 * Features:
 * - AES-256-GCM encryption for session payload
 * - Secure, HttpOnly, SameSite=Lax cookie flags
 * - Configurable cookie name, domain, and path
 * - No server-side state required
 *
 * Security considerations:
 * - Requires a strong encryption secret (32 bytes minimum)
 * - Session data is encrypted but stored on client (don't store sensitive data)
 * - Cookie size limited to ~4KB (browser limit)
 */

import type { ISessionProvider, Session } from '../../interfaces/session.js';

/**
 * Configuration options for CookieSessionProvider.
 */
export interface CookieSessionConfig {
  /**
   * Encryption secret for session cookies.
   * MUST be at least 32 bytes when UTF-8 encoded (256 bits) for AES-256-GCM.
   * Note: Multi-byte UTF-8 characters count as multiple bytes.
   *
   * @example
   * ```typescript
   * const secret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
   * ```
   */
  secret: string;

  /**
   * Session time-to-live in milliseconds.
   * @default 604800000 (7 days)
   */
  ttl?: number;

  /**
   * Cookie name for session.
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
 * Cookie-based session storage using encrypted cookies.
 *
 * Sessions are stored entirely in encrypted cookies using AES-256-GCM.
 * No server-side storage required.
 *
 * @example
 * ```typescript
 * const sessionProvider = new CookieSessionProvider({
 *   secret: process.env.SESSION_SECRET!,
 *   ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
 *   cookieName: 'session',
 * });
 *
 * const session = await sessionProvider.createSession('user-123');
 * const headers = sessionProvider.getSessionHeaders(session);
 * // Set-Cookie: session=encrypted...; HttpOnly; Secure; SameSite=Lax; Path=/
 * ```
 */
export class CookieSessionProvider implements ISessionProvider<Session> {
  private readonly secret: Buffer;
  private readonly ttl: number;
  private readonly cookieName: string;
  private readonly cookieDomain?: string;
  private readonly cookiePath: string;

  constructor(config: CookieSessionConfig) {
    // Convert secret to Buffer first to check byte length (not character length)
    const secretBuffer = Buffer.from(config.secret || '', 'utf-8');

    // Validate secret byte length (must be at least 32 bytes for AES-256)
    if (secretBuffer.length < 32) {
      throw new Error('Session secret must be at least 32 bytes (256 bits) for AES-256-GCM encryption');
    }

    // Use first 32 bytes for AES-256 key
    this.secret = secretBuffer.subarray(0, 32);
    this.ttl = config.ttl ?? 7 * 24 * 60 * 60 * 1000; // 7 days default
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

    return session;
  }

  /**
   * Validate a session by decrypting the cookie value.
   * Returns null if session doesn't exist or is expired.
   */
  async validateSession(sessionId: string): Promise<Session | null> {
    try {
      // Decrypt session data from cookie value
      const session = await this.decryptSession(sessionId);

      if (!session) {
        return null;
      }

      // Check if session is expired
      if (new Date(session.expiresAt) < new Date()) {
        return null;
      }

      return session;
    } catch {
      // Invalid or corrupted session cookie
      return null;
    }
  }

  /**
   * Destroy a session (logout).
   * For cookie-based sessions, this just returns - actual clearing happens via getClearSessionHeaders().
   */
  async destroySession(_sessionId: string): Promise<void> {
    // No server-side state to clean up
    // Session is cleared via getClearSessionHeaders() cookie
    return;
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

    return session;
  }

  /**
   * Extract encrypted session cookie from incoming request.
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

    // Extract encrypted session value
    const encryptedSession = sessionCookie.substring(`${this.cookieName}=`.length);
    return encryptedSession || null;
  }

  /**
   * Create Set-Cookie header with encrypted session.
   */
  getSessionHeaders(session: Session): Record<string, string> {
    // Encrypt session data
    const encryptedValue = this.encryptSession(session);

    const cookie = [
      `${this.cookieName}=${encryptedValue}`,
      'HttpOnly',
      'SameSite=Lax',
      `Path=${this.cookiePath}`,
      `Max-Age=${Math.floor(this.ttl / 1000)}`,
    ];

    if (this.cookieDomain) {
      cookie.push(`Domain=${this.cookieDomain}`);
    }

    // Always set Secure in production (HTTPS)
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
   * Encrypt session data using AES-256-GCM.
   */
  private encryptSession(session: Session): string {
    // Use Node.js crypto for AES-GCM

    const crypto = require('node:crypto');

    // Generate random IV (12 bytes for GCM)
    const iv = crypto.randomBytes(12);

    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', this.secret, iv);

    // Serialize session to JSON
    const sessionJson = JSON.stringify({
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      metadata: session.metadata,
    });

    // Encrypt
    let encrypted = cipher.update(sessionJson, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag (16 bytes for GCM)
    const authTag = cipher.getAuthTag();

    // Combine IV + authTag + encrypted data
    const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);

    // Return as base64url (URL-safe)
    return combined.toString('base64url');
  }

  /**
   * Decrypt session data using AES-256-GCM.
   */
  private async decryptSession(encryptedValue: string): Promise<Session | null> {
    try {
      const crypto = require('node:crypto');

      // Decode from base64url
      const combined = Buffer.from(encryptedValue, 'base64url');

      // Extract IV (12 bytes), authTag (16 bytes), and encrypted data
      const iv = combined.subarray(0, 12);
      const authTag = combined.subarray(12, 28);
      const encrypted = combined.subarray(28);

      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.secret, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      // Parse JSON
      const sessionData = JSON.parse(decrypted);

      // Reconstruct session object
      return {
        id: sessionData.id,
        userId: sessionData.userId,
        expiresAt: new Date(sessionData.expiresAt),
        createdAt: new Date(sessionData.createdAt),
        metadata: sessionData.metadata,
      };
    } catch {
      // Decryption failed - invalid or tampered cookie
      return null;
    }
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

    const nodeCrypto = require('node:crypto');
    return nodeCrypto.randomBytes(16).toString('hex');
  }
}
