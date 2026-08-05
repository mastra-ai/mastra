import { MastraBase } from '@internal/core/base';
import type {
  CredentialsResult,
  IAuthHttpHandler,
  IAuthInit,
  ICredentialsProvider,
  IOrganizationsProvider,
  ISSOProvider,
  ISessionProvider,
  IUserProvider,
  Session,
  SSOCallbackResult,
  SSOLoginConfig,
  User,
} from '..';
import type { AuthorizeUserFn, MastraAuthConfig, MastraAuthRequest } from '../types';
import { getRequestHeader } from '../types';

export interface MastraAuthProviderOptions<TUser = unknown> {
  name?: string;
  authorizeUser?: AuthorizeUserFn<TUser>;
  mapUserToResourceId?(user: TUser): string | undefined | null;
  /**
   * Protected paths for the auth provider
   */
  protected?: MastraAuthConfig['protected'];
  /**
   * Public paths for the auth provider
   */
  public?: MastraAuthConfig['public'];
}

/**
 * Structural description of the public surface of a `MastraAuthProvider`.
 *
 * Auth provider packages bundle their own copy of the `MastraAuthProvider`
 * declaration, so provider class types cannot be compared nominally across
 * package boundaries — `#private`/`protected` members would make otherwise
 * identical copies mutually unassignable. Positions that accept user-supplied
 * providers (e.g. `server.auth`, `CompositeAuth`) accept this interface
 * instead of the class.
 *
 * Note: methods intentionally use method syntax (not property syntax) so they
 * are checked bivariantly — providers with a narrower `TUser` must remain
 * assignable to `IMastraAuthProvider<unknown>`.
 */
export interface IMastraAuthProvider<TUser = unknown> {
  name?: string;
  /**
   * Protected paths for the auth provider
   */
  protected?: MastraAuthConfig['protected'];
  /**
   * Public paths for the auth provider
   */
  public?: MastraAuthConfig['public'];
  /**
   * Authenticate a token and return the payload
   */
  authenticateToken(token: string, request: MastraAuthRequest): Promise<TUser | null>;
  /**
   * Authorize a user for a path and method
   */
  authorizeUser(user: TUser, request: MastraAuthRequest): Promise<boolean> | boolean;
  /**
   * Map an authenticated user to a memory resource id
   */
  mapUserToResourceId?(user: TUser): string | undefined | null;
}

export abstract class MastraAuthProvider<TUser = unknown> extends MastraBase implements IMastraAuthProvider<TUser> {
  public protected?: MastraAuthConfig['protected'];
  public public?: MastraAuthConfig['public'];
  public mapUserToResourceId?(user: TUser): string | undefined | null;

  constructor(options?: MastraAuthProviderOptions<TUser>) {
    super({ component: 'AUTH', name: options?.name });

    if (options?.authorizeUser) {
      this.authorizeUser = options.authorizeUser.bind(this);
    }

    this.protected = options?.protected;
    this.public = options?.public;
    this.mapUserToResourceId = options?.mapUserToResourceId;
  }

  /**
   * Authenticate a token and return the payload
   * @param token - The token to authenticate
   * @param request - The request
   * @returns The payload
   */
  abstract authenticateToken(token: string, request: MastraAuthRequest): Promise<TUser | null>;

  /**
   * Authorize a user for a path and method
   * @param user - The user to authorize
   * @param request - The request
   * @returns The authorization result
   */
  abstract authorizeUser(user: TUser, request: MastraAuthRequest): Promise<boolean> | boolean;

  protected registerOptions(opts?: MastraAuthProviderOptions<TUser>) {
    if (opts?.authorizeUser) {
      this.authorizeUser = opts.authorizeUser.bind(this);
    }
    if (opts?.mapUserToResourceId) {
      this.mapUserToResourceId = opts.mapUserToResourceId;
    }
    if (opts?.protected) {
      this.protected = opts.protected;
    }
    if (opts?.public) {
      this.public = opts.public;
    }
  }
}

type PrimitiveAuthUser = string | number | boolean | bigint | symbol | null | undefined;

