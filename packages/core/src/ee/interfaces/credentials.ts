/**
 * Credentials provider interface for EE authentication.
 * Enables email/password sign-in and sign-up in Studio.
 */

import type { EEUser } from './user';

/**
 * Result of a successful credentials operation.
 */
export interface CredentialsResult<TUser extends EEUser = EEUser> {
  /** The authenticated user */
  user: TUser;
  /** Optional session token */
  token?: string;
  /** Optional cookies to set on the response (e.g., session cookies) */
  cookies?: string[];
}

/**
 * Provider interface for credentials-based authentication in Studio.
 *
 * Implement this interface to enable:
 * - Email/password sign-in
 * - Email/password sign-up
 * - Password reset (optional)
 *
 * @example
 * ```typescript
 * class MyCredentialsProvider implements ICredentialsProvider {
 *   async signIn(email: string, password: string, request: Request) {
 *     const user = await this.validateCredentials(email, password);
 *     if (!user) throw new Error('Invalid credentials');
 *     return { user };
 *   }
 *
 *   async signUp(email: string, password: string, name?: string) {
 *     const user = await this.createUser({ email, password, name });
 *     return { user };
 *   }
 * }
 * ```
 */
export interface ICredentialsProvider<TUser extends EEUser = EEUser> {
  /**
   * Sign in with email and password.
   *
   * @param email - User email
   * @param password - User password
   * @param request - Incoming HTTP request (for setting cookies, etc.)
   * @returns Result with user and optional token
   * @throws Error if credentials are invalid
   */
  signIn(email: string, password: string, request: Request): Promise<CredentialsResult<TUser>>;

  /**
   * Sign up with email and password.
   *
   * @param email - User email
   * @param password - User password
   * @param name - Optional display name
   * @param request - Incoming HTTP request (for setting cookies, etc.)
   * @returns Result with new user and optional token
   * @throws Error if sign up fails (e.g., email already exists)
   */
  signUp(
    email: string,
    password: string,
    name: string | undefined,
    request: Request,
  ): Promise<CredentialsResult<TUser>>;

  /**
   * Optional: Request password reset.
   *
   * @param email - User email
   * @returns Promise that resolves when reset email is sent
   */
  requestPasswordReset?(email: string): Promise<void>;

  /**
   * Optional: Reset password with token.
   *
   * @param token - Reset token from email
   * @param newPassword - New password
   * @returns Promise that resolves when password is reset
   */
  resetPassword?(token: string, newPassword: string): Promise<void>;

  /**
   * Optional: Check if sign-up is enabled.
   * Defaults to true if not implemented.
   *
   * Use this to disable public registration while still allowing sign-in.
   *
   * @returns Whether sign-up is enabled
   */
  isSignUpEnabled?(): boolean;
}
