import type {
  ISSOProvider,
  ISessionProvider,
  IUserProvider,
  User,
  Session,
  SSOCallbackResult,
  SSOLoginConfig,
} from '../auth';
import { MastraAuthProvider } from './auth';
import type { MastraAuthRequest } from './request-types';

type PrimitiveAuthUser = string | number | boolean | bigint | symbol | null | undefined;

// Type guards for interface detection
function isSSOProvider(p: unknown): p is ISSOProvider {
  return (
    p !== null &&
    typeof p === 'object' &&
    typeof (p as any).getLoginUrl === 'function' &&
    typeof (p as any).handleCallback === 'function'
  );
}

function isSessionProvider(p: unknown): p is ISessionProvider {
  return (
    p !== null &&
    typeof p === 'object' &&
    typeof (p as any).validateSession === 'function' &&
    typeof (p as any).createSession === 'function'
  );
}

function isUserProvider(p: unknown): p is IUserProvider {
  return p !== null && typeof p === 'object' && typeof (p as any).getCurrentUser === 'function';
}
function isCredentialsProvider(p: unknown): boolean {
  return p !== null && typeof p === 'object' && typeof (p as any).signIn === 'function';
}

function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

export class CompositeAuth
  extends MastraAuthProvider
  implements ISSOProvider<User>, ISessionProvider<Session>, IUserProvider<User>
{
  private providers: MastraAuthProvider[];
  private authenticatedProviderByObject = new WeakMap<object, MastraAuthProvider>();
  private authenticatedProviderByPrimitive = new Map<PrimitiveAuthUser, MastraAuthProvider>();

  constructor(providers: MastraAuthProvider[]) {
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
    const credProvider = this.findProvider(isCredentialsProvider as (p: unknown) => p is MastraAuthProvider) as any;
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

  private rememberAuthenticatedProvider(user: unknown, provider: MastraAuthProvider): void {
    if (isObjectLike(user)) {
      this.authenticatedProviderByObject.set(user, provider);
      return;
    }

    this.authenticatedProviderByPrimitive.set(user as PrimitiveAuthUser, provider);
  }

  private takeAuthenticatedProvider(user: unknown): MastraAuthProvider | undefined {
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

  /**
   * Resolve multiple users by ID in one call. For each input ID, walks the
   * providers in order and returns the first non-null match — preserving the
   * existing "try each provider until one responds" semantics of `getUser`.
   * Returns positionally-aligned results, with `null` for any ID no provider
   * could resolve. Per-id lookups are performed in parallel.
   */
  async getUsers(userIds: string[]): Promise<Array<User | null>> {
    return Promise.all(userIds.map(id => this.getUser(id)));
  }
}
