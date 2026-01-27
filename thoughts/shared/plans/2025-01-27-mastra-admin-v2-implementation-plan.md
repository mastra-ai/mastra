# MastraAdmin V2 Implementation Plan

## Overview

Implementation plan for MastraAdmin V2 - an enterprise self-hosted platform for managing multiple Mastra servers. This plan uses environment variable-based observability activation instead of build-time code injection, file-based observability with ClickHouse ingestion, and SSE for real-time build log streaming.

## Current State Analysis

### Existing Codebase Assets

| Component | Location | Status |
|-----------|----------|--------|
| `BaseExporter` | `observability/mastra/src/exporters/base.ts:84` | Existing - extend for FileExporter |
| `PinoLogger` | `packages/loggers/src/pino.ts:24` | Existing - can use with FileTransport |
| `FileTransport` | `packages/loggers/src/file/index.ts:6` | Existing - for log file writing |
| `PostgresStore` | `stores/pg/src/storage/index.ts:58` | Pattern reference for admin-pg |
| `MastraServer` (Hono) | `server-adapters/hono/src/index.ts` | Pattern reference for admin-server |
| SSE streaming | `server-adapters/hono/src/index.ts` | Existing - use for build logs |

### Key Discoveries

1. **Logger infrastructure exists**: `@mastra/loggers` has `PinoLogger` and `FileTransport` - we can configure file logging via env vars
2. **Storage pattern**: `stores/pg` extends `MastraCompositeStore` with domain stores - admin needs similar but different entities
3. **Server pattern**: Framework-agnostic routes in `packages/server/` with Hono adapter
4. **No admin packages exist**: Fresh implementation needed for all admin-specific packages

## Desired End State

After completing this plan:

1. **MastraAdmin instance** can be created with pluggable storage, source, runner, and router adapters
2. **Teams, Projects, Deployments, Builds** fully manageable via REST API
3. **Local project discovery** via `@mastra/source-local` scanning configured directories
4. **Build system** with queue, worker, and process management
5. **Observability** via FileExporter (env-var activated) with ClickHouse ingestion
6. **Subdomain routing** via `@mastra/router-local` reverse proxy
7. **Admin UI** for complete workflow management

### Verification

- `pnpm build` succeeds for all admin packages
- API integration tests pass
- End-to-end flow: Create team → Discover project → Deploy → View traces

## What We're NOT Doing

1. **RBAC** - Deferred to later phase; just team membership for now
2. **GitHub source adapter** - Only implementing local source
3. **Kubernetes runner** - Only implementing local process runner
4. **Cloudflare router** - Only implementing local reverse proxy
5. **S3/GCS file storage** - Only implementing local filesystem
6. **License validation** - Deferred
7. **User authentication** - Team/user association without auth provider integration

---

## Implementation Approach

The implementation follows the PRD's phased approach with adapter-based architecture:

1. **Phase 1**: Foundation - Types, interfaces, PostgreSQL storage, local source
2. **Phase 2**: Build System - FileExporter, file logging, runner, build orchestrator
3. **Phase 3**: API & Routing - HTTP API, SSE streaming, subdomain routing
4. **Phase 4**: Observability Ingestion - ClickHouse schema, ingestion worker, queries
5. **Phase 5**: Admin UI - Dashboard, project management, observability views

---

## Phase 1: Foundation [P0]

### Overview

Create core types, interfaces, PostgreSQL storage adapter, and local project source. This establishes the data model and project discovery that all subsequent phases depend on.

### Changes Required

#### 1. Create `@mastra/admin` Package

**Directory**: `packages/admin/`

**Files to create**:

```
packages/admin/
├── src/
│   ├── index.ts              # Main exports
│   ├── admin.ts              # MastraAdmin class
│   ├── types/
│   │   ├── index.ts          # Type exports
│   │   ├── entities.ts       # Team, Project, Deployment, Build
│   │   ├── config.ts         # MastraAdminConfig
│   │   └── providers.ts      # Provider interfaces
│   └── utils/
│       ├── index.ts
│       └── safe-array.ts     # Defensive JSONB handling
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── tsup.config.ts
```

**File: `src/types/entities.ts`**

```typescript
export interface Team {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  sourceType: 'local' | 'github';
  sourceConfig: Record<string, unknown>;
  defaultBranch: string;
  envVars: EncryptedEnvVar[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Deployment {
  id: string;
  projectId: string;
  type: 'production' | 'staging' | 'preview';
  branch: string;
  slug: string;
  status: DeploymentStatus;
  currentBuildId: string | null;
  publicUrl: string | null;
  port: number | null;
  processId: number | null;
  envVarOverrides: EncryptedEnvVar[];
  createdAt: Date;
  updatedAt: Date;
}

export type DeploymentStatus = 'pending' | 'building' | 'running' | 'stopped' | 'failed';

export interface Build {
  id: string;
  deploymentId: string;
  trigger: 'manual' | 'webhook' | 'schedule';
  status: BuildStatus;
  logPath: string | null;
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
}

export type BuildStatus = 'queued' | 'building' | 'deploying' | 'succeeded' | 'failed';

export interface EncryptedEnvVar {
  key: string;
  encryptedValue: string;
  isSecret: boolean;
}
```

**File: `src/types/providers.ts`**

```typescript
export interface AdminStorage {
  teams: TeamStorage;
  projects: ProjectStorage;
  deployments: DeploymentStorage;
  builds: BuildStorage;
  init(): Promise<void>;
  close(): Promise<void>;
}

export interface TeamStorage {
  create(team: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>): Promise<Team>;
  getById(id: string): Promise<Team | null>;
  getBySlug(slug: string): Promise<Team | null>;
  list(): Promise<Team[]>;
  update(id: string, data: Partial<Team>): Promise<Team>;
  delete(id: string): Promise<void>;
}

export interface ProjectStorage {
  create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project>;
  getById(id: string): Promise<Project | null>;
  getBySlug(teamId: string, slug: string): Promise<Project | null>;
  listByTeam(teamId: string): Promise<Project[]>;
  update(id: string, data: Partial<Project>): Promise<Project>;
  delete(id: string): Promise<void>;
}

export interface DeploymentStorage {
  create(deployment: Omit<Deployment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deployment>;
  getById(id: string): Promise<Deployment | null>;
  listByProject(projectId: string): Promise<Deployment[]>;
  listByStatus(status: DeploymentStatus): Promise<Deployment[]>;
  update(id: string, data: Partial<Deployment>): Promise<Deployment>;
  delete(id: string): Promise<void>;
}

export interface BuildStorage {
  create(build: Omit<Build, 'id' | 'createdAt'>): Promise<Build>;
  getById(id: string): Promise<Build | null>;
  listByDeployment(deploymentId: string): Promise<Build[]>;
  listByStatus(status: BuildStatus): Promise<Build[]>;
  update(id: string, data: Partial<Build>): Promise<Build>;
}

export interface ProjectSourceProvider {
  readonly type: 'local' | 'github' | string;
  listProjects(): Promise<ProjectSource[]>;
  getProject(projectId: string): Promise<ProjectSource | null>;
  validateAccess(source: ProjectSource): Promise<boolean>;
  getProjectPath(source: ProjectSource, targetDir?: string): Promise<string>;
  watchChanges?(source: ProjectSource, callback: (event: ChangeEvent) => void): () => void;
}

export interface ProjectSource {
  id: string;
  name: string;
  type: 'local' | 'github' | string;
  path: string;
  defaultBranch?: string;
  metadata?: Record<string, unknown>;
}

export interface ChangeEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
}

export interface Runner {
  build(build: Build, deployment: Deployment, project: Project): Promise<void>;
  start(deployment: Deployment, build: Build, port: number): Promise<{ processId: number }>;
  stop(deployment: Deployment): Promise<void>;
  isRunning(processId: number): Promise<boolean>;
}

export interface Router {
  register(config: RouteConfig): Promise<void>;
  unregister(subdomain: string): Promise<void>;
  getRoute(subdomain: string): RouteConfig | undefined;
}

export interface RouteConfig {
  subdomain: string;
  targetPort: number;
  targetHost: string;
}
```

