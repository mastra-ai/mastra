# LANE 4: @mastra/source-local Implementation Plan

## Overview

**Package**: `@mastra/source-local`
**Location**: `sources/local/`
**Priority**: P0 (MVP - enables development and testing without external services)
**Dependencies**: LANE 1 (`@mastra/admin` core package) - for `ProjectSourceProvider` interface

This package provides a local filesystem-based project source provider that discovers and manages Mastra projects from configured directories on the local machine. It's the foundation for local development and self-hosted deployments without requiring external services like GitHub.

---

## Package Setup

### Directory Structure

```
sources/local/
├── src/
│   ├── index.ts                    # Main exports
│   ├── provider.ts                 # LocalProjectSource implementation
│   ├── types.ts                    # Local-specific types and config
│   ├── scanner.ts                  # Directory scanner for Mastra projects
│   ├── detector.ts                 # Mastra project detection logic
│   ├── watcher.ts                  # File change watcher
│   └── utils.ts                    # Utility functions
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── eslint.config.js
├── vitest.config.ts
├── CHANGELOG.md
└── turbo.json
```

### 1.1 package.json

```json
{
  "name": "@mastra/source-local",
  "version": "1.0.0",
  "description": "Local filesystem project source provider for MastraAdmin",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist",
    "CHANGELOG.md"
  ],
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build:lib": "tsup --silent --config tsup.config.ts",
    "build:docs": "pnpx tsx ../../scripts/generate-package-docs.ts sources/local",
    "build:watch": "pnpm build:lib --watch",
    "test": "vitest run",
    "lint": "eslint ."
  },
  "license": "Apache-2.0",
  "dependencies": {
    "chokidar": "^4.0.0",
    "fast-glob": "^3.3.0"
  },
  "devDependencies": {
    "@internal/lint": "workspace:*",
    "@internal/types-builder": "workspace:*",
    "@mastra/admin": "workspace:*",
    "@types/node": "22.13.17",
    "@vitest/coverage-v8": "catalog:",
    "@vitest/ui": "catalog:",
    "eslint": "^9.37.0",
    "memfs": "^4.0.0",
    "tsup": "^8.5.0",
    "typescript": "catalog:",
    "vitest": "catalog:"
  },
  "peerDependencies": {
    "@mastra/admin": ">=1.0.0-0 <2.0.0-0"
  },
  "homepage": "https://mastra.ai",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/mastra-ai/mastra.git",
    "directory": "sources/local"
  },
  "bugs": {
    "url": "https://github.com/mastra-ai/mastra/issues"
  },
  "engines": {
    "node": ">=22.13.0"
  }
}
```

### 1.2 tsconfig.json

```json
{
  "extends": "../../tsconfig.node.json",
  "include": ["src/**/*", "tsup.config.ts"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
```

### 1.3 tsup.config.ts

```typescript
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
```

### 1.4 eslint.config.js

```javascript
import { createConfig } from '@internal/lint/eslint';

const config = await createConfig();

/** @type {import("eslint").Linter.Config[]} */
export default [...config];
```

### 1.5 vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

### 1.6 turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "extends": ["//"],
  "tasks": {
    "build:lib": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "!dist/docs/**"]
    },
    "build:docs": {
      "dependsOn": ["build:lib"],
      "outputs": ["dist/docs/**"]
    },
    "build": {
      "dependsOn": ["build:lib", "build:docs"]
    }
  }
}
```

### 1.7 CHANGELOG.md

```markdown
# @mastra/source-local

## 1.0.0

### Features

- Initial release
- `LocalProjectSource` implementing `ProjectSourceProvider` interface
- Automatic Mastra project discovery via `MastraProjectDetector`
- File watching support for development hot-reload
- Support for npm, pnpm, yarn, and bun package managers
```

---

## Implementation Files

### 2.1 src/types.ts - Configuration and Types

```typescript
import type { ProjectSource, ChangeEvent } from '@mastra/admin';

/**
 * Configuration for the local project source provider.
 */
export interface LocalProjectSourceConfig {
  /**
   * Base directories to scan for Mastra projects.
   * All paths should be absolute.
   * @example ['/home/user/projects', '/opt/mastra-apps']
   */
  basePaths: string[];

  /**
   * Glob patterns to include when scanning for projects.
   * Relative to each base path.
   * @default ['*']
   */
  include?: string[];

  /**
   * Glob patterns to exclude from scanning.
   * Useful for ignoring node_modules, .git, etc.
   * @default ['node_modules', '.git', 'dist', 'build', '.next']
   */
  exclude?: string[];

  /**
   * Maximum depth to scan for projects.
   * @default 2
   */
  maxDepth?: number;

  /**
   * Whether to watch for file changes.
   * Only enable in development mode.
   * @default false
   */
  watchChanges?: boolean;

  /**
   * Debounce interval for file change events (ms).
   * @default 300
   */
  watchDebounceMs?: number;
}

/**
 * Supported package managers for Mastra projects.
 */
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

/**
 * Metadata about a detected Mastra project.
 */
export interface ProjectMetadata {
  /** Project name from package.json */
  name: string;

  /** Project version from package.json */
  version?: string;

