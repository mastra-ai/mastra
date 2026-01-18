import type { EEUser } from '@mastra/core/ee';
import type { User as WorkOSApiUser } from '@workos-inc/node';

/**
 * Session configuration options
 */
export interface WorkOSSessionConfig {
  /**
   * Password for encrypting session cookies
   * Must be at least 32 characters long for AES-256 encryption
   */
  cookiePassword: string;

  /**
   * Optional cookie name (defaults to 'wos_session')
   */
  cookieName?: string;

  /**
   * Optional cookie max age in seconds (defaults to 400 days)
   */
  maxAge?: number;

  /**
   * Optional cookie SameSite attribute
   */
  sameSite?: 'lax' | 'strict' | 'none';

  /**
   * Optional cookie domain
   */
  domain?: string;
}

/**
 * SSO configuration options
 */
export interface WorkOSSSOConfig {
  /**
   * Specific OAuth provider to use (Google, Microsoft, GitHub, Apple)
   */
  provider?: 'GoogleOAuth' | 'MicrosoftOAuth' | 'GitHubOAuth' | 'AppleOAuth';

  /**
   * Specific connection ID to use for SSO
   */
  connection?: string;

  /**
   * Default organization ID for SSO
   */
  defaultOrganization?: string;
}

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
   * Optional session configuration
   */
  session?: WorkOSSessionConfig;

  /**
   * Optional SSO configuration
   */
  sso?: WorkOSSSOConfig;

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
 * Extended configuration with provider name
 */
export interface MastraAuthWorkosOptions extends WorkOSConfig {
  /**
   * Optional provider name
   */
  name?: string;

  /**
   * Optional session configuration
   */
  session?: WorkOSSessionConfig;

  /**
   * Optional SSO configuration
   */
  sso?: WorkOSSSOConfig;
}

/**
 * WorkOS user type extending the base EEUser with WorkOS-specific fields
 */
export interface WorkOSUser extends EEUser {
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

/**
 * Map a WorkOS API user to the EEUser format.
 *
 * @param user - WorkOS API user object
 * @returns EEUser with basic fields populated
 */
export function mapWorkOSUserToEEUser(user: WorkOSApiUser): EEUser {
  return {
    id: user.id,
    email: user.email,
    name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
    avatarUrl: user.profilePictureUrl || undefined,
    metadata: {},
  };
}