// Type guards for interface detection
export function isSSOProvider(p: unknown): p is ISSOProvider {
  return (
    p !== null &&
    typeof p === 'object' &&
    typeof (p as any).getLoginUrl === 'function' &&
    typeof (p as any).handleCallback === 'function'
  );
}

export function isSessionProvider(p: unknown): p is ISessionProvider {
  return (
    p !== null &&
    typeof p === 'object' &&
    typeof (p as any).validateSession === 'function' &&
    typeof (p as any).createSession === 'function'
  );
}

export function isUserProvider(p: unknown): p is IUserProvider {
  return p !== null && typeof p === 'object' && typeof (p as any).getCurrentUser === 'function';
}
export function isCredentialsProvider(p: unknown): p is ICredentialsProvider {
  return p !== null && typeof p === 'object' && typeof (p as any).signIn === 'function';
}

export function isOrganizationsProvider(p: unknown): p is IOrganizationsProvider {
  return (
    p !== null &&
    typeof p === 'object' &&
    typeof (p as any).ensureOrganization === 'function' &&
    typeof (p as any).isOrganizationAdmin === 'function'
  );
}

export function isAuthHttpHandler(p: unknown): p is IAuthHttpHandler {
  return p !== null && typeof p === 'object' && typeof (p as any).handleAuthRequest === 'function';
}

export function hasAuthInit(p: unknown): p is IAuthInit {
  return p !== null && typeof p === 'object' && typeof (p as any).init === 'function';
}

function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