  /** Description from package.json */
  description?: string;

  /** Detected package manager */
  packageManager: PackageManager;

  /** Whether the project has a mastra.config file */
  hasMastraConfig: boolean;

  /** Path to the mastra config file (if found) */
  mastraConfigPath?: string;

  /** Main entry point from package.json */
  entryPoint?: string;

  /** Whether the project uses TypeScript */
  isTypeScript: boolean;

  /** Dependencies that indicate this is a Mastra project */
  mastraDependencies: string[];
}

/**
 * Extended project source with local-specific metadata.
 */
export interface LocalProjectSource extends ProjectSource {
  type: 'local';
  /** Absolute path to the project directory */
  path: string;
  /** Detected project metadata */
  metadata: ProjectMetadata & Record<string, unknown>;
}

/**
 * Options for scanning directories.
 */
export interface ScanOptions {
  /** Base path to scan */
  basePath: string;

  /** Include patterns */
  include: string[];

  /** Exclude patterns */
  exclude: string[];

  /** Maximum depth */
  maxDepth: number;
}

/**
 * Result of scanning a directory.
 */
export interface ScanResult {
  /** Discovered Mastra projects */
  projects: LocalProjectSource[];

  /** Directories that were scanned but not valid Mastra projects */
  skipped: string[];

  /** Errors encountered during scanning */
  errors: ScanError[];
}

/**
 * Error encountered during scanning.
 */
export interface ScanError {
  path: string;
  error: string;
  code?: string;
}

/**
 * Re-export core types for convenience.
 */
export type { ProjectSource, ChangeEvent };
```

### 2.2 src/detector.ts - MastraProjectDetector

```typescript
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { PackageManager, ProjectMetadata } from './types';

/**
 * Filenames that indicate a Mastra configuration.
 */
const MASTRA_CONFIG_FILES = [
  'mastra.config.ts',
  'mastra.config.js',
  'mastra.config.mjs',
  'src/mastra/index.ts',
  'src/mastra/index.js',
];

/**
 * Package names that indicate a Mastra project.
 */
const MASTRA_PACKAGES = [
  '@mastra/core',
  'mastra',
  '@mastra/cli',
  '@mastra/server',
];

/**
 * Lock files and their corresponding package managers.
 */
const LOCK_FILES: Record<string, PackageManager> = {
  'pnpm-lock.yaml': 'pnpm',
  'yarn.lock': 'yarn',
  'bun.lockb': 'bun',
  'package-lock.json': 'npm',
};

/**
 * Detects whether a directory contains a valid Mastra project
 * and extracts project metadata.
 */
export class MastraProjectDetector {
  /**
   * Check if a directory is a valid Mastra project.
   *
   * A directory is considered a Mastra project if:
   * 1. It has a package.json file
   * 2. It has @mastra/core or mastra as a dependency
   *    OR it has a mastra.config file
   *
   * @param dir - Absolute path to the directory
   * @returns True if the directory is a Mastra project
   */
  async isMastraProject(dir: string): Promise<boolean> {
    try {
      // Check for package.json
      const packageJsonPath = path.join(dir, 'package.json');
      const packageJsonExists = await this.fileExists(packageJsonPath);
      if (!packageJsonExists) {
        return false;
      }

      // Check for Mastra config file
      const hasMastraConfig = await this.findMastraConfig(dir);
      if (hasMastraConfig) {
        return true;
      }

      // Check for Mastra dependencies in package.json
      const packageJson = await this.readPackageJson(dir);
      if (!packageJson) {
        return false;
      }

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      return MASTRA_PACKAGES.some((pkg) => pkg in allDeps);
    } catch {
      return false;
    }
  }

  /**
   * Get metadata about a Mastra project.
   *
   * @param dir - Absolute path to the project directory
   * @returns Project metadata
   * @throws Error if not a valid Mastra project
   */
  async getProjectMetadata(dir: string): Promise<ProjectMetadata> {
    const packageJson = await this.readPackageJson(dir);
    if (!packageJson) {
      throw new Error(`No package.json found in ${dir}`);
    }

    const isValid = await this.isMastraProject(dir);
    if (!isValid) {
      throw new Error(`Directory ${dir} is not a valid Mastra project`);
    }

    const packageManager = await this.detectPackageManager(dir);
    const mastraConfigPath = await this.findMastraConfig(dir);
    const isTypeScript = await this.detectTypeScript(dir);

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const mastraDependencies = MASTRA_PACKAGES.filter((pkg) => pkg in allDeps);

    return {
      name: packageJson.name || path.basename(dir),
      version: packageJson.version,
      description: packageJson.description,
      packageManager,
      hasMastraConfig: !!mastraConfigPath,
      mastraConfigPath: mastraConfigPath || undefined,
      entryPoint: packageJson.main || packageJson.module,
      isTypeScript,
      mastraDependencies,
    };
  }

