import type { Build, Deployment, Project, RunningServer } from '../../types';

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
   * Build a project from source.
   *
   * @param project - The project to build
   * @param build - Build record for logging
   * @param options - Build options
   * @param onLog - Callback for streaming build logs
   * @returns Updated build record
   */
  build(
    project: Project,
    build: Build,
    options?: BuildOptions,
    onLog?: LogStreamCallback,
  ): Promise<Build>;

  /**
   * Deploy and start a server for a deployment.
   *
   * @param project - The project
   * @param deployment - The deployment configuration
   * @param build - The build to deploy
   * @param options - Run options
   * @returns Running server info
   */
  deploy(
    project: Project,
    deployment: Deployment,
    build: Build,
    options?: RunOptions,
  ): Promise<RunningServer>;

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
  getLogs(
    server: RunningServer,
    options?: { tail?: number; since?: Date },
  ): Promise<string>;

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
