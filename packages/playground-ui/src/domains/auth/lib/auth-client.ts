/**
 * Auth Client Utility
 *
 * Centralizes all authentication API calls to avoid direct fetch() usage in hooks.
 * This utility provides type-safe methods for auth operations that are not yet
 * available in the Mastra client SDK.
 *
 * NOTE: This is an interim solution. When the Mastra SDK adds auth methods
 * (signIn, signUp, signOut, getCapabilities), migrate to using those instead.
 */

import type { AuthCapabilities, SSOLoginResponse, LogoutResponse } from '../types';
import type { SignInCredentials, SignUpCredentials, AuthResult } from '../hooks/use-auth-actions';

export interface AuthClientOptions {
  baseUrl: string;
}

export class AuthClient {
  private baseUrl: string;

  constructor(options: AuthClientOptions) {
    this.baseUrl = options.baseUrl;
  }

  /**
   * Fetches authentication capabilities from the server.
   * Can be called both when authenticated and unauthenticated.
   */
  async getCapabilities(): Promise<AuthCapabilities> {
    const response = await fetch(`${this.baseUrl}/api/auth/capabilities`, {
      credentials: 'include', // Include cookies for session validation
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch auth capabilities: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Sign in with email and password credentials.
   */
  async signIn(credentials: SignInCredentials): Promise<AuthResult> {
    const response = await fetch(`${this.baseUrl}/api/auth/credentials/sign-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for session
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `Sign in failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Sign up with email and password credentials.
   */
  async signUp(credentials: SignUpCredentials): Promise<AuthResult> {
    const response = await fetch(`${this.baseUrl}/api/auth/credentials/sign-up`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for session
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `Sign up failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Initiate SSO login flow.
   */
  async getSSOLoginUrl(redirectUri?: string): Promise<SSOLoginResponse> {
    const params = new URLSearchParams();
    if (redirectUri) {
      params.set('redirect_uri', redirectUri);
    }

    const url = `${this.baseUrl}/api/auth/sso/login${params.toString() ? `?${params}` : ''}`;

    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to initiate SSO login: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Log out the current user.
   */
  async logout(): Promise<LogoutResponse> {
    const response = await fetch(`${this.baseUrl}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to logout: ${response.status}`);
    }

    return response.json();
  }
}

/**
 * Creates an auth client instance from base URL.
 * This helper extracts the baseUrl from the Mastra client options.
 */
export function createAuthClient(baseUrl: string): AuthClient {
  return new AuthClient({ baseUrl });
}