  /**
   * Detect the package manager used by the project.
   */
  async detectPackageManager(dir: string): Promise<PackageManager> {
    // Check for lock files in order of preference
    for (const [lockFile, manager] of Object.entries(LOCK_FILES)) {
      const lockPath = path.join(dir, lockFile);
      if (await this.fileExists(lockPath)) {
        return manager;
      }
    }

    // Check packageManager field in package.json
    const packageJson = await this.readPackageJson(dir);
    if (packageJson?.packageManager) {
      const pmField = packageJson.packageManager;
      if (pmField.startsWith('pnpm')) return 'pnpm';
      if (pmField.startsWith('yarn')) return 'yarn';
      if (pmField.startsWith('bun')) return 'bun';
      if (pmField.startsWith('npm')) return 'npm';
    }

    // Default to npm
    return 'npm';
  }

  /**
   * Find the Mastra config file path if it exists.
   */
  private async findMastraConfig(dir: string): Promise<string | null> {
    for (const configFile of MASTRA_CONFIG_FILES) {
      const configPath = path.join(dir, configFile);
      if (await this.fileExists(configPath)) {
        return configPath;
      }
    }
    return null;
  }

  /**
   * Detect if the project uses TypeScript.
   */
  private async detectTypeScript(dir: string): Promise<boolean> {
    const tsconfigPath = path.join(dir, 'tsconfig.json');
    return this.fileExists(tsconfigPath);
  }

  /**
   * Read and parse package.json from a directory.
   */
  private async readPackageJson(dir: string): Promise<PackageJson | null> {
    try {
      const packageJsonPath = path.join(dir, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content) as PackageJson;
    } catch {
      return null;
    }
  }

  /**
   * Check if a file exists.
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Simplified package.json type.
 */
interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  module?: string;
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Singleton instance for convenience.
 */
export const detector = new MastraProjectDetector();
```

### 2.3 src/scanner.ts - Directory Scanner

```typescript
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import fg from 'fast-glob';

import { MastraProjectDetector } from './detector';
import type {
  LocalProjectSource,
  ScanError,
  ScanOptions,
  ScanResult,
} from './types';
import { generateProjectId } from './utils';

/**
 * Scans directories to discover Mastra projects.
 */
export class DirectoryScanner {
  private readonly detector: MastraProjectDetector;

  constructor(detector?: MastraProjectDetector) {
    this.detector = detector ?? new MastraProjectDetector();
  }

  /**
   * Scan a base path for Mastra projects.
   *
   * @param options - Scan options
   * @returns Scan result with discovered projects
   */
  async scan(options: ScanOptions): Promise<ScanResult> {
    const { basePath, include, exclude, maxDepth } = options;

    const projects: LocalProjectSource[] = [];
    const skipped: string[] = [];
    const errors: ScanError[] = [];

    // Verify base path exists
    try {
      const stats = await fs.stat(basePath);
      if (!stats.isDirectory()) {
        errors.push({
          path: basePath,
          error: 'Path is not a directory',
          code: 'NOT_DIRECTORY',
        });
        return { projects, skipped, errors };
      }
    } catch (error) {
      errors.push({
        path: basePath,
        error: `Cannot access path: ${(error as Error).message}`,
        code: 'ACCESS_ERROR',
      });
      return { projects, skipped, errors };
    }

    // Generate glob patterns for scanning
    const patterns = this.generatePatterns(include, maxDepth);
    const ignorePatterns = this.generateIgnorePatterns(exclude);

    // Find all directories matching the patterns
    const directories = await fg(patterns, {
      cwd: basePath,
      onlyDirectories: true,
      absolute: true,
      ignore: ignorePatterns,
      deep: maxDepth,
      followSymbolicLinks: false,
    });

    // Also check the base path itself
    const directoriesToCheck = [basePath, ...directories];

    // Check each directory for Mastra projects
    for (const dir of directoriesToCheck) {
      try {
        const isMastraProject = await this.detector.isMastraProject(dir);

        if (isMastraProject) {
          const metadata = await this.detector.getProjectMetadata(dir);
          const projectSource: LocalProjectSource = {
            id: generateProjectId(dir),
            name: metadata.name,
            type: 'local',
            path: dir,
            defaultBranch: undefined, // Local projects don't have branches
            metadata,
          };
          projects.push(projectSource);
        } else if (dir !== basePath) {
          // Only record as skipped if it's not the base path
          skipped.push(dir);
        }
      } catch (error) {
        errors.push({
          path: dir,
          error: (error as Error).message,
        });
      }
    }

    return { projects, skipped, errors };
  }

  /**
   * Scan multiple base paths and merge results.
   *
   * @param basePaths - Array of base paths to scan
   * @param options - Common scan options (exclude, maxDepth, etc.)
   * @returns Combined scan result
   */
  async scanMultiple(
    basePaths: string[],
    options: Omit<ScanOptions, 'basePath'>
  ): Promise<ScanResult> {
    const allProjects: LocalProjectSource[] = [];
    const allSkipped: string[] = [];
    const allErrors: ScanError[] = [];

    // Use a Set to track unique project paths (avoid duplicates)
    const seenPaths = new Set<string>();

    for (const basePath of basePaths) {
      const result = await this.scan({
        basePath,
        ...options,
      });

      // Add unique projects
      for (const project of result.projects) {
        if (!seenPaths.has(project.path)) {
          seenPaths.add(project.path);
          allProjects.push(project);
        }
      }

      allSkipped.push(...result.skipped);
      allErrors.push(...result.errors);
    }

    return {
      projects: allProjects,
      skipped: allSkipped,
      errors: allErrors,
    };
  }

