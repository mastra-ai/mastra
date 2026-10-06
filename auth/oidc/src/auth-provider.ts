/**
 * MastraAuthOidc — generic OpenID Connect authentication provider.
 *
 * The protocol work is delegated to `openid-client`, the OpenID Foundation
 * certified relying party library: discovery, PKCE, the authorization code
 * grant, ID token validation, and RP-initiated logout. This module only maps
 * that onto Mastra's auth interfaces and manages the session cookie.
 *
 * Works with any OIDC-compliant provider (Keycloak, Authentik, Zitadel,
 * Microsoft Entra ID, Ping, Dex, …).
 */

import type {
  ISSOProvider,
  ISessionProvider,
  IUserProvider,
  MastraAuthRequest,
  Session,
  SSOCallbackResult,
} from '@internal/auth';
import { getRequestHeader } from '@internal/auth';
import { MastraAuthProvider } from '@internal/auth/provider';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import {
  ClientSecretBasic,
  ClientSecretPost,
  Configuration,
  None,
  allowInsecureRequests,
  authorizationCodeGrant,
  buildAuthorizationUrl,
  buildEndSessionUrl,
  calculatePKCECodeChallenge,
  discovery,
  randomNonce,
  randomPKCECodeVerifier,
} from 'openid-client';
import type { ClientAuth, ServerMetadata } from 'openid-client';

import { SEAL_SESSION, SEAL_STATE, deriveSessionKey, seal, stateSuffix, stateToken, unseal } from './session';
import type { MastraAuthOidcOptions, OidcTokenEndpointAuthMethod, OidcUser } from './types';
import { mapOidcClaimsToUser } from './types';

/** Default cookie name for OIDC sessions */
const DEFAULT_COOKIE_NAME = 'oidc_session';

/** Default cookie max age (24 hours) */
const DEFAULT_COOKIE_MAX_AGE = 86400;

/** Default scopes */
const DEFAULT_SCOPES = ['openid', 'profile', 'email'];

/** How long a login may stay in flight (10 minutes) */
const STATE_TTL_SECONDS = 600;

/** Timeout for provider HTTP requests, in seconds */
const REQUEST_TIMEOUT_SECONDS = 10;

/** Sealed into the OAuth state so the callback needs no server-side storage. */
interface StatePayload extends JWTPayload {
  /** The state the Mastra server generated */
  state: string;
  /** Redirect URI the authorization request used */
  redirectUri: string;
  /** Nonce bound to the ID token */
  nonce: string;
  /** PKCE code verifier, when the provider supports PKCE */
  codeVerifier?: string;
}

/** Sealed into the session cookie. */
interface SessionPayload extends JWTPayload {
  user: OidcUser;
  /** Kept for `id_token_hint` on RP-initiated logout */
  idToken?: string;
}

function parseScopes(value: string | undefined): string[] | undefined {
  const scopes = value?.split(/[\s,]+/).filter(Boolean);
  return scopes?.length ? scopes : undefined;
}

function clientAuthFor(method: OidcTokenEndpointAuthMethod, clientSecret: string): ClientAuth {
  if (method === 'client_secret_basic') return ClientSecretBasic(clientSecret);
  if (method === 'none') return None();
  return ClientSecretPost(clientSecret);
}

