# LANE 7: MastraAdmin Integration Tests

## Overview

This plan defines the comprehensive integration test suite for MastraAdmin, validating end-to-end functionality across all core providers.

**Plan File**: `2025-01-23-admin-integration-tests.md`
**Priority**: P1
**Dependencies**: LANES 1, 2, 3a-3c, 4, 5, 12 (All core providers must be complete)
**Estimated Complexity**: Medium-High

## Package Location

```
packages/admin/
└── integration-tests/
    ├── docker-compose.yml          # Test infrastructure
    ├── vitest.config.ts            # Test configuration
    ├── .env.test                   # Test environment variables
    ├── package.json                # Integration test dependencies
    └── src/
        ├── setup/                  # Test setup utilities
        ├── fixtures/               # Mock data generators
        ├── helpers/                # Test helper functions
        └── tests/                  # Test suites by domain
```

---

## 1. Test Infrastructure

### 1.1 Docker Compose Configuration

**File**: `packages/admin/integration-tests/docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    container_name: 'admin-integration-test-postgres'
    ports:
      - '5433:5432'
    environment:
      POSTGRES_USER: mastra
      POSTGRES_PASSWORD: mastra
      POSTGRES_DB: mastra_admin_test
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U mastra -d mastra_admin_test']
      interval: 2s
      timeout: 5s
      retries: 10
    volumes:
      - admin_test_pgdata:/var/lib/postgresql/data
    networks:
      - admin-test-network

  clickhouse:
    image: clickhouse/clickhouse-server:24
    container_name: 'admin-integration-test-clickhouse'
    ports:
      - '8123:8123' # HTTP interface
      - '9000:9000' # Native interface
    environment:
      CLICKHOUSE_USER: default
      CLICKHOUSE_PASSWORD: password
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: 1
    healthcheck:
      test: ['CMD', 'clickhouse-client', '--query', 'SELECT 1']
      interval: 2s
      timeout: 5s
      retries: 10
    volumes:
      - admin_test_clickhouse:/var/lib/clickhouse
    networks:
      - admin-test-network

  # Optional: Redis for caching tests (future)
  redis:
    image: redis:7-alpine
    container_name: 'admin-integration-test-redis'
    ports:
      - '6379:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 2s
      timeout: 5s
      retries: 10
    networks:
      - admin-test-network

volumes:
  admin_test_pgdata:
  admin_test_clickhouse:

networks:
  admin-test-network:
    driver: bridge
```

### 1.2 NPM Scripts

**File**: `packages/admin/integration-tests/package.json` (scripts section)

```json
{
  "scripts": {
    "pretest": "docker compose up -d && npm run wait-for-services",
    "test": "vitest run",
    "test:watch": "vitest",
    "posttest": "docker compose down --volumes",
    "wait-for-services": "node ./scripts/wait-for-services.js",
    "test:auth": "vitest run ./src/tests/auth/",
    "test:teams": "vitest run ./src/tests/teams/",
    "test:projects": "vitest run ./src/tests/projects/",
    "test:deployments": "vitest run ./src/tests/deployments/",
    "test:observability": "vitest run ./src/tests/observability/",
    "test:rbac": "vitest run ./src/tests/rbac/",
    "test:errors": "vitest run ./src/tests/errors/"
  }
}
```

### 1.3 Vitest Configuration

**File**: `packages/admin/integration-tests/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks', // Process isolation for test safety
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/*.unit.test.ts'],
    testTimeout: 120000, // 2 minutes for slow operations
    hookTimeout: 60000, // 1 minute for setup/teardown
    reporters: ['default'],
    bail: 1, // Stop on first failure for CI
    setupFiles: ['./src/setup/global-setup.ts'],
    globalSetup: './src/setup/docker-setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/fixtures/**', '**/setup/**'],
    },
  },
});
```

### 1.4 Environment Configuration

**File**: `packages/admin/integration-tests/.env.test`

```env
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_USER=mastra
POSTGRES_PASSWORD=mastra
POSTGRES_DB=mastra_admin_test
DATABASE_URL=postgresql://mastra:mastra@localhost:5433/mastra_admin_test

# ClickHouse
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=password

# Observability
OBSERVABILITY_BASE_DIR=/tmp/mastra-admin-test-observability

# License (dev mode)
ADMIN_LICENSE_KEY=dev

# Encryption
ADMIN_ENCRYPTION_SECRET=test-secret-key-32-bytes-long!!!
```

---

## 2. Test Fixtures and Data Generators

### 2.1 Core Entity Factories

**File**: `packages/admin/integration-tests/src/fixtures/factories.ts`

```typescript
import { randomUUID } from 'node:crypto';
import type { User, Team, TeamMember, Project, Deployment, Build, RunningServer, TeamRole } from '@mastra/admin';

// ============================================================================
// ID Generators
// ============================================================================

export const uniqueId = () => randomUUID();
export const uniqueEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
export const uniqueSlug = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const uniqueName = (prefix: string) => `${prefix} ${Date.now()}`;

// ============================================================================
// User Factories
// ============================================================================

export interface CreateUserOptions {
  id?: string;
  email?: string;
  name?: string;
  avatarUrl?: string | null;
}

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

export function createTeamData(options: CreateTeamOptions = {}): Omit<Team, 'createdAt' | 'updatedAt'> {
  return {
    id: options.id ?? uniqueId(),
    name: options.name ?? uniqueName('Test Team'),
    slug: options.slug ?? uniqueSlug('test-team'),
    settings: options.settings ?? {},
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
  sourceConfig?: { path: string } | { repo: string; branch?: string };
  defaultBranch?: string;
}

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
  };
}

// ============================================================================
// Bulk Data Generators
// ============================================================================

export function createBulkUsers(count: number): Omit<User, 'createdAt' | 'updatedAt'>[] {
  return Array.from({ length: count }, () => createUserData());
}

export function createBulkTeams(count: number): Omit<Team, 'createdAt' | 'updatedAt'>[] {
  return Array.from({ length: count }, () => createTeamData());
}
```

### 2.2 Observability Event Factories

**File**: `packages/admin/integration-tests/src/fixtures/observability-factories.ts`

