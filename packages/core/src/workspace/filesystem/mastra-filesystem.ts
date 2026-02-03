/**
 * MastraFilesystem Base Class
 *
 * Abstract base class for filesystem providers that want automatic logger integration.
 * Extends MastraBase to receive the Mastra logger when registered with a Mastra instance.
 *
 * External providers can extend this class to get logger support, or implement
 * the WorkspaceFilesystem interface directly if they don't need logging.
 */

import { MastraBase } from '../../base';
import { RegisteredLogger } from '../../logger/constants';
import type { ProviderStatus } from '../lifecycle';
import type {
  WorkspaceFilesystem,
  FilesystemInfo,
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
 * Abstract base class for filesystem providers with logger support.
 *
 * Providers that extend this class automatically receive the Mastra logger
 * when the filesystem is used with a Mastra instance.
 *
 * @example
 * ```typescript
 * class MyCustomFilesystem extends MastraFilesystem {
 *   readonly id = 'my-fs';
 *   readonly provider = 'custom';
 *   status: ProviderStatus = 'stopped';
 *
 *   constructor() {
 *     super({ name: 'MyCustomFilesystem' });
 *   }
 *
 *   async readFile(path: string): Promise<string | Buffer> {
 *     this.logger.debug('Reading file', { path });
 *     // Implementation...
 *   }
 *   // ... other methods
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

  /**
   * When true, all write operations to this filesystem are blocked.
   * Read operations are still allowed.
   */
  readonly readOnly?: boolean;

  constructor(options: { name: string }) {
    super({ name: options.name, component: RegisteredLogger.WORKSPACE });
  }

  // ---------------------------------------------------------------------------
  // Abstract Methods - Must be implemented by subclasses
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

  // ---------------------------------------------------------------------------
  // Optional Methods - Subclasses can override
  // ---------------------------------------------------------------------------

  /**
   * Get instructions describing how this filesystem works.
   * Used in tool descriptions to help agents understand path semantics.
   */
  getInstructions?(): string;

  /**
   * One-time setup operations.
   */
  init?(): void | Promise<void>;

  /**
   * Begin active operation.
   */
  start?(): void | Promise<void>;

  /**
   * Pause operation, keeping state for potential restart.
   */
  stop?(): void | Promise<void>;

  /**
   * Clean up all resources.
   */
  destroy?(): void | Promise<void>;

  /**
   * Check if ready for operations.
   */
  isReady?(): boolean | Promise<boolean>;

  /**
   * Get status and metadata.
   */
  getInfo?(): FilesystemInfo | Promise<FilesystemInfo>;
}