export class CompositeAuth
  extends MastraAuthProvider
  implements ISSOProvider<User>, ISessionProvider<Session>, IUserProvider<User>
{
  private providers: IMastraAuthProvider[];
  private authenticatedProviderByObject = new WeakMap<object, IMastraAuthProvider>();
  private authenticatedProviderByPrimitive = new Map<PrimitiveAuthUser, IMastraAuthProvider>();

  constructor(providers: IMastraAuthProvider[]) {
    const combinedPublic = providers.flatMap(provider => provider.public ?? []);
    const combinedProtected = providers.flatMap(provider => provider.protected ?? []);

    super({
      public: combinedPublic,
      protected: combinedProtected,
    });

    this.providers = providers;
    if (providers.some(provider => typeof provider.mapUserToResourceId === 'function')) {
      this.mapUserToResourceId = user => this.mapAuthenticatedUserToResourceId(user);
    }

    // Null out interface methods when no inner provider supports them.
    // This ensures duck-typing checks (typeof auth.method === 'function')
    // accurately reflect the composite's actual capabilities — preventing
    // Studio from showing login options that no provider can handle.
    if (!providers.some(isSSOProvider)) {
      this.getLoginUrl = undefined as any;
      this.handleCallback = undefined as any;
      this.getLoginButtonConfig = undefined as any;
    }
    if (!providers.some(isSessionProvider)) {
      this.createSession = undefined as any;
      this.validateSession = undefined as any;
      this.getSessionIdFromRequest = undefined as any;
    }
    if (!providers.some(isUserProvider)) {
      this.getCurrentUser = undefined as any;
      this.getUser = undefined as any;
      this.getUsers = undefined as any;
    }
    // Proxy credentials provider methods if any inner provider supports them.
    const credProvider = providers.find(isCredentialsProvider) as any;
    if (credProvider) {
      (this as any).signIn = credProvider.signIn.bind(credProvider);
      if (typeof credProvider.signUp === 'function') {
        (this as any).signUp = credProvider.signUp.bind(credProvider);
      }
      if (typeof credProvider.requestPasswordReset === 'function') {
        (this as any).requestPasswordReset = credProvider.requestPasswordReset.bind(credProvider);
      }
      if (typeof credProvider.resetPassword === 'function') {
        (this as any).resetPassword = credProvider.resetPassword.bind(credProvider);
      }
      (this as any).isSignUpEnabled =
        typeof credProvider.isSignUpEnabled === 'function'
          ? credProvider.isSignUpEnabled.bind(credProvider)
          : () => true;
    } else {
      (this as any).signIn = undefined;
      (this as any).signUp = undefined;
      (this as any).requestPasswordReset = undefined;
      (this as any).resetPassword = undefined;
      (this as any).isSignUpEnabled = undefined;
    }
  }

  // Find first provider implementing an interface
  private findProvider<T>(check: (p: unknown) => p is T): T | undefined {
    return this.providers.find(check) as T | undefined;
  }

  private rememberAuthenticatedProvider(user: unknown, provider: IMastraAuthProvider): void {
    if (isObjectLike(user)) {
      this.authenticatedProviderByObject.set(user, provider);
      return;
    }

    this.authenticatedProviderByPrimitive.set(user as PrimitiveAuthUser, provider);
  }

  private takeAuthenticatedProvider(user: unknown): IMastraAuthProvider | undefined {
    if (isObjectLike(user)) {
      const provider = this.authenticatedProviderByObject.get(user);
      this.authenticatedProviderByObject.delete(user);
      return provider;
    }

    const primitiveUser = user as PrimitiveAuthUser;
    const provider = this.authenticatedProviderByPrimitive.get(primitiveUser);
    this.authenticatedProviderByPrimitive.delete(primitiveUser);
    return provider;
  }

  private mapAuthenticatedUserToResourceId(user: unknown): string | undefined | null {
    const provider = this.takeAuthenticatedProvider(user);
    return provider?.mapUserToResourceId?.(user);
  }

  // ============================================================================
  // License Exemption Markers
  // Expose these if any underlying provider has them
  // ============================================================================

  /**
   * True if any provider is MastraCloudAuth (exempt from license requirement).
   */
  get isMastraCloudAuth(): boolean {
    return this.providers.some(
      p => 'isMastraCloudAuth' in p && (p as { isMastraCloudAuth: boolean }).isMastraCloudAuth === true,
    );
  }

  /**
   * True if any provider is SimpleAuth (exempt from license requirement).
   */
  get isSimpleAuth(): boolean {
    return this.providers.some(p => 'isSimpleAuth' in p && (p as { isSimpleAuth: boolean }).isSimpleAuth === true);
  }

  // ============================================================================
  // MastraAuthProvider Implementation
  // ============================================================================

  async authenticateToken(token: string, request: MastraAuthRequest): Promise<unknown | null> {
    for (const provider of this.providers) {
      try {
        const user = await provider.authenticateToken(token, request);
        if (user) {
          this.rememberAuthenticatedProvider(user, provider);
          return user;
        }
      } catch {
        // ignore error, try next provider
      }
    }
    return null;
  }

  async authorizeUser(user: unknown, request: MastraAuthRequest): Promise<boolean> {
    for (const provider of this.providers) {
      const authorized = await provider.authorizeUser(user, request);
      if (authorized) {
        return true;
      }
    }
    return false;
  }

  // ============================================================================
  // ISSOProvider Implementation
  // ============================================================================

  /**
   * Forward cookie header to SSO provider for PKCE validation.
   * Called by auth handler before handleCallback().
   */
  setCallbackCookieHeader(cookieHeader: string | null): void {
    const sso = this.findProvider(isSSOProvider);
    if (sso && typeof (sso as any).setCallbackCookieHeader === 'function') {
      (sso as any).setCallbackCookieHeader(cookieHeader);
    }
  }

  getLoginUrl(redirectUri: string, state: string): string | Promise<string> {
    const sso = this.findProvider(isSSOProvider);
    if (!sso) throw new Error('No SSO provider configured in CompositeAuth');
    return sso.getLoginUrl(redirectUri, state);
  }

  getLoginCookies(redirectUri: string, state: string): string[] | undefined {
    const sso = this.findProvider(isSSOProvider);
    return sso?.getLoginCookies?.(redirectUri, state);
  }

  async handleCallback(code: string, state: string): Promise<SSOCallbackResult<User>> {
    const sso = this.findProvider(isSSOProvider);
    if (!sso) throw new Error('No SSO provider configured in CompositeAuth');
    return sso.handleCallback(code, state) as Promise<SSOCallbackResult<User>>;
  }

  getLoginButtonConfig(): SSOLoginConfig {
    const sso = this.findProvider(isSSOProvider);
    if (!sso) return { provider: 'unknown', text: 'Sign in' };
    return sso.getLoginButtonConfig();
  }

  async getLogoutUrl(redirectUri: string, request?: Request): Promise<string | null> {
    // Try each SSO provider until one returns a logout URL
    for (const provider of this.providers) {
      if (isSSOProvider(provider) && provider.getLogoutUrl) {
        try {
          const url = await provider.getLogoutUrl(redirectUri, request);
          if (url) return url;
        } catch {
          // Try next provider
        }
      }
    }
    return null;
  }

  // ============================================================================
  // ISessionProvider Implementation
  // ============================================================================

  async createSession(userId: string, metadata?: Record<string, unknown>): Promise<Session> {
    const session = this.findProvider(isSessionProvider);
    if (!session) throw new Error('No session provider configured in CompositeAuth');
    return session.createSession(userId, metadata);
  }

  async validateSession(sessionId: string): Promise<Session | null> {
    // Try each session provider until one validates
    for (const provider of this.providers) {
      if (isSessionProvider(provider)) {
        try {
          const session = await provider.validateSession(sessionId);
          if (session) return session;
        } catch {
          // Try next provider
        }
      }
    }
    return null;
  }

  async destroySession(sessionId: string): Promise<void> {
    // Destroy session on ALL providers (user may have sessions in multiple stores)
    const destroyPromises: Promise<void>[] = [];
    for (const provider of this.providers) {
      if (isSessionProvider(provider)) {
        destroyPromises.push(
          provider.destroySession(sessionId).catch(() => {
            // Ignore errors, session may not exist in this provider
          }),
        );
      }
    }
    await Promise.all(destroyPromises);
  }

  async refreshSession(sessionId: string): Promise<Session | null> {
    // Try each session provider until one refreshes
    for (const provider of this.providers) {
      if (isSessionProvider(provider)) {
        try {
          const session = await provider.refreshSession(sessionId);
          if (session) return session;
        } catch {
          // Try next provider
        }
      }
    }
    return null;
  }

  getSessionIdFromRequest(request: Request): string | null {
    // Try each session provider until one finds a session ID
    for (const provider of this.providers) {
      if (isSessionProvider(provider)) {
        try {
          const sessionId = provider.getSessionIdFromRequest(request);
          if (sessionId) return sessionId;
        } catch {
          // Try next provider
        }
      }
    }
    return null;
  }

  getSessionHeaders(session: Session): Record<string, string> {
    // Intentionally uses only the first session provider: a session is created by one
    // provider, so we only set its cookie. clearSession clears ALL providers to ensure
    // no stale cookies remain.
    const sessionProvider = this.findProvider(isSessionProvider);
    return sessionProvider?.getSessionHeaders(session) ?? {};
  }

  getClearSessionHeaders(): Record<string, string> {
    // Merge clear headers from ALL providers to ensure no stale session cookies remain
    const headers: Record<string, string> = {};
    for (const provider of this.providers) {
      if (isSessionProvider(provider)) {
        try {
          const providerHeaders = provider.getClearSessionHeaders();
          Object.assign(headers, providerHeaders);
        } catch {
          // Ignore errors
        }
      }
    }
    return headers;
  }

  // ============================================================================
  // IUserProvider Implementation
  // Try each provider until one returns a user (like authenticateToken)
  // ============================================================================

  async getCurrentUser(request: Request): Promise<User | null> {
    for (const provider of this.providers) {
      if (isUserProvider(provider)) {
        try {
          const user = await provider.getCurrentUser(request);
          if (user) return user;
        } catch {
          // Try next provider
        }
      }
    }
    return null;
  }

  async getUser(userId: string): Promise<User | null> {
    for (const provider of this.providers) {
      if (isUserProvider(provider)) {
        try {
          const user = await provider.getUser(userId);
          if (user) return user;
        } catch {
          // Try next provider
        }
      }
    }
    return null;
  }

  async getUsers(userIds: string[]): Promise<Array<User | null>> {
    return Promise.all(userIds.map(userId => this.getUser(userId)));
  }
}