**File: `src/admin.ts`**

```typescript
import type { AdminStorage, ProjectSourceProvider, Runner, Router } from './types/providers';

export interface MastraAdminConfig {
  storage: AdminStorage;
  source: ProjectSourceProvider;
  runner: Runner;
  router: Router;
  fileStoragePath?: string;
}

export class MastraAdmin {
  readonly storage: AdminStorage;
  readonly source: ProjectSourceProvider;
  readonly runner: Runner;
  readonly router: Router;
  readonly fileStoragePath: string;

  constructor(config: MastraAdminConfig) {
    this.storage = config.storage;
    this.source = config.source;
    this.runner = config.runner;
    this.router = config.router;
    this.fileStoragePath = config.fileStoragePath ?? './.mastra-admin/storage';
  }

  async init(): Promise<void> {
    await this.storage.init();
  }

  async close(): Promise<void> {
    await this.storage.close();
  }
}
```

**File: `src/utils/safe-array.ts`**

```typescript
/**
 * Safely extract array from JSONB column that may be null, undefined, or malformed.
 * Critical for defensive handling of PostgreSQL JSONB columns.
 */
export function safeArray<T>(value: unknown, defaultValue: T[] = []): T[] {
  return Array.isArray(value) ? value : defaultValue;
}
```

**File: `package.json`**

```json
{
  "name": "@mastra/admin",
  "version": "0.1.0",
  "description": "Core types and MastraAdmin class for enterprise Mastra management",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.ts", "default": "./dist/index.cjs" }
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build": "tsup --silent --config tsup.config.ts",
    "test": "vitest run",
    "lint": "eslint ."
  },
  "license": "Apache-2.0",
  "devDependencies": {
    "@internal/lint": "workspace:*",
    "@internal/types-builder": "workspace:*",
    "typescript": "catalog:",
    "vitest": "catalog:",
    "tsup": "^8.5.1"
  },
  "files": ["dist", "CHANGELOG.md"],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/mastra-ai/mastra.git",
    "directory": "packages/admin"
  },
  "engines": { "node": ">=22.13.0" }
}
```

#### 2. Create `@mastra/admin-pg` Package

**Directory**: `stores/admin-pg/`

**Files to create**:

```
stores/admin-pg/
├── src/
│   ├── index.ts
│   ├── storage.ts            # PostgresAdminStorage class
│   ├── client.ts             # Database client wrapper
│   ├── migrations/
│   │   ├── index.ts
│   │   └── 001_initial.ts
│   └── domains/
│       ├── teams.ts
│       ├── projects.ts
│       ├── deployments.ts
│       └── builds.ts
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── tsup.config.ts
├── vitest.config.ts
└── docker-compose.yaml
```

**File: `src/storage.ts`**

```typescript
import { Pool } from 'pg';
import type { AdminStorage, TeamStorage, ProjectStorage, DeploymentStorage, BuildStorage } from '@mastra/admin';
import { TeamsPostgres } from './domains/teams';
import { ProjectsPostgres } from './domains/projects';
import { DeploymentsPostgres } from './domains/deployments';
import { BuildsPostgres } from './domains/builds';
import { runMigrations } from './migrations';

export interface PostgresAdminStorageConfig {
  connectionString?: string;
  pool?: Pool;
  schemaName?: string;
}

export class PostgresAdminStorage implements AdminStorage {
  readonly teams: TeamStorage;
  readonly projects: ProjectStorage;
  readonly deployments: DeploymentStorage;
  readonly builds: BuildStorage;

  #pool: Pool;
  #ownsPool: boolean;
  #schema: string;
  #initialized = false;

  constructor(config: PostgresAdminStorageConfig) {
    if (config.pool) {
      this.#pool = config.pool;
      this.#ownsPool = false;
    } else if (config.connectionString) {
      this.#pool = new Pool({ connectionString: config.connectionString, max: 20 });
      this.#ownsPool = true;
    } else {
      throw new Error('PostgresAdminStorage requires either pool or connectionString');
    }

    this.#schema = config.schemaName ?? 'mastra_admin';

    const domainConfig = { pool: this.#pool, schema: this.#schema };
    this.teams = new TeamsPostgres(domainConfig);
    this.projects = new ProjectsPostgres(domainConfig);
    this.deployments = new DeploymentsPostgres(domainConfig);
    this.builds = new BuildsPostgres(domainConfig);
  }

  async init(): Promise<void> {
    if (this.#initialized) return;

    // Create schema if not exists
    await this.#pool.query(`CREATE SCHEMA IF NOT EXISTS ${this.#schema}`);

    // Run migrations
    await runMigrations(this.#pool, this.#schema);

    this.#initialized = true;
  }

  async close(): Promise<void> {
    if (this.#ownsPool) {
      await this.#pool.end();
    }
  }

  get pool(): Pool {
    return this.#pool;
  }
}
```

**File: `src/migrations/001_initial.ts`**

```typescript
import type { Pool } from 'pg';

export async function up(pool: Pool, schema: string): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${schema}.teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${schema}.projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES ${schema}.teams(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      source_type VARCHAR(50) NOT NULL DEFAULT 'local',
      source_config JSONB NOT NULL DEFAULT '{}',
      default_branch VARCHAR(255) NOT NULL DEFAULT 'main',
      env_vars JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(team_id, slug)
    );

    CREATE TABLE IF NOT EXISTS ${schema}.deployments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES ${schema}.projects(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL DEFAULT 'production',
      branch VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      current_build_id UUID,
      public_url VARCHAR(500),
      port INTEGER,
      process_id INTEGER,
      env_var_overrides JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(project_id, slug)
    );

    CREATE TABLE IF NOT EXISTS ${schema}.builds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deployment_id UUID NOT NULL REFERENCES ${schema}.deployments(id) ON DELETE CASCADE,
      trigger VARCHAR(50) NOT NULL DEFAULT 'manual',
      status VARCHAR(50) NOT NULL DEFAULT 'queued',
      log_path VARCHAR(500),
      queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Add foreign key for current_build_id after builds table exists
    ALTER TABLE ${schema}.deployments
      ADD CONSTRAINT fk_current_build
      FOREIGN KEY (current_build_id) REFERENCES ${schema}.builds(id) ON DELETE SET NULL;

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_projects_team_id ON ${schema}.projects(team_id);
    CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON ${schema}.deployments(project_id);
    CREATE INDEX IF NOT EXISTS idx_deployments_status ON ${schema}.deployments(status);
    CREATE INDEX IF NOT EXISTS idx_builds_deployment_id ON ${schema}.builds(deployment_id);
    CREATE INDEX IF NOT EXISTS idx_builds_status ON ${schema}.builds(status);

    -- Updated_at trigger function
    CREATE OR REPLACE FUNCTION ${schema}.update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Triggers for updated_at
    DROP TRIGGER IF EXISTS teams_updated_at ON ${schema}.teams;
    CREATE TRIGGER teams_updated_at BEFORE UPDATE ON ${schema}.teams
      FOR EACH ROW EXECUTE FUNCTION ${schema}.update_updated_at();

    DROP TRIGGER IF EXISTS projects_updated_at ON ${schema}.projects;
    CREATE TRIGGER projects_updated_at BEFORE UPDATE ON ${schema}.projects
      FOR EACH ROW EXECUTE FUNCTION ${schema}.update_updated_at();

    DROP TRIGGER IF EXISTS deployments_updated_at ON ${schema}.deployments;
    CREATE TRIGGER deployments_updated_at BEFORE UPDATE ON ${schema}.deployments
      FOR EACH ROW EXECUTE FUNCTION ${schema}.update_updated_at();
  `);
}
```

**File: `src/domains/teams.ts`**

