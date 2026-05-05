/**
 * Capabilities detection and response building for EE authentication.
 */

import type { MastraAuthProvider } from '../../server';
import type { IUserProvider, ISSOProvider, ISessionProvider, ICredentialsProvider } from '../interfaces';
import type { IACLProvider } from './interfaces/acl';
import type { IFGAProvider } from './interfaces/fga';
import type { IRBACProvider } from './interfaces/rbac';
import type { EEUser } from './interfaces/user';
import { isLicenseValid, isDevEnvironment } from './license';

/**
 * Public capabilities response (no authentication required).
 * Contains just enough info to render the login page.
 */
export interface PublicAuthCapabilities {
  /** Whether auth is enabled */
  enabled: boolean;
  /** Login configuration (null if no auth or no SSO) */
  login: {
    /** Type of login available */
    type: 'sso' | 'credentials' | 'both';
    /** Whether sign-up is enabled (defaults to true) */
    signUpEnabled?: boolean;
    /** Optional description explaining the auth requirement and what credentials to use */
    description?: string;
    /** SSO configuration */
    sso?: {
      /** Provider name */
      provider: string;
      /** Button text */
      text: string;
      /** Icon URL */
      icon?: string;
      /** Description of the auth requirement */
      description?: string;
      /** Login URL */
      url: string;
    };
  } | null;
}

/**
 * User info for authenticated response.
 */
export interface AuthenticatedUser {
  /** User ID */
  id: string;
  /** User email */
  email?: string;
  /** Display name */
  name?: string;
  /** Avatar URL */
  avatarUrl?: string;
}

/**
 * Capability flags indicating which EE features are available.
 */
export interface CapabilityFlags {
  /** IUserProvider is implemented and licensed */
  user: boolean;
  /** ISessionProvider is implemented and licensed */
  session: boolean;
  /** ISSOProvider is implemented and licensed */
  sso: boolean;
  /** IRBACProvider is implemented and licensed */
  rbac: boolean;
  /** IACLProvider is implemented and licensed */
  acl: boolean;
  /** IFGAProvider is implemented and licensed */
  fga: boolean;
}

/**
 * User's access (roles and permissions).
 */
export interface UserAccess {
  /** User's roles */
  roles: string[];
  /** User's resolved permissions */
  permissions: string[];
}

/**
 * Authenticated capabilities response.
 * Extends public capabilities with user context and feature flags.
 */
export interface AuthenticatedCapabilities extends PublicAuthCapabilities {
  /** Current authenticated user */
  user: AuthenticatedUser;
  /** Available EE capabilities */
  capabilities: CapabilityFlags;
  /** User's access (if RBAC available) */
  access: UserAccess | null;
  /** Available roles in the system (only present for admin users) */
  availableRoles?: { id: string; name: string }[];
}

/**
 * Type guard to check if response is authenticated.
 */
export function isAuthenticated(
  caps: PublicAuthCapabilities | AuthenticatedCapabilities,
): caps is AuthenticatedCapabilities {
  return 'user' in caps && caps.user !== null;
}

/**
 * Check if an auth provider implements a specific interface.
 */
function implementsInterface<T>(auth: unknown, method: keyof T): auth is T {
  return auth !== null && typeof auth === 'object' && method in auth;
}

/**
 * Check if auth provider is MastraCloudAuth (exempt from license requirement).
 */
function isMastraCloudAuth(auth: unknown): boolean {
  if (!auth || typeof auth !== 'object') return false;
  // Check for the MastraCloudAuth marker
  return 'isMastraCloudAuth' in auth && (auth as { isMastraCloudAuth: boolean }).isMastraCloudAuth === true;
}

/**
 * Check if auth provider is SimpleAuth (exempt from license requirement).
 * SimpleAuth is for development/testing and should work without a license.
 */
function isSimpleAuth(auth: unknown): boolean {
  if (!auth || typeof auth !== 'object') return false;
  return 'isSimpleAuth' in auth && (auth as { isSimpleAuth: boolean }).isSimpleAuth === true;
}

/**
 * Check if a set of permissions includes admin bypass (`*` or `*:*`).
 */
function hasAdminBypassPermissions(permissions: string[]): boolean {
  return permissions.some(p => p === '*' || p === '*:*');
}

/**
 * Options for building capabilities.
 */
export interface BuildCapabilitiesOptions {
  /**
   * RBAC provider for role-based access control (EE feature).
   * Separate from the auth provider to allow mixing different providers.
   *
   * @example
   * ```typescript
   * const rbac = new StaticRBACProvider({
   *   roles: DEFAULT_ROLES,
   *   getUserRoles: (user) => [user.role],
   * });
   *
   * buildCapabilities(auth, request, { rbac });
   * ```
   */
  rbac?: IRBACProvider<EEUser>;

  /**
   * FGA provider for fine-grained authorization (EE feature).
   * Separate from the auth provider to allow mixing different providers.
   */
  fga?: IFGAProvider<EEUser>;

  /**
   * API route prefix used to construct SSO login URLs.
   * Defaults to `/api` when not provided.
   *
   * @example `/mastra` results in SSO URL `/mastra/auth/sso/login`
   */
  apiPrefix?: string;
}