  /**
   * Generate glob patterns from include patterns.
   */
  private generatePatterns(include: string[], maxDepth: number): string[] {
    if (include.length === 0) {
      // Default: scan immediate subdirectories
      return ['*'];
    }

    // Expand patterns to account for depth
    const patterns: string[] = [];
    for (const pattern of include) {
      patterns.push(pattern);
      // Add depth-based patterns if not already a glob
      if (!pattern.includes('**')) {
        for (let depth = 1; depth < maxDepth; depth++) {
          const depthPrefix = Array(depth).fill('*').join('/');
          patterns.push(`${depthPrefix}/${pattern}`);
        }
      }
    }

    return patterns;
  }

  /**
   * Generate ignore patterns from exclude patterns.
   */
  private generateIgnorePatterns(exclude: string[]): string[] {
    return exclude.map((pattern) => {
      // Ensure patterns work at any depth
      if (pattern.startsWith('**/')) {
        return pattern;
      }
      return `**/${pattern}`;
    });
  }
}

/**
 * Singleton instance for convenience.
 */
export const scanner = new DirectoryScanner();
```

### 2.4 src/watcher.ts - File Change Watcher

```typescript
import * as path from 'node:path';

import chokidar, { type FSWatcher } from 'chokidar';

import type { ChangeEvent, LocalProjectSource } from './types';

/**
 * Options for the file watcher.
 */
export interface WatcherOptions {
  /**
   * Debounce interval for events (ms).
   * @default 300
   */
  debounceMs?: number;

  /**
   * Patterns to ignore when watching.
   */
  ignored?: (string | RegExp)[];

  /**
   * Use polling instead of native events.
   * Useful for network mounts or containers.
   * @default false
   */
  usePolling?: boolean;

  /**
   * Polling interval (ms) when usePolling is true.
   * @default 1000
   */
  pollInterval?: number;
}

/**
 * Default patterns to ignore when watching.
 */
const DEFAULT_IGNORED = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/*.log',
];

/**
 * Watches for file changes in a project directory.
 */
export class ProjectWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingEvents: Map<string, ChangeEvent> = new Map();

  constructor(private readonly options: WatcherOptions = {}) {}

  /**
   * Start watching a project for file changes.
   *
   * @param source - Project source to watch
   * @param callback - Callback for change events
   * @returns Cleanup function to stop watching
   */
  watch(
    source: LocalProjectSource,
    callback: (event: ChangeEvent) => void
  ): () => void {
    const { debounceMs = 300, ignored = [], usePolling = false, pollInterval = 1000 } = this.options;

    // Combine default ignored patterns with custom ones
    const allIgnored = [...DEFAULT_IGNORED, ...ignored];

    this.watcher = chokidar.watch(source.path, {
      ignored: allIgnored,
      persistent: true,
      ignoreInitial: true,
      usePolling,
      interval: pollInterval,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
    });

    // Handler for file events
    const handleEvent = (eventType: 'add' | 'change' | 'unlink', filePath: string) => {
      const relativePath = path.relative(source.path, filePath);

      // Skip if the file is in ignored directories (double check)
      if (this.shouldIgnore(relativePath)) {
        return;
      }

      const event: ChangeEvent = {
        type: eventType,
        path: relativePath,
        timestamp: new Date(),
      };

      // Use the file path as key to dedupe rapid events on the same file
      this.pendingEvents.set(relativePath, event);

      // Debounce: collect events and emit them after the debounce period
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(() => {
        // Emit all pending events
        for (const pendingEvent of this.pendingEvents.values()) {
          callback(pendingEvent);
        }
        this.pendingEvents.clear();
      }, debounceMs);
    };

    this.watcher
      .on('add', (filePath) => handleEvent('add', filePath))
      .on('change', (filePath) => handleEvent('change', filePath))
      .on('unlink', (filePath) => handleEvent('unlink', filePath));

    // Return cleanup function
    return () => {
      this.stop();
    };
  }

  /**
   * Stop watching.
   */
  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    this.pendingEvents.clear();
  }

  /**
   * Check if a path should be ignored.
   */
  private shouldIgnore(relativePath: string): boolean {
    const segments = relativePath.split(path.sep);
    return segments.some((segment) =>
      ['node_modules', '.git', 'dist', 'build', '.next', '.turbo'].includes(segment)
    );
  }
}
```

### 2.5 src/utils.ts - Utility Functions

```typescript
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Generate a stable project ID from a path.
 * Uses a hash of the normalized absolute path.
 *
 * @param projectPath - Absolute path to the project
 * @returns Stable project ID
 */
export function generateProjectId(projectPath: string): string {
  const normalized = path.normalize(projectPath);
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  // Use first 12 characters for a shorter ID
  return `local_${hash.substring(0, 12)}`;
}

/**
 * Check if a path is accessible (readable).
 *
 * @param targetPath - Path to check
 * @returns True if accessible
 */
