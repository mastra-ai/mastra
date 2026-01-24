import type { BuildStatus, DeploymentStatus, TeamRole } from '../../constants';
import type {
  Build,
  Deployment,
  EncryptedEnvVar,
  Project,
  ProjectApiToken,
  RunningServer,
  Team,
  TeamInvite,
  TeamMember,
  User,
} from '../../types';

/**
 * Pagination parameters for list operations.
 */
export interface PaginationParams {
  page?: number;
  perPage?: number;
}

/**
 * Paginated result container.
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

/**
 * Abstract interface for admin storage operations.
 * Implementations: PostgresAdminStorage (stores/admin-pg/)
 */
export interface AdminStorage {
  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Initialize the storage (create tables, run migrations).
   */
  init(): Promise<void>;

  /**
   * Close the storage connection.
   */
  close(): Promise<void>;

  // ============================================================================
  // User Operations
  // ============================================================================

  getUser(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User>;
  updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User>;

  // ============================================================================
  // Team Operations
  // ============================================================================

  getTeam(teamId: string): Promise<Team | null>;
  getTeamBySlug(slug: string): Promise<Team | null>;
  listTeamsForUser(userId: string, pagination?: PaginationParams): Promise<PaginatedResult<Team>>;
  createTeam(team: Omit<Team, 'createdAt' | 'updatedAt'>): Promise<Team>;
  updateTeam(teamId: string, updates: Partial<Omit<Team, 'id' | 'createdAt'>>): Promise<Team>;
  deleteTeam(teamId: string): Promise<void>;

  // ============================================================================
  // Team Member Operations
  // ============================================================================

  getTeamMember(teamId: string, userId: string): Promise<TeamMember | null>;
  listTeamMembers(teamId: string, pagination?: PaginationParams): Promise<PaginatedResult<TeamMember & { user: User }>>;
  addTeamMember(member: Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>): Promise<TeamMember>;
  updateTeamMemberRole(teamId: string, userId: string, role: TeamRole): Promise<TeamMember>;
  removeTeamMember(teamId: string, userId: string): Promise<void>;

  // ============================================================================
  // Team Invite Operations
  // ============================================================================

  getTeamInvite(inviteId: string): Promise<TeamInvite | null>;
  getTeamInviteByEmail(teamId: string, email: string): Promise<TeamInvite | null>;
  listTeamInvites(teamId: string): Promise<TeamInvite[]>;
  createTeamInvite(invite: Omit<TeamInvite, 'id' | 'createdAt'>): Promise<TeamInvite>;
  deleteTeamInvite(inviteId: string): Promise<void>;

  // ============================================================================
  // Project Operations
  // ============================================================================

  getProject(projectId: string): Promise<Project | null>;
  getProjectBySlug(teamId: string, slug: string): Promise<Project | null>;
  listProjectsForTeam(teamId: string, pagination?: PaginationParams): Promise<PaginatedResult<Project>>;
  createProject(project: Omit<Project, 'createdAt' | 'updatedAt'>): Promise<Project>;
  updateProject(projectId: string, updates: Partial<Omit<Project, 'id' | 'teamId' | 'createdAt'>>): Promise<Project>;
  deleteProject(projectId: string): Promise<void>;

  // ============================================================================
  // Project Environment Variables
  // ============================================================================

  getProjectEnvVars(projectId: string): Promise<EncryptedEnvVar[]>;
  setProjectEnvVar(projectId: string, envVar: Omit<EncryptedEnvVar, 'createdAt' | 'updatedAt'>): Promise<EncryptedEnvVar>;
  deleteProjectEnvVar(projectId: string, key: string): Promise<void>;

  // ============================================================================
  // Project API Tokens
  // ============================================================================

  getProjectApiToken(tokenId: string): Promise<ProjectApiToken | null>;
  getProjectApiTokenByHash(tokenHash: string): Promise<ProjectApiToken | null>;
  listProjectApiTokens(projectId: string): Promise<ProjectApiToken[]>;
  createProjectApiToken(token: Omit<ProjectApiToken, 'createdAt' | 'lastUsedAt'>): Promise<ProjectApiToken>;
  updateProjectApiTokenLastUsed(tokenId: string): Promise<void>;
  deleteProjectApiToken(tokenId: string): Promise<void>;

  // ============================================================================
  // Deployment Operations
  // ============================================================================

  getDeployment(deploymentId: string): Promise<Deployment | null>;
  getDeploymentBySlug(projectId: string, slug: string): Promise<Deployment | null>;
  listDeploymentsForProject(projectId: string, pagination?: PaginationParams): Promise<PaginatedResult<Deployment>>;
  createDeployment(deployment: Omit<Deployment, 'createdAt' | 'updatedAt'>): Promise<Deployment>;
  updateDeployment(deploymentId: string, updates: Partial<Omit<Deployment, 'id' | 'projectId' | 'createdAt'>>): Promise<Deployment>;
  updateDeploymentStatus(deploymentId: string, status: DeploymentStatus): Promise<Deployment>;
  deleteDeployment(deploymentId: string): Promise<void>;

  // ============================================================================
  // Build Operations
  // ============================================================================

  getBuild(buildId: string): Promise<Build | null>;
  listBuildsForDeployment(deploymentId: string, pagination?: PaginationParams): Promise<PaginatedResult<Build>>;
  createBuild(build: Omit<Build, 'startedAt' | 'completedAt'>): Promise<Build>;
  updateBuild(buildId: string, updates: Partial<Omit<Build, 'id' | 'deploymentId' | 'queuedAt'>>): Promise<Build>;
  updateBuildStatus(buildId: string, status: BuildStatus, errorMessage?: string): Promise<Build>;
  appendBuildLogs(buildId: string, logs: string): Promise<void>;

  /** Get the next queued build for processing */
  dequeueNextBuild(): Promise<Build | null>;

  // ============================================================================
  // Running Server Operations
  // ============================================================================

  getRunningServer(serverId: string): Promise<RunningServer | null>;
  getRunningServerForDeployment(deploymentId: string): Promise<RunningServer | null>;
  listRunningServers(): Promise<RunningServer[]>;
  createRunningServer(server: Omit<RunningServer, 'stoppedAt'>): Promise<RunningServer>;
  updateRunningServer(serverId: string, updates: Partial<Omit<RunningServer, 'id' | 'deploymentId' | 'buildId' | 'startedAt'>>): Promise<RunningServer>;
  stopRunningServer(serverId: string): Promise<void>;

  // ============================================================================
  // RBAC Operations
  // ============================================================================

  /** Get all permissions for a user in a team */
  getUserPermissionsForTeam(userId: string, teamId: string): Promise<string[]>;

  /** Check if a user has a specific permission in a team */
  userHasPermission(userId: string, teamId: string, permission: string): Promise<boolean>;
}
