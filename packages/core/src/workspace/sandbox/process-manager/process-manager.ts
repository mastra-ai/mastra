/**
 * Sandbox Process Manager (Base Class)
 *
 * Abstract base class for sandbox process management.
 * Wraps all methods with ensureRunning() so the sandbox is
 * automatically started before any process operation.
 * Subclasses implement spawn(), list(), get().
 */

import type { MastraSandbox } from '../mastra-sandbox';
import type { ProcessHandle } from './process-handle';
import type { ProcessInfo, SpawnProcessOptions } from './types';

// =============================================================================
// Sandbox Process Manager (Base Class)
// =============================================================================

/**
 * Abstract base class for process management in sandboxes.
 *
 * Wraps subclass overrides of `spawn()`, `list()`, and `get()` with
 * `sandbox.ensureRunning()` so the sandbox is lazily started before
 * any process operation.
 *
 * Subclasses implement the actual platform-specific logic for all methods.
 *
 * @typeParam TSandbox - The sandbox type. Subclasses narrow this to access
 *   sandbox-specific properties (e.g. `workingDirectory`, `instance`).
 *
 * @example
 * ```typescript
 * const handle = await sandbox.processes.spawn('node server.js');
 * console.log(handle.pid, handle.stdout);
 *
 * const all = await sandbox.processes.list();
 * const proc = await sandbox.processes.get(handle.pid);
 * await proc?.kill();
 * ```
 */
export interface ProcessManagerOptions {
  env?: Record<string, string | undefined>;
}

export abstract class SandboxProcessManager<TSandbox extends MastraSandbox = MastraSandbox> {
  /**
   * The sandbox this process manager belongs to.
   * Set automatically by MastraSandbox when processes are passed into the constructor.
   * @internal
   */
  sandbox!: TSandbox;

  protected readonly env: Record<string, string | undefined>;

  /** Tracked process handles keyed by PID. Populated by spawn(), used by get()/kill(). */
  protected readonly _tracked = new Map<number, ProcessHandle>();

  /** PIDs that have been read after exit and should not be re-discovered by subclass fallbacks. */
  protected readonly _dismissed = new Set<number>();

  constructor({ env = {} }: ProcessManagerOptions = {}) {
    this.env = env;

    // Capture subclass overrides (via prototype chain) before shadowing
    // with wrapped versions that add ensureRunning().
    const impl = {
      spawn: this.spawn.bind(this),
      list: this.list.bind(this),
      get: this.get.bind(this),
    };

    this.spawn = async (...args: Parameters<typeof impl.spawn>) => {
      await this.sandbox.ensureRunning();
      const handle = await impl.spawn(...args);
      handle.command = args[0];
      return handle;
    };

    this.list = async () => {
      await this.sandbox.ensureRunning();
      return impl.list();
    };

    this.get = async (...args: Parameters<typeof impl.get>) => {
      await this.sandbox.ensureRunning();
      // Skip PIDs that were already read after exit and dismissed.
      if (this._dismissed.has(args[0])) return undefined;
      const handle = await impl.get(...args);
      // Prune exited processes when their output is read — this is the
      // only automatic cleanup path. Keeps output available until the
      // consumer has seen it at least once.
      if (handle?.exitCode !== undefined) {
        this._tracked.delete(handle.pid);
        this._dismissed.add(handle.pid);
      }
      return handle;
    };
  }

  /** Spawn a process. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    throw new Error(`${this.constructor.name} must implement spawn()`);
  }

  /** List all tracked processes. */
  async list(): Promise<ProcessInfo[]> {
    throw new Error(`${this.constructor.name} must implement list()`);
  }

  /** Get a handle to a process by PID. Subclasses can override for fallback behavior. */
  async get(pid: number): Promise<ProcessHandle | undefined> {
    return this._tracked.get(pid);
  }

  /** Kill a process by PID. Returns true if killed, false if not found. */
  async kill(pid: number): Promise<boolean> {
    const handle = await this.get(pid);
    if (!handle) return false;
    const killed = await handle.kill();
    if (killed) {
      // Wait for termination so handle.exitCode is populated before returning.
      // Without this, a subsequent get() could still report the process as running.
      await handle.wait().catch(() => {});
    }
    // Release tracked handle to free accumulated output buffers.
    this._tracked.delete(pid);
    this._dismissed.add(pid);
    return killed;
  }
}
