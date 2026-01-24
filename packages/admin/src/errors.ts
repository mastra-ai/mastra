/**
 * Error domains for MastraAdmin.
 */
export const AdminErrorDomain = {
  ADMIN: 'ADMIN',
  LICENSE: 'LICENSE',
  RBAC: 'RBAC',
  STORAGE: 'ADMIN_STORAGE',
  RUNNER: 'RUNNER',
  ROUTER: 'ROUTER',
  SOURCE: 'SOURCE',
  BILLING: 'BILLING',
  BUILD: 'BUILD',
  DEPLOYMENT: 'DEPLOYMENT',
  PROJECT: 'PROJECT',
  TEAM: 'TEAM',
} as const;

export type AdminErrorDomain = (typeof AdminErrorDomain)[keyof typeof AdminErrorDomain];

/**
 * Error categories for MastraAdmin.
 */
export const AdminErrorCategory = {
  /** User-caused errors (invalid input, permissions, etc.) */
  USER: 'USER',
  /** System/infrastructure errors */
  SYSTEM: 'SYSTEM',
  /** Third-party service errors */
  THIRD_PARTY: 'THIRD_PARTY',
  /** Configuration errors */
  CONFIG: 'CONFIG',
  /** License-related errors */
  LICENSE: 'LICENSE',
} as const;

export type AdminErrorCategory = (typeof AdminErrorCategory)[keyof typeof AdminErrorCategory];

/**
 * Error definition interface.
 */
interface ErrorDefinition {
  id: Uppercase<string>;
  text?: string;
  domain: AdminErrorDomain;
  category: AdminErrorCategory;
  details?: Record<string, unknown>;
}

/**
 * Base error class for all MastraAdmin errors.
 */
export class MastraAdminError extends Error {
  public readonly id: Uppercase<string>;
  public readonly domain: AdminErrorDomain;
  public readonly category: AdminErrorCategory;
  public readonly details?: Record<string, unknown>;
  public readonly originalError?: unknown;

