/**
 * WorkOS SSO provider implementation using WorkOS AuthKit.
 *
 * Implements the ISSOProvider interface for OAuth 2.0/OIDC authentication flows.
 * @module auth-workos/sso
 */

import type { ISSOProvider, SSOCallbackResult, SSOLoginConfig, EEUser } from '@mastra/core/ee';
import type { AuthService } from '@workos/authkit-session';
import type { WorkOS } from '@workos-inc/node';

import type { WorkOSUser, WorkOSConfig, WorkOSSSOConfig } from './types.js';
import { mapWorkOSUserToEEUser } from './types.js';

/**
 * WorkOS SSO provider for OAuth/OIDC authentication.
 *
 * Supports multiple SSO flows:
 * - AuthKit (WorkOS hosted UI)
 * - Specific provider (Google, Microsoft, GitHub, Apple)
 * - Organization-specific SSO
 * - Connection-specific SSO
 *
 * @example
 * ```typescript
 * const ssoProvider = new WorkOSSSOProvider(workos, authService, config, ssoConfig);
 * const loginUrl = ssoProvider.getLoginUrl('https://myapp.com/auth/callback', 'state-123');
 * // User redirects to loginUrl, then returns with code
 * const result = await ssoProvider.handleCallback(code, 'state-123');
 * // result.user contains authenticated user
 * // result.tokens contains access/refresh tokens
 * // result.cookies contains session cookies to set
 * ```
 */
export class WorkOSSSOProvider implements ISSOProvider<EEUser> {
  constructor(
    private workos: WorkOS,
    private authService: AuthService<Request, Response>,
    private config: WorkOSConfig,
    private ssoConfig?: WorkOSSSOConfig,
  ) {}

  /**
   * Get the OAuth authorization URL for initiating SSO login.
   *
   * @param redirectUri - The callback URL where WorkOS will redirect after authentication
   * @param state - CSRF protection token
   * @returns The full authorization URL to redirect the user to
   */
  getLoginUrl(redirectUri: string, state?: string): string {
    const baseOptions = {
      clientId: this.config.clientId,
      redirectUri: redirectUri || this.config.redirectUri,
      state: state || '',
    };

    // Use specific connection if configured
    if (this.ssoConfig?.connection) {
      return this.workos.userManagement.getAuthorizationUrl({
        ...baseOptions,
        connectionId: this.ssoConfig.connection,
      });
    }

    // Use specific provider if configured (Google, Microsoft, etc.)
    if (this.ssoConfig?.provider) {
      return this.workos.userManagement.getAuthorizationUrl({
        ...baseOptions,
        provider: this.ssoConfig.provider,
      });
    }

    // Use organization-specific SSO if configured
    if (this.ssoConfig?.defaultOrganization) {
      return this.workos.userManagement.getAuthorizationUrl({
        ...baseOptions,
        organizationId: this.ssoConfig.defaultOrganization,
      });
    }

    // Default to AuthKit hosted UI
    return this.workos.userManagement.getAuthorizationUrl({
      ...baseOptions,
      provider: 'authkit',
    });
  }