/** Read a named cookie out of a `Cookie` header value. */
function readCookie(header: string | null, name: string): string | undefined {
  return header
    ?.split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/**
 * Generic OpenID Connect provider for Mastra.
 *
 * Always verifies Bearer tokens against the provider's JWKS. When a client
 * secret is configured it also exposes the SSO login flow used by Studio.
 *
 * @example Bearer token verification only
 * ```typescript
 * const auth = new MastraAuthOidc({
 *   issuer: 'https://id.example.com/realms/acme',
 *   clientId: 'mastra',
 * });
 * ```
 *
 * @example With SSO login for Studio
 * ```typescript
 * const auth = new MastraAuthOidc({
 *   issuer: 'https://id.example.com/realms/acme',
 *   clientId: 'mastra',
 *   clientSecret: process.env.OIDC_CLIENT_SECRET,
 *   redirectUri: 'http://localhost:4111/api/auth/sso/callback',
 *   label: 'Keycloak',
 *   session: { cookiePassword: process.env.OIDC_COOKIE_PASSWORD },
 * });
 * ```
 */
export class MastraAuthOidc extends MastraAuthProvider<OidcUser> implements IUserProvider<OidcUser> {
  protected issuer: string;
  protected clientId: string;
  private clientSecret?: string;
  private serverMetadata?: ServerMetadata;
  private tokenEndpointAuthMethod: OidcTokenEndpointAuthMethod;
  private insecure: boolean;
  private audience: string | string[];
  private scopes: string[];
  private label: string;
  private mapClaims: (payload: JWTPayload) => OidcUser;
  private redirectUri: string | null;
  private cookieName: string;
  private cookieMaxAge: number;
  private cookiePassword: string;
  private secureCookies: boolean;
  private ssoEnabled: boolean;
  private configPromise?: Promise<Configuration>;
  private keyPromise?: Promise<Uint8Array>;
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(options?: MastraAuthOidcOptions) {
    super({ name: options?.name ?? 'oidc' });

    const issuer = options?.issuer ?? process.env.OIDC_ISSUER;
    const clientId = options?.clientId ?? process.env.OIDC_CLIENT_ID;

    if (!issuer) {
      throw new Error(
        'OIDC issuer is required. Provide it in the options or set the OIDC_ISSUER environment variable.',
      );
    }

    if (!clientId) {
      throw new Error(
        'OIDC client ID is required. Provide it in the options or set the OIDC_CLIENT_ID environment variable.',
      );
    }

    const clientSecret = options?.clientSecret ?? process.env.OIDC_CLIENT_SECRET;
    const hasConfiguredCookiePassword = !!(options?.session?.cookiePassword ?? process.env.OIDC_COOKIE_PASSWORD);
    const cookiePassword =
      options?.session?.cookiePassword ?? process.env.OIDC_COOKIE_PASSWORD ?? crypto.randomUUID() + crypto.randomUUID();

    this.issuer = issuer;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.serverMetadata = options?.serverMetadata;
    this.tokenEndpointAuthMethod = options?.tokenEndpointAuthMethod ?? 'client_secret_post';
    this.insecure = options?.allowInsecureRequests ?? false;
    this.audience = options?.audience ?? process.env.OIDC_AUDIENCE ?? clientId;
    this.scopes = options?.scopes ?? parseScopes(process.env.OIDC_SCOPES) ?? DEFAULT_SCOPES;
    this.label = options?.label ?? 'SSO';
    this.mapClaims = options?.mapClaims ?? mapOidcClaimsToUser;
    this.redirectUri = options?.redirectUri ?? process.env.OIDC_REDIRECT_URI ?? null;
    this.cookieName = options?.session?.cookieName ?? DEFAULT_COOKIE_NAME;
    this.cookieMaxAge = options?.session?.cookieMaxAge ?? DEFAULT_COOKIE_MAX_AGE;
    this.cookiePassword = cookiePassword;
    this.secureCookies = options?.session?.secureCookies ?? process.env.NODE_ENV === 'production';
    this.ssoEnabled = !!clientSecret;

    if (this.ssoEnabled) {
      if (cookiePassword.length < 32) {
        throw new Error(
          'Cookie password must be at least 32 characters for SSO. Set the OIDC_COOKIE_PASSWORD environment variable.',
        );
      }

      if (!hasConfiguredCookiePassword) {
        const message =
          '[MastraAuthOidc] OIDC_COOKIE_PASSWORD is required for SSO in production. Set OIDC_COOKIE_PASSWORD or pass session.cookiePassword.';
        if (process.env.NODE_ENV === 'production') {
          throw new Error(message);
        }
        console.warn(
          `${message} Using an auto-generated value for development only; sessions will not survive restarts.`,
        );
      }

      // Assigned onto the instance rather than declared on the class so the
      // server's duck-typing only finds these when SSO can actually complete.
      Object.assign(this, this.ssoProvider(), this.sessionProvider());
    }

    this.registerOptions(options);
  }

  // ============================================================================
  // MastraAuthProvider
  // ============================================================================

  async authenticateToken(token: string, request?: MastraAuthRequest): Promise<OidcUser | null> {
    if (this.ssoEnabled && request) {
      const session = await this.readSession(getRequestHeader(request, 'cookie'));
      if (session) return session.user;
    }

    if (!token || typeof token !== 'string') {
      return null;
    }

    try {
      // The resolved metadata is authoritative: discovery guarantees it matches
      // the configured issuer, and a caller-supplied `serverMetadata` wins.
      const config = await this.getConfig();
      const { payload } = await jwtVerify(token, await this.getJwks(), {
        issuer: config.serverMetadata().issuer,
        audience: this.audience,
      });
      const user = this.mapClaims(payload);
      return user.id ? user : null;
    } catch (error) {
      // Logged, not thrown: an unverifiable token is a 401, but a misconfigured
      // issuer or audience is otherwise indistinguishable from a bad token.
      this.logger.debug('OIDC token verification failed', { error });
      return null;
    }
  }

  authorizeUser(user: OidcUser): boolean {
    return !!user?.id;
  }

  // ============================================================================
  // IUserProvider
  // ============================================================================

  async getCurrentUser(request: Request): Promise<OidcUser | null> {
    if (this.ssoEnabled) {
      const session = await this.readSession(request.headers.get('cookie'));
      if (session) return session.user;
    }

    const token = request.headers
      .get('Authorization')
      ?.replace(/^Bearer\s+/i, '')
      .trim();
    return token ? this.authenticateToken(token, request) : null;
  }

  /**
   * Look up a user by ID. OpenID Connect has no standard user lookup API, so
   * this always returns null — the current user comes from the request.
   */
  async getUser(_userId: string): Promise<OidcUser | null> {
    return null;
  }

  getUserProfileUrl(user: OidcUser): string {
    return `/user/${user.id}`;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /** Whether the SSO login flow is enabled (a client secret is configured). */
  isSSOEnabled(): boolean {
    return this.ssoEnabled;
  }

  /** The configured issuer URL. */
  getIssuer(): string {
    return this.issuer;
  }

  /** The configured client ID. */
  getClientId(): string {
    return this.clientId;
  }

  /**
   * The `openid-client` configuration for this provider, running discovery on
   * first use. A failed attempt isn't cached, so the next call retries.
   */
  async getConfig(): Promise<Configuration> {
    this.configPromise ??= this.createConfig();

    try {
      return await this.configPromise;
    } catch (error) {
      this.configPromise = undefined;
      throw error;
    }
  }

  private async createConfig(): Promise<Configuration> {
    const clientAuth = this.clientSecret ? clientAuthFor(this.tokenEndpointAuthMethod, this.clientSecret) : None();

    // Caller-supplied metadata skips the discovery request entirely.
    const config = this.serverMetadata
      ? new Configuration(this.serverMetadata, this.clientId, this.clientSecret, clientAuth)
      : await discovery(new URL(this.issuer), this.clientId, this.clientSecret, clientAuth, {
          execute: this.insecure ? [allowInsecureRequests] : undefined,
        });

    if (this.insecure && this.serverMetadata) {
      allowInsecureRequests(config);
    }

    config.timeout = REQUEST_TIMEOUT_SECONDS;
    return config;
  }

  private async getJwks(): Promise<ReturnType<typeof createRemoteJWKSet>> {
    if (!this.jwks) {
      const jwksUri = (await this.getConfig()).serverMetadata().jwks_uri;
      if (!jwksUri) {
        throw new Error('OIDC provider does not publish a jwks_uri, so Bearer tokens cannot be verified');
      }
      this.jwks = createRemoteJWKSet(new URL(jwksUri));
    }
    return this.jwks;
  }

  /** The AES key for session cookies and state, derived once and reused. */
  private async getKey(): Promise<Uint8Array> {
    this.keyPromise ??= deriveSessionKey(this.cookiePassword);
    return this.keyPromise;
  }

  private cookieFlags(maxAge: number): string {
    const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
    return this.secureCookies ? `${flags}; Secure` : flags;
  }

  /** Decrypt the session cookie. Expiry is enforced by the sealed token's `exp`. */
  private async readSession(cookieHeader: string | null): Promise<SessionPayload | null> {
    const value = readCookie(cookieHeader, this.cookieName);
    if (!value) return null;

    try {
      return await unseal<SessionPayload>(value, await this.getKey(), SEAL_SESSION);
    } catch {
      return null;
    }
  }

  // ============================================================================
  // ISSOProvider
  // ============================================================================

  private ssoProvider(): ISSOProvider<OidcUser> {
    return {
      getLoginUrl: async (redirectUri: string, state: string): Promise<string> => {
        const actualRedirectUri = redirectUri ?? this.redirectUri;
        if (!actualRedirectUri) {
          throw new Error('Redirect URI is required for OIDC SSO. Set OIDC_REDIRECT_URI or pass redirectUri.');
        }

        const config = await this.getConfig();
        const nonce = randomNonce();
        const parameters: Record<string, string> = {
          redirect_uri: actualRedirectUri,
          scope: this.scopes.join(' '),
          nonce,
        };

        let codeVerifier: string | undefined;
        if (config.serverMetadata().supportsPKCE()) {
          codeVerifier = randomPKCECodeVerifier();
          parameters.code_challenge = await calculatePKCECodeChallenge(codeVerifier);
          parameters.code_challenge_method = 'S256';
        }

        const payload: StatePayload = { state, redirectUri: actualRedirectUri, nonce, codeVerifier };
        const sealed = await seal(payload, await this.getKey(), STATE_TTL_SECONDS, SEAL_STATE);
        // The Mastra server appends its post-login redirect after a `|`.
        parameters.state = `${sealed}${stateSuffix(state)}`;

        return buildAuthorizationUrl(config, parameters).href;
      },

      handleCallback: async (code: string, callbackState: string): Promise<SSOCallbackResult<OidcUser>> => {
        const sealed = stateToken(callbackState);
        const { state, redirectUri, nonce, codeVerifier } = await unseal<StatePayload>(
          sealed,
          await this.getKey(),
          SEAL_STATE,
        );

        const suffix = stateSuffix(callbackState);
        if (suffix && suffix !== stateSuffix(state)) {
          throw new Error('Invalid state redirect suffix');
        }

        // openid-client reads the grant parameters off the callback URL and
        // derives redirect_uri from it, so rebuild the URL the provider used.
        const currentUrl = new URL(redirectUri);
        currentUrl.searchParams.set('code', code);
        currentUrl.searchParams.set('state', sealed);

        const tokens = await authorizationCodeGrant(await this.getConfig(), currentUrl, {
          expectedState: sealed,
          expectedNonce: nonce,
          pkceCodeVerifier: codeVerifier,
          idTokenExpected: true,
        });

        // Defence in depth: `expectedNonce` already makes openid-client require
        // and validate an ID token, so a response without one is rejected before
        // reaching here. Kept because `claims()` is optional in the type.
        const claims = tokens.claims();
        if (!claims) {
          throw new Error('OIDC token response did not include an ID token');
        }

        const user = this.mapClaims(claims as JWTPayload);
        if (!user.id) {
          throw new Error('OIDC ID token is missing a subject');
        }

        const session: SessionPayload = { user, idToken: tokens.id_token };
        const cookie = await seal(session, await this.getKey(), this.cookieMaxAge, SEAL_SESSION);
        const expiresIn = tokens.expiresIn();

        return {
          user,
          tokens: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            idToken: tokens.id_token,
            expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
          },
          cookies: [`${this.cookieName}=${cookie}; ${this.cookieFlags(this.cookieMaxAge)}`],
        };
      },

      getLogoutUrl: async (redirectUri: string, request?: Request): Promise<string | null> => {
        const config = await this.getConfig();
        if (!config.serverMetadata().end_session_endpoint) return null;

        const parameters: Record<string, string> = { post_logout_redirect_uri: redirectUri };

        // Most providers need id_token_hint to skip the logout confirmation prompt.
        const idToken = request ? (await this.readSession(request.headers.get('cookie')))?.idToken : undefined;
        if (idToken) {
          parameters.id_token_hint = idToken;
        }

        return buildEndSessionUrl(config, parameters).href;
      },

      getLoginButtonConfig: () => ({
        provider: 'oidc',
        text: `Sign in with ${this.label}`,
        description: `Sign in using your ${this.label} account`,
      }),

      getLoginCookies: () => [],
    };
  }

  // ============================================================================
  // ISessionProvider — cookie-only sessions, nothing is stored server-side.
  // ============================================================================

  private sessionProvider(): ISessionProvider<Session> {
    return {
      createSession: async (userId: string, metadata?: Record<string, unknown>): Promise<Session> => {
        const now = new Date();
        return {
          id: crypto.randomUUID(),
          userId,
          createdAt: now,
          expiresAt: new Date(now.getTime() + this.cookieMaxAge * 1000),
          metadata,
        };
      },

      // Validation happens by decrypting the cookie, not by session id.
      validateSession: async () => null,

      // Sessions are destroyed by clearing the cookie.
      destroySession: async () => {},

      // Refresh is not supported; users re-authenticate after the cookie expires.
      refreshSession: async () => null,

      getSessionIdFromRequest: (request: Request) => readCookie(request.headers.get('cookie'), this.cookieName) ?? null,

      getSessionHeaders: () => ({}),

      getClearSessionHeaders: () => ({
        'Set-Cookie': `${this.cookieName}=; ${this.cookieFlags(0)}`,
      }),
    };
  }
}
