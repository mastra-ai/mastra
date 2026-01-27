import type { FileStorageProvider } from '../file-storage/base';
import type { ProjectSourceProvider } from '../source/base';
import type { Build, Deployment, Project, RunningServer } from '../types';

/**
 * Build options for the runner.
 */
export interface BuildOptions {
  /** Environment variables to inject during build */
  envVars?: Record<string, string>;
  /** Build timeout in milliseconds (default: 10 minutes) */
  timeoutMs?: number;
  /** Whether to skip dependency installation */
  skipInstall?: boolean;
}

/**
 * Run options for starting a server.
 */
export interface RunOptions {
  /** Environment variables for the running server */
  envVars?: Record<string, string>;
  /** Port to run on (auto-allocated if not specified) */
  port?: number;
  /** Health check timeout in milliseconds (default: 30 seconds) */
  healthCheckTimeoutMs?: number;
}

/**
 * Log stream callback.
 */
export type LogStreamCallback = (log: string) => void;

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
 * Server log callback for real-time log streaming.
 * Called when a running server outputs to stdout/stderr.
 * Note: id is optional for backwards compatibility.
 */
export type ServerLogCallback = (
  serverId: string,
  line: string,
  stream: 'stdout' | 'stderr',
  id?: string | undefined,
) => void;

/**
 * Abstract interface for running Mastra projects.
 *
 * Implementations:
 * - LocalProcessRunner (runners/local/)
 * - KubernetesRunner (runners/k8s/) - future
 */
export interface ProjectRunner {
  /** Runner type identifier */
  readonly type: 'local' | 'k8s' | string;

  /**
   * Set the project source provider.
   * Called by MastraAdmin during initialization to inject the source.
   *
   * @param source - The source provider for fetching project files
   */
  setSource?(source: ProjectSourceProvider): void;

  /**
   * Set the callback for server log events.
   * Called by MastraAdmin or AdminServer to receive real-time logs from running servers.
   *
   * @param callback - Function called for each log line from running servers
   */
  setOnServerLog?(callback: ServerLogCallback): void;

  /**
   * Set the file storage provider for observability data persistence.
   * Called by MastraAdmin during initialization to enable log file writing.
   *
   * @param storage - The file storage provider for writing observability files
   */
  setObservabilityStorage?(storage: FileStorageProvider): void;

  /**
   * Build a project from source.
   *
   * @param project - The project to build
   * @param build - Build record for logging
   * @param options - Build options
   * @param onLog - Callback for streaming build logs
   * @returns Updated build record
   */
  build(project: Project, build: Build, options?: BuildOptions, onLog?: LogStreamCallback): Promise<Build>;

  /**
   * Deploy and start a server for a deployment.
   *
   * @param project - The project
   * @param deployment - The deployment configuration
   * @param build - The build to deploy
   * @param options - Run options
   * @returns Running server info
   */
  deploy(project: Project, deployment: Deployment, build: Build, options?: RunOptions): Promise<RunningServer>;

  /**
   * Stop a running server.
   *
   * @param server - The server to stop
   */
  stop(server: RunningServer): Promise<void>;

  /**
   * Check health of a running server.
   *
   * @param server - The server to check
   * @returns Health status
   */
  healthCheck(server: RunningServer): Promise<{ healthy: boolean; message?: string }>;

  /**
   * Get logs from a running server.
   *
   * @param server - The server
   * @param options - Log options
   * @returns Log content
   */
  getLogs(server: RunningServer, options?: { tail?: number; since?: Date }): Promise<string>;

  /**
   * Get paginated logs from a running server.
   * Used for reverse-chronological infinite scroll.
   *
   * @param server - The server
   * @param options - Pagination options
   * @returns Paginated log entries in chronological order
   */
  getLogsPaginated?(
    server: RunningServer,
    options?: { limit?: number; before?: string },
  ): Promise<PaginatedLogsResult>;

  /**
   * Stream logs from a running server.
   *
   * @param server - The server
   * @param callback - Callback for each log line
   * @returns Cleanup function to stop streaming
   */
  streamLogs(server: RunningServer, callback: LogStreamCallback): () => void;

  /**
   * Get resource usage for a running server.
   *
   * @param server - The server
   * @returns Resource metrics
   */
  getResourceUsage(server: RunningServer): Promise<{
    memoryUsageMb: number | null;
    cpuPercent: number | null;
  }>;
}
