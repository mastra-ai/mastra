import type {
  AdminStorage,
  PaginationParams,
  PaginatedResult,
  User,
  Team,
  TeamMember,
  TeamInvite,
  Project,
  EncryptedEnvVar,
  ProjectApiToken,
  Deployment,
  Build,
  RunningServer,
  TeamRole,
  BuildStatus,
  DeploymentStatus,
} from '@mastra/admin';

/**
 * In-memory storage implementation for integration testing.
 *
 * This mock storage is used until the real PostgreSQL storage
 * (@mastra/admin-pg) is implemented. It provides a fully functional
 * in-memory implementation of the AdminStorage interface.
 */
export class MockAdminStorage implements AdminStorage {
  // In-memory data stores
  private users = new Map<string, User>();
  private usersByEmail = new Map<string, User>();
  private teams = new Map<string, Team>();
  private teamsBySlug = new Map<string, Team>();
  private teamMembers = new Map<string, TeamMember[]>(); // teamId -> members
  private teamInvites = new Map<string, TeamInvite>();
  private projects = new Map<string, Project>();
  private projectEnvVars = new Map<string, EncryptedEnvVar[]>(); // projectId -> envVars
  private projectApiTokens = new Map<string, ProjectApiToken[]>(); // projectId -> tokens
  private deployments = new Map<string, Deployment>();
  private builds = new Map<string, Build>();
  private buildQueue: string[] = []; // Build IDs in queue order
  private runningServers = new Map<string, RunningServer>();

  async init(): Promise<void> {
    // No-op for in-memory storage
  }

  async close(): Promise<void> {
    // Clear all data
    this.users.clear();
    this.usersByEmail.clear();
    this.teams.clear();
    this.teamsBySlug.clear();
    this.teamMembers.clear();
    this.teamInvites.clear();
    this.projects.clear();
    this.projectEnvVars.clear();
    this.projectApiTokens.clear();
    this.deployments.clear();
    this.builds.clear();
    this.buildQueue = [];
    this.runningServers.clear();
  }

  // ============================================================================
  // User Operations
  // ============================================================================

  async getUser(userId: string): Promise<User | null> {
    return this.users.get(userId) ?? null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.usersByEmail.get(email.toLowerCase()) ?? null;
  }

  async createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User> {
    // Check for duplicate email
    if (this.usersByEmail.has(user.email.toLowerCase())) {
      throw new Error(`User with email ${user.email} already exists`);
    }

    const now = new Date();
    const fullUser: User = {
      ...user,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, fullUser);
    this.usersByEmail.set(user.email.toLowerCase(), fullUser);
    return fullUser;
  }