const DEFAULT_HEADERS = ['Authorization', 'X-Playground-Access'];

type TokenToUser<TUser> = Record<string, TUser>;

export interface SimpleAuthOptions<TUser> extends MastraAuthProviderOptions<TUser> {
  /**
   * Valid tokens to authenticate against
   */
  tokens: TokenToUser<TUser>;
  /**
   * Headers to check for authentication
   * @default ['Authorization', 'X-Playground-Access']
   */
  headers?: string | string[];
}

export class SimpleAuth<TUser> extends MastraAuthProvider<TUser> {
  /**
   * Marker to exempt SimpleAuth from EE license requirement.
   * SimpleAuth is for development/testing and should work without a license.
   */
  readonly isSimpleAuth = true;

  private tokens: TokenToUser<TUser>;
  private headers: string[];
  private users: TUser[];
  private userById: Map<string, TUser>;

  constructor(options: SimpleAuthOptions<TUser>) {
    super(options);
    this.tokens = options.tokens;
    this.users = Object.values(this.tokens);
    this.headers = [...DEFAULT_HEADERS].concat(options.headers || []);
    this.userById = new Map(this.users.map(u => [String((u as any)?.id), u]));
  }

  async authenticateToken(token: string, request: MastraAuthRequest): Promise<TUser | null> {
    const requestTokens = this.getTokensFromHeaders(token, request);

    for (const requestToken of requestTokens) {
      const tokenToUser = this.tokens[requestToken];
      if (tokenToUser) {
        return tokenToUser;
      }
    }

    return this.getUserFromCookie(getRequestHeader(request, 'Cookie'));
  }

