import { randomUUID } from 'node:crypto';
import type { User, Team, TeamMember, Project, Deployment, Build, TeamRole } from '@mastra/admin';

// ============================================================================
// ID Generators
// ============================================================================

/**
 * Generate a unique UUID.
 */
export const uniqueId = (): string => randomUUID();

/**
 * Generate a unique email address for testing.
 */
export const uniqueEmail = (): string => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

/**
 * Generate a unique slug for testing.
 *
 * @param prefix Prefix for the slug
 */
export const uniqueSlug = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Generate a unique name for testing.
 *
 * @param prefix Prefix for the name
 */
export const uniqueName = (prefix: string): string => `${prefix} ${Date.now()}`;

// ============================================================================
// User Factories
// ============================================================================

export interface CreateUserOptions {
  id?: string;
  email?: string;
  name?: string;
  avatarUrl?: string | null;
}

/**
 * Create user data for testing.
 *
 * @param options Optional overrides for user properties
 * @returns User data without timestamp fields
 */
export function createUserData(options: CreateUserOptions = {}): Omit<User, 'createdAt' | 'updatedAt'> {
  return {
    id: options.id ?? uniqueId(),
    email: options.email ?? uniqueEmail(),
    name: options.name ?? `Test User ${Date.now()}`,
    avatarUrl: options.avatarUrl ?? null,
  };
}

// ============================================================================
// Team Factories
// ============================================================================

export interface CreateTeamOptions {
  id?: string;
  name?: string;
  slug?: string;
  settings?: Record<string, unknown>;
}

/**
 * Create team data for testing.
 *
 * @param options Optional overrides for team properties
 * @returns Team data without timestamp fields
 */
export function createTeamData(options: CreateTeamOptions = {}): Omit<Team, 'createdAt' | 'updatedAt'> {
  return {
    id: options.id ?? uniqueId(),
    name: options.name ?? uniqueName('Test Team'),
    slug: options.slug ?? uniqueSlug('test-team'),
    settings: options.settings ?? {},
  };
}

// ============================================================================
// Team Member Factories
// ============================================================================

export interface CreateTeamMemberOptions {
  id?: string;
  teamId: string;
  userId: string;
  role?: TeamRole;
}

/**
 * Create team member data for testing.
 *
 * @param options Team member options
 * @returns Team member data without timestamp fields
 */
export function createTeamMemberData(
  options: CreateTeamMemberOptions,
): Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    teamId: options.teamId,
    userId: options.userId,
    role: options.role ?? ('developer' as TeamRole),
  };
}

// ============================================================================
// Project Factories
// ============================================================================

export interface CreateProjectOptions {
  id?: string;
  teamId: string;
  name?: string;
  slug?: string;
  sourceType?: 'local' | 'github';
  sourceConfig?: { path: string } | { repoFullName: string; installationId: string; isPrivate: boolean };
  defaultBranch?: string;
}

/**
 * Create project data for testing.
 *
 * @param options Project options (teamId is required)
 * @returns Project data without timestamp and envVars fields
 */
export function createProjectData(options: CreateProjectOptions): Omit<Project, 'createdAt' | 'updatedAt' | 'envVars'> {
  return {
    id: options.id ?? uniqueId(),
    teamId: options.teamId,
    name: options.name ?? uniqueName('Test Project'),
    slug: options.slug ?? uniqueSlug('test-project'),
    sourceType: options.sourceType ?? 'local',
    sourceConfig: options.sourceConfig ?? { path: '/tmp/test-project' },
    defaultBranch: options.defaultBranch ?? 'main',
  };
}

// ============================================================================
// Deployment Factories
// ============================================================================

export interface CreateDeploymentOptions {
  id?: string;
  projectId: string;
  type?: 'production' | 'staging' | 'preview';
  branch?: string;
  slug?: string;
}

/**
 * Create deployment data for testing.
 *
 * @param options Deployment options (projectId is required)
 * @returns Partial deployment data
 */
export function createDeploymentData(
  options: CreateDeploymentOptions,
): Omit<
  Deployment,
  | 'createdAt'
  | 'updatedAt'
  | 'status'
  | 'currentBuildId'
  | 'publicUrl'
  | 'internalHost'
  | 'envVarOverrides'
  | 'autoShutdown'
  | 'expiresAt'
> {
  const type = options.type ?? 'production';
  const branch = options.branch ?? (type === 'production' ? 'main' : type === 'staging' ? 'staging' : 'feature-branch');

  return {
    id: options.id ?? uniqueId(),
    projectId: options.projectId,
    type,
    branch,
    slug: options.slug ?? `${branch}--test-project`,
  };
}

// ============================================================================
// Build Factories
// ============================================================================

export interface CreateBuildOptions {
  id?: string;
  deploymentId: string;
  trigger?: 'manual' | 'webhook' | 'schedule' | 'rollback';
  triggeredBy: string;
  commitSha?: string;
  commitMessage?: string;
}

/**
 * Create build data for testing.
 *
 * @param options Build options (deploymentId and triggeredBy are required)
 * @returns Partial build data
 */
export function createBuildData(
  options: CreateBuildOptions,
): Omit<Build, 'status' | 'logs' | 'queuedAt' | 'startedAt' | 'completedAt' | 'errorMessage'> {
  return {
    id: options.id ?? uniqueId(),
    deploymentId: options.deploymentId,
    trigger: options.trigger ?? 'manual',
    triggeredBy: options.triggeredBy,
    commitSha: options.commitSha ?? `abc${Date.now().toString(16)}`,
    commitMessage: options.commitMessage ?? 'Test commit',
    logPath: null,
  };
}

// ============================================================================
// Bulk Data Generators
// ============================================================================

/**
 * Create multiple users for testing.
 *
 * @param count Number of users to create
 * @returns Array of user data
 */
export function createBulkUsers(count: number): Omit<User, 'createdAt' | 'updatedAt'>[] {
  return Array.from({ length: count }, () => createUserData());
}

/**
 * Create multiple teams for testing.
 *
 * @param count Number of teams to create
 * @returns Array of team data
 */
export function createBulkTeams(count: number): Omit<Team, 'createdAt' | 'updatedAt'>[] {
  return Array.from({ length: count }, () => createTeamData());
}

/**
 * Create multiple projects for testing.
 *
 * @param count Number of projects to create
 * @param teamId Team ID for all projects
 * @returns Array of project data
 */
export function createBulkProjects(
  count: number,
  teamId: string,
): Omit<Project, 'createdAt' | 'updatedAt' | 'envVars'>[] {
  return Array.from({ length: count }, () => createProjectData({ teamId }));
}
