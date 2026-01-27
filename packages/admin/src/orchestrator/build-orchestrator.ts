import type { EncryptionProvider } from '../encryption/base';
import type { BuildLogWriter } from '../logs/build-log-writer';
import type { EdgeRouterProvider } from '../router/base';
import type { ProjectRunner } from '../runner/base';
import type { ProjectSourceProvider } from '../source/base';
import type { AdminStorage } from '../storage/base';
import type { BuildJob } from './types';

/**
 * Callback for build log events.
 */
export type BuildLogCallback = (buildId: string, log: string) => void;

/**
 * Callback for build status events.
 */
export type BuildStatusCallback = (
  buildId: string,
  status: 'queued' | 'building' | 'deploying' | 'succeeded' | 'failed' | 'cancelled',
) => void;

/**
 * BuildOrchestrator manages the build queue and deployment flow.
 *
 * This is used internally by MastraAdmin. The admin-server's build worker
 * calls `processNextBuild()` to process queued builds.
 */
export class BuildOrchestrator {
  readonly #storage: AdminStorage;
  readonly #encryption: EncryptionProvider;
  readonly #runner?: ProjectRunner;
  readonly #router?: EdgeRouterProvider;
  readonly #source?: ProjectSourceProvider;
  readonly #buildLogWriter?: BuildLogWriter;
  readonly #queue: BuildJob[] = [];
  #processing = false;
  #shutdown = false;
  #onLog?: BuildLogCallback;
  #onStatus?: BuildStatusCallback;

  constructor(
    storage: AdminStorage,
    encryption: EncryptionProvider,
    runner?: ProjectRunner,
    router?: EdgeRouterProvider,
    source?: ProjectSourceProvider,
    buildLogWriter?: BuildLogWriter,
  ) {
    this.#storage = storage;
    this.#encryption = encryption;
    this.#runner = runner;
    this.#router = router;
    this.#source = source;
    this.#buildLogWriter = buildLogWriter;
  }

