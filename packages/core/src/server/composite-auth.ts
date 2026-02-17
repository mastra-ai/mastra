import type { HonoRequest } from 'hono';
import type {
  ISSOProvider,
  ISessionProvider,
  IUserProvider,
  EEUser,
  Session,
  SSOCallbackResult,
  SSOLoginConfig,
} from '../auth';
import { MastraAuthProvider } from './auth';

// Type guards for interface detection
function isSSOProvider(p: unknown): p is ISSOProvider {
  return p !== null && typeof p === 'object' && 'getLoginUrl' in p && 'handleCallback' in p;
}

function isSessionProvider(p: unknown): p is ISessionProvider {
  return p !== null && typeof p === 'object' && 'validateSession' in p && 'createSession' in p;
}

function isUserProvider(p: unknown): p is IUserProvider {
  return p !== null && typeof p === 'object' && 'getCurrentUser' in p;
}

export class CompositeAuth
  extends MastraAuthProvider
  implements ISSOProvider<EEUser>, ISessionProvider<Session>, IUserProvider<EEUser>
{
  private providers: MastraAuthProvider[];

  constructor(providers: MastraAuthProvider[]) {
    const combinedPublic = providers.flatMap(provider => provider.public ?? []);
    const combinedProtected = providers.flatMap(provider => provider.protected ?? []);

    super({
      public: combinedPublic,
      protected: combinedProtected,
    });

    this.providers = providers;
  }

  // Find first provider implementing an interface
  private findProvider<T>(check: (p: unknown) => p is T): T | undefined {
    return this.providers.find(check) as T | undefined;
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

  async authenticateToken(token: string, request: HonoRequest): Promise<unknown | null> {
    for (const provider of this.providers) {
      try {
        const user = await provider.authenticateToken(token, request);
        if (user) {
          return user;
        }
      } catch {
        // ignore error, try next provider
      }
    }
    return null;
  }

  async authorizeUser(user: unknown, request: HonoRequest): Promise<boolean> {
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

  getLoginUrl(redirectUri: string, state: string): string {
    const sso = this.findProvider(isSSOProvider);
    if (!sso) throw new Error('No SSO provider configured in CompositeAuth');
    return sso.getLoginUrl(redirectUri, state);
  }

  getLoginCookies(redirectUri: string, state: string): string[] | undefined {
    const sso = this.findProvider(isSSOProvider);
    return sso?.getLoginCookies?.(redirectUri, state);
  }

  async handleCallback(code: string, state: string): Promise<SSOCallbackResult<EEUser>> {
    const sso = this.findProvider(isSSOProvider);
    if (!sso) throw new Error('No SSO provider configured in CompositeAuth');
    return sso.handleCallback(code, state) as Promise<SSOCallbackResult<EEUser>>;
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
    const sessionProvider = this.findProvider(isSessionProvider);
    return sessionProvider?.getSessionHeaders(session) ?? {};
  }

  getClearSessionHeaders(): Record<string, string> {
    // Merge clear headers from ALL providers
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

  async getCurrentUser(request: Request): Promise<EEUser | null> {
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

  async getUser(userId: string): Promise<EEUser | null> {
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
}
