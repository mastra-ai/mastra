import type { EncryptionProvider } from '../encryption/base';
import type { EdgeRouterProvider } from '../router/base';
import type { ProjectRunner } from '../runner/base';
import type { ProjectSourceProvider } from '../source/base';
import type { AdminStorage } from '../storage/base';
import type { BuildJob } from './types';

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
  readonly #queue: BuildJob[] = [];
  #processing = false;
  #shutdown = false;

  constructor(
    storage: AdminStorage,
    encryption: EncryptionProvider,
    runner?: ProjectRunner,
    router?: EdgeRouterProvider,
    source?: ProjectSourceProvider,
  ) {
    this.#storage = storage;
    this.#encryption = encryption;
    this.#runner = runner;
    this.#router = router;
    this.#source = source;
  }

  /**
   * Queue a build for processing.
   */
  async queueBuild(buildId: string, priority = 0): Promise<void> {
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
  }

  /**
   * Process the next build in the queue.
   * Called by admin-server's build worker.
   * Returns true if a build was processed, false if queue is empty.
   */
  async processNextBuild(): Promise<boolean> {
    if (this.#shutdown || this.#processing) {
      return false;
    }

    const job = this.#queue.shift();
    if (!job) {
      return false;
    }

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
    const build = await this.#storage.getBuild(buildId);
    if (!build) {
      return;
    }

    const deployment = await this.#storage.getDeployment(build.deploymentId);
    if (!deployment) {
      return;
    }

    const project = await this.#storage.getProject(deployment.projectId);
    if (!project) {
      return;
    }

    // Update build status
    await this.#storage.updateBuildStatus(buildId, 'building');
    await this.#storage.updateBuild(buildId, { startedAt: new Date() });

    try {
      // 1. Get project source
      if (!this.#source) {
        throw new Error('No source provider configured');
      }

      const projectSource = await this.#source.getProject(project.id);
      // Ensure source is fetched/cloned to local path
      const _sourceDir = await this.#source.getProjectPath(projectSource, `/tmp/builds/${buildId}`);

      // 2. Get decrypted env vars
      const envVars = await this.#getDecryptedEnvVars(project.id);

      // 3. Run the build
      if (!this.#runner) {
        throw new Error('No runner configured');
      }

      const updatedBuild = await this.#runner.build(
        project,
        build,
        { envVars },
        (log) => {
          // Append logs as they come in
          void this.#storage.appendBuildLogs(buildId, log);
        },
      );

      if (updatedBuild.status === 'failed') {
        throw new Error(updatedBuild.errorMessage ?? 'Build failed');
      }

      // 4. Deploy the artifact
      await this.#storage.updateBuildStatus(buildId, 'deploying');

      const server = await this.#runner.deploy(
        project,
        deployment,
        updatedBuild,
        { envVars },
      );

      // 5. Configure routing
      if (this.#router && deployment.slug) {
        await this.#router.registerRoute({
          deploymentId: deployment.id,
          projectId: project.id,
          subdomain: deployment.slug,
          targetHost: server.host,
          targetPort: server.port,
        });
      }

      // 6. Save running server info
      await this.#storage.createRunningServer(server);

      // 7. Update build and deployment status
      await this.#storage.updateBuild(buildId, {
        status: 'succeeded',
        completedAt: new Date(),
      });

      await this.#storage.updateDeployment(deployment.id, {
        status: 'running',
        currentBuildId: buildId,
        internalHost: `${server.host}:${server.port}`,
      });

    } catch (error) {
      await this.#storage.updateBuild(buildId, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      await this.#storage.updateDeploymentStatus(deployment.id, 'failed');
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