  constructor(
    definition: ErrorDefinition,
    originalError?: unknown,
  ) {
    const message = definition.text ?? 'Unknown error';
    super(message);
    this.id = definition.id;
    this.domain = definition.domain;
    this.category = definition.category;
    this.details = definition.details ?? {};
    this.originalError = originalError;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Returns a structured representation of the error for logging or API responses.
   */
  public toJSON() {
    return {
      message: this.message,
      code: this.id,
      domain: this.domain,
      category: this.category,
      details: this.details,
    };
  }

  // ============================================================================
  // Static Factory Methods - License
  // ============================================================================

  static invalidLicense(message?: string): MastraAdminError {
    return new MastraAdminError({
      id: 'INVALID_LICENSE',
      text: message ?? 'Invalid or expired license key',
      domain: AdminErrorDomain.LICENSE,
      category: AdminErrorCategory.LICENSE,
    });
  }

  static licenseExpired(expiresAt: Date): MastraAdminError {
    return new MastraAdminError({
      id: 'LICENSE_EXPIRED',
      text: `License expired on ${expiresAt.toISOString()}`,
      domain: AdminErrorDomain.LICENSE,
      category: AdminErrorCategory.LICENSE,
      details: { expiresAt: expiresAt.toISOString() },
    });
  }

  static featureNotLicensed(feature: string): MastraAdminError {
    return new MastraAdminError({
      id: 'FEATURE_NOT_LICENSED',
      text: `Feature '${feature}' is not available in your license tier`,
      domain: AdminErrorDomain.LICENSE,
      category: AdminErrorCategory.LICENSE,
      details: { feature },
    });
  }

  static licenseLimitExceeded(limit: string, current: number, max: number): MastraAdminError {
    return new MastraAdminError({
      id: 'LICENSE_LIMIT_EXCEEDED',
      text: `${limit} limit exceeded: ${current}/${max}`,
      domain: AdminErrorDomain.LICENSE,
      category: AdminErrorCategory.LICENSE,
      details: { limit, current, max },
    });
  }

  // ============================================================================
  // Static Factory Methods - RBAC
  // ============================================================================

  static accessDenied(resource: string, action: string): MastraAdminError {
    return new MastraAdminError({
      id: 'ACCESS_DENIED',
      text: `Access denied: cannot ${action} on ${resource}`,
      domain: AdminErrorDomain.RBAC,
      category: AdminErrorCategory.USER,
      details: { resource, action },
    });
  }

  static roleNotFound(roleId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'ROLE_NOT_FOUND',
      text: `Role not found: ${roleId}`,
      domain: AdminErrorDomain.RBAC,
      category: AdminErrorCategory.USER,
      details: { roleId },
    });
  }

  // ============================================================================
  // Static Factory Methods - Team
  // ============================================================================

  static teamNotFound(teamId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'TEAM_NOT_FOUND',
      text: `Team not found: ${teamId}`,
      domain: AdminErrorDomain.TEAM,
      category: AdminErrorCategory.USER,
      details: { teamId },
    });
  }

  static teamSlugExists(slug: string): MastraAdminError {
    return new MastraAdminError({
      id: 'TEAM_SLUG_EXISTS',
      text: `Team with slug '${slug}' already exists`,
      domain: AdminErrorDomain.TEAM,
      category: AdminErrorCategory.USER,
      details: { slug },
    });
  }

  static userNotTeamMember(userId: string, teamId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'USER_NOT_TEAM_MEMBER',
      text: `User is not a member of this team`,
      domain: AdminErrorDomain.TEAM,
      category: AdminErrorCategory.USER,
      details: { userId, teamId },
    });
  }

  // ============================================================================
  // Static Factory Methods - Project
  // ============================================================================

  static projectNotFound(projectId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'PROJECT_NOT_FOUND',
      text: `Project not found: ${projectId}`,
      domain: AdminErrorDomain.PROJECT,
      category: AdminErrorCategory.USER,
      details: { projectId },
    });
  }

  static projectSlugExists(slug: string, teamId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'PROJECT_SLUG_EXISTS',
      text: `Project with slug '${slug}' already exists in this team`,
      domain: AdminErrorDomain.PROJECT,
      category: AdminErrorCategory.USER,
      details: { slug, teamId },
    });
  }

  static invalidProjectSource(message: string): MastraAdminError {
    return new MastraAdminError({
      id: 'INVALID_PROJECT_SOURCE',
      text: message,
      domain: AdminErrorDomain.SOURCE,
      category: AdminErrorCategory.USER,
    });
  }

  // ============================================================================
  // Static Factory Methods - Deployment
  // ============================================================================

  static deploymentNotFound(deploymentId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'DEPLOYMENT_NOT_FOUND',
      text: `Deployment not found: ${deploymentId}`,
      domain: AdminErrorDomain.DEPLOYMENT,
      category: AdminErrorCategory.USER,
      details: { deploymentId },
    });
  }

  static deploymentAlreadyExists(type: string, branch: string): MastraAdminError {
    return new MastraAdminError({
      id: 'DEPLOYMENT_ALREADY_EXISTS',
      text: `${type} deployment for branch '${branch}' already exists`,
      domain: AdminErrorDomain.DEPLOYMENT,
      category: AdminErrorCategory.USER,
      details: { type, branch },
    });
  }

  // ============================================================================
  // Static Factory Methods - Build
  // ============================================================================

  static buildNotFound(buildId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'BUILD_NOT_FOUND',
      text: `Build not found: ${buildId}`,
      domain: AdminErrorDomain.BUILD,
      category: AdminErrorCategory.USER,
      details: { buildId },
    });
  }

  static buildFailed(buildId: string, message: string): MastraAdminError {
    return new MastraAdminError({
      id: 'BUILD_FAILED',
      text: message,
      domain: AdminErrorDomain.BUILD,
      category: AdminErrorCategory.SYSTEM,
      details: { buildId },
    });
  }

  static buildCancelled(buildId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'BUILD_CANCELLED',
      text: `Build was cancelled: ${buildId}`,
      domain: AdminErrorDomain.BUILD,
      category: AdminErrorCategory.USER,
      details: { buildId },
    });
  }

  // ============================================================================
  // Static Factory Methods - Runner
  // ============================================================================

  static runnerError(message: string, details?: Record<string, unknown>): MastraAdminError {
    return new MastraAdminError({
      id: 'RUNNER_ERROR',
      text: message,
      domain: AdminErrorDomain.RUNNER,
      category: AdminErrorCategory.SYSTEM,
      details,
    });
  }

  static serverStartFailed(deploymentId: string, message: string): MastraAdminError {
    return new MastraAdminError({
      id: 'SERVER_START_FAILED',
      text: message,
      domain: AdminErrorDomain.RUNNER,
      category: AdminErrorCategory.SYSTEM,
      details: { deploymentId },
    });
  }

  static healthCheckFailed(serverId: string, message: string): MastraAdminError {
    return new MastraAdminError({
      id: 'HEALTH_CHECK_FAILED',
      text: message,
      domain: AdminErrorDomain.RUNNER,
      category: AdminErrorCategory.SYSTEM,
      details: { serverId },
    });
  }

  // ============================================================================
  // Static Factory Methods - Router
  // ============================================================================

  static routerError(message: string, details?: Record<string, unknown>): MastraAdminError {
    return new MastraAdminError({
      id: 'ROUTER_ERROR',
      text: message,
      domain: AdminErrorDomain.ROUTER,
      category: AdminErrorCategory.SYSTEM,
      details,
    });
  }

  static routeNotFound(routeId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'ROUTE_NOT_FOUND',
      text: `Route not found: ${routeId}`,
      domain: AdminErrorDomain.ROUTER,
      category: AdminErrorCategory.USER,
      details: { routeId },
    });
  }

  // ============================================================================
  // Static Factory Methods - Configuration
  // ============================================================================

  static configurationError(message: string): MastraAdminError {
    return new MastraAdminError({
      id: 'CONFIGURATION_ERROR',
      text: message,
      domain: AdminErrorDomain.ADMIN,
      category: AdminErrorCategory.CONFIG,
    });
  }

  static providerNotConfigured(provider: string): MastraAdminError {
    return new MastraAdminError({
      id: 'PROVIDER_NOT_CONFIGURED',
      text: `Provider '${provider}' is not configured`,
      domain: AdminErrorDomain.ADMIN,
      category: AdminErrorCategory.CONFIG,
      details: { provider },
    });
  }

  static storageError(message: string, originalError?: unknown): MastraAdminError {
    return new MastraAdminError(
      {
        id: 'STORAGE_ERROR',
        text: message,
        domain: AdminErrorDomain.STORAGE,
        category: AdminErrorCategory.SYSTEM,
      },
      originalError,
    );
  }
}