```typescript
import type { Pool } from 'pg';
import type { Team, TeamStorage } from '@mastra/admin';

interface DomainConfig {
  pool: Pool;
  schema: string;
}

export class TeamsPostgres implements TeamStorage {
  #pool: Pool;
  #schema: string;

  constructor(config: DomainConfig) {
    this.#pool = config.pool;
    this.#schema = config.schema;
  }

  async create(data: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>): Promise<Team> {
    const result = await this.#pool.query(
      `INSERT INTO ${this.#schema}.teams (name, slug) VALUES ($1, $2) RETURNING *`,
      [data.name, data.slug]
    );
    return this.mapRow(result.rows[0]);
  }

  async getById(id: string): Promise<Team | null> {
    const result = await this.#pool.query(
      `SELECT * FROM ${this.#schema}.teams WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async getBySlug(slug: string): Promise<Team | null> {
    const result = await this.#pool.query(
      `SELECT * FROM ${this.#schema}.teams WHERE slug = $1`,
      [slug]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(): Promise<Team[]> {
    const result = await this.#pool.query(`SELECT * FROM ${this.#schema}.teams ORDER BY created_at DESC`);
    return result.rows.map(this.mapRow);
  }

  async update(id: string, data: Partial<Team>): Promise<Team> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.slug !== undefined) {
      fields.push(`slug = $${paramIndex++}`);
      values.push(data.slug);
    }

    values.push(id);
    const result = await this.#pool.query(
      `UPDATE ${this.#schema}.teams SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.#pool.query(`DELETE FROM ${this.#schema}.teams WHERE id = $1`, [id]);
  }

  private mapRow(row: Record<string, unknown>): Team {
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
```

#### 3. Create `@mastra/source-local` Package

**Directory**: `sources/local/`

**Files to create**:

```
sources/local/
├── src/
│   ├── index.ts
│   ├── provider.ts           # LocalProjectSource class
│   ├── scanner.ts            # DirectoryScanner
│   ├── detector.ts           # MastraProjectDetector
│   ├── watcher.ts            # ProjectWatcher (optional)
│   ├── types.ts
│   └── utils.ts              # copyDirectory, etc.
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── tsup.config.ts
└── vitest.config.ts
```

**File: `src/provider.ts`**

```typescript
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import type { ProjectSourceProvider, ProjectSource, ChangeEvent } from '@mastra/admin';
import { DirectoryScanner } from './scanner';
import { MastraProjectDetector } from './detector';
import { copyDirectory } from './utils';
import type { LocalProjectSourceConfig } from './types';

export class LocalProjectSource implements ProjectSourceProvider {
  readonly type = 'local' as const;

  #config: LocalProjectSourceConfig;
  #scanner: DirectoryScanner;
  #detector: MastraProjectDetector;
  #cache: Map<string, ProjectSource> = new Map();
  #cacheExpiry: number = 0;
  #cacheTtlMs: number = 30000; // 30 seconds

  constructor(config: LocalProjectSourceConfig) {
    this.#config = {
      basePaths: config.basePaths,
      include: config.include ?? ['*'],
      exclude: config.exclude ?? ['node_modules', '.git', 'dist', '.next', '.mastra'],
      maxDepth: config.maxDepth ?? 3,
      watchChanges: config.watchChanges ?? false,
    };

    this.#scanner = new DirectoryScanner(this.#config);
    this.#detector = new MastraProjectDetector();
  }

  async listProjects(): Promise<ProjectSource[]> {
    // Return cached if valid
    if (Date.now() < this.#cacheExpiry && this.#cache.size > 0) {
      return Array.from(this.#cache.values());
    }

    const projects: ProjectSource[] = [];

    for (const basePath of this.#config.basePaths) {
      const directories = await this.#scanner.scan(basePath);

      for (const dir of directories) {
        const isMastraProject = await this.#detector.detect(dir);
        if (isMastraProject) {
          const metadata = await this.#detector.getMetadata(dir);
          const project: ProjectSource = {
            id: this.generateId(dir),
            name: metadata.name ?? basename(dir),
            type: 'local',
            path: dir,
            defaultBranch: 'main',
            metadata,
          };
          projects.push(project);
          this.#cache.set(project.id, project);
        }
      }
    }

    this.#cacheExpiry = Date.now() + this.#cacheTtlMs;
    return projects;
  }

  async getProject(projectId: string): Promise<ProjectSource | null> {
    // Refresh cache if needed
    if (Date.now() >= this.#cacheExpiry) {
      await this.listProjects();
    }
    return this.#cache.get(projectId) ?? null;
  }

  async validateAccess(source: ProjectSource): Promise<boolean> {
    return this.#detector.detect(source.path);
  }

  /**
   * Get project path - MUST copy to targetDir if provided.
   * This is critical: builds need isolated directories.
   */
  async getProjectPath(source: ProjectSource, targetDir?: string): Promise<string> {
    if (!targetDir) {
      // No target dir - return source path (for validation/listing only)
      return source.path;
    }

    // MUST copy source to target directory for builds
    await copyDirectory(source.path, targetDir, {
      exclude: this.#config.exclude,
    });

    return targetDir;
  }

  watchChanges?(source: ProjectSource, callback: (event: ChangeEvent) => void): () => void {
    if (!this.#config.watchChanges) {
      return () => {};
    }
    // TODO: Implement file watching with chokidar or similar
    return () => {};
  }

  private generateId(path: string): string {
    return createHash('sha256').update(path).digest('hex').substring(0, 16);
  }
}
```

**File: `src/detector.ts`**

```typescript
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { constants } from 'node:fs';

export interface ProjectMetadata {
  name?: string;
  version?: string;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  mastraVersion?: string;
}

export class MastraProjectDetector {
  /**
   * Detect if a directory is a Mastra project by checking for @mastra/core dependency
   */
  async detect(directory: string): Promise<boolean> {
    const packageJsonPath = join(directory, 'package.json');

    try {
      await access(packageJsonPath, constants.R_OK);
      const content = await readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);

      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return '@mastra/core' in deps;
    } catch {
      return false;
    }
  }

  /**
   * Extract metadata from a Mastra project
   */
  async getMetadata(directory: string): Promise<ProjectMetadata> {
    const packageJsonPath = join(directory, 'package.json');

    try {
      const content = await readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      return {
        name: pkg.name,
        version: pkg.version,
        packageManager: await this.detectPackageManager(directory),
        mastraVersion: deps['@mastra/core'],
      };
    } catch {
      return {};
    }
  }

  private async detectPackageManager(directory: string): Promise<ProjectMetadata['packageManager']> {
    const lockFiles = [
      { file: 'pnpm-lock.yaml', manager: 'pnpm' as const },
      { file: 'yarn.lock', manager: 'yarn' as const },
      { file: 'bun.lockb', manager: 'bun' as const },
      { file: 'package-lock.json', manager: 'npm' as const },
    ];

    for (const { file, manager } of lockFiles) {
      try {
        await access(join(directory, file), constants.R_OK);
        return manager;
      } catch {
        // Continue checking
      }
    }

    return 'npm'; // Default
  }
}
```

**File: `src/utils.ts`**

```typescript
import { readdir, stat, mkdir, copyFile, readlink, symlink } from 'node:fs/promises';
import { join, relative } from 'node:path';

export interface CopyOptions {
  exclude?: string[];
}

/**
 * Recursively copy a directory, excluding specified patterns.
 * Critical for build isolation.
 */
export async function copyDirectory(
  source: string,
  destination: string,
  options: CopyOptions = {}
): Promise<void> {
  const exclude = new Set(options.exclude ?? []);

  await mkdir(destination, { recursive: true });

  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    if (exclude.has(entry.name)) {
      continue;
    }

    const srcPath = join(source, entry.name);
    const destPath = join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath, options);
    } else if (entry.isSymbolicLink()) {
      const linkTarget = await readlink(srcPath);
      await symlink(linkTarget, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}
```

### Success Criteria

#### Automated Verification:
- [ ] `pnpm build` succeeds for `@mastra/admin`, `@mastra/admin-pg`, `@mastra/source-local`
- [ ] TypeScript compilation passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Unit tests pass for all three packages
- [ ] Integration tests with Docker PostgreSQL pass for `@mastra/admin-pg`

#### Manual Verification:
- [ ] Can create team, project via direct class calls
- [ ] JSONB columns handle null/empty arrays gracefully
- [ ] `source.listProjects()` discovers Mastra projects in test directories
- [ ] `source.getProjectPath(project, targetDir)` copies project correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Build System [P0]

### Overview

Implement the build system with FileExporter for traces, file-based logging, local runner, and build orchestrator. This enables building and running Mastra servers with observability.

### Changes Required

#### 1. Add FileExporter to `@mastra/observability`

**File: `observability/mastra/src/exporters/file.ts`** (NEW)

```typescript
import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { TracingEvent } from '@mastra/core/observability';
import { BaseExporter, type BaseExporterConfig } from './base';

export interface FileExporterConfig extends BaseExporterConfig {
  /** Directory to write span files. If not set, checks MASTRA_CLOUD_TRACES_TARGET_DIR env var */
  outputPath?: string;
  /** Project ID for span metadata */
  projectId?: string;
  /** Deployment ID for span metadata */
  deploymentId?: string;
  /** Max file size in bytes before rotating (default: 10MB) */
  maxFileSize?: number;
  /** Flush interval in ms (default: 5000) */
  flushIntervalMs?: number;
}

/**
 * FileExporter writes spans to JSONL files on disk.
 *
 * Activated automatically when MASTRA_CLOUD_TRACES_TARGET_DIR environment variable is set.
 * Used by MastraAdmin for file-based observability ingestion.
 */
export class FileExporter extends BaseExporter {
  name = 'file-exporter';

  #outputPath: string | null;
  #projectId: string;
  #deploymentId: string;
  #buffer: string[] = [];
  #currentFile: string | null = null;
  #currentFileSize = 0;
  #maxFileSize: number;
  #flushIntervalMs: number;
  #flushTimer: NodeJS.Timeout | null = null;

  constructor(config: FileExporterConfig = {}) {
    super(config);

    // Check env var if outputPath not provided
    this.#outputPath = config.outputPath ?? process.env.MASTRA_CLOUD_TRACES_TARGET_DIR ?? null;

    if (!this.#outputPath) {
      this.setDisabled('No outputPath provided and MASTRA_CLOUD_TRACES_TARGET_DIR not set');
      return;
    }

    this.#projectId = config.projectId ?? process.env.MASTRA_PROJECT_ID ?? 'unknown';
    this.#deploymentId = config.deploymentId ?? process.env.MASTRA_DEPLOYMENT_ID ?? 'unknown';
    this.#maxFileSize = config.maxFileSize ?? 10 * 1024 * 1024; // 10MB
    this.#flushIntervalMs = config.flushIntervalMs ?? 5000;

    // Start flush timer
    this.#flushTimer = setInterval(() => this.flush(), this.#flushIntervalMs);
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    const line = JSON.stringify({
      type: 'span',
      projectId: this.#projectId,
      deploymentId: this.#deploymentId,
      timestamp: Date.now(),
      data: event.exportedSpan,
    });

    this.#buffer.push(line);

    // Flush if buffer is large
    if (this.#buffer.length >= 100) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.#buffer.length === 0 || !this.#outputPath) {
      return;
    }

    try {
      await mkdir(this.#outputPath, { recursive: true });

      // Rotate file if needed
      if (!this.#currentFile || this.#currentFileSize > this.#maxFileSize) {
        this.#currentFile = join(this.#outputPath, `${Date.now()}_${randomUUID()}.jsonl`);
        this.#currentFileSize = 0;
      }

      const content = this.#buffer.join('\n') + '\n';
      await appendFile(this.#currentFile, content);
      this.#currentFileSize += content.length;
      this.#buffer = [];

      this.logger.debug(`FileExporter flushed ${content.length} bytes to ${this.#currentFile}`);
    } catch (error) {
      this.logger.error('FileExporter flush failed', { error });
    }
  }

  async shutdown(): Promise<void> {
    if (this.#flushTimer) {
      clearInterval(this.#flushTimer);
      this.#flushTimer = null;
    }
    await this.flush();
    await super.shutdown();
  }
}
```

**File: `observability/mastra/src/exporters/index.ts`** (MODIFY)

Add export:
```typescript
export * from './file';
```

**File: `observability/mastra/src/default.ts`** (MODIFY)

Add FileExporter to default instance when env var is set:

```typescript
// In the constructor, after creating DefaultObservabilityInstance:
import { FileExporter } from './exporters/file';

// Modify the default instance creation (around line 90-96):
const exporters = [new DefaultExporter(), new CloudExporter()];

// Add FileExporter if env var is set
if (process.env.MASTRA_CLOUD_TRACES_TARGET_DIR) {
  exporters.push(new FileExporter());
}

const defaultInstance = new DefaultObservabilityInstance({
  serviceName: 'mastra',
  name: 'default',
  sampling: { type: SamplingStrategyType.ALWAYS },
  exporters,
  spanOutputProcessors: [new SensitiveDataFilter()],
});
```

#### 2. Create `@mastra/runner-local` Package

**Directory**: `runners/local/`

**Files to create**:

```
runners/local/
├── src/
│   ├── index.ts
│   ├── runner.ts             # LocalRunner class
│   ├── builder.ts            # ProjectBuilder
│   ├── process-manager.ts    # ProcessManager
│   ├── port-allocator.ts     # PortAllocator
│   ├── types.ts
│   └── utils.ts
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── tsup.config.ts
└── vitest.config.ts
```

**File: `src/runner.ts`**

```typescript
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import type { Runner, Build, Deployment, Project, ProjectSourceProvider } from '@mastra/admin';
import { ProjectBuilder } from './builder';
import { ProcessManager } from './process-manager';
import { PortAllocator } from './port-allocator';

export interface LocalRunnerConfig {
  source: ProjectSourceProvider;
  buildDir?: string;
  portRange?: { min: number; max: number };
}

export class LocalRunner implements Runner {
  #source: ProjectSourceProvider;
  #buildDir: string;
  #builder: ProjectBuilder;
  #processManager: ProcessManager;
  #portAllocator: PortAllocator;

  constructor(config: LocalRunnerConfig) {
    this.#source = config.source;
    this.#buildDir = config.buildDir ?? join(tmpdir(), 'mastra', 'builds');
    this.#builder = new ProjectBuilder();
    this.#processManager = new ProcessManager();
    this.#portAllocator = new PortAllocator(config.portRange ?? { min: 4100, max: 4199 });
  }

  async build(build: Build, deployment: Deployment, project: Project): Promise<void> {
    const buildPath = join(this.#buildDir, build.id);
    await mkdir(buildPath, { recursive: true });

    // Get project source and copy to build directory
    const projectSource = await this.#source.getProject(project.sourceConfig.sourceId as string);
    if (!projectSource) {
      throw new Error(`Project source not found: ${project.sourceConfig.sourceId}`);
    }

    await this.#source.getProjectPath(projectSource, buildPath);

    // Run build
    await this.#builder.build(buildPath, {
      packageManager: projectSource.metadata?.packageManager as string ?? 'npm',
    });
  }

  async start(deployment: Deployment, build: Build, port: number): Promise<{ processId: number }> {
    const buildPath = join(this.#buildDir, build.id);
    const observabilityDir = join(buildPath, 'observability');

    // Create observability directories
    await mkdir(join(observabilityDir, 'spans'), { recursive: true });
    await mkdir(join(observabilityDir, 'logs'), { recursive: true });

    // Start the server with env vars for observability
    const processId = await this.#processManager.start(buildPath, {
      PORT: String(port),
      MASTRA_CLOUD_TRACES_TARGET_DIR: join(observabilityDir, 'spans'),
      MASTRA_RUNNER_LOGS_TARGET_DIR: join(observabilityDir, 'logs'),
      MASTRA_PROJECT_ID: deployment.projectId,
      MASTRA_DEPLOYMENT_ID: deployment.id,
    });

    return { processId };
  }

  async stop(deployment: Deployment): Promise<void> {
    if (deployment.processId) {
      await this.#processManager.stop(deployment.processId);
    }
  }

  async isRunning(processId: number): Promise<boolean> {
    return this.#processManager.isRunning(processId);
  }

  allocatePort(): number {
    return this.#portAllocator.allocate();
  }

  releasePort(port: number): void {
    this.#portAllocator.release(port);
  }
}
```

**File: `src/builder.ts`**

```typescript
import { spawn } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';

export interface BuildOptions {
  packageManager: string;
  onLog?: (line: string) => void;
}

export class ProjectBuilder {
  async build(projectPath: string, options: BuildOptions): Promise<void> {
    const { packageManager, onLog } = options;

    // Install dependencies
    await this.exec(projectPath, this.getInstallCommand(packageManager), onLog);

    // Run mastra build
    await this.exec(projectPath, this.getBuildCommand(packageManager), onLog);
  }

  private getInstallCommand(packageManager: string): string[] {
    switch (packageManager) {
      case 'pnpm':
        return ['pnpm', 'install', '--frozen-lockfile'];
      case 'yarn':
        return ['yarn', 'install', '--frozen-lockfile'];
      case 'bun':
        return ['bun', 'install', '--frozen-lockfile'];
      default:
        return ['npm', 'ci'];
    }
  }

  private getBuildCommand(packageManager: string): string[] {
    switch (packageManager) {
      case 'pnpm':
        return ['pnpm', 'exec', 'mastra', 'build'];
      case 'yarn':
        return ['yarn', 'mastra', 'build'];
      case 'bun':
        return ['bun', 'run', 'mastra', 'build'];
      default:
        return ['npx', 'mastra', 'build'];
    }
  }

  private exec(cwd: string, command: string[], onLog?: (line: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command;
      const proc = spawn(cmd, args, { cwd, shell: true });

      proc.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        lines.forEach((line: string) => onLog?.(line));
      });

      proc.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        lines.forEach((line: string) => onLog?.(line));
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}: ${command.join(' ')}`));
        }
      });

      proc.on('error', reject);
    });
  }
}
```

**File: `src/process-manager.ts`**

```typescript
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

interface RunningProcess {
  process: ChildProcess;
  port: number;
}

export class ProcessManager {
  #processes = new Map<number, RunningProcess>();

  async start(buildPath: string, env: Record<string, string>): Promise<number> {
    const entryPoint = join(buildPath, '.mastra', 'output', 'index.mjs');

    const process = spawn('node', [entryPoint], {
      cwd: buildPath,
      env: { ...process.env, ...env },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Unref so parent can exit independently
    process.unref();

    if (!process.pid) {
      throw new Error('Failed to start process');
    }

    this.#processes.set(process.pid, {
      process,
      port: parseInt(env.PORT, 10),
    });

    return process.pid;
  }

  async stop(processId: number): Promise<void> {
    const running = this.#processes.get(processId);
    if (running) {
      running.process.kill('SIGTERM');
      this.#processes.delete(processId);
    } else {
      // Process might have been started before this instance
      try {
        process.kill(processId, 'SIGTERM');
      } catch {
        // Process already dead
      }
    }
  }

  isRunning(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    } catch {
      return false;
    }
  }
}
```

**File: `src/port-allocator.ts`**

```typescript
export class PortAllocator {
  #min: number;
  #max: number;
  #allocated = new Set<number>();

  constructor(range: { min: number; max: number }) {
    this.#min = range.min;
    this.#max = range.max;
  }

  allocate(): number {
    for (let port = this.#min; port <= this.#max; port++) {
      if (!this.#allocated.has(port)) {
        this.#allocated.add(port);
        return port;
      }
    }
    throw new Error('No available ports in range');
  }

  release(port: number): void {
    this.#allocated.delete(port);
  }

  isAllocated(port: number): boolean {
    return this.#allocated.has(port);
  }
}
```

#### 3. Create Build Orchestrator

**File: `packages/admin-server/src/orchestrator/build-orchestrator.ts`** (part of Phase 3 package, but core logic here)

```typescript
import type { MastraAdmin, Build, Deployment, Project } from '@mastra/admin';

interface QueuedBuild {
  buildId: string;
  deploymentId: string;
}

export class BuildOrchestrator {
  #admin: MastraAdmin;
  #queue: QueuedBuild[] = [];
  #processing = false;
  #onLog?: (buildId: string, line: string) => void;

  constructor(admin: MastraAdmin, onLog?: (buildId: string, line: string) => void) {
    this.#admin = admin;
    this.#onLog = onLog;
  }

  /**
   * Recover queued builds on startup (critical for restart recovery)
   */
  async recoverQueue(): Promise<void> {
    const queuedBuilds = await this.#admin.storage.builds.listByStatus('queued');
    for (const build of queuedBuilds) {
      this.#queue.push({ buildId: build.id, deploymentId: build.deploymentId });
    }
    this.processQueue();
  }

  async queueBuild(deploymentId: string, trigger: 'manual' | 'webhook' | 'schedule' = 'manual'): Promise<Build> {
    const build = await this.#admin.storage.builds.create({
      deploymentId,
      trigger,
      status: 'queued',
      logPath: null,
      queuedAt: new Date(),
      startedAt: null,
      completedAt: null,
      errorMessage: null,
    });

    this.#queue.push({ buildId: build.id, deploymentId });
    this.processQueue();

    return build;
  }

  private async processQueue(): Promise<void> {
    if (this.#processing || this.#queue.length === 0) {
      return;
    }

    this.#processing = true;

    while (this.#queue.length > 0) {
      const item = this.#queue.shift()!;
      await this.processBuild(item);
    }

    this.#processing = false;
  }

  private async processBuild(item: QueuedBuild): Promise<void> {
    const { buildId, deploymentId } = item;

    try {
      // Update build status
      await this.#admin.storage.builds.update(buildId, {
        status: 'building',
        startedAt: new Date(),
      });

      // Get deployment and project
      const deployment = await this.#admin.storage.deployments.getById(deploymentId);
      if (!deployment) throw new Error('Deployment not found');

      const project = await this.#admin.storage.projects.getById(deployment.projectId);
      if (!project) throw new Error('Project not found');

      const build = await this.#admin.storage.builds.getById(buildId);
      if (!build) throw new Error('Build not found');

      // Run build
      await this.#admin.runner.build(build, deployment, project);

      // Update to deploying
      await this.#admin.storage.builds.update(buildId, { status: 'deploying' });

      // Allocate port and start server
      const port = (this.#admin.runner as any).allocatePort?.() ?? 4100;
      const { processId } = await this.#admin.runner.start(deployment, build, port);

      // Generate public URL
      const team = await this.#admin.storage.teams.getById(project.teamId);
      const publicUrl = `http://${project.slug}-${deployment.branch}.${team?.slug ?? 'default'}.mastra.local`;

      // Update deployment
      await this.#admin.storage.deployments.update(deploymentId, {
        status: 'running',
        currentBuildId: buildId,
        port,
        processId,
        publicUrl,
      });

      // Register route
      await this.#admin.router.register({
        subdomain: `${project.slug}-${deployment.branch}.${team?.slug ?? 'default'}`,
        targetPort: port,
        targetHost: 'localhost',
      });

      // Mark build succeeded
      await this.#admin.storage.builds.update(buildId, {
        status: 'succeeded',
        completedAt: new Date(),
      });

    } catch (error) {
      await this.#admin.storage.builds.update(buildId, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      await this.#admin.storage.deployments.update(deploymentId, {
        status: 'failed',
      });
    }
  }
}
```

### Success Criteria

#### Automated Verification:
- [ ] `pnpm build` succeeds for `@mastra/runner-local`
- [ ] FileExporter unit tests pass
- [ ] Runner unit tests pass
- [ ] Build orchestrator unit tests pass

#### Manual Verification:
- [ ] Build completes successfully for a test project
- [ ] Server starts with env vars set (MASTRA_CLOUD_TRACES_TARGET_DIR, etc.)
- [ ] Spans written to `observability/spans/` directory
- [ ] Logs written to `observability/logs/` directory
- [ ] Restart recovery re-queues pending builds

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: API & Routing [P0]

### Overview

Create the HTTP API server with SSE for build log streaming and subdomain-based routing via reverse proxy.

### Changes Required

#### 1. Create `@mastra/admin-server` Package

**Directory**: `packages/admin-server/`

**Files to create**:

```
packages/admin-server/
├── src/
│   ├── index.ts
│   ├── server.ts             # AdminServer class
│   ├── routes/
│   │   ├── index.ts
│   │   ├── teams.ts
│   │   ├── projects.ts
│   │   ├── deployments.ts
│   │   ├── builds.ts
│   │   └── sources.ts
│   ├── handlers/
│   │   ├── teams.ts
│   │   ├── projects.ts
│   │   ├── deployments.ts
│   │   ├── builds.ts
│   │   └── sources.ts
│   ├── orchestrator/
│   │   ├── build-orchestrator.ts
│   │   └── log-cache.ts
│   └── middleware/
│       └── cors.ts
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── tsup.config.ts
└── vitest.config.ts
```

**File: `src/server.ts`**

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { serve } from '@hono/node-server';
import type { MastraAdmin } from '@mastra/admin';
import { BuildOrchestrator } from './orchestrator/build-orchestrator';
import { LogCache } from './orchestrator/log-cache';
import { teamsRoutes } from './routes/teams';
import { projectsRoutes } from './routes/projects';
import { deploymentsRoutes } from './routes/deployments';
import { buildsRoutes } from './routes/builds';
import { sourcesRoutes } from './routes/sources';

export interface AdminServerConfig {
  admin: MastraAdmin;
  port?: number;
  corsOrigins?: string[];
}

export class AdminServer {
  #admin: MastraAdmin;
  #app: Hono;
  #port: number;
  #orchestrator: BuildOrchestrator;
  #logCache: LogCache;
  #server: ReturnType<typeof serve> | null = null;

  constructor(config: AdminServerConfig) {
    this.#admin = config.admin;
    this.#port = config.port ?? 3001;
    this.#logCache = new LogCache();
    this.#orchestrator = new BuildOrchestrator(
      this.#admin,
      (buildId, line) => this.#logCache.append(buildId, line)
    );

    this.#app = new Hono();
    this.setupMiddleware(config.corsOrigins);
    this.setupRoutes();
  }

  private setupMiddleware(corsOrigins?: string[]): void {
    this.#app.use('*', cors({
      origin: corsOrigins ?? ['http://localhost:3002', 'http://localhost:5173'],
      credentials: true,
    }));
  }

  private setupRoutes(): void {
    const ctx = {
      admin: this.#admin,
      orchestrator: this.#orchestrator,
      logCache: this.#logCache,
    };

    this.#app.route('/api/teams', teamsRoutes(ctx));
    this.#app.route('/api/projects', projectsRoutes(ctx));
    this.#app.route('/api/deployments', deploymentsRoutes(ctx));
    this.#app.route('/api/builds', buildsRoutes(ctx));
    this.#app.route('/api/sources', sourcesRoutes(ctx));

    // SSE endpoint for build logs
    this.#app.get('/api/builds/:buildId/logs/stream', async (c) => {
      const buildId = c.req.param('buildId');

      return streamSSE(c, async (stream) => {
        // Send existing logs
        const existingLogs = this.#logCache.get(buildId);
        for (const line of existingLogs) {
          await stream.writeSSE({ data: line, event: 'log' });
        }

        // Subscribe to new logs
        const unsubscribe = this.#logCache.subscribe(buildId, async (line) => {
          await stream.writeSSE({ data: line, event: 'log' });
        });

        // Keep connection alive
        const interval = setInterval(async () => {
          await stream.writeSSE({ data: '', event: 'ping' });
        }, 15000);

        // Cleanup on disconnect
        stream.onAbort(() => {
          unsubscribe();
          clearInterval(interval);
        });

        // Wait for build completion or disconnect
        await new Promise(() => {}); // Hold connection open
      });
    });

    // Health check
    this.#app.get('/health', (c) => c.json({ status: 'ok' }));
  }

  async start(): Promise<void> {
    // Initialize admin
    await this.#admin.init();

    // Recover build queue
    await this.#orchestrator.recoverQueue();

    // Start HTTP server
    this.#server = serve({
      fetch: this.#app.fetch,
      port: this.#port,
    });

    console.log(`MastraAdmin server running on http://localhost:${this.#port}`);
  }

  async stop(): Promise<void> {
    if (this.#server) {
      this.#server.close();
    }
    await this.#admin.close();
  }

  get app(): Hono {
    return this.#app;
  }
}
```

**File: `src/routes/teams.ts`**

```typescript
import { Hono } from 'hono';
import type { MastraAdmin } from '@mastra/admin';
import type { BuildOrchestrator } from '../orchestrator/build-orchestrator';
import type { LogCache } from '../orchestrator/log-cache';

