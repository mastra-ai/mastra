import type { EEUser } from '@mastra/core/ee';

/**
 * Better Auth configuration options
 *
 * Supports various database backends for self-hosted authentication.
 *
 * @example
 * ```ts
 * const config: BetterAuthConfig = {
 *   database: {
 *     provider: 'postgresql',
 *     url: process.env.DATABASE_URL,
 *   },
 *   secret: process.env.AUTH_SECRET,
 *   baseURL: process.env.BASE_URL,
 *   emailAndPassword: {
 *     enabled: true,
 *     requireEmailVerification: false,
 *   },
 * };
 * ```
 */
export interface BetterAuthConfig {
  /**
   * Database configuration
   *
   * Supported providers: postgresql, mysql, sqlite, mongodb
   */
  database: {
    /**
     * Database provider type
     */
    provider: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';
    /**
     * Database connection URL
     */
    url: string;
  };

  /**
   * Secret key for session encryption
   *
   * Minimum 32 characters required for AES-256 encryption.
   * Generate with: `openssl rand -base64 32`
   */
  secret: string;

  /**
   * Base URL for the application
   *
   * Used for redirect URLs and email verification links.
   */
  baseURL: string;

  /**
   * Email and password authentication configuration
   */
  emailAndPassword?: {
    /**
     * Enable email/password authentication
     *
     * @default true
     */
    enabled?: boolean;

    /**
     * Require email verification before allowing login
     *
     * @default false
     */
    requireEmailVerification?: boolean;

    /**
     * Minimum password length
     *
     * @default 8
     */
    minPasswordLength?: number;

    /**
     * Allow password reset via email
     *
     * @default true
     */
    allowPasswordReset?: boolean;
  };

  /**
   * Session configuration
   */
  session?: {
    /**
     * Session expiry in seconds
     *
     * @default 604800 (7 days)
     */
    expiresIn?: number;

    /**
     * Cookie name for session storage
     *
     * @default 'better_auth_session'
     */
    cookieName?: string;
  };

  /**
   * Additional Better Auth options
   *
   * Pass through any additional Better Auth configuration options.
   */
  options?: Record<string, unknown>;
}

/**
 * Better Auth user interface
 *
 * Extends EEUser with Better Auth specific fields.
 */
export interface BetterAuthUser extends EEUser {
  /**
   * Better Auth specific user data
   */
  betterAuth: {
    /**
     * User ID in Better Auth database
     */
    userId: string;

    /**
     * Email verification status
     */
    emailVerified: boolean;

    /**
     * Account creation timestamp
     */
    createdAt: Date;

    /**
     * Last updated timestamp
     */
    updatedAt: Date;
  };
}
