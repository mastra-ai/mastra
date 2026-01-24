# LANE 5: @mastra/runner-local Implementation Plan

## Overview

This plan implements the `@mastra/runner-local` package - a LocalProcess runner that builds Mastra projects and runs them as child processes. This is the primary runner for MVP, enabling local development and self-hosted deployments.

**Package**: `@mastra/runner-local`
**Location**: `runners/local/`
**Priority**: P0 (MVP)

## Dependencies

| Dependency | Package                | Status      | Required For                             |
| ---------- | ---------------------- | ----------- | ---------------------------------------- |
| LANE 1     | `@mastra/admin`        | ✅ Complete | `ProjectRunner` interface, types         |
| LANE 4     | `@mastra/source-local` | ✅ Complete | `ProjectSourceProvider.getProjectPath()` |
| LANE 12    | `@mastra/router-local` | ⏳ Pending  | `EdgeRouterProvider.registerRoute()`     |

**Note**: The runner can be developed in parallel with LANE 12 by stubbing router interactions. Full integration testing requires LANE 12.

## Interface Implementation

From `packages/admin/src/runner/base.ts`:

```typescript
interface ProjectRunner {
  readonly type: 'local' | 'k8s' | string;

  build(project: Project, build: Build, options?: BuildOptions, onLog?: LogStreamCallback): Promise<Build>;
  deploy(project: Project, deployment: Deployment, build: Build, options?: RunOptions): Promise<RunningServer>;
  stop(server: RunningServer): Promise<void>;
  healthCheck(server: RunningServer): Promise<{ healthy: boolean; message?: string }>;
  getLogs(server: RunningServer, options?: { tail?: number; since?: Date }): Promise<string>;
  streamLogs(server: RunningServer, callback: LogStreamCallback): () => void;
  getResourceUsage(server: RunningServer): Promise<{ memoryUsageMb: number | null; cpuPercent: number | null }>;
}
```

## Directory Structure

```
runners/local/
├── src/
│   ├── index.ts                    # Main exports
│   ├── runner.ts                   # LocalProcessRunner implementation
│   ├── types.ts                    # Local runner types
│   │
│   ├── build/
│   │   ├── index.ts                # Build exports
│   │   ├── builder.ts              # ProjectBuilder class
│   │   ├── package-manager.ts      # Package manager detection & commands
│   │   └── log-stream.ts           # Build log streaming
│   │
│   ├── process/
│   │   ├── index.ts                # Process exports
│   │   ├── manager.ts              # ProcessManager class
│   │   ├── spawner.ts              # Process spawning utilities
│   │   └── resource-monitor.ts     # CPU/memory monitoring
│   │
│   ├── port/
│   │   ├── index.ts                # Port exports
│   │   └── allocator.ts            # PortAllocator class
│   │
│   ├── health/
│   │   ├── index.ts                # Health exports
│   │   └── checker.ts              # HealthChecker class
│   │
│   ├── subdomain/
│   │   ├── index.ts                # Subdomain exports
│   │   └── generator.ts            # SubdomainGenerator class
│   │
│   └── logs/
│       ├── index.ts                # Log exports
│       ├── collector.ts            # LogCollector class
│       └── ring-buffer.ts          # Circular buffer for log retention
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## Implementation Tasks

### Task 1: Package Setup

**Files**: `package.json`, `tsconfig.json`, `vitest.config.ts`

```json
// package.json
{
  "name": "@mastra/runner-local",
  "version": "0.0.1",
  "description": "Local process runner for Mastra Admin",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mastra/admin": "workspace:*",
    "@mastra/core": "workspace:*",
    "execa": "^9.5.2",
    "get-port": "^7.1.0",
    "pidusage": "^3.0.2",
    "tree-kill": "^1.2.2"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "tsup": "^8.3.5",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  },
  "peerDependencies": {
    "@mastra/admin": "workspace:*"
  }
}
```

### Task 2: Type Definitions

**File**: `src/types.ts`

```typescript
import type { ProjectRunner, BuildOptions, RunOptions, LogStreamCallback } from '@mastra/admin';
import type { ChildProcess } from 'node:child_process';

/**
 * Package manager types supported by the runner.
 */
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

/**
 * Configuration for LocalProcessRunner.
 */
export interface LocalProcessRunnerConfig {
  /**
   * Port range for server allocation.
   * @default { start: 4111, end: 4200 }
   */
  portRange?: {
    start: number;
    end: number;
  };

  /**
   * Maximum concurrent builds.
   * @default 3
   */
  maxConcurrentBuilds?: number;

  /**
   * Default build timeout in milliseconds.
   * @default 600000 (10 minutes)
   */
  defaultBuildTimeoutMs?: number;

  /**
   * Health check configuration.
   */
  healthCheck?: {
    /** Timeout for health check request (ms). @default 5000 */
    timeoutMs?: number;
    /** Interval between health check retries (ms). @default 1000 */
    retryIntervalMs?: number;
    /** Maximum retries before giving up. @default 30 */
    maxRetries?: number;
    /** Health check endpoint path. @default '/health' */
    endpoint?: string;
  };

  /**
   * Number of log lines to retain per server.
   * @default 10000
   */
  logRetentionLines?: number;

  /**
   * Working directory for build artifacts.
   * @default '.mastra/builds'
   */
  buildDir?: string;

  /**
   * Environment variables to inject into all builds.
   */
  globalEnvVars?: Record<string, string>;
}

/**
 * Tracked running process information.
 */
