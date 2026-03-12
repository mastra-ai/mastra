/**
 * MastraFilesystem Base Class
 *
 * Abstract base class for filesystem providers that want automatic logger integration
 * and lifecycle management.
 *
 * Extends MastraBase to receive the Mastra logger when registered with a Mastra instance.
 *
 * ## Lifecycle Management
 *
 * The base class provides race-condition-safe lifecycle wrappers:
 * - `_init()` - Handles concurrent calls, status management
 * - `_destroy()` - Handles concurrent calls and status management
 *
 * Subclasses override the plain `init()` and `destroy()` methods to provide
 * their implementation. Callers use the `_`-prefixed wrappers (or `callLifecycle()`)
 * which add status tracking and race-condition safety.
 *
 * External providers can extend this class to get logger support, or implement
 * the WorkspaceFilesystem interface directly if they don't need logging.
 */

import { MastraBase } from '../../base';
import { RegisteredLogger } from '../../logger/constants';
import { FilesystemNotReadyError } from '../errors';
import type { ProviderStatus } from '../lifecycle';
import type {
  WorkspaceFilesystem,
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
} from './filesystem';

/**
 * Lifecycle hook that fires during filesystem state transitions.
 * Receives the filesystem instance so users can inspect state, log, etc.
 */
export type FilesystemLifecycleHook = (args: { filesystem: WorkspaceFilesystem }) => void | Promise<void>;

/**
 * Options for the MastraFilesystem base class constructor.
 * Providers extend this to add their own options while inheriting lifecycle hooks.
 */
export interface MastraFilesystemOptions {
  /** Called after the filesystem reaches 'ready' status */
  onInit?: FilesystemLifecycleHook;
  /** Called before the filesystem is destroyed */
  onDestroy?: FilesystemLifecycleHook;
}

/**
 * Abstract base class for filesystem providers with logger support and lifecycle management.
 *
 * Providers that extend this class automatically receive the Mastra logger
 * when the filesystem is used with a Mastra instance.
 *
 * @example
 * ```typescript
 * class MyCustomFilesystem extends MastraFilesystem {
 *   readonly id = 'my-fs';
 *   readonly name = 'MyCustomFilesystem';
 *   readonly provider = 'custom';
 *   status: ProviderStatus = 'pending';
 *
 *   constructor() {
 *     super({ name: 'MyCustomFilesystem' });
 *   }
 *
 *   // Override init() to provide initialization logic
 *   async init(): Promise<void> {
 *     // Your initialization logic here
 *   }
 *
 *   async readFile(path: string): Promise<string | Buffer> {
 *     await this.ensureReady();
 *     this.logger.debug('Reading file', { path });
 *     // Implementation...
 *   }
 *   // ... implement other WorkspaceFilesystem methods
 * }
 * ```
 */
export abstract class MastraFilesystem extends MastraBase implements WorkspaceFilesystem {
  /** Unique identifier for this filesystem instance */
  abstract readonly id: string;

  /** Human-readable name (e.g., 'LocalFilesystem', 'AgentFS') */
  abstract readonly name: string;

  /** Provider type identifier */
  abstract readonly provider: string;

  /** Current status of the filesystem */
  abstract status: ProviderStatus;

  /** Error message when status is 'error' */
  error?: string;

  // ---------------------------------------------------------------------------
  // Lifecycle Promise Tracking (prevents race conditions)
  // ---------------------------------------------------------------------------

  /** Promise for _init() to prevent race conditions from concurrent calls */
  private _initPromise?: Promise<void>;

  /** Promise for _destroy() to prevent race conditions from concurrent calls */
  private _destroyPromise?: Promise<void>;

  /** Lifecycle callbacks */
  private readonly _onInit?: FilesystemLifecycleHook;
  private readonly _onDestroy?: FilesystemLifecycleHook;