export async function isPathAccessible(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a path exists and is a directory.
 *
 * @param targetPath - Path to check
 * @returns True if exists and is a directory
 */
export async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(targetPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolve and normalize a path.
 * Handles relative paths by making them absolute.
 *
 * @param inputPath - Path to resolve
 * @returns Resolved absolute path
 */
export function resolvePath(inputPath: string): string {
  return path.resolve(path.normalize(inputPath));
}

/**
 * Get the project name from a path.
 * Uses the directory name as a fallback.
 *
 * @param projectPath - Path to the project
 * @returns Project name
 */
export function getProjectNameFromPath(projectPath: string): string {
  return path.basename(projectPath);
}
```

### 2.6 src/provider.ts - LocalProjectSource Implementation

```typescript
import type { ProjectSourceProvider, ProjectSource, ChangeEvent } from '@mastra/admin';

import { MastraProjectDetector, detector as defaultDetector } from './detector';
import { DirectoryScanner, scanner as defaultScanner } from './scanner';
import { ProjectWatcher } from './watcher';
import type {
  LocalProjectSource as LocalProjectSourceType,
  LocalProjectSourceConfig,
} from './types';
import { generateProjectId, isPathAccessible, isDirectory, resolvePath } from './utils';

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<Omit<LocalProjectSourceConfig, 'basePaths'>> = {
  include: ['*'],
  exclude: ['node_modules', '.git', 'dist', 'build', '.next', '.turbo'],
  maxDepth: 2,
  watchChanges: false,
  watchDebounceMs: 300,
};

/**
 * Local filesystem project source provider.
 *
 * Discovers Mastra projects from configured directories on the local filesystem.
 * Ideal for development and self-hosted deployments.
 *
 * @example
 * ```typescript
 * const source = new LocalProjectSource({
 *   basePaths: ['/home/user/projects'],
 *   watchChanges: true, // Enable for dev mode
 * });
 *
 * // List all discovered projects
 * const projects = await source.listProjects('team-1');
 *
 * // Get a specific project
 * const project = await source.getProject('local_abc123');
 *
 * // Watch for changes
 * const cleanup = source.watchChanges(project, (event) => {
 *   console.log('File changed:', event.path);
 * });
 * ```
 */
export class LocalProjectSource implements ProjectSourceProvider {
  readonly type = 'local' as const;

  private readonly config: Required<LocalProjectSourceConfig>;
  private readonly detector: MastraProjectDetector;
  private readonly scanner: DirectoryScanner;
  private projectCache: Map<string, LocalProjectSourceType> = new Map();
  private lastScanTime: number = 0;
  private readonly cacheTTL = 30000; // 30 seconds

  constructor(
    config: LocalProjectSourceConfig,
    detector?: MastraProjectDetector,
    scanner?: DirectoryScanner
  ) {
    // Validate and resolve base paths
    if (!config.basePaths || config.basePaths.length === 0) {
      throw new Error('LocalProjectSource requires at least one base path');
    }

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      basePaths: config.basePaths.map(resolvePath),
    };

    this.detector = detector ?? defaultDetector;
    this.scanner = scanner ?? new DirectoryScanner(this.detector);
  }

  /**
   * List available projects from configured base paths.
   *
   * @param _teamId - Team ID (not used for local source, included for interface compatibility)
   * @returns List of discovered project sources
   */
  async listProjects(_teamId: string): Promise<ProjectSource[]> {
    // Check if cache is still valid
    const now = Date.now();
    if (now - this.lastScanTime < this.cacheTTL && this.projectCache.size > 0) {
      return Array.from(this.projectCache.values());
    }

    // Scan all configured paths
    const result = await this.scanner.scanMultiple(this.config.basePaths, {
      include: this.config.include,
      exclude: this.config.exclude,
      maxDepth: this.config.maxDepth,
    });

    // Update cache
    this.projectCache.clear();
    for (const project of result.projects) {
      this.projectCache.set(project.id, project);
    }
    this.lastScanTime = now;

    // Log any errors (non-fatal)
    if (result.errors.length > 0) {
      console.warn(
        `LocalProjectSource: ${result.errors.length} errors during scan:`,
        result.errors
      );
    }

    return result.projects;
  }

  /**
   * Get a specific project by ID.
   *
   * @param projectId - Project ID (generated from path hash)
   * @returns Project source details
   * @throws Error if project not found
   */
  async getProject(projectId: string): Promise<ProjectSource> {
    // Check cache first
    if (this.projectCache.has(projectId)) {
      const cached = this.projectCache.get(projectId)!;
      // Verify the project still exists
      if (await isDirectory(cached.path)) {
        return cached;
      }
      // Remove stale cache entry
      this.projectCache.delete(projectId);
    }

    // Refresh cache and try again
    await this.listProjects(''); // teamId not used

    const project = this.projectCache.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    return project;
  }

  /**
   * Validate that a project source is accessible.
   *
   * @param source - Project source to validate
   * @returns True if the project path exists and is accessible
   */
  async validateAccess(source: ProjectSource): Promise<boolean> {
    if (source.type !== 'local') {
      return false;
    }

    // Check path exists and is accessible
    if (!(await isPathAccessible(source.path))) {
      return false;
    }

    // Check it's still a valid Mastra project
    return this.detector.isMastraProject(source.path);
  }

  /**
   * Get the local path to the project.
   * For local sources, returns the path directly (no copying needed).
   *
   * @param source - Project source
   * @param _targetDir - Target directory (ignored for local source)
   * @returns Local filesystem path
   */
  async getProjectPath(source: ProjectSource, _targetDir: string): Promise<string> {
    // For local source, just return the path directly
    // Runners use the project in-place
    if (!(await this.validateAccess(source))) {
      throw new Error(`Project path is not accessible: ${source.path}`);
    }

    return source.path;
  }

  /**
   * Watch for file changes in a project.
   *
   * @param source - Project source to watch
   * @param callback - Callback for change events
   * @returns Cleanup function to stop watching
   */
  watchChanges(
    source: ProjectSource,
    callback: (event: ChangeEvent) => void
  ): () => void {
    if (!this.config.watchChanges) {
      console.warn('LocalProjectSource: watchChanges is disabled in config');
      return () => {}; // No-op cleanup
    }

    const watcher = new ProjectWatcher({
      debounceMs: this.config.watchDebounceMs,
    });

    return watcher.watch(source as LocalProjectSourceType, callback);
  }

  /**
   * Manually add a project path to the source.
   * Useful for adding projects outside the configured base paths.
   *
   * @param projectPath - Absolute path to the project
   * @returns Added project source
   * @throws Error if not a valid Mastra project
   */
  async addProject(projectPath: string): Promise<LocalProjectSourceType> {
    const resolvedPath = resolvePath(projectPath);

    // Verify it's a valid Mastra project
    const isValid = await this.detector.isMastraProject(resolvedPath);
    if (!isValid) {
      throw new Error(`Not a valid Mastra project: ${resolvedPath}`);
    }

    // Get metadata
    const metadata = await this.detector.getProjectMetadata(resolvedPath);

    const project: LocalProjectSourceType = {
      id: generateProjectId(resolvedPath),
      name: metadata.name,
      type: 'local',
      path: resolvedPath,
      metadata,
    };

    // Add to cache
    this.projectCache.set(project.id, project);

    return project;
  }

  /**
   * Remove a project from the cache.
   * Does not delete the actual project files.
   *
   * @param projectId - Project ID to remove
   */
  removeProject(projectId: string): void {
    this.projectCache.delete(projectId);
  }

  /**
   * Clear the project cache, forcing a rescan on next listProjects call.
   */
  clearCache(): void {
    this.projectCache.clear();
    this.lastScanTime = 0;
  }

  /**
   * Get the current configuration.
   */
  getConfig(): Readonly<Required<LocalProjectSourceConfig>> {
    return { ...this.config };
  }
}
```

### 2.7 src/index.ts - Main Exports

```typescript
// Main provider
export { LocalProjectSource } from './provider';

// Detector
export { MastraProjectDetector, detector } from './detector';

// Scanner
export { DirectoryScanner, scanner } from './scanner';

// Watcher
export { ProjectWatcher } from './watcher';
export type { WatcherOptions } from './watcher';

// Types
export type {
  LocalProjectSourceConfig,
  PackageManager,
  ProjectMetadata,
  LocalProjectSource as LocalProjectSourceType,
  ScanOptions,
  ScanResult,
  ScanError,
  ProjectSource,
  ChangeEvent,
} from './types';

// Utilities
export {
  generateProjectId,
  isPathAccessible,
  isDirectory,
  resolvePath,
  getProjectNameFromPath,
} from './utils';
```

---

## Test Files

### 3.1 src/detector.test.ts

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { MastraProjectDetector } from './detector';

// Mock fs module
vi.mock('node:fs/promises');

describe('MastraProjectDetector', () => {
  let detector: MastraProjectDetector;

  beforeEach(() => {
    detector = new MastraProjectDetector();
    vi.clearAllMocks();
  });

  describe('isMastraProject', () => {
    it('should return false if no package.json exists', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await detector.isMastraProject('/test/project');

      expect(result).toBe(false);
    });

    it('should return true if project has @mastra/core dependency', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test-project',
          dependencies: {
            '@mastra/core': '^1.0.0',
          },
        })
      );

      const result = await detector.isMastraProject('/test/project');

      expect(result).toBe(true);
    });

    it('should return true if project has mastra.config.ts', async () => {
      let callCount = 0;
      vi.mocked(fs.access).mockImplementation(async (filePath) => {
        callCount++;
        // package.json exists
        if (String(filePath).endsWith('package.json')) return;
        // mastra.config.ts exists
        if (String(filePath).endsWith('mastra.config.ts')) return;
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test-project',
          dependencies: {},
        })
      );

      const result = await detector.isMastraProject('/test/project');

      expect(result).toBe(true);
    });

    it('should return false if no Mastra indicators present', async () => {
      vi.mocked(fs.access).mockImplementation(async (filePath) => {
        if (String(filePath).endsWith('package.json')) return;
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test-project',
          dependencies: {
            'express': '^4.0.0',
          },
        })
      );

      const result = await detector.isMastraProject('/test/project');

      expect(result).toBe(false);
    });
  });

  describe('getProjectMetadata', () => {
    it('should return complete metadata for a Mastra project', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        if (String(filePath).endsWith('package.json')) {
          return JSON.stringify({
            name: 'my-mastra-app',
            version: '1.0.0',
            description: 'A Mastra application',
            main: 'dist/index.js',
            dependencies: {
              '@mastra/core': '^1.0.0',
              '@mastra/server': '^1.0.0',
            },
          });
        }
        throw new Error('ENOENT');
      });

      const metadata = await detector.getProjectMetadata('/test/project');

      expect(metadata.name).toBe('my-mastra-app');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.mastraDependencies).toContain('@mastra/core');
      expect(metadata.mastraDependencies).toContain('@mastra/server');
    });

    it('should detect package manager from lock file', async () => {
      vi.mocked(fs.access).mockImplementation(async (filePath) => {
        if (
          String(filePath).endsWith('package.json') ||
          String(filePath).endsWith('pnpm-lock.yaml')
        ) {
          return;
        }
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test',
          dependencies: { '@mastra/core': '*' },
        })
      );

      const metadata = await detector.getProjectMetadata('/test/project');

      expect(metadata.packageManager).toBe('pnpm');
    });
  });
});
```

### 3.2 src/scanner.test.ts

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DirectoryScanner } from './scanner';
import { MastraProjectDetector } from './detector';

