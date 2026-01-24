import { TeamRole } from './constants';
import { MastraAdminError } from './errors';
import type { LicenseFeature, LicenseInfo } from './license/types';
import { LicenseValidator } from './license/validator';
import type { AdminLogger } from './logger';
import { ConsoleAdminLogger } from './logger';
import { BuildOrchestrator } from './orchestrator/build-orchestrator';
import type { BillingProvider, EmailProvider, EncryptionProvider } from './providers';
import { ConsoleEmailProvider, NoBillingProvider, NodeCryptoEncryptionProvider } from './providers';
import type { FileStorageProvider } from './providers/file-storage/base';
import type { ObservabilityWriterInterface, ObservabilityQueryProvider } from './providers/observability';
import type { EdgeRouterProvider } from './providers/router/base';
import type { ProjectRunner } from './providers/runner/base';
import type { ProjectSourceProvider } from './providers/source/base';
import type { AdminStorage, PaginationParams, PaginatedResult } from './providers/storage/base';
import { RBACManager } from './rbac/manager';
import { RBACResource, RBACAction } from './rbac/types';
import type {
  Build,
  Deployment,
  EncryptedEnvVar,
  Project,
  RunningServer,
  Team,
  TeamInvite,
  TeamMember,
  User,
} from './types';

/**
 * Auth provider interface for MastraAdmin.
 * Compatible with @mastra/auth-* packages.
 */
export interface AdminAuthProvider {
  /**
   * Validate and decode a token, returning the user ID if valid.
   */
  validateToken?(token: string): Promise<{ userId: string } | null>;

  /**
   * Get user info from the auth provider.
   */
  getUser?(userId: string): Promise<{ id: string; email?: string; name?: string } | null>;
}

/**
 * Observability configuration.
 */
export interface ObservabilityConfig {
  /** File storage for JSONL event files */
  fileStorage: FileStorageProvider;
  /** Optional query provider (e.g., ClickHouse) */
  queryProvider?: ObservabilityQueryProvider;
  /** Optional pre-configured writer instance */
  writer?: ObservabilityWriterInterface;
}

/**
 * MastraAdmin configuration options.
 */
export interface MastraAdminConfig<
  TStorage extends AdminStorage = AdminStorage,
  TRunner extends ProjectRunner = ProjectRunner,
  TRouter extends EdgeRouterProvider = EdgeRouterProvider,
  TSource extends ProjectSourceProvider = ProjectSourceProvider,
> {
  /** License key for enterprise features. Use 'dev' or 'development' for development mode. */
  licenseKey: string;
  /** Auth provider from @mastra/auth-* packages. */
  auth?: AdminAuthProvider;
  /** Logger instance. Set to false to disable logging. */
  logger?: AdminLogger | false;
  /** Admin storage provider (e.g., PostgresAdminStorage). */
  storage: TStorage;
  /** Observability configuration. */
  observability?: ObservabilityConfig;
  /** Project runner for building and deploying. */
  runner?: TRunner;
  /** Edge router for exposing services. */
  router?: TRouter;
  /** Project source provider. */
  source?: TSource;
  /** Billing provider. Defaults to NoBillingProvider. */
  billing?: BillingProvider;
  /** Email provider. Defaults to ConsoleEmailProvider. */
  email?: EmailProvider;
  /** Encryption provider. Defaults to NodeCryptoEncryptionProvider. */
  encryption?: EncryptionProvider;
  /** Encryption secret (used when encryption provider not specified). */
  encryptionSecret?: string;
}

// ============================================================================
// Input Types for Business Logic Methods
// ============================================================================

export interface CreateTeamInput {
  name: string;
  slug: string;
}

export interface CreateProjectInput {
  name: string;
  slug: string;
  sourceType: 'local' | 'github';
  sourceConfig: Record<string, unknown>;
  defaultBranch?: string;
}

