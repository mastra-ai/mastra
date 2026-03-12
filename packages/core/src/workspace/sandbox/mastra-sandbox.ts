/**
 * MastraSandbox Base Class
 *
 * Abstract base class for sandbox providers that want automatic logger integration.
 * Extends MastraBase to receive the Mastra logger when registered with a Mastra instance.
 *
 * MountManager is automatically created if the subclass implements `mount()`.
 * Use `declare readonly mounts: MountManager` to get non-optional typing.
 *
 * ## Lifecycle Management
 *
 * The base class provides race-condition-safe lifecycle wrappers:
 * - `_start()` - Handles concurrent calls, status management, and mount processing
 * - `_stop()` - Handles concurrent calls and status management
 * - `_destroy()` - Handles concurrent calls and status management
 *
 * Subclasses override the plain `start()`, `stop()`, and `destroy()` methods
 * to provide their implementation. Callers use the `_`-prefixed wrappers
 * (or `callLifecycle()`) which add status tracking and race-condition safety.
 *
 * External providers can extend this class to get logger support, or implement
 * the WorkspaceSandbox interface directly if they don't need logging.
 */

import { MastraBase } from '../../base';
import type { IMastraLogger } from '../../logger';
import { RegisteredLogger } from '../../logger/constants';
import type { WorkspaceFilesystem } from '../filesystem/filesystem';
import type { MountResult } from '../filesystem/mount';
import type { ProviderStatus } from '../lifecycle';
import { SandboxNotReadyError } from './errors';
import { MountManager } from './mount-manager';
import type { SandboxProcessManager } from './process-manager';
import type { WorkspaceSandbox } from './sandbox';
import type { CommandResult, ExecuteCommandOptions, SandboxInfo } from './types';
import { shellQuote } from './utils';

/**
 * Lifecycle hook that fires during sandbox state transitions.
 * Receives the sandbox instance so users can call `executeCommand`, read files, etc.
 */
export type SandboxLifecycleHook = (args: { sandbox: WorkspaceSandbox }) => void | Promise<void>;

/**
 * Options for the MastraSandbox base class constructor.
 * Providers extend this to add their own options while inheriting lifecycle hooks.
 */
export interface MastraSandboxOptions {
  /** Called after the sandbox reaches 'running' status */
  onStart?: SandboxLifecycleHook;
  /** Called before the sandbox stops */
  onStop?: SandboxLifecycleHook;
  /** Called before the sandbox is destroyed */
  onDestroy?: SandboxLifecycleHook;

  /**
   * Process manager for this sandbox.
   *
   * When provided, the base class automatically:
   * 1. Sets the sandbox back-reference on the process manager
   * 2. Exposes it via `this.processes`
   * 3. Creates a default `executeCommand` implementation (spawn + wait)
   *
   * @example
   * ```typescript
   * class MySandbox extends MastraSandbox {
   *   constructor() {
   *     super({
   *       name: 'MySandbox',
   *       processes: new MyProcessManager({ env: myEnv }),
   *     });
   *   }
   * }
   * ```
   */
  processes?: SandboxProcessManager;
}

/**
 * Abstract base class for sandbox providers with logger support.
 *
 * Providers that extend this class automatically receive the Mastra logger
 * when the sandbox is used with a Mastra instance. MountManager is also
 * automatically created if the subclass implements `mount()`.
 *
 * @example
 * ```typescript
 * class MyCustomSandbox extends MastraSandbox {
 *   declare readonly mounts: MountManager;  // Non-optional type
 *   readonly id = 'my-sandbox';
 *   readonly name = 'MyCustomSandbox';
 *   readonly provider = 'custom';
 *   status: ProviderStatus = 'pending';
 *
 *   constructor() {
 *     super({
 *       name: 'MyCustomSandbox',
 *       processes: new MyProcessManager({ env: myEnv }),
 *     });
 *   }
 *
 *   async start(): Promise<void> { /* startup logic *\/ }
 *   async mount(filesystem, mountPath) { ... }
 *   async unmount(mountPath) { ... }
 * }
 * ```
 */
export abstract class MastraSandbox extends MastraBase implements WorkspaceSandbox {
  /** Unique identifier for this sandbox instance */
  abstract readonly id: string;

  /** Human-readable name (e.g., 'E2B Sandbox', 'Docker') */
  abstract readonly name: string;

  /** Provider type identifier */
  abstract readonly provider: string;

  /** Current status of the sandbox */
  abstract status: ProviderStatus;

  // ---------------------------------------------------------------------------
  // Optional WorkspaceSandbox members
  //
  // Re-declared here so that variables typed as `MastraSandbox` (not just
  // `WorkspaceSandbox`) can see them.  TypeScript's `implements` is a
  // constraint check, not a type merge — optional interface members are
  // invisible on the class type unless explicitly listed.
  // ---------------------------------------------------------------------------

