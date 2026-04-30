/**
 * MastraAuthOkta - Okta authentication provider for Mastra with SSO support.
 *
 * Supports OAuth 2.0 / OIDC login flow with client_secret and session management.
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
import { createRemoteJWKSet, jwtVerify } from 'jose';

import type { OktaUser, MastraAuthOktaOptions } from './types.js';
import { mapOktaClaimsToUser } from './types.js';

/** Default cookie name for Okta sessions */
const DEFAULT_COOKIE_NAME = 'okta_session';

/** Default cookie max age (24 hours) */
const DEFAULT_COOKIE_MAX_AGE = 86400;

/** Default OAuth scopes */
const DEFAULT_SCOPES = ['openid', 'profile', 'email', 'groups'];

/** PBKDF2 salt length in bytes */
const SALT_LENGTH = 16;

/** AES-GCM IV length in bytes */
const IV_LENGTH = 12;

/**
 * Derive an AES-GCM key from password + salt using PBKDF2.
 */
async function deriveKey(password: string, salt: Uint8Array, usage: 'encrypt' | 'decrypt') {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  );
}

/**
 * Encrypt session data for cookie storage.
 * Format: base64(salt || iv || ciphertext)
 * Salt is random per-encryption to ensure unique derived keys.
 */
async function encryptSession(data: unknown, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(password, salt, 'encrypt');
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(data)));
  const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(encrypted).length);
  combined.set(salt);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt session data from cookie.
 * Reads the random salt from the ciphertext prefix to derive the same key.
 */
async function decryptSession(encrypted: string, password: string): Promise<unknown> {
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const data = combined.slice(SALT_LENGTH + IV_LENGTH);
  const key = await deriveKey(password, salt, 'decrypt');
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

/**
 * In-memory store for state validation (keyed by state).
 * Used to validate that callback state matches the login request.
 */
const stateStore = new Map<string, { expiresAt: number; redirectUri: string }>();

/**
 * Mastra authentication provider for Okta with SSO support.
 *
 * Implements OAuth 2.0 / OIDC login flow with encrypted session cookies.
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
  protected secureCookies: boolean;
  protected apiToken?: string;
  private jwks: ReturnType<typeof createRemoteJWKSet>;

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
    this.secureCookies = options?.session?.secureCookies ?? process.env.NODE_ENV === 'production';
    this.apiToken = options?.apiToken ?? process.env.OKTA_API_TOKEN;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/v1/keys`));

    // Warn about insecure defaults in production
    if (!options?.session?.cookiePassword && !process.env.OKTA_COOKIE_PASSWORD) {
      console.warn(
        '[MastraAuthOkta] No cookie password set — using auto-generated value. Sessions will not survive restarts and will break in multi-instance deployments. Set OKTA_COOKIE_PASSWORD for production use.',
      );
    }

    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[MastraAuthOkta] Using in-memory OAuth state store. This will not work in serverless or multi-instance deployments. Consider implementing a custom state store for production.',
      );
    }

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
      const { payload } = await jwtVerify(token, this.jwks, {
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
   * Get a user by ID via the Okta Users API.
   * Requires an API token (set OKTA_API_TOKEN or pass apiToken in options).
   * Returns null if no API token is configured or user is not found.
   */
  async getUser(userId: string): Promise<OktaUser | null> {
    if (!this.apiToken) {
      return null;
    }

    try {
      const response = await fetch(`https://${this.domain}/api/v1/users/${userId}`, {
        headers: {
          Authorization: `SSWS ${this.apiToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const oktaProfile = (await response.json()) as {
        id: string;
        profile: {
          login: string;
          email: string;
          firstName?: string;
          lastName?: string;
        };
      };

      return {
        id: oktaProfile.id,
        oktaId: oktaProfile.id,
        email: oktaProfile.profile.email,
        name: [oktaProfile.profile.firstName, oktaProfile.profile.lastName].filter(Boolean).join(' ') || undefined,
      };
    } catch {
      return null;
    }
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
        idToken?: string;
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

  /**
   * Extract the raw ID token from the encrypted session cookie.
   * Used to provide id_token_hint for Okta logout.
   */
  private async getIdTokenFromSession(request: Request): Promise<string | null> {
    try {
      const cookieHeader =
        'header' in request ? (request as unknown as HonoRequest).header('cookie') : request.headers.get('cookie');
      if (!cookieHeader) return null;

      const cookies = cookieHeader.split(';').map((c: string) => c.trim());
      const sessionCookie = cookies.find((c: string) => c.startsWith(`${this.cookieName}=`));
      if (!sessionCookie) return null;

      const sessionValue = sessionCookie.split('=')[1];
      if (!sessionValue) return null;

      const session = (await decryptSession(decodeURIComponent(sessionValue), this.cookiePassword)) as {
        idToken?: string;
      };
      return session.idToken ?? null;
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

    // Store state ID with redirect_uri for validation (expires in 10 minutes)
    const actualRedirectUri = redirectUri ?? this.redirectUri;
    stateStore.set(stateId, {
      expiresAt: Date.now() + 10 * 60 * 1000,
      redirectUri: actualRedirectUri,
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
      redirect_uri: actualRedirectUri,
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
        redirect_uri: stored.redirectUri,
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

    // Verify and decode ID token
    const { payload: idTokenPayload } = await jwtVerify(tokens.id_token, this.jwks, {
      issuer: this.issuer,
      audience: this.clientId,
    });
    const user = mapOktaClaimsToUser(idTokenPayload);

    // Create encrypted session cookie.
    // Only store user claims, id_token (for logout hint), and expiry.
    // Access/refresh tokens are NOT stored to keep cookie under 4KB browser limit.
    const sessionData = {
      user,
      idToken: tokens.id_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };

    const encryptedSession = await encryptSession(sessionData, this.cookiePassword);
    const cookieValue = `${this.cookieName}=${encodeURIComponent(encryptedSession)}; ${this.cookieFlags(this.cookieMaxAge)}`;

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
   * Includes id_token_hint from session when available (required by Okta).
   */
  async getLogoutUrl(redirectUri: string, request?: Request): Promise<string | null> {
    const params = new URLSearchParams({
      post_logout_redirect_uri: redirectUri,
      client_id: this.clientId,
    });

    // Try to extract id_token from session for id_token_hint (Okta requires this)
    if (request) {
      const idToken = await this.getIdTokenFromSession(request);
      if (idToken) {
        params.set('id_token_hint', idToken);
      }
    }

    return `${this.issuer}/v1/logout?${params.toString()}`;
  }

  /**
   * Get cookies to set during login.
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
      'Set-Cookie': `${this.cookieName}=; ${this.cookieFlags(0)}`,
    };
  }

  /**
   * Build consistent cookie attribute string for set/clear operations.
   */
  private cookieFlags(maxAge: number): string {
    const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
    return this.secureCookies ? `${flags}; Secure` : flags;
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
