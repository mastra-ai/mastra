import type {
  AdminStorage,
  Build,
  BuildStatus,
  Deployment,
  DeploymentStatus,
  EncryptedEnvVar,
  PaginatedResult,
  PaginationParams,
  Project,
  ProjectApiToken,
  RunningServer,
  Team,
  TeamInvite,
  TeamMember,
  TeamRole,
  User,
} from '@mastra/admin';
import { Pool } from 'pg';

import type { DbClient } from './client';
import { PoolAdapter } from './client';
import { AdminPgDB } from './db';
import { BuildsPG } from './domains/builds';
import { DeploymentsPG } from './domains/deployments';
import { ProjectsPG } from './domains/projects';
import { RbacPG } from './domains/rbac';
import { RunningServersPG } from './domains/servers';
import { TeamsPG } from './domains/teams';
import { UsersPG } from './domains/users';
import type { PostgresAdminStorageConfig } from './shared/config';
import {
  isConnectionStringConfig,
  isHostConfig,
  isPoolConfig,
  parseSqlIdentifier,
  validateConfig,
} from './shared/config';

/**
 * PostgreSQL storage implementation for MastraAdmin.
 * Implements the AdminStorage interface from @mastra/admin.
 */
export class PostgresAdminStorage implements AdminStorage {
  private pool: Pool;
  private client: DbClient;
  private adminDb: AdminPgDB;
  private ownsPool: boolean;
  private schema: string;
  private isInitialized = false;
  private config: PostgresAdminStorageConfig;

  // Domain stores (internal)
  private readonly usersPg: UsersPG;
  private readonly teamsPg: TeamsPG;
  private readonly projectsPg: ProjectsPG;
  private readonly deploymentsPg: DeploymentsPG;
  private readonly buildsPg: BuildsPG;
  private readonly serversPg: RunningServersPG;
  private readonly rbacPg: RbacPG;

  constructor(config: PostgresAdminStorageConfig) {
    validateConfig(config);
    this.config = config;

    this.schema = config.schemaName ? parseSqlIdentifier(config.schemaName, 'schema') : 'mastra_admin';

    // Create or wrap pool
    if (isPoolConfig(config)) {
      this.pool = config.pool;
      this.ownsPool = false;
    } else {
      this.pool = this.createPool(config);
      this.ownsPool = true;
    }

    this.client = new PoolAdapter(this.pool);

    // Create domain config
    const domainConfig = {
      client: this.client,
      schemaName: this.schema,
      skipDefaultIndexes: config.skipDefaultIndexes,
    };

    // Initialize domain stores
    this.usersPg = new UsersPG(domainConfig);
    this.teamsPg = new TeamsPG(domainConfig);
    this.projectsPg = new ProjectsPG(domainConfig);
    this.deploymentsPg = new DeploymentsPG(domainConfig);
    this.buildsPg = new BuildsPG(domainConfig);
    this.serversPg = new RunningServersPG(domainConfig);
    this.rbacPg = new RbacPG(domainConfig);

    // Create admin db for initialization
    this.adminDb = new AdminPgDB(domainConfig);
  }

