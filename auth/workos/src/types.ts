import type { EEUser } from '@mastra/core/ee';

/**
 * Configuration options for WorkOS authentication provider
 */
export interface WorkOSConfig {
  /**
   * WorkOS API key for authentication
   * Can be obtained from WorkOS dashboard
   */
  apiKey: string;

  /**
   * WorkOS client ID for your application
   * Can be obtained from WorkOS dashboard
   */
  clientId: string;

  /**
   * Redirect URI for OAuth callback
   * Must match the redirect URI configured in WorkOS dashboard
   */
  redirectUri: string;

  /**
   * Password for encrypting session cookies
   * Must be at least 32 characters long for AES-256 encryption
   */
  cookiePassword: string;

  /**
   * Optional organization ID for restricting authentication to specific organization
   */
  organizationId?: string;

  /**
   * Optional custom domain for WorkOS AuthKit
   */
  customDomain?: string;
}

/**
 * WorkOS user type extending the base EEUser with WorkOS-specific fields
 */
export interface WorkOSUser extends EEUser {
  /**
   * WorkOS user ID (sub claim from JWT)
   */
  id: string;

  /**
   * User's email address
   */
  email: string;

  /**
   * User's full name
   */
  name?: string;

  /**
   * User's avatar/profile image URL
   */
  avatarUrl?: string;

  /**
   * WorkOS-specific fields
   */
  workos: {
    /**
     * WorkOS user ID
     */
    userId: string;

    /**
     * Organization ID the user belongs to
     */
    organizationId?: string;

    /**
     * User's role within the organization
     */
    role?: string;

    /**
     * First name from WorkOS profile
     */
    firstName?: string;

    /**
     * Last name from WorkOS profile
     */
    lastName?: string;

    /**
     * Email verification status
     */
    emailVerified?: boolean;

    /**
     * Profile creation timestamp
     */
    createdAt?: string;

    /**
     * Profile last update timestamp
     */
    updatedAt?: string;
  };

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}