export interface TrackedProcess {
  /** Server ID */
  serverId: string;
  /** Deployment ID */
  deploymentId: string;
  /** Node.js child process */
  process: ChildProcess;
  /** Allocated port */
  port: number;
  /** Process start time */
  startedAt: Date;
  /** Log collector reference */
  logCollector: LogCollector;
}

/**
 * Build context with resolved paths.
 */
export interface BuildContext {
  /** Project source path */
  projectPath: string;
  /** Build output directory */
  outputDir: string;
  /** Detected package manager */
  packageManager: PackageManager;
  /** Environment variables for build */
  envVars: Record<string, string>;
}

/**
 * Log collector interface.
 */
export interface LogCollector {
  /** Append a log line */
  append(line: string): void;
  /** Get all logs */
  getAll(): string;
  /** Get tail of logs */
  getTail(lines: number): string;
  /** Get logs since timestamp */
  getSince(since: Date): string;
  /** Stream logs with callback */
  stream(callback: LogStreamCallback): () => void;
  /** Clear all logs */
  clear(): void;
}
```

### Task 3: Port Allocator

**File**: `src/port/allocator.ts`

```typescript
import getPort from 'get-port';

/**
 * Manages port allocation for running servers.
 * Tracks used ports and ensures no collisions.
 */
export class PortAllocator {
  private readonly portRange: { start: number; end: number };
  private readonly allocatedPorts: Set<number> = new Set();

  constructor(portRange: { start: number; end: number } = { start: 4111, end: 4200 }) {
    this.portRange = portRange;
  }

  /**
   * Allocate an available port.
   *
   * @param preferred - Preferred port (if available)
   * @returns Allocated port number
   * @throws Error if no ports available
   */
  async allocate(preferred?: number): Promise<number> {
    // Try preferred port first
    if (preferred && this.isInRange(preferred) && !this.allocatedPorts.has(preferred)) {
      const available = await this.isPortAvailable(preferred);
      if (available) {
        this.allocatedPorts.add(preferred);
        return preferred;
      }
    }

    // Generate port list within range
    const portList: number[] = [];
    for (let port = this.portRange.start; port <= this.portRange.end; port++) {
      if (!this.allocatedPorts.has(port)) {
        portList.push(port);
      }
    }

    if (portList.length === 0) {
      throw new Error(`No available ports in range ${this.portRange.start}-${this.portRange.end}`);
    }

    // Use get-port to find an available port
    const port = await getPort({ port: portList });

    if (!this.isInRange(port)) {
      throw new Error(`Allocated port ${port} is outside configured range`);
    }

    this.allocatedPorts.add(port);
    return port;
  }

  /**
   * Release a previously allocated port.
   */
  release(port: number): void {
    this.allocatedPorts.delete(port);
  }

  /**
   * Check if a port is currently allocated by this allocator.
   */
  isAllocated(port: number): boolean {
    return this.allocatedPorts.has(port);
  }

  /**
   * Get all currently allocated ports.
   */
  getAllocatedPorts(): number[] {
    return Array.from(this.allocatedPorts);
  }

  /**
   * Get number of available ports.
   */
  getAvailableCount(): number {
    const total = this.portRange.end - this.portRange.start + 1;
    return total - this.allocatedPorts.size;
  }

  private isInRange(port: number): boolean {
    return port >= this.portRange.start && port <= this.portRange.end;
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    const allocated = await getPort({ port: [port] });
    return allocated === port;
  }
}
```

### Task 4: Package Manager Detection

**File**: `src/build/package-manager.ts`

```typescript
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { PackageManager } from '../types';

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
 * Install command flags by package manager.
 */
const INSTALL_FLAGS: Record<PackageManager, string[]> = {
  npm: ['install', '--audit=false', '--fund=false', '--loglevel=error', '--progress=false'],
  pnpm: ['install', '--ignore-workspace', '--loglevel=error'],
  yarn: ['install', '--silent'],
  bun: ['install', '--silent'],
};

/**
 * Build command (run scripts.build) by package manager.
 */
const BUILD_COMMANDS: Record<PackageManager, string[]> = {
  npm: ['run', 'build'],
  pnpm: ['run', 'build'],
  yarn: ['run', 'build'],
  bun: ['run', 'build'],
};

/**
 * Detect package manager from lock files or package.json.
 */
export async function detectPackageManager(projectPath: string): Promise<PackageManager> {
  // Check for lock files
  for (const [lockFile, manager] of Object.entries(LOCK_FILES)) {
    const lockPath = path.join(projectPath, lockFile);
    try {
      await fs.access(lockPath);
      return manager;
    } catch {
      // Lock file doesn't exist, continue
    }
  }

  // Check packageManager field in package.json
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    if (packageJson.packageManager) {
      const pmField = packageJson.packageManager as string;
      if (pmField.startsWith('pnpm')) return 'pnpm';
      if (pmField.startsWith('yarn')) return 'yarn';
      if (pmField.startsWith('bun')) return 'bun';
      if (pmField.startsWith('npm')) return 'npm';
    }
  } catch {
    // No package.json or parse error
  }

  // Default to npm
  return 'npm';
}

/**
 * Get install command arguments for a package manager.
 */
export function getInstallArgs(pm: PackageManager): string[] {
  return INSTALL_FLAGS[pm] || INSTALL_FLAGS.npm;
}

/**
 * Get build command arguments for a package manager.
 */
export function getBuildArgs(pm: PackageManager): string[] {
  return BUILD_COMMANDS[pm] || BUILD_COMMANDS.npm;
}

/**
 * Check if a build script exists in package.json.
 */