  /**
   * Create PostgreSQL connection pool
   */
  private createPool(config: PostgresAdminStorageConfig): Pool {
    if (isConnectionStringConfig(config)) {
      return new Pool({
        connectionString: config.connectionString,
        max: 20,
        idleTimeoutMillis: 30000,
      });
    }

    if (isHostConfig(config)) {
      return new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl,
        max: 20,
        idleTimeoutMillis: 30000,
      });
    }

    throw new Error('Invalid configuration');
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Initialize storage (create tables, run migrations).
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.config.disableInit) {
      this.isInitialized = true;
      return;
    }

    await this.adminDb.init();
    this.isInitialized = true;
  }

  /**
   * Close the storage connection.
   */
  async close(): Promise<void> {
    if (this.ownsPool) {
      await this.pool.end();
    }
  }

  // ============================================================================
  // User Operations
  // ============================================================================

  async getUser(userId: string): Promise<User | null> {
    return this.usersPg.getUserById(userId);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.usersPg.getUserByEmail(email);
  }

  async createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User> {
    return this.usersPg.createUser(user);
  }

  async updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> {
    const result = await this.usersPg.updateUser(userId, updates);
    if (!result) {
      throw new Error(`User not found: ${userId}`);
    }
    return result;
  }

  // ============================================================================
  // Team Operations
  // ============================================================================

  async getTeam(teamId: string): Promise<Team | null> {
    return this.teamsPg.getTeamById(teamId);
  }

  async getTeamBySlug(slug: string): Promise<Team | null> {
    return this.teamsPg.getTeamBySlug(slug);
  }

  async listTeamsForUser(userId: string, pagination?: PaginationParams): Promise<PaginatedResult<Team>> {
    const page = pagination?.page ?? 1;
    const perPage = pagination?.perPage ?? 20;
    const offset = (page - 1) * perPage;

    const { data, total } = await this.teamsPg.listTeamsForUser(userId, { limit: perPage, offset });

    return {
      data,
      total,
      page,
      perPage,
      hasMore: offset + data.length < total,
    };
  }

  async createTeam(team: Omit<Team, 'createdAt' | 'updatedAt'>): Promise<Team> {
    return this.teamsPg.createTeam(team);
  }

  async updateTeam(teamId: string, updates: Partial<Omit<Team, 'id' | 'createdAt'>>): Promise<Team> {
    const result = await this.teamsPg.updateTeam(teamId, updates);
    if (!result) {
      throw new Error(`Team not found: ${teamId}`);
    }
    return result;
  }

  async deleteTeam(teamId: string): Promise<void> {
    const deleted = await this.teamsPg.deleteTeam(teamId);
    if (!deleted) {
      throw new Error(`Team not found: ${teamId}`);
    }
  }

  // ============================================================================
  // Team Member Operations
  // ============================================================================

  async getTeamMember(teamId: string, userId: string): Promise<TeamMember | null> {
    return this.teamsPg.getTeamMember(teamId, userId);
  }

  async listTeamMembers(
    teamId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<TeamMember & { user: User }>> {
    const page = pagination?.page ?? 1;
    const perPage = pagination?.perPage ?? 20;
    const offset = (page - 1) * perPage;

    const { data, total } = await this.teamsPg.listTeamMembers(teamId, { limit: perPage, offset });

    return {
      data,
      total,
      page,
      perPage,
      hasMore: offset + data.length < total,
    };
  }

  async addTeamMember(member: Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>): Promise<TeamMember> {
    return this.teamsPg.addTeamMember(member);
  }

  async updateTeamMemberRole(teamId: string, userId: string, role: TeamRole): Promise<TeamMember> {
    const result = await this.teamsPg.updateTeamMemberRole(teamId, userId, role);
    if (!result) {
      throw new Error(`Team member not found: ${userId} in team ${teamId}`);
    }
    return result;
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    const removed = await this.teamsPg.removeTeamMember(teamId, userId);
    if (!removed) {
      throw new Error(`Team member not found: ${userId} in team ${teamId}`);
    }
  }

  // ============================================================================
  // Team Invite Operations
  // ============================================================================

  async getTeamInvite(inviteId: string): Promise<TeamInvite | null> {
    return this.teamsPg.getInviteById(inviteId);
  }

  async getTeamInviteByEmail(teamId: string, email: string): Promise<TeamInvite | null> {
    return this.teamsPg.getInviteByEmail(teamId, email);
  }

  async listTeamInvites(teamId: string): Promise<TeamInvite[]> {
    return this.teamsPg.listPendingInvites(teamId);
  }

  async createTeamInvite(invite: Omit<TeamInvite, 'id' | 'createdAt'>): Promise<TeamInvite> {
    return this.teamsPg.createInvite(invite);
  }

  async deleteTeamInvite(inviteId: string): Promise<void> {
    const deleted = await this.teamsPg.deleteInvite(inviteId);
    if (!deleted) {
      throw new Error(`Team invite not found: ${inviteId}`);
    }
  }

  // ============================================================================
  // Project Operations
  // ============================================================================

  async getProject(projectId: string): Promise<Project | null> {
    return this.projectsPg.getProjectById(projectId);
  }

  async getProjectBySlug(teamId: string, slug: string): Promise<Project | null> {
    return this.projectsPg.getProjectBySlug(teamId, slug);
  }

  async listProjectsForTeam(teamId: string, pagination?: PaginationParams): Promise<PaginatedResult<Project>> {
    const page = pagination?.page ?? 1;
    const perPage = pagination?.perPage ?? 20;
    const offset = (page - 1) * perPage;

    const { data, total } = await this.projectsPg.listProjects(teamId, { limit: perPage, offset });

    return {
      data,
      total,
      page,
      perPage,
      hasMore: offset + data.length < total,
    };
  }

  async createProject(project: Omit<Project, 'createdAt' | 'updatedAt'>): Promise<Project> {
    return this.projectsPg.createProject(project);
  }

  async updateProject(
    projectId: string,
    updates: Partial<Omit<Project, 'id' | 'teamId' | 'createdAt'>>,
  ): Promise<Project> {
    // Filter out envVars from updates since they're handled separately
    const { envVars: _envVars, ...projectUpdates } = updates as Partial<Project>;
    const result = await this.projectsPg.updateProject(projectId, projectUpdates);
    if (!result) {
      throw new Error(`Project not found: ${projectId}`);
    }
    return result;
  }

  async deleteProject(projectId: string): Promise<void> {
    const deleted = await this.projectsPg.deleteProject(projectId);
    if (!deleted) {
      throw new Error(`Project not found: ${projectId}`);
    }
  }

  // ============================================================================
  // Project Environment Variables
  // ============================================================================

  async getProjectEnvVars(projectId: string): Promise<EncryptedEnvVar[]> {
    return this.projectsPg.getEnvVars(projectId);
  }

  async setProjectEnvVar(
    projectId: string,
    envVar: Omit<EncryptedEnvVar, 'createdAt' | 'updatedAt'>,
  ): Promise<EncryptedEnvVar> {
    return this.projectsPg.setEnvVar(projectId, envVar);
  }

  async deleteProjectEnvVar(projectId: string, key: string): Promise<void> {
    const deleted = await this.projectsPg.deleteEnvVar(projectId, key);
    if (!deleted) {
      throw new Error(`Environment variable not found: ${key} in project ${projectId}`);
    }
  }

  // ============================================================================
  // Project API Tokens
  // ============================================================================

  async getProjectApiToken(tokenId: string): Promise<ProjectApiToken | null> {
    return this.projectsPg.getApiTokenById(tokenId);
  }

  async getProjectApiTokenByHash(tokenHash: string): Promise<ProjectApiToken | null> {
    return this.projectsPg.getApiTokenByHash(tokenHash);
  }

  async listProjectApiTokens(projectId: string): Promise<ProjectApiToken[]> {
    return this.projectsPg.listApiTokens(projectId);
  }

  async createProjectApiToken(token: Omit<ProjectApiToken, 'createdAt' | 'lastUsedAt'>): Promise<ProjectApiToken> {
    return this.projectsPg.createApiToken(token);
  }

  async updateProjectApiTokenLastUsed(tokenId: string): Promise<void> {
    await this.projectsPg.updateApiTokenLastUsed(tokenId);
  }

  async deleteProjectApiToken(tokenId: string): Promise<void> {
    const deleted = await this.projectsPg.deleteApiToken(tokenId);
    if (!deleted) {
      throw new Error(`API token not found: ${tokenId}`);
    }
  }

  // ============================================================================
  // Deployment Operations
  // ============================================================================

  async getDeployment(deploymentId: string): Promise<Deployment | null> {
    return this.deploymentsPg.getDeploymentById(deploymentId);
  }

  async getDeploymentBySlug(projectId: string, slug: string): Promise<Deployment | null> {
    return this.deploymentsPg.getDeploymentBySlug(projectId, slug);
  }

  async listDeploymentsForProject(
    projectId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<Deployment>> {
    const page = pagination?.page ?? 1;
    const perPage = pagination?.perPage ?? 20;
    const offset = (page - 1) * perPage;

    const { data, total } = await this.deploymentsPg.listDeployments(projectId, { limit: perPage, offset });

    return {
      data,
      total,
      page,
      perPage,
      hasMore: offset + data.length < total,
    };
  }

  async createDeployment(deployment: Omit<Deployment, 'createdAt' | 'updatedAt'>): Promise<Deployment> {
    return this.deploymentsPg.createDeployment(deployment);
  }

  async updateDeployment(
    deploymentId: string,
    updates: Partial<Omit<Deployment, 'id' | 'projectId' | 'createdAt'>>,
  ): Promise<Deployment> {
    const result = await this.deploymentsPg.updateDeployment(deploymentId, updates);
    if (!result) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }
    return result;
  }

  async updateDeploymentStatus(deploymentId: string, status: DeploymentStatus): Promise<Deployment> {
    const result = await this.deploymentsPg.updateDeploymentStatus(deploymentId, status);
    if (!result) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }
    return result;
  }

  async deleteDeployment(deploymentId: string): Promise<void> {
    const deleted = await this.deploymentsPg.deleteDeployment(deploymentId);
    if (!deleted) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }
  }

  // ============================================================================
  // Build Operations
  // ============================================================================

  async getBuild(buildId: string): Promise<Build | null> {
    return this.buildsPg.getBuildById(buildId);
  }

  async listBuildsForDeployment(deploymentId: string, pagination?: PaginationParams): Promise<PaginatedResult<Build>> {
    const page = pagination?.page ?? 1;
    const perPage = pagination?.perPage ?? 20;
    const offset = (page - 1) * perPage;

    const { data, total } = await this.buildsPg.listBuilds(deploymentId, { limit: perPage, offset });

    return {
      data,
      total,
      page,
      perPage,
      hasMore: offset + data.length < total,
    };
  }

  async createBuild(build: Omit<Build, 'startedAt' | 'completedAt'>): Promise<Build> {
    return this.buildsPg.createBuild(build);
  }

  async updateBuild(buildId: string, updates: Partial<Omit<Build, 'id' | 'deploymentId' | 'queuedAt'>>): Promise<Build> {
    const result = await this.buildsPg.updateBuild(buildId, updates);
    if (!result) {
      throw new Error(`Build not found: ${buildId}`);
    }
    return result;
  }

  async updateBuildStatus(buildId: string, status: BuildStatus, errorMessage?: string): Promise<Build> {
    const result = await this.buildsPg.updateBuildStatus(buildId, status, errorMessage);
    if (!result) {
      throw new Error(`Build not found: ${buildId}`);
    }
    return result;
  }

  async appendBuildLogs(buildId: string, logs: string): Promise<void> {
    await this.buildsPg.appendBuildLogs(buildId, logs);
  }

  async dequeueNextBuild(): Promise<Build | null> {
    return this.buildsPg.dequeue();
  }

  // ============================================================================
  // Running Server Operations
  // ============================================================================

  async getRunningServer(serverId: string): Promise<RunningServer | null> {
    return this.serversPg.getServerById(serverId);
  }

  async getRunningServerForDeployment(deploymentId: string): Promise<RunningServer | null> {
    return this.serversPg.getServerForDeployment(deploymentId);
  }

  async listRunningServers(): Promise<RunningServer[]> {
    return this.serversPg.listRunningServers();
  }

  async createRunningServer(server: Omit<RunningServer, 'stoppedAt'>): Promise<RunningServer> {
    return this.serversPg.createRunningServer(server);
  }

  async updateRunningServer(
    serverId: string,
    updates: Partial<Omit<RunningServer, 'id' | 'deploymentId' | 'buildId' | 'startedAt'>>,
  ): Promise<RunningServer> {
    const result = await this.serversPg.updateServer(serverId, updates);
    if (!result) {
      throw new Error(`Running server not found: ${serverId}`);
    }
    return result;
  }

  async stopRunningServer(serverId: string): Promise<void> {
    const result = await this.serversPg.stopServer(serverId);
    if (!result) {
      throw new Error(`Running server not found: ${serverId}`);
    }
  }

  // ============================================================================
  // RBAC Operations
  // ============================================================================

  async getUserPermissionsForTeam(userId: string, teamId: string): Promise<string[]> {
    return this.rbacPg.getUserPermissionsForTeam(userId, teamId);
  }

  async userHasPermission(userId: string, teamId: string, permission: string): Promise<boolean> {
    return this.rbacPg.userHasPermission(userId, teamId, permission);
  }

  // ============================================================================
  // Utility Accessors
  // ============================================================================

  /**
   * Get raw database client for advanced operations.
   */
  get db(): DbClient {
    return this.client;
  }

  /**
   * Get raw pool for ORM integration.
   */
  get rawPool(): Pool {
    return this.pool;
  }

  /**
   * Get schema name.
   */
  get schemaName(): string {
    return this.schema;
  }
}
