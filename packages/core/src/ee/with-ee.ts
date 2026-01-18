/**
 * withEE Composition Helper
 *
 * This module provides the `withEE()` function for composing authentication
 * providers with additional EE capabilities.
 *
 * Use this to add RBAC, ACL, audit logging, or other EE features to providers
 * that don't natively support them.
 *
 * @packageDocumentation
 */

import type { EEUser } from './interfaces/user.js';
import type { IUserProvider } from './interfaces/user.js';
import type { ISessionProvider, Session } from './interfaces/session.js';
import type { ISSOProvider } from './interfaces/sso.js';
import type { ICredentialsProvider } from './interfaces/credentials.js';
import type { IRBACProvider } from './interfaces/rbac.js';
import type { IACLProvider } from './interfaces/acl.js';
import type { IAuditLogger } from './interfaces/audit.js';
import { MastraAuthProvider, type MastraAuthProviderConfig, type CapabilityFlags } from './auth-provider.js';
import { buildPublicCapabilities, buildAuthenticatedCapabilities } from './capabilities.js';
import type { PublicAuthCapabilities, AuthenticatedCapabilities } from './capabilities.js';

/**
 * Options for withEE composition helper
 */
export interface WithEEOptions<TUser extends EEUser = EEUser> {
  /**
   * License key for EE features.
   * If not provided, will use MASTRA_EE_LICENSE environment variable.
   */
  licenseKey?: string;

  /**
   * User provider (will override base auth provider's user provider)
   */
  user?: IUserProvider<TUser>;

  /**
   * Session provider (will override base auth provider's session provider)
   */
  session?: ISessionProvider;

  /**
   * SSO provider (will override base auth provider's SSO provider)
   */
  sso?: ISSOProvider<TUser>;

  /**
   * Credentials provider (will override base auth provider's credentials provider)
   */
  credentials?: ICredentialsProvider<TUser>;

  /**
   * RBAC provider to add role-based access control
   */
  rbac?: IRBACProvider<TUser>;

  /**
   * ACL provider to add resource-level access control
   */
  acl?: IACLProvider<TUser>;

  /**
   * Audit logger to add security event logging
   */
  audit?: IAuditLogger;
}

/**
 * Enhanced auth provider with EE capabilities
 */
export type EEAuthProvider<TUser extends EEUser = EEUser> = MastraAuthProvider<TUser>;

/**
 * Compose an auth provider with additional EE capabilities.
 *
 * This function wraps any auth provider to add RBAC, ACL, audit logging,
 * or other EE features that the provider doesn't natively support.
 *
 * @example
 * ```typescript
 * import { MastraAuthWorkos } from '@mastra/auth-workos';
 * import { withEE } from '@mastra/core/ee';
 * import { StaticRBACProvider } from '@mastra/core/ee';
 *
 * const baseAuth = new MastraAuthWorkos({
 *   clientId: process.env.WORKOS_CLIENT_ID!,
 *   apiKey: process.env.WORKOS_API_KEY!,
 * });
 *
 * // Add custom RBAC and audit logging to WorkOS auth
 * const auth = withEE(baseAuth, {
 *   rbac: new StaticRBACProvider({
 *     roleMapping: {
 *       admin: ['*'],
 *       member: ['agents:read', 'workflows:execute'],
 *     },
 *     getRolesFromUser: (user) => user.metadata?.roles ?? ['member'],
 *   }),
 *   audit: new ConsoleAuditLogger(),
 * });
 * ```
 *
 * @param baseAuth - The base authentication provider to enhance
 * @param options - EE capabilities to add
 * @returns Enhanced auth provider with composed capabilities
 */
export function withEE<TUser extends EEUser = EEUser>(
  baseAuth: MastraAuthProvider<TUser>,
  options: WithEEOptions<TUser> = {},
): EEAuthProvider<TUser> {
  // Create a new provider class that extends the base provider
  class ComposedAuthProvider extends MastraAuthProvider<TUser> {
    constructor() {
      super({
        name: `${baseAuth.name}-ee`,
        logger: (baseAuth as any).logger,
      });

      // Compose all providers - options override base auth
      (this as any).user = options.user ?? baseAuth.user;
      (this as any).session = options.session ?? baseAuth.session;
      (this as any).sso = options.sso ?? baseAuth.sso;
      (this as any).credentials = options.credentials ?? baseAuth.credentials;
      (this as any).rbac = options.rbac ?? baseAuth.rbac;
      (this as any).acl = options.acl ?? baseAuth.acl;
      (this as any).audit = options.audit ?? baseAuth.audit;

      // Preserve isMastraCloudAuth flag
      (this as any).isMastraCloudAuth = baseAuth.isMastraCloudAuth;
    }

    /**
     * Delegate getCurrentUser to base auth provider
     */
    async getCurrentUser(request: Request): Promise<TUser | null> {
      return baseAuth.getCurrentUser(request);
    }

    /**
     * Override getCapabilities to include composed capabilities
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
     * Override buildCapabilities to use composed capabilities
     */
    async buildCapabilities(request: Request): Promise<PublicAuthCapabilities | AuthenticatedCapabilities> {
      const user = await this.getCurrentUser(request);

      if (!user) {
        return buildPublicCapabilities(this);
      }

      return buildAuthenticatedCapabilities(this, user);
    }
  }

  return new ComposedAuthProvider();
}