  /**
   * Handle the OAuth callback from WorkOS.
   *
   * Exchanges the authorization code for tokens and user information.
   * Uses AuthService's handleCallback for proper session creation.
   *
   * @param code - Authorization code from OAuth callback
   * @param state - State parameter for CSRF validation
   * @returns User, tokens, and session cookies
   * @throws {Error} If code exchange fails
   */
  async handleCallback(code: string, state?: string): Promise<SSOCallbackResult<EEUser>> {
    console.log(
      '[WorkOSSSOProvider.handleCallback] Starting callback with code:',
      code?.slice(0, 10) + '...',
      'state:',
      state,
    );

    // AuthKit library requires WORKOS_REDIRECT_URI env var - set it from config
    if (this.config.redirectUri && !process.env.WORKOS_REDIRECT_URI) {
      process.env.WORKOS_REDIRECT_URI = this.config.redirectUri;
    }

    // Use AuthService's handleCallback for session creation
    // This handles token exchange, session creation, and cookie setting
    let result;
    try {
      result = await this.authService.handleCallback(
        new Request('http://localhost'), // Dummy request (not used by handleCallback)
        new Response(), // Dummy response to collect headers
        { code, state: state || '' },
      );
      console.log('[WorkOSSSOProvider.handleCallback] AuthService callback succeeded');
    } catch (error) {
      console.error('[WorkOSSSOProvider.handleCallback] AuthService callback failed:', error);
      throw error;
    }

    // Map WorkOS user to EEUser format
    const baseUser = mapWorkOSUserToEEUser(result.authResponse.user);
    const user: WorkOSUser = {
      id: baseUser.id,
      email: baseUser.email,
      name: baseUser.name,
      avatarUrl: baseUser.avatarUrl,
      metadata: baseUser.metadata,
      workos: {
        userId: result.authResponse.user.id,
        organizationId: result.authResponse.organizationId || undefined,
        emailVerified: result.authResponse.user.emailVerified,
        createdAt: result.authResponse.user.createdAt,
        updatedAt: result.authResponse.user.updatedAt,
        firstName: result.authResponse.user.firstName || undefined,
        lastName: result.authResponse.user.lastName || undefined,
      },
    };

    // Extract session cookie from response headers
    // Handle both 'Set-Cookie' and 'set-cookie' header casing
    const sessionCookie = result.headers?.['Set-Cookie'] || result.headers?.['set-cookie'];
    const cookies: Record<string, string> = {};

    console.log('[WorkOSSSOProvider.handleCallback] Raw session cookie:', sessionCookie);

    if (sessionCookie) {
      // Store full cookie strings (including attributes like Path, HttpOnly, etc.)
      const cookieArray = Array.isArray(sessionCookie) ? sessionCookie : [sessionCookie];
      cookieArray.forEach((cookie, index) => {
        // Extract cookie name for the key
        const [nameValue] = cookie.split(';');
        if (nameValue) {
          const firstEqualIdx = nameValue.indexOf('=');
          if (firstEqualIdx > 0) {
            const name = nameValue.slice(0, firstEqualIdx).trim();
            // Store the FULL cookie string, not just the value
            cookies[name || `cookie_${index}`] = cookie;
          }
        }
      });
    }

    console.log('[WorkOSSSOProvider.handleCallback] Processed cookies:', Object.keys(cookies));

    return {
      user,
      tokens: {
        accessToken: result.authResponse.accessToken,
        refreshToken: result.authResponse.refreshToken,
        // Use expiresAt from auth response if available, otherwise compute from expiresIn
        expiresAt: (result.authResponse as any).expiresAt
          ? (result.authResponse as any).expiresAt
          : (result.authResponse as any).expiresIn
            ? Date.now() + (result.authResponse as any).expiresIn * 1000
            : Date.now() + 3600000, // 1 hour default fallback
      },
      cookies,
    };
  }

  /**
   * Get the logout URL for WorkOS.
   *
   * @param redirectUri - URL to redirect to after logout
   * @returns The logout URL
   */
  getLogoutUrl(redirectUri?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
    });

    if (redirectUri) {
      params.set('redirect_uri', redirectUri);
    }

    // Use customDomain if configured, otherwise default to api.workos.com
    const domain = this.config.customDomain || 'api.workos.com';
    return `https://${domain}/user_management/logout?${params.toString()}`;
  }

  /**
   * Get the configuration for rendering the SSO login button.
   *
   * @returns Login button configuration with provider branding
   */
  getLoginButtonConfig(): SSOLoginConfig {
    let text = 'Sign in with SSO';
    let icon: string | undefined;

    // Customize button text based on provider
    if (this.ssoConfig?.provider) {
      const providerNames: Record<string, string> = {
        GoogleOAuth: 'Google',
        MicrosoftOAuth: 'Microsoft',
        GitHubOAuth: 'GitHub',
        AppleOAuth: 'Apple',
      };
      const providerName = providerNames[this.ssoConfig.provider];
      if (providerName) {
        text = `Sign in with ${providerName}`;
        // Could add provider icons here
      }
    }

    return {
      provider: 'workos',
      text,
      icon,
      url: this.getLoginUrl(this.config.redirectUri),
    };
  }
}