  async updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };

    this.users.set(userId, updatedUser);
    if (updates.email) {
      this.usersByEmail.delete(user.email.toLowerCase());
      this.usersByEmail.set(updates.email.toLowerCase(), updatedUser);
    }

    return updatedUser;
  }

  // ============================================================================
  // Team Operations
  // ============================================================================

  async getTeam(teamId: string): Promise<Team | null> {
    return this.teams.get(teamId) ?? null;
  }

  async getTeamBySlug(slug: string): Promise<Team | null> {
    return this.teamsBySlug.get(slug) ?? null;
  }

  async listTeamsForUser(userId: string, pagination?: PaginationParams): Promise<PaginatedResult<Team>> {
    const userTeamIds = new Set<string>();

    // Find all teams the user is a member of
    for (const [teamId, members] of this.teamMembers.entries()) {
      if (members.some(m => m.userId === userId)) {
        userTeamIds.add(teamId);
      }
    }

    const teams = Array.from(userTeamIds)
      .map(id => this.teams.get(id)!)
      .filter(Boolean);

    return this.paginate(teams, pagination);
  }

  async createTeam(team: Omit<Team, 'createdAt' | 'updatedAt'>): Promise<Team> {
    // Check for duplicate slug
    if (this.teamsBySlug.has(team.slug)) {
      throw new Error(`Team with slug ${team.slug} already exists`);
    }

    const now = new Date();
    const fullTeam: Team = {
      ...team,
      createdAt: now,
      updatedAt: now,
    };

    this.teams.set(team.id, fullTeam);
    this.teamsBySlug.set(team.slug, fullTeam);
    this.teamMembers.set(team.id, []);
    return fullTeam;
  }

  async updateTeam(teamId: string, updates: Partial<Omit<Team, 'id' | 'createdAt'>>): Promise<Team> {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    const updatedTeam: Team = {
      ...team,
      ...updates,
      updatedAt: new Date(),
    };

    this.teams.set(teamId, updatedTeam);
    if (updates.slug) {
      this.teamsBySlug.delete(team.slug);
      this.teamsBySlug.set(updates.slug, updatedTeam);
    }

    return updatedTeam;
  }

  async deleteTeam(teamId: string): Promise<void> {
    const team = this.teams.get(teamId);
    if (team) {
      this.teamsBySlug.delete(team.slug);
    }
    this.teams.delete(teamId);
    this.teamMembers.delete(teamId);
  }

  // ============================================================================
  // Team Member Operations
  // ============================================================================

  async getTeamMember(teamId: string, userId: string): Promise<TeamMember | null> {
    const members = this.teamMembers.get(teamId) ?? [];
    return members.find(m => m.userId === userId) ?? null;
  }

  async listTeamMembers(
    teamId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<TeamMember & { user: User }>> {
    const members = this.teamMembers.get(teamId) ?? [];
    const membersWithUsers = members.map(m => ({
      ...m,
      user: this.users.get(m.userId)!,
    })).filter(m => m.user);

    return this.paginate(membersWithUsers, pagination);
  }

  async addTeamMember(member: Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>): Promise<TeamMember> {
    const now = new Date();
    const fullMember: TeamMember = {
      id: crypto.randomUUID(),
      ...member,
      createdAt: now,
      updatedAt: now,
    };

    const members = this.teamMembers.get(member.teamId) ?? [];
    members.push(fullMember);
    this.teamMembers.set(member.teamId, members);

    return fullMember;
  }

  async updateTeamMemberRole(teamId: string, userId: string, role: TeamRole): Promise<TeamMember> {
    const members = this.teamMembers.get(teamId) ?? [];
    const memberIndex = members.findIndex(m => m.userId === userId);

    if (memberIndex === -1) {
      throw new Error(`Team member not found`);
    }

    members[memberIndex] = {
      ...members[memberIndex],
      role,
      updatedAt: new Date(),
    };

    this.teamMembers.set(teamId, members);
    return members[memberIndex];
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    const members = this.teamMembers.get(teamId) ?? [];
    const filteredMembers = members.filter(m => m.userId !== userId);
    this.teamMembers.set(teamId, filteredMembers);
  }

  // ============================================================================
  // Team Invite Operations
  // ============================================================================

  async getTeamInvite(inviteId: string): Promise<TeamInvite | null> {
    return this.teamInvites.get(inviteId) ?? null;
  }

  async getTeamInviteByEmail(teamId: string, email: string): Promise<TeamInvite | null> {
    for (const invite of this.teamInvites.values()) {
      if (invite.teamId === teamId && invite.email.toLowerCase() === email.toLowerCase()) {
        return invite;
      }
    }
    return null;
  }

  async listTeamInvites(teamId: string): Promise<TeamInvite[]> {
    const invites: TeamInvite[] = [];
    for (const invite of this.teamInvites.values()) {
      if (invite.teamId === teamId) {
        invites.push(invite);
      }
    }
    return invites;
  }

  async createTeamInvite(invite: Omit<TeamInvite, 'id' | 'createdAt'>): Promise<TeamInvite> {
    const fullInvite: TeamInvite = {
      id: crypto.randomUUID(),
      ...invite,
      createdAt: new Date(),
    };

    this.teamInvites.set(fullInvite.id, fullInvite);
    return fullInvite;
  }

  async deleteTeamInvite(inviteId: string): Promise<void> {
    this.teamInvites.delete(inviteId);
  }

  // ============================================================================
  // Project Operations
  // ============================================================================

  async getProject(projectId: string): Promise<Project | null> {
    return this.projects.get(projectId) ?? null;
  }

  async getProjectBySlug(teamId: string, slug: string): Promise<Project | null> {
    for (const project of this.projects.values()) {
      if (project.teamId === teamId && project.slug === slug) {
        return project;
      }
    }
    return null;
  }

  async listProjectsForTeam(teamId: string, pagination?: PaginationParams): Promise<PaginatedResult<Project>> {
    const projects = Array.from(this.projects.values()).filter(p => p.teamId === teamId);
    return this.paginate(projects, pagination);
  }

  async createProject(project: Omit<Project, 'createdAt' | 'updatedAt'>): Promise<Project> {
    const now = new Date();
    const fullProject: Project = {
      ...project,
      createdAt: now,
      updatedAt: now,
    };

    this.projects.set(project.id, fullProject);
    this.projectEnvVars.set(project.id, []);
    this.projectApiTokens.set(project.id, []);
    return fullProject;
  }

  async updateProject(projectId: string, updates: Partial<Omit<Project, 'id' | 'teamId' | 'createdAt'>>): Promise<Project> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const updatedProject: Project = {
      ...project,
      ...updates,
      updatedAt: new Date(),
    };

    this.projects.set(projectId, updatedProject);
    return updatedProject;
  }

  async deleteProject(projectId: string): Promise<void> {
    this.projects.delete(projectId);
    this.projectEnvVars.delete(projectId);
    this.projectApiTokens.delete(projectId);

    // Delete related deployments
    for (const [id, deployment] of this.deployments.entries()) {
      if (deployment.projectId === projectId) {
        this.deployments.delete(id);
      }
    }
  }

  // ============================================================================
  // Project Environment Variables
  // ============================================================================

  async getProjectEnvVars(projectId: string): Promise<EncryptedEnvVar[]> {
    return this.projectEnvVars.get(projectId) ?? [];
  }

  async setProjectEnvVar(
    projectId: string,
    envVar: Omit<EncryptedEnvVar, 'createdAt' | 'updatedAt'>,
  ): Promise<EncryptedEnvVar> {
    const now = new Date();
    const fullEnvVar: EncryptedEnvVar = {
      ...envVar,
      createdAt: now,
      updatedAt: now,
    };

    const envVars = this.projectEnvVars.get(projectId) ?? [];
    const existingIndex = envVars.findIndex(e => e.key === envVar.key);

    if (existingIndex >= 0) {
      envVars[existingIndex] = fullEnvVar;
    } else {
      envVars.push(fullEnvVar);
    }

    this.projectEnvVars.set(projectId, envVars);
    return fullEnvVar;
  }

  async deleteProjectEnvVar(projectId: string, key: string): Promise<void> {
    const envVars = this.projectEnvVars.get(projectId) ?? [];
    const filtered = envVars.filter(e => e.key !== key);
    this.projectEnvVars.set(projectId, filtered);
  }

  // ============================================================================
  // Project API Tokens
  // ============================================================================

  async getProjectApiToken(tokenId: string): Promise<ProjectApiToken | null> {
    for (const tokens of this.projectApiTokens.values()) {
      const token = tokens.find(t => t.id === tokenId);
      if (token) return token;
    }
    return null;
  }

  async getProjectApiTokenByHash(tokenHash: string): Promise<ProjectApiToken | null> {
    for (const tokens of this.projectApiTokens.values()) {
      const token = tokens.find(t => t.tokenHash === tokenHash);
      if (token) return token;
    }
    return null;
  }

  async listProjectApiTokens(projectId: string): Promise<ProjectApiToken[]> {
    return this.projectApiTokens.get(projectId) ?? [];
  }

  async createProjectApiToken(token: Omit<ProjectApiToken, 'createdAt' | 'lastUsedAt'>): Promise<ProjectApiToken> {
    const fullToken: ProjectApiToken = {
      ...token,
      lastUsedAt: null,
      createdAt: new Date(),
    };

    const tokens = this.projectApiTokens.get(token.projectId) ?? [];
    tokens.push(fullToken);
    this.projectApiTokens.set(token.projectId, tokens);

    return fullToken;
  }

  async updateProjectApiTokenLastUsed(tokenId: string): Promise<void> {
    for (const [projectId, tokens] of this.projectApiTokens.entries()) {
      const index = tokens.findIndex(t => t.id === tokenId);
      if (index >= 0) {
        tokens[index] = { ...tokens[index], lastUsedAt: new Date() };
        this.projectApiTokens.set(projectId, tokens);
        return;
      }
    }
  }

  async deleteProjectApiToken(tokenId: string): Promise<void> {
    for (const [projectId, tokens] of this.projectApiTokens.entries()) {
      const filtered = tokens.filter(t => t.id !== tokenId);
      if (filtered.length !== tokens.length) {
        this.projectApiTokens.set(projectId, filtered);
        return;
      }
    }
  }

  // ============================================================================
  // Deployment Operations
  // ============================================================================

  async getDeployment(deploymentId: string): Promise<Deployment | null> {
    return this.deployments.get(deploymentId) ?? null;
  }

  async getDeploymentBySlug(projectId: string, slug: string): Promise<Deployment | null> {
    for (const deployment of this.deployments.values()) {
      if (deployment.projectId === projectId && deployment.slug === slug) {
        return deployment;
      }
    }
    return null;
  }

  async listDeploymentsForProject(
    projectId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<Deployment>> {
    const deployments = Array.from(this.deployments.values()).filter(d => d.projectId === projectId);
    return this.paginate(deployments, pagination);
  }

  async createDeployment(deployment: Omit<Deployment, 'createdAt' | 'updatedAt'>): Promise<Deployment> {
    const now = new Date();
    const fullDeployment: Deployment = {
      ...deployment,
      createdAt: now,
      updatedAt: now,
    };

    this.deployments.set(deployment.id, fullDeployment);
    return fullDeployment;
  }

  async updateDeployment(
    deploymentId: string,
    updates: Partial<Omit<Deployment, 'id' | 'projectId' | 'createdAt'>>,
  ): Promise<Deployment> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    const updatedDeployment: Deployment = {
      ...deployment,
      ...updates,
      updatedAt: new Date(),
    };

    this.deployments.set(deploymentId, updatedDeployment);
    return updatedDeployment;
  }

  async updateDeploymentStatus(deploymentId: string, status: DeploymentStatus): Promise<Deployment> {
    return this.updateDeployment(deploymentId, { status });
  }

  async deleteDeployment(deploymentId: string): Promise<void> {
    this.deployments.delete(deploymentId);

    // Delete related builds
    for (const [id, build] of this.builds.entries()) {
      if (build.deploymentId === deploymentId) {
        this.builds.delete(id);
      }
    }
  }

  // ============================================================================
  // Build Operations
  // ============================================================================

  async getBuild(buildId: string): Promise<Build | null> {
    return this.builds.get(buildId) ?? null;
  }

  async listBuildsForDeployment(deploymentId: string, pagination?: PaginationParams): Promise<PaginatedResult<Build>> {
    const builds = Array.from(this.builds.values())
      .filter(b => b.deploymentId === deploymentId)
      .sort((a, b) => b.queuedAt.getTime() - a.queuedAt.getTime());
    return this.paginate(builds, pagination);
  }

  async createBuild(build: Omit<Build, 'startedAt' | 'completedAt'>): Promise<Build> {
    const fullBuild: Build = {
      ...build,
      startedAt: null,
      completedAt: null,
    };

    this.builds.set(build.id, fullBuild);

    // Add to queue if status is queued
    if (build.status === 'queued') {
      this.buildQueue.push(build.id);
    }

    return fullBuild;
  }

  async updateBuild(buildId: string, updates: Partial<Omit<Build, 'id' | 'deploymentId' | 'queuedAt'>>): Promise<Build> {
    const build = this.builds.get(buildId);
    if (!build) {
      throw new Error(`Build ${buildId} not found`);
    }

    const updatedBuild: Build = {
      ...build,
      ...updates,
    };

    this.builds.set(buildId, updatedBuild);
    return updatedBuild;
  }

  async updateBuildStatus(buildId: string, status: BuildStatus, errorMessage?: string): Promise<Build> {
    const updates: Partial<Build> = { status };

    if (status === 'building') {
      updates.startedAt = new Date();
    } else if (status === 'succeeded' || status === 'failed' || status === 'cancelled') {
      updates.completedAt = new Date();
    }

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    return this.updateBuild(buildId, updates);
  }

  async appendBuildLogs(buildId: string, logs: string): Promise<void> {
    const build = this.builds.get(buildId);
    if (build) {
      build.logs += logs;
      this.builds.set(buildId, build);
    }
  }

  async dequeueNextBuild(): Promise<Build | null> {
    const buildId = this.buildQueue.shift();
    if (!buildId) return null;

    const build = this.builds.get(buildId);
    return build ?? null;
  }

  // ============================================================================
  // Running Server Operations
  // ============================================================================

  async getRunningServer(serverId: string): Promise<RunningServer | null> {
    return this.runningServers.get(serverId) ?? null;
  }

  async getRunningServerForDeployment(deploymentId: string): Promise<RunningServer | null> {
    for (const server of this.runningServers.values()) {
      if (server.deploymentId === deploymentId && !server.stoppedAt) {
        return server;
      }
    }
    return null;
  }

  async listRunningServers(): Promise<RunningServer[]> {
    return Array.from(this.runningServers.values()).filter(s => !s.stoppedAt);
  }

  async createRunningServer(server: Omit<RunningServer, 'stoppedAt'>): Promise<RunningServer> {
    const fullServer: RunningServer = {
      ...server,
      stoppedAt: null,
    };

    this.runningServers.set(server.id, fullServer);
    return fullServer;
  }

  async updateRunningServer(
    serverId: string,
    updates: Partial<Omit<RunningServer, 'id' | 'deploymentId' | 'buildId' | 'startedAt'>>,
  ): Promise<RunningServer> {
    const server = this.runningServers.get(serverId);
    if (!server) {
      throw new Error(`Running server ${serverId} not found`);
    }

    const updatedServer: RunningServer = {
      ...server,
      ...updates,
    };

    this.runningServers.set(serverId, updatedServer);
    return updatedServer;
  }

  async stopRunningServer(serverId: string): Promise<void> {
    const server = this.runningServers.get(serverId);
    if (server) {
      server.stoppedAt = new Date();
      this.runningServers.set(serverId, server);
    }
  }

  // ============================================================================
  // RBAC Operations
  // ============================================================================

  async getUserPermissionsForTeam(userId: string, teamId: string): Promise<string[]> {
    const member = await this.getTeamMember(teamId, userId);
    if (!member) return [];

    // Return permissions based on role
    // This is a simplified version; the real implementation would use the RBAC manager
    const rolePermissions: Record<string, string[]> = {
      owner: ['*'],
      admin: [
        'team:read', 'team:update',
        'member:read', 'member:create', 'member:delete',
        'invite:read', 'invite:create', 'invite:delete',
        'project:read', 'project:create', 'project:update', 'project:delete',
        'deployment:read', 'deployment:create', 'deployment:update', 'deployment:delete', 'deployment:deploy',
        'build:read', 'build:delete',
        'env_var:read', 'env_var:update', 'env_var:delete',
      ],
      developer: [
        'team:read',
        'member:read',
        'project:read',
        'deployment:read', 'deployment:create', 'deployment:deploy',
        'build:read',
        'env_var:read', 'env_var:update',
      ],
      viewer: [
        'team:read',
        'member:read',
        'project:read',
        'deployment:read',
        'build:read',
        'env_var:read',
      ],
    };

    return rolePermissions[member.role] ?? [];
  }

  async userHasPermission(userId: string, teamId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissionsForTeam(userId, teamId);
    return permissions.includes('*') || permissions.includes(permission);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private paginate<T>(items: T[], pagination?: PaginationParams): PaginatedResult<T> {
    const page = pagination?.page ?? 1;
    const perPage = pagination?.perPage ?? 20;
    const start = (page - 1) * perPage;
    const end = start + perPage;

    return {
      data: items.slice(start, end),
      total: items.length,
      page,
      perPage,
      hasMore: end < items.length,
    };
  }
}
