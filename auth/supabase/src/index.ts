import type {
  ICredentialsProvider,
  ISessionProvider,
  ISSOProvider,
  IUserProvider,
  CredentialsResult,
  Session,
  SSOCallbackResult,
  SSOLoginConfig,
} from '@mastra/core/auth';
import type { EEUser } from '@mastra/core/auth/ee';
import type { MastraAuthProviderOptions } from '@mastra/core/server';
import { MastraAuthProvider } from '@mastra/core/server';

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/** Default cookie name for Supabase sessions */
const DEFAULT_COOKIE_NAME = 'supabase_session';

/** Default cookie max age (24 hours) */
const DEFAULT_COOKIE_MAX_AGE = 86400;

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

/** Default timeout for OAuth state entries (10 minutes) */
const STATE_TIMEOUT_MS = 10 * 60 * 1000;

interface MastraAuthSupabaseSessionOptions {
  /** Cookie name for the session (default: 'supabase_session') */
  cookieName?: string;
  /** Cookie max age in seconds (default: 86400 = 24 hours) */
  cookieMaxAge?: number;
  /** Cookie encryption password (min 32 chars). Falls back to SUPABASE_COOKIE_PASSWORD env var */
  cookiePassword?: string;
  /** Use Secure flag on cookies (default: true in production) */
  secureCookies?: boolean;
}

interface MastraAuthSupabaseSSOOptions {
  /**
   * OAuth Client ID from Supabase OAuth Server (Authentication → OAuth Apps).
   * Falls back to SUPABASE_OAUTH_CLIENT_ID env var.
   */
  oauthClientId?: string;
  /**
   * OAuth Client Secret from Supabase OAuth Server.
   * Falls back to SUPABASE_OAUTH_CLIENT_SECRET env var.
   */
  oauthClientSecret?: string;
  /** OAuth scopes to request (default: 'openid email profile') */
  oauthScopes?: string;
  /** Display name for the SSO button. Defaults to 'Sign in with Supabase' */
  buttonText?: string;
  /** Optional icon URL for the SSO button */
  icon?: string;
  /** Optional description for the SSO login form */
  description?: string;
}

interface MastraAuthSupabaseOptions extends MastraAuthProviderOptions<User> {
  url?: string;
  anonKey?: string;
  /** Service role key for admin operations (user lookup). Falls back to SUPABASE_SERVICE_ROLE_KEY env var */
  serviceRoleKey?: string;
  /** Session configuration for credentials-based Studio login */
  session?: MastraAuthSupabaseSessionOptions;
  /** Enable sign-up via credentials (default: true) */
  enableSignUp?: boolean;
  /** SSO configuration for OAuth-based Studio login via Supabase social providers */
  sso?: MastraAuthSupabaseSSOOptions;
}

/**
 * Map a Supabase User to an EEUser for the auth system.
 */
function mapSupabaseUserToEEUser(user: User): EEUser {
  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email,
    avatarUrl: user.user_metadata?.avatar_url,
    metadata: {
      ...user.user_metadata,
      provider: user.app_metadata?.provider,
    },
  };
}

export class MastraAuthSupabase extends MastraAuthProvider<User> {
  protected supabase: SupabaseClient;
  private _supabaseUrl: string;
  private _supabaseAnonKey: string;
  private _serviceRoleKey?: string;
  private _adminClient?: SupabaseClient;
  private _enableSignUp: boolean;

  // Session config (only used when cookiePassword is set)
  private _cookieName: string;
  private _cookieMaxAge: number;
  private _cookiePassword?: string;
  private _secureCookies?: boolean;

  // SSO config (only used when oauthClientId is set)
  private _oauthClientId?: string;
  private _oauthClientSecret?: string;
  private _ssoConfig?: MastraAuthSupabaseSSOOptions;