export async function hasBuildScript(projectPath: string): Promise<boolean> {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    return !!packageJson.scripts?.build;
  } catch {
    return false;
  }
}
```

### Task 5: Log Collector with Ring Buffer

**File**: `src/logs/ring-buffer.ts`

```typescript
/**
 * Timestamped log entry.
 */
export interface LogEntry {
  timestamp: Date;
  line: string;
}

/**
 * Circular buffer for efficient log retention.
 */
export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Array(capacity);
  }

  /**
   * Add an item to the buffer.
   * Overwrites oldest item if at capacity.
   */
  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /**
   * Get all items in order (oldest first).
   */
  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      const index = (this.head + i) % this.capacity;
      result.push(this.buffer[index]!);
    }
    return result;
  }

  /**
   * Get the last n items (newest).
   */
  getTail(n: number): T[] {
    const count = Math.min(n, this.size);
    const result: T[] = [];
    for (let i = this.size - count; i < this.size; i++) {
      const index = (this.head + i) % this.capacity;
      result.push(this.buffer[index]!);
    }
    return result;
  }

  /**
   * Get current size.
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Clear the buffer.
   */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }
}
```

**File**: `src/logs/collector.ts`

```typescript
import type { LogStreamCallback } from '@mastra/admin';
import type { LogCollector as ILogCollector } from '../types';
import { RingBuffer, type LogEntry } from './ring-buffer';

/**
 * Collects and manages logs for a running process.
 */
export class LogCollector implements ILogCollector {
  private readonly buffer: RingBuffer<LogEntry>;
  private readonly listeners: Set<LogStreamCallback> = new Set();

  constructor(maxLines: number = 10000) {
    this.buffer = new RingBuffer<LogEntry>(maxLines);
  }