export interface CreateDeploymentInput {
  type: 'production' | 'staging' | 'preview';
  branch: string;
  slug?: string;
  envVarOverrides?: Record<string, string>;
  autoShutdown?: boolean;
}

export interface TriggerBuildInput {
  trigger?: 'manual' | 'webhook' | 'schedule' | 'rollback';
  commitSha?: string;
  commitMessage?: string;
}

/**
 * MastraAdmin - Central orchestrator for the admin platform.
 *
 * This class follows the same pattern as `Mastra` in @mastra/core:
 * - Contains all business logic methods (createTeam, deploy, etc.)
 * - Accepts providers via constructor (dependency injection)
 * - Can be used directly OR wrapped with @mastra/admin-server for HTTP access
 *
 * @example
 * ```typescript
 * // Create and initialize MastraAdmin
 * const admin = new MastraAdmin({
 *   licenseKey: 'dev',
 *   auth: new MastraAuthSupabase(),
 *   storage: new PostgresAdminStorage({ ... }),
 *   runner: new LocalProcessRunner(),
 *   router: new LocalEdgeRouter(),
 *   source: new LocalProjectSource({ basePaths: ['/projects'] }),
 * });
 * await admin.init();
 *
 * // Use directly (like using Mastra directly)
 * const team = await admin.createTeam('user-123', { name: 'Search', slug: 'search' });
 * const project = await admin.createProject('user-123', team.id, { ... });
 * await admin.deploy('user-123', deployment.id);
 *
 * // OR wrap with AdminServer for HTTP access (like @mastra/server)
 * const server = new AdminServer({ admin, port: 3000 });
 * await server.start();
 * // POST /api/teams → calls admin.createTeam()
 * // POST /api/deployments/:id/deploy → calls admin.deploy()
 * ```
 */
export class MastraAdmin<
  TStorage extends AdminStorage = AdminStorage,
  TRunner extends ProjectRunner = ProjectRunner,
  TRouter extends EdgeRouterProvider = EdgeRouterProvider,
  TSource extends ProjectSourceProvider = ProjectSourceProvider,
