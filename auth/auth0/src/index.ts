import type {
  ISSOProvider,
  ISessionProvider,
  IUserProvider,
  Session,
  SSOCallbackResult,
  SSOLoginConfig,
} from '@mastra/core/auth';
import type { EEUser } from '@mastra/core/auth/ee';
import type { MastraAuthProviderOptions } from '@mastra/core/server';
import { MastraAuthProvider } from '@mastra/core/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

type Auth0User = JWTPayload;

/** Default cookie name for Auth0 SSO sessions */
const DEFAULT_COOKIE_NAME = 'auth0_session';

/** Default cookie max age (24 hours) */
const DEFAULT_COOKIE_MAX_AGE = 86400;

/** Default OAuth scopes */
const DEFAULT_SCOPES = ['openid', 'profile', 'email'];

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
 */
async function decryptSession(encrypted: string, password: string): Promise<unknown> {
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  if (combined.length < SALT_LENGTH + IV_LENGTH + 1) {
    throw new Error('Invalid encrypted session data');
  }
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const data = combined.slice(SALT_LENGTH + IV_LENGTH);
  const key = await deriveKey(password, salt, 'decrypt');
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

/**
 * In-memory store for OAuth state validation.
 * WARNING: Only works in single-instance deployments.
 * For load-balanced/distributed setups, consider a shared store or signed state tokens.
 */
const stateStore = new Map<string, { expiresAt: number; redirectUri: string }>();

interface MastraAuthAuth0SessionOptions {
  /** Cookie name for the session (default: 'auth0_session') */
  cookieName?: string;
  /** Cookie max age in seconds (default: 86400 = 24 hours) */
  cookieMaxAge?: number;
  /** Cookie encryption password (min 32 chars). Falls back to AUTH0_COOKIE_PASSWORD env var */
  cookiePassword?: string;
  /** Use Secure flag on cookies (default: true in production) */
  secureCookies?: boolean;
}

interface MastraAuthAuth0Options extends MastraAuthProviderOptions<Auth0User> {
  domain?: string;
  audience?: string;
  /**
   * OAuth Client ID for Auth0 (SSO).
   * Falls back to AUTH0_CLIENT_ID env var.
   */
  clientId?: string;
  /**
   * OAuth Client Secret for Auth0 (SSO).
   * Falls back to AUTH0_CLIENT_SECRET env var.
   */
  clientSecret?: string;
  /**
   * OAuth redirect URI for the SSO callback.
   * Falls back to AUTH0_REDIRECT_URI env var.
   * Typically: http://localhost:4111/api/auth/sso/callback
   */
  redirectUri?: string;
  /**
   * OAuth scopes to request (default: ['openid', 'profile', 'email'])
   */
  scopes?: string[];
  /**
   * Session configuration for SSO cookie management.
   */
  session?: MastraAuthAuth0SessionOptions;
}

/**
 * Auth0 authentication provider for Mastra.
 *
 * Always implements IUserProvider for JWT-based user detection.
 *
 * When OAuth credentials are configured (clientId + clientSecret),
 * also dynamically adds ISSOProvider + ISessionProvider methods for Studio login
 * using Auth0 as an OAuth 2.0 / OIDC Identity Provider.
 *
 * @example Basic usage (IUserProvider only — validates JWTs)
 * ```typescript
 * const auth = new MastraAuthAuth0({
 *   domain: 'your-tenant.auth0.com',
 *   audience: 'https://your-api',
 * });
 * ```
 *
 * @example With SSO for Studio login
 * ```typescript
 * const auth = new MastraAuthAuth0({
 *   domain: 'your-tenant.auth0.com',
 *   audience: 'https://your-api',
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret',
 *   session: { cookiePassword: process.env.AUTH0_COOKIE_PASSWORD },
 * });
 * ```
 */
export class MastraAuthAuth0 extends MastraAuthProvider<Auth0User> implements IUserProvider<EEUser> {
  protected domain: string;
  protected audience: string;

  // SSO fields
  private clientId: string | null;
  private clientSecret: string | null;
  private _redirectUri: string | null;
  private scopes: string[];
  private cookieName: string;
  private cookieMaxAge: number;
  private cookiePassword: string;
  private secureCookies: boolean;
  private ssoEnabled: boolean;

  constructor(options?: MastraAuthAuth0Options) {
    super({ name: options?.name ?? 'auth0' });

    const domain = options?.domain ?? process.env.AUTH0_DOMAIN;
    const audience = options?.audience ?? process.env.AUTH0_AUDIENCE;

    if (!domain || !audience) {
      throw new Error(
        'Auth0 domain and audience are required, please provide them in the options or set the environment variables AUTH0_DOMAIN and AUTH0_AUDIENCE',
      );
    }

    this.domain = domain;
    this.audience = audience;

    // SSO configuration (optional — enables Studio login)
    const clientId = options?.clientId ?? process.env.AUTH0_CLIENT_ID;
    const clientSecret = options?.clientSecret ?? process.env.AUTH0_CLIENT_SECRET;
    const redirectUri = options?.redirectUri ?? process.env.AUTH0_REDIRECT_URI;
    const cookiePassword =
      options?.session?.cookiePassword ??
      process.env.AUTH0_COOKIE_PASSWORD ??
      crypto.randomUUID() + crypto.randomUUID();

    this.clientId = clientId ?? null;
    this.clientSecret = clientSecret ?? null;
    this._redirectUri = redirectUri ?? null;
    this.scopes = options?.scopes ?? DEFAULT_SCOPES;
    this.cookieName = options?.session?.cookieName ?? DEFAULT_COOKIE_NAME;
    this.cookieMaxAge = options?.session?.cookieMaxAge ?? DEFAULT_COOKIE_MAX_AGE;
    this.cookiePassword = cookiePassword;
    this.secureCookies = options?.session?.secureCookies ?? process.env.NODE_ENV === 'production';

    // SSO is enabled when OAuth credentials are configured
    this.ssoEnabled = !!(clientId && clientSecret);

    if (this.ssoEnabled) {
      if (cookiePassword.length < 32) {
        throw new Error(
          'Cookie password must be at least 32 characters for SSO. Set AUTH0_COOKIE_PASSWORD environment variable.',
        );
      }

      if (!options?.session?.cookiePassword && !process.env.AUTH0_COOKIE_PASSWORD) {
        console.warn(
          '[MastraAuthAuth0] No cookie password set — using auto-generated value. Sessions will not survive restarts. Set AUTH0_COOKIE_PASSWORD for production use.',
        );
      }

      // Dynamically add ISSOProvider + ISessionProvider methods
      this._attachSSOProvider();
      this._attachSessionProvider();
    }

    this.registerOptions(options);
  }

  // ============================================================================
  // MastraAuthProvider Implementation
  // ============================================================================

  async authenticateToken(
    token: string,
    request?: Request | { header(name: string): string | undefined },
  ): Promise<Auth0User | null> {
    // When SSO is enabled, try the encrypted session cookie first (like Okta pattern).
    if (this.ssoEnabled && request) {
      const sessionUser = await this.getUserFromSessionCookie(request as Request);
      if (sessionUser) return sessionUser as unknown as Auth0User;
    }

    // Fall back to JWT verification
    if (!token || typeof token !== 'string') {
      return null;
    }

    try {
      const JWKS = createRemoteJWKSet(new URL(`https://${this.domain}/.well-known/jwks.json`));

      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `https://${this.domain}/`,
        audience: this.audience,
      });

      return payload;
    } catch (err) {
      console.error('Auth0 token verification failed:', err);
      return null;
    }
  }

  async authorizeUser(user: Auth0User): Promise<boolean> {
    // Session cookie users have `id`, JWT users have `sub`
    if (!user || !(user.sub || (user as unknown as EEUser).id)) return false;

    if (user.exp && user.exp * 1000 < Date.now()) {
      return false;
    }

    return true;
  }

  // ============================================================================
  // IUserProvider Implementation
  // ============================================================================

  /**
   * Extract the bearer token from the request's Authorization header.
   */
  private extractToken(request: Request): string | null {
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token) return token;
    }

    return null;
  }

  async getCurrentUser(request: Request): Promise<EEUser | null> {
    // First try to get user from our SSO session cookie
    if (this.ssoEnabled) {
      const sessionUser = await this.getUserFromSessionCookie(request);
      if (sessionUser) return sessionUser;
    }

    // Fall back to token-based auth (Authorization header)
    const token = this.extractToken(request);
    if (!token) return null;

    try {
      const payload = await this.authenticateToken(token);
      if (!payload?.sub) return null;

      return {
        id: payload.sub,
        email: (payload.email as string) ?? undefined,
        name: (payload.name as string) ?? undefined,
        avatarUrl: (payload.picture as string) ?? undefined,
      };
    } catch {
      return null;
    }
  }

  async getUser(userId: string): Promise<EEUser | null> {
    // Auth0 user lookup requires Management API token
    // Return minimal user object from available data
    return {
      id: userId,
    };
  }

  getUserProfileUrl(user: EEUser): string {
    return `/user/${user.id}`;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Check if SSO is enabled (OAuth credentials are configured).
   */
  isSSOEnabled(): boolean {
    return this.ssoEnabled;
  }

  /**
   * Build consistent cookie attribute string for set/clear operations.
   */
  private cookieFlags(maxAge: number): string {
    const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
    return this.secureCookies ? `${flags}; Secure` : flags;
  }

  /**
   * Extract user from the encrypted SSO session cookie.
   */
  private async getUserFromSessionCookie(
    request: Request | { header(name: string): string | undefined },
  ): Promise<EEUser | null> {
    const cookie =
      'header' in request && typeof (request as any).header === 'function'
        ? (request as any).header('cookie')
        : (request as Request).headers?.get('cookie');
    if (!cookie) return null;

    const match = cookie.match(new RegExp(`${this.cookieName}=([^;]+)`));
    if (!match?.[1]) return null;

    try {
      const sessionData = (await decryptSession(decodeURIComponent(match[1]), this.cookiePassword)) as {
        user: EEUser;
        expiresAt: number;
      };

      if (sessionData.expiresAt < Date.now()) {
        return null; // Session expired
      }

      return sessionData.user;
    } catch {
      return null; // Invalid/corrupt cookie
    }
  }

  // ============================================================================
  // Dynamic ISSOProvider attachment (only when OAuth is configured)
  // ============================================================================

  /**
   * Dynamically attach ISSOProvider methods to this instance.
   * This ensures duck-typing detection only finds these methods when SSO is configured.
   */
  private _attachSSOProvider() {
    const self = this;

    (this as unknown as ISSOProvider<EEUser>).getLoginUrl = function (redirectUri: string, state: string): string {
      // State format from server: "uuid|encodedRedirect"
      const stateId = state.includes('|') ? state.split('|')[0]! : state;

      // Store state ID with redirect_uri for validation (expires in 10 minutes)
      const actualRedirectUri = redirectUri ?? self._redirectUri;
      if (!actualRedirectUri) {
        throw new Error('Redirect URI is required for SSO. Set AUTH0_REDIRECT_URI or pass redirectUri option.');
      }
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
        client_id: self.clientId!,
        response_type: 'code',
        scope: self.scopes.join(' '),
        redirect_uri: actualRedirectUri,
        state,
      });

      return `https://${self.domain}/authorize?${params.toString()}`;
    };

    (this as unknown as ISSOProvider<EEUser>).handleCallback = async function (
      code: string,
      stateId: string,
    ): Promise<SSOCallbackResult<EEUser>> {
      // Validate state parameter
      const stored = stateStore.get(stateId);
      if (!stored) {
        throw new Error('Invalid or expired state parameter');
      }
      stateStore.delete(stateId);

      if (stored.expiresAt < Date.now()) {
        throw new Error('State parameter has expired');
      }

      // Exchange code for tokens
      const tokenResponse = await fetch(`https://${self.domain}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: self.clientId,
          client_secret: self.clientSecret,
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
        id_token?: string;
        refresh_token?: string;
        expires_in: number;
        token_type: string;
      };

      // Get user info from ID token or userinfo endpoint
      let user: EEUser;
      if (tokens.id_token) {
        try {
          const JWKS = createRemoteJWKSet(new URL(`https://${self.domain}/.well-known/jwks.json`));
          const { payload } = await jwtVerify(tokens.id_token, JWKS, {
            issuer: `https://${self.domain}/`,
          });
          user = {
            id: payload.sub!,
            email: (payload.email as string) ?? undefined,
            name: (payload.name as string) ?? undefined,
            avatarUrl: (payload.picture as string) ?? undefined,
          };
        } catch {
          // Fall back to userinfo if ID token verification fails
          user = await self._fetchUserInfo(tokens.access_token);
        }
      } else {
        user = await self._fetchUserInfo(tokens.access_token);
      }

      // Create encrypted session cookie
      const sessionData = {
        user,
        expiresAt: Date.now() + self.cookieMaxAge * 1000,
      };

      const encryptedSession = await encryptSession(sessionData, self.cookiePassword);
      const cookieValue = `${self.cookieName}=${encodeURIComponent(encryptedSession)}; ${self.cookieFlags(self.cookieMaxAge)}`;

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
    };

    (this as unknown as ISSOProvider<EEUser>).getLoginButtonConfig = function (): SSOLoginConfig {
      return {
        provider: 'auth0',
        text: 'Sign in with Auth0',
        description: 'Sign in using your Auth0 account',
      };
    };

    (this as unknown as ISSOProvider<EEUser>).getLoginCookies = function (_state: string): string[] {
      return [];
    };

    (this as unknown as ISSOProvider<EEUser>).getLogoutUrl = async function (
      redirectUri: string,
      _request?: Request,
    ): Promise<string | null> {
      // Auth0 supports RP-Initiated Logout
      const params = new URLSearchParams({
        client_id: self.clientId!,
        returnTo: redirectUri,
      });
      return `https://${self.domain}/v2/logout?${params.toString()}`;
    };
  }

  /**
   * Fetch user info from Auth0's /userinfo endpoint.
   */
  private async _fetchUserInfo(accessToken: string): Promise<EEUser> {
    const userInfoResponse = await fetch(`https://${this.domain}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info from Auth0');
    }

    const userInfo = (await userInfoResponse.json()) as {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    return {
      id: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      avatarUrl: userInfo.picture,
    };
  }

  // ============================================================================
  // Dynamic ISessionProvider attachment (only when OAuth is configured)
  // ============================================================================

  /**
   * Dynamically attach ISessionProvider methods to this instance.
   */
  private _attachSessionProvider() {
    const self = this;

    (this as unknown as ISessionProvider<Session>).createSession = async function (
      userId: string,
      metadata?: Record<string, unknown>,
    ): Promise<Session> {
      const now = new Date();
      return {
        id: crypto.randomUUID(),
        userId,
        createdAt: now,
        expiresAt: new Date(now.getTime() + self.cookieMaxAge * 1000),
        metadata,
      };
    };

    // Cookie-only sessions — validation happens via decryption in getUserFromSessionCookie/authenticateToken
    (this as unknown as ISessionProvider<Session>).validateSession = async function (
      _sessionId: string,
    ): Promise<Session | null> {
      return null;
    };

    // Cookie-only sessions — destruction happens via getClearSessionHeaders setting Max-Age=0
    (this as unknown as ISessionProvider<Session>).destroySession = async function (
      _sessionId: string,
    ): Promise<void> {};

    // Cookie-only sessions — refresh not supported; user must re-authenticate after expiry
    (this as unknown as ISessionProvider<Session>).refreshSession = async function (
      _sessionId: string,
    ): Promise<Session | null> {
      return null;
    };

    (this as unknown as ISessionProvider<Session>).getSessionIdFromRequest = function (
      request: Request,
    ): string | null {
      const cookie = request.headers.get('Cookie');
      if (!cookie) return null;
      const match = cookie.match(new RegExp(`${self.cookieName}=([^;]+)`));
      return match?.[1] ? decodeURIComponent(match[1]) : null;
    };

    (this as unknown as ISessionProvider<Session>).getSessionHeaders = function (
      _session: Session,
    ): Record<string, string> {
      return {};
    };

    (this as unknown as ISessionProvider<Session>).getClearSessionHeaders = function (): Record<string, string> {
      return {
        'Set-Cookie': `${self.cookieName}=; ${self.cookieFlags(0)}`,
      };
    };
  }
}