  /**
   * Append a log line with timestamp.
   */
  append(line: string): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      line,
    };
    this.buffer.push(entry);

    // Notify all listeners
    for (const callback of this.listeners) {
      try {
        callback(line);
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Append multiple lines at once.
   */
  appendMultiple(lines: string[]): void {
    for (const line of lines) {
      this.append(line);
    }
  }

  /**
   * Get all logs as a single string.
   */
  getAll(): string {
    return this.buffer
      .toArray()
      .map(entry => entry.line)
      .join('\n');
  }

  /**
   * Get the last n lines.
   */
  getTail(lines: number): string {
    return this.buffer
      .getTail(lines)
      .map(entry => entry.line)
      .join('\n');
  }

  /**
   * Get logs since a timestamp.
   */
  getSince(since: Date): string {
    return this.buffer
      .toArray()
      .filter(entry => entry.timestamp >= since)
      .map(entry => entry.line)
      .join('\n');
  }

  /**
   * Stream logs to a callback.
   * Returns cleanup function.
   */
  stream(callback: LogStreamCallback): () => void {
    this.listeners.add(callback);

    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Clear all logs.
   */
  clear(): void {
    this.buffer.clear();
  }

  /**
   * Get number of stored lines.
   */
  getLineCount(): number {
    return this.buffer.getSize();
  }
}
```

### Task 6: Health Checker

**File**: `src/health/checker.ts`

```typescript
export interface HealthCheckConfig {
  /** Timeout for each request (ms) */
  timeoutMs: number;
  /** Interval between retries (ms) */
  retryIntervalMs: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Health check endpoint */
  endpoint: string;
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  timeoutMs: 5000,
  retryIntervalMs: 1000,
  maxRetries: 30,
  endpoint: '/health',
};

/**
 * HTTP health checker for running servers.
 */
export class HealthChecker {
  private readonly config: HealthCheckConfig;

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check health of a server once.
   */
  async check(host: string, port: number): Promise<{ healthy: boolean; message?: string }> {
    const url = `http://${host}:${port}${this.config.endpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { healthy: true };
      }

      return {
        healthy: false,
        message: `Health check returned status ${response.status}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        healthy: false,
        message: `Health check failed: ${message}`,
      };
    }
  }

  /**
   * Wait for server to become healthy with retries.
   */
  async waitForHealthy(host: string, port: number): Promise<void> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      const result = await this.check(host, port);

      if (result.healthy) {
        return;
      }

      lastError = result.message;

      // Wait before retry (except on last attempt)
      if (attempt < this.config.maxRetries) {
        await this.sleep(this.config.retryIntervalMs);
      }
    }

    throw new Error(
      `Server failed to become healthy after ${this.config.maxRetries} attempts. ` +
        `Last error: ${lastError || 'unknown'}`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Task 7: Process Manager

**File**: `src/process/spawner.ts`

```typescript
import { spawn, type ChildProcess } from 'node:child_process';
import type { LogStreamCallback } from '@mastra/admin';

export interface SpawnOptions {
  /** Working directory */
  cwd: string;
  /** Environment variables */
  env: Record<string, string>;
  /** Callback for stdout/stderr */
  onOutput?: LogStreamCallback;
}

/**
 * Spawn a command and return the process.
 */
export function spawnCommand(command: string, args: string[], options: SpawnOptions): ChildProcess {
  const proc = spawn(command, args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Stream stdout
  if (proc.stdout && options.onOutput) {
    proc.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        options.onOutput!(line);
      }
    });
  }

  // Stream stderr
  if (proc.stderr && options.onOutput) {
    proc.stderr.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        options.onOutput!(`[stderr] ${line}`);
      }
    });
  }

  return proc;
}

/**
 * Run a command and wait for completion.
 */
export async function runCommand(
  command: string,
  args: string[],
  options: SpawnOptions,
): Promise<{ exitCode: number; output: string[] }> {
  return new Promise((resolve, reject) => {
    const output: string[] = [];

    const proc = spawnCommand(command, args, {
      ...options,
      onOutput: line => {
        output.push(line);
        options.onOutput?.(line);
      },
    });

    proc.on('close', code => {
      resolve({ exitCode: code ?? 0, output });
    });

    proc.on('error', err => {
      reject(err);
    });
  });
}
```

**File**: `src/process/resource-monitor.ts`

```typescript
import pidusage from 'pidusage';

export interface ResourceUsage {
  memoryUsageMb: number | null;
  cpuPercent: number | null;
}

/**
 * Get resource usage for a process.
 */
export async function getProcessResourceUsage(pid: number): Promise<ResourceUsage> {
  try {
    const stats = await pidusage(pid);

    return {
      memoryUsageMb: stats.memory ? Math.round(stats.memory / 1024 / 1024) : null,
      cpuPercent: stats.cpu !== undefined ? Math.round(stats.cpu * 100) / 100 : null,
    };
  } catch {
    return {
      memoryUsageMb: null,
      cpuPercent: null,
    };
  }
}

/**
 * Cleanup pidusage monitoring.
 */
export function cleanupResourceMonitor(): void {
  pidusage.clear();
}
```

**File**: `src/process/manager.ts`

```typescript
import type { ChildProcess } from 'node:child_process';
import treeKill from 'tree-kill';
import type { TrackedProcess, LogCollector } from '../types';

/**
 * Manages running server processes.
 */
export class ProcessManager {
  private readonly processes: Map<string, TrackedProcess> = new Map();

  /**
   * Track a new process.
   */
  track(serverId: string, deploymentId: string, process: ChildProcess, port: number, logCollector: LogCollector): void {
    const tracked: TrackedProcess = {
      serverId,
      deploymentId,
      process,
      port,
      startedAt: new Date(),
      logCollector,
    };

    this.processes.set(serverId, tracked);

    // Clean up on exit
    process.on('exit', () => {
      this.processes.delete(serverId);
    });
  }

  /**
   * Get a tracked process by server ID.
   */
  get(serverId: string): TrackedProcess | undefined {
    return this.processes.get(serverId);
  }

  /**
   * Get process by deployment ID.
   */
  getByDeploymentId(deploymentId: string): TrackedProcess | undefined {
    for (const tracked of this.processes.values()) {
      if (tracked.deploymentId === deploymentId) {
        return tracked;
      }
    }
    return undefined;
  }

  /**
   * Kill a process and remove from tracking.
   */
  async kill(serverId: string): Promise<void> {
    const tracked = this.processes.get(serverId);
    if (!tracked) {
      return;
    }

    const pid = tracked.process.pid;
    if (!pid) {
      this.processes.delete(serverId);
      return;
    }

    return new Promise((resolve, reject) => {
      // Use tree-kill to kill process and all children
      treeKill(pid, 'SIGTERM', err => {
        if (err) {
          // Try SIGKILL as fallback
          treeKill(pid, 'SIGKILL', () => {
            this.processes.delete(serverId);
            resolve();
          });
        } else {
          this.processes.delete(serverId);
          resolve();
        }
      });
    });
  }

  /**
   * Check if a process is running.
   */
  isRunning(serverId: string): boolean {
    const tracked = this.processes.get(serverId);
    if (!tracked) return false;

    return !tracked.process.killed && tracked.process.exitCode === null;
  }

  /**
   * Get all tracked processes.
   */
  getAll(): TrackedProcess[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get count of running processes.
   */
  getRunningCount(): number {
    let count = 0;
    for (const tracked of this.processes.values()) {
      if (this.isRunning(tracked.serverId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Kill all processes (for shutdown).
   */
  async killAll(): Promise<void> {
    const killPromises = Array.from(this.processes.keys()).map(id => this.kill(id));
    await Promise.all(killPromises);
  }
}
```

### Task 8: Project Builder

**File**: `src/build/builder.ts`

```typescript
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { Build, Project, BuildOptions, LogStreamCallback } from '@mastra/admin';
import { BuildStatus } from '@mastra/admin';
import { detectPackageManager, getInstallArgs, getBuildArgs, hasBuildScript } from './package-manager';
import { runCommand } from '../process/spawner';
import type { BuildContext, PackageManager } from '../types';

export interface BuilderConfig {
  /** Default build timeout (ms) */
  defaultTimeoutMs: number;
  /** Working directory for builds */
  buildDir: string;
  /** Global env vars to inject */
  globalEnvVars: Record<string, string>;
}

const DEFAULT_CONFIG: BuilderConfig = {
  defaultTimeoutMs: 600000, // 10 minutes
  buildDir: '.mastra/builds',
  globalEnvVars: {},
};

/**
 * Builds Mastra projects by running install and build commands.
 */
export class ProjectBuilder {
  private readonly config: BuilderConfig;

  constructor(config: Partial<BuilderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Build a project.
   */
  async build(
    project: Project,
    build: Build,
    projectPath: string,
    options?: BuildOptions,
    onLog?: LogStreamCallback,
  ): Promise<Build> {
    const startTime = Date.now();
    const log = (message: string) => onLog?.(`[${new Date().toISOString()}] ${message}`);

    try {
      // Detect package manager
      const packageManager = await detectPackageManager(projectPath);
      log(`Detected package manager: ${packageManager}`);

      // Prepare environment
      const envVars = {
        ...this.config.globalEnvVars,
        ...options?.envVars,
        NODE_ENV: 'production',
      };

      // Build context
      const context: BuildContext = {
        projectPath,
        outputDir: path.join(projectPath, '.mastra/output'),
        packageManager,
        envVars,
      };

      // Step 1: Install dependencies (unless skipped)
      if (!options?.skipInstall) {
        log('Installing dependencies...');
        await this.installDependencies(context, onLog);
        log('Dependencies installed successfully');
      }

      // Step 2: Run build
      if (await hasBuildScript(projectPath)) {
        log('Running build script...');
        await this.runBuild(context, onLog);
        log('Build completed successfully');
      } else {
        log('No build script found, skipping build step');
      }

      // Verify output exists
      const outputExists = await this.verifyOutput(context.outputDir);
      if (!outputExists) {
        throw new Error(`Build output not found at ${context.outputDir}`);
      }

      const duration = Date.now() - startTime;
      log(`Build completed in ${Math.round(duration / 1000)}s`);

      return {
        ...build,
        status: BuildStatus.SUCCEEDED as Build['status'],
        completedAt: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Build failed: ${message}`);

      return {
        ...build,
        status: BuildStatus.FAILED as Build['status'],
        completedAt: new Date(),
        errorMessage: message,
      };
    }
  }

  private async installDependencies(context: BuildContext, onLog?: LogStreamCallback): Promise<void> {
    const args = getInstallArgs(context.packageManager);

    const result = await runCommand(context.packageManager, args, {
      cwd: context.projectPath,
      env: context.envVars,
      onOutput: onLog,
    });

    if (result.exitCode !== 0) {
      throw new Error(`Dependency installation failed with exit code ${result.exitCode}`);
    }
  }

  private async runBuild(context: BuildContext, onLog?: LogStreamCallback): Promise<void> {
    const args = getBuildArgs(context.packageManager);

    const result = await runCommand(context.packageManager, args, {
      cwd: context.projectPath,
      env: context.envVars,
      onOutput: onLog,
    });

    if (result.exitCode !== 0) {
      throw new Error(`Build failed with exit code ${result.exitCode}`);
    }
  }

  private async verifyOutput(outputDir: string): Promise<boolean> {
    try {
      const stats = await fs.stat(outputDir);
      if (!stats.isDirectory()) {
        return false;
      }

      // Check for index.mjs entry point
      const entryPoint = path.join(outputDir, 'index.mjs');
      await fs.access(entryPoint);
      return true;
    } catch {
      return false;
    }
  }
}
```

### Task 9: Subdomain Generator

**File**: `src/subdomain/generator.ts`

```typescript
import type { Project, Deployment } from '@mastra/admin';
import { DeploymentType } from '@mastra/admin';