describe('DirectoryScanner', () => {
  let scanner: DirectoryScanner;
  let mockDetector: MastraProjectDetector;

  beforeEach(() => {
    mockDetector = {
      isMastraProject: vi.fn(),
      getProjectMetadata: vi.fn(),
    } as unknown as MastraProjectDetector;

    scanner = new DirectoryScanner(mockDetector);
  });

  describe('scan', () => {
    it('should return empty results for non-existent path', async () => {
      const result = await scanner.scan({
        basePath: '/nonexistent/path',
        include: ['*'],
        exclude: [],
        maxDepth: 2,
      });

      expect(result.projects).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('ACCESS_ERROR');
    });

    // Additional tests would use memfs for filesystem mocking
  });

  describe('scanMultiple', () => {
    it('should deduplicate projects found in multiple paths', async () => {
      // Test implementation with mocked filesystem
    });
  });
});
```

### 3.3 src/provider.test.ts

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { LocalProjectSource } from './provider';
import { MastraProjectDetector } from './detector';
import { DirectoryScanner } from './scanner';

describe('LocalProjectSource', () => {
  let provider: LocalProjectSource;
  let mockDetector: MastraProjectDetector;
  let mockScanner: DirectoryScanner;

  beforeEach(() => {
    mockDetector = {
      isMastraProject: vi.fn().mockResolvedValue(true),
      getProjectMetadata: vi.fn().mockResolvedValue({
        name: 'test-project',
        packageManager: 'pnpm',
        hasMastraConfig: true,
        isTypeScript: true,
        mastraDependencies: ['@mastra/core'],
      }),
    } as unknown as MastraProjectDetector;

    mockScanner = {
      scan: vi.fn(),
      scanMultiple: vi.fn().mockResolvedValue({
        projects: [
          {
            id: 'local_abc123',
            name: 'test-project',
            type: 'local',
            path: '/test/project',
            metadata: {
              name: 'test-project',
              packageManager: 'pnpm',
            },
          },
        ],
        skipped: [],
        errors: [],
      }),
    } as unknown as DirectoryScanner;

    provider = new LocalProjectSource(
      { basePaths: ['/test'] },
      mockDetector,
      mockScanner
    );
  });

  describe('constructor', () => {
    it('should throw if no base paths provided', () => {
      expect(() => new LocalProjectSource({ basePaths: [] })).toThrow(
        'LocalProjectSource requires at least one base path'
      );
    });
  });

  describe('listProjects', () => {
    it('should return discovered projects', async () => {
      const projects = await provider.listProjects('team-1');

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('test-project');
    });

    it('should use cache on subsequent calls', async () => {
      await provider.listProjects('team-1');
      await provider.listProjects('team-1');

      expect(mockScanner.scanMultiple).toHaveBeenCalledTimes(1);
    });
  });

  describe('getProject', () => {
    it('should return cached project', async () => {
      await provider.listProjects('team-1'); // Populate cache
      const project = await provider.getProject('local_abc123');

      expect(project.name).toBe('test-project');
    });

    it('should throw if project not found', async () => {
      await expect(provider.getProject('nonexistent')).rejects.toThrow(
        'Project not found'
      );
    });
  });

  describe('getProjectPath', () => {
    it('should return the source path directly', async () => {
      const source = {
        id: 'local_abc123',
        name: 'test',
        type: 'local' as const,
        path: '/test/project',
      };

      const path = await provider.getProjectPath(source, '/ignored');

      expect(path).toBe('/test/project');
    });
  });

  describe('watchChanges', () => {
    it('should return no-op if watching is disabled', () => {
      const cleanup = provider.watchChanges(
        { id: '1', name: 'test', type: 'local', path: '/test' },
        () => {}
      );

      expect(typeof cleanup).toBe('function');
    });
  });
});
```