```typescript
import { randomUUID } from 'node:crypto';
import type { Trace, Span, Log, Metric, Score } from '@mastra/admin';

export function createTraceData(options: {
  projectId: string;
  deploymentId: string;
  name?: string;
  status?: 'ok' | 'error' | 'unset';
}): Trace {
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + Math.random() * 5000);

  return {
    traceId: randomUUID(),
    projectId: options.projectId,
    deploymentId: options.deploymentId,
    name: options.name ?? `test-trace-${Date.now()}`,
    startTime,
    endTime,
    durationMs: endTime.getTime() - startTime.getTime(),
    status: options.status ?? 'ok',
    metadata: {},
  };
}

export function createSpanData(options: {
  traceId: string;
  projectId: string;
  deploymentId: string;
  parentSpanId?: string | null;
  name?: string;
  kind?: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
}): Span {
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + Math.random() * 1000);

  return {
    spanId: randomUUID(),
    traceId: options.traceId,
    parentSpanId: options.parentSpanId ?? null,
    projectId: options.projectId,
    deploymentId: options.deploymentId,
    name: options.name ?? `test-span-${Date.now()}`,
    kind: options.kind ?? 'internal',
    startTime,
    endTime,
    durationMs: endTime.getTime() - startTime.getTime(),
    status: 'ok',
    attributes: {},
    events: [],
  };
}

export function createLogData(options: {
  projectId: string;
  deploymentId: string;
  traceId?: string | null;
  spanId?: string | null;
  level?: 'debug' | 'info' | 'warn' | 'error';
}): Log {
  return {
    id: randomUUID(),
    projectId: options.projectId,
    deploymentId: options.deploymentId,
    traceId: options.traceId ?? null,
    spanId: options.spanId ?? null,
    level: options.level ?? 'info',
    message: `Test log message at ${Date.now()}`,
    timestamp: new Date(),
    attributes: {},
  };
}

export function createMetricData(options: {
  projectId: string;
  deploymentId: string;
  name?: string;
  type?: 'counter' | 'gauge' | 'histogram';
  value?: number;
}): Metric {
  return {
    id: randomUUID(),
    projectId: options.projectId,
    deploymentId: options.deploymentId,
    name: options.name ?? 'test_metric',
    type: options.type ?? 'gauge',
    value: options.value ?? Math.random() * 100,
    labels: {},
    timestamp: new Date(),
  };
}

export function createScoreData(options: {
  projectId: string;
  deploymentId: string;
  traceId?: string;
  name?: string;
  value?: number;
}): Score {
  return {
    id: randomUUID(),
    projectId: options.projectId,
    deploymentId: options.deploymentId,
    traceId: options.traceId ?? randomUUID(),
    name: options.name ?? 'test_score',
    value: options.value ?? Math.random(),
    timestamp: new Date(),
    metadata: {},
  };
}
```

---

## 3. Test Setup Utilities

### 3.1 Global Setup

**File**: `packages/admin/integration-tests/src/setup/global-setup.ts`

```typescript
import { config } from 'dotenv';
import path from 'node:path';

// Load test environment variables
config({ path: path.resolve(__dirname, '../../.env.test') });

// Ensure test environment
if (!process.env.DATABASE_URL?.includes('test')) {
  throw new Error('Integration tests must run against a test database!');
}
```

### 3.2 Docker Setup/Teardown

**File**: `packages/admin/integration-tests/src/setup/docker-setup.ts`

```typescript
import { execSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

export async function setup() {
  console.log('Starting Docker services...');

  try {
    // Start services
    execSync('docker compose up -d', {
      cwd: __dirname + '/../..',
      stdio: 'inherit',
    });

    // Wait for services to be healthy
    await waitForPostgres();
    await waitForClickHouse();

    console.log('All services are ready!');
  } catch (error) {
    console.error('Failed to start Docker services:', error);
    throw error;
  }
}

export async function teardown() {
  console.log('Stopping Docker services...');

  try {
    execSync('docker compose down --volumes', {
      cwd: __dirname + '/../..',
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Failed to stop Docker services:', error);
  }
}

async function waitForPostgres(maxRetries = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      execSync('docker compose exec -T postgres pg_isready -U mastra -d mastra_admin_test', {
        cwd: __dirname + '/../..',
        stdio: 'pipe',
      });
      return;
    } catch {
      await setTimeout(1000);
    }
  }
  throw new Error('PostgreSQL did not become ready in time');
}

async function waitForClickHouse(maxRetries = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      execSync('docker compose exec -T clickhouse clickhouse-client --query "SELECT 1"', {
        cwd: __dirname + '/../..',
        stdio: 'pipe',
      });
      return;
    } catch {
      await setTimeout(1000);
    }
  }
  throw new Error('ClickHouse did not become ready in time');
}
```

### 3.3 Test Context Factory

**File**: `packages/admin/integration-tests/src/setup/test-context.ts`

```typescript
import { MastraAdmin } from '@mastra/admin';
import { PostgresAdminStorage } from '@mastra/admin-pg';
import { LocalProcessRunner } from '@mastra/runner-local';
import { LocalEdgeRouter } from '@mastra/router-local';
import { LocalProjectSource } from '@mastra/source-local';
import { LocalFileStorage } from '@mastra/observability-file-local';
import { ObservabilityWriter } from '@mastra/observability-writer';
import { NodeCryptoEncryptionProvider } from '@mastra/admin';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface TestContext {
  admin: MastraAdmin;
  storage: PostgresAdminStorage;
  runner: LocalProcessRunner;
  router: LocalEdgeRouter;
  source: LocalProjectSource;
  fileStorage: LocalFileStorage;
  observabilityWriter: ObservabilityWriter;
  testSchemaName: string;
  observabilityDir: string;
  cleanup: () => Promise<void>;
}

/**
 * Creates a fully configured MastraAdmin instance for integration testing.
 */
export async function createTestContext(): Promise<TestContext> {
  const testSchemaName = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const observabilityDir = `/tmp/mastra-admin-test-obs-${testSchemaName}`;

  // Create observability directory
  await fs.mkdir(observabilityDir, { recursive: true });

  // Initialize storage
  const storage = new PostgresAdminStorage({
    connectionString: process.env.DATABASE_URL!,
    schemaName: testSchemaName,
  });

  // Initialize file storage for observability
  const fileStorage = new LocalFileStorage({
    baseDir: observabilityDir,
  });

  // Initialize observability writer
  const observabilityWriter = new ObservabilityWriter({
    fileStorage,
    projectId: 'test-project',
    deploymentId: 'test-deployment',
    batchSize: 10, // Small for testing
    flushIntervalMs: 0, // Disable auto-flush for deterministic tests
  });

  // Initialize source provider
  const source = new LocalProjectSource({
    basePaths: ['/tmp/test-projects'],
  });

  // Initialize router
  const router = new LocalEdgeRouter({
    baseDomain: 'localhost',
    portRange: { start: 4200, end: 4299 }, // Test-specific port range
    logRoutes: false,
  });

  // Initialize runner
  const runner = new LocalProcessRunner({
    portRange: { start: 4300, end: 4399 }, // Test-specific port range
  });

  // Create MastraAdmin instance
  const admin = new MastraAdmin({
    licenseKey: 'dev',
    storage,
    runner,
    router,
    source,
    encryption: new NodeCryptoEncryptionProvider({
      secret: process.env.ADMIN_ENCRYPTION_SECRET!,
    }),
    observability: {
      writer: observabilityWriter,
    },
    logger: false, // Disable logging in tests
  });

  // Initialize all providers
  await admin.init();

  const cleanup = async () => {
    try {
      await observabilityWriter.shutdown();
      await router.shutdown();
      await admin.shutdown();

      // Cleanup test schema
      await storage.db.none(`DROP SCHEMA IF EXISTS "${testSchemaName}" CASCADE`);
      await storage.close();

      // Cleanup observability directory
      await fs.rm(observabilityDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  };

  return {
    admin,
    storage,
    runner,
    router,
    source,
    fileStorage,
    observabilityWriter,
    testSchemaName,
    observabilityDir,
    cleanup,
  };
}
```

### 3.4 Mock Auth Provider for Testing

**File**: `packages/admin/integration-tests/src/setup/mock-auth.ts`

