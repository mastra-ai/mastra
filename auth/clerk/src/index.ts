import { createClerkClient } from '@clerk/backend';
import type { ClerkClient } from '@clerk/backend';
import { verifyJwks } from '@mastra/auth';
import type { JwtPayload } from '@mastra/auth';
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

type ClerkUser = JwtPayload;

/** Default cookie name for Clerk SSO sessions */
const DEFAULT_COOKIE_NAME = 'clerk_session';

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

/**
 * Derive the Frontend API (FAPI) URL from a Clerk publishable key.
 * The publishable key is: prefix + base64(fapiDomain + "$")
 */
function deriveFapiUrl(publishableKey: string): string {
  const withoutPrefix = publishableKey.replace(/^pk_(test|live)_/, '');
  const decoded = atob(withoutPrefix);
  const domain = decoded.replace(/\$$/, '');
  return `https://${domain}`;
}

interface MastraAuthClerkSessionOptions {
  /** Cookie name for the session (default: 'clerk_session') */
  cookieName?: string;
  /** Cookie max age in seconds (default: 86400 = 24 hours) */
  cookieMaxAge?: number;
  /** Cookie encryption password (min 32 chars). Falls back to CLERK_COOKIE_PASSWORD env var */
  cookiePassword?: string;
  /** Use Secure flag on cookies (default: true in production) */
  secureCookies?: boolean;
}

interface MastraAuthClerkOptions extends MastraAuthProviderOptions<ClerkUser> {
  jwksUri?: string;
  secretKey?: string;
  publishableKey?: string;
  /**
   * OAuth Client ID for Clerk as IdP (SSO).
   * Create an OAuth Application in the Clerk Dashboard to get this.
   * Falls back to CLERK_OAUTH_CLIENT_ID env var.
   */
  oauthClientId?: string;
  /**
   * OAuth Client Secret for Clerk as IdP (SSO).
   * Falls back to CLERK_OAUTH_CLIENT_SECRET env var.
   */
  oauthClientSecret?: string;
  /**
   * OAuth redirect URI for the SSO callback.
   * Falls back to CLERK_OAUTH_REDIRECT_URI env var.
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
  session?: MastraAuthClerkSessionOptions;
}

/**
 * Clerk authentication provider for Mastra.
 *
 * Always implements IUserProvider for JWT-based user detection.
 *
 * When OAuth credentials are configured (oauthClientId + oauthClientSecret),
 * also dynamically adds ISSOProvider + ISessionProvider methods for Studio login
 * using Clerk as an OAuth 2.0 / OIDC Identity Provider.
 *
 * @example Basic usage (IUserProvider only — validates JWTs)
 * ```typescript
 * const auth = new MastraAuthClerk({
 *   jwksUri: 'https://your-app.clerk.accounts.dev/.well-known/jwks.json',
 *   secretKey: 'sk_test_...',
 *   publishableKey: 'pk_test_...',
 * });
 * ```
 *
 * @example With SSO for Studio login
 * ```typescript
 * const auth = new MastraAuthClerk({
 *   jwksUri: 'https://your-app.clerk.accounts.dev/.well-known/jwks.json',
 *   secretKey: 'sk_test_...',
 *   publishableKey: 'pk_test_...',
 *   oauthClientId: 'your-oauth-client-id',
 *   oauthClientSecret: 'your-oauth-client-secret',
 * });
 * ```
 */
export class MastraAuthClerk extends MastraAuthProvider<ClerkUser> implements IUserProvider<EEUser> {
  protected clerk: ClerkClient;
  protected jwksUri: string;
  protected publishableKey: string;
  protected fapiUrl: string;

  // SSO fields
  private oauthClientId: string | null;
  private oauthClientSecret: string | null;
  private _redirectUri: string | null;
  private scopes: string[];
  private cookieName: string;
  private cookieMaxAge: number;
  private cookiePassword: string;
  private secureCookies: boolean;
  private ssoEnabled: boolean;