  constructor(options: { name: string } & MastraFilesystemOptions) {
    super({ name: options.name, component: RegisteredLogger.WORKSPACE });

    this._onInit = options.onInit;
    this._onDestroy = options.onDestroy;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle Wrappers (race-condition-safe)
  // ---------------------------------------------------------------------------

  /**
   * Initialize the filesystem (wrapper with status management and race-condition safety).
   *
   * This method is race-condition-safe - concurrent calls will return the same promise.
   * Handles status management automatically.
   *
   * Subclasses override `init()` to provide their initialization logic.
   */
  async _init(): Promise<void> {
    // Already ready
    // Note: intentionally allows re-init after destroy() for reconnect scenarios
    if (this.status === 'ready') {
      return;
    }

    // Wait for any in-progress destroy to complete before (re-)initializing
    if (this._destroyPromise) {
      try {
        await this._destroyPromise;
      } catch {
        // Ignore destroy errors — we're re-initializing anyway
      }
    }

    // Init already in progress - return existing promise
    if (this._initPromise) {
      return this._initPromise;
    }

    // Create and store the init promise
    this._initPromise = this._executeInit();

    try {
      await this._initPromise;
    } finally {
      this._initPromise = undefined;
    }
  }

  /**
   * Internal init execution - handles status.
   */
  private async _executeInit(): Promise<void> {
    this.status = 'initializing';
    this.error = undefined;

    try {
      await this.init();
      this.status = 'ready';

      // Fire onInit callback after filesystem is ready — treat failure as non-fatal
      // so that a bad callback doesn't kill an otherwise healthy filesystem
      try {
        await this._onInit?.({ filesystem: this });
      } catch (error) {
        this.logger.warn('onInit callback failed', { error });
      }
    } catch (error) {
      this.status = 'error';
      this.error = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to initialize filesystem', { error, id: this.id });
      throw error;
    }
  }

  /**
   * Override this method to implement filesystem initialization logic.
   *
   * Called by `_init()` after status is set to 'initializing'.
   * Status will be set to 'ready' on success, 'error' on failure.
   *
   * @example
   * ```typescript
   * async init(): Promise<void> {
   *   this._client = new StorageClient({ ... });
   *   await this._client.connect();
   * }
   * ```
   */
  async init(): Promise<void> {
    // Default no-op - subclasses override
  }

  /**
   * Ensure the filesystem is ready.
   *
   * Calls `_init()` if status is not 'ready'. Useful for lazy initialization
   * where operations should automatically initialize the filesystem if needed.
   *
   * @throws {FilesystemNotReadyError} if the filesystem fails to reach 'ready' status
   *
   * @example
   * ```typescript
   * async readFile(path: string): Promise<string | Buffer> {
   *   await this.ensureReady();
   *   // Now safe to use the filesystem
   * }
   * ```
   */
  protected async ensureReady(): Promise<void> {
    if (this.status !== 'ready') {
      await this._init();
    }
    if (this.status !== 'ready') {
      throw new FilesystemNotReadyError(this.id);
    }
  }

  /**
   * Destroy the filesystem and clean up all resources (wrapper with status management).
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

    // Never initialized — nothing to tear down
    if (this.status === 'pending') {
      this.status = 'destroyed';
      return;
    }

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
    // Wait for any in-progress init to complete before destroying
    if (this._initPromise) {
      try {
        await this._initPromise;
      } catch {
        // Ignore init errors — we're destroying anyway
      }
    }
    this.status = 'destroying';

    try {
      // Fire onDestroy callback before destroying
      await this._onDestroy?.({ filesystem: this });

      await this.destroy();
      this.status = 'destroyed';
    } catch (error) {
      this.status = 'error';
      this.logger.error('Failed to destroy filesystem', { error, id: this.id });
      throw error;
    }
  }

  /**
   * Override this method to implement filesystem destroy logic.
   *
   * Called by `_destroy()` after status is set to 'destroying'.
   * Status will be set to 'destroyed' on success, 'error' on failure.
   */
  async destroy(): Promise<void> {
    // Default no-op - subclasses override
  }

  // ---------------------------------------------------------------------------
  // Abstract methods - implementations must provide these
  // ---------------------------------------------------------------------------

  abstract readFile(path: string, options?: ReadOptions): Promise<string | Buffer>;
  abstract writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void>;
  abstract appendFile(path: string, content: FileContent): Promise<void>;
  abstract deleteFile(path: string, options?: RemoveOptions): Promise<void>;
  abstract copyFile(src: string, dest: string, options?: CopyOptions): Promise<void>;
  abstract moveFile(src: string, dest: string, options?: CopyOptions): Promise<void>;
  abstract mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  abstract rmdir(path: string, options?: RemoveOptions): Promise<void>;
  abstract readdir(path: string, options?: ListOptions): Promise<FileEntry[]>;
  abstract exists(path: string): Promise<boolean>;
  abstract stat(path: string): Promise<FileStat>;
}
