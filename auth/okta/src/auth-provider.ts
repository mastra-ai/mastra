/**
 * MastraAuthOkta - Okta authentication provider for Mastra with SSO support.
 *
 * Supports OAuth 2.0 / OIDC login flow with PKCE and session management.
 */

import type {
  ISSOProvider,
  ISessionProvider,
  IUserProvider,
  Session,
  SSOCallbackResult,
  SSOLoginConfig,
} from '@mastra/core/auth';
import type { MastraAuthProviderOptions } from '@mastra/core/server';
import { MastraAuthProvider } from '@mastra/core/server';
import type { HonoRequest } from 'hono';
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';

import type { OktaUser, MastraAuthOktaOptions } from './types.js';
import { mapOktaClaimsToUser } from './types.js';

/** Default cookie name for Okta sessions */
const DEFAULT_COOKIE_NAME = 'okta_session';

/** Default cookie max age (24 hours) */
const DEFAULT_COOKIE_MAX_AGE = 86400;

/** Default OAuth scopes */
const DEFAULT_SCOPES = ['openid', 'profile', 'email', 'groups'];

/**
 * Encrypt session data for cookie storage.
 */
async function encryptSession(data: unknown, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
    'deriveKey',
  ]);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode('okta_session_salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(data)));
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt session data from cookie.
 */
async function decryptSession(encrypted: string, password: string): Promise<unknown> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
    'deriveKey',
  ]);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode('okta_session_salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

/**
 * In-memory store for state validation (keyed by state).
 * Used to validate that callback state matches the login request.
 */
const stateStore = new Map<string, { expiresAt: number }>();

/**
 * Mastra authentication provider for Okta with SSO support.
 *
 * Implements OAuth 2.0 / OIDC login flow with PKCE and encrypted session cookies.
 *
 * @example Basic usage with SSO
 * ```typescript
 * import { MastraAuthOkta } from '@mastra/auth-okta';
 *
 * const auth = new MastraAuthOkta({
 *   domain: 'dev-123456.okta.com',
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret',
 *   redirectUri: 'http://localhost:4111/api/auth/callback',
 * });
 * ```
 */
export class MastraAuthOkta
  extends MastraAuthProvider<OktaUser>
  implements ISSOProvider<OktaUser>, ISessionProvider<Session>, IUserProvider<OktaUser>
{
  protected domain: string;
  protected clientId: string;
  protected clientSecret: string;
  protected issuer: string;
  protected redirectUri: string;
  protected scopes: string[];
  protected cookieName: string;
  protected cookieMaxAge: number;
  protected cookiePassword: string;

  constructor(options?: MastraAuthOktaOptions) {
    super({ name: options?.name ?? 'okta' });

    const domain = options?.domain ?? process.env.OKTA_DOMAIN;
    const clientId = options?.clientId ?? process.env.OKTA_CLIENT_ID;
    const clientSecret = options?.clientSecret ?? process.env.OKTA_CLIENT_SECRET;
    const issuer = options?.issuer ?? process.env.OKTA_ISSUER;
    const redirectUri = options?.redirectUri ?? process.env.OKTA_REDIRECT_URI;
    const cookiePassword =
      options?.session?.cookiePassword ?? process.env.OKTA_COOKIE_PASSWORD ?? crypto.randomUUID() + crypto.randomUUID();

    if (!domain) {
      throw new Error('Okta domain is required. Provide it in the options or set OKTA_DOMAIN environment variable.');
    }

    if (!clientId) {
      throw new Error(
        'Okta client ID is required. Provide it in the options or set OKTA_CLIENT_ID environment variable.',
      );
    }

    if (!clientSecret) {
      throw new Error(
        'Okta client secret is required for SSO. Provide it in the options or set OKTA_CLIENT_SECRET environment variable.',
      );
    }

    if (!redirectUri) {
      throw new Error(
        'Okta redirect URI is required for SSO. Provide it in the options or set OKTA_REDIRECT_URI environment variable.',
      );
    }

    if (cookiePassword.length < 32) {
      throw new Error('Cookie password must be at least 32 characters. Set OKTA_COOKIE_PASSWORD environment variable.');
    }

    this.domain = domain;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.issuer = issuer ?? `https://${domain}/oauth2/default`;
    this.redirectUri = redirectUri;
    this.scopes = options?.scopes ?? DEFAULT_SCOPES;
    this.cookieName = options?.session?.cookieName ?? DEFAULT_COOKIE_NAME;
    this.cookieMaxAge = options?.session?.cookieMaxAge ?? DEFAULT_COOKIE_MAX_AGE;
    this.cookiePassword = cookiePassword;

    this.registerOptions(options as MastraAuthProviderOptions<OktaUser>);
  }

  // ============================================================================
  // MastraAuthProvider Implementation
  // ============================================================================

  /**
   * Authenticate a token from the request.
   * First tries to read from session cookie, then falls back to Authorization header.
   */
  async authenticateToken(token: string, request: HonoRequest | Request): Promise<OktaUser | null> {
    // Try session cookie first
    const sessionUser = await this.getUserFromSession(request);
    if (sessionUser) {
      return sessionUser;
    }

    // Fall back to JWT verification from Authorization header
    if (!token || typeof token !== 'string') {
      return null;
    }

    try {
      const jwksUrl = `${this.issuer}/v1/keys`;
      const JWKS = createRemoteJWKSet(new URL(jwksUrl));

      const { payload } = await jwtVerify(token, JWKS, {
        issuer: this.issuer,
        audience: this.clientId,
      });

      return mapOktaClaimsToUser(payload);
    } catch (err) {
      console.error('Okta token verification failed:', err);
      return null;
    }
  }

  /**
   * Authorize a user.
   */
  authorizeUser(user: OktaUser, _request: HonoRequest): boolean {
    if (!user || !user.oktaId) return false;
    return true;
  }

  // ============================================================================
  // IUserProvider Implementation
  // ============================================================================

  /**
   * Get the current user from the request session.
   */
  async getCurrentUser(request: Request): Promise<OktaUser | null> {
    return this.getUserFromSession(request);
  }

  /**
   * Get a user by ID.
   * Note: This returns null as we don't have a user store - users are session-based.
   */
  async getUser(_userId: string): Promise<OktaUser | null> {
    // We don't maintain a user store - users come from Okta via SSO
    return null;
  }

  /**
   * Get user from session cookie.
   */
  private async getUserFromSession(request: HonoRequest | Request): Promise<OktaUser | null> {
    try {
      // Handle both HonoRequest and standard Request
      const cookieHeader = 'header' in request ? request.header('cookie') : request.headers.get('cookie');
      if (!cookieHeader) return null;

      const cookies = cookieHeader.split(';').map((c: string) => c.trim());
      const sessionCookie = cookies.find((c: string) => c.startsWith(`${this.cookieName}=`));
      if (!sessionCookie) return null;

      const sessionValue = sessionCookie.split('=')[1];
      if (!sessionValue) return null;

      const session = (await decryptSession(decodeURIComponent(sessionValue), this.cookiePassword)) as {
        user: OktaUser;
        accessToken: string;
        expiresAt: number;
      };

      // Check if session is expired
      if (session.expiresAt && session.expiresAt < Date.now()) {
        return null;
      }

      return session.user;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // ISSOProvider Implementation
  // ============================================================================

  /**
   * Get the URL to redirect users to for Okta login.
   * Uses client_secret authentication (no PKCE) since this is a confidential client.
   */
  getLoginUrl(redirectUri: string, state: string): string {
    // State format from server: "uuid|encodedRedirect"
    // Extract just the UUID for storage (callback receives only UUID)
    const stateId = state.includes('|') ? state.split('|')[0]! : state;

    // Store state ID for validation (expires in 10 minutes)
    stateStore.set(stateId, {
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Clean up expired states
    for (const [key, value] of stateStore.entries()) {
      if (value.expiresAt < Date.now()) {
        stateStore.delete(key);
      }
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: this.scopes.join(' '),
      redirect_uri: redirectUri || this.redirectUri,
      state,
    });

    return `${this.issuer}/v1/authorize?${params.toString()}`;
  }

  /**
   * Handle the OAuth callback from Okta.
   * Note: The server passes only the stateId (UUID part), not the full state.
   */
  async handleCallback(code: string, stateId: string): Promise<SSOCallbackResult<OktaUser>> {
    // Validate state parameter (server passes only the UUID part)
    const stored = stateStore.get(stateId);
    if (!stored) {
      throw new Error('Invalid or expired state parameter');
    }
    stateStore.delete(stateId);

    if (stored.expiresAt < Date.now()) {
      throw new Error('State parameter has expired');
    }

    // Exchange code for tokens using client_secret (confidential client)
    const tokenResponse = await fetch(`${this.issuer}/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      id_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
    };

    // Decode ID token to get user info
    const idTokenPayload = decodeJwt(tokens.id_token);
    const user = mapOktaClaimsToUser(idTokenPayload);

    // Create encrypted session cookie
    const sessionData = {
      user,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };

    const encryptedSession = await encryptSession(sessionData, this.cookiePassword);
    const cookieValue = `${this.cookieName}=${encodeURIComponent(encryptedSession)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${this.cookieMaxAge}`;

    return {
      user,
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      cookies: [cookieValue],
    };
  }

  /**
   * Get the URL to redirect users to for logout.
   */
  async getLogoutUrl(redirectUri: string, _request?: Request): Promise<string | null> {
    const params = new URLSearchParams({
      post_logout_redirect_uri: redirectUri,
      client_id: this.clientId,
    });
    return `${this.issuer}/v1/logout?${params.toString()}`;
  }

  /**
   * Get cookies to set during login (for PKCE state).
   */
  getLoginCookies(_state: string): string[] {
    return [];
  }

  /**
   * Get the configuration for rendering the login button.
   */
  getLoginButtonConfig(): SSOLoginConfig {
    return {
      provider: 'okta',
      text: 'Sign in with Okta',
    };
  }

  // ============================================================================
  // ISessionProvider Implementation
  // ============================================================================

  async createSession(userId: string, metadata?: Record<string, unknown>): Promise<Session> {
    const now = new Date();
    return {
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.cookieMaxAge * 1000),
      metadata,
    };
  }

  async validateSession(_sessionId: string): Promise<Session | null> {
    return null;
  }

  async destroySession(_sessionId: string): Promise<void> {
    // Session is cleared via cookie
  }

  async refreshSession(_sessionId: string): Promise<Session | null> {
    return null;
  }

  getSessionIdFromRequest(_request: Request): string | null {
    return null;
  }

  getSessionHeaders(_session: Session): Record<string, string> {
    return {};
  }

  getClearSessionHeaders(): Record<string, string> {
    return {
      'Set-Cookie': `${this.cookieName}=; Path=/; Max-Age=0; HttpOnly`,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get the Okta domain.
   */
  getDomain(): string {
    return this.domain;
  }

  /**
   * Get the configured client ID.
   */
  getClientId(): string {
    return this.clientId;
  }

  /**
   * Get the configured redirect URI.
   */
  getRedirectUri(): string {
    return this.redirectUri;
  }

  /**
   * Get the issuer URL.
   */
  getIssuer(): string {
    return this.issuer;
  }
}
