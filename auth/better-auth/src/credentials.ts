/**
 * Better Auth credentials provider implementation.
 *
 * Implements the ICredentialsProvider interface for email/password authentication
 * using Better Auth's self-hosted authentication system.
 *
 * @module auth-better-auth/credentials
 */

import type { ICredentialsProvider, CredentialsResult, Session } from '@mastra/core/ee';
import type { Auth } from 'better-auth';

import type { BetterAuthUser, BetterAuthConfig } from './types.js';

/**
 * Better Auth credentials provider for email/password authentication.
 *
 * Handles:
 * - Sign in with email/password
 * - User registration (sign up)
 * - Password reset flows
 * - Session creation
 *
 * @example
 * ```typescript
 * const credentialsProvider = new BetterAuthCredentialsProvider(
 *   betterAuthInstance,
 *   config
 * );
 *
 * const result = await credentialsProvider.signIn('user@example.com', 'password');
 * console.log('Logged in as:', result.user.email);
 * ```
 */
export class BetterAuthCredentialsProvider implements ICredentialsProvider<BetterAuthUser> {
  constructor(
    private betterAuth: Auth,
    private config: BetterAuthConfig,
  ) {}

  /**
   * Sign in a user with email and password.
   *
   * @param email - User's email address
   * @param password - User's password (plain text)
   * @param _request - HTTP request for rate limiting (currently unused)
   * @returns User, session, and cookies on successful authentication
   * @throws Error if credentials are invalid or email not verified (when required)
   */
  async signIn(email: string, password: string, _request?: Request): Promise<CredentialsResult<BetterAuthUser>> {
    try {
      // Sign in with Better Auth
      const result = await this.betterAuth.api.signInEmail({
        body: {
          email,
          password,
        },
      });

      if (!result?.user || !result?.token) {
        throw new Error('Invalid credentials');
      }

      const betterAuthUser = result.user;

      // Check if email verification is required
      if (this.config.emailAndPassword?.requireEmailVerification && !betterAuthUser.emailVerified) {
        throw new Error('Email verification required');
      }

      // Map Better Auth user to BetterAuthUser format
      const user: BetterAuthUser = {
        id: betterAuthUser.id,
        email: betterAuthUser.email,
        name: betterAuthUser.name,
        avatarUrl: betterAuthUser.image ?? undefined,
        metadata: {},
        betterAuth: {
          userId: betterAuthUser.id,
          emailVerified: betterAuthUser.emailVerified,
          createdAt: new Date(betterAuthUser.createdAt),
          updatedAt: new Date(betterAuthUser.updatedAt),
        },
      };

      // Create Mastra session object
      // Better Auth uses token-based sessions
      const expiresIn = this.config.session?.expiresIn || 604800; // 7 days default
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      const session: Session = {
        id: result.token,
        userId: betterAuthUser.id,
        expiresAt,
        createdAt: new Date(),
        metadata: {
          token: result.token,
        },
      };

      // Generate session cookie headers
      const cookieName = this.config.session?.cookieName || 'better_auth_session';
      const cookies = {
        'Set-Cookie': this.createSessionCookie(cookieName, result.token, session.expiresAt),
      };

      return {
        user,
        session,
        cookies,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Sign in failed');
    }
  }

  /**
   * Sign up (register) a new user with email and password.
   *
   * @param email - User's email address
   * @param password - User's password (plain text)
   * @param name - User's display name
   * @param _request - HTTP request for rate limiting (currently unused)
   * @returns User, session, and cookies on successful registration
   * @throws Error if sign up is disabled, email exists, or password is too weak
   */
  async signUp(
    email: string,
    password: string,
    name?: string,
    _request?: Request,
  ): Promise<CredentialsResult<BetterAuthUser>> {
    // Check if sign up is enabled
    if (!this.isSignUpEnabled()) {
      throw new Error('Sign up is disabled');
    }

    try {
      // Validate password length
      const minPasswordLength = this.config.emailAndPassword?.minPasswordLength || 8;
      if (password.length < minPasswordLength) {
        throw new Error(`Password must be at least ${minPasswordLength} characters`);
      }

      // Sign up with Better Auth
      // Note: Better Auth uses signUpEmail, not signUp
      const body: any = {
        email,
        password,
      };

      if (name) {
        body.name = name;
      }

      const result = (await this.betterAuth.api.signUpEmail({
        body,
      })) as any;

      if (!result?.user || !result?.token) {
        throw new Error('Sign up failed');
      }

      const betterAuthUser = result.user;

      // Map Better Auth user to BetterAuthUser format
      const user: BetterAuthUser = {
        id: betterAuthUser.id,
        email: betterAuthUser.email,
        name: betterAuthUser.name,
        avatarUrl: betterAuthUser.image ?? undefined,
        metadata: {},
        betterAuth: {
          userId: betterAuthUser.id,
          emailVerified: betterAuthUser.emailVerified ?? false,
          createdAt: new Date(betterAuthUser.createdAt),
          updatedAt: new Date(betterAuthUser.updatedAt),
        },
      };

      // Create Mastra session object
      const expiresIn = this.config.session?.expiresIn || 604800; // 7 days default
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      const session: Session = {
        id: result.token,
        userId: betterAuthUser.id,
        expiresAt,
        createdAt: new Date(),
        metadata: {
          token: result.token,
        },
      };

      // Generate session cookie headers
      const cookieName = this.config.session?.cookieName || 'better_auth_session';
      const cookies = {
        'Set-Cookie': this.createSessionCookie(cookieName, result.token, session.expiresAt),
      };

      return {
        user,
        session,
        cookies,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Sign up failed');
    }
  }

  /**
   * Request a password reset for the given email.
   *
   * Sends a password reset email to the user.
   *
   * @param email - User's email address
   */
  async requestPasswordReset(email: string): Promise<void> {
    if (!this.config.emailAndPassword?.allowPasswordReset) {
      throw new Error('Password reset is disabled');
    }

    try {
      // Better Auth uses forgetPassword endpoint
      await (this.betterAuth.api as any).forgetPassword({
        body: {
          email,
          redirectTo: `${this.config.baseURL}/reset-password`,
        },
      });
    } catch (error) {
      // Don't expose whether email exists (security best practice)
      // Better Auth will handle the email sending if user exists
    }
  }

  /**
   * Reset password using a reset token.
   *
   * @param token - Password reset token from email
   * @param newPassword - New password to set
   * @throws Error if token is invalid or expired
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!this.config.emailAndPassword?.allowPasswordReset) {
      throw new Error('Password reset is disabled');
    }

    try {
      // Validate password length
      const minPasswordLength = this.config.emailAndPassword?.minPasswordLength || 8;
      if (newPassword.length < minPasswordLength) {
        throw new Error(`Password must be at least ${minPasswordLength} characters`);
      }

      await this.betterAuth.api.resetPassword({
        body: {
          token,
          newPassword,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Password reset failed');
    }
  }

  /**
   * Check if sign up is currently enabled.
   *
   * @returns true if sign up is enabled, false otherwise
   */
  isSignUpEnabled(): boolean {
    return this.config.emailAndPassword?.enabled !== false;
  }

  /**
   * Create a session cookie string.
   *
   * @private
   * @param name - Cookie name
   * @param value - Cookie value (session token)
   * @param expiresAt - Cookie expiry date
   * @returns Set-Cookie header value
   */
  private createSessionCookie(name: string, value: string, expiresAt: Date): string {
    const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    const isProduction = process.env.NODE_ENV === 'production';

    // URI-encode cookie value to handle special characters (;, =, spaces, etc.)
    const encodedValue = encodeURIComponent(value);
    const parts = [`${name}=${encodedValue}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${maxAge}`];

    if (isProduction) {
      parts.push('Secure');
    }

    return parts.join('; ');
  }
}
