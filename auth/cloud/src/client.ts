/**
 * MastraCloudAuth client class.
 * Facade composing OAuth and session modules into unified API.
 */

import { getLoginUrl, handleCallback } from './oauth';
import {
  verifyToken,
  validateSession,
  destroySession,
  getLogoutUrl,
  setSessionCookie,
  clearSessionCookie,
} from './session';
import type { LoginUrlResult, CallbackResult, VerifyResponse, CloudSession } from './types';

/**
 * Configuration for MastraCloudAuth client.
 */
export interface MastraCloudAuthConfig {
  /** Mastra Cloud project ID */
  projectId: string;
  /** Base URL of the Cloud API (e.g., https://cloud.mastra.ai) */
  cloudBaseUrl: string;
  /** OAuth callback URL for your application */
  callbackUrl: string;
  /** Whether running in production (adds Secure flag to cookies) */
  isProduction?: boolean;
}

/**
 * Mastra Cloud authentication client.
 *
 * Provides unified API for OAuth flow and session management.
 *
 * @example
 * ```typescript
 * const auth = new MastraCloudAuth({
 *   cloudBaseUrl: 'https://cloud.mastra.ai',
 *   callbackUrl: 'https://myapp.com/auth/callback',
 * });
 *
 * // Start login flow
 * const { url, cookies } = auth.getLoginUrl({
 *   requestOrigin: 'https://myapp.com',
 * });
 *
 * // After callback
 * const result = await auth.handleCallback({
 *   code: 'auth_code',
 *   state: 'state_param',
 *   cookieHeader: request.headers.get('cookie'),
 * });
 * ```
 */
export class MastraCloudAuth {
  private readonly config: MastraCloudAuthConfig;

  constructor(config: MastraCloudAuthConfig) {
    this.config = config;
  }

  /**
   * Generate login URL for OAuth authorization.
   *
   * @param options - Login options
   * @returns URL to redirect to and cookies to set
   */
  getLoginUrl(options: { returnTo?: string; requestOrigin: string }): LoginUrlResult {
    return getLoginUrl({
      projectId: this.config.projectId,
      cloudBaseUrl: this.config.cloudBaseUrl,
      callbackUrl: this.config.callbackUrl,
      returnTo: options.returnTo,
      requestOrigin: options.requestOrigin,
      isProduction: this.config.isProduction,
    });
  }

  /**
   * Handle OAuth callback after authorization.
   *
   * @param options - Callback parameters
   * @returns User info, tokens, and redirect URL
   */
  handleCallback(options: { code: string; state: string; cookieHeader: string | null }): Promise<CallbackResult> {
    return handleCallback({
      projectId: this.config.projectId,
      cloudBaseUrl: this.config.cloudBaseUrl,
      redirectUri: this.config.callbackUrl,
      ...options,
    });
  }

  /**
   * Verify an access token.
   *
   * @param token - Access token to verify
   * @returns User and role information
   */
  verifyToken(token: string): Promise<VerifyResponse> {
    return verifyToken({ projectId: this.config.projectId, cloudBaseUrl: this.config.cloudBaseUrl, token });
  }

  /**
   * Validate an existing session.
   *
   * @param sessionToken - Session token to validate
   * @returns Session data if valid, null otherwise
   */
  validateSession(sessionToken: string): Promise<CloudSession | null> {
    return validateSession({ projectId: this.config.projectId, cloudBaseUrl: this.config.cloudBaseUrl, sessionToken });
  }

  /**
   * Destroy a session (server-side logout).
   *
   * @param sessionToken - Session token to destroy
   */
  destroySession(sessionToken: string): Promise<void> {
    return destroySession({ projectId: this.config.projectId, cloudBaseUrl: this.config.cloudBaseUrl, sessionToken });
  }

  /**
   * Get the logout URL for client-side redirect.
   *
   * @param postLogoutRedirectUri - URL to redirect to after logout
   * @param idTokenHint - The access token
   * @returns Full logout URL with redirect and token parameters
   */
  getLogoutUrl(postLogoutRedirectUri: string, idTokenHint: string): string {
    return getLogoutUrl(this.config.cloudBaseUrl, postLogoutRedirectUri, idTokenHint);
  }

  /**
   * Create Set-Cookie header value for session token.
   *
   * @param token - Session token to store
   * @returns Set-Cookie header value
   */
  setSessionCookie(token: string): string {
    return setSessionCookie(token, this.config.isProduction ?? process.env.NODE_ENV === 'production');
  }

  /**
   * Create Set-Cookie header value to clear session cookie.
   *
   * @returns Set-Cookie header value
   */
  clearSessionCookie(): string {
    return clearSessionCookie();
  }
}