  async authorizeUser(user: TUser, _request: MastraAuthRequest): Promise<boolean> {
    return this.users.includes(user);
  }

  /** Get current user from request headers or cookie. */
  async getCurrentUser(request: Request): Promise<TUser | null> {
    // Check headers first
    for (const headerName of this.headers) {
      const headerValue = request.headers.get(headerName);
      if (headerValue) {
        const token = this.stripBearerPrefix(headerValue);
        const user = this.tokens[token];
        if (user) {
          return user;
        }
      }
    }

    return this.getUserFromCookie(request.headers.get('Cookie'));
  }

  private getUserFromCookie(cookieHeader: string | null | undefined): TUser | null {
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith('mastra-token=')) {
        const token = cookie.slice('mastra-token='.length);
        const user = this.tokens[token];
        if (user) {
          return user;
        }
      }
    }
    return null;
  }

  /** Get user by ID. */
  async getUser(userId: string): Promise<TUser | null> {
    return this.userById.get(userId) ?? null;
  }

  async getUsers(userIds: string[]): Promise<Array<TUser | null>> {
    return userIds.map(userId => this.userById.get(userId) ?? null);
  }

  /**
   * Sign in with token (passed as password field).
   * The email field is ignored - only the token matters.
   */
  async signIn(_email: string, password: string, _request: Request): Promise<CredentialsResult<TUser>> {
    const token = password;
    const user = this.tokens[token];

    if (!user) {
      throw new Error('Invalid token');
    }

    // Set cookie so the token persists across requests
    const cookie = `mastra-token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;

    return {
      user,
      token,
      cookies: [cookie],
    };
  }

  async signUp(): Promise<CredentialsResult<TUser>> {
    throw new Error('Sign up is not supported with SimpleAuth. Use pre-configured tokens.');
  }

  isSignUpEnabled(): boolean {
    return false;
  }

  /**
   * Get headers to clear the session cookie on logout.
   * Partial ISessionProvider implementation for logout support.
   */
  getClearSessionHeaders(): Record<string, string> {
    return {
      'Set-Cookie': 'mastra-token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    };
  }

  private stripBearerPrefix(token: string): string {
    return token.startsWith('Bearer ') ? token.slice(7) : token;
  }

  private getTokensFromHeaders(token: string, request: MastraAuthRequest): string[] {
    const tokens = [token];
    for (const headerName of this.headers) {
      const headerValue = getRequestHeader(request, headerName);
      if (headerValue) {
        tokens.push(this.stripBearerPrefix(headerValue));
      }
    }
    return tokens;
  }
}