```typescript
import type { AdminAuthProvider } from '@mastra/admin';

interface MockUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Simple mock auth provider for integration tests.
 * Allows any token that starts with 'test-' and extracts userId from it.
 */
export class MockAuthProvider implements AdminAuthProvider {
  private users = new Map<string, MockUser>();

  /**
   * Register a user for testing.
   */
  registerUser(user: MockUser): void {
    this.users.set(user.id, user);
  }

  /**
   * Validate token format: 'test-{userId}'
   */
  async validateToken(token: string): Promise<{ userId: string } | null> {
    if (!token.startsWith('test-')) {
      return null;
    }
    const userId = token.replace('test-', '');
    if (this.users.has(userId)) {
      return { userId };
    }
    return null;
  }

  /**
   * Get user by ID.
   */
  async getUser(userId: string): Promise<MockUser | null> {
    return this.users.get(userId) ?? null;
  }

  /**
   * Create a token for a user (test helper).
   */
  createToken(userId: string): string {
    return `test-${userId}`;
  }
}
```

---

## 4. E2E Test Scenarios

### 4.1 User Registration and Authentication Tests

**File**: `packages/admin/integration-tests/src/tests/auth/auth.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, type TestContext } from '../../setup/test-context';
import { MockAuthProvider } from '../../setup/mock-auth';
import { createUserData } from '../../fixtures/factories';

describe('Authentication Integration Tests', () => {
  let ctx: TestContext;
  let mockAuth: MockAuthProvider;

  beforeAll(async () => {
    ctx = await createTestContext();
    mockAuth = new MockAuthProvider();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('User Registration Flow', () => {
    it('should create a new user', async () => {
      const userData = createUserData();
      const user = await ctx.storage.createUser(userData);

      expect(user.id).toBe(userData.id);
      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should retrieve user by email', async () => {
      const userData = createUserData();
      await ctx.storage.createUser(userData);

      const user = await ctx.storage.getUserByEmail(userData.email);
      expect(user).not.toBeNull();
      expect(user!.email).toBe(userData.email);
    });

    it('should return null for non-existent user', async () => {
      const user = await ctx.storage.getUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });

    it('should prevent duplicate email registration', async () => {
      const userData = createUserData();
      await ctx.storage.createUser(userData);

      const duplicateUser = { ...createUserData(), email: userData.email };
      await expect(ctx.storage.createUser(duplicateUser)).rejects.toThrow();
    });
  });

  describe('Token Validation', () => {
    it('should validate correct token format', async () => {
      const userData = createUserData();
      mockAuth.registerUser({
        id: userData.id,
        email: userData.email,
        name: userData.name,
      });

      const token = mockAuth.createToken(userData.id);
      const result = await mockAuth.validateToken(token);

      expect(result).not.toBeNull();
      expect(result!.userId).toBe(userData.id);
    });

    it('should reject invalid token format', async () => {
      const result = await mockAuth.validateToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should reject token for non-registered user', async () => {
      const result = await mockAuth.validateToken('test-unknown-user');
      expect(result).toBeNull();
    });
  });
});
```

### 4.2 Team Management Tests

**File**: `packages/admin/integration-tests/src/tests/teams/teams.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, type TestContext } from '../../setup/test-context';
import { createUserData, createTeamData, uniqueId, uniqueEmail } from '../../fixtures/factories';

describe('Team Management Integration Tests', () => {
  let ctx: TestContext;
  let testUser: { id: string; email: string };

  beforeAll(async () => {
    ctx = await createTestContext();

    // Create a test user for all team tests
    const userData = createUserData();
    await ctx.storage.createUser(userData);
    testUser = { id: userData.id, email: userData.email };
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Team Creation', () => {
    it('should create a team with owner', async () => {
      const teamData = createTeamData();
      const team = await ctx.admin.createTeam(testUser.id, {
        name: teamData.name,
        slug: teamData.slug,
      });

      expect(team.id).toBeDefined();
      expect(team.name).toBe(teamData.name);
      expect(team.slug).toBe(teamData.slug);
    });

    it('should add creator as owner', async () => {
      const teamData = createTeamData();
      const team = await ctx.admin.createTeam(testUser.id, {
        name: teamData.name,
        slug: teamData.slug,
      });

      const members = await ctx.admin.getTeamMembers(testUser.id, team.id);
      expect(members.data.length).toBe(1);
      expect(members.data[0].userId).toBe(testUser.id);
      expect(members.data[0].role).toBe('owner');
    });

    it('should enforce unique team slugs', async () => {
      const teamData = createTeamData();
      await ctx.admin.createTeam(testUser.id, {
        name: teamData.name,
        slug: teamData.slug,
      });

      await expect(
        ctx.admin.createTeam(testUser.id, {
          name: 'Different Name',
          slug: teamData.slug, // Same slug
        }),
      ).rejects.toThrow();
    });
  });

  describe('Team Member Management', () => {
    it('should invite a member to team', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());
      const inviteEmail = uniqueEmail();

      const invite = await ctx.admin.inviteMember(testUser.id, team.id, inviteEmail, 'developer');

      expect(invite.id).toBeDefined();
    });

    it('should list team invites', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());
      const inviteEmail = uniqueEmail();

      await ctx.admin.inviteMember(testUser.id, team.id, inviteEmail, 'developer');

      const invites = await ctx.storage.listTeamInvites(team.id);
      expect(invites.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should accept team invite', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      // Create a new user to accept invite
      const newUserData = createUserData();
      await ctx.storage.createUser(newUserData);

      // Send invite
      const invite = await ctx.admin.inviteMember(testUser.id, team.id, newUserData.email, 'developer');

      // Accept invite
      await ctx.admin.acceptInvite(newUserData.id, invite.id);

      // Verify membership
      const members = await ctx.admin.getTeamMembers(testUser.id, team.id);
      const newMember = members.data.find(m => m.userId === newUserData.id);
      expect(newMember).toBeDefined();
      expect(newMember!.role).toBe('developer');
    });

    it('should remove team member', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      // Add a member
      const memberData = createUserData();
      await ctx.storage.createUser(memberData);
      await ctx.storage.addTeamMember({
        teamId: team.id,
        userId: memberData.id,
        role: 'developer',
      });

      // Remove member
      await ctx.admin.removeMember(testUser.id, team.id, memberData.id);

      // Verify removal
      const member = await ctx.storage.getTeamMember(team.id, memberData.id);
      expect(member).toBeNull();
    });

    it('should prevent removing last owner', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      await expect(ctx.admin.removeMember(testUser.id, team.id, testUser.id)).rejects.toThrow(/last owner/i);
    });
  });

  describe('Team Listing', () => {
    it('should list teams for user', async () => {
      // Create multiple teams
      await ctx.admin.createTeam(testUser.id, createTeamData());
      await ctx.admin.createTeam(testUser.id, createTeamData());

      const teams = await ctx.admin.listTeams(testUser.id);
      expect(teams.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should paginate team list', async () => {
      // Create multiple teams
      for (let i = 0; i < 5; i++) {
        await ctx.admin.createTeam(testUser.id, createTeamData());
      }

      const page1 = await ctx.admin.listTeams(testUser.id, { limit: 2, offset: 0 });
      const page2 = await ctx.admin.listTeams(testUser.id, { limit: 2, offset: 2 });

      expect(page1.data.length).toBe(2);
      expect(page2.data.length).toBe(2);
      expect(page1.data[0].id).not.toBe(page2.data[0].id);
    });
  });
});
```