  constructor(options?: MastraAuthClerkOptions) {
    super({ name: options?.name ?? 'clerk' });

    const jwksUri = options?.jwksUri ?? process.env.CLERK_JWKS_URI;
    const secretKey = options?.secretKey ?? process.env.CLERK_SECRET_KEY;
    const publishableKey = options?.publishableKey ?? process.env.CLERK_PUBLISHABLE_KEY;

    if (!jwksUri || !secretKey || !publishableKey) {
      throw new Error(
        'Clerk JWKS URI, secret key and publishable key are required, please provide them in the options or set the environment variables CLERK_JWKS_URI, CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY',
      );
    }

    this.jwksUri = jwksUri;
    this.publishableKey = publishableKey;
    this.fapiUrl = deriveFapiUrl(publishableKey);
    this.clerk = createClerkClient({
      secretKey,
      publishableKey,
    });

    // SSO configuration (optional — enables Studio login)
    const oauthClientId = options?.oauthClientId ?? process.env.CLERK_OAUTH_CLIENT_ID;
    const oauthClientSecret = options?.oauthClientSecret ?? process.env.CLERK_OAUTH_CLIENT_SECRET;
    const redirectUri = options?.redirectUri ?? process.env.CLERK_OAUTH_REDIRECT_URI;
    const cookiePassword =
      options?.session?.cookiePassword ??
      process.env.CLERK_COOKIE_PASSWORD ??
      crypto.randomUUID() + crypto.randomUUID();

    this.oauthClientId = oauthClientId ?? null;
    this.oauthClientSecret = oauthClientSecret ?? null;
    this._redirectUri = redirectUri ?? null;
    this.scopes = options?.scopes ?? DEFAULT_SCOPES;
    this.cookieName = options?.session?.cookieName ?? DEFAULT_COOKIE_NAME;
    this.cookieMaxAge = options?.session?.cookieMaxAge ?? DEFAULT_COOKIE_MAX_AGE;
    this.cookiePassword = cookiePassword;
    this.secureCookies = options?.session?.secureCookies ?? process.env.NODE_ENV === 'production';

    // SSO is enabled when OAuth credentials are configured
    this.ssoEnabled = !!(oauthClientId && oauthClientSecret);

    if (this.ssoEnabled) {
      if (cookiePassword.length < 32) {
        throw new Error(
          'Cookie password must be at least 32 characters for SSO. Set CLERK_COOKIE_PASSWORD environment variable.',
        );
      }

      if (!options?.session?.cookiePassword && !process.env.CLERK_COOKIE_PASSWORD) {
        console.warn(
          '[MastraAuthClerk] No cookie password set — using auto-generated value. Sessions will not survive restarts. Set CLERK_COOKIE_PASSWORD for production use.',
        );
      }

      // Dynamically add ISSOProvider + ISessionProvider methods
      // so that duck-typing detection (implementsInterface) only finds them when SSO is configured
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
  ): Promise<ClerkUser | null> {
    // When SSO is enabled, try the encrypted session cookie first (like Okta pattern).
    // The auth middleware may call this with an empty token for browser requests
    // that only carry a session cookie.
    if (this.ssoEnabled && request) {
      const sessionUser = await this.getUserFromSessionCookie(request as Request);
      if (sessionUser) return sessionUser as unknown as ClerkUser;
    }

    // Fall back to JWT verification from Authorization header
    if (!token || typeof token !== 'string') {
      return null;
    }

    try {
      const user = await verifyJwks(token, this.jwksUri);
      return user;
    } catch {
      return null;
    }
  }

  async authorizeUser(user: ClerkUser) {
    // Session cookie users have `id`, JWT users have `sub`
    return !!(user.sub || (user as unknown as EEUser).id);
  }

  // ============================================================================
  // IUserProvider Implementation
  // ============================================================================

  /**
   * Extract the bearer token from the request's Authorization header or __session cookie.
   */
  private extractToken(request: Request): string | null {
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token) return token;
    }

    const cookie = request.headers.get('Cookie');
    if (cookie) {
      // Clerk's default session cookie is __session
      const match = cookie.match(/__session=([^;]+)/);
      if (match?.[1]) return match[1];
    }

    return null;
  }

