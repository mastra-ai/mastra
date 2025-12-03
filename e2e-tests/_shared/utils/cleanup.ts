import type { ChildProcess } from 'node:child_process';
import { rm } from 'node:fs/promises';

export interface ManagedProcess {
  process: ChildProcess;
  name: string;
  cleanup?: () => Promise<void> | void;
}

/**
 * ProcessManager handles graceful cleanup of spawned processes.
 *
 * It registers signal handlers for SIGINT and SIGTERM to ensure
 * all managed processes are killed when the test runner exits.
 *
 * @example
 * ```ts
 * const manager = new ProcessManager();
 *
 * const proc = spawn('node', ['server.js']);
 * manager.register({ process: proc, name: 'server' });
 *
 * // Later, cleanup all processes
 * await manager.cleanupAll();
 * ```
 */
export class ProcessManager {
  private processes: ManagedProcess[] = [];
  private signalHandlersRegistered = false;

  constructor() {
    this.registerSignalHandlers();
  }

  /**
   * Register a process to be managed.
   */
  register(managed: ManagedProcess): void {
    this.processes.push(managed);
  }

  /**
   * Unregister a process (e.g., after it exits normally).
   */
  unregister(process: ChildProcess): void {
    this.processes = this.processes.filter(m => m.process !== process);
  }

  /**
   * Kill all managed processes and run their cleanup functions.
   */
  async cleanupAll(): Promise<void> {
    const cleanupPromises = this.processes.map(async managed => {
      try {
        // Try graceful shutdown first
        managed.process.kill('SIGTERM');

        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Force kill if still running
        if (!managed.process.killed) {
          managed.process.kill('SIGKILL');
        }

        // Run custom cleanup
        await managed.cleanup?.();
      } catch (error) {
        console.error(`Error cleaning up process ${managed.name}:`, error);
      }
    });

    await Promise.all(cleanupPromises);
    this.processes = [];
  }

  private registerSignalHandlers(): void {
    if (this.signalHandlersRegistered) return;

    const handler = async (signal: string) => {
      console.log(`\nReceived ${signal}, cleaning up processes...`);
      await this.cleanupAll();
      process.exit(signal === 'SIGINT' ? 130 : 143);
    };

    process.once('SIGINT', () => handler('SIGINT'));
    process.once('SIGTERM', () => handler('SIGTERM'));

    this.signalHandlersRegistered = true;
  }
}

/**
 * Global process manager instance for the test suite.
 */
export const processManager = new ProcessManager();

/**
 * Cleanup temporary directories safely.
 *
 * @param paths - Paths to clean up
 */
export async function cleanupTempDirs(...paths: string[]): Promise<void> {
  await Promise.all(
    paths.map(async path => {
      try {
        await rm(path, { recursive: true, force: true });
      } catch {
        // Directory might already be deleted or not exist
      }
    }),
  );
}

/**
 * Create a cleanup function that chains multiple cleanup operations.
 */
export function createCleanup(...cleanups: Array<() => Promise<void> | void>): () => Promise<void> {
  return async () => {
    for (const cleanup of cleanups) {
      try {
        await cleanup();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
  };
}
