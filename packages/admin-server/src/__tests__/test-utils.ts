/**
 * Test utilities and mocks for @mastra/admin-server tests.
 */

import type {
  MastraAdmin,
  AdminStorage,
  AdminAuthProvider,
  BuildOrchestrator,
  RBACManager,
  LicenseValidator,
  EncryptionProvider,
  AdminLogger,
  User,
  Team,
  TeamMember,
  Permission,
  Project,
  Deployment,
  Build,
  RunningServer,
  TeamRole,
  LicenseInfo,
} from '@mastra/admin';
import { vi } from 'vitest';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Create a mock user.
 */
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

/**
 * Create a mock team.
 */
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

/**
 * Create a mock team member.
 */
export function createMockTeamMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 'member-123',
    teamId: 'team-123',
    userId: 'user-123',
    role: 'developer' as TeamRole,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

/**
 * Create a mock project.
 */
export function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-123',
    teamId: 'team-123',
    name: 'Test Project',
    slug: 'test-project',
    sourceType: 'local' as const,
    sourceConfig: { path: '/projects/test' },
    defaultBranch: 'main',
    envVars: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

/**
 * Create a mock deployment.
 */
export function createMockDeployment(overrides: Partial<Deployment> = {}): Deployment {
  return {
    id: 'deployment-123',
    projectId: 'project-123',
    type: 'production' as const,
    branch: 'main',
    slug: 'main--test-project',
    status: 'running' as const,
    currentBuildId: 'build-123',
    publicUrl: 'https://test.example.com',
    internalHost: 'localhost:3001',
    envVarOverrides: [],
    autoShutdown: false,
    expiresAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

/**
 * Create a mock build.
 */
export function createMockBuild(overrides: Partial<Build> = {}): Build {
  return {
    id: 'build-123',
    deploymentId: 'deployment-123',
    trigger: 'manual' as const,
    triggeredBy: 'user-123',
    commitSha: 'abc123',
    commitMessage: 'Test commit',
    status: 'succeeded' as const,
    logs: 'Build completed successfully',
    queuedAt: new Date('2024-01-01'),
    startedAt: new Date('2024-01-01'),
    completedAt: new Date('2024-01-01'),
    errorMessage: null,
    ...overrides,
  };
}

/**
 * Create a mock running server.
 */
export function createMockRunningServer(overrides: Partial<RunningServer> = {}): RunningServer {
  return {
    id: 'server-123',
    deploymentId: 'deployment-123',
    buildId: 'build-123',
    processId: 12345,
    containerId: null,
    host: 'localhost',
    port: 3001,
    healthStatus: 'healthy' as const,
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

/**
 * Create a mock AdminStorage instance.
 */
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
    getTeamMember: vi.fn().mockResolvedValue(createMockTeamMember()),
    addTeamMember: vi.fn().mockImplementation(async (data) => ({ ...createMockTeamMember(), ...data })),
    updateTeamMember: vi.fn().mockImplementation(async (teamId, userId, data) => ({
      ...createMockTeamMember(),
      teamId,
      userId,
      ...data,
    })),
    removeTeamMember: vi.fn().mockResolvedValue(undefined),
    listTeamMembers: vi.fn().mockResolvedValue({
      data: [{ ...createMockTeamMember(), user: createMockUser() }],
      total: 1,
      limit: 10,
      offset: 0,
    }),

    // Team invite methods
    getTeamInvite: vi.fn().mockResolvedValue(null),
    getTeamInviteByEmail: vi.fn().mockResolvedValue(null),
    createTeamInvite: vi.fn().mockImplementation(async (data) => ({
      id: 'invite-123',
      ...data,
      createdAt: new Date(),
    })),
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
    setProjectEnvVar: vi.fn().mockImplementation(async (projectId, data) => ({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    deleteProjectEnvVar: vi.fn().mockResolvedValue(undefined),

    // Deployment methods
    getDeployment: vi.fn().mockResolvedValue(createMockDeployment()),
    createDeployment: vi.fn().mockImplementation(async (data) => ({ ...createMockDeployment(), ...data })),
    updateDeployment: vi.fn().mockImplementation(async (id, data) => ({ ...createMockDeployment(), id, ...data })),
    updateDeploymentStatus: vi.fn().mockResolvedValue(undefined),
    deleteDeployment: vi.fn().mockResolvedValue(undefined),
    listDeploymentsForProject: vi.fn().mockResolvedValue({
      data: [createMockDeployment()],
      total: 1,
      limit: 10,
      offset: 0,
    }),

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
    updateRunningServer: vi.fn().mockImplementation(async (id, data) => ({
      ...createMockRunningServer(),
      id,
      ...data,
    })),
    deleteRunningServer: vi.fn().mockResolvedValue(undefined),
    listRunningServers: vi.fn().mockResolvedValue([createMockRunningServer()]),
  } as unknown as AdminStorage;
}

// ============================================================================
// Mock Auth Provider
// ============================================================================

/**
 * Create a mock AdminAuthProvider instance.
 */
export function createMockAuthProvider(): AdminAuthProvider {
  return {
    validateToken: vi.fn().mockResolvedValue({ userId: 'user-123' }),
    getUser: vi.fn().mockResolvedValue({ id: 'user-123', email: 'test@example.com', name: 'Test User' }),
  };
}

// ============================================================================
// Mock Build Orchestrator
// ============================================================================

/**
 * Create a mock BuildOrchestrator instance.
 */
export function createMockOrchestrator(): BuildOrchestrator {
  return {
    queueBuild: vi.fn().mockResolvedValue(undefined),
    processNextBuild: vi.fn().mockResolvedValue(true),
    cancelBuild: vi.fn().mockResolvedValue(undefined),
    stopDeployment: vi.fn().mockResolvedValue(undefined),
    getQueueStatus: vi.fn().mockReturnValue([]),
    shutdown: vi.fn().mockResolvedValue(undefined),
  } as unknown as BuildOrchestrator;
}

// ============================================================================
// Mock RBAC Manager
// ============================================================================

/**
 * Create a mock RBACManager instance.
 */
export function createMockRBAC(): RBACManager {
  return {
    getUserPermissions: vi.fn().mockResolvedValue(['team:read', 'project:read'] as Permission[]),
    hasPermission: vi.fn().mockResolvedValue(true),
    assertPermission: vi.fn().mockResolvedValue(undefined),
    getRolePermissions: vi.fn().mockReturnValue(['team:read', 'project:read']),
  } as unknown as RBACManager;
}

// ============================================================================
// Mock License Validator
// ============================================================================

/**
 * Create a mock LicenseValidator instance.
 */
export function createMockLicense(): LicenseValidator {
  return {
    validate: vi.fn().mockResolvedValue(undefined),
    isValid: vi.fn().mockReturnValue(true),
    getLicenseInfo: vi.fn().mockReturnValue({
      valid: true,
      tier: 'community',
      maxTeams: 100,
      maxUsersPerTeam: 100,
      maxProjects: 100,
      features: [],
      expiresAt: null,
    } as LicenseInfo),
    hasFeature: vi.fn().mockReturnValue(true),
    canCreateTeam: vi.fn().mockReturnValue(true),
    canCreateProject: vi.fn().mockReturnValue(true),
  } as unknown as LicenseValidator;
}

// ============================================================================
// Mock Encryption Provider
// ============================================================================

/**
 * Create a mock EncryptionProvider instance.
 */
export function createMockEncryption(): EncryptionProvider {
  return {
    encrypt: vi.fn().mockImplementation(async (value: string) => `encrypted:${value}`),
    decrypt: vi.fn().mockImplementation(async (value: string) => value.replace('encrypted:', '')),
  } as unknown as EncryptionProvider;
}

// ============================================================================
// Mock Logger
// ============================================================================

/**
 * Create a mock AdminLogger instance.
 */
export function createMockLogger(): AdminLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

// ============================================================================
// Mock MastraAdmin
// ============================================================================

/**
 * Create a mock MastraAdmin instance with all dependencies mocked.
 */
export function createMockMastraAdmin(overrides: Partial<ReturnType<typeof createMockMastraAdminComponents>> = {}) {
  const components = {
    storage: createMockStorage(),
    auth: createMockAuthProvider(),
    orchestrator: createMockOrchestrator(),
    rbac: createMockRBAC(),
    license: createMockLicense(),
    encryption: createMockEncryption(),
    logger: createMockLogger(),
    ...overrides,
  };

  const admin = {
    init: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),

    // Getters
    getAuth: vi.fn().mockReturnValue(components.auth),
    getStorage: vi.fn().mockReturnValue(components.storage),
    getLicense: vi.fn().mockReturnValue(components.license),
    getLicenseInfo: vi.fn().mockReturnValue({
      valid: true,
      tier: 'community',
      maxTeams: 100,
      maxUsersPerTeam: 100,
      maxProjects: 100,
      features: [],
      expiresAt: null,
    }),
    getRBAC: vi.fn().mockReturnValue(components.rbac),
    getOrchestrator: vi.fn().mockReturnValue(components.orchestrator),
    getEncryption: vi.fn().mockReturnValue(components.encryption),
    hasFeature: vi.fn().mockReturnValue(true),
    getLogger: vi.fn().mockReturnValue(components.logger),

    // Business logic methods (delegate to storage/components)
    getUser: vi.fn().mockResolvedValue(createMockUser()),
    getUserByEmail: vi.fn().mockResolvedValue(createMockUser()),
    createTeam: vi.fn().mockResolvedValue(createMockTeam()),
    getTeam: vi.fn().mockResolvedValue(createMockTeam()),
    listTeams: vi.fn().mockResolvedValue({ data: [createMockTeam()], total: 1, limit: 10, offset: 0 }),
    inviteMember: vi.fn().mockResolvedValue({ id: 'invite-123' }),
    getTeamMembers: vi.fn().mockResolvedValue({
      data: [{ ...createMockTeamMember(), user: createMockUser() }],
      total: 1,
      limit: 10,
      offset: 0,
    }),
    removeMember: vi.fn().mockResolvedValue(undefined),
    createProject: vi.fn().mockResolvedValue(createMockProject()),
    getProject: vi.fn().mockResolvedValue(createMockProject()),
    listProjects: vi.fn().mockResolvedValue({ data: [createMockProject()], total: 1, limit: 10, offset: 0 }),
    setEnvVar: vi.fn().mockResolvedValue({ key: 'TEST', encryptedValue: 'val', isSecret: false }),
    getEnvVars: vi.fn().mockResolvedValue([]),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    createDeployment: vi.fn().mockResolvedValue(createMockDeployment()),
    getDeployment: vi.fn().mockResolvedValue(createMockDeployment()),
    listDeployments: vi.fn().mockResolvedValue({ data: [createMockDeployment()], total: 1, limit: 10, offset: 0 }),
    deploy: vi.fn().mockResolvedValue(createMockBuild()),
    stop: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(createMockBuild()),
    getBuild: vi.fn().mockResolvedValue(createMockBuild()),
    listBuilds: vi.fn().mockResolvedValue({ data: [createMockBuild()], total: 1, limit: 10, offset: 0 }),
    cancelBuild: vi.fn().mockResolvedValue(undefined),
    getRunningServer: vi.fn().mockResolvedValue(createMockRunningServer()),
  } as unknown as MastraAdmin;

  return admin;
}

/**
 * Helper to get component mocks from MastraAdmin.
 */
export function createMockMastraAdminComponents() {
  return {
    storage: createMockStorage(),
    auth: createMockAuthProvider(),
    orchestrator: createMockOrchestrator(),
    rbac: createMockRBAC(),
    license: createMockLicense(),
    encryption: createMockEncryption(),
    logger: createMockLogger(),
  };
}

// ============================================================================
// Hono Test Helpers
// ============================================================================

/**
 * Mock Hono context interface for testing.
 */
export interface MockHonoContext {
  req: {
    path: string;
    method: string;
    header: (name: string) => string | undefined;
    query: (name?: string) => string | Record<string, string> | undefined;
    param: (name?: string) => string | Record<string, string> | undefined;
    json: () => Promise<unknown>;
    raw: { signal: AbortSignal };
  };
  res: { status: number };
  json: (data: unknown, status?: number) => Response;
  header: (name: string, value: string) => void;
  set: (key: string, value: unknown) => void;
  get: (key: string) => unknown;
}

/**
 * Create a mock Hono context for testing middleware.
 */
export function createMockHonoContext(options: {
  path?: string;
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  params?: Record<string, string>;
  body?: unknown;
  variables?: Record<string, unknown>;
} = {}): MockHonoContext {
  const variables: Record<string, unknown> = { ...options.variables };

  const context: MockHonoContext = {
    req: {
      path: options.path ?? '/api/test',
      method: options.method ?? 'GET',
      header: vi.fn().mockImplementation((name: string) => options.headers?.[name]) as (
        name: string,
      ) => string | undefined,
      query: vi.fn().mockImplementation((name?: string) => {
        if (name) return options.query?.[name];
        return options.query ?? {};
      }) as (name?: string) => string | Record<string, string> | undefined,
      param: vi.fn().mockImplementation((name?: string) => {
        if (name) return options.params?.[name];
        return options.params ?? {};
      }) as (name?: string) => string | Record<string, string> | undefined,
      json: vi.fn().mockResolvedValue(options.body ?? {}) as () => Promise<unknown>,
      raw: {
        signal: new AbortController().signal,
      },
    },
    res: {
      status: 200,
    },
    json: vi.fn().mockImplementation((data: unknown, status?: number) => {
      return new Response(JSON.stringify(data), {
        status: status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as (data: unknown, status?: number) => Response,
    header: vi.fn() as (name: string, value: string) => void,
    set: vi.fn().mockImplementation((key: string, value: unknown) => {
      variables[key] = value;
    }) as (key: string, value: unknown) => void,
    get: vi.fn().mockImplementation((key: string) => variables[key]) as (key: string) => unknown,
  };

  return context;
}

/**
 * Mock next function type.
 */
export type MockNext = () => Promise<void>;

/**
 * Create a mock next function for middleware testing.
 */
export function createMockNext(): MockNext {
  return vi.fn().mockResolvedValue(undefined) as unknown as MockNext;
}