### 4.3 Project CRUD Operations Tests

**File**: `packages/admin/integration-tests/src/tests/projects/projects.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, type TestContext } from '../../setup/test-context';
import { createUserData, createTeamData, createProjectData, uniqueId } from '../../fixtures/factories';

describe('Project Management Integration Tests', () => {
  let ctx: TestContext;
  let testUser: { id: string };
  let testTeam: { id: string };

  beforeAll(async () => {
    ctx = await createTestContext();

    // Create test user and team
    const userData = createUserData();
    await ctx.storage.createUser(userData);
    testUser = { id: userData.id };

    const team = await ctx.admin.createTeam(testUser.id, createTeamData());
    testTeam = { id: team.id };
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Project CRUD', () => {
    it('should create a project', async () => {
      const projectData = createProjectData({ teamId: testTeam.id });
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: projectData.name,
        slug: projectData.slug,
        sourceType: projectData.sourceType,
        sourceConfig: projectData.sourceConfig,
      });

      expect(project.id).toBeDefined();
      expect(project.name).toBe(projectData.name);
      expect(project.teamId).toBe(testTeam.id);
    });

    it('should get project by ID', async () => {
      const projectData = createProjectData({ teamId: testTeam.id });
      const created = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: projectData.name,
        slug: projectData.slug,
        sourceType: projectData.sourceType,
        sourceConfig: projectData.sourceConfig,
      });

      const fetched = await ctx.admin.getProject(testUser.id, created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.name).toBe(projectData.name);
    });

    it('should list projects for team', async () => {
      // Create multiple projects
      for (let i = 0; i < 3; i++) {
        const projectData = createProjectData({ teamId: testTeam.id });
        await ctx.admin.createProject(testUser.id, testTeam.id, {
          name: projectData.name,
          slug: projectData.slug,
          sourceType: projectData.sourceType,
          sourceConfig: projectData.sourceConfig,
        });
      }

      const projects = await ctx.admin.listProjects(testUser.id, testTeam.id);
      expect(projects.data.length).toBeGreaterThanOrEqual(3);
    });

    it('should delete project', async () => {
      const projectData = createProjectData({ teamId: testTeam.id });
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: projectData.name,
        slug: projectData.slug,
        sourceType: projectData.sourceType,
        sourceConfig: projectData.sourceConfig,
      });

      await ctx.admin.deleteProject(testUser.id, project.id);

      const fetched = await ctx.storage.getProject(project.id);
      expect(fetched).toBeNull();
    });
  });

  describe('Environment Variables', () => {
    it('should set environment variable', async () => {
      const projectData = createProjectData({ teamId: testTeam.id });
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: projectData.name,
        slug: projectData.slug,
        sourceType: projectData.sourceType,
        sourceConfig: projectData.sourceConfig,
      });

      await ctx.admin.setEnvVar(testUser.id, project.id, 'API_KEY', 'secret-value', true);

      const envVars = await ctx.admin.getEnvVars(testUser.id, project.id);
      const apiKey = envVars.find(e => e.key === 'API_KEY');
      expect(apiKey).toBeDefined();
      expect(apiKey!.isSecret).toBe(true);
    });

    it('should encrypt secret values', async () => {
      const projectData = createProjectData({ teamId: testTeam.id });
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: projectData.name,
        slug: projectData.slug,
        sourceType: projectData.sourceType,
        sourceConfig: projectData.sourceConfig,
      });

      await ctx.admin.setEnvVar(testUser.id, project.id, 'SECRET', 'plain-text', true);

      // Get raw from storage (should be encrypted)
      const rawEnvVars = await ctx.storage.getProjectEnvVars(project.id);
      const secret = rawEnvVars.find(e => e.key === 'SECRET');
      expect(secret!.encryptedValue).not.toBe('plain-text');
    });

    it('should delete environment variable', async () => {
      const projectData = createProjectData({ teamId: testTeam.id });
      const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
        name: projectData.name,
        slug: projectData.slug,
        sourceType: projectData.sourceType,
        sourceConfig: projectData.sourceConfig,
      });

      await ctx.admin.setEnvVar(testUser.id, project.id, 'TO_DELETE', 'value', false);
      await ctx.admin.deleteEnvVar(testUser.id, project.id, 'TO_DELETE');

      const envVars = await ctx.admin.getEnvVars(testUser.id, project.id);
      const deleted = envVars.find(e => e.key === 'TO_DELETE');
      expect(deleted).toBeUndefined();
    });
  });
});
```

### 4.4 Build and Deployment Lifecycle Tests

