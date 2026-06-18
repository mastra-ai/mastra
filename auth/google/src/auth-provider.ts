/**
 * MastraAuthGoogle - Google OpenID Connect authentication provider.
 *
 * Supports Google OAuth 2.0 / OIDC login, encrypted session cookies, Bearer ID
 * token verification, and Google Workspace hosted-domain restrictions.
 */

import type {
  ISSOProvider,
  ISessionProvider,
  IUserProvider,
  Session,
  SSOCallbackResult,
  SSOLoginConfig,
} from '@mastra/core/auth';
import { MastraAuthProvider } from '@mastra/core/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

import type { GoogleUser, MastraAuthGoogleOptions } from './types';
import { mapGoogleClaimsToUser } from './types';

type HonoRequestLike = {
  raw?: Request;
  headers?: Headers;
  header(name: string): string | undefined;
};

type MastraAuthRequest = Request | HonoRequestLike;

const GOOGLE_AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

const DEFAULT_COOKIE_NAME = 'google_session';
const DEFAULT_COOKIE_MAX_AGE = 86400;
const DEFAULT_SCOPES = ['openid', 'profile', 'email'];
const STATE_TOKEN_EXPIRY_MS = 10 * 60 * 1000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

interface StatePayload {
  /** Original state from caller. */
  s: string;
  /** Redirect URI used for token exchange. */
  r: string;
  /** Expiry timestamp. */
  e: number;
  /** OIDC nonce tied to the ID token. */
  n: string;
}

function getRequestHeader(request: MastraAuthRequest, name: string): string | null {
  if (request instanceof Request) {
    return request.headers.get(name);
  }

  return request.raw?.headers.get(name) ?? request.headers?.get(name) ?? request.header(name) ?? null;
}

function normalizeDomain(domain: string | undefined | null): string | undefined {
  const normalized = domain?.trim().toLowerCase().replace(/^@/, '');
  return normalized || undefined;
}

