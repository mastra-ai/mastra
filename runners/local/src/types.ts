import type { ChildProcess } from 'node:child_process';

/**
 * Extended log stream callback with ID and stream type.
 */
export type ExtendedLogStreamCallback = (
  line: string,
  id?: string,
  stream?: 'stdout' | 'stderr',
) => void;

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

  /**
   * Admin server traces endpoint URL.
   * When set, the runner automatically injects MASTRA_CLOUD_ACCESS_TOKEN
   * and MASTRA_CLOUD_AI_TRACES_ENDPOINT into deployed servers.
   * @example 'http://localhost:3001/api/spans/publish'
   */
  tracesEndpoint?: string;
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
 * Structured log entry for pagination.
 */
export interface StructuredLogEntry {
  id: string;
  timestamp: string;
  line: string;
  stream: 'stdout' | 'stderr';
}

/**
 * Result from paginated log query.
 */
export interface PaginatedLogsResult {
  entries: StructuredLogEntry[];
  hasMore: boolean;
  oldestCursor: string | null;
  newestCursor: string | null;
}

/**
 * Log collector interface.
 */
export interface LogCollector {
  /** Append a log line */
  append(line: string, stream?: 'stdout' | 'stderr'): void;
  /** Get all logs */
  getAll(): string;
  /** Get tail of logs */
  getTail(lines: number): string;
  /** Get logs since timestamp */
  getSince(since: Date): string;
  /** Stream logs with callback (receives line, id, and stream) */
  stream(callback: ExtendedLogStreamCallback): () => void;
  /** Get paginated logs */
  getPaginated(limit?: number, beforeCursor?: string): PaginatedLogsResult;
  /** Clear all logs */
  clear(): void;
}