  constructor(options?: MastraAuthSupabaseOptions) {
    super({ name: options?.name ?? 'supabase' });

    const supabaseUrl = options?.url ?? process.env.SUPABASE_URL;
    const supabaseAnonKey = options?.anonKey ?? process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Supabase URL and anon key are required, please provide them in the options or set the environment variables SUPABASE_URL and SUPABASE_ANON_KEY',
      );
    }

    this._supabaseUrl = supabaseUrl;
    this._supabaseAnonKey = supabaseAnonKey;
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Service role key for admin operations
    this._serviceRoleKey = options?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (this._serviceRoleKey) {
      this._adminClient = createClient(supabaseUrl, this._serviceRoleKey);
    }

    this._enableSignUp = options?.enableSignUp ?? true;

    // Session config
    this._cookieName = options?.session?.cookieName ?? DEFAULT_COOKIE_NAME;
    this._cookieMaxAge = options?.session?.cookieMaxAge ?? DEFAULT_COOKIE_MAX_AGE;
    this._cookiePassword = options?.session?.cookiePassword ?? process.env.SUPABASE_COOKIE_PASSWORD;
    this._secureCookies = options?.session?.secureCookies;

    // SSO config
    this._oauthClientId = options?.sso?.oauthClientId ?? process.env.SUPABASE_OAUTH_CLIENT_ID;
    this._oauthClientSecret = options?.sso?.oauthClientSecret ?? process.env.SUPABASE_OAUTH_CLIENT_SECRET;
    this._ssoConfig = options?.sso;

    // Attach IUserProvider methods
    this._attachUserProvider();

    // Attach ICredentialsProvider + ISessionProvider when cookie password is available
    if (this._cookiePassword) {
      if (this._cookiePassword.length < 32) {
        throw new Error('SUPABASE_COOKIE_PASSWORD must be at least 32 characters');
      }
      this._attachCredentialsProvider();
      this._attachSessionProvider();
    }

    // Attach ISSOProvider when OAuth client credentials are configured
    if (this._oauthClientId && this._oauthClientSecret && this._cookiePassword) {
      this._attachSSOProvider();
    }

    this.registerOptions(options);
  }

  async authenticateToken(token: string, request: any): Promise<User | null> {
    // When credentials-based login is enabled, check session cookie first
    if (this._cookiePassword && request) {
      const sessionUser = await this._getUserFromSessionCookie(request);
      if (sessionUser) {
        return sessionUser as unknown as User;
      }
    }

    if (!token || typeof token !== 'string') {
      return null;
    }

    try {
      const { data, error } = await this.supabase.auth.getUser(token);

      if (error) {
        return null;
      }

      return data.user;
    } catch {
      return null;
    }
  }

  async authorizeUser(user: User) {
    const userId = (user as unknown as EEUser)?.id ?? (user as any)?.sub;
    if (!userId) {
      return false;
    }

    // Get user data from Supabase
    const { data, error } = await this.supabase.from('users').select('isAdmin').eq('id', userId).single();

    if (error) {
      // If the users table doesn't exist or user not found, allow access
      // (authorization is optional — authenticateToken already validated the user)
      return true;
    }

    const isAdmin = data?.isAdmin;
    return !!isAdmin;
  }

  /**
   * Extract user from encrypted session cookie.
   */
  private async _getUserFromSessionCookie(request: Request): Promise<EEUser | null> {
    try {
      const cookieHeader =
        typeof (request as any).header === 'function'
          ? (request as any).header('cookie')
          : request.headers.get('Cookie');

      if (!cookieHeader) return null;

      const cookies = cookieHeader.split(';').map((c: string) => c.trim());
      const sessionCookie = cookies.find((c: string) => c.startsWith(`${this._cookieName}=`));
      if (!sessionCookie) return null;

      const encrypted = decodeURIComponent(sessionCookie.split('=').slice(1).join('='));
      const session = (await decryptSession(encrypted, this._cookiePassword!)) as {
        user: EEUser;
        expiresAt: number;
      };

      if (!session?.user || !session?.expiresAt || Date.now() > session.expiresAt) {
        return null;
      }

      return session.user;
    } catch {
      return null;
    }
  }

  /**
   * Build cookie flags string.
   */
  private _cookieFlags(request?: Request): string {
    const isSecure =
      this._secureCookies ??
      (typeof request !== 'undefined'
        ? !(new URL(request.url).hostname === 'localhost' || new URL(request.url).hostname === '127.0.0.1')
        : process.env.NODE_ENV === 'production');

    return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${this._cookieMaxAge}${isSecure ? '; Secure' : ''}`;
  }

  /**
   * Attach IUserProvider methods to the instance.
   */
  private _attachUserProvider(): void {
    const self = this;

    (this as unknown as IUserProvider<EEUser>).getCurrentUser = async function (
      request: Request,
    ): Promise<EEUser | null> {
      // Check session cookie first
      if (self._cookiePassword) {
        const sessionUser = await self._getUserFromSessionCookie(request);
        if (sessionUser) return sessionUser;
      }

      // Fall back to token-based auth
      const authHeader =
        typeof (request as any).header === 'function'
          ? (request as any).header('authorization')
          : request.headers.get('Authorization');

      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
      if (!token) return null;

      try {
        const user = await self.authenticateToken(token, request);
        if (!user) return null;
        return mapSupabaseUserToEEUser(user);
      } catch {
        return null;
      }
    };

    (this as unknown as IUserProvider<EEUser>).getUser = async function (userId: string): Promise<EEUser | null> {
      try {
        // Use admin client (service role key) for user lookup if available
        if (self._adminClient) {
          const { data, error } = await self._adminClient.auth.admin.getUserById(userId);
          if (error || !data?.user) return null;
          return mapSupabaseUserToEEUser(data.user);
        }

        // Fall back to users table query
        const { data, error } = await self.supabase
          .from('users')
          .select('id, email, name, avatar_url')
          .eq('id', userId)
          .single();

        if (error || !data) return null;

        return {
          id: data.id,
          email: data.email,
          name: data.name,
          avatarUrl: data.avatar_url,
        };
      } catch {
        return null;
      }
    };

    (this as unknown as IUserProvider<EEUser>).getUserProfileUrl = function (user: EEUser): string {
      return `/user/${user.id}`;
    };
  }

  /**
   * Attach ICredentialsProvider methods to the instance.
   */
  private _attachCredentialsProvider(): void {
    const self = this;

    (this as unknown as ICredentialsProvider<EEUser>).signIn = async function (
      email: string,
      password: string,
      request: Request,
    ): Promise<CredentialsResult<EEUser>> {
      const { data, error } = await self.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user || !data.session) {
        throw new Error(error?.message ?? 'Sign in failed');
      }

      const eeUser = mapSupabaseUserToEEUser(data.user);

      // Create encrypted session cookie
      const sessionData = {
        user: eeUser,
        expiresAt: Date.now() + self._cookieMaxAge * 1000,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      };

      const encrypted = await encryptSession(sessionData, self._cookiePassword!);
      const cookieValue = `${self._cookieName}=${encodeURIComponent(encrypted)}; ${self._cookieFlags(request)}`;

      return {
        user: eeUser,
        token: data.session.access_token,
        cookies: [cookieValue],
      };
    };

    (this as unknown as ICredentialsProvider<EEUser>).signUp = async function (
      email: string,
      password: string,
      name: string | undefined,
      request: Request,
    ): Promise<CredentialsResult<EEUser>> {
      const { data, error } = await self.supabase.auth.signUp({
        email,
        password,
        options: name ? { data: { full_name: name, name } } : undefined,
      });

      if (error || !data.user) {
        throw new Error(error?.message ?? 'Sign up failed');
      }

      const eeUser = mapSupabaseUserToEEUser(data.user);

      // Supabase may require email confirmation — session may be null
      if (data.session) {
        const sessionData = {
          user: eeUser,
          expiresAt: Date.now() + self._cookieMaxAge * 1000,
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        };

        const encrypted = await encryptSession(sessionData, self._cookiePassword!);
        const cookieValue = `${self._cookieName}=${encodeURIComponent(encrypted)}; ${self._cookieFlags(request)}`;

        return {
          user: eeUser,
          token: data.session.access_token,
          cookies: [cookieValue],
        };
      }

      // No session (email confirmation required)
      return { user: eeUser };
    };

    (this as unknown as ICredentialsProvider<EEUser>).isSignUpEnabled = function (): boolean {
      return self._enableSignUp;
    };
  }

  /**
   * Attach ISessionProvider methods to the instance.
   */
  private _attachSessionProvider(): void {
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
        expiresAt: new Date(now.getTime() + self._cookieMaxAge * 1000),
        metadata,
      };
    };

    (this as unknown as ISessionProvider<Session>).validateSession = async function (
      _sessionId: string,
    ): Promise<Session | null> {
      // Session validation is handled by cookie decryption in _getUserFromSessionCookie
      return null;
    };

    (this as unknown as ISessionProvider<Session>).destroySession = async function (_sessionId: string): Promise<void> {
      // Session destruction is handled by clearing the cookie
    };

    (this as unknown as ISessionProvider<Session>).refreshSession = async function (
      _sessionId: string,
    ): Promise<Session | null> {
      // Session refresh is handled by cookie-based flow
      return null;
    };

    (this as unknown as ISessionProvider<Session>).getSessionIdFromRequest = function (
      request: Request,
    ): string | null {
      const cookieHeader =
        typeof (request as any).header === 'function'
          ? (request as any).header('cookie')
          : request.headers.get('Cookie');

      if (!cookieHeader) return null;

      const cookies = cookieHeader.split(';').map((c: string) => c.trim());
      const sessionCookie = cookies.find((c: string) => c.startsWith(`${self._cookieName}=`));
      if (!sessionCookie) return null;

      return sessionCookie.split('=').slice(1).join('=');
    };

    (this as unknown as ISessionProvider<Session>).getSessionHeaders = function (
      _session: Session,
    ): Record<string, string> {
      return {};
    };

    (this as unknown as ISessionProvider<Session>).getClearSessionHeaders = function (): Record<string, string> {
      const isSecure = self._secureCookies ?? process.env.NODE_ENV === 'production';
      return {
        'Set-Cookie': `${self._cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecure ? '; Secure' : ''}`,
      };
    };
  }

  /**
   * Generate the consent page HTML for Supabase OAuth Server.
   * This is a self-contained page that:
   * 1. Loads Supabase JS SDK from CDN
   * 2. Shows login form if user isn't authenticated
   * 3. Auto-approves authorization once authenticated
   *
   * Serve this HTML at the authorization path configured in Supabase OAuth Server settings.
   */
  getConsentPageHtml(authorizationId: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize Mastra Studio</title>
  <script src="https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e5e5e5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .container { width: 100%; max-width: 400px; padding: 2rem; }
    .card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 2rem; }
    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
    p { color: #999; font-size: 0.875rem; margin-bottom: 1.5rem; }
    .form-group { margin-bottom: 1rem; }
    label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem; }
    input { width: 100%; padding: 0.625rem 0.875rem; background: #0a0a0a; border: 1px solid #333; border-radius: 8px; color: #e5e5e5; font-size: 0.875rem; outline: none; }
    input:focus { border-color: #666; }
    button { width: 100%; padding: 0.625rem; background: #fff; color: #0a0a0a; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; margin-top: 0.5rem; }
    button:hover { background: #e5e5e5; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #ef4444; font-size: 0.8rem; margin-top: 0.5rem; }
    .status { color: #999; font-size: 0.8rem; text-align: center; margin-top: 1rem; }
    .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid #666; border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div id="login-form">
        <h1>Sign in to continue</h1>
        <p>Authorize Mastra Studio to access your account.</p>
        <form onsubmit="handleLogin(event)">
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" required placeholder="you@example.com" />
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" required placeholder="••••••••" />
          </div>
          <button type="submit" id="login-btn">Sign in</button>
          <div id="error" class="error"></div>
        </form>
      </div>
      <div id="approving" style="display:none">
        <h1>Authorizing...</h1>
        <div class="status"><span class="spinner"></span> Granting access to Mastra Studio</div>
      </div>
    </div>
  </div>
  <script>
    const SUPABASE_URL = '${this._supabaseUrl}';
    const SUPABASE_ANON_KEY = '${this._getAnonKey()}';
    const AUTHORIZATION_ID = '${authorizationId}';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    async function tryAutoApprove() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await approveAuthorization();
      }
    }

    async function handleLogin(e) {
      e.preventDefault();
      const btn = document.getElementById('login-btn');
      const errorEl = document.getElementById('error');
      btn.disabled = true;
      errorEl.textContent = '';

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        errorEl.textContent = error.message;
        btn.disabled = false;
        return;
      }
      await approveAuthorization();
    }

    async function approveAuthorization() {
      document.getElementById('login-form').style.display = 'none';
      document.getElementById('approving').style.display = 'block';

      const { data, error } = await supabase.auth.oauth.approveAuthorization(AUTHORIZATION_ID);
      if (error) {
        document.getElementById('approving').innerHTML = '<h1>Error</h1><p class="error">' + error.message + '</p>';
        return;
      }
      window.location.href = data.redirect_to;
    }

    tryAutoApprove();
  </script>
</body>
</html>`;
  }

  /**
   * Get the anon key for the consent page.
   */
  private _getAnonKey(): string {
    return this._supabaseAnonKey;
  }

  /**
   * Attach ISSOProvider methods to the instance.
   * Uses Supabase's OAuth 2.1 Server: Supabase acts as the identity provider with
   * standard /oauth/authorize and /oauth/token endpoints.
   */
  private _attachSSOProvider(): void {
    const self = this;
    const stateStore = new Map<string, { expiresAt: number; redirectUri: string }>();

    (this as unknown as ISSOProvider<EEUser>).getLoginUrl = function (redirectUri: string, state: string): string {
      const stateId = state.includes('|') ? state.split('|')[0]! : state;
      const actualRedirectUri = redirectUri;

      if (!actualRedirectUri) {
        throw new Error('Redirect URI is required for SSO');
      }

      // Store state with redirect_uri for validation (expires in 10 minutes)
      stateStore.set(stateId, {
        expiresAt: Date.now() + STATE_TIMEOUT_MS,
        redirectUri: actualRedirectUri,
      });

      // Clean up expired states
      for (const [key, value] of stateStore.entries()) {
        if (value.expiresAt < Date.now()) {
          stateStore.delete(key);
        }
      }

      const scopes = self._ssoConfig?.oauthScopes ?? 'openid email profile';
      const params = new URLSearchParams({
        client_id: self._oauthClientId!,
        response_type: 'code',
        scope: scopes,
        redirect_uri: actualRedirectUri,
        state,
      });

      return `${self._supabaseUrl}/auth/v1/oauth/authorize?${params.toString()}`;
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

      // Exchange code for tokens using client_secret_basic (confidential client)
      const tokenResponse = await fetch(`${self._supabaseUrl}/auth/v1/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${self._oauthClientId}:${self._oauthClientSecret}`)}`,
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

      // Get user info from userinfo endpoint
      let user: EEUser;
      const userInfoResponse = await fetch(`${self._supabaseUrl}/auth/v1/oauth/userinfo`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (userInfoResponse.ok) {
        const userInfo = (await userInfoResponse.json()) as {
          sub: string;
          email?: string;
          name?: string;
          preferred_username?: string;
          picture?: string;
        };
        user = {
          id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name ?? userInfo.preferred_username,
          avatarUrl: userInfo.picture,
        };
      } else if (tokens.id_token) {
        // Fallback: decode ID token claims (JWT payload)
        const payload = JSON.parse(atob(tokens.id_token.split('.')[1]!));
        user = {
          id: payload.sub,
          email: payload.email,
          name: payload.name ?? payload.preferred_username,
          avatarUrl: payload.picture,
        };
      } else {
        throw new Error('Failed to fetch user info from Supabase');
      }

      // Create encrypted session cookie
      const sessionData = {
        user,
        expiresAt: Date.now() + self._cookieMaxAge * 1000,
      };

      const encrypted = await encryptSession(sessionData, self._cookiePassword!);
      const flags = self._cookieFlags();
      const cookieValue = `${self._cookieName}=${encodeURIComponent(encrypted)}; ${flags}`;

      return {
        user,
        tokens: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
        cookies: [cookieValue],
      };
    };

    (this as unknown as ISSOProvider<EEUser>).getLoginButtonConfig = function (): SSOLoginConfig {
      return {
        provider: 'supabase',
        text: self._ssoConfig?.buttonText ?? 'Sign in with Supabase',
        icon: self._ssoConfig?.icon,
        description: self._ssoConfig?.description ?? 'Sign in using your Supabase account',
      };
    };

    (this as unknown as ISSOProvider<EEUser>).getLoginCookies = function (_state: string): string[] {
      return [];
    };

    (this as unknown as ISSOProvider<EEUser>).getLogoutUrl = function (_redirectUri: string): string | null {
      return null;
    };
  }
}
