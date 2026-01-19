import type { Session } from './session.js';
import type { EEUser } from './user.js';

/**
 * Result returned after successful credentials authentication
 */
export interface CredentialsResult<TUser extends EEUser> {
  /** The authenticated user */
  user: TUser;
  /** The created session for the user */
  session: Session;
  /** Set-Cookie headers to set the session cookie */
  cookies?: Record<string, string>;
}

/**
 * Provider interface for email/password (credentials) authentication.
 *
 * Supports:
 * - Sign in with email/password
 * - Sign up (user registration)
 * - Optional password reset flows
 * - Optional sign up enabling/disabling
 *
 * @template TUser - The user type, must extend EEUser
 */
export interface ICredentialsProvider<TUser extends EEUser = EEUser> {
  /**
   * Sign in a user with email and password
   *
   * @param email - User's email address
   * @param password - User's password (plain text, provider should hash)
   * @param request - Optional HTTP request for rate limiting/IP logging
   * @returns User, session, and cookies on success
   * @throws Error on invalid credentials
   */
  signIn(email: string, password: string, request?: Request): Promise<CredentialsResult<TUser>>;

  /**
   * Sign up (register) a new user with email and password
   *
   * @param email - User's email address
   * @param password - User's password (plain text, provider should hash)
   * @param name - Optional user's display name
   * @param request - Optional HTTP request for rate limiting/IP logging
   * @returns User, session, and cookies on success
   * @throws Error if email already exists or signup disabled
   */
  signUp(email: string, password: string, name?: string, request?: Request): Promise<CredentialsResult<TUser>>;

  /**
   * Request a password reset for the given email
   *
   * Typically sends a reset token via email. Optional feature.
   *
   * @param email - User's email address
   * @returns Promise that resolves when reset email is sent
   */
  requestPasswordReset?(email: string): Promise<void>;

  /**
   * Reset password using a reset token
   *
   * @param token - Password reset token from email
   * @param newPassword - New password to set
   * @returns Promise that resolves when password is updated
   * @throws Error if token is invalid or expired
   */
  resetPassword?(token: string, newPassword: string): Promise<void>;

  /**
   * Check if sign up is currently enabled
   *
   * Allows providers to disable registration while keeping login active.
   * If not implemented, sign up is assumed to be enabled.
   *
   * @returns true if sign up is enabled, false otherwise
   */
  isSignUpEnabled?(): boolean;
}