  /**
   * Queue a build for processing.
   */
  async queueBuild(buildId: string, priority = 0): Promise<void> {
    console.log(`[BuildOrchestrator] Queueing build ${buildId} with priority ${priority}`);

    this.#queue.push({
      buildId,
      queuedAt: new Date(),
      priority,
    });

    // Sort by priority (higher first), then by queue time (older first)
    this.#queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.queuedAt.getTime() - b.queuedAt.getTime();
    });

    console.log(`[BuildOrchestrator] Queue now has ${this.#queue.length} build(s)`);
  }

  /**
   * Get the storage instance.
   * Used by build worker to access database queue directly.
   */
  getStorage(): AdminStorage {
    return this.#storage;
  }

  /**
   * Set callback for build log events.
   * Used by admin-server to broadcast logs via WebSocket.
   */
  setOnLog(callback: BuildLogCallback): void {
    this.#onLog = callback;
  }

  /**
   * Set callback for build status events.
   * Used by admin-server to broadcast status via WebSocket.
   */
  setOnStatus(callback: BuildStatusCallback): void {
    this.#onStatus = callback;
  }

  /**
   * Process a build by ID (public wrapper for #processBuild).
   * Used by build worker when processing from database queue.
   */
  async processBuildById(buildId: string): Promise<void> {
    if (this.#shutdown || this.#processing) {
      return;
    }

    this.#processing = true;

    try {
      await this.#processBuild(buildId);
    } finally {
      this.#processing = false;
    }
  }

  /**
   * Process the next build in the queue.
   * Called by admin-server's build worker.
   * Returns true if a build was processed, false if queue is empty.
   */
  async processNextBuild(): Promise<boolean> {
    console.log(
      `[BuildOrchestrator] processNextBuild called. shutdown=${this.#shutdown}, processing=${this.#processing}, queueLength=${this.#queue.length}`,
    );

    if (this.#shutdown || this.#processing) {
      console.log(`[BuildOrchestrator] Skipping: shutdown=${this.#shutdown}, processing=${this.#processing}`);
      return false;
    }

    const job = this.#queue.shift();
    if (!job) {
      console.log(`[BuildOrchestrator] Queue is empty, nothing to process`);
      return false;
    }

    console.log(`[BuildOrchestrator] Processing build ${job.buildId} from queue`);
    this.#processing = true;

    try {
      await this.#processBuild(job.buildId);
    } finally {
      this.#processing = false;
    }

    return true;
  }

  /**
   * Process a specific build.
   */
  async #processBuild(buildId: string): Promise<void> {
    console.log(`[BuildOrchestrator] Starting to process build ${buildId}`);

    const build = await this.#storage.getBuild(buildId);
    if (!build) {
      console.log(`[BuildOrchestrator] Build ${buildId} not found in storage`);
      return;
    }

    const deployment = await this.#storage.getDeployment(build.deploymentId);
    if (!deployment) {
      console.log(`[BuildOrchestrator] Deployment ${build.deploymentId} not found`);
      return;
    }

    const project = await this.#storage.getProject(deployment.projectId);
    if (!project) {
      console.log(`[BuildOrchestrator] Project ${deployment.projectId} not found`);
      return;
    }

    console.log(
      `[BuildOrchestrator] Build ${buildId}: Found build, deployment, project. Updating status to building...`,
    );

    // Update build status
    await this.#storage.updateBuildStatus(buildId, 'building');
    await this.#storage.updateBuild(buildId, { startedAt: new Date() });
    this.#onStatus?.(buildId, 'building');

    try {
      // 1. Get project source path
      if (!this.#source) {
        throw new Error('No source provider configured');
      }

      // Construct ProjectSource from the stored project configuration
      // The project entity stores sourceType and sourceConfig (e.g., { path: '/path/to/project' })
      const projectSource = {
        id: project.id,
        name: project.name,
        type: project.sourceType as 'local' | 'github',
        path: (project.sourceConfig as { path: string }).path,
      };

      // Ensure source is fetched/cloned to local path
      const _sourceDir = await this.#source.getProjectPath(projectSource, `/tmp/builds/${buildId}`);

      // 2. Get decrypted env vars
      const envVars = await this.#getDecryptedEnvVars(project.id);

      // 3. Run the build
      if (!this.#runner) {
        throw new Error('No runner configured');
      }

      const updatedBuild = await this.#runner.build(project, build, { envVars }, log => {
        // Buffer logs for file storage (if configured)
        this.#buildLogWriter?.append(buildId, log);
        // Also append to database for in-progress querying
        void this.#storage.appendBuildLogs(buildId, log);
        // Broadcast via WebSocket if callback is set
        this.#onLog?.(buildId, log);
      });

      // Flush logs to file storage when build completes (success or fail)
      let logPath: string | undefined;
      if (this.#buildLogWriter) {
        logPath = await this.#buildLogWriter.flush(buildId);
      }

      if (updatedBuild.status === 'failed') {
        // Update build with logPath even on failure
        if (logPath) {
          await this.#storage.updateBuild(buildId, { logPath });
        }
        throw new Error(updatedBuild.errorMessage ?? 'Build failed');
      }

      // 4. Deploy the artifact
      await this.#storage.updateBuildStatus(buildId, 'deploying');
      this.#onStatus?.(buildId, 'deploying');

      const server = await this.#runner.deploy(project, deployment, updatedBuild, { envVars });

      // 5. Configure routing (upsert - update if exists, register if not)
      if (this.#router && deployment.slug) {
        const existingRoute = await this.#router.getRoute(deployment.id);
        if (existingRoute) {
          // Route already exists - update it to point to the new server
          await this.#router.updateRoute(existingRoute.routeId, {
            deploymentId: deployment.id,
            projectId: project.id,
            subdomain: deployment.slug,
            targetHost: server.host,
            targetPort: server.port,
          });
        } else {
          // No existing route - register a new one
          await this.#router.registerRoute({
            deploymentId: deployment.id,
            projectId: project.id,
            subdomain: deployment.slug,
            targetHost: server.host,
            targetPort: server.port,
          });
        }
      }

      // 6. Save running server info
      await this.#storage.createRunningServer(server);

      // 7. Update build and deployment status (include logPath)
      await this.#storage.updateBuild(buildId, {
        status: 'succeeded',
        completedAt: new Date(),
        ...(logPath && { logPath }),
      });

      await this.#storage.updateDeployment(deployment.id, {
        status: 'running',
        currentBuildId: buildId,
        internalHost: `${server.host}:${server.port}`,
      });

      this.#onStatus?.(buildId, 'succeeded');
      console.log(`[BuildOrchestrator] Build ${buildId} succeeded!`);
    } catch (error) {
      console.log(
        `[BuildOrchestrator] Build ${buildId} failed:`,
        error instanceof Error ? error.message : String(error),
      );

      // Flush logs to file storage even on error (if not already flushed)
      let logPath: string | undefined;
      if (this.#buildLogWriter) {
        try {
          logPath = await this.#buildLogWriter.flush(buildId);
        } catch {
          // Ignore flush errors during error handling
        }
      }

      await this.#storage.updateBuild(buildId, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
        ...(logPath && { logPath }),
      });

      await this.#storage.updateDeploymentStatus(deployment.id, 'failed');
      this.#onStatus?.(buildId, 'failed');
    }
  }

  /**
   * Stop a running deployment.
   */
  async stopDeployment(deploymentId: string): Promise<void> {
    const server = await this.#storage.getRunningServerForDeployment(deploymentId);
    if (server && this.#runner) {
      await this.#runner.stop(server);
    }

    if (this.#router) {
      const route = await this.#router.getRoute(deploymentId);
      if (route) {
        await this.#router.removeRoute(route.routeId);
      }
    }

    if (server) {
      await this.#storage.stopRunningServer(server.id);
    }
  }

  /**
   * Cancel a build.
   */
  async cancelBuild(buildId: string): Promise<void> {
    // Remove from queue if queued
    const index = this.#queue.findIndex(j => j.buildId === buildId);
    if (index !== -1) {
      this.#queue.splice(index, 1);
    }

    // If currently building, stop it
    // (In a real implementation, this would signal the runner to abort)
  }

  /**
   * Get queue status.
   */
  getQueueStatus(): { length: number; processing: boolean } {
    return {
      length: this.#queue.length,
      processing: this.#processing,
    };
  }

  /**
   * Get buffered logs for an in-progress build.
   * Returns undefined if no buffer exists (build not in progress or no log writer configured).
   */
  getBufferedLogs(buildId: string): string | undefined {
    return this.#buildLogWriter?.getBuffered(buildId);
  }

  /**
   * Get the build log writer instance.
   * Used by admin-server routes for reading persisted logs.
   */
  getBuildLogWriter(): BuildLogWriter | undefined {
    return this.#buildLogWriter;
  }

  /**
   * Shutdown the orchestrator.
   */
  async shutdown(): Promise<void> {
    this.#shutdown = true;
    // Wait for current build to finish
    while (this.#processing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async #getDecryptedEnvVars(projectId: string): Promise<Record<string, string>> {
    const envVars = await this.#storage.getProjectEnvVars(projectId);
    const result: Record<string, string> = {};

    for (const env of envVars) {
      if (env.isSecret) {
        result[env.key] = await this.#encryption.decrypt(env.encryptedValue);
      } else {
        result[env.key] = env.encryptedValue;
      }
    }

    return result;
  }
}