/**
 * Generates subdomain strings for deployments.
 *
 * Patterns:
 * - production: "{project-slug}"
 * - staging: "staging--{project-slug}"
 * - preview: "{branch}--{project-slug}"
 */
export class SubdomainGenerator {
  /**
   * Generate subdomain for a deployment.
   */
  generate(project: Project, deployment: Deployment): string {
    const projectSlug = this.sanitizeSlug(project.slug);

    switch (deployment.type) {
      case DeploymentType.PRODUCTION:
        return projectSlug;

      case DeploymentType.STAGING:
        return `staging--${projectSlug}`;

      case DeploymentType.PREVIEW:
        const branchSlug = this.sanitizeSlug(deployment.branch);
        return `${branchSlug}--${projectSlug}`;

      default:
        // For any custom deployment types
        const typeSlug = this.sanitizeSlug(deployment.slug);
        return `${typeSlug}--${projectSlug}`;
    }
  }

  /**
   * Parse a subdomain to extract project slug and deployment type.
   */
  parse(subdomain: string): { projectSlug: string; deploymentSlug?: string } {
    const parts = subdomain.split('--');

    if (parts.length === 1) {
      // Production deployment
      return { projectSlug: parts[0] };
    }

    // Non-production deployment
    return {
      projectSlug: parts[parts.length - 1],
      deploymentSlug: parts.slice(0, -1).join('--'),
    };
  }