function normalizeAllowedDomains(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const parts = Array.isArray(value) ? value : value.split(',');
  return Array.from(new Set(parts.map(normalizeDomain).filter((domain): domain is string => !!domain)));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getServerRedirectStateSuffix(state: string): string {
  const separatorIndex = state.indexOf('|');
  return separatorIndex === -1 ? '' : state.slice(separatorIndex);
}

function getStateTokenFromCallbackState(state: string): string {
  const separatorIndex = state.indexOf('|');
  return separatorIndex === -1 ? state : state.slice(0, separatorIndex);
}

function verifyCallbackStateSuffix(callbackState: string, originalState: string): void {
  const callbackSuffix = getServerRedirectStateSuffix(callbackState);
  if (!callbackSuffix) return;

  if (callbackSuffix !== getServerRedirectStateSuffix(originalState)) {
    throw new Error('Invalid state redirect suffix');
  }
}

function getExpirationMs(expiresAt: unknown): number | undefined {
  if (expiresAt === undefined || expiresAt === null) {
    return undefined;
  }

  if (expiresAt instanceof Date) {
    return expiresAt.getTime();
  }

  if (typeof expiresAt === 'string' || typeof expiresAt === 'number') {
    return new Date(expiresAt).getTime();
  }

  return Number.NaN;
}

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

async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  const sigBytes = new Uint8Array(signature);
  return btoa(String.fromCharCode(...sigBytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function createStateToken(
  originalState: string,
  redirectUri: string,
  nonce: string,
  secret: string,
): Promise<string> {
  const payload: StatePayload = {
    s: originalState,
    r: redirectUri,
    e: Date.now() + STATE_TOKEN_EXPIRY_MS,
    n: nonce,
  };
  const payloadB64 = btoa(JSON.stringify(payload));
  const signature = await hmacSign(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

async function verifyStateToken(
  stateToken: string,
  secret: string,
): Promise<{ originalState: string; redirectUri: string; nonce: string }> {
  const parts = stateToken.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid state token format');
  }

  const [payloadB64, signature] = parts as [string, string];
  const expectedSig = await hmacSign(payloadB64, secret);
  if (!timingSafeEqual(signature, expectedSig)) {
    throw new Error('Invalid state token signature');
  }

  let payload: StatePayload;
  try {
    payload = JSON.parse(atob(payloadB64)) as StatePayload;
  } catch {
    throw new Error('Invalid state token payload');
  }

  if (payload.e < Date.now()) {
    throw new Error('State token has expired');
  }

  return {
    originalState: payload.s,
    redirectUri: payload.r,
    nonce: payload.n,
  };
}

function hasExpired(payload: JWTPayload): boolean {
  return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
}

export class MastraAuthGoogle extends MastraAuthProvider<GoogleUser> implements IUserProvider<GoogleUser> {
  protected clientId: string;
  private clientSecret: string | null;
  private redirectUri: string | null;
  private scopes: string[];
  private cookieName: string;
  private cookieMaxAge: number;
  private cookiePassword: string;
  private secureCookies: boolean;
  private allowedDomains: string[];
  private hostedDomain?: string;
  private ssoEnabled: boolean;
  private jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(options?: MastraAuthGoogleOptions) {
    super({ name: options?.name ?? 'google' });

    const clientId = options?.clientId ?? process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error(
        'Google client ID is required. Provide it in the options or set GOOGLE_CLIENT_ID environment variable.',
      );
    }

    const allowedDomains = normalizeAllowedDomains(options?.allowedDomains ?? process.env.GOOGLE_ALLOWED_DOMAINS);
    const configuredHostedDomain = normalizeDomain(options?.hostedDomain ?? process.env.GOOGLE_HOSTED_DOMAIN);
    const clientSecret = options?.clientSecret ?? process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = options?.redirectUri ?? process.env.GOOGLE_REDIRECT_URI;
    const hasConfiguredCookiePassword = !!(options?.session?.cookiePassword ?? process.env.GOOGLE_COOKIE_PASSWORD);
    const cookiePassword =
      options?.session?.cookiePassword ??
      process.env.GOOGLE_COOKIE_PASSWORD ??
      crypto.randomUUID() + crypto.randomUUID();

    this.clientId = clientId;
    this.clientSecret = clientSecret ?? null;
    this.redirectUri = redirectUri ?? null;
    this.scopes = options?.scopes ?? DEFAULT_SCOPES;
    this.cookieName = options?.session?.cookieName ?? DEFAULT_COOKIE_NAME;
    this.cookieMaxAge = options?.session?.cookieMaxAge ?? DEFAULT_COOKIE_MAX_AGE;
    this.cookiePassword = cookiePassword;
    this.secureCookies = options?.session?.secureCookies ?? process.env.NODE_ENV === 'production';
    this.allowedDomains = allowedDomains;
    this.hostedDomain = configuredHostedDomain ?? (allowedDomains.length === 1 ? allowedDomains[0] : undefined);
    this.ssoEnabled = !!clientSecret;
    this.jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

    if (this.ssoEnabled) {
      if (cookiePassword.length < 32) {
        throw new Error(
          'Cookie password must be at least 32 characters for SSO. Set GOOGLE_COOKIE_PASSWORD environment variable.',
        );
      }

      if (!hasConfiguredCookiePassword) {
        const message =
          '[MastraAuthGoogle] GOOGLE_COOKIE_PASSWORD is required for Google SSO in production. Set GOOGLE_COOKIE_PASSWORD or pass session.cookiePassword.';
        if (process.env.NODE_ENV === 'production') {
          throw new Error(message);
        }
        console.warn(`${message} Using an auto-generated value for development only; sessions will not survive restarts.`);
      }

      this.attachSSOProvider();
      this.attachSessionProvider();
    }

    this.registerOptions(options);
  }

  async authenticateToken(token: string, request?: MastraAuthRequest): Promise<GoogleUser | null> {
    if (this.ssoEnabled && request) {
      const sessionUser = await this.getUserFromSessionCookie(request);
      if (sessionUser) return sessionUser;
    }

    if (!token || typeof token !== 'string') {
      return null;
    }

    try {
      const user = await this.verifyIdToken(token);
      return user;
    } catch {
      return null;
    }
  }

  authorizeUser(user: GoogleUser): boolean {
    if (!user?.googleId && !user?.id) return false;
    const expiresAt = getExpirationMs(user.expiresAt);
    if (expiresAt !== undefined && (!Number.isFinite(expiresAt) || expiresAt < Date.now())) return false;
    return this.isHostedDomainAllowed(user.hostedDomain);
  }

  async getCurrentUser(request: Request): Promise<GoogleUser | null> {
    if (this.ssoEnabled) {
      const sessionUser = await this.getUserFromSessionCookie(request);
      if (sessionUser) return sessionUser;
    }

    const token = this.extractBearerToken(request);
    if (!token) return null;

    return this.authenticateToken(token, request);
  }

  async getUser(_userId: string): Promise<GoogleUser | null> {
    return null;
  }

  getUserProfileUrl(user: GoogleUser): string {
    return `/user/${user.id}`;
  }

  isSSOEnabled(): boolean {
    return this.ssoEnabled;
  }

  getAllowedDomains(): string[] {
    return [...this.allowedDomains];
  }

  getHostedDomain(): string | undefined {
    return this.hostedDomain;
  }

  getClientId(): string {
    return this.clientId;
  }

  private async verifyIdToken(token: string, nonce?: string): Promise<GoogleUser> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: GOOGLE_ISSUERS,
      audience: this.clientId,
    });

    if (nonce && payload.nonce !== nonce) {
      throw new Error('Invalid Google ID token nonce');
    }

    if (hasExpired(payload)) {
      throw new Error('Google ID token has expired');
    }

    const user = mapGoogleClaimsToUser(payload);
    if (!user.googleId) {
      throw new Error('Google ID token is missing subject');
    }

    if (!this.isHostedDomainAllowed(user.hostedDomain)) {
      throw new Error('Google user is not in an allowed hosted domain');
    }

    return user;
  }

  private isHostedDomainAllowed(hostedDomain: string | undefined): boolean {
    if (this.allowedDomains.length === 0) return true;
    const domain = normalizeDomain(hostedDomain);
    if (!domain) return false;
    return this.allowedDomains.includes(domain);
  }

  private extractBearerToken(request: Request): string | null {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    return token || null;
  }

  private cookieFlags(maxAge: number): string {
    const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
    return this.secureCookies ? `${flags}; Secure` : flags;
  }

  private async getUserFromSessionCookie(request: MastraAuthRequest): Promise<GoogleUser | null> {
    const cookie = getRequestHeader(request, 'cookie');
    if (!cookie) return null;

    const match = cookie.match(new RegExp(`(?:^|;\\s*)${escapeRegex(this.cookieName)}=([^;]+)`));
    if (!match?.[1]) return null;

    try {
      const sessionData = (await decryptSession(decodeURIComponent(match[1]), this.cookiePassword)) as {
        user: Omit<GoogleUser, 'expiresAt'> & { expiresAt?: Date | number | string };
        expiresAt: number;
      };

      if (sessionData.expiresAt < Date.now()) {
        return null;
      }

      const userExpiresAt = getExpirationMs(sessionData.user.expiresAt);
      if (userExpiresAt !== undefined && (!Number.isFinite(userExpiresAt) || userExpiresAt < Date.now())) {
        return null;
      }

      const { expiresAt: _expiresAt, ...sessionUser } = sessionData.user;
      const user: GoogleUser = {
        ...sessionUser,
        ...(userExpiresAt !== undefined ? { expiresAt: new Date(userExpiresAt) } : {}),
      };

      if (!this.isHostedDomainAllowed(user.hostedDomain)) {
        return null;
      }

      return user;
    } catch {
      return null;
    }
  }

  private attachSSOProvider(): void {
    const self = this;

    (this as unknown as ISSOProvider<GoogleUser>).getLoginUrl = async function (
      redirectUri: string,
      state: string,
    ): Promise<string> {
      const actualRedirectUri = redirectUri ?? self.redirectUri;
      if (!actualRedirectUri) {
        throw new Error('Redirect URI is required for Google SSO. Set GOOGLE_REDIRECT_URI or pass redirectUri.');
      }

      const nonce = crypto.randomUUID();
      const signedState = await createStateToken(state, actualRedirectUri, nonce, self.cookiePassword);
      const oauthState = `${signedState}${getServerRedirectStateSuffix(state)}`;
      const params = new URLSearchParams({
        client_id: self.clientId,
        response_type: 'code',
        scope: self.scopes.join(' '),
        redirect_uri: actualRedirectUri,
        state: oauthState,
        nonce,
      });

      if (self.hostedDomain) {
        params.set('hd', self.hostedDomain);
      }

      return `${GOOGLE_AUTHORIZATION_URL}?${params.toString()}`;
    };

    (this as unknown as ISSOProvider<GoogleUser>).handleCallback = async function (
      code: string,
      callbackState: string,
    ): Promise<SSOCallbackResult<GoogleUser>> {
      const signedState = getStateTokenFromCallbackState(callbackState);
      const { originalState, redirectUri, nonce } = await verifyStateToken(signedState, self.cookiePassword);
      verifyCallbackStateSuffix(callbackState, originalState);

      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: self.clientId,
          client_secret: self.clientSecret!,
          redirect_uri: redirectUri,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Google token exchange failed: ${error}`);
      }

      const tokens = (await tokenResponse.json()) as {
        access_token: string;
        id_token?: string;
        refresh_token?: string;
        expires_in: number;
        token_type: string;
      };

      if (!tokens.id_token) {
        throw new Error('Google token response did not include an ID token');
      }

      const user = await self.verifyIdToken(tokens.id_token, nonce);
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

    (this as unknown as ISSOProvider<GoogleUser>).getLoginButtonConfig = function (): SSOLoginConfig {
      return {
        provider: 'google',
        text: 'Sign in with Google',
        description: 'Sign in using your Google account',
      };
    };

    (this as unknown as ISSOProvider<GoogleUser>).getLoginCookies = function (): string[] {
      return [];
    };

    (this as unknown as ISSOProvider<GoogleUser>).getLogoutUrl = async function (): Promise<string | null> {
      return null;
    };
  }

  private attachSessionProvider(): void {
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

    (this as unknown as ISessionProvider<Session>).validateSession = async function (): Promise<Session | null> {
      return null;
    };

    (this as unknown as ISessionProvider<Session>).destroySession = async function (): Promise<void> {};

    (this as unknown as ISessionProvider<Session>).refreshSession = async function (): Promise<Session | null> {
      return null;
    };

    (this as unknown as ISessionProvider<Session>).getSessionIdFromRequest = function (
      request: Request,
    ): string | null {
      const cookie = request.headers.get('Cookie');
      if (!cookie) return null;
      const match = cookie.match(new RegExp(`(?:^|;\\s*)${escapeRegex(self.cookieName)}=([^;]+)`));
      return match?.[1] ? decodeURIComponent(match[1]) : null;
    };

    (this as unknown as ISessionProvider<Session>).getSessionHeaders = function (): Record<string, string> {
      return {};
    };

    (this as unknown as ISessionProvider<Session>).getClearSessionHeaders = function (): Record<string, string> {
      return {
        'Set-Cookie': `${self.cookieName}=; ${self.cookieFlags(0)}`,
      };
    };
  }
}
