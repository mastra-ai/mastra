import type { EEUser } from '@mastra/core/ee';

/**
 * Configuration for Mastra Cloud authentication provider
 *
 * The Cloud auth provider works with zero configuration by default,
 * connecting to Mastra Cloud's hosted authentication service.
 *
 * @example
 * ```ts
 * // Zero config - uses defaults
 * const auth = new MastraAuthCloud();
 *
 * // Custom configuration
 * const auth = new MastraAuthCloud({
 *   apiKey: process.env.MASTRA_CLOUD_API_KEY,
 *   endpoint: 'https://api.mastra.cloud',
 * });
 * ```
 */
export interface CloudAuthConfig {
  /**
   * Mastra Cloud API key
   * Defaults to MASTRA_CLOUD_API_KEY environment variable
   * If not provided, will use anonymous access (suitable for development)
   */
  apiKey?: string;

  /**
   * Mastra Cloud API endpoint
   * @default 'https://api.mastra.cloud'
   */
  endpoint?: string;

  /**
   * Optional custom domain for SSO redirect
   * If provided, SSO will redirect to this domain instead of api.mastra.cloud
   */
  customDomain?: string;
}

/**
 * User object returned by Mastra Cloud authentication
 *
 * Extends EEUser with Mastra Cloud specific fields
 */
export interface CloudUser extends EEUser {
  /**
   * Mastra Cloud specific user data
   */
  cloud: {
    /**
     * Mastra Cloud user ID
     */
    userId: string;

    /**
     * Mastra Cloud organization ID
     */
    organizationId?: string;

    /**
     * User's role in the organization
     */
    role?: string;

    /**
     * Whether the user's email has been verified
     */
    emailVerified: boolean;

    /**
     * User creation timestamp
     */
    createdAt: Date;

    /**
     * Last update timestamp
     */
    updatedAt: Date;
  };
}
