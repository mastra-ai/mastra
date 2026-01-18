/**
 * MastraAuthProvider Base Class
 *
 * This is the base class that all authentication providers extend.
 * It provides a common structure for composing multiple EE interfaces.
 *
 * @packageDocumentation
 */

import type { EEUser } from './interfaces/user.js';
import type { IUserProvider } from './interfaces/user.js';
import type { ISessionProvider } from './interfaces/session.js';
import type { ISSOProvider } from './interfaces/sso.js';
import type { ICredentialsProvider } from './interfaces/credentials.js';
import type { IRBACProvider } from './interfaces/rbac.js';
import type { IACLProvider } from './interfaces/acl.js';
import type { IAuditLogger } from './interfaces/audit.js';

/**
 * Configuration for MastraAuthProvider
 */
export interface MastraAuthProviderConfig {
  /** Optional provider name for identification */
  name?: string;
  /** Optional custom logger */
  logger?: {
    info: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
  };
}

/**
 * Capability flags for feature detection
 */
export interface CapabilityFlags {
  /** User provider is available */
  user: boolean;
  /** Session provider is available */
  session: boolean;
  /** SSO provider is available */
  sso: boolean;
  /** Credentials provider is available */
  credentials: boolean;
  /** RBAC provider is available */
  rbac: boolean;
  /** ACL provider is available */
  acl: boolean;
  /** Audit logger is available */
  audit: boolean;
}

/**
 * Base authentication provider class.
 *
 * All Mastra auth providers extend this class. It provides a common
 * structure for composing multiple EE interfaces (user, session, SSO, RBAC, etc.).
 *
 * Providers can implement any subset of the EE interfaces. The base class
 * provides capability detection via `getCapabilities()`.
 *
 * @example
 * ```typescript
 * class MyAuthProvider extends MastraAuthProvider<MyUser> {
 *   constructor(config: MyConfig) {
 *     super({ name: 'my-auth' });
 *     this.user = new MyUserProvider(config);
 *     this.session = new MySessionProvider(config);
 *   }
 *
 *   async getCurrentUser(request: Request): Promise<MyUser | null> {
 *     const sessionId = this.session?.getSessionIdFromRequest(request);
 *     if (!sessionId) return null;
 *     const session = await this.session?.validateSession(sessionId);
 *     if (!session) return null;
 *     return this.user?.getUser(session.userId) ?? null;
 *   }
 * }
 * ```
 */
export abstract class MastraAuthProvider<TUser extends EEUser = EEUser> {
  /** Provider name for identification */
  readonly name: string;

  /** Logger instance */
  protected logger?: MastraAuthProviderConfig['logger'];

  /**
   * Set to true if this is Mastra Cloud Auth.
   * Mastra Cloud Auth bypasses license checks.
   */
  readonly isMastraCloudAuth: boolean = false;

  /**
   * User provider for retrieving current user information
   */
  readonly user?: IUserProvider<TUser>;

  /**
   * Session provider for managing user sessions
   */
  readonly session?: ISessionProvider;

  /**
   * SSO provider for OAuth/OIDC flows
   */
  readonly sso?: ISSOProvider<TUser>;

  /**
   * Credentials provider for email/password authentication
   */
  readonly credentials?: ICredentialsProvider<TUser>;

  /**
   * RBAC provider for role-based access control
   */
  readonly rbac?: IRBACProvider<TUser>;

  /**
   * ACL provider for resource-level access control
   */
  readonly acl?: IACLProvider<TUser>;

  /**
   * Audit logger for security event tracking
   */
  readonly audit?: IAuditLogger;

  /**
   * Create a new auth provider.
   *
   * @param config - Provider configuration
   */
  constructor(config: MastraAuthProviderConfig = {}) {
    this.name = config.name ?? 'mastra-auth';
    this.logger = config.logger;
  }

  /**
   * Get the current authenticated user from a request.
   *
   * This is the primary method that must be implemented by all auth providers.
   * Typically, this extracts a session from the request, validates it, and
   * returns the associated user.
   *
   * @param request - HTTP request object
   * @returns The authenticated user, or null if not authenticated
   */
  abstract getCurrentUser(request: Request): Promise<TUser | null>;

  /**
   * Get capability flags for this provider.
   *
   * This method detects which EE interfaces are implemented by checking
   * if the corresponding provider properties are defined.
   *
   * @returns Capability flags indicating which features are available
   */
  getCapabilities(): CapabilityFlags {
    return {
      user: !!this.user,
      session: !!this.session,
      sso: !!this.sso,
      credentials: !!this.credentials,
      rbac: !!this.rbac,
      acl: !!this.acl,
      audit: !!this.audit,
    };
  }

  /**
   * Build capabilities for a specific request context.
   *
   * This is a stub method that subclasses can override to provide
   * request-specific capabilities (e.g., checking if user is authenticated,
   * computing available login methods, etc.).
   *
   * This will be used by the capabilities API in tasks 010-011.
   *
   * @param request - HTTP request object
   * @returns Request-specific capability information
   */
  async buildCapabilities(request: Request): Promise<any> {
    // Default implementation - subclasses can override
    const user = await this.getCurrentUser(request);
    return {
      authenticated: !!user,
      capabilities: this.getCapabilities(),
    };
  }
}