/**
 * Build capabilities response based on auth configuration and request state.
 *
 * This function determines what capabilities are available and, if the user
 * is authenticated, includes their user info and access permissions.
 *
 * @param auth - Auth provider (or null if no auth configured)
 * @param request - Incoming HTTP request
 * @param options - Optional configuration (roleMapping, etc.)
 * @returns Capabilities response (public or authenticated)
 */
export async function buildCapabilities(
  auth: MastraAuthProvider | null,
  request: Request,
  options?: BuildCapabilitiesOptions,
): Promise<PublicAuthCapabilities | AuthenticatedCapabilities> {
  // No auth configured - disabled
  if (!auth) {
    return { enabled: false, login: null };
  }

  // Determine if EE features are available
  // SimpleAuth, MastraCloudAuth, and dev environments are exempt from license requirement
  const hasLicense = isLicenseValid();
  const isCloud = isMastraCloudAuth(auth);
  const isSimple = isSimpleAuth(auth);
  const isDev = isDevEnvironment();
  const isLicensedOrCloud = hasLicense || isCloud || isSimple || isDev;

  // Build login configuration (always public)
  let login: PublicAuthCapabilities['login'] = null;

  const hasSSO = implementsInterface<ISSOProvider>(auth, 'getLoginUrl') && isLicensedOrCloud;
  const hasCredentials = implementsInterface<ICredentialsProvider>(auth, 'signIn') && isLicensedOrCloud;

  // Build SSO login URL using the configured prefix (default: /api)
  const raw = (options?.apiPrefix || '/api').trim();
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  const prefix = withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
  const ssoLoginUrl = `${prefix}/auth/sso/login`;

  // Check if sign-up is enabled (defaults to true)
  let signUpEnabled = true;
  if (implementsInterface<ICredentialsProvider>(auth, 'signIn')) {
    const credentialsProvider = auth as ICredentialsProvider;
    if (typeof credentialsProvider.isSignUpEnabled === 'function') {
      signUpEnabled = credentialsProvider.isSignUpEnabled();
    }
  }

  if (hasSSO && hasCredentials) {
    const ssoConfig = (auth as ISSOProvider).getLoginButtonConfig();
    login = {
      type: 'both',
      signUpEnabled,
      description: ssoConfig.description,
      sso: {
        ...ssoConfig,
        url: ssoLoginUrl,
      },
    };
  } else if (hasSSO) {
    const ssoConfig = (auth as ISSOProvider).getLoginButtonConfig();
    login = {
      type: 'sso',
      description: ssoConfig.description,
      sso: {
        ...ssoConfig,
        url: ssoLoginUrl,
      },
    };
  } else if (hasCredentials) {
    // Credentials-only auth (e.g., Better Auth with email/password)
    login = {
      type: 'credentials',
      signUpEnabled,
    };
  }

  // Try to get current user (requires session)
  let user: EEUser | null = null;
  if (implementsInterface<IUserProvider>(auth, 'getCurrentUser') && isLicensedOrCloud) {
    try {
      user = await auth.getCurrentUser(request);
    } catch {
      // Session invalid or expired
      user = null;
    }
  }

  // If no user, return public response only
  if (!user) {
    return { enabled: true, login };
  }

  // Get RBAC provider from options (if configured)
  const rbacProvider = options?.rbac;
  const hasRBAC = !!rbacProvider && isLicensedOrCloud;

  // Get FGA provider from options (if configured)
  const hasFGA = !!options?.fga && isLicensedOrCloud;

  // Build capability flags
  const capabilities: CapabilityFlags = {
    user: implementsInterface<IUserProvider>(auth, 'getCurrentUser') && isLicensedOrCloud,
    session: implementsInterface<ISessionProvider>(auth, 'createSession') && isLicensedOrCloud,
    sso: implementsInterface<ISSOProvider>(auth, 'getLoginUrl') && isLicensedOrCloud,
    rbac: hasRBAC,
    acl: implementsInterface<IACLProvider>(auth, 'canAccess') && isLicensedOrCloud,
    fga: hasFGA,
  };

  // Get roles/permissions from RBAC provider (if available)
  let access: UserAccess | null = null;
  if (hasRBAC && rbacProvider) {
    try {
      const roles = await rbacProvider.getRoles(user);
      const permissions = await rbacProvider.getPermissions(user);
      access = { roles, permissions };
    } catch {
      // RBAC failed, continue without access info
      access = null;
    }
  }

  // Expose available roles for admin users (for "View as role" feature).
  // Exclude roles with admin-bypass permissions since previewing as admin
  // is the same as the current experience.
  let availableRoles: { id: string; name: string }[] | undefined;
  if (access && rbacProvider?.getAvailableRoles) {
    if (hasAdminBypassPermissions(access.permissions)) {
      try {
        const allRoles = await rbacProvider.getAvailableRoles();
        if (rbacProvider.getPermissionsForRole) {
          const nonAdminRoles: { id: string; name: string }[] = [];
          for (const role of allRoles) {
            const rolePerms = await rbacProvider.getPermissionsForRole(role.id);
            if (!hasAdminBypassPermissions(rolePerms)) {
              nonAdminRoles.push(role);
            }
          }
          availableRoles = nonAdminRoles;
        } else {
          availableRoles = allRoles;
        }
      } catch {
        // Ignore errors
      }
    }
  }

  return {
    enabled: true,
    login,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
    capabilities,
    access,
    availableRoles,
  };
}
