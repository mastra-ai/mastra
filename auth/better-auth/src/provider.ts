/**
 * Better Auth provider implementation for Mastra.
 *
 * Provides self-hosted authentication using Better Auth with support for:
 * - Email/password authentication
 * - Session management
 * - User management
 *
 * @module auth-better-auth/provider
 */

import { MastraAuthProvider } from '@mastra/core/ee';
import { betterAuth } from 'better-auth';
import type { Auth } from 'better-auth';

import { BetterAuthCredentialsProvider } from './credentials.js';
import { BetterAuthUserProvider } from './user.js';
import type { BetterAuthConfig, BetterAuthUser } from './types.js';

/**
 * Mastra Better Auth provider.
 *
 * Main provider class that composes credentials and user providers
 * using Better Auth for self-hosted authentication.
 *
 * @example
 * ```typescript
 * import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';
 *
 * const auth = new MastraAuthBetterAuth({
 *   database: {
 *     provider: 'postgresql',
 *     url: process.env.DATABASE_URL!,
 *   },
 *   secret: process.env.AUTH_SECRET!,
 *   baseURL: process.env.BASE_URL!,
 *   emailAndPassword: {
 *     enabled: true,
 *     requireEmailVerification: false,
 *   },
 * });
 *
 * // Use with Mastra server
 * const mastra = new Mastra({
 *   auth,
 *   // ... other config
 * });
 * ```
 */
export class MastraAuthBetterAuth extends MastraAuthProvider<BetterAuthUser> {
  private betterAuthInstance: Auth;
  public override readonly credentials: BetterAuthCredentialsProvider;
  public override readonly user: BetterAuthUserProvider;

  constructor(private config: BetterAuthConfig) {
    super({ name: 'better-auth' });

    // Validate required configuration
    this.validateConfig(config);

    // Initialize Better Auth instance
    this.betterAuthInstance = this.initializeBetterAuth(config);

    // Initialize providers
    this.credentials = new BetterAuthCredentialsProvider(this.betterAuthInstance, config);
    this.user = new BetterAuthUserProvider(this.betterAuthInstance, config);
  }

  /**
   * Get current authenticated user from request.
   *
   * Delegates to the user provider.
   *
   * @param request - Incoming HTTP request
   * @returns Better Auth user or null if not authenticated
   */
  async getCurrentUser(request: Request): Promise<BetterAuthUser | null> {
    return this.user.getCurrentUser(request);
  }

  /**
   * Get the Better Auth instance.
   *
   * Provides access to the underlying Better Auth client for advanced use cases.
   *
   * @returns Better Auth instance
   */
  getBetterAuthInstance(): Auth {
    return this.betterAuthInstance;
  }

  /**
   * Validate configuration.
   *
   * @private
   * @param config - Better Auth configuration
   * @throws Error if required fields are missing
   */
  private validateConfig(config: BetterAuthConfig): void {
    if (!config.database) {
      throw new Error('Better Auth: database configuration is required');
    }

    if (!config.database.provider) {
      throw new Error('Better Auth: database.provider is required');
    }

    if (!config.database.url) {
      throw new Error('Better Auth: database.url is required');
    }

    if (!config.secret) {
      throw new Error('Better Auth: secret is required');
    }

    if (config.secret.length < 32) {
      throw new Error('Better Auth: secret must be at least 32 characters (use openssl rand -base64 32)');
    }

    if (!config.baseURL) {
      throw new Error('Better Auth: baseURL is required');
    }
  }

  /**
   * Initialize Better Auth instance.
   *
   * @private
   * @param config - Better Auth configuration
   * @returns Initialized Better Auth instance
   */
  private initializeBetterAuth(config: BetterAuthConfig): Auth {
    try {
      // Map our config to Better Auth config format
      const betterAuthConfig: any = {
        database: {
          provider: config.database.provider,
          url: config.database.url,
        },
        secret: config.secret,
        baseURL: config.baseURL,
        emailAndPassword: {
          enabled: config.emailAndPassword?.enabled ?? true,
          requireEmailVerification: config.emailAndPassword?.requireEmailVerification ?? false,
          minPasswordLength: config.emailAndPassword?.minPasswordLength ?? 8,
        },
        session: {
          expiresIn: config.session?.expiresIn ?? 60 * 60 * 24 * 7, // 7 days default
          cookieName: config.session?.cookieName ?? 'better_auth_session',
        },
        // Pass through any additional options
        ...config.options,
      };

      return betterAuth(betterAuthConfig);
    } catch (error) {
      throw new Error(`Better Auth initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
