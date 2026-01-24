/**
 * License tiers.
 */
export const LicenseTier = {
  COMMUNITY: 'community',
  TEAM: 'team',
  ENTERPRISE: 'enterprise',
} as const;

export type LicenseTier = (typeof LicenseTier)[keyof typeof LicenseTier];

/**
 * License features that can be gated.
 */
export const LicenseFeature = {
  LOCAL_RUNNER: 'local-runner',
  K8S_RUNNER: 'k8s-runner',
  CLOUDFLARE_ROUTER: 'cloudflare-router',
  GITHUB_SOURCE: 'github-source',
  SSO: 'sso',
  AUDIT_LOGS: 'audit-logs',
  ADVANCED_RBAC: 'advanced-rbac',
  UNLIMITED_USERS: 'unlimited-users',
  PRIORITY_SUPPORT: 'priority-support',
} as const;

export type LicenseFeature = (typeof LicenseFeature)[keyof typeof LicenseFeature];

/**
 * Decoded license information.
 */
export interface LicenseInfo {
  /** Whether the license is valid */
  valid: boolean;
  /** License tier */
  tier: LicenseTier;
  /** Enabled features */
  features: LicenseFeature[];
  /** Expiration date (null = perpetual) */
  expiresAt: Date | null;
  /** Maximum teams allowed (null = unlimited) */
  maxTeams: number | null;
  /** Maximum users per team (null = unlimited) */
  maxUsersPerTeam: number | null;
  /** Maximum projects (null = unlimited) */
  maxProjects: number | null;
  /** Organization name from license */
  organizationName?: string;
  /** License key ID for tracking */
  licenseKeyId?: string;
}

/**
 * License key payload structure (JWT claims).
 */
export interface LicensePayload {
  /** License key ID */
  kid: string;
  /** Organization name */
  org: string;
  /** Tier */
  tier: LicenseTier;
  /** Features array */
  features: LicenseFeature[];
  /** Expiration timestamp */
  exp?: number;
  /** Issued at timestamp */
  iat: number;
  /** Limits */
  limits?: {
    teams?: number;
    usersPerTeam?: number;
    projects?: number;
  };
}