interface RouteContext {
  admin: MastraAdmin;
  orchestrator: BuildOrchestrator;
  logCache: LogCache;
}

export function teamsRoutes(ctx: RouteContext): Hono {
  const app = new Hono();
  const { admin } = ctx;

  // List teams
  app.get('/', async (c) => {
    const teams = await admin.storage.teams.list();
    return c.json({ teams });
  });

  // Get team by ID
  app.get('/:id', async (c) => {
    const team = await admin.storage.teams.getById(c.req.param('id'));
    if (!team) {
      return c.json({ error: 'Team not found' }, 404);
    }
    return c.json({ team });
  });

  // Create team
  app.post('/', async (c) => {
    const body = await c.req.json();
    const team = await admin.storage.teams.create({
      name: body.name,
      slug: body.slug ?? body.name.toLowerCase().replace(/\s+/g, '-'),
    });
    return c.json({ team }, 201);
  });

  // Update team
  app.patch('/:id', async (c) => {
    const body = await c.req.json();
    const team = await admin.storage.teams.update(c.req.param('id'), body);
    return c.json({ team });
  });

  // Delete team
  app.delete('/:id', async (c) => {
    await admin.storage.teams.delete(c.req.param('id'));
    return c.json({ success: true });
  });

  return app;
}
```

**File: `src/routes/sources.ts`**

```typescript
import { Hono } from 'hono';
import type { MastraAdmin } from '@mastra/admin';