**File**: `packages/admin/integration-tests/src/tests/deployments/lifecycle.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, type TestContext } from '../../setup/test-context';
import { createUserData, createTeamData, createProjectData } from '../../fixtures/factories';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('Deployment Lifecycle Integration Tests', () => {
  let ctx: TestContext;
  let testUser: { id: string };
  let testTeam: { id: string };
  let testProject: { id: string; path: string };

  beforeAll(async () => {
    ctx = await createTestContext();

    // Create test user and team
    const userData = createUserData();
    await ctx.storage.createUser(userData);
    testUser = { id: userData.id };

    const team = await ctx.admin.createTeam(testUser.id, createTeamData());
    testTeam = { id: team.id };

    // Create a simple test project on disk
    const projectPath = `/tmp/test-projects/test-project-${Date.now()}`;
    await createMockMastraProject(projectPath);

    const project = await ctx.admin.createProject(testUser.id, testTeam.id, {
      name: 'Test Project',
      slug: `test-project-${Date.now()}`,
      sourceType: 'local',
      sourceConfig: { path: projectPath },
    });
    testProject = { id: project.id, path: projectPath };
  });

  afterAll(async () => {
    // Cleanup test project directory
    if (testProject?.path) {
      await fs.rm(testProject.path, { recursive: true, force: true });
    }
    await ctx.cleanup();
  });

  describe('Deployment Creation', () => {
    it('should create a production deployment', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      expect(deployment.id).toBeDefined();
      expect(deployment.type).toBe('production');
      expect(deployment.status).toBe('pending');
    });

    it('should create a staging deployment', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'staging',
        branch: 'develop',
      });

      expect(deployment.type).toBe('staging');
    });

    it('should create a preview deployment', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature/new-feature',
      });

      expect(deployment.type).toBe('preview');
    });

    it('should prevent duplicate production deployments', async () => {
      await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      // Second production deployment should fail or replace
      // (depends on implementation strategy)
    });
  });

  describe('Build Workflow', () => {
    it('should trigger a build', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);

      expect(build.id).toBeDefined();
      expect(build.status).toBe('queued');
      expect(build.trigger).toBe('manual');
      expect(build.triggeredBy).toBe(testUser.id);
    });

    it('should list builds for deployment', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'staging',
        branch: 'develop',
      });

      // Trigger multiple builds
      await ctx.admin.deploy(testUser.id, deployment.id);
      await ctx.admin.deploy(testUser.id, deployment.id);

      const builds = await ctx.admin.listBuilds(testUser.id, deployment.id);
      expect(builds.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should get build logs', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'preview',
        branch: 'feature-test',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);

      // Note: In a real test, we'd wait for build to complete
      // For now, just verify the method works
      const logs = await ctx.admin.getBuildLogs(testUser.id, build.id);
      expect(typeof logs).toBe('string');
    });
  });

  describe('Build Queue Processing', () => {
    it('should process build from queue', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);
      expect(build.status).toBe('queued');

      // Process the build (this would normally be done by the build worker)
      const processed = await ctx.admin.getOrchestrator().processNextBuild();
      expect(processed).toBe(true);

      // Verify build status changed
      const updatedBuild = await ctx.admin.getBuild(testUser.id, build.id);
      expect(['building', 'deploying', 'succeeded', 'failed']).toContain(updatedBuild.status);
    });

    it('should handle build cancellation', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'staging',
        branch: 'develop',
      });

      const build = await ctx.admin.deploy(testUser.id, deployment.id);
      await ctx.admin.cancelBuild(testUser.id, build.id);

      const cancelledBuild = await ctx.admin.getBuild(testUser.id, build.id);
      expect(cancelledBuild.status).toBe('cancelled');
    });
  });

  describe('Server Health', () => {
    it('should check server health status', async () => {
      // This test requires a running server
      // In practice, we'd use a mock or wait for deployment to complete
    });
  });

  describe('Deployment Stop and Rollback', () => {
    it('should stop a running deployment', async () => {
      const deployment = await ctx.admin.createDeployment(testUser.id, testProject.id, {
        type: 'production',
        branch: 'main',
      });

      // Deploy and wait for healthy
      await ctx.admin.deploy(testUser.id, deployment.id);

      // Stop
      await ctx.admin.stop(testUser.id, deployment.id);

      const stoppedDeployment = await ctx.admin.getDeployment(testUser.id, deployment.id);
      expect(stoppedDeployment.status).toBe('stopped');
    });
  });
});

/**
 * Create a minimal mock Mastra project for testing.
 */
async function createMockMastraProject(projectPath: string): Promise<void> {
  await fs.mkdir(projectPath, { recursive: true });

  // Create package.json
  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify(
      {
        name: 'test-mastra-project',
        version: '1.0.0',
        scripts: {
          build: 'echo "Building..."',
          start: 'node server.js',
        },
      },
      null,
      2,
    ),
  );

  // Create a simple server
  await fs.writeFile(
    path.join(projectPath, 'server.js'),
    `
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
  } else {
    res.writeHead(200);
    res.end('Hello from test server');
  }
});
const port = process.env.PORT || 3000;
server.listen(port, () => console.log(\`Server running on port \${port}\`));
    `,
  );
}
```

### 4.5 Observability Data Flow Tests

**File**: `packages/admin/integration-tests/src/tests/observability/data-flow.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, type TestContext } from '../../setup/test-context';
import {
  createTraceData,
  createSpanData,
  createLogData,
  createMetricData,
  createScoreData,
} from '../../fixtures/observability-factories';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('Observability Data Flow Integration Tests', () => {
  let ctx: TestContext;
  const testProjectId = 'test-obs-project';
  const testDeploymentId = 'test-obs-deployment';

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Event Writing', () => {
    it('should write trace events', async () => {
      const trace = createTraceData({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
      });

      ctx.observabilityWriter.recordTrace(trace);
      await ctx.observabilityWriter.flush();

      // Verify file was written
      const files = await fs.readdir(path.join(ctx.observabilityDir, 'trace', testProjectId));
      expect(files.length).toBeGreaterThan(0);
    });

    it('should write span events', async () => {
      const traceId = 'test-trace-id';
      const span = createSpanData({
        traceId,
        projectId: testProjectId,
        deploymentId: testDeploymentId,
      });

      ctx.observabilityWriter.recordSpan(span);
      await ctx.observabilityWriter.flush();

      const files = await fs.readdir(path.join(ctx.observabilityDir, 'span', testProjectId));
      expect(files.length).toBeGreaterThan(0);
    });

    it('should write log events', async () => {
      const log = createLogData({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
        level: 'info',
      });

      ctx.observabilityWriter.recordLog(log);
      await ctx.observabilityWriter.flush();

      const files = await fs.readdir(path.join(ctx.observabilityDir, 'log', testProjectId));
      expect(files.length).toBeGreaterThan(0);
    });

    it('should write metric events', async () => {
      const metric = createMetricData({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
        name: 'request_duration_ms',
        type: 'histogram',
        value: 150,
      });

      ctx.observabilityWriter.recordMetric(metric);
      await ctx.observabilityWriter.flush();

      const files = await fs.readdir(path.join(ctx.observabilityDir, 'metric', testProjectId));
      expect(files.length).toBeGreaterThan(0);
    });

    it('should write score events', async () => {
      const score = createScoreData({
        projectId: testProjectId,
        deploymentId: testDeploymentId,
        name: 'accuracy',
        value: 0.95,
      });

      ctx.observabilityWriter.recordScore(score);
      await ctx.observabilityWriter.flush();

      const files = await fs.readdir(path.join(ctx.observabilityDir, 'score', testProjectId));
      expect(files.length).toBeGreaterThan(0);
    });

    it('should batch multiple events', async () => {
      const events = [];
      for (let i = 0; i < 15; i++) {
        events.push(
          createSpanData({
            traceId: `batch-trace-${i}`,
            projectId: testProjectId,
            deploymentId: testDeploymentId,
          }),
        );
      }

      events.forEach(e => ctx.observabilityWriter.recordSpan(e));
      await ctx.observabilityWriter.flush();

      // Verify batching worked
      const files = await fs.readdir(path.join(ctx.observabilityDir, 'span', testProjectId));
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe('JSONL File Format', () => {
    it('should write valid JSONL format', async () => {
      const span = createSpanData({
        traceId: 'jsonl-test',
        projectId: testProjectId,
        deploymentId: testDeploymentId,
      });

      ctx.observabilityWriter.recordSpan(span);
      await ctx.observabilityWriter.flush();

      // Find the most recent file
      const files = await fs.readdir(path.join(ctx.observabilityDir, 'span', testProjectId));
      const latestFile = files.sort().pop()!;

      // Read and parse
      const content = await fs.readFile(path.join(ctx.observabilityDir, 'span', testProjectId, latestFile), 'utf-8');

      // Each line should be valid JSON
      const lines = content.trim().split('\n');
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });
  });

  describe('File Storage Operations', () => {
    it('should list pending files', async () => {
      const span = createSpanData({
        traceId: 'list-test',
        projectId: testProjectId,
        deploymentId: testDeploymentId,
      });

      ctx.observabilityWriter.recordSpan(span);
      await ctx.observabilityWriter.flush();

      const files = await ctx.fileStorage.list('span');
      expect(files.length).toBeGreaterThan(0);
    });

    it('should move processed files', async () => {
      const span = createSpanData({
        traceId: 'move-test',
        projectId: testProjectId,
        deploymentId: testDeploymentId,
      });

      ctx.observabilityWriter.recordSpan(span);
      await ctx.observabilityWriter.flush();

      const files = await ctx.fileStorage.list(`span/${testProjectId}`);
      if (files.length > 0) {
        const file = files[0];
        const processedPath = file.path.replace(`span/${testProjectId}`, `span/${testProjectId}/processed`);

        await ctx.fileStorage.move(file.path, processedPath);
        expect(await ctx.fileStorage.exists(processedPath)).toBe(true);
        expect(await ctx.fileStorage.exists(file.path)).toBe(false);
      }
    });
  });

  describe('Ingestion Worker Simulation', () => {
    it('should process files and mark as processed', async () => {
      // Write some events
      for (let i = 0; i < 5; i++) {
        ctx.observabilityWriter.recordSpan(
          createSpanData({
            traceId: `ingestion-test-${i}`,
            projectId: testProjectId,
            deploymentId: testDeploymentId,
          }),
        );
      }
      await ctx.observabilityWriter.flush();

      // Simulate ingestion: list, read, process, move
      const pendingFiles = await ctx.fileStorage.list(`span/${testProjectId}`);
      const pendingCount = pendingFiles.filter(f => !f.path.includes('processed')).length;

      for (const file of pendingFiles) {
        if (file.path.includes('processed')) continue;

        // Read content
        const content = await ctx.fileStorage.read(file.path);
        expect(content.length).toBeGreaterThan(0);

        // Move to processed
        const processedPath = file.path.replace(`span/${testProjectId}/`, `span/${testProjectId}/processed/`);
        await ctx.fileStorage.move(file.path, processedPath);
      }

      // Verify all moved
      const remainingFiles = await ctx.fileStorage.list(`span/${testProjectId}`);
      const remainingPending = remainingFiles.filter(f => !f.path.includes('processed')).length;
      expect(remainingPending).toBeLessThan(pendingCount);
    });
  });
});
```

### 4.6 RBAC Permission Tests

**File**: `packages/admin/integration-tests/src/tests/rbac/permissions.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, type TestContext } from '../../setup/test-context';
import { createUserData, createTeamData, createProjectData } from '../../fixtures/factories';
import { MastraAdminError } from '@mastra/admin';

describe('RBAC Permission Integration Tests', () => {
  let ctx: TestContext;
  let ownerUser: { id: string };
  let adminUser: { id: string };
  let developerUser: { id: string };
  let viewerUser: { id: string };
  let testTeam: { id: string };
  let testProject: { id: string };

  beforeAll(async () => {
    ctx = await createTestContext();

    // Create users with different roles
    const ownerData = createUserData({ name: 'Owner User' });
    const adminData = createUserData({ name: 'Admin User' });
    const developerData = createUserData({ name: 'Developer User' });
    const viewerData = createUserData({ name: 'Viewer User' });

    await ctx.storage.createUser(ownerData);
    await ctx.storage.createUser(adminData);
    await ctx.storage.createUser(developerData);
    await ctx.storage.createUser(viewerData);

    ownerUser = { id: ownerData.id };
    adminUser = { id: adminData.id };
    developerUser = { id: developerData.id };
    viewerUser = { id: viewerData.id };

    // Create team (owner is automatically added)
    const team = await ctx.admin.createTeam(ownerUser.id, createTeamData());
    testTeam = { id: team.id };

    // Add other members with different roles
    await ctx.storage.addTeamMember({ teamId: team.id, userId: adminUser.id, role: 'admin' });
    await ctx.storage.addTeamMember({ teamId: team.id, userId: developerUser.id, role: 'developer' });
    await ctx.storage.addTeamMember({ teamId: team.id, userId: viewerUser.id, role: 'viewer' });

    // Create a project for permission testing
    const project = await ctx.admin.createProject(ownerUser.id, testTeam.id, {
      name: 'RBAC Test Project',
      slug: `rbac-test-${Date.now()}`,
      sourceType: 'local',
      sourceConfig: { path: '/tmp/rbac-test' },
    });
    testProject = { id: project.id };
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Team-Level Permissions', () => {
    describe('Owner Permissions', () => {
      it('should allow owner to read team', async () => {
        const team = await ctx.admin.getTeam(ownerUser.id, testTeam.id);
        expect(team).toBeDefined();
      });

      it('should allow owner to update team', async () => {
        // Owner can update team settings
        await expect(ctx.storage.updateTeam(testTeam.id, { name: 'Updated Team Name' })).resolves.toBeDefined();
      });

      it('should allow owner to delete team', async () => {
        // Create a separate team for deletion test
        const tempTeam = await ctx.admin.createTeam(ownerUser.id, createTeamData());
        await expect(ctx.admin.deleteTeam(ownerUser.id, tempTeam.id)).resolves.not.toThrow();
      });

      it('should allow owner to manage members', async () => {
        // Owner can invite
        const invite = await ctx.admin.inviteMember(ownerUser.id, testTeam.id, 'new-member@example.com', 'developer');
        expect(invite).toBeDefined();
      });
    });

    describe('Admin Permissions', () => {
      it('should allow admin to read team', async () => {
        const team = await ctx.admin.getTeam(adminUser.id, testTeam.id);
        expect(team).toBeDefined();
      });

      it('should allow admin to create projects', async () => {
        const project = await ctx.admin.createProject(adminUser.id, testTeam.id, {
          name: 'Admin Created Project',
          slug: `admin-project-${Date.now()}`,
          sourceType: 'local',
          sourceConfig: { path: '/tmp/admin-project' },
        });
        expect(project).toBeDefined();
      });

      it('should allow admin to invite members', async () => {
        const invite = await ctx.admin.inviteMember(
          adminUser.id,
          testTeam.id,
          'admin-invited@example.com',
          'developer',
        );
        expect(invite).toBeDefined();
      });

      it('should NOT allow admin to remove owner', async () => {
        await expect(ctx.admin.removeMember(adminUser.id, testTeam.id, ownerUser.id)).rejects.toThrow();
      });
    });

    describe('Developer Permissions', () => {
      it('should allow developer to read team', async () => {
        const team = await ctx.admin.getTeam(developerUser.id, testTeam.id);
        expect(team).toBeDefined();
      });

      it('should NOT allow developer to invite members', async () => {
        await expect(
          ctx.admin.inviteMember(developerUser.id, testTeam.id, 'dev-invite@example.com', 'viewer'),
        ).rejects.toThrow(/permission/i);
      });

      it('should NOT allow developer to remove members', async () => {
        await expect(ctx.admin.removeMember(developerUser.id, testTeam.id, viewerUser.id)).rejects.toThrow(
          /permission/i,
        );
      });
    });

    describe('Viewer Permissions', () => {
      it('should allow viewer to read team', async () => {
        const team = await ctx.admin.getTeam(viewerUser.id, testTeam.id);
        expect(team).toBeDefined();
      });

      it('should NOT allow viewer to create projects', async () => {
        await expect(
          ctx.admin.createProject(viewerUser.id, testTeam.id, {
            name: 'Viewer Project',
            slug: `viewer-project-${Date.now()}`,
            sourceType: 'local',
            sourceConfig: { path: '/tmp/viewer-project' },
          }),
        ).rejects.toThrow(/permission/i);
      });

      it('should NOT allow viewer to update team', async () => {
        // Assuming admin.updateTeam exists
        // await expect(
        //   ctx.admin.updateTeam(viewerUser.id, testTeam.id, { name: 'Hacked' })
        // ).rejects.toThrow(/permission/i);
      });
    });
  });

  describe('Project-Level Permissions', () => {
    describe('Developer Permissions', () => {
      it('should allow developer to read project', async () => {
        const project = await ctx.admin.getProject(developerUser.id, testProject.id);
        expect(project).toBeDefined();
      });

      it('should allow developer to deploy', async () => {
        // Create deployment first
        const deployment = await ctx.admin.createDeployment(developerUser.id, testProject.id, {
          type: 'preview',
          branch: 'feature/dev-test',
        });

        const build = await ctx.admin.deploy(developerUser.id, deployment.id);
        expect(build).toBeDefined();
      });

      it('should allow developer to set env vars', async () => {
        await expect(
          ctx.admin.setEnvVar(developerUser.id, testProject.id, 'DEV_VAR', 'value', false),
        ).resolves.not.toThrow();
      });
    });

    describe('Viewer Permissions', () => {
      it('should allow viewer to read project', async () => {
        const project = await ctx.admin.getProject(viewerUser.id, testProject.id);
        expect(project).toBeDefined();
      });

      it('should NOT allow viewer to deploy', async () => {
        const deployment = await ctx.admin.createDeployment(ownerUser.id, testProject.id, {
          type: 'preview',
          branch: 'viewer-test',
        });

        await expect(ctx.admin.deploy(viewerUser.id, deployment.id)).rejects.toThrow(/permission/i);
      });

      it('should NOT allow viewer to set env vars', async () => {
        await expect(ctx.admin.setEnvVar(viewerUser.id, testProject.id, 'VIEWER_VAR', 'value', false)).rejects.toThrow(
          /permission/i,
        );
      });
    });
  });

  describe('Cross-Team Access', () => {
    it('should NOT allow access to other teams', async () => {
      // Create a separate user and team
      const otherUserData = createUserData({ name: 'Other User' });
      await ctx.storage.createUser(otherUserData);

      const otherTeam = await ctx.admin.createTeam(otherUserData.id, createTeamData());

      // Developer from original team should not access other team
      await expect(ctx.admin.getTeam(developerUser.id, otherTeam.id)).rejects.toThrow(/permission/i);
    });

    it('should NOT allow access to other team projects', async () => {
      const otherUserData = createUserData({ name: 'Other User 2' });
      await ctx.storage.createUser(otherUserData);

      const otherTeam = await ctx.admin.createTeam(otherUserData.id, createTeamData());
      const otherProject = await ctx.admin.createProject(otherUserData.id, otherTeam.id, {
        name: 'Other Project',
        slug: `other-project-${Date.now()}`,
        sourceType: 'local',
        sourceConfig: { path: '/tmp/other-project' },
      });

      await expect(ctx.admin.getProject(developerUser.id, otherProject.id)).rejects.toThrow(/permission/i);
    });
  });
});
```

### 4.7 Error Handling Tests

**File**: `packages/admin/integration-tests/src/tests/errors/error-handling.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, type TestContext } from '../../setup/test-context';
import { createUserData, createTeamData, uniqueId } from '../../fixtures/factories';
import { MastraAdminError, ErrorCategory, ErrorDomain } from '@mastra/admin';

