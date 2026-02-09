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
 * The base class provides race-condition-safe lifecycle methods:
 * - `start()` - Handles concurrent calls, status management, and mount processing
 * - `stop()` - Handles concurrent calls and status management
 * - `destroy()` - Handles concurrent calls and status management
 *
 * Subclasses should override the protected `_doStart()`, `_doStop()`, and `_doDestroy()`
 * methods instead of the public lifecycle methods.
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
import type { WorkspaceSandbox } from './sandbox';

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
  name: string;
  /** Called after the sandbox reaches 'running' status */
  onStart?: SandboxLifecycleHook;
  /** Called before the sandbox stops */
  onStop?: SandboxLifecycleHook;
  /** Called before the sandbox is destroyed */
  onDestroy?: SandboxLifecycleHook;
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
 *     super({ name: 'MyCustomSandbox' });
 *   }
 *
 *   // Override _doStart instead of start()
 *   protected async _doStart(): Promise<void> {
 *     // Your startup logic here
 *   }
 *
 *   async mount(filesystem, mountPath) { ... }
 *   async unmount(mountPath) { ... }
 *   async executeCommand(command: string, args?: string[]): Promise<CommandResult> {
 *     this.logger.debug('Executing command', { command, args });
 *     // Implementation...
 *   }
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

  /** Mount manager - automatically created if subclass implements mount() */
  readonly mounts?: MountManager;

  /** Optional mount method - implement to enable mounting support */
  mount?(filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult>;

  // ---------------------------------------------------------------------------
  // Lifecycle Promise Tracking (prevents race conditions)
  // ---------------------------------------------------------------------------

  /** Promise for start() to prevent race conditions from concurrent calls */
  protected _startPromise?: Promise<void>;

  /** Promise for stop() to prevent race conditions from concurrent calls */
  protected _stopPromise?: Promise<void>;

  /** Promise for destroy() to prevent race conditions from concurrent calls */
  protected _destroyPromise?: Promise<void>;

  /** Lifecycle callbacks */
  private readonly _onStart?: SandboxLifecycleHook;
  private readonly _onStop?: SandboxLifecycleHook;
  private readonly _onDestroy?: SandboxLifecycleHook;

  constructor(options: MastraSandboxOptions) {
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
  }

  // ---------------------------------------------------------------------------
  // Lifecycle Methods (race-condition-safe wrappers)
  // ---------------------------------------------------------------------------

  /**
   * Start the sandbox.
   *
   * This method is race-condition-safe - concurrent calls will return the same promise.
   * Handles status management and automatically processes pending mounts after startup.
   *
   * Subclasses should override `_doStart()` instead of this method.
   */
  async start(): Promise<void> {
    // Already running
    if (this.status === 'running') {
      return;
    }

    // Wait for in-flight stop/destroy before starting.
    // Intentionally no .catch() — if teardown is failing, start() should propagate
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
      await this._doStart();
      this.status = 'running';

      // Fire onStart callback after sandbox is running
      await this._onStart?.({ sandbox: this });
    } catch (error) {
      this.status = 'error';
      throw error;
    }

    // Process any pending mounts after successful start
    // Mount failures are tracked individually in MountManager and
    // shouldn't mark the sandbox itself as errored
    try {
      await this.mounts?.processPending();
    } catch {
      // Unexpected errors in mount processing shouldn't affect sandbox status
    }
  }

  /**
   * Override this method to implement sandbox startup logic.
   *
   * Called by `start()` after status is set to 'starting'.
   * Status will be set to 'running' on success, 'error' on failure.
   *
   * @example
   * ```typescript
   * protected async _doStart(): Promise<void> {
   *   this._sandbox = await Sandbox.create({ ... });
   * }
   * ```
   */
  protected async _doStart(): Promise<void> {
    // Default no-op - subclasses override
  }

  /**
   * Ensure the sandbox is running.
   *
   * Calls `start()` if status is not 'running'. Useful for lazy initialization
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
  protected async ensureRunning(): Promise<void> {
    if (this.status !== 'running') {
      await this.start();
    }
    if (this.status !== 'running') {
      throw new SandboxNotReadyError(this.id);
    }
  }

  /**
   * Stop the sandbox.
   *
   * This method is race-condition-safe - concurrent calls will return the same promise.
   * Handles status management.
   *
   * Subclasses should override `_doStop()` instead of this method.
   */
  async stop(): Promise<void> {
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

      await this._doStop();
      this.status = 'stopped';
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  /**
   * Override this method to implement sandbox stop logic.
   *
   * Called by `stop()` after status is set to 'stopping'.
   * Status will be set to 'stopped' on success, 'error' on failure.
   */
  protected async _doStop(): Promise<void> {
    // Default no-op - subclasses override
  }

  /**
   * Destroy the sandbox and clean up all resources.
   *
   * This method is race-condition-safe - concurrent calls will return the same promise.
   * Handles status management.
   *
   * Subclasses should override `_doDestroy()` instead of this method.
   */
  async destroy(): Promise<void> {
    // Already destroyed
    if (this.status === 'destroyed') {
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

      await this._doDestroy();
      this.status = 'destroyed';
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  /**
   * Override this method to implement sandbox destroy logic.
   *
   * Called by `destroy()` after status is set to 'destroying'.
   * Status will be set to 'destroyed' on success, 'error' on failure.
   */
  protected async _doDestroy(): Promise<void> {
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
