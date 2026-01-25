import type { ChildProcess } from 'node:child_process';
import type { LogStreamCallback } from '@mastra/admin';

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
   * Base directory for build artifacts.
   * Each build gets its own subdirectory: {buildBaseDir}/builds/{buildId}
   * @default os.tmpdir()/mastra (e.g., /tmp/mastra on Linux)
   */
  buildBaseDir?: string;

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
