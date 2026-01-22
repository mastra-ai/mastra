/**
 * withEE wrapper for adding EE capabilities to existing auth providers.
 */

import type { MastraAuthProvider } from '../server';
import type { IUserProvider, ISessionProvider, ISSOProvider, IRBACProvider, IACLProvider } from './interfaces';
import { validateLicense } from './license';

/**
 * Options for withEE wrapper.
 */
export interface WithEEOptions {
  /** EE license key (defaults to MASTRA_EE_LICENSE env var) */
  licenseKey?: string;
  /** User provider implementation */
  user?: IUserProvider;
  /** Session provider implementation */
  session?: ISessionProvider;
  /** SSO provider implementation */
  sso?: ISSOProvider;
  /** RBAC provider implementation */
  rbac?: IRBACProvider;
  /** ACL provider implementation */
  acl?: IACLProvider;
}

/**
 * Combined type for auth provider with EE capabilities.
 */
export type EEAuthProvider<TUser = unknown> = MastraAuthProvider<TUser> &
  Partial<IUserProvider & ISessionProvider & ISSOProvider & IRBACProvider & IACLProvider>;

/**
 * Wrap an existing auth provider with EE capabilities.
 *
 * This function creates a composite auth provider that combines the base
 * provider's authentication with additional EE capabilities (user awareness,
 * SSO, RBAC, ACL, audit logging).
 *
 * @example
 * ```typescript
 * import { MastraAuthAuth0 } from '@mastra/auth-auth0';
 * import { withEE, StaticRBACProvider, DEFAULT_ROLES } from '@mastra/core/ee';
 *
 * const auth = withEE(new MastraAuthAuth0({ domain: '...' }), {
 *   licenseKey: process.env.MASTRA_EE_LICENSE,
 *   rbac: new StaticRBACProvider({
 *     roles: DEFAULT_ROLES,
 *     getUserRoles: (user) => [user.role],
 *   }),
 * });
 *
 * const mastra = new Mastra({
 *   server: { auth },
 * });
 * ```
 *
 * @param baseAuth - Base auth provider to wrap
 * @param options - EE capability implementations
 * @returns Combined auth provider with EE capabilities
 */
export function withEE<TUser>(baseAuth: MastraAuthProvider<TUser>, options: WithEEOptions): EEAuthProvider<TUser> {
  // Validate license
  const license = validateLicense(options.licenseKey);
  if (!license.valid) {
    console.warn(
      '[mastra/core/ee] EE license is invalid or missing. ' +
        'EE capabilities will not be available. ' +
        'Set MASTRA_EE_LICENSE environment variable or pass licenseKey option.',
    );
  }

  // Create a proxy that combines base auth with EE capabilities
  const eeAuth: EEAuthProvider<TUser> = Object.create(baseAuth);

  // Copy base auth methods
  eeAuth.authenticateToken = baseAuth.authenticateToken.bind(baseAuth);
  eeAuth.authorizeUser = baseAuth.authorizeUser.bind(baseAuth);

  // Add EE capabilities if license is valid
  if (license.valid) {
    // User provider
    if (options.user) {
      eeAuth.getCurrentUser = options.user.getCurrentUser.bind(options.user);
      eeAuth.getUser = options.user.getUser.bind(options.user);
      if (options.user.getUserProfileUrl) {
        eeAuth.getUserProfileUrl = options.user.getUserProfileUrl.bind(options.user);
      }
    }

    // Session provider
    if (options.session) {
      eeAuth.createSession = options.session.createSession.bind(options.session);
      eeAuth.validateSession = options.session.validateSession.bind(options.session);
      eeAuth.destroySession = options.session.destroySession.bind(options.session);
      eeAuth.refreshSession = options.session.refreshSession.bind(options.session);
      eeAuth.getSessionIdFromRequest = options.session.getSessionIdFromRequest.bind(options.session);
      eeAuth.getSessionHeaders = options.session.getSessionHeaders.bind(options.session);
      eeAuth.getClearSessionHeaders = options.session.getClearSessionHeaders.bind(options.session);
    }

    // SSO provider
    if (options.sso) {
      eeAuth.getLoginUrl = options.sso.getLoginUrl.bind(options.sso);
      eeAuth.handleCallback = options.sso.handleCallback.bind(options.sso);
      eeAuth.getLoginButtonConfig = options.sso.getLoginButtonConfig.bind(options.sso);
      if (options.sso.getLogoutUrl) {
        eeAuth.getLogoutUrl = options.sso.getLogoutUrl.bind(options.sso);
      }
    }

    // RBAC provider
    if (options.rbac) {
      eeAuth.getRoles = options.rbac.getRoles.bind(options.rbac);
      eeAuth.hasRole = options.rbac.hasRole.bind(options.rbac);
      eeAuth.getPermissions = options.rbac.getPermissions.bind(options.rbac);
      eeAuth.hasPermission = options.rbac.hasPermission.bind(options.rbac);
      eeAuth.hasAllPermissions = options.rbac.hasAllPermissions.bind(options.rbac);
      eeAuth.hasAnyPermission = options.rbac.hasAnyPermission.bind(options.rbac);
    }

    // ACL provider
    if (options.acl) {
      eeAuth.canAccess = options.acl.canAccess.bind(options.acl);
      eeAuth.listAccessible = options.acl.listAccessible.bind(options.acl);
      eeAuth.filterAccessible = options.acl.filterAccessible.bind(options.acl);
    }
  }

  return eeAuth;
}