---

## Workspace Configuration Updates

### 4.1 Update pnpm-workspace.yaml

Add `sources/*` to the workspace configuration:

```yaml
packages:
  - packages/_vendored/*
  - packages/*
  - deployers/*
  - stores/*
  - voice/*
  - workflows/*
  - server-adapters/*
  - pubsub/*
  - client-sdks/*
  - integrations/*
  - examples/dane
  - auth/*
  - observability/*
  - sources/*   # ADD THIS LINE
```

### 4.2 Update Root package.json

Add build script for sources:

```json
{
  "scripts": {
    "build:sources": "pnpm turbo build --filter \"./sources/*\""
  }
}
```

---

## Success Criteria

### Automated Verification

- [ ] Package builds successfully: `cd sources/local && pnpm build`
- [ ] All tests pass: `cd sources/local && pnpm test`
- [ ] Linting passes: `cd sources/local && pnpm lint`
- [ ] Type checking passes: `pnpm typecheck --filter @mastra/source-local`
- [ ] Package exports correctly in ESM and CJS formats

### Manual Verification

- [ ] `LocalProjectSource` correctly implements `ProjectSourceProvider` interface
- [ ] Can create a `LocalProjectSource` with configured base paths
- [ ] `listProjects()` discovers valid Mastra projects from base paths
- [ ] `getProject()` returns project details by ID
- [ ] `validateAccess()` correctly validates project accessibility
- [ ] `getProjectPath()` returns the local path directly
- [ ] `watchChanges()` correctly watches for file changes when enabled
- [ ] `MastraProjectDetector.isMastraProject()` correctly identifies Mastra projects
- [ ] `MastraProjectDetector.getProjectMetadata()` returns accurate metadata
- [ ] Package manager detection works for npm, pnpm, yarn, and bun
- [ ] Mastra config detection works for all supported file patterns
- [ ] Directory scanner respects include/exclude patterns
- [ ] Directory scanner respects maxDepth configuration
- [ ] Project cache works correctly with TTL
- [ ] `addProject()` allows manual project registration
- [ ] `clearCache()` forces rescan on next list

