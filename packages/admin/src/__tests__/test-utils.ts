/**
 * Test utilities and mocks for @mastra/admin tests.
 */

import { vi } from 'vitest';

import type { EncryptionProvider } from '../encryption/base';
import type { EdgeRouterProvider, RouteConfig, RouteInfo } from '../router/base';
import type { ProjectRunner, BuildOptions, RunOptions, LogStreamCallback } from '../runner/base';
import type { ProjectSourceProvider, ProjectSource, ChangeEvent } from '../source/base';
import type { AdminStorage } from '../storage/base';
import type {
  Build,
  Deployment,
  Project,
  RunningServer,
  Team,
  TeamMember,
  User,
} from '../types';

// ============================================================================
// Mock Data Factories
// ============================================================================

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function createMockTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-123',
    name: 'Test Team',
    slug: 'test-team',
    settings: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-123',
    teamId: 'team-123',
    name: 'Test Project',
    slug: 'test-project',
    sourceType: 'local',
    sourceConfig: { path: '/projects/test' },
    defaultBranch: 'main',
    envVars: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function createMockDeployment(overrides: Partial<Deployment> = {}): Deployment {
  return {
    id: 'deployment-123',
    projectId: 'project-123',
    type: 'production',
    branch: 'main',
    slug: 'main--test-project',
    status: 'pending',
    currentBuildId: null,
    publicUrl: null,
    internalHost: null,
    envVarOverrides: [],
    autoShutdown: false,
    expiresAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function createMockBuild(overrides: Partial<Build> = {}): Build {
  return {
    id: 'build-123',
    deploymentId: 'deployment-123',
    trigger: 'manual',
    triggeredBy: 'user-123',
    commitSha: 'abc123',
    commitMessage: 'Test commit',
    status: 'queued',
    logs: '',
    queuedAt: new Date('2024-01-01'),
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    ...overrides,
  };
}

export function createMockRunningServer(overrides: Partial<RunningServer> = {}): RunningServer {
  return {
    id: 'server-123',
    deploymentId: 'deployment-123',
    buildId: 'build-123',
    processId: 12345,
    containerId: null,
    host: 'localhost',
    port: 4111,
    healthStatus: 'healthy',
    lastHealthCheck: new Date('2024-01-01'),
    memoryUsageMb: 128,
    cpuPercent: 10,
    startedAt: new Date('2024-01-01'),
    stoppedAt: null,
    ...overrides,
  };
}

// ============================================================================
// Mock Storage
// ============================================================================

export function createMockStorage(): AdminStorage {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),

    // User methods
    getUser: vi.fn().mockResolvedValue(createMockUser()),
    getUserByEmail: vi.fn().mockResolvedValue(createMockUser()),
    createUser: vi.fn().mockImplementation(async (data) => ({ ...createMockUser(), ...data })),
    updateUser: vi.fn().mockImplementation(async (id, data) => ({ ...createMockUser(), id, ...data })),
    deleteUser: vi.fn().mockResolvedValue(undefined),

    // Team methods
    getTeam: vi.fn().mockResolvedValue(createMockTeam()),
    getTeamBySlug: vi.fn().mockResolvedValue(null),
    createTeam: vi.fn().mockImplementation(async (data) => ({ ...createMockTeam(), ...data })),
    updateTeam: vi.fn().mockImplementation(async (id, data) => ({ ...createMockTeam(), id, ...data })),
    deleteTeam: vi.fn().mockResolvedValue(undefined),
    listTeamsForUser: vi.fn().mockResolvedValue({ data: [createMockTeam()], total: 1, limit: 10, offset: 0 }),

    // Team member methods
    getTeamMember: vi.fn().mockResolvedValue(null),
    addTeamMember: vi.fn().mockImplementation(async (data) => data),
    updateTeamMember: vi.fn().mockResolvedValue(undefined),
    removeTeamMember: vi.fn().mockResolvedValue(undefined),
    listTeamMembers: vi.fn().mockResolvedValue({ data: [], total: 0, limit: 10, offset: 0 }),

    // Team invite methods
    getTeamInvite: vi.fn().mockResolvedValue(null),
    getTeamInviteByEmail: vi.fn().mockResolvedValue(null),
    createTeamInvite: vi.fn().mockImplementation(async (data) => ({ id: 'invite-123', ...data, createdAt: new Date() })),
    deleteTeamInvite: vi.fn().mockResolvedValue(undefined),
    listTeamInvites: vi.fn().mockResolvedValue({ data: [], total: 0, limit: 10, offset: 0 }),

    // Project methods
    getProject: vi.fn().mockResolvedValue(createMockProject()),
    getProjectBySlug: vi.fn().mockResolvedValue(null),
    createProject: vi.fn().mockImplementation(async (data) => ({ ...createMockProject(), ...data })),
    updateProject: vi.fn().mockImplementation(async (id, data) => ({ ...createMockProject(), id, ...data })),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    listProjectsForTeam: vi.fn().mockResolvedValue({ data: [createMockProject()], total: 1, limit: 10, offset: 0 }),

    // Project env vars
    getProjectEnvVars: vi.fn().mockResolvedValue([]),
    setProjectEnvVar: vi.fn().mockResolvedValue(undefined),
    deleteProjectEnvVar: vi.fn().mockResolvedValue(undefined),

    // Deployment methods
    getDeployment: vi.fn().mockResolvedValue(createMockDeployment()),
    createDeployment: vi.fn().mockImplementation(async (data) => ({ ...createMockDeployment(), ...data })),
    updateDeployment: vi.fn().mockImplementation(async (id, data) => ({ ...createMockDeployment(), id, ...data })),
    updateDeploymentStatus: vi.fn().mockResolvedValue(undefined),
    deleteDeployment: vi.fn().mockResolvedValue(undefined),
    listDeploymentsForProject: vi.fn().mockResolvedValue({ data: [createMockDeployment()], total: 1, limit: 10, offset: 0 }),

    // Build methods
    getBuild: vi.fn().mockResolvedValue(createMockBuild()),
    createBuild: vi.fn().mockImplementation(async (data) => ({ ...createMockBuild(), ...data })),
    updateBuild: vi.fn().mockImplementation(async (id, data) => ({ ...createMockBuild(), id, ...data })),
    updateBuildStatus: vi.fn().mockResolvedValue(undefined),
    appendBuildLogs: vi.fn().mockResolvedValue(undefined),
    listBuildsForDeployment: vi.fn().mockResolvedValue({ data: [createMockBuild()], total: 1, limit: 10, offset: 0 }),

    // Running server methods
    getRunningServer: vi.fn().mockResolvedValue(createMockRunningServer()),
    getRunningServerForDeployment: vi.fn().mockResolvedValue(createMockRunningServer()),
    createRunningServer: vi.fn().mockImplementation(async (data) => ({ ...createMockRunningServer(), ...data })),
    updateRunningServer: vi.fn().mockImplementation(async (id, data) => ({ ...createMockRunningServer(), id, ...data })),
    stopRunningServer: vi.fn().mockResolvedValue(undefined),
    deleteRunningServer: vi.fn().mockResolvedValue(undefined),
    listRunningServers: vi.fn().mockResolvedValue([createMockRunningServer()]),
  } as unknown as AdminStorage;
}

