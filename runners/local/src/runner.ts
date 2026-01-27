import { tmpdir } from 'node:os';
import * as path from 'node:path';
import type {
  ProjectRunner,
  Build,
  Deployment,
  Project,
  RunningServer,
  BuildOptions,
  RunOptions,
  LogStreamCallback,
  ServerLogCallback,
  ProjectSourceProvider,
  EdgeRouterProvider,
  FileStorageProvider,
} from '@mastra/admin';
import { ObservabilityWriter } from '@mastra/observability-writer';
import { HealthStatus } from '@mastra/admin';
import { ProjectBuilder } from './build/builder';
import { HealthChecker } from './health/checker';
import { LogCollector } from './logs/collector';
import { PortAllocator } from './port/allocator';
import { ProcessManager } from './process/manager';
import { getProcessResourceUsage, cleanupResourceMonitor } from './process/resource-monitor';
import { spawnCommand } from './process/spawner';
import { SubdomainGenerator } from './subdomain/generator';
import type { LocalProcessRunnerConfig } from './types';

/**
 * Simple logger interface for LocalProcessRunner.
 */
interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

/**
 * Default console logger.
 */
class ConsoleLogger implements Logger {
  private readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  private format(level: string, message: string, data?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] [${this.name}] ${message}${dataStr}`;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    console.info(this.format('DEBUG', message, data));
  }

  info(message: string, data?: Record<string, unknown>): void {
    console.info(this.format('INFO', message, data));
  }

  warn(message: string, data?: Record<string, unknown>): void {
    console.warn(this.format('WARN', message, data));
  }

  error(message: string, data?: Record<string, unknown>): void {
    console.error(this.format('ERROR', message, data));
  }
}

interface RequiredHealthCheckConfig {
  timeoutMs: number;
  retryIntervalMs: number;
  maxRetries: number;
  endpoint: string;
}

interface ResolvedConfig {
  portRange: { start: number; end: number };
  maxConcurrentBuilds: number;
  defaultBuildTimeoutMs: number;
  healthCheck: RequiredHealthCheckConfig;
  logRetentionLines: number;
  buildDir: string;
  globalEnvVars: Record<string, string>;
  tracesEndpoint?: string;
}

const DEFAULT_HEALTH_CHECK: RequiredHealthCheckConfig = {
  timeoutMs: 5000,
  retryIntervalMs: 1000,
  maxRetries: 30,
  endpoint: '/health',
};

const DEFAULT_CONFIG: Omit<ResolvedConfig, 'globalEnvVars'> = {
  portRange: { start: 4111, end: 4200 },
  maxConcurrentBuilds: 3,
  defaultBuildTimeoutMs: 600000,
  healthCheck: DEFAULT_HEALTH_CHECK,
  logRetentionLines: 10000,
  buildDir: path.join(tmpdir(), 'mastra', 'builds'),
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
export class LocalProcessRunner implements ProjectRunner {
  readonly type = 'local' as const;

  private readonly config: ResolvedConfig;

  private readonly portAllocator: PortAllocator;
  private readonly healthChecker: HealthChecker;
  private readonly processManager: ProcessManager;
  private readonly projectBuilder: ProjectBuilder;
  private readonly subdomainGenerator: SubdomainGenerator;
  private readonly logger: Logger;

  // Injected providers
  private source?: ProjectSourceProvider;
  private router?: EdgeRouterProvider;
  private observabilityStorage?: FileStorageProvider;

  // Server log callback for real-time streaming
  private onServerLog?: ServerLogCallback;

  // Track observability writers per server for cleanup on stop
  private readonly observabilityWriters: Map<string, ObservabilityWriter> = new Map();

  constructor(config: LocalProcessRunnerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      healthCheck: { ...DEFAULT_HEALTH_CHECK, ...config.healthCheck },
      globalEnvVars: config.globalEnvVars ?? {},
      tracesEndpoint: config.tracesEndpoint,
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
    this.logger = new ConsoleLogger('LocalProcessRunner');

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
   * Set the callback for server log events.
   * Called by AdminServer to receive real-time logs from running servers.
   */
  setOnServerLog(callback: ServerLogCallback): void {
    this.onServerLog = callback;
  }

  /**
   * Set the file storage provider for observability data persistence.
   * Called by MastraAdmin during initialization to enable log file writing.
   */
  setObservabilityStorage(storage: FileStorageProvider): void {
    this.observabilityStorage = storage;
    this.logger.info('Observability storage configured');
  }

  /**
   * Build a project from source.
   */
  async build(
    project: Project,
    build: Build,
    options?: BuildOptions,
    onLog?: LogStreamCallback,
  ): Promise<Build> {
    this.logger.info('Starting build', { projectId: project.id, buildId: build.id });

    // Get project path from source provider (copies to build-specific directory)
    const projectPath = await this.getProjectPath(project, build.id);

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
  async deploy(
    project: Project,
    deployment: Deployment,
    build: Build,
    options?: RunOptions,
  ): Promise<RunningServer> {
    this.logger.info('Starting deployment', {
      projectId: project.id,
      deploymentId: deployment.id,
      buildId: build.id,
    });

    // Use the build directory (project was copied during build phase)
    const buildDir = this.getBuildDir(build.id);
    const outputDir = path.join(buildDir, '.mastra/output');

    // Allocate port
    const port = await this.portAllocator.allocate(options?.port);
    this.logger.debug('Allocated port', { port });

    // Prepare environment
    const envVars: Record<string, string> = {
      ...this.config.globalEnvVars,
      ...options?.envVars,
      NODE_ENV: 'production',
      PORT: String(port),
      MASTRA_DEPLOYMENT_ID: deployment.id,
      MASTRA_PROJECT_ID: project.id,
    };

    // Inject observability env vars if traces endpoint is configured
    // This enables CloudExporter to send spans to the admin server
    if (this.config.tracesEndpoint) {
      envVars.MASTRA_CLOUD_ACCESS_TOKEN = deployment.id;
      envVars.MASTRA_CLOUD_AI_TRACES_ENDPOINT = this.config.tracesEndpoint;
      this.logger.info('Injected observability env vars', {
        MASTRA_CLOUD_ACCESS_TOKEN: deployment.id,
        MASTRA_CLOUD_AI_TRACES_ENDPOINT: this.config.tracesEndpoint,
      });
    } else {
      this.logger.warn('No tracesEndpoint configured - observability env vars not injected');
    }

    // Create log collector
    const logCollector = new LogCollector(this.config.logRetentionLines);

    // Generate server ID (before starting process so we can use it in callbacks)
    const serverId = crypto.randomUUID();

    // Create observability writer if storage is configured
    let observabilityWriter: ObservabilityWriter | undefined;
    if (this.observabilityStorage) {
      observabilityWriter = new ObservabilityWriter({
        fileStorage: this.observabilityStorage,
        projectId: project.id,
        deploymentId: deployment.id,
        batchSize: 100,
        flushIntervalMs: 5000,
        debug: false,
      });
      this.logger.debug('ObservabilityWriter created', {
        projectId: project.id,
        deploymentId: deployment.id,
      });

      // Track the writer for cleanup on stop
      this.observabilityWriters.set(serverId, observabilityWriter);

      // Wire log collector to observability writer for persistence
      logCollector.stream(line => {
        observabilityWriter!.recordLog({
          id: crypto.randomUUID(),
          projectId: project.id,
          deploymentId: deployment.id,
          traceId: null,
          spanId: null,
          level: 'info',
          message: line,
          attributes: {
            serverId,
            source: 'server',
          },
          timestamp: new Date(),
        });
      });
    }

    // Wire log collector to broadcast callback if set
    if (this.onServerLog) {
      const callback = this.onServerLog;
      logCollector.stream((line, id, stream) => {
        callback(serverId, line, stream ?? 'stdout', id);
      });
    }

    // Start the server process
    const entryPoint = path.join(outputDir, 'index.mjs');
    const proc = spawnCommand(process.execPath, [entryPoint], {
      cwd: outputDir,
      env: envVars,
      onOutput: (line: string) => logCollector.append(line),
    });

    // Track the process
    this.processManager.track(serverId, deployment.id, proc, port, logCollector);

    // Wait for health check
    try {
      const healthTimeoutMs =
        options?.healthCheckTimeoutMs ??
        this.config.healthCheck.maxRetries * this.config.healthCheck.retryIntervalMs;

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
        this.logger.warn('Failed to remove route', { error: String(error) });
      }
    }

    // Flush and cleanup observability writer
    const writer = this.observabilityWriters.get(server.id);
    if (writer) {
      try {
        await writer.flush();
        this.logger.debug('Observability writer flushed', { serverId: server.id });
      } catch (error) {
        this.logger.warn('Failed to flush observability writer', { error: String(error) });
      }
      this.observabilityWriters.delete(server.id);
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
  async getLogs(
    server: RunningServer,
    options?: { tail?: number; since?: Date },
  ): Promise<string> {
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
   * Get paginated logs from a running server.
   * Used for reverse-chronological infinite scroll.
   */
  async getLogsPaginated(
    server: RunningServer,
    options?: { limit?: number; before?: string },
  ): Promise<{
    entries: Array<{ id: string; timestamp: string; line: string; stream: 'stdout' | 'stderr' }>;
    hasMore: boolean;
    oldestCursor: string | null;
    newestCursor: string | null;
  }> {
    const tracked = this.processManager.get(server.id);
    if (!tracked) {
      return {
        entries: [],
        hasMore: false,
        oldestCursor: null,
        newestCursor: null,
      };
    }

    return tracked.logCollector.getPaginated(options?.limit ?? 100, options?.before);
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
  /**
   * Get the build directory for a specific build.
   * Uses temp directory structure: {buildDir}/{buildId}
   */
  private getBuildDir(buildId: string): string {
    return path.join(this.config.buildDir, buildId);
  }

  /**
   * Get project path from source provider, copying to build-specific directory.
   */
  private async getProjectPath(project: Project, buildId: string): Promise<string> {
    if (!this.source) {
      throw new Error('Project source provider not configured');
    }

    // Get build-specific directory
    const buildDir = this.getBuildDir(buildId);

    // Copy project to build directory
    return this.source.getProjectPath(
      {
        id: project.id,
        name: project.name,
        type: project.sourceType,
        path: (project.sourceConfig as { path: string }).path,
      },
      buildDir,
    );
  }
}