### Integration Verification

- [ ] Package can be imported from `@mastra/admin` project
- [ ] `LocalProjectSource` works with `LocalProcessRunner` (LANE 5)
- [ ] Project sources are correctly displayed in Admin UI (LANE 9)

---

## Dependencies

### On Other Lanes

- **LANE 1 (@mastra/admin)**: Must provide `ProjectSourceProvider` interface, `ProjectSource` type, and `ChangeEvent` type

### For Other Lanes

- **LANE 5 (@mastra/runner-local)**: Depends on this package for `getProjectPath()` to get project location
- **LANE 9 (@mastra/admin-ui)**: Depends on this package for `listProjects()` to display available projects

---

## Implementation Order

1. **Phase 1**: Package setup
   - Create directory structure
   - Create package.json, tsconfig.json, tsup.config.ts
   - Create eslint.config.js, vitest.config.ts, turbo.json
   - Update pnpm-workspace.yaml and root package.json

2. **Phase 2**: Core types and utilities
   - Implement src/types.ts
   - Implement src/utils.ts

3. **Phase 3**: Project detection
   - Implement src/detector.ts (MastraProjectDetector)
   - Write tests for detector

4. **Phase 4**: Directory scanning
   - Implement src/scanner.ts (DirectoryScanner)
   - Write tests for scanner

5. **Phase 5**: File watching
   - Implement src/watcher.ts (ProjectWatcher)
   - Write tests for watcher

6. **Phase 6**: Main provider
   - Implement src/provider.ts (LocalProjectSource)
   - Implement src/index.ts (exports)
   - Write tests for provider

7. **Phase 7**: Integration
   - Verify builds successfully
   - Run all tests
   - Test integration with LANE 1 (@mastra/admin)

---

## Notes

### Why Local Source First?

1. **Development Experience**: Enables immediate testing without external service setup
2. **Self-Hosted MVP**: Many enterprises will start with local projects before GitHub integration
3. **CI/CD**: Runners can fetch from local checkouts in CI pipelines
4. **Simplicity**: No authentication, no API calls, no rate limits

### File Watching Considerations

- File watching is optional and disabled by default (performance impact)
- Use `chokidar` for cross-platform compatibility
- Debounce events to prevent rapid-fire notifications
- Ignore common non-source directories (node_modules, .git, dist)
- Support polling mode for network mounts and containers

### Project Detection Strategy

A directory is considered a Mastra project if:
1. It has a `package.json` file, AND
2. EITHER has `@mastra/core` or `mastra` as a dependency
3. OR has a `mastra.config.{ts,js,mjs}` file
4. OR has `src/mastra/index.{ts,js}` file

This flexible detection allows for:
- Standard Mastra projects with explicit dependencies
- Monorepo setups where mastra config is in a subdirectory
- Legacy projects that may not have explicit dependencies

### ID Generation

Project IDs are generated by hashing the normalized absolute path:
- Ensures stability across restarts
- Prevents duplicate entries for the same project
- Short prefix `local_` identifies the source type