interface RouteContext {
  admin: MastraAdmin;
}

export function sourcesRoutes(ctx: RouteContext): Hono {
  const app = new Hono();
  const { admin } = ctx;

  // List available projects from source provider
  app.get('/projects', async (c) => {
    const projects = await admin.source.listProjects();
    return c.json({ projects });
  });

  // Get specific project from source
  app.get('/projects/:id', async (c) => {
    const project = await admin.source.getProject(c.req.param('id'));
    if (!project) {
      return c.json({ error: 'Project source not found' }, 404);
    }
    return c.json({ project });
  });

  // Validate project access
  app.post('/projects/:id/validate', async (c) => {
    const project = await admin.source.getProject(c.req.param('id'));
    if (!project) {
      return c.json({ error: 'Project source not found' }, 404);
    }
    const valid = await admin.source.validateAccess(project);
    return c.json({ valid });
  });

  return app;
}
```

**File: `src/orchestrator/log-cache.ts`**

```typescript
type LogCallback = (line: string) => void;

interface CachedLogs {
  lines: string[];
  subscribers: Set<LogCallback>;
}

export class LogCache {
  #cache = new Map<string, CachedLogs>();
  #maxLines = 10000;

  append(buildId: string, line: string): void {
    let cached = this.#cache.get(buildId);
    if (!cached) {
      cached = { lines: [], subscribers: new Set() };
      this.#cache.set(buildId, cached);
    }

    cached.lines.push(line);

    // Trim if too large
    if (cached.lines.length > this.#maxLines) {
      cached.lines = cached.lines.slice(-this.#maxLines);
    }

    // Notify subscribers
    for (const callback of cached.subscribers) {
      callback(line);
    }
  }

  get(buildId: string): string[] {
    return this.#cache.get(buildId)?.lines ?? [];
  }

  subscribe(buildId: string, callback: LogCallback): () => void {
    let cached = this.#cache.get(buildId);
    if (!cached) {
      cached = { lines: [], subscribers: new Set() };
      this.#cache.set(buildId, cached);
    }

    cached.subscribers.add(callback);

    return () => {
      cached?.subscribers.delete(callback);
    };
  }

  clear(buildId: string): void {
    this.#cache.delete(buildId);
  }
}
```

#### 2. Create `@mastra/router-local` Package

**Directory**: `routers/local/`

**Files to create**:

```
routers/local/
├── src/
│   ├── index.ts
│   ├── router.ts             # LocalRouter class
│   └── proxy.ts              # Reverse proxy implementation
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── tsup.config.ts
```

**File: `src/router.ts`**

```typescript
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { request as httpRequest } from 'node:http';
import type { Router, RouteConfig } from '@mastra/admin';

export interface LocalRouterConfig {
  port?: number;
  baseDomain?: string;
}

export class LocalRouter implements Router {
  #routes = new Map<string, RouteConfig>();
  #port: number;
  #baseDomain: string;
  #server: ReturnType<typeof createServer> | null = null;

