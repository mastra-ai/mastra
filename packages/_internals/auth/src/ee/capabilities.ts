/**
 * Capabilities detection and response building for EE authentication.
 */

import type { MastraAuthProvider } from '../provider';
import { captureEEEvent, getEETelemetryFallbackDistinctId } from './telemetry';
import type { IUserProvider, ISSOProvider, ISessionProvider, ICredentialsProvider } from '..';
import type { IACLProvider } from './interfaces/acl';
import type { IFGAProvider } from './interfaces/fga';
import type { IRBACProvider } from './interfaces/rbac';
import type { EEUser } from './interfaces/user';
import {
  isLicenseValid,
  isDevEnvironment,
  isFeatureEnabled,
  getSafeLicenseSummary,
  warnIfDevEENeedsLicense,
} from './license';

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
  return auth !== null && typeof auth === 'object' && typeof (auth as any)[method] === 'function';
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

function getRequestIp(request: Request): string | undefined {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim();
  }

  return request.headers.get('x-real-ip') ?? undefined;
}

function captureLicenseCheck({
  request,
  user,
  hasLicense,
  isDev,
  isCloud,
  isSimple,
  capabilities,
}: {
  request: Request;
  user?: EEUser | null;
  hasLicense: boolean;
  isDev: boolean;
  isCloud: boolean;
  isSimple: boolean;
  capabilities?: CapabilityFlags;
}): void {
  const license = getSafeLicenseSummary();

  try {
    const ip = getRequestIp(request);
    captureEEEvent('ee_license_check', user?.id || license.anonymousId || getEETelemetryFallbackDistinctId(), {
      license_valid: hasLicense,
      license_hash: license.licenseHash,
      is_dev_environment: isDev,
      is_cloud: isCloud,
      is_simple_auth: isSimple,
      capabilities,
      user_id: user?.id,
      $ip: ip,
      license_features: license.features,
      license_tier: license.tier,
    });
  } catch {
    // Telemetry must never affect auth or EE feature behavior.
  }
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
  if (isDev && !hasLicense) {
    warnIfDevEENeedsLicense();
  }
  const isLicensedOrCloud = hasLicense || isCloud || isSimple || isDev;

  // Per-feature license gating: rbac/acl/fga additionally require the license
  // entitlement (e.g. enterprise tier). Cloud, SimpleAuth and dev are exempt.
  const isFeatureLicensed = (feature: string) =>
    isCloud || isSimple || isDev || (hasLicense && isFeatureEnabled(feature));

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
    captureLicenseCheck({ request, user, hasLicense, isDev, isCloud, isSimple });
    return { enabled: true, login };
  }

  // Get RBAC provider from options (if configured)
  const rbacProvider = options?.rbac;
  const hasRBAC = !!rbacProvider && isFeatureLicensed('rbac');

  // Get FGA provider from options (if configured)
  const hasFGA = !!options?.fga && isFeatureLicensed('fga');

  // Build capability flags
  const capabilities: CapabilityFlags = {
    user: implementsInterface<IUserProvider>(auth, 'getCurrentUser') && isLicensedOrCloud,
    session: implementsInterface<ISessionProvider>(auth, 'createSession') && isLicensedOrCloud,
    sso: implementsInterface<ISSOProvider>(auth, 'getLoginUrl') && isLicensedOrCloud,
    rbac: hasRBAC,
    acl: implementsInterface<IACLProvider>(auth, 'canAccess') && isFeatureLicensed('acl'),
    fga: hasFGA,
  };

  // Get roles/permissions from RBAC provider (if available)
  let access: UserAccess | null = null;
  if (hasRBAC && rbacProvider) {
    try {
      const roles = await rbacProvider.getRoles(user);
      const permissions = await rbacProvider.getPermissions(user);
      access = { roles, permissions };
      const license = getSafeLicenseSummary();
      try {
        const ip = getRequestIp(request);
        captureEEEvent('ee_feature_used', user.id || license.anonymousId || getEETelemetryFallbackDistinctId(), {
          feature: 'rbac',
          user_id: user.id,
          organization_membership_id: user.metadata?.['organizationMembershipId'],
          role_count: roles.length,
          permission_count: permissions.length,
          $ip: ip,
          license_valid: license.valid,
          license_hash: license.licenseHash,
          is_dev_environment: license.isDevEnvironment,
        });
      } catch {
        // Telemetry must never affect auth or EE feature behavior.
      }
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
        const getPermissionsForRole = rbacProvider.getPermissionsForRole?.bind(rbacProvider);
        if (getPermissionsForRole) {
          // Use allSettled so one failing role lookup doesn't drop the whole picker.
          const rolePermissions = await Promise.allSettled(
            allRoles.map(async role => ({
              role,
              perms: await getPermissionsForRole(role.id),
            })),
          );
          availableRoles = rolePermissions.flatMap(result => {
            if (result.status !== 'fulfilled') {
              console.warn('[auth/ee] failed to list permissions for role:', result.reason);
              return [];
            }
            return hasAdminBypassPermissions(result.value.perms) ? [] : [result.value.role];
          });
        } else {
          availableRoles = allRoles;
        }
      } catch (error) {
        // Degrade gracefully: omit availableRoles so the "View as role" feature
        // simply doesn't show options. Log so operators can diagnose RBAC issues.
        console.warn('[auth/ee] failed to list available roles for admin user:', error);
      }
    }
  }

  captureLicenseCheck({ request, user, hasLicense, isDev, isCloud, isSimple, capabilities });

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
