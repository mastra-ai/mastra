/**
 * Main WorkOS authentication provider for Mastra EE.
 *
 * This provider composes all WorkOS authentication capabilities:
 * - SSO via WorkOS AuthKit (OAuth/OIDC)
 * - Session management with encrypted cookies
 * - User management via WorkOS User Management API
 * - RBAC via WorkOS organization memberships
 * - Optional directory sync (SCIM)
 * - Optional audit export to WorkOS Audit Logs
 *
 * @module auth-workos/provider-ee
 */

import { MastraAuthProvider, type MastraAuthProviderConfig } from '@mastra/core/ee';
import type { EEUser } from '@mastra/core/ee';
import { WorkOS } from '@workos-inc/node';
import { createAuthService, type AuthKitConfig } from '@workos/authkit-session';

import type { WorkOSConfig, WorkOSUser, MastraAuthWorkosOptions } from './types.js';
import { WorkOSSSOProvider } from './sso.js';
import { WorkOSSessionProvider } from './session.js';
import { WebSessionStorage } from './session-storage.js';
import { WorkOSUserProvider } from './user.js';
import { MastraRBACWorkos, type WorkOSRBACConfig } from './rbac.js';
import { WorkOSDirectorySync, type WorkOSDirectorySyncConfig } from './directory-sync.js';
import { WorkOSAuditExporter, type WorkOSAuditExporterConfig } from './audit-export.js';

/**
 * Extended options for MastraAuthWorkos including optional RBAC, directory sync, and audit export.
 */
export interface MastraAuthWorkosEEOptions extends MastraAuthWorkosOptions {
  /**
   * Optional RBAC configuration for role-based access control
   */
  rbac?: WorkOSRBACConfig;

  /**
   * Optional directory sync configuration for SCIM provisioning
   */
  directorySync?: WorkOSDirectorySyncConfig;

  /**
   * Optional audit export configuration for WorkOS Audit Logs
   */
  auditExport?: WorkOSAuditExporterConfig;
}

/**
 * Main WorkOS authentication provider for Mastra EE.
 *
 * This provider composes all WorkOS sub-providers (SSO, session, user, RBAC)
 * and optionally enables directory sync and audit export.
 *
 * @example
 * ```typescript
 * const authProvider = new MastraAuthWorkosEE({
 *   apiKey: process.env.WORKOS_API_KEY!,
 *   clientId: process.env.WORKOS_CLIENT_ID!,
 *   redirectUri: 'https://myapp.com/auth/callback',
 *   cookiePassword: process.env.SESSION_SECRET!,
 *   sso: {
 *     provider: 'GoogleOAuth',
 *   },
 *   rbac: {
 *     organizationId: 'org_123',
 *     roleMapping: {
 *       admin: ['*'],
 *       member: ['agents:read', 'workflows:read'],
 *     },
 *   },
 * });
 *
 * // Use with Mastra
 * const mastra = new Mastra({
 *   auth: authProvider,
 *   // ...other config
 * });
 * ```
 */
export class MastraAuthWorkosEE extends MastraAuthProvider<EEUser> {
  private workos: WorkOS;
  private authService: ReturnType<typeof createAuthService<Request, Response>>;
  private directorySyncInstance?: WorkOSDirectorySync;

  /**
   * Create a new WorkOS EE auth provider.
   *
   * @param options - Configuration options
   */
  constructor(options: MastraAuthWorkosEEOptions) {
    const baseConfig: MastraAuthProviderConfig = {
      name: options.name ?? 'workos',
    };
    super(baseConfig);

    // Validate required configuration
    if (!options.apiKey) {
      throw new Error('WorkOS API key is required. Provide via options.apiKey or WORKOS_API_KEY env var.');
    }
    if (!options.clientId) {
      throw new Error('WorkOS client ID is required. Provide via options.clientId or WORKOS_CLIENT_ID env var.');
    }
    if (!options.redirectUri) {
      throw new Error('Redirect URI is required. Provide via options.redirectUri.');
    }
    if (!options.cookiePassword || options.cookiePassword.length < 32) {
      throw new Error('Cookie password must be at least 32 characters long for AES-256 encryption.');
    }

    // Initialize WorkOS SDK
    this.workos = new WorkOS(options.apiKey, {
      clientId: options.clientId,
    });

    // Initialize AuthKit session service
    const authKitConfig: AuthKitConfig = {
      apiKey: options.apiKey,
      clientId: options.clientId,
      cookiePassword: options.cookiePassword,
      redirectUri: options.redirectUri,
      cookieName: options.session?.cookieName ?? 'wos_session',
      cookieMaxAge: options.session?.maxAge ?? 34560000, // 400 days in seconds (WorkOS default)
      apiHttps: true, // Always use HTTPS for WorkOS API
    };

    this.authService = createAuthService<Request, Response>({
      ...authKitConfig,
      sessionStorageFactory: config => new WebSessionStorage(config),
    });

    // Initialize sub-providers
    this.initializeProviders(options);
  }

  /**
   * Initialize all sub-providers based on configuration.
   *
   * @param options - Configuration options
   */
  private initializeProviders(options: MastraAuthWorkosEEOptions): void {
    // Initialize SSO provider
    (this as any).sso = new WorkOSSSOProvider(this.workos, this.authService, options, options.sso);

    // Initialize session provider
    (this as any).session = new WorkOSSessionProvider(this.authService, {
      apiKey: options.apiKey,
      clientId: options.clientId,
      cookiePassword: options.cookiePassword,
      redirectUri: options.redirectUri,
      cookieName: options.session?.cookieName ?? 'wos_session',
      cookieMaxAge: options.session?.maxAge ?? 34560000, // 400 days in seconds (WorkOS default)
      apiHttps: true, // Always use HTTPS for WorkOS API
    });

    // Initialize user provider
    (this as any).user = new WorkOSUserProvider(this.workos, this.authService);

    // Initialize RBAC provider if configured
    if (options.rbac) {
      (this as any).rbac = new MastraRBACWorkos(this.workos, options.rbac);
    }

    // Initialize directory sync if configured
    if (options.directorySync) {
      // Add workos instance to config since WorkOSDirectorySync expects it
      this.directorySyncInstance = new WorkOSDirectorySync({
        ...options.directorySync,
        workos: this.workos,
      });
    }

    // Initialize audit exporter if configured
    if (options.auditExport) {
      // Add workos instance to config since WorkOSAuditExporter expects it
      (this as any).audit = new WorkOSAuditExporter({
        ...options.auditExport,
        workos: this.workos,
      });
    }
  }

  /**
   * Get the current authenticated user from a request.
   *
   * This delegates to the user provider to extract and validate the session,
   * then retrieve the user information.
   *
   * @param request - HTTP request object
   * @returns The authenticated user, or null if not authenticated
   */
  async getCurrentUser(request: Request): Promise<EEUser | null> {
    if (!this.user) {
      return null;
    }
    return this.user.getCurrentUser(request);
  }

  /**
   * Get the WorkOS SDK instance for advanced use cases.
   *
   * @returns WorkOS SDK instance
   */
  getWorkOSClient(): WorkOS {
    return this.workos;
  }

  /**
   * Get the directory sync instance if configured.
   *
   * @returns Directory sync instance or undefined
   */
  getDirectorySync(): WorkOSDirectorySync | undefined {
    return this.directorySyncInstance;
  }
}