// ============================================================================
// Mock Encryption Provider
// ============================================================================

export function createMockEncryption(): EncryptionProvider {
  return {
    encrypt: vi.fn().mockImplementation(async (value: string) => `encrypted:${value}`),
    decrypt: vi.fn().mockImplementation(async (value: string) => value.replace('encrypted:', '')),
  };
}

// ============================================================================
// Mock Project Source Provider
// ============================================================================

export function createMockSource(): ProjectSourceProvider {
  return {
    type: 'local',
    listProjects: vi.fn().mockResolvedValue([]),
    getProject: vi.fn().mockImplementation(async (projectId: string) => ({
      id: projectId,
      name: 'Test Project',
      type: 'local',
      path: '/projects/test',
    })),
    validateAccess: vi.fn().mockResolvedValue(true),
    getProjectPath: vi.fn().mockImplementation(async (source: ProjectSource) => source.path),
    watchChanges: vi.fn().mockReturnValue(() => {}),
  };
}

// ============================================================================
// Mock Project Runner
// ============================================================================

export function createMockRunner(): ProjectRunner {
  const runner: ProjectRunner = {
    type: 'local',
    setSource: vi.fn(),
    build: vi.fn().mockImplementation(async (project: Project, build: Build) => ({
      ...build,
      status: 'succeeded' as const,
      completedAt: new Date(),
    })),
    deploy: vi.fn().mockImplementation(async () => createMockRunningServer()),
    stop: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
    getLogs: vi.fn().mockResolvedValue(''),
    streamLogs: vi.fn().mockReturnValue(() => {}),
    getResourceUsage: vi.fn().mockResolvedValue({ memoryUsageMb: 128, cpuPercent: 10 }),
  };
  return runner;
}

// ============================================================================
// Mock Edge Router Provider
// ============================================================================

export function createMockRouter(): EdgeRouterProvider {
  return {
    type: 'local',
    registerRoute: vi.fn().mockImplementation(async (config: RouteConfig) => ({
      routeId: 'route-123',
      deploymentId: config.deploymentId,
      projectId: config.projectId,
      subdomain: config.subdomain,
      publicUrl: `http://${config.subdomain}.localhost`,
      targetHost: config.targetHost,
      targetPort: config.targetPort,
      status: 'active' as const,
      tls: false,
      createdAt: new Date(),
    })),
    removeRoute: vi.fn().mockResolvedValue(undefined),
    getRoute: vi.fn().mockResolvedValue(null),
    listRoutes: vi.fn().mockResolvedValue([]),
    getRouteHealth: vi.fn().mockResolvedValue({ status: 'healthy' as const }),
  };
}
