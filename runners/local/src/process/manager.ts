import type { ChildProcess } from 'node:child_process';
import treeKill from 'tree-kill';
import type { ObservabilityWriter } from '@mastra/observability-writer';
import type { TrackedProcess, LogCollector } from '../types';

// tree-kill types
type TreeKillCallback = (error?: Error) => void;

/**
 * Manages running server processes.
 */
export class ProcessManager {
  private readonly processes: Map<string, TrackedProcess> = new Map();

  /**
   * Track a new process.
   */
  track(
    serverId: string,
    deploymentId: string,
    projectId: string,
    process: ChildProcess,
    port: number,
    logCollector: LogCollector,
    observabilityWriter?: ObservabilityWriter,
  ): void {
    const tracked: TrackedProcess = {
      serverId,
      deploymentId,
      projectId,
      process,
      port,
      startedAt: new Date(),
      logCollector,
      observabilityWriter,
    };

    this.processes.set(serverId, tracked);

    // Clean up on exit
    process.on('exit', () => {
      // Shutdown observability writer if present
      if (tracked.observabilityWriter) {
        tracked.observabilityWriter.shutdown().catch(() => {
          // Ignore shutdown errors on exit
        });
      }
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

    // Shutdown observability writer first to flush any buffered logs
    if (tracked.observabilityWriter) {
      try {
        await tracked.observabilityWriter.shutdown();
      } catch {
        // Ignore shutdown errors
      }
    }

    const pid = tracked.process.pid;
    if (!pid) {
      this.processes.delete(serverId);
      return;
    }

    return new Promise(resolve => {
      // Use tree-kill to kill process and all children
      treeKill(pid, 'SIGTERM', ((err: Error | undefined) => {
        if (err) {
          // Try SIGKILL as fallback
          treeKill(pid, 'SIGKILL', (() => {
            this.processes.delete(serverId);
            resolve();
          }) as TreeKillCallback);
        } else {
          this.processes.delete(serverId);
          resolve();
        }
      }) as TreeKillCallback);
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
