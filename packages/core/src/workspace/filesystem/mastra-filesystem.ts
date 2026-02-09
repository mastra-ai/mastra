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
 * The base class provides race-condition-safe lifecycle methods:
 * - `init()` - Handles concurrent calls, status management
 * - `destroy()` - Handles concurrent calls and status management
 *
 * Subclasses should override the protected `_doInit()` and `_doDestroy()`
 * methods instead of the public lifecycle methods.
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
 *   // Override _doInit instead of init()
 *   protected async _doInit(): Promise<void> {
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

  // ---------------------------------------------------------------------------
  // Lifecycle Promise Tracking (prevents race conditions)
  // ---------------------------------------------------------------------------

  /** Promise for init() to prevent race conditions from concurrent calls */
  protected _initPromise?: Promise<void>;

  /** Promise for destroy() to prevent race conditions from concurrent calls */
  protected _destroyPromise?: Promise<void>;

  constructor(options: { name: string }) {
    super({ name: options.name, component: RegisteredLogger.WORKSPACE });
  }

  // ---------------------------------------------------------------------------
  // Lifecycle Methods (race-condition-safe wrappers)
  // ---------------------------------------------------------------------------

  /**
   * Initialize the filesystem.
   *
   * This method is race-condition-safe - concurrent calls will return the same promise.
   * Handles status management automatically.
   *
   * Subclasses should override `_doInit()` instead of this method.
   */
  async init(): Promise<void> {
    // Already ready
    // Note: intentionally allows re-init after destroy() for reconnect scenarios
    if (this.status === 'ready') {
      return;
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

    try {
      await this._doInit();
      this.status = 'ready';
    } catch (error) {
      this.status = 'error';
      this.logger.error('Failed to initialize filesystem', { error, id: this.id });
      throw error;
    }
  }

  /**
   * Override this method to implement filesystem initialization logic.
   *
   * Called by `init()` after status is set to 'initializing'.
   * Status will be set to 'ready' on success, 'error' on failure.
   *
   * @example
   * ```typescript
   * protected async _doInit(): Promise<void> {
   *   this._client = new StorageClient({ ... });
   *   await this._client.connect();
   * }
   * ```
   */
  protected async _doInit(): Promise<void> {
    // Default no-op - subclasses override
  }

  /**
   * Ensure the filesystem is ready.
   *
   * Calls `init()` if status is not 'ready'. Useful for lazy initialization
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
      await this.init();
    }
    if (this.status !== 'ready') {
      throw new FilesystemNotReadyError(this.id);
    }
  }

  /**
   * Destroy the filesystem and clean up all resources.
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
      await this._doDestroy();
      this.status = 'destroyed';
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  /**
   * Override this method to implement filesystem destroy logic.
   *
   * Called by `destroy()` after status is set to 'destroying'.
   * Status will be set to 'destroyed' on success, 'error' on failure.
   */
  protected async _doDestroy(): Promise<void> {
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