  async getCurrentUser(request: Request): Promise<EEUser | null> {
    // First try to get user from our SSO session cookie
    if (this.ssoEnabled) {
      const sessionUser = await this.getUserFromSessionCookie(request);
      if (sessionUser) return sessionUser;
    }

    // Fall back to token-based auth (Authorization header or __session cookie)
    const token = this.extractToken(request);
    if (!token) return null;

    try {
      const payload = await this.authenticateToken(token);
      if (!payload?.sub) return null;

      // Try to fetch full user details from Clerk API
      try {
        const clerkUser = await this.clerk.users.getUser(payload.sub);
        return {
          id: clerkUser.id,
          email: clerkUser.emailAddresses?.[0]?.emailAddress,
          name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || undefined,
          avatarUrl: clerkUser.imageUrl,
          metadata: clerkUser.publicMetadata as Record<string, unknown> | undefined,
        };
      } catch {
        // Fall back to JWT claims if Clerk API call fails
        return {
          id: payload.sub,
          email: (payload.email as string) ?? undefined,
          name: (payload.name as string) ?? undefined,
        };
      }
    } catch {
      return null;
    }
  }

  async getUser(userId: string): Promise<EEUser | null> {
    try {
      const clerkUser = await this.clerk.users.getUser(userId);
      return {
        id: clerkUser.id,
        email: clerkUser.emailAddresses?.[0]?.emailAddress,
        name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || undefined,
        avatarUrl: clerkUser.imageUrl,
        metadata: clerkUser.publicMetadata as Record<string, unknown> | undefined,
      };
    } catch {
      return null;
    }
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
   * Get the derived Frontend API URL.
   */
  getFapiUrl(): string {
    return this.fapiUrl;
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
    // Handle both standard Request and HonoRequest (.header() vs .headers.get())
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
      stateStore.set(stateId, {
        expiresAt: Date.now() + 10 * 60 * 1000,
        redirectUri: actualRedirectUri!,
      });

      // Clean up expired states
      for (const [key, value] of stateStore.entries()) {
        if (value.expiresAt < Date.now()) {
          stateStore.delete(key);
        }
      }

      const params = new URLSearchParams({
        client_id: self.oauthClientId!,
        response_type: 'code',
        scope: self.scopes.join(' '),
        redirect_uri: actualRedirectUri!,
        state,
      });

      return `${self.fapiUrl}/oauth/authorize?${params.toString()}`;
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

      // Exchange code for tokens using client_secret (confidential client)
      const tokenResponse = await fetch(`${self.fapiUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${self.oauthClientId}:${self.oauthClientSecret}`)}`,
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
        id_token?: string;
        refresh_token?: string;
        expires_in: number;
        token_type: string;
      };

      // Get user info — try ID token first, fall back to userinfo endpoint
      let user: EEUser;
      if (tokens.id_token) {
        const payload = await verifyJwks(tokens.id_token, self.jwksUri);
        user = {
          id: payload.sub!,
          email: (payload.email as string) ?? undefined,
          name: (payload.name as string) ?? undefined,
          avatarUrl: (payload.picture as string) ?? undefined,
        };
      } else {
        const userInfoResponse = await fetch(`${self.fapiUrl}/oauth/userinfo`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        if (!userInfoResponse.ok) {
          throw new Error('Failed to fetch user info from Clerk');
        }

        const userInfo = (await userInfoResponse.json()) as {
          sub: string;
          email?: string;
          name?: string;
          picture?: string;
        };
        user = {
          id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          avatarUrl: userInfo.picture,
        };
      }

      // Try to enrich user with full Clerk data
      try {
        const fullUser = await self.getUser(user.id);
        if (fullUser) {
          user = fullUser;
        }
      } catch {
        // Use the user info we already have
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
        provider: 'clerk',
        text: 'Sign in with Clerk',
        description: 'Sign in using your Clerk account',
      };
    };

    (this as unknown as ISSOProvider<EEUser>).getLoginCookies = function (_state: string): string[] {
      return [];
    };

    (this as unknown as ISSOProvider<EEUser>).getLogoutUrl = async function (
      _redirectUri: string,
      _request?: Request,
    ): Promise<string | null> {
      return null;
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