  /**
   * Sanitize a string for use in a subdomain.
   * - Lowercase
   * - Replace spaces and underscores with hyphens
   * - Remove invalid characters
   * - Collapse multiple hyphens
   * - Trim hyphens from start/end
   */
  private sanitizeSlug(input: string): string {
    return input
      .toLowerCase()
      .replace(/[\s_]/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
```

### Task 10: LocalProcessRunner Implementation

**File**: `src/runner.ts`

````typescript
import * as path from 'node:path';
import { MastraBase } from '@mastra/core/base';
import type {
  ProjectRunner,
  Build,
  Deployment,
  Project,
  RunningServer,
  BuildOptions,
  RunOptions,
  LogStreamCallback,
  ProjectSourceProvider,
  EdgeRouterProvider,
} from '@mastra/admin';
import { BuildStatus, HealthStatus, RegisteredAdminComponent } from '@mastra/admin';
import type { LocalProcessRunnerConfig, TrackedProcess } from './types';
import { PortAllocator } from './port/allocator';
import { HealthChecker } from './health/checker';
import { ProcessManager } from './process/manager';
import { ProjectBuilder } from './build/builder';
import { LogCollector } from './logs/collector';
import { SubdomainGenerator } from './subdomain/generator';
import { spawnCommand } from './process/spawner';
import { getProcessResourceUsage, cleanupResourceMonitor } from './process/resource-monitor';

const DEFAULT_CONFIG: Required<Omit<LocalProcessRunnerConfig, 'globalEnvVars'>> = {
  portRange: { start: 4111, end: 4200 },
  maxConcurrentBuilds: 3,
  defaultBuildTimeoutMs: 600000,
  healthCheck: {
    timeoutMs: 5000,
    retryIntervalMs: 1000,
    maxRetries: 30,
    endpoint: '/health',
  },
  logRetentionLines: 10000,
  buildDir: '.mastra/builds',
};

/**
 * LocalProcessRunner builds Mastra projects and runs them as child processes.
 *
 * @example
 * ```typescript
 * const runner = new LocalProcessRunner({
 *   portRange: { start: 4111, end: 4200 },
 * });
 *
 * // Build a project
 * const buildResult = await runner.build(project, build, { envVars });
 *
 * // Deploy and start server
 * const server = await runner.deploy(project, deployment, build);
 *
 * // Stop server
 * await runner.stop(server);
 * ```
 */
export class LocalProcessRunner extends MastraBase implements ProjectRunner {
  readonly type = 'local' as const;

  private readonly config: Required<Omit<LocalProcessRunnerConfig, 'globalEnvVars'>> & {
    globalEnvVars: Record<string, string>;
  };

  private readonly portAllocator: PortAllocator;
  private readonly healthChecker: HealthChecker;
  private readonly processManager: ProcessManager;
  private readonly projectBuilder: ProjectBuilder;
  private readonly subdomainGenerator: SubdomainGenerator;

  // Injected providers
  private source?: ProjectSourceProvider;
  private router?: EdgeRouterProvider;

  constructor(config: LocalProcessRunnerConfig = {}) {
    super({ component: RegisteredAdminComponent.RUNNER, name: 'LocalProcessRunner' });

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      healthCheck: { ...DEFAULT_CONFIG.healthCheck, ...config.healthCheck },
      globalEnvVars: config.globalEnvVars ?? {},
    };

    this.portAllocator = new PortAllocator(this.config.portRange);
    this.healthChecker = new HealthChecker(this.config.healthCheck);
    this.processManager = new ProcessManager();
    this.projectBuilder = new ProjectBuilder({
      defaultTimeoutMs: this.config.defaultBuildTimeoutMs,
      buildDir: this.config.buildDir,
      globalEnvVars: this.config.globalEnvVars,
    });
    this.subdomainGenerator = new SubdomainGenerator();

    this.logger.info('LocalProcessRunner initialized', {
      portRange: this.config.portRange,
      maxConcurrentBuilds: this.config.maxConcurrentBuilds,
    });
  }

  /**
   * Set the project source provider.
   * Called by MastraAdmin during initialization.
   */
  setSource(source: ProjectSourceProvider): void {
    this.source = source;
  }

  /**
   * Set the edge router provider.
   * Called by MastraAdmin during initialization.
   */
  setRouter(router: EdgeRouterProvider): void {
    this.router = router;
  }

  /**
   * Build a project from source.
   */
  async build(project: Project, build: Build, options?: BuildOptions, onLog?: LogStreamCallback): Promise<Build> {
    this.logger.info('Starting build', { projectId: project.id, buildId: build.id });

    // Get project path from source provider
    const projectPath = await this.getProjectPath(project);

    // Run the build
    const result = await this.projectBuilder.build(project, build, projectPath, options, onLog);

    this.logger.info('Build completed', {
      projectId: project.id,
      buildId: build.id,
      status: result.status,
    });

    return result;
  }

  /**
   * Deploy and start a server for a deployment.
   */
  async deploy(project: Project, deployment: Deployment, build: Build, options?: RunOptions): Promise<RunningServer> {
    this.logger.info('Starting deployment', {
      projectId: project.id,
      deploymentId: deployment.id,
      buildId: build.id,
    });

    // Get project path
    const projectPath = await this.getProjectPath(project);
    const outputDir = path.join(projectPath, '.mastra/output');

    // Allocate port
    const port = await this.portAllocator.allocate(options?.port);
    this.logger.debug('Allocated port', { port });

    // Prepare environment
    const envVars = {
      ...this.config.globalEnvVars,
      ...options?.envVars,
      NODE_ENV: 'production',
      PORT: String(port),
      MASTRA_DEPLOYMENT_ID: deployment.id,
      MASTRA_PROJECT_ID: project.id,
    };

    // Create log collector
    const logCollector = new LogCollector(this.config.logRetentionLines);

    // Start the server process
    const entryPoint = path.join(outputDir, 'index.mjs');
    const proc = spawnCommand(process.execPath, [entryPoint], {
      cwd: outputDir,
      env: envVars,
      onOutput: line => logCollector.append(line),
    });

    // Generate server ID
    const serverId = crypto.randomUUID();

    // Track the process
    this.processManager.track(serverId, deployment.id, proc, port, logCollector);

    // Wait for health check
    try {
      const healthTimeoutMs =
        options?.healthCheckTimeoutMs ?? this.config.healthCheck.maxRetries * this.config.healthCheck.retryIntervalMs;

      this.logger.debug('Waiting for server health', { port, timeoutMs: healthTimeoutMs });
      await this.healthChecker.waitForHealthy('localhost', port);
      this.logger.info('Server is healthy', { port });
    } catch (error) {
      // Kill process on health check failure
      await this.processManager.kill(serverId);
      this.portAllocator.release(port);
      throw error;
    }

    // Register route with edge router
    let publicUrl: string | null = null;
    if (this.router) {
      const subdomain = this.subdomainGenerator.generate(project, deployment);
      const routeInfo = await this.router.registerRoute({
        deploymentId: deployment.id,
        projectId: project.id,
        subdomain,
        targetHost: 'localhost',
        targetPort: port,
      });
      publicUrl = routeInfo.publicUrl;
      this.logger.info('Route registered', { subdomain, publicUrl });
    }

    const server: RunningServer = {
      id: serverId,
      deploymentId: deployment.id,
      buildId: build.id,
      processId: proc.pid ?? null,
      containerId: null,
      host: 'localhost',
      port,
      healthStatus: HealthStatus.HEALTHY as RunningServer['healthStatus'],
      lastHealthCheck: new Date(),
      memoryUsageMb: null,
      cpuPercent: null,
      startedAt: new Date(),
      stoppedAt: null,
    };

    this.logger.info('Deployment complete', { serverId, port, publicUrl });

    return server;
  }

  /**
   * Stop a running server.
   */
  async stop(server: RunningServer): Promise<void> {
    this.logger.info('Stopping server', { serverId: server.id, port: server.port });

    // Remove route first
    if (this.router) {
      try {
        await this.router.removeRoute(server.deploymentId);
        this.logger.debug('Route removed', { deploymentId: server.deploymentId });
      } catch (error) {
        this.logger.warn('Failed to remove route', { error });
      }
    }

    // Kill the process
    await this.processManager.kill(server.id);

    // Release the port
    this.portAllocator.release(server.port);

    this.logger.info('Server stopped', { serverId: server.id });
  }

  /**
   * Check health of a running server.
   */
  async healthCheck(server: RunningServer): Promise<{ healthy: boolean; message?: string }> {
    // First check if process is still running
    if (!this.processManager.isRunning(server.id)) {
      return { healthy: false, message: 'Process is not running' };
    }

    return this.healthChecker.check(server.host, server.port);
  }

  /**
   * Get logs from a running server.
   */
  async getLogs(server: RunningServer, options?: { tail?: number; since?: Date }): Promise<string> {
    const tracked = this.processManager.get(server.id);
    if (!tracked) {
      return '';
    }

    if (options?.since) {
      return tracked.logCollector.getSince(options.since);
    }

    if (options?.tail) {
      return tracked.logCollector.getTail(options.tail);
    }

    return tracked.logCollector.getAll();
  }

  /**
   * Stream logs from a running server.
   */
  streamLogs(server: RunningServer, callback: LogStreamCallback): () => void {
    const tracked = this.processManager.get(server.id);
    if (!tracked) {
      return () => {};
    }

    return tracked.logCollector.stream(callback);
  }

  /**
   * Get resource usage for a running server.
   */
  async getResourceUsage(server: RunningServer): Promise<{
    memoryUsageMb: number | null;
    cpuPercent: number | null;
  }> {
    if (!server.processId) {
      return { memoryUsageMb: null, cpuPercent: null };
    }

    return getProcessResourceUsage(server.processId);
  }

  /**
   * Shutdown the runner (stop all processes).
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down LocalProcessRunner');

    await this.processManager.killAll();
    cleanupResourceMonitor();

    this.logger.info('LocalProcessRunner shutdown complete');
  }

  /**
   * Get stats about the runner.
   */
  getStats(): {
    runningProcesses: number;
    allocatedPorts: number[];
    availablePorts: number;
  } {
    return {
      runningProcesses: this.processManager.getRunningCount(),
      allocatedPorts: this.portAllocator.getAllocatedPorts(),
      availablePorts: this.portAllocator.getAvailableCount(),
    };
  }

  /**
   * Get project path from source provider.
   */
  private async getProjectPath(project: Project): Promise<string> {
    if (!this.source) {
      throw new Error('Project source provider not configured');
    }

    // For local source, this returns the path directly
    // For GitHub source (future), this would clone the repo
    return this.source.getProjectPath(
      {
        id: project.id,
        name: project.name,
        type: project.sourceType,
        path: (project.sourceConfig as { path: string }).path,
      },
      this.config.buildDir,
    );
  }
}
````

### Task 11: Main Exports

**File**: `src/index.ts`

```typescript
// Main runner
export { LocalProcessRunner } from './runner';

// Types
export type { LocalProcessRunnerConfig, TrackedProcess, BuildContext, PackageManager, LogCollector } from './types';

// Components (for advanced use cases)
export { PortAllocator } from './port/allocator';
export { HealthChecker, type HealthCheckConfig } from './health/checker';
export { ProcessManager } from './process/manager';
export { ProjectBuilder, type BuilderConfig } from './build/builder';
export { SubdomainGenerator } from './subdomain/generator';
export { LogCollector as LogCollectorImpl } from './logs/collector';
export { RingBuffer, type LogEntry } from './logs/ring-buffer';

// Utilities
export { detectPackageManager, getInstallArgs, getBuildArgs, hasBuildScript } from './build/package-manager';
export { spawnCommand, runCommand } from './process/spawner';
export { getProcessResourceUsage, cleanupResourceMonitor } from './process/resource-monitor';
```

## Testing Strategy

### Unit Tests

**File**: `src/__tests__/port-allocator.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PortAllocator } from '../port/allocator';

describe('PortAllocator', () => {
  let allocator: PortAllocator;

  beforeEach(() => {
    allocator = new PortAllocator({ start: 5000, end: 5010 });
  });

  it('should allocate a port within range', async () => {
    const port = await allocator.allocate();
    expect(port).toBeGreaterThanOrEqual(5000);
    expect(port).toBeLessThanOrEqual(5010);
  });

  it('should track allocated ports', async () => {
    const port = await allocator.allocate();
    expect(allocator.isAllocated(port)).toBe(true);
  });

  it('should release ports', async () => {
    const port = await allocator.allocate();
    allocator.release(port);
    expect(allocator.isAllocated(port)).toBe(false);
  });

  it('should respect preferred port', async () => {
    const port = await allocator.allocate(5005);
    expect(port).toBe(5005);
  });
});
```

**File**: `src/__tests__/subdomain-generator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { SubdomainGenerator } from '../subdomain/generator';
import { DeploymentType } from '@mastra/admin';

describe('SubdomainGenerator', () => {
  const generator = new SubdomainGenerator();

  const mockProject = { slug: 'my-project' } as any;

  it('should generate production subdomain', () => {
    const deployment = { type: DeploymentType.PRODUCTION } as any;
    expect(generator.generate(mockProject, deployment)).toBe('my-project');
  });

  it('should generate staging subdomain', () => {
    const deployment = { type: DeploymentType.STAGING } as any;
    expect(generator.generate(mockProject, deployment)).toBe('staging--my-project');
  });

  it('should generate preview subdomain with branch', () => {
    const deployment = { type: DeploymentType.PREVIEW, branch: 'feature/new-ui' } as any;
    expect(generator.generate(mockProject, deployment)).toBe('feature-new-ui--my-project');
  });

  it('should sanitize special characters', () => {
    const project = { slug: 'My_Project 123!' } as any;
    const deployment = { type: DeploymentType.PRODUCTION } as any;
    expect(generator.generate(project, deployment)).toBe('my-project-123');
  });
});
```

### Integration Tests

**File**: `src/__tests__/runner.integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LocalProcessRunner } from '../runner';
import { LocalProjectSource } from '@mastra/source-local';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

describe('LocalProcessRunner Integration', () => {
  let runner: LocalProcessRunner;
  let source: LocalProjectSource;
  let testProjectPath: string;

  beforeAll(async () => {
    // Create a minimal test project
    testProjectPath = path.join(__dirname, 'fixtures', 'test-project');
    await fs.mkdir(testProjectPath, { recursive: true });

    // Create package.json
    await fs.writeFile(
      path.join(testProjectPath, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        scripts: { build: 'echo build' },
        dependencies: { '@mastra/core': '*' },
      }),
    );

    source = new LocalProjectSource({ basePaths: [testProjectPath] });
    runner = new LocalProcessRunner({ portRange: { start: 9000, end: 9010 } });
    runner.setSource(source);
  });

  afterAll(async () => {
    await runner.shutdown();
    await fs.rm(testProjectPath, { recursive: true, force: true });
  });

  it('should build a project', async () => {
    const project = {
      id: 'test-1',
      name: 'test-project',
      slug: 'test-project',
      sourceType: 'local',
      sourceConfig: { path: testProjectPath },
    } as any;

    const build = {
      id: 'build-1',
      status: 'building',
    } as any;

    const logs: string[] = [];
    const result = await runner.build(project, build, {}, log => logs.push(log));

    expect(result.status).toBeDefined();
    expect(logs.length).toBeGreaterThan(0);
  });
});
```

## Success Criteria

1. **Build Process**
   - [ ] Detects package manager from lock files
   - [ ] Runs `install` with correct flags per package manager
   - [ ] Runs `build` script if present
   - [ ] Streams build logs in real-time
   - [ ] Handles build failures gracefully

2. **Process Management**
   - [ ] Spawns Mastra server as child process
   - [ ] Captures stdout/stderr
   - [ ] Tracks process lifecycle
   - [ ] Kills process tree on stop (includes children)
   - [ ] Handles SIGTERM/SIGKILL gracefully

3. **Port Allocation**
   - [ ] Allocates available ports within range
   - [ ] Tracks allocated ports
   - [ ] Releases ports on shutdown
   - [ ] Handles port conflicts

4. **Health Checks**
   - [ ] HTTP health check with timeout
   - [ ] Retries with configurable interval
   - [ ] Fails deployment on health check timeout

5. **Log Collection**
   - [ ] Ring buffer for memory-efficient storage
   - [ ] Tail/since query options
   - [ ] Real-time streaming to callbacks

6. **Resource Monitoring**
   - [ ] CPU usage via pidusage
   - [ ] Memory usage via pidusage
   - [ ] Graceful fallback on error

7. **Router Integration**
   - [ ] Generates correct subdomain patterns
   - [ ] Registers route after server healthy
   - [ ] Removes route on stop

## Dependencies

```json
{
  "dependencies": {
    "@mastra/admin": "workspace:*",
    "@mastra/core": "workspace:*",
    "execa": "^9.5.2",
    "get-port": "^7.1.0",
    "pidusage": "^3.0.2",
    "tree-kill": "^1.2.2"
  }
}
```

## Integration with MastraAdmin

The runner is injected into MastraAdmin and receives providers:

```typescript
// In MastraAdmin initialization
const runner = new LocalProcessRunner({ portRange: { start: 4111, end: 4200 } });
runner.setSource(this.source);
runner.setRouter(this.router);
```

## Open Questions

1. **Build Caching**: Should we implement build caching to skip unchanged dependencies? (Future enhancement)

2. **Concurrent Builds**: Current implementation uses semaphore for `maxConcurrentBuilds` - should this be configurable per project?

3. **Graceful Shutdown**: On runner shutdown, should we wait for builds to complete or cancel them?

4. **Log Persistence**: Should logs be persisted to disk, or is memory-only sufficient? (Memory for MVP, disk for future)