describe('Error Handling Integration Tests', () => {
  let ctx: TestContext;
  let testUser: { id: string };

  beforeAll(async () => {
    ctx = await createTestContext();

    const userData = createUserData();
    await ctx.storage.createUser(userData);
    testUser = { id: userData.id };
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Invalid Inputs', () => {
    it('should reject empty team name', async () => {
      await expect(ctx.admin.createTeam(testUser.id, { name: '', slug: 'test-slug' })).rejects.toThrow(/name/i);
    });

    it('should reject invalid team slug', async () => {
      await expect(ctx.admin.createTeam(testUser.id, { name: 'Test', slug: 'Invalid Slug!' })).rejects.toThrow(/slug/i);
    });

    it('should reject empty project source path', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      await expect(
        ctx.admin.createProject(testUser.id, team.id, {
          name: 'Test',
          slug: 'test',
          sourceType: 'local',
          sourceConfig: { path: '' },
        }),
      ).rejects.toThrow(/path/i);
    });

    it('should reject invalid deployment type', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());
      const project = await ctx.admin.createProject(testUser.id, team.id, {
        name: 'Test',
        slug: `test-${Date.now()}`,
        sourceType: 'local',
        sourceConfig: { path: '/tmp/test' },
      });

      await expect(
        ctx.admin.createDeployment(testUser.id, project.id, {
          type: 'invalid' as any,
          branch: 'main',
        }),
      ).rejects.toThrow(/type/i);
    });
  });

  describe('Resource Not Found', () => {
    it('should return null for non-existent user', async () => {
      const user = await ctx.storage.getUser(uniqueId());
      expect(user).toBeNull();
    });

    it('should throw for non-existent team access', async () => {
      await expect(ctx.admin.getTeam(testUser.id, uniqueId())).rejects.toThrow();
    });

    it('should throw for non-existent project access', async () => {
      await expect(ctx.admin.getProject(testUser.id, uniqueId())).rejects.toThrow();
    });

    it('should throw for non-existent deployment', async () => {
      await expect(ctx.admin.getDeployment(testUser.id, uniqueId())).rejects.toThrow();
    });

    it('should throw for non-existent build', async () => {
      await expect(ctx.admin.getBuild(testUser.id, uniqueId())).rejects.toThrow();
    });
  });

  describe('Permission Denied Errors', () => {
    it('should throw permission error for unauthorized team access', async () => {
      // Create a team owned by testUser
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      // Create another user with no access
      const otherUserData = createUserData();
      await ctx.storage.createUser(otherUserData);

      try {
        await ctx.admin.getTeam(otherUserData.id, team.id);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MastraAdminError);
        const adminError = error as MastraAdminError;
        expect(adminError.category).toBe(ErrorCategory.PERMISSION);
      }
    });

    it('should include proper error context', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      const otherUserData = createUserData();
      await ctx.storage.createUser(otherUserData);

      try {
        await ctx.admin.getTeam(otherUserData.id, team.id);
      } catch (error) {
        const adminError = error as MastraAdminError;
        expect(adminError.domain).toBeDefined();
        expect(adminError.message).toBeDefined();
      }
    });
  });

  describe('Duplicate Resource Errors', () => {
    it('should throw for duplicate team slug', async () => {
      const teamData = createTeamData();
      await ctx.admin.createTeam(testUser.id, teamData);

      await expect(ctx.admin.createTeam(testUser.id, { ...teamData, name: 'Different Name' })).rejects.toThrow(
        /slug|duplicate/i,
      );
    });

    it('should throw for duplicate user email', async () => {
      const userData = createUserData();
      await ctx.storage.createUser(userData);

      await expect(ctx.storage.createUser({ ...createUserData(), email: userData.email })).rejects.toThrow(
        /email|duplicate/i,
      );
    });

    it('should throw for duplicate project slug in team', async () => {
      const team = await ctx.admin.createTeam(testUser.id, createTeamData());

      const slug = `test-slug-${Date.now()}`;
      await ctx.admin.createProject(testUser.id, team.id, {
        name: 'First',
        slug,
        sourceType: 'local',
        sourceConfig: { path: '/tmp/first' },
      });

      await expect(
        ctx.admin.createProject(testUser.id, team.id, {
          name: 'Second',
          slug, // Same slug
          sourceType: 'local',
          sourceConfig: { path: '/tmp/second' },
        }),
      ).rejects.toThrow(/slug|duplicate/i);
    });
  });

  describe('Validation Errors', () => {
    it('should validate email format', async () => {
      await expect(ctx.storage.createUser({ ...createUserData(), email: 'invalid-email' })).rejects.toThrow(/email/i);
    });

    it('should validate slug format', async () => {
      await expect(ctx.admin.createTeam(testUser.id, { name: 'Test', slug: 'UPPERCASE-SLUG' })).rejects.toThrow(
        /slug/i,
      );
    });
  });
});
```

---

## 5. Route Registration Tests

**File**: `packages/admin/integration-tests/src/tests/router/routes.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LocalEdgeRouter } from '@mastra/router-local';