> {
  readonly #config: MastraAdminConfig<TStorage, TRunner, TRouter, TSource>;
  readonly #license: LicenseValidator;
  readonly #rbac: RBACManager;
  readonly #orchestrator: BuildOrchestrator;
  readonly #logger: AdminLogger;
  #initialized = false;

  // Providers (also accessible via getters)
  readonly #auth?: AdminAuthProvider;
  readonly #storage: TStorage;
  readonly #billing: BillingProvider;
  readonly #email: EmailProvider;
  readonly #encryption: EncryptionProvider;
  readonly #observability?: ObservabilityConfig;
  readonly #runner?: TRunner;
  readonly #router?: TRouter;
  readonly #source?: TSource;

  // Protected getter for logger (for subclasses if needed)
  protected get logger(): AdminLogger {
    return this.#logger;
  }

  constructor(config: MastraAdminConfig<TStorage, TRunner, TRouter, TSource>) {
    // Validate required config
    if (!config.licenseKey) {
      throw MastraAdminError.configurationError('licenseKey is required');
    }
    if (!config.storage) {
      throw MastraAdminError.configurationError('storage provider is required');
    }

    this.#config = config;

    // Initialize logger
    this.#logger = config.logger === false
      ? { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }
      : config.logger ?? new ConsoleAdminLogger('MastraAdmin');

    // Initialize components
    this.#license = new LicenseValidator(config.licenseKey);
    this.#auth = config.auth;
    this.#storage = config.storage;
    this.#observability = config.observability;
    this.#runner = config.runner;
    this.#router = config.router;
    this.#source = config.source;

    // Initialize optional providers with defaults
    this.#billing = config.billing ?? new NoBillingProvider();
    this.#email = config.email ?? new ConsoleEmailProvider();
    this.#encryption =
      config.encryption ??
      new NodeCryptoEncryptionProvider(
        config.encryptionSecret ?? process.env['ADMIN_ENCRYPTION_SECRET'] ?? this.#generateFallbackSecret(),
      );

    // Initialize RBAC manager
    this.#rbac = new RBACManager(this.#storage);

    // Initialize build orchestrator (requires runner, router, source)
    this.#orchestrator = new BuildOrchestrator(
      this.#storage,
      this.#encryption,
      this.#runner,
      this.#router,
      this.#source,
    );
  }

  // ============================================================================
  // Initialization & Lifecycle
  // ============================================================================

  /**
   * Initialize MastraAdmin. Validates license and initializes storage.
   * Must be called before using any business logic methods.
   */
  async init(): Promise<void> {
    if (this.#initialized) {
      return;
    }

    this.logger.info('Initializing MastraAdmin...');

    // Validate license
    try {
      await this.#license.validate();
      this.logger.info(`License valid: ${this.#license.getLicenseInfo().tier}`);
    } catch (error) {
      this.logger.error('License validation failed', { error });
      throw error;
    }

    // Initialize storage
    try {
      await this.#storage.init();
      this.logger.info('Storage initialized');
    } catch (error) {
      this.logger.error('Storage initialization failed', { error });
      throw MastraAdminError.storageError('Failed to initialize storage', error);
    }

    this.#initialized = true;
    this.logger.info('MastraAdmin initialized successfully');
  }

  /**
   * Gracefully shutdown MastraAdmin.
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down MastraAdmin...');

    // Stop build orchestrator
    await this.#orchestrator.shutdown();

    // Flush observability writer if present
    if (this.#observability?.writer) {
      await this.#observability.writer.shutdown();
    }

    // Close storage
    await this.#storage.close();

    this.logger.info('MastraAdmin shutdown complete');
  }

  // ============================================================================
  // Accessors (for admin-server to use)
  // ============================================================================

  getAuth(): AdminAuthProvider | undefined {
    return this.#auth;
  }

  getStorage(): TStorage {
    return this.#storage;
  }

  getLicense(): LicenseValidator {
    return this.#license;
  }

  getLicenseInfo(): LicenseInfo {
    return this.#license.getLicenseInfo();
  }

  getRBAC(): RBACManager {
    return this.#rbac;
  }

  getOrchestrator(): BuildOrchestrator {
    return this.#orchestrator;
  }

  getEncryption(): EncryptionProvider {
    return this.#encryption;
  }

  hasFeature(feature: LicenseFeature): boolean {
    return this.#license.hasFeature(feature);
  }

  // ============================================================================
  // User Operations
  // ============================================================================

  /**
   * Get a user by ID.
   */
  async getUser(userId: string): Promise<User | null> {
    this.#assertInitialized();
    return this.#storage.getUser(userId);
  }

  /**
   * Get a user by email.
   */
  async getUserByEmail(email: string): Promise<User | null> {
    this.#assertInitialized();
    return this.#storage.getUserByEmail(email);
  }

  // ============================================================================
  // Team Management
  // ============================================================================

  /**
   * Create a new team.
   */
  async createTeam(userId: string, input: CreateTeamInput): Promise<Team> {
    this.#assertInitialized();

    // Check license limits
    const existingTeams = await this.#storage.listTeamsForUser(userId);
    if (!this.#license.canCreateTeam(existingTeams.total)) {
      throw MastraAdminError.licenseLimitExceeded('Teams', existingTeams.total, this.#license.getLicenseInfo().maxTeams ?? 0);
    }

    // Check if slug already exists
    const existingTeam = await this.#storage.getTeamBySlug(input.slug);
    if (existingTeam) {
      throw MastraAdminError.teamSlugExists(input.slug);
    }

    const team = await this.#storage.createTeam({
      id: crypto.randomUUID(),
      name: input.name,
      slug: input.slug,
      settings: {},
    });

    // Add creator as owner
    await this.#storage.addTeamMember({
      teamId: team.id,
      userId,
      role: TeamRole.OWNER,
    });

    this.logger.info(`Team created: ${team.slug}`, { teamId: team.id, userId });
    return team;
  }

  /**
   * Get a team by ID.
   */
  async getTeam(userId: string, teamId: string): Promise<Team | null> {
    this.#assertInitialized();
    await this.#rbac.assertPermission({ userId, teamId }, `${RBACResource.TEAM}:${RBACAction.READ}`);
    return this.#storage.getTeam(teamId);
  }

  /**
   * List teams the user has access to.
   */
  async listTeams(userId: string, pagination?: PaginationParams): Promise<PaginatedResult<Team>> {
    this.#assertInitialized();
    return this.#storage.listTeamsForUser(userId, pagination);
  }

  /**
   * Invite a user to a team.
   */
  async inviteMember(
    userId: string,
    teamId: string,
    email: string,
    role: TeamRole,
  ): Promise<TeamInvite> {
    this.#assertInitialized();
    await this.#rbac.assertPermission({ userId, teamId }, `${RBACResource.INVITE}:${RBACAction.CREATE}`);

    // Check if already invited
    const existingInvite = await this.#storage.getTeamInviteByEmail(teamId, email);
    if (existingInvite) {
      return existingInvite;
    }

    const invite = await this.#storage.createTeamInvite({
      teamId,
      email,
      role,
      invitedBy: userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Get team info for email
    const team = await this.#storage.getTeam(teamId);

    // Send invite email
    await this.#email.send({
      to: email,
      subject: `You've been invited to join ${team?.name ?? 'a team'}`,
      template: 'team_invite',
      data: { invite, team },
    });

    this.logger.info(`Team invite sent`, { teamId, email, invitedBy: userId });
    return invite;
  }

  /**
   * Get team members.
   */
  async getTeamMembers(userId: string, teamId: string, pagination?: PaginationParams): Promise<PaginatedResult<TeamMember & { user: User }>> {
    this.#assertInitialized();
    await this.#rbac.assertPermission({ userId, teamId }, `${RBACResource.MEMBER}:${RBACAction.READ}`);
    return this.#storage.listTeamMembers(teamId, pagination);
  }

  /**
   * Remove a team member.
   */
  async removeMember(userId: string, teamId: string, memberId: string): Promise<void> {
    this.#assertInitialized();
    await this.#rbac.assertPermission({ userId, teamId }, `${RBACResource.MEMBER}:${RBACAction.DELETE}`);
    await this.#storage.removeTeamMember(teamId, memberId);
    this.logger.info(`Team member removed`, { teamId, memberId, removedBy: userId });
  }

  // ============================================================================
  // Project Management
  // ============================================================================

  /**
   * Create a new project.
   */
  async createProject(userId: string, teamId: string, input: CreateProjectInput): Promise<Project> {
    this.#assertInitialized();
    await this.#rbac.assertPermission({ userId, teamId }, `${RBACResource.PROJECT}:${RBACAction.CREATE}`);

    // Check license limits
    const existingProjects = await this.#storage.listProjectsForTeam(teamId);
    if (!this.#license.canCreateProject(teamId, existingProjects.total)) {
      throw MastraAdminError.licenseLimitExceeded('Projects', existingProjects.total, this.#license.getLicenseInfo().maxProjects ?? 0);
    }

    // Check if slug exists in team
    const existingProject = await this.#storage.getProjectBySlug(teamId, input.slug);
    if (existingProject) {
      throw MastraAdminError.projectSlugExists(input.slug, teamId);
    }

    const project = await this.#storage.createProject({
      id: crypto.randomUUID(),
      teamId,
      name: input.name,
      slug: input.slug,
      sourceType: input.sourceType,
      sourceConfig: input.sourceConfig as unknown as Project['sourceConfig'],
      defaultBranch: input.defaultBranch ?? 'main',
      envVars: [],
    });

    this.logger.info(`Project created: ${project.slug}`, { projectId: project.id, teamId, userId });
    return project;
  }

  /**
   * Get a project by ID.
   */
  async getProject(userId: string, projectId: string): Promise<Project | null> {
    this.#assertInitialized();
    const project = await this.#storage.getProject(projectId);
    if (!project) return null;

    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, `${RBACResource.PROJECT}:${RBACAction.READ}`);
    return project;
  }

  /**
   * List projects in a team.
   */
  async listProjects(
    userId: string,
    teamId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<Project>> {
    this.#assertInitialized();
    await this.#rbac.assertPermission({ userId, teamId }, `${RBACResource.PROJECT}:${RBACAction.READ}`);
    return this.#storage.listProjectsForTeam(teamId, pagination);
  }

  /**
   * Set an environment variable for a project.
   */
  async setEnvVar(
    userId: string,
    projectId: string,
    key: string,
    value: string,
    isSecret: boolean,
  ): Promise<EncryptedEnvVar> {
    this.#assertInitialized();
    const project = await this.#storage.getProject(projectId);
    if (!project) {
      throw MastraAdminError.projectNotFound(projectId);
    }
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, `${RBACResource.ENV_VAR}:${RBACAction.UPDATE}`);

    const encryptedValue = isSecret
      ? await this.#encryption.encrypt(value)
      : value;

    const envVar = await this.#storage.setProjectEnvVar(projectId, {
      key,
      encryptedValue,
      isSecret,
    });

    this.logger.info(`Env var set: ${key}`, { projectId, isSecret, userId });
    return envVar;
  }

  /**
   * Get environment variables for a project.
   */
  async getEnvVars(userId: string, projectId: string): Promise<EncryptedEnvVar[]> {
    this.#assertInitialized();
    const project = await this.#storage.getProject(projectId);
    if (!project) {
      throw MastraAdminError.projectNotFound(projectId);
    }
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, `${RBACResource.ENV_VAR}:${RBACAction.READ}`);
    return this.#storage.getProjectEnvVars(projectId);
  }

  /**
   * Delete a project.
   */
  async deleteProject(userId: string, projectId: string): Promise<void> {
    this.#assertInitialized();
    const project = await this.#storage.getProject(projectId);
    if (!project) {
      throw MastraAdminError.projectNotFound(projectId);
    }
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, `${RBACResource.PROJECT}:${RBACAction.DELETE}`);

    // Stop all deployments first
    const deployments = await this.#storage.listDeploymentsForProject(projectId);
    for (const deployment of deployments.data) {
      if (deployment.status === 'running') {
        await this.stop(userId, deployment.id);
      }
    }

    await this.#storage.deleteProject(projectId);
    this.logger.info(`Project deleted`, { projectId, userId });
  }

  // ============================================================================
  // Deployment Management
  // ============================================================================

  /**
   * Create a new deployment for a project.
   */
  async createDeployment(
    userId: string,
    projectId: string,
    input: CreateDeploymentInput,
  ): Promise<Deployment> {
    this.#assertInitialized();
    const project = await this.#storage.getProject(projectId);
    if (!project) {
      throw MastraAdminError.projectNotFound(projectId);
    }
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, `${RBACResource.DEPLOYMENT}:${RBACAction.CREATE}`);

    const slug = input.slug ?? `${input.branch}--${project.slug}`;

    const deployment = await this.#storage.createDeployment({
      id: crypto.randomUUID(),
      projectId,
      type: input.type,
      branch: input.branch,
      slug,
      status: 'pending',
      currentBuildId: null,
      publicUrl: null,
      internalHost: null,
      envVarOverrides: [],
      autoShutdown: input.autoShutdown ?? input.type === 'preview',
      expiresAt: null,
    });

    this.logger.info(`Deployment created`, { deploymentId: deployment.id, projectId, userId });
    return deployment;
  }

  /**
   * Get a deployment by ID.
   */
  async getDeployment(userId: string, deploymentId: string): Promise<Deployment | null> {
    this.#assertInitialized();
    const deployment = await this.#storage.getDeployment(deploymentId);
    if (!deployment) return null;

    const project = await this.#storage.getProject(deployment.projectId);
    if (!project) return null;

    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, `${RBACResource.DEPLOYMENT}:${RBACAction.READ}`);
    return deployment;
  }

  /**
   * List deployments for a project.
   */
  async listDeployments(
    userId: string,
    projectId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<Deployment>> {
    this.#assertInitialized();
    const project = await this.#storage.getProject(projectId);
    if (!project) {
      throw MastraAdminError.projectNotFound(projectId);
    }
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, `${RBACResource.DEPLOYMENT}:${RBACAction.READ}`);
    return this.#storage.listDeploymentsForProject(projectId, pagination);
  }

  /**
   * Deploy a deployment (trigger a build and deploy).
   * This is the main entry point for deploying a project.
   */
  async deploy(userId: string, deploymentId: string, input?: TriggerBuildInput): Promise<Build> {
    this.#assertInitialized();
    const deployment = await this.#storage.getDeployment(deploymentId);
    if (!deployment) {
      throw MastraAdminError.deploymentNotFound(deploymentId);
    }

    const project = await this.#storage.getProject(deployment.projectId);
    if (!project) {
      throw MastraAdminError.projectNotFound(deployment.projectId);
    }

    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, `${RBACResource.DEPLOYMENT}:${RBACAction.DEPLOY}`);

    // Create a build and queue it
    const build = await this.#storage.createBuild({
      id: crypto.randomUUID(),
      deploymentId,
      trigger: input?.trigger ?? 'manual',
      triggeredBy: userId,
      commitSha: input?.commitSha ?? 'HEAD',
      commitMessage: input?.commitMessage ?? null,
      status: 'queued',
      logs: '',
      queuedAt: new Date(),
      errorMessage: null,
    });

    // Queue the build for processing by the orchestrator
    await this.#orchestrator.queueBuild(build.id);

    this.logger.info(`Deploy triggered`, { deploymentId, buildId: build.id, userId });
    return build;
  }

  /**
   * Stop a running deployment.
   */
  async stop(userId: string, deploymentId: string): Promise<void> {
    this.#assertInitialized();
    const deployment = await this.#storage.getDeployment(deploymentId);
    if (!deployment) {
      throw MastraAdminError.deploymentNotFound(deploymentId);
    }

    const project = await this.#storage.getProject(deployment.projectId);
    if (!project) {
      throw MastraAdminError.projectNotFound(deployment.projectId);
    }

    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, `${RBACResource.DEPLOYMENT}:${RBACAction.UPDATE}`);

    await this.#orchestrator.stopDeployment(deploymentId);
    await this.#storage.updateDeploymentStatus(deploymentId, 'stopped');

    this.logger.info(`Deployment stopped`, { deploymentId, userId });
  }

  /**
   * Rollback to a previous build.
   */
  async rollback(userId: string, deploymentId: string, buildId: string): Promise<Build> {
    this.#assertInitialized();
    const deployment = await this.#storage.getDeployment(deploymentId);
    if (!deployment) {
      throw MastraAdminError.deploymentNotFound(deploymentId);
    }

    const project = await this.#storage.getProject(deployment.projectId);
    if (!project) {
      throw MastraAdminError.projectNotFound(deployment.projectId);
    }

    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, `${RBACResource.DEPLOYMENT}:${RBACAction.DEPLOY}`);

    // Get the build to rollback to
    const targetBuild = await this.#storage.getBuild(buildId);
    if (!targetBuild) {
      throw MastraAdminError.buildNotFound(buildId);
    }

    // Create a rollback build
    const build = await this.#storage.createBuild({
      id: crypto.randomUUID(),
      deploymentId,
      trigger: 'rollback',
      triggeredBy: userId,
      commitSha: targetBuild.commitSha,
      commitMessage: `Rollback to ${buildId}`,
      status: 'queued',
      logs: '',
      queuedAt: new Date(),
      errorMessage: null,
    });

    await this.#orchestrator.queueBuild(build.id);

    this.logger.info(`Rollback triggered`, { deploymentId, buildId: build.id, rollbackFrom: buildId, userId });
    return build;
  }

  // ============================================================================
  // Build Management
  // ============================================================================

  /**
   * Get a build by ID.
   */
  async getBuild(userId: string, buildId: string): Promise<Build | null> {
    this.#assertInitialized();
    const build = await this.#storage.getBuild(buildId);
    if (!build) return null;

    const deployment = await this.#storage.getDeployment(build.deploymentId);
    if (!deployment) return null;

    const project = await this.#storage.getProject(deployment.projectId);
    if (!project) return null;

    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, `${RBACResource.BUILD}:${RBACAction.READ}`);
    return build;
  }

  /**
   * List builds for a deployment.
   */
  async listBuilds(
    userId: string,
    deploymentId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<Build>> {
    this.#assertInitialized();
    const deployment = await this.#storage.getDeployment(deploymentId);
    if (!deployment) {
      throw MastraAdminError.deploymentNotFound(deploymentId);
    }

    const project = await this.#storage.getProject(deployment.projectId);
    if (!project) {
      throw MastraAdminError.projectNotFound(deployment.projectId);
    }

    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, `${RBACResource.BUILD}:${RBACAction.READ}`);
    return this.#storage.listBuildsForDeployment(deploymentId, pagination);
  }

  /**
   * Cancel a queued or running build.
   */
  async cancelBuild(userId: string, buildId: string): Promise<void> {
    this.#assertInitialized();
    const build = await this.#storage.getBuild(buildId);
    if (!build) {
      throw MastraAdminError.buildNotFound(buildId);
    }

    const deployment = await this.#storage.getDeployment(build.deploymentId);
    if (!deployment) {
      throw MastraAdminError.deploymentNotFound(build.deploymentId);
    }

    const project = await this.#storage.getProject(deployment.projectId);
    if (!project) {
      throw MastraAdminError.projectNotFound(deployment.projectId);
    }

    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, `${RBACResource.BUILD}:${RBACAction.DELETE}`);

    await this.#orchestrator.cancelBuild(buildId);
    await this.#storage.updateBuildStatus(buildId, 'cancelled');

    this.logger.info(`Build cancelled`, { buildId, userId });
  }

  // ============================================================================
  // Running Server Management
  // ============================================================================

  /**
   * Get the running server for a deployment.
   */
  async getRunningServer(userId: string, deploymentId: string): Promise<RunningServer | null> {
    this.#assertInitialized();
    const deployment = await this.#storage.getDeployment(deploymentId);
    if (!deployment) {
      throw MastraAdminError.deploymentNotFound(deploymentId);
    }

    const project = await this.#storage.getProject(deployment.projectId);
    if (!project) {
      throw MastraAdminError.projectNotFound(deployment.projectId);
    }

    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, `${RBACResource.DEPLOYMENT}:${RBACAction.READ}`);
    return this.#storage.getRunningServerForDeployment(deploymentId);
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  #assertInitialized(): void {
    if (!this.#initialized) {
      throw MastraAdminError.configurationError('MastraAdmin not initialized. Call init() first.');
    }
  }

  #generateFallbackSecret(): string {
    this.logger.warn(
      'ADMIN_ENCRYPTION_SECRET not set. Using generated secret. ' +
        'This is insecure for production - set ADMIN_ENCRYPTION_SECRET environment variable.',
    );
    return 'dev-fallback-secret-not-for-production-use!!';
  }
}