  constructor(config: LocalRouterConfig = {}) {
    this.#port = config.port ?? 80;
    this.#baseDomain = config.baseDomain ?? 'mastra.local';
  }

  async register(config: RouteConfig): Promise<void> {
    this.#routes.set(config.subdomain, config);
  }

  async unregister(subdomain: string): Promise<void> {
    this.#routes.delete(subdomain);
  }

  getRoute(subdomain: string): RouteConfig | undefined {
    return this.#routes.get(subdomain);
  }

  start(): void {
    this.#server = createServer((req, res) => this.handleRequest(req, res));
    this.#server.listen(this.#port, () => {
      console.log(`LocalRouter listening on port ${this.#port}`);
    });
  }

  stop(): void {
    if (this.#server) {
      this.#server.close();
      this.#server = null;
    }
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const host = req.headers.host ?? '';

    // Extract subdomain: {project}-{branch}.{team}.mastra.local
    // Full subdomain is everything before .mastra.local
    const subdomainMatch = host.match(new RegExp(`^(.+)\\.${this.#baseDomain.replace('.', '\\.')}(?::\\d+)?$`));

    if (!subdomainMatch) {
      res.writeHead(404);
      res.end('Not found: Invalid host');
      return;
    }

    const fullSubdomain = subdomainMatch[1];
    const route = this.#routes.get(fullSubdomain);

    if (!route) {
      res.writeHead(404);
      res.end(`Not found: No route for ${fullSubdomain}`);
      return;
    }

    // Proxy the request
    const proxyReq = httpRequest(
      {
        hostname: route.targetHost,
        port: route.targetPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 500, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err);
      res.writeHead(502);
      res.end('Bad Gateway');
    });

    req.pipe(proxyReq);
  }
}
```

### Success Criteria

#### Automated Verification:
- [ ] `pnpm build` succeeds for `@mastra/admin-server`, `@mastra/router-local`
- [ ] API route tests pass
- [ ] SSE streaming tests pass
- [ ] Router tests pass

#### Manual Verification:
- [ ] All CRUD operations work via HTTP (curl/Postman)
- [ ] Deploy triggers build via API
- [ ] Build logs stream via SSE
- [ ] Deployed server accessible via subdomain (e.g., `myapp-main.team.mastra.local`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Observability Ingestion [P1]

### Overview

Create ClickHouse schema, ingestion worker, and query provider for observability data.

### Changes Required

#### 1. Create `@mastra/observability-clickhouse` Package

**Directory**: `observability/clickhouse/`

**Files to create**:

```
observability/clickhouse/
├── src/
│   ├── index.ts
│   ├── client.ts             # ClickHouse client wrapper
│   ├── schema.ts             # Table schemas
│   ├── ingestion/
│   │   ├── worker.ts         # IngestionWorker
│   │   └── parser.ts         # JSONL parser
│   └── queries/
│       ├── spans.ts
│       └── logs.ts
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── tsup.config.ts
└── docker-compose.yaml
```

**File: `src/schema.ts`**

```typescript
export const SPANS_TABLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS mastra_admin_spans (
  id UUID,
  trace_id String,
  parent_span_id Nullable(String),
  name String,
  type String,
  start_time DateTime64(3),
  end_time Nullable(DateTime64(3)),
  status String,
  project_id String,
  deployment_id String,
  attributes String, -- JSON
  events String, -- JSON array
  created_at DateTime64(3) DEFAULT now64(3)
) ENGINE = MergeTree()
ORDER BY (project_id, deployment_id, start_time, id)
`;

export const LOGS_TABLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS mastra_admin_logs (
  id UUID DEFAULT generateUUIDv4(),
  timestamp DateTime64(3),
  level String,
  message String,
  project_id String,
  deployment_id String,
  metadata String, -- JSON
  created_at DateTime64(3) DEFAULT now64(3)
) ENGINE = MergeTree()
ORDER BY (project_id, deployment_id, timestamp, id)
`;
```

**File: `src/ingestion/worker.ts`**

```typescript
import { readdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { ClickHouseClient } from '../client';
import { parseSpanLine, parseLogLine } from './parser';

export interface IngestionWorkerConfig {
  client: ClickHouseClient;
  spansDir: string;
  logsDir: string;
  pollIntervalMs?: number;
  batchSize?: number;
}

export class IngestionWorker {
  #client: ClickHouseClient;
  #spansDir: string;
  #logsDir: string;
  #pollIntervalMs: number;
  #batchSize: number;
  #timer: NodeJS.Timeout | null = null;
  #running = false;

  constructor(config: IngestionWorkerConfig) {
    this.#client = config.client;
    this.#spansDir = config.spansDir;
    this.#logsDir = config.logsDir;
    this.#pollIntervalMs = config.pollIntervalMs ?? 10000;
    this.#batchSize = config.batchSize ?? 1000;
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.poll();
  }

  stop(): void {
    this.#running = false;
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this.#running) return;

    try {
      await this.processDirectory(this.#spansDir, 'spans');
      await this.processDirectory(this.#logsDir, 'logs');
    } catch (error) {
      console.error('Ingestion error:', error);
    }

    this.#timer = setTimeout(() => this.poll(), this.#pollIntervalMs);
  }

  private async processDirectory(dir: string, type: 'spans' | 'logs'): Promise<void> {
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return; // Directory doesn't exist yet
    }

    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    for (const file of jsonlFiles) {
      const filePath = join(dir, file);
      await this.processFile(filePath, type);
    }
  }

  private async processFile(filePath: string, type: 'spans' | 'logs'): Promise<void> {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    const batch: any[] = [];

    for (const line of lines) {
      try {
        const parsed = type === 'spans' ? parseSpanLine(line) : parseLogLine(line);
        if (parsed) {
          batch.push(parsed);
        }

        if (batch.length >= this.#batchSize) {
          await this.insertBatch(batch, type);
          batch.length = 0;
        }
      } catch (error) {
        console.error('Parse error:', error);
      }
    }

    if (batch.length > 0) {
      await this.insertBatch(batch, type);
    }

    // Delete processed file
    await unlink(filePath);
  }

  private async insertBatch(batch: any[], type: 'spans' | 'logs'): Promise<void> {
    const table = type === 'spans' ? 'mastra_admin_spans' : 'mastra_admin_logs';
    await this.#client.insert(table, batch);
  }
}
```

#### 2. Add Observability Routes to Admin Server

**File: `packages/admin-server/src/routes/observability.ts`** (NEW)

```typescript
import { Hono } from 'hono';
import type { ClickHouseClient } from '@mastra/observability-clickhouse';

interface RouteContext {
  clickhouse: ClickHouseClient;
}

export function observabilityRoutes(ctx: RouteContext): Hono {
  const app = new Hono();
  const { clickhouse } = ctx;

  // Get spans by project
  app.get('/spans', async (c) => {
    const projectId = c.req.query('projectId');
    const deploymentId = c.req.query('deploymentId');
    const limit = parseInt(c.req.query('limit') ?? '100', 10);
    const offset = parseInt(c.req.query('offset') ?? '0', 10);

    const conditions: string[] = [];
    const params: any[] = [];

    if (projectId) {
      conditions.push('project_id = ?');
      params.push(projectId);
    }
    if (deploymentId) {
      conditions.push('deployment_id = ?');
      params.push(deploymentId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const spans = await clickhouse.query(`
      SELECT * FROM mastra_admin_spans
      ${where}
      ORDER BY start_time DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return c.json({ spans });
  });

  // Get spans by trace
  app.get('/traces/:traceId', async (c) => {
    const traceId = c.req.param('traceId');

    const spans = await clickhouse.query(`
      SELECT * FROM mastra_admin_spans
      WHERE trace_id = ?
      ORDER BY start_time ASC
    `, [traceId]);

    return c.json({ spans });
  });

  // Get logs
  app.get('/logs', async (c) => {
    const projectId = c.req.query('projectId');
    const deploymentId = c.req.query('deploymentId');
    const level = c.req.query('level');
    const limit = parseInt(c.req.query('limit') ?? '100', 10);
    const offset = parseInt(c.req.query('offset') ?? '0', 10);

    const conditions: string[] = [];
    const params: any[] = [];

    if (projectId) {
      conditions.push('project_id = ?');
      params.push(projectId);
    }
    if (deploymentId) {
      conditions.push('deployment_id = ?');
      params.push(deploymentId);
    }
    if (level) {
      conditions.push('level = ?');
      params.push(level);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const logs = await clickhouse.query(`
      SELECT * FROM mastra_admin_logs
      ${where}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return c.json({ logs });
  });

  return app;
}
```

### Success Criteria

#### Automated Verification:
- [ ] `pnpm build` succeeds for `@mastra/observability-clickhouse`
- [ ] ClickHouse schema creation works
- [ ] Ingestion worker unit tests pass
- [ ] Query tests pass

#### Manual Verification:
- [ ] IngestionWorker picks up JSONL files from observability directories
- [ ] Spans appear in ClickHouse after agent execution
- [ ] Query API returns spans with correct projectId/deploymentId filtering
- [ ] Logs appear in ClickHouse

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Admin UI [P1]

### Overview

Create the React-based Admin UI dashboard with project management, build logs viewer, and observability dashboard.

### Changes Required

#### 1. Create `@mastra/admin-ui` Package

**Directory**: `packages/admin-ui/`

**Structure**:

```
packages/admin-ui/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   └── client.ts         # API client
│   ├── hooks/
│   │   ├── useTeams.ts
│   │   ├── useProjects.ts
│   │   ├── useDeployments.ts
│   │   ├── useBuilds.ts
│   │   └── useBuildLogs.ts   # SSE hook
│   ├── pages/
│   │   ├── TeamsPage.tsx
│   │   ├── ProjectsPage.tsx
│   │   ├── DeploymentPage.tsx
│   │   ├── BuildPage.tsx
│   │   └── ObservabilityPage.tsx
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── TeamList.tsx
│   │   ├── ProjectList.tsx
│   │   ├── ProjectSelector.tsx  # Discovers projects from source
│   │   ├── DeploymentCard.tsx
│   │   ├── BuildLogViewer.tsx   # SSE streaming
│   │   ├── SpanViewer.tsx
│   │   └── LogViewer.tsx
│   └── lib/
│       └── sse.ts            # SSE utilities
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

**File: `src/hooks/useBuildLogs.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react';

interface UseBuildLogsOptions {
  buildId: string;
  enabled?: boolean;
}

export function useBuildLogs({ buildId, enabled = true }: UseBuildLogsOptions) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !buildId) return;

    const eventSource = new EventSource(
      `${import.meta.env.VITE_API_URL}/api/builds/${buildId}/logs/stream`
    );

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.addEventListener('log', (event) => {
      if (event.data) {
        setLogs((prev) => [...prev, event.data]);
      }
    });

    eventSource.addEventListener('ping', () => {
      // Keep-alive, do nothing
    });

    eventSource.onerror = (err) => {
      setError(new Error('SSE connection error'));
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [buildId, enabled]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, isConnected, error, clearLogs };
}
```

**File: `src/components/ProjectSelector.tsx`**

```typescript
import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

interface ProjectSource {
  id: string;
  name: string;
  path: string;
  metadata?: {
    packageManager?: string;
    mastraVersion?: string;
  };
}

interface ProjectSelectorProps {
  onSelect: (project: ProjectSource) => void;
}

export function ProjectSelector({ onSelect }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<ProjectSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await apiClient.get('/api/sources/projects');
        setProjects(response.projects);
      } catch (err) {
        setError('Failed to load available projects');
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  if (loading) return <div>Loading available projects...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (projects.length === 0) return <div>No Mastra projects found in configured directories</div>;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Select a Mastra Project</label>
      <select
        className="w-full p-2 border rounded"
        onChange={(e) => {
          const project = projects.find(p => p.id === e.target.value);
          if (project) onSelect(project);
        }}
        defaultValue=""
      >
        <option value="" disabled>Choose a project...</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name} ({project.path})
          </option>
        ))}
      </select>
    </div>
  );
}
```

**File: `src/components/BuildLogViewer.tsx`**

```typescript
import { useEffect, useRef } from 'react';
import { useBuildLogs } from '../hooks/useBuildLogs';

interface BuildLogViewerProps {
  buildId: string;
}

export function BuildLogViewer({ buildId }: BuildLogViewerProps) {
  const { logs, isConnected, error } = useBuildLogs({ buildId });
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 border-b">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm">
          {isConnected ? 'Connected' : error ? 'Disconnected' : 'Connecting...'}
        </span>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-black text-green-400 font-mono text-sm p-4"
      >
        {logs.map((line, index) => (
          <div key={index} className="whitespace-pre-wrap">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Success Criteria

#### Automated Verification:
- [ ] `pnpm build` succeeds for `@mastra/admin-ui`
- [ ] TypeScript compilation passes
- [ ] Linting passes

#### Manual Verification:
- [ ] Complete flow: Create team → Select project from source → Create project → Deploy → View logs
- [ ] Project selector shows discovered Mastra projects from `source-local`
- [ ] Build logs stream in real-time via SSE
- [ ] Observability data displays correctly (spans, logs)
- [ ] UI handles errors gracefully (loading states, error messages)
- [ ] Navigation works between all pages

**Implementation Note**: After completing this phase and all verification passes, the MVP is complete.

---

## Testing Strategy

### Unit Tests

Each package should have unit tests for:
- Storage domain CRUD operations
- Source provider project detection
- Build orchestrator queue management
- FileExporter file writing
- Router route matching

### Integration Tests

- Admin API with real PostgreSQL (docker-compose)
- ClickHouse ingestion with real ClickHouse (docker-compose)
- End-to-end build flow with test Mastra project

### Manual Testing Steps

1. Start admin server: `node packages/admin-server/dist/index.js`
2. Start UI: `cd packages/admin-ui && pnpm dev`
3. Create team via API or UI
4. Discover and select a Mastra project
5. Create deployment and trigger build
6. Verify build logs stream in UI
7. Call deployed server's API
8. Verify spans appear in observability dashboard

---

## Performance Considerations

1. **Build queue**: Single worker with DB-backed recovery; can scale horizontally later
2. **Log cache**: In-memory with max line limit; flushes to file storage
3. **ClickHouse batching**: Ingestion worker batches inserts for efficiency
4. **File rotation**: FileExporter rotates at 10MB per file
5. **SSE connections**: Keep-alive pings every 15 seconds

---

## Migration Notes

N/A - This is a greenfield implementation. No existing data to migrate.

---

## References

- Original PRD: `thoughts/shared/research/2025-01-27-mastra-admin-v2-prd.md`
- BaseExporter pattern: `observability/mastra/src/exporters/base.ts:84`
- PostgresStore pattern: `stores/pg/src/storage/index.ts:58`
- Hono server pattern: `server-adapters/hono/src/index.ts`
- PinoLogger: `packages/loggers/src/pino.ts:24`
- FileTransport: `packages/loggers/src/file/index.ts:6`