  /**
   * Execute a shell command and wait for completion.
   *
   * Method syntax (not property syntax) is intentional — it prevents
   * `useDefineForClassFields` from emitting `this.executeCommand = undefined`
   * which would shadow prototype methods defined by subclasses.
   */
  executeCommand?(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult>;

  /** Process manager */
  readonly processes?: SandboxProcessManager;

  /** Mount manager - automatically created if subclass implements mount() */
  readonly mounts?: MountManager;

  /** Optional mount method - implement to enable mounting support */
  mount?(filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult>;

  /** Optional unmount method */
  unmount?(mountPath: string): Promise<void>;

  /** Get instructions describing how this sandbox works */
  getInstructions?(): string;

  /** Get sandbox status and metadata */
  getInfo?(): SandboxInfo | Promise<SandboxInfo>;

  // ---------------------------------------------------------------------------
  // Lifecycle Promise Tracking (prevents race conditions)
  // ---------------------------------------------------------------------------

  /** Promise for _start() to prevent race conditions from concurrent calls */
  protected _startPromise?: Promise<void>;

  /** Promise for _stop() to prevent race conditions from concurrent calls */
  protected _stopPromise?: Promise<void>;

  /** Promise for _destroy() to prevent race conditions from concurrent calls */
  protected _destroyPromise?: Promise<void>;

  /** Lifecycle callbacks */
  private readonly _onStart?: SandboxLifecycleHook;
  private readonly _onStop?: SandboxLifecycleHook;
  private readonly _onDestroy?: SandboxLifecycleHook;

  constructor(options: { name: string } & MastraSandboxOptions) {
    super({ name: options.name, component: RegisteredLogger.WORKSPACE });

    this._onStart = options.onStart;
    this._onStop = options.onStop;
    this._onDestroy = options.onDestroy;

    // Automatically create MountManager if subclass implements mount()
    if (this.mount) {
      this.mounts = new MountManager({
        mount: this.mount.bind(this),
        logger: this.logger,
      });
    }

    // Wire up process manager if provided
    if (options.processes) {
      const pm = options.processes;
      // Set the sandbox back-reference. The process manager reads this
      // lazily (at call time), so it's fine that the subclass constructor
      // hasn't finished yet.
      pm.sandbox = this;
      this.processes = pm;

      // Auto-create executeCommand (spawn + wait) unless the subclass
      // defines its own implementation.
      if (!this.executeCommand) {
        this.executeCommand = async (command: string, args?: string[], opts?: ExecuteCommandOptions) => {
          const fullCommand = args?.length ? `${command} ${args.map(a => shellQuote(a)).join(' ')}` : command;
          this.logger.debug(`[${this.name}] Executing: ${fullCommand}`, { cwd: opts?.cwd });

          const handle = await pm.spawn(fullCommand, opts ?? {});
          const result = await handle.wait();

          this.logger.debug(`[${this.name}] Exit code: ${result.exitCode} (${result.executionTimeMs}ms)`);

          return { ...result, command: fullCommand };
        };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle Wrappers (race-condition-safe)
  // ---------------------------------------------------------------------------

  /**
   * Start the sandbox (wrapper with status management and race-condition safety).
   *
   * This method is race-condition-safe - concurrent calls will return the same promise.
   * Handles status management and automatically processes pending mounts after startup.
   *
   * Subclasses override `start()` to provide their startup logic.
   */
  async _start(): Promise<void> {
    // Already running
    if (this.status === 'running') {
      return;
    }

    // Wait for in-flight stop/destroy before starting.
    // Intentionally no .catch() — if teardown is failing, _start() should propagate
    // that error rather than silently starting on top of a broken state.
    if (this._stopPromise) await this._stopPromise;
    if (this._destroyPromise) await this._destroyPromise;

    // Cannot start a destroyed sandbox
    if (this.status === 'destroyed') {
      throw new Error('Cannot start a destroyed sandbox');
    }

    // Start already in progress - return existing promise
    if (this._startPromise) {
      return this._startPromise;
    }

    // Create and store the start promise
    this._startPromise = this._executeStart();

    try {
      await this._startPromise;
    } finally {
      this._startPromise = undefined;
    }
  }

  /**
   * Internal start execution - handles status and mount processing.
   */
  private async _executeStart(): Promise<void> {
    this.status = 'starting';

    try {
      await this.start();
      this.status = 'running';

      // Fire onStart callback after sandbox is running — treat failure as non-fatal
      // so that a bad callback doesn't kill an otherwise healthy sandbox
      try {
        await this._onStart?.({ sandbox: this });
      } catch (error) {
        this.logger.warn('onStart callback failed', { error });
      }
    } catch (error) {
      this.status = 'error';
      throw error;
    }

    // Process any pending mounts after successful start
    // Mount failures are tracked individually in MountManager and
    // shouldn't mark the sandbox itself as errored
    try {
      await this.mounts?.processPending();
    } catch (error) {
      // Mount failures are tracked in MountManager — log but don't affect sandbox status
      this.logger.warn('Unexpected error processing pending mounts', { error });
    }
  }

  /**
   * Override this method to implement sandbox startup logic.
   *
   * Called by `_start()` after status is set to 'starting'.
   * Status will be set to 'running' on success, 'error' on failure.
   *
   * @example
   * ```typescript
   * async start(): Promise<void> {
   *   this._sandbox = await Sandbox.create({ ... });
   * }
   * ```
   */
  async start(): Promise<void> {
    // Default no-op - subclasses override
  }

  /**
   * Ensure the sandbox is running.
   *
   * Calls `_start()` if status is not 'running'. Useful for lazy initialization
   * where operations should automatically start the sandbox if needed.
   *
   * @throws {SandboxNotReadyError} if the sandbox fails to reach 'running' status
   *
   * @example
   * ```typescript
   * async executeCommand(command: string): Promise<CommandResult> {
   *   await this.ensureRunning();
   *   // Now safe to use the sandbox
   * }
   * ```
   */
  async ensureRunning(): Promise<void> {
    // Already destroyed — cannot use this sandbox
    if (this.status === 'destroyed') {
      throw new SandboxNotReadyError(this.id);
    }
    // During teardown the sandbox is still operational (e.g. destroy()
    // may need to list/kill processes).  Allow operations to proceed
    // without trying to restart.
    if (this.status === 'destroying' || this.status === 'stopping') {
      return;
    }
    if (this.status !== 'running') {
      await this._start();
    }
    if (this.status !== 'running') {
      throw new SandboxNotReadyError(this.id);
    }
  }

  /**
   * Stop the sandbox (wrapper with status management and race-condition safety).
   *
   * This method is race-condition-safe - concurrent calls will return the same promise.
   * Handles status management.
   *
   * Subclasses override `stop()` to provide their stop logic.
   */
  async _stop(): Promise<void> {
    // Already stopped
    if (this.status === 'stopped') {
      return;
    }

    // Wait for in-flight start before stopping
    if (this._startPromise) await this._startPromise.catch(() => {});

    // Stop already in progress - return existing promise
    if (this._stopPromise) {
      return this._stopPromise;
    }

    // Create and store the stop promise
    this._stopPromise = this._executeStop();

    try {
      await this._stopPromise;
    } finally {
      this._stopPromise = undefined;
    }
  }

  /**
   * Internal stop execution - handles status.
   */
  private async _executeStop(): Promise<void> {
    this.status = 'stopping';

    try {
      // Fire onStop callback before stopping
      await this._onStop?.({ sandbox: this });

      await this.stop();
      this.status = 'stopped';
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  /**
   * Override this method to implement sandbox stop logic.
   *
   * Called by `_stop()` after status is set to 'stopping'.
   * Status will be set to 'stopped' on success, 'error' on failure.
   */
  async stop(): Promise<void> {
    // Default no-op - subclasses override
  }

  /**
   * Destroy the sandbox and clean up all resources (wrapper with status management).
   *
   * This method is race-condition-safe - concurrent calls will return the same promise.
   * Handles status management.
   *
   * Subclasses override `destroy()` to provide their destroy logic.
   */
  async _destroy(): Promise<void> {
    // Already destroyed
    if (this.status === 'destroyed') {
      return;
    }

    // Never started — nothing to clean up
    if (this.status === 'pending') {
      this.status = 'destroyed';
      return;
    }

    // Wait for in-flight start/stop before destroying
    if (this._startPromise) await this._startPromise.catch(() => {});
    if (this._stopPromise) await this._stopPromise.catch(() => {});

    // Destroy already in progress - return existing promise
    if (this._destroyPromise) {
      return this._destroyPromise;
    }

    // Create and store the destroy promise
    this._destroyPromise = this._executeDestroy();

    try {
      await this._destroyPromise;
    } finally {
      this._destroyPromise = undefined;
    }
  }

  /**
   * Internal destroy execution - handles status.
   */
  private async _executeDestroy(): Promise<void> {
    this.status = 'destroying';

    try {
      // Fire onDestroy callback before destroying
      await this._onDestroy?.({ sandbox: this });

      await this.destroy();
      this.status = 'destroyed';
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  /**
   * Override this method to implement sandbox destroy logic.
   *
   * Called by `_destroy()` after status is set to 'destroying'.
   * Status will be set to 'destroyed' on success, 'error' on failure.
   */
  async destroy(): Promise<void> {
    // Default no-op - subclasses override
  }

  // ---------------------------------------------------------------------------
  // Logger Propagation
  // ---------------------------------------------------------------------------

  /**
   * Override to propagate logger to MountManager.
   * @internal
   */
  override __setLogger(logger: IMastraLogger): void {
    super.__setLogger(logger);
    // Propagate to MountManager if it exists
    this.mounts?.__setLogger(logger);
  }
}