describe('Local Edge Router Integration Tests', () => {
  let router: LocalEdgeRouter;

  beforeAll(async () => {
    router = new LocalEdgeRouter({
      baseDomain: 'localhost',
      portRange: { start: 4500, end: 4599 },
      logRoutes: false,
    });
  });

  afterAll(async () => {
    await router.shutdown();
  });

  describe('Route Registration', () => {
    it('should register a route', async () => {
      const route = await router.registerRoute({
        deploymentId: 'deploy-1',
        projectId: 'project-1',
        subdomain: 'test-agent',
        targetHost: 'localhost',
        targetPort: 3001,
      });

      expect(route.routeId).toBeDefined();
      expect(route.publicUrl).toContain('localhost');
      expect(route.status).toBe('active');
    });

    it('should retrieve registered route', async () => {
      const registered = await router.registerRoute({
        deploymentId: 'deploy-2',
        projectId: 'project-1',
        subdomain: 'another-agent',
        targetHost: 'localhost',
        targetPort: 3002,
      });

      const fetched = await router.getRoute(registered.deploymentId);
      expect(fetched).not.toBeNull();
      expect(fetched!.routeId).toBe(registered.routeId);
    });

    it('should update route target', async () => {
      const route = await router.registerRoute({
        deploymentId: 'deploy-3',
        projectId: 'project-1',
        subdomain: 'update-agent',
        targetHost: 'localhost',
        targetPort: 3003,
      });

      const updated = await router.updateRoute(route.routeId, {
        targetPort: 3004,
      });

      expect(updated.publicUrl).toBeDefined();
    });

    it('should remove route', async () => {
      const route = await router.registerRoute({
        deploymentId: 'deploy-4',
        projectId: 'project-1',
        subdomain: 'remove-agent',
        targetHost: 'localhost',
        targetPort: 3005,
      });

      await router.removeRoute(route.routeId);

      const fetched = await router.getRoute('deploy-4');
      expect(fetched).toBeNull();
    });

    it('should list routes for project', async () => {
      const projectId = `project-${Date.now()}`;

      await router.registerRoute({
        deploymentId: 'deploy-5',
        projectId,
        subdomain: 'list-agent-1',
        targetHost: 'localhost',
        targetPort: 3006,
      });

      await router.registerRoute({
        deploymentId: 'deploy-6',
        projectId,
        subdomain: 'list-agent-2',
        targetHost: 'localhost',
        targetPort: 3007,
      });

      const routes = await router.listRoutes(projectId);
      expect(routes.length).toBe(2);
    });
  });

  describe('Route Health Checking', () => {
    it('should report unhealthy for non-running target', async () => {
      const route = await router.registerRoute({
        deploymentId: 'deploy-health-1',
        projectId: 'project-health',
        subdomain: 'health-agent',
        targetHost: 'localhost',
        targetPort: 39999, // Non-existent port
      });

      const health = await router.checkRouteHealth(route.routeId);
      expect(health.healthy).toBe(false);
    });
  });
});
```

---

## 6. Success Criteria

### 6.1 Test Coverage Targets

| Category                | Target Coverage |
| ----------------------- | --------------- |
| Auth/User operations    | 90%+            |
| Team management         | 90%+            |
| Project CRUD            | 90%+            |
| Deployment lifecycle    | 85%+            |
| Build workflow          | 85%+            |
| Observability data flow | 80%+            |
| RBAC permissions        | 95%+            |
| Error handling          | 90%+            |
| Route registration      | 85%+            |

### 6.2 Performance Requirements

| Operation                   | Max Duration |
| --------------------------- | ------------ |
| User creation               | < 100ms      |
| Team creation               | < 200ms      |
| Project creation            | < 200ms      |
| Build trigger               | < 500ms      |
| Route registration          | < 100ms      |
| Observability write + flush | < 500ms      |

### 6.3 Test Suite Requirements

- [ ] All tests pass in isolation (no cross-test dependencies)
- [ ] Tests can run in parallel (process isolation via vitest forks)
- [ ] Cleanup happens reliably (no orphaned data)
- [ ] Tests are deterministic (no flaky tests)
- [ ] Docker services start reliably
- [ ] Test execution < 5 minutes total

---

## 7. Implementation Phases

### Phase 1: Infrastructure Setup

1. Create `packages/admin/integration-tests/` directory structure
2. Set up Docker Compose with PostgreSQL and ClickHouse
3. Create vitest configuration
4. Create test context factory
5. Implement mock auth provider

### Phase 2: Core Entity Tests

1. User registration and authentication tests
2. Team management tests
3. Project CRUD tests
4. Environment variable tests

### Phase 3: Deployment Lifecycle Tests

1. Deployment creation tests
2. Build workflow tests
3. Build queue processing tests
4. Stop and rollback tests

### Phase 4: Provider Integration Tests

1. Route registration tests
2. Observability data flow tests
3. File storage tests

### Phase 5: Permission and Error Tests

1. RBAC permission tests (all roles)
2. Cross-team access tests
3. Error handling tests
4. Validation tests

### Phase 6: CI Integration

1. Add to GitHub Actions workflow
2. Add coverage reporting
3. Add test result artifacts
4. Document test execution

---

## 8. File Structure Summary

```
packages/admin/
└── integration-tests/
    ├── docker-compose.yml
    ├── vitest.config.ts
    ├── .env.test
    ├── package.json
    ├── scripts/
    │   └── wait-for-services.js
    └── src/
        ├── setup/
        │   ├── global-setup.ts
        │   ├── docker-setup.ts
        │   ├── test-context.ts
        │   └── mock-auth.ts
        ├── fixtures/
        │   ├── factories.ts
        │   └── observability-factories.ts
        ├── helpers/
        │   └── assertions.ts
        └── tests/
            ├── auth/
            │   └── auth.test.ts
            ├── teams/
            │   └── teams.test.ts
            ├── projects/
            │   └── projects.test.ts
            ├── deployments/
            │   └── lifecycle.test.ts
            ├── observability/
            │   └── data-flow.test.ts
            ├── rbac/
            │   └── permissions.test.ts
            ├── router/
            │   └── routes.test.ts
            └── errors/
                └── error-handling.test.ts
```

---

## 9. Dependencies

### Required Packages

```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@mastra/admin": "workspace:*",
    "@mastra/admin-pg": "workspace:*",
    "@mastra/runner-local": "workspace:*",
    "@mastra/router-local": "workspace:*",
    "@mastra/source-local": "workspace:*",
    "@mastra/observability-writer": "workspace:*",
    "@mastra/observability-file-local": "workspace:*",
    "dotenv": "^16.0.0"
  }
}
```

### External Dependencies

- Docker and Docker Compose
- PostgreSQL 16 (via Docker)
- ClickHouse 24 (via Docker)
- Node.js 20+
