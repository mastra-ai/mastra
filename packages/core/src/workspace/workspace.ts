/**
 * Workspace Class
 *
 * A Workspace combines a Filesystem and a Sandbox to provide agents
 * with a complete environment for storing files and executing code.
 *
 * Users pass provider instances directly to the Workspace constructor.
 *
 * @example
 * ```typescript
 * import { Workspace } from '@mastra/core';
 * import { LocalFilesystem } from '@mastra/workspace-fs-local';
 * import { AgentFS } from '@mastra/workspace-fs-agentfs';
 * import { ComputeSDKSandbox } from '@mastra/workspace-sandbox-computesdk';
 *
 * // Simple workspace with local filesystem
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './workspace' }),
 * });
 *
 * // Full workspace with AgentFS and cloud sandbox
 * const fullWorkspace = new Workspace({
 *   filesystem: new AgentFS({ path: './agent.db' }),
 *   sandbox: new ComputeSDKSandbox({ provider: 'e2b' }),
 * });
 *
 * await fullWorkspace.init();
 * await fullWorkspace.writeFile('/code/app.py', 'print("Hello!")');
 * const result = await fullWorkspace.executeCode('print("Hello!")', { runtime: 'python' });
 * ```
 */

import type { MastraVector } from '../vector';

import type { BM25Config } from './bm25';
import { InMemoryFileReadTracker } from './file-read-tracker';
import type { FileReadTracker } from './file-read-tracker';
import { FileReadRequiredError } from './filesystem';
import type {
  WorkspaceFilesystem,
  WorkspaceState,
  FileContent,
  FileEntry,
  FileStat,
  ReadOptions,
  WriteOptions,
  ListOptions,
} from './filesystem';
import type {
  WorkspaceSandbox,
  SandboxRuntime,
  CodeResult,
  CommandResult,
  ExecuteCodeOptions,
  ExecuteCommandOptions,
} from './sandbox';
import { SearchEngine } from './search-engine';
import type { Embedder, SearchOptions, SearchResult, IndexDocument } from './search-engine';
import type { WorkspaceSkills } from './skills';
import { WorkspaceSkillsImpl } from './skills';

// =============================================================================
// Workspace Scope
// =============================================================================

/**
 * Determines how the workspace is scoped and shared.
 */
export type WorkspaceScope =
  | 'global' // Shared across all agents
  | 'agent' // Shared across all threads for a single agent
  | 'thread'; // Isolated per conversation thread

/**
 * Identifies the owner of a workspace.
 */
export interface WorkspaceOwner {
  /** Scope of the workspace */
  scope: WorkspaceScope;
  /** Agent ID (for agent and thread scopes) */
  agentId?: string;
  /** Thread ID (for thread scope only) */
  threadId?: string;
}

// =============================================================================
// Workspace Configuration
// =============================================================================

/**
 * Configuration for creating a Workspace.
 * Users pass provider instances directly.
 */
export interface WorkspaceConfig {
  /** Unique identifier (auto-generated if not provided) */
  id?: string;

  /** Human-readable name */
  name?: string;

  /**
   * Filesystem provider instance for non-mounted use cases.
   * Use this when you don't need mounting (no sandbox, or sync mode).
   *
   * For mounted filesystems, use `mounts` instead.
   *
   * @example
   * ```typescript
   * // Filesystem-only workspace (no code execution)
   * new Workspace({
   *   filesystem: new LocalFilesystem({ basePath: './data' }),
   * });
   * ```
   */
  filesystem?: WorkspaceFilesystem;

  /**
   * Sandbox provider instance.
   * Use ComputeSDKSandbox to access E2B, Modal, Docker, etc.
   */
  sandbox?: WorkspaceSandbox;

  /**
   * Filesystems to mount into the sandbox.
   * Keys are mount paths, values are filesystem instances.
   *
   * The first entry becomes the primary filesystem for workspace operations
   * (readFile, writeFile, etc.) and is mounted at the specified path.
   *
   * This creates a unified view where:
   * - workspace.writeFile('/data.json') writes to the filesystem
   * - Sandbox code reading `${mountPath}/data.json` reads the same file
   *
   * Use this instead of `filesystem` + `mountPath` when you want mounting.
   *
   * @example
   * ```typescript
   * // S3 mounted at /workspace in E2B sandbox
   * new Workspace({
   *   sandbox: new E2BSandbox(),
   *   mounts: {
   *     '/workspace': new S3Filesystem({ bucket: 'my-bucket' }),
   *   },
   * });
   * ```
   */
  mounts?: Record<string, WorkspaceFilesystem>;

  /**
   * @deprecated Use `mounts` instead for mounted filesystems.
   * Mount path for the filesystem in the sandbox.
   */
  mountPath?: string;

  // ---------------------------------------------------------------------------
  // Search Configuration
  // ---------------------------------------------------------------------------

  /**
   * Vector store for semantic search.
   * When provided along with embedder, enables vector and hybrid search.
   */
  vectorStore?: MastraVector;

  /**
   * Embedder function for generating vectors.
   * Required when vectorStore is provided.
   */
  embedder?: Embedder;

  /**
   * Enable BM25 keyword search.
   * Pass true for defaults, or a BM25Config object for custom parameters.
   */
  bm25?: boolean | BM25Config;

  /**
   * Paths to auto-index on init().
   * Files in these directories will be indexed for search.
   * @example ['/docs', '/support']
   */
  autoIndexPaths?: string[];

  /**
   * Paths where skills are located.
   * Workspace will discover SKILL.md files in these directories.
   * @default ['/skills']
   */
  skillsPaths?: string[];

  // ---------------------------------------------------------------------------
  // Lifecycle Options
  // ---------------------------------------------------------------------------

  /** Auto-initialize on construction (default: false) */
  autoInit?: boolean;

  /** Auto-sync between fs and sandbox (default: false) */
  autoSync?: boolean;

  /** Timeout for individual operations in milliseconds */
  operationTimeout?: number;

  // ---------------------------------------------------------------------------
  // Safety Options
  // ---------------------------------------------------------------------------

  /**
   * Safety options for workspace operations.
   */
  safety?: WorkspaceSafetyConfig;
}

/**
 * Safety configuration for workspace operations.
 */
export interface WorkspaceSafetyConfig {
  /**
   * Require files to be read before they can be written to.
   * If enabled, writeFile will throw an error if:
   * - The file exists but was never read in this session
   * - The file was modified since the last read
   *
   * New files (that don't exist yet) can be written without reading.
   *
   * @default true
   */
  requireReadBeforeWrite?: boolean;

  /**
   * Require approval for sandbox code/command execution.
   * - 'all': Require approval for all sandbox operations (code, commands, package installs)
   * - 'commands': Require approval only for executeCommand and installPackage (not executeCode)
   * - 'none': No approval required
   *
   * @default 'all'
   */
  requireSandboxApproval?: 'all' | 'commands' | 'none';

  /**
   * Require approval for filesystem operations.
   * - 'all': Require approval for all filesystem operations (read, write, list, delete, mkdir)
   * - 'write': Require approval only for write operations (write, delete, mkdir)
   * - 'none': No approval required (default)
   *
   * @default 'none'
   */
  requireFilesystemApproval?: 'all' | 'write' | 'none';

  /**
   * When true, all write operations to the filesystem are blocked.
   * Read operations and sandbox execution are still allowed.
   * Write tools will not be included in the workspace tools.
   *
   * @default false
   */
  readOnly?: boolean;
}

// =============================================================================
// Workspace Status & Info
// =============================================================================

export type WorkspaceStatus = 'pending' | 'initializing' | 'ready' | 'paused' | 'error' | 'destroying' | 'destroyed';

// =============================================================================
// Path Context Types
// =============================================================================

/**
 * Describes the relationship between filesystem and sandbox.
 */
export type PathContextType =
  | 'same-context' // Filesystem and sandbox share the same environment (e.g., LocalFilesystem + LocalSandbox)
  | 'cross-context' // Filesystem and sandbox are in different environments (requires sync)
  | 'sandbox-only' // Only sandbox is configured
  | 'filesystem-only'; // Only filesystem is configured

/**
 * Information about how filesystem and sandbox paths relate.
 * Used by agents to understand how to access workspace files from sandbox code.
 */
export interface PathContext {
  /** The type of context relationship */
  type: PathContextType;

  /** Filesystem details (if available) */
  filesystem?: {
    provider: string;
    /** Absolute base path on disk (for local filesystems) */
    basePath?: string;
  };

  /** Sandbox details (if available) */
  sandbox?: {
    provider: string;
    /** Working directory for command execution */
    workingDirectory?: string;
    /** Directory where script files are written */
    scriptDirectory?: string;
  };

  /**
   * Whether files need to be synced between filesystem and sandbox.
   * True for cross-context combinations (e.g., AgentFS + LocalSandbox).
   */
  requiresSync: boolean;

  /**
   * Human-readable instructions for how to access filesystem files from sandbox code.
   */
  instructions: string;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  status: WorkspaceStatus;
  createdAt: Date;
  lastAccessedAt: Date;

  /** Filesystem info (if available) */
  filesystem?: {
    provider: string;
    totalFiles?: number;
    totalSize?: number;
  };

  /** Sandbox info (if available) */
  sandbox?: {
    provider: string;
    status: string;
    supportedRuntimes: readonly SandboxRuntime[];
    resources?: {
      memoryMB?: number;
      memoryUsedMB?: number;
      cpuCores?: number;
      cpuPercent?: number;
      diskMB?: number;
      diskUsedMB?: number;
    };
  };
}

// =============================================================================
// Sync Types
// =============================================================================

export interface SyncResult {
  /** Files that were synced */
  synced: string[];
  /** Files that failed to sync */
  failed: Array<{ path: string; error: string }>;
  /** Total bytes transferred */
  bytesTransferred: number;
  /** Duration in milliseconds */
  duration: number;
}

// =============================================================================
// Snapshot Types
// =============================================================================

export interface SnapshotOptions {
  /** Include sandbox state (if supported) */
  includeSandbox?: boolean;
  /** Only snapshot specific paths */
  paths?: string[];
  /** Snapshot name/description */
  name?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface WorkspaceSnapshot {
  id: string;
  workspaceId: string;
  name?: string;
  createdAt: Date;
  /** Size in bytes */
  size: number;
  /** Provider-specific snapshot data */
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface RestoreOptions {
  /** Merge with existing state instead of replacing */
  merge?: boolean;
  /** Only restore specific paths */
  paths?: string[];
}

// =============================================================================
// Workspace Class
// =============================================================================

/**
 * Workspace provides agents with filesystem and execution capabilities.
 *
 * At minimum, a workspace has either a filesystem or a sandbox (or both).
 * Users pass instantiated provider objects to the constructor.
 */
export class Workspace {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
  lastAccessedAt: Date;

  private _status: WorkspaceStatus = 'pending';
  private readonly _fs?: WorkspaceFilesystem;
  private readonly _sandbox?: WorkspaceSandbox;
  private _state?: WorkspaceState;
  private readonly _config: WorkspaceConfig;
  private readonly _searchEngine?: SearchEngine;
  private _skills?: WorkspaceSkills;

  // Safety-related properties
  private readonly _readOnly: boolean;
  private readonly _requireReadBeforeWrite: boolean;
  private readonly _readTracker?: FileReadTracker;

  // Mount-related properties
  private readonly _mounts: Map<string, WorkspaceFilesystem>;
  private readonly _mountPath: string;
  private _accessMode: 'mounted' | 'sync' = 'sync';

  constructor(config: WorkspaceConfig) {
    this.id = config.id ?? this.generateId();
    this.name = config.name ?? `workspace-${this.id.slice(0, 8)}`;
    this.createdAt = new Date();
    this.lastAccessedAt = new Date();

    this._config = config;
    this._sandbox = config.sandbox;

    // Initialize mounts map
    this._mounts = new Map();

    // Handle mounts vs filesystem config
    if (config.mounts && Object.keys(config.mounts).length > 0) {
      // Use mounts - first entry becomes primary filesystem
      const entries = Object.entries(config.mounts);
      for (const [path, fs] of entries) {
        this._mounts.set(path, fs);
      }
      // First mount is the primary filesystem
      const firstEntry = entries[0]!;
      this._fs = firstEntry[1];
      this._mountPath = firstEntry[0];
    } else {
      // Use legacy filesystem + mountPath
      this._fs = config.filesystem;
      this._mountPath = config.mountPath ?? '';

      // If legacy mountPath is provided, add to mounts map for setupFilesystemAccess
      if (config.filesystem && config.mountPath) {
        this._mounts.set(config.mountPath, config.filesystem);
      }
    }

    // Initialize safety features
    this._readOnly = config.safety?.readOnly ?? false;
    this._requireReadBeforeWrite = config.safety?.requireReadBeforeWrite ?? true;
    if (this._requireReadBeforeWrite) {
      this._readTracker = new InMemoryFileReadTracker();
    }

    // Create state layer if filesystem is available
    if (this._fs) {
      this._state = new FilesystemState(this._fs);
    }

    // Create search engine if search is configured
    if (config.bm25 || (config.vectorStore && config.embedder)) {
      this._searchEngine = new SearchEngine({
        bm25: config.bm25
          ? {
              bm25: typeof config.bm25 === 'object' ? config.bm25 : undefined,
            }
          : undefined,
        vector:
          config.vectorStore && config.embedder
            ? {
                vectorStore: config.vectorStore,
                embedder: config.embedder,
                indexName: `${this.id}-search`,
              }
            : undefined,
      });
    }

    // Validate at least one provider is given
    if (!this._fs && !this._sandbox) {
      throw new WorkspaceError('Workspace requires at least a filesystem or sandbox provider', 'NO_PROVIDERS');
    }

    // Validate skills require filesystem
    if (config.skillsPaths && config.skillsPaths.length > 0 && !this._fs) {
      throw new WorkspaceError(
        'Skills require a filesystem provider. Configure filesystem or remove skillsPaths.',
        'SKILLS_REQUIRE_FILESYSTEM',
      );
    }

    // Auto-initialize if requested
    if (config.autoInit) {
      // Use void to indicate we intentionally don't await
      // This allows construction to complete while init runs in background
      void this.init();
    }
  }

  private generateId(): string {
    return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  get status(): WorkspaceStatus {
    return this._status;
  }

  /**
   * The filesystem provider (if configured).
   */
  get filesystem(): WorkspaceFilesystem | undefined {
    return this._fs;
  }

  /**
   * Alias for filesystem.
   */
  get fs(): WorkspaceFilesystem | undefined {
    return this._fs;
  }

  /**
   * The sandbox provider (if configured).
   */
  get sandbox(): WorkspaceSandbox | undefined {
    return this._sandbox;
  }

  /**
   * Key-value state storage (available when filesystem is present).
   */
  get state(): WorkspaceState | undefined {
    return this._state;
  }

  /**
   * The configured skillsPaths (if any).
   */
  get skillsPaths(): string[] | undefined {
    return this._config.skillsPaths;
  }

  /**
   * Whether the workspace is in read-only mode.
   */
  get readOnly(): boolean {
    return this._readOnly;
  }

  /**
   * How the filesystem is accessed from the sandbox.
   * - 'mounted': Filesystem is directly mounted in sandbox (unified view)
   * - 'sync': Files are copied between filesystem and sandbox (separate views)
   *
   * Mounted mode is preferred when both filesystem and sandbox support it,
   * as it provides a single unified view where workspace files are directly
   * accessible in sandbox code.
   */
  get accessMode(): 'mounted' | 'sync' {
    return this._accessMode;
  }

  /**
   * The path where the primary filesystem is mounted in the sandbox.
   * Returns undefined if no mount path was configured (sync mode).
   * Only has a value when accessMode is 'mounted'.
   */
  get mountPath(): string | undefined {
    return this._mountPath || undefined;
  }

  /**
   * All configured mounts (path -> filesystem).
   * Returns an empty Map if no mounts are configured.
   */
  get mounts(): ReadonlyMap<string, WorkspaceFilesystem> {
    return this._mounts;
  }

  /**
   * Get the safety configuration for this workspace.
   */
  getSafetyConfig(): WorkspaceSafetyConfig | undefined {
    return this._config.safety;
  }

  /**
   * Assert that the workspace is writable (not in read-only mode).
   * @throws {WorkspaceReadOnlyError} if workspace is read-only
   */
  private assertWritable(operation: string): void {
    if (this._readOnly) {
      throw new WorkspaceReadOnlyError(operation);
    }
  }

  // ---------------------------------------------------------------------------
  // Path Translation (for mounted filesystems)
  // ---------------------------------------------------------------------------

  /**
   * Convert a sandbox/user-facing path to the internal filesystem path.
   * When mounted at /home/user/s3, "/home/user/s3/file.txt" becomes "/file.txt"
   * Paths not under the mount point are returned as-is.
   */
  private toFilesystemPath(sandboxPath: string): string {
    if (!this._mountPath) {
      return sandboxPath;
    }

    // If path starts with mount path, strip it
    if (sandboxPath.startsWith(this._mountPath)) {
      const relativePath = sandboxPath.slice(this._mountPath.length);
      // Ensure we return a valid path (at least '/')
      return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    }

    // Path doesn't start with mount path - return as-is
    // This allows using filesystem-relative paths directly
    return sandboxPath;
  }

  /**
   * Convert an internal filesystem path to a sandbox/user-facing path.
   * When mounted at /home/user/s3, "/file.txt" becomes "/home/user/s3/file.txt"
   * Only applies when in mounted mode.
   */
  private toSandboxPath(filesystemPath: string): string {
    if (!this._mountPath || this._accessMode !== 'mounted') {
      return filesystemPath;
    }

    // If it already has the mount path prefix, return as-is
    if (filesystemPath.startsWith(this._mountPath)) {
      return filesystemPath;
    }

    // Prepend mount path
    const cleanFsPath = filesystemPath.startsWith('/') ? filesystemPath.slice(1) : filesystemPath;
    return this._mountPath.endsWith('/') ? `${this._mountPath}${cleanFsPath}` : `${this._mountPath}/${cleanFsPath}`;
  }

  /**
   * Access skills stored in this workspace.
   * Skills are SKILL.md files discovered from the configured skillsPaths.
   *
   * Returns undefined if no skillsPaths are configured or no filesystem is available.
   *
   * @example
   * ```typescript
   * const skills = await workspace.skills?.list();
   * const skill = await workspace.skills?.get('brand-guidelines');
   * const results = await workspace.skills?.search('brand colors');
   * ```
   */
  get skills(): WorkspaceSkills | undefined {
    // Skills require filesystem and skillsPaths
    if (!this._fs || !this._config.skillsPaths || this._config.skillsPaths.length === 0) {
      return undefined;
    }

    // Lazy initialization
    if (!this._skills) {
      // Translate skillsPaths from sandbox paths to filesystem paths
      const translatedSkillsPaths = this._config.skillsPaths?.map(p => this.toFilesystemPath(p));

      this._skills = new WorkspaceSkillsImpl({
        filesystem: this._fs,
        skillsPaths: translatedSkillsPaths,
        searchEngine: this._searchEngine,
        validateOnLoad: true,
      });
    }

    return this._skills;
  }

  // ---------------------------------------------------------------------------
  // Search Capabilities
  // ---------------------------------------------------------------------------

  /**
   * Check if BM25 keyword search is available.
   */
  get canBM25(): boolean {
    return this._searchEngine?.canBM25 ?? false;
  }

  /**
   * Check if vector semantic search is available.
   */
  get canVector(): boolean {
    return this._searchEngine?.canVector ?? false;
  }

  /**
   * Check if hybrid search is available.
   */
  get canHybrid(): boolean {
    return this._searchEngine?.canHybrid ?? false;
  }

  // ---------------------------------------------------------------------------
  // Convenience Methods (delegate to filesystem)
  // ---------------------------------------------------------------------------

  /**
   * Read a file from the workspace filesystem.
   * Paths can use either sandbox paths (e.g., /home/user/s3/file.txt) or
   * filesystem-relative paths (e.g., /file.txt) when mounted.
   * @throws {FilesystemNotAvailableError} if no filesystem is configured
   */
  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError();
    }
    this.lastAccessedAt = new Date();

    const fsPath = this.toFilesystemPath(path);
    const content = await this._fs.readFile(fsPath, options);

    // Track the read if requireReadBeforeWrite is enabled
    if (this._readTracker) {
      const stat = await this._fs.stat(fsPath);
      this._readTracker.recordRead(path, stat.modifiedAt);
    }

    return content;
  }

  /**
   * Write a file to the workspace filesystem.
   * Paths can use either sandbox paths (e.g., /home/user/s3/file.txt) or
   * filesystem-relative paths (e.g., /file.txt) when mounted.
   * @throws {FilesystemNotAvailableError} if no filesystem is configured
   * @throws {WorkspaceReadOnlyError} if workspace is in read-only mode
   * @throws {FileReadRequiredError} if requireReadBeforeWrite is enabled and file wasn't read or was modified
   */
  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError();
    }

    // Check readonly mode
    this.assertWritable('writeFile');

    const fsPath = this.toFilesystemPath(path);

    // Check read-before-write requirement (only for existing files)
    if (this._readTracker) {
      const exists = await this._fs.exists(fsPath);
      if (exists) {
        const stat = await this._fs.stat(fsPath);
        const check = this._readTracker.needsReRead(path, stat.modifiedAt);
        if (check.needsReRead) {
          throw new FileReadRequiredError(path, check.reason!);
        }
      }
      // New files don't require reading first
    }

    this.lastAccessedAt = new Date();
    await this._fs.writeFile(fsPath, content, options);

    // Clear the read record after successful write
    // (requires a new read to write again)
    if (this._readTracker) {
      this._readTracker.clearReadRecord(path);
    }
  }

  /**
   * Get virtual directory entries for paths above mount points.
   * For example, if mounted at /home/user/s3, listing / returns [{name: 'home', type: 'directory'}]
   */
  private getVirtualDirEntries(path: string): FileEntry[] | null {
    if (!this._mountPath) return null;

    const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    const mountParts = this._mountPath.split('/').filter(Boolean);

    // Check if path is above the mount point
    const pathParts = normalizedPath.split('/').filter(Boolean);

    // If path has same or more parts than mount, it's at or under mount - use filesystem
    if (pathParts.length >= mountParts.length) {
      return null;
    }

    // Check if path is a prefix of the mount path
    const isPrefix = pathParts.every((part, i) => mountParts[i] === part);
    if (!isPrefix) {
      return null;
    }

    // Return the next directory in the mount path as a virtual entry
    const nextDir = mountParts[pathParts.length];
    if (nextDir) {
      return [{ name: nextDir, type: 'directory' as const }];
    }

    return null;
  }

  /**
   * Check if a path is a virtual directory (above mount points).
   */
  private isVirtualPath(path: string): boolean {
    if (!this._mountPath) return false;

    const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    const mountParts = this._mountPath.split('/').filter(Boolean);
    const pathParts = normalizedPath.split('/').filter(Boolean);

    // Path must be shorter than mount and be a prefix of mount
    if (pathParts.length >= mountParts.length) return false;

    return pathParts.every((part, i) => mountParts[i] === part);
  }

  /**
   * List directory contents.
   * When mounted, shows virtual directory structure leading to mount points.
   * For example, if mounted at /home/user/s3:
   * - readdir('/') returns [{name: 'home', type: 'directory'}]
   * - readdir('/home') returns [{name: 'user', type: 'directory'}]
   * - readdir('/home/user/s3') returns actual filesystem contents
   * @throws {FilesystemNotAvailableError} if no filesystem is configured
   */
  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError();
    }
    this.lastAccessedAt = new Date();

    // Check for virtual directories above mount point
    const virtualEntries = this.getVirtualDirEntries(path);
    if (virtualEntries !== null) {
      return virtualEntries;
    }

    const fsPath = this.toFilesystemPath(path);
    return this._fs.readdir(fsPath, options);
  }

  /**
   * Check if a path exists.
   * Returns true for virtual directories above mount points.
   * @throws {FilesystemNotAvailableError} if no filesystem is configured
   */
  async exists(path: string): Promise<boolean> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError();
    }

    // Virtual directories above mount point always exist
    if (this.isVirtualPath(path)) {
      return true;
    }

    const fsPath = this.toFilesystemPath(path);
    return this._fs.exists(fsPath);
  }

  /**
   * Get file/directory metadata.
   * Returns virtual directory info for paths above mount points.
   * @throws {FilesystemNotAvailableError} if no filesystem is configured
   */
  async stat(path: string): Promise<FileStat> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError();
    }

    // Virtual directories above mount point
    if (this.isVirtualPath(path)) {
      const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
      const parts = normalizedPath.split('/').filter(Boolean);
      const name = parts[parts.length - 1] || '';
      const now = new Date();
      return {
        name,
        path: normalizedPath || '/',
        type: 'directory',
        size: 0,
        createdAt: now,
        modifiedAt: now,
      };
    }

    const fsPath = this.toFilesystemPath(path);
    return this._fs.stat(fsPath);
  }

  /**
   * Delete a file.
   * Paths can use either sandbox paths or filesystem-relative paths when mounted.
   * @throws {FilesystemNotAvailableError} if no filesystem is configured
   * @throws {WorkspaceReadOnlyError} if workspace is in read-only mode
   */
  async deleteFile(path: string, options?: { force?: boolean }): Promise<void> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError();
    }
    this.assertWritable('deleteFile');
    const fsPath = this.toFilesystemPath(path);
    await this._fs.deleteFile(fsPath, options);
  }

  /**
   * Create a directory.
   * Paths can use either sandbox paths or filesystem-relative paths when mounted.
   * @throws {FilesystemNotAvailableError} if no filesystem is configured
   * @throws {WorkspaceReadOnlyError} if workspace is in read-only mode
   */
  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError();
    }
    this.assertWritable('mkdir');
    const fsPath = this.toFilesystemPath(path);
    await this._fs.mkdir(fsPath, options);
  }

  /**
   * Remove a directory.
   * Paths can use either sandbox paths or filesystem-relative paths when mounted.
   * @throws {FilesystemNotAvailableError} if no filesystem is configured
   * @throws {WorkspaceReadOnlyError} if workspace is in read-only mode
   */
  async rmdir(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError();
    }
    this.assertWritable('rmdir');
    const fsPath = this.toFilesystemPath(path);
    await this._fs.rmdir(fsPath, options);
  }

  // ---------------------------------------------------------------------------
  // Convenience Methods (delegate to sandbox)
  // ---------------------------------------------------------------------------

  /**
   * Execute code in the sandbox.
   * @throws {SandboxNotAvailableError} if no sandbox is configured
   */
  async executeCode(code: string, options?: ExecuteCodeOptions): Promise<CodeResult> {
    if (!this._sandbox) {
      throw new SandboxNotAvailableError();
    }
    this.lastAccessedAt = new Date();
    return this._sandbox.executeCode(code, options);
  }

  /**
   * Execute a command in the sandbox.
   * @throws {SandboxNotAvailableError} if no sandbox is configured
   */
  async executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult> {
    if (!this._sandbox) {
      throw new SandboxNotAvailableError();
    }
    this.lastAccessedAt = new Date();
    return this._sandbox.executeCommand(command, args, options);
  }

  // ---------------------------------------------------------------------------
  // Search Operations
  // ---------------------------------------------------------------------------

  /**
   * Index content for search.
   * The path becomes the document ID in search results.
   *
   * @param path - File path (used as document ID)
   * @param content - Text content to index
   * @param options - Index options (metadata, type hints)
   * @throws {SearchNotAvailableError} if search is not configured
   */
  async index(
    path: string,
    content: string,
    options?: {
      type?: 'text' | 'image' | 'file';
      mimeType?: string;
      metadata?: Record<string, unknown>;
      startLineOffset?: number;
    },
  ): Promise<void> {
    if (!this._searchEngine) {
      throw new SearchNotAvailableError();
    }
    this.lastAccessedAt = new Date();

    const doc: IndexDocument = {
      id: path,
      content,
      metadata: {
        type: options?.type,
        mimeType: options?.mimeType,
        ...options?.metadata,
      },
      startLineOffset: options?.startLineOffset,
    };

    await this._searchEngine.index(doc);
  }

  /**
   * Index multiple documents.
   *
   * @param docs - Array of documents with path, content, and optional options
   * @throws {SearchNotAvailableError} if search is not configured
   */
  async indexMany(
    docs: Array<{
      path: string;
      content: string;
      options?: {
        type?: 'text' | 'image' | 'file';
        mimeType?: string;
        metadata?: Record<string, unknown>;
        startLineOffset?: number;
      };
    }>,
  ): Promise<void> {
    if (!this._searchEngine) {
      throw new SearchNotAvailableError();
    }
    this.lastAccessedAt = new Date();

    const indexDocs: IndexDocument[] = docs.map(({ path, content, options }) => ({
      id: path,
      content,
      metadata: {
        type: options?.type,
        mimeType: options?.mimeType,
        ...options?.metadata,
      },
      startLineOffset: options?.startLineOffset,
    }));

    await this._searchEngine.indexMany(indexDocs);
  }

  /**
   * Remove a document from the search index.
   *
   * @param path - File path (document ID) to remove
   * @throws {SearchNotAvailableError} if search is not configured
   */
  async unindex(path: string): Promise<void> {
    if (!this._searchEngine) {
      throw new SearchNotAvailableError();
    }
    this.lastAccessedAt = new Date();
    await this._searchEngine.remove(path);
  }

  /**
   * Search indexed content.
   *
   * @param query - Search query string
   * @param options - Search options (topK, mode, filters)
   * @returns Array of search results
   * @throws {SearchNotAvailableError} if search is not configured
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!this._searchEngine) {
      throw new SearchNotAvailableError();
    }
    this.lastAccessedAt = new Date();
    return this._searchEngine.search(query, options);
  }

  /**
   * Rebuild the BM25 index from filesystem paths.
   * Reads files from the specified paths (or autoIndexPaths from config) and indexes them.
   *
   * @param paths - Paths to index (defaults to autoIndexPaths from config)
   * @throws {SearchNotAvailableError} if search is not configured
   * @throws {FilesystemNotAvailableError} if filesystem is not configured
   */
  async rebuildIndex(paths?: string[]): Promise<void> {
    if (!this._searchEngine) {
      throw new SearchNotAvailableError();
    }
    if (!this._fs) {
      throw new FilesystemNotAvailableError();
    }

    const pathsToIndex = paths ?? this._config.autoIndexPaths ?? [];
    if (pathsToIndex.length === 0) {
      return;
    }

    // Clear existing BM25 index
    this._searchEngine.clear();

    // Index all files from specified paths
    for (const basePath of pathsToIndex) {
      try {
        const files = await this.getAllFiles(basePath);
        for (const filePath of files) {
          try {
            const content = await this._fs.readFile(filePath, { encoding: 'utf-8' });
            await this._searchEngine.index({
              id: filePath,
              content: content as string,
            });
          } catch {
            // Skip files that can't be read as text
          }
        }
      } catch {
        // Skip paths that don't exist
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Sync Operations
  // ---------------------------------------------------------------------------

  /**
   * Sync files from the workspace filesystem to the sandbox.
   * Useful for making persisted files available for execution.
   *
   * @param paths - Paths to sync (default: all files)
   * @throws {Error} if either filesystem or sandbox is not available
   */
  async syncToSandbox(paths?: string[]): Promise<SyncResult> {
    if (!this._fs || !this._sandbox) {
      throw new WorkspaceError('Both filesystem and sandbox are required for sync operations', 'SYNC_UNAVAILABLE');
    }

    const synced: string[] = [];
    const failed: Array<{ path: string; error: string }> = [];
    let bytesTransferred = 0;
    const startTime = Date.now();

    const filesToSync = paths ?? (await this.getAllFiles('/'));

    for (const filePath of filesToSync) {
      try {
        const content = await this._fs.readFile(filePath);
        await this._sandbox.writeFile!(filePath, content as string | Buffer);
        synced.push(filePath);
        bytesTransferred += typeof content === 'string' ? Buffer.byteLength(content) : content.length;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ path: filePath, error: message });
      }
    }

    return {
      synced,
      failed,
      bytesTransferred,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Sync files from the sandbox back to the workspace filesystem.
   * Useful for persisting execution outputs.
   *
   * @param paths - Paths to sync (default: all modified files)
   * @throws {Error} if either filesystem or sandbox is not available
   */
  async syncFromSandbox(paths?: string[]): Promise<SyncResult> {
    if (!this._fs || !this._sandbox) {
      throw new WorkspaceError('Both filesystem and sandbox are required for sync operations', 'SYNC_UNAVAILABLE');
    }

    const synced: string[] = [];
    const failed: Array<{ path: string; error: string }> = [];
    let bytesTransferred = 0;
    const startTime = Date.now();

    const filesToSync = paths ?? (await this._sandbox.listFiles!('/'));

    for (const filePath of filesToSync) {
      try {
        const content = await this._sandbox.readFile!(filePath);
        await this._fs.writeFile(filePath, content);
        synced.push(filePath);
        bytesTransferred += Buffer.byteLength(content);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ path: filePath, error: message });
      }
    }

    return {
      synced,
      failed,
      bytesTransferred,
      duration: Date.now() - startTime,
    };
  }

  /**
   * List all files in the workspace, optionally under a specific directory.
   * Returns paths in sandbox format when mounted (e.g., /home/user/s3/file.txt).
   * @param dir - Directory to list (defaults to root). Can use sandbox or filesystem paths.
   * @throws {FilesystemNotAvailableError} if no filesystem is configured
   */
  async listFiles(dir?: string): Promise<string[]> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError();
    }

    // If dir is provided, translate to filesystem path
    // If not provided, start from root of filesystem
    const fsDir = dir ? this.toFilesystemPath(dir) : '/';
    const files = await this.getAllFilesInternal(fsDir);

    // Transform to sandbox paths when mounted
    return files.map(f => this.toSandboxPath(f));
  }

  /**
   * Internal method to recursively get all files from filesystem.
   * Returns filesystem-relative paths (not sandbox paths).
   */
  private async getAllFilesInternal(dir: string): Promise<string[]> {
    if (!this._fs) return [];

    const files: string[] = [];
    const entries = await this._fs.readdir(dir);

    for (const entry of entries) {
      const fullPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
      if (entry.type === 'file') {
        files.push(fullPath);
      } else if (entry.type === 'directory') {
        files.push(...(await this.getAllFilesInternal(fullPath)));
      }
    }

    return files;
  }

  /**
   * @deprecated Use listFiles() instead for sandbox-aware paths
   */
  private async getAllFiles(dir: string): Promise<string[]> {
    return this.getAllFilesInternal(dir);
  }

  // ---------------------------------------------------------------------------
  // Snapshots
  // ---------------------------------------------------------------------------

  /**
   * Create a snapshot of the current workspace state.
   * Captures filesystem contents (and optionally sandbox state).
   */
  async snapshot(options?: SnapshotOptions): Promise<WorkspaceSnapshot> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError();
    }

    const files: Record<string, string | Buffer> = {};
    const pathsToSnapshot = options?.paths ?? (await this.getAllFiles('/'));

    for (const filePath of pathsToSnapshot) {
      try {
        files[filePath] = await this._fs.readFile(filePath);
      } catch {
        // Skip files that can't be read
      }
    }

    let size = 0;
    for (const content of Object.values(files)) {
      size += typeof content === 'string' ? Buffer.byteLength(content) : content.length;
    }

    return {
      id: this.generateId(),
      workspaceId: this.id,
      name: options?.name,
      createdAt: new Date(),
      size,
      data: files,
      metadata: options?.metadata,
    };
  }

  /**
   * Restore workspace from a snapshot.
   */
  async restore(snapshot: WorkspaceSnapshot, options?: RestoreOptions): Promise<void> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError();
    }

    const files = snapshot.data as Record<string, string | Buffer>;
    const pathsToRestore = options?.paths ?? Object.keys(files);

    // Clear existing files if not merging
    if (!options?.merge) {
      const existingFiles = await this.getAllFiles('/');
      for (const file of existingFiles) {
        if (!options?.paths || options.paths.includes(file)) {
          await this._fs.deleteFile(file, { force: true });
        }
      }
    }

    // Restore files
    for (const filePath of pathsToRestore) {
      if (files[filePath]) {
        await this._fs.writeFile(filePath, files[filePath], { recursive: true });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Initialize the workspace.
   * Starts the sandbox and initializes the filesystem.
   */
  /**
   * Setup filesystem access mode (mounted vs sync).
   * Called during init() after sandbox is started.
   *
   * Mounting only occurs when:
   * 1. mounts are configured (or legacy mountPath is provided)
   * 2. Both filesystem and sandbox are configured
   * 3. Both filesystem and sandbox support mounting
   *
   * Otherwise, falls back to sync mode where files are copied on demand.
   */
  private async setupFilesystemAccess(): Promise<void> {
    // Need sandbox for mounting
    if (!this._sandbox) {
      this._accessMode = 'sync';
      return;
    }

    // No mounts configured - use sync mode
    if (this._mounts.size === 0) {
      this._accessMode = 'sync';
      return;
    }

    // Check if sandbox supports mounting
    if (!this._sandbox.supportsMounting || !this._sandbox.mount) {
      this._accessMode = 'sync';
      return;
    }

    // Try to mount all configured filesystems
    let allMounted = true;
    for (const [mountPath, filesystem] of this._mounts) {
      const canMount = filesystem.supportsMounting && this._sandbox.canMount?.(filesystem);

      if (canMount) {
        try {
          await this._sandbox.mount(filesystem, mountPath);
        } catch (error) {
          console.warn(`Failed to mount filesystem at ${mountPath}, falling back to sync mode: ${error}`);
          allMounted = false;
        }
      } else {
        // This filesystem can't be mounted
        allMounted = false;
      }
    }

    this._accessMode = allMounted ? 'mounted' : 'sync';
  }

  async init(): Promise<void> {
    this._status = 'initializing';

    try {
      if (this._fs?.init) {
        await this._fs.init();
      }

      if (this._sandbox) {
        await this._sandbox.start();
      }

      // Setup filesystem access (mount if possible, otherwise sync)
      await this.setupFilesystemAccess();

      // Auto-index files if autoIndexPaths is configured
      if (this._searchEngine && this._config.autoIndexPaths && this._config.autoIndexPaths.length > 0) {
        await this.rebuildIndex(this._config.autoIndexPaths);
      }

      this._status = 'ready';
    } catch (error) {
      this._status = 'error';
      throw error;
    }
  }

  /**
   * Pause the workspace (stop sandbox but keep state).
   */
  async pause(): Promise<void> {
    if (this._sandbox?.stop) {
      await this._sandbox.stop();
    }
    this._status = 'paused';
  }

  /**
   * Resume a paused workspace.
   */
  async resume(): Promise<void> {
    if (this._sandbox) {
      await this._sandbox.start();
    }
    this._status = 'ready';
  }

  /**
   * Destroy the workspace and clean up all resources.
   */
  async destroy(): Promise<void> {
    this._status = 'destroying';

    try {
      if (this._sandbox) {
        await this._sandbox.destroy();
      }

      if (this._fs?.destroy) {
        await this._fs.destroy();
      }
    } finally {
      this._status = 'destroyed';
    }
  }

  /**
   * Extend the workspace timeout (for providers that have timeouts).
   */
  async keepAlive(): Promise<void> {
    this.lastAccessedAt = new Date();
  }

  /**
   * Get workspace information.
   */
  async getInfo(): Promise<WorkspaceInfo> {
    const info: WorkspaceInfo = {
      id: this.id,
      name: this.name,
      status: this._status,
      createdAt: this.createdAt,
      lastAccessedAt: this.lastAccessedAt,
    };

    if (this._fs) {
      info.filesystem = {
        provider: this._fs.provider,
      };

      try {
        const files = await this.getAllFiles('/');
        info.filesystem.totalFiles = files.length;
      } catch {
        // Ignore
      }
    }

    if (this._sandbox) {
      const sandboxInfo = await this._sandbox.getInfo();
      info.sandbox = {
        provider: this._sandbox.provider,
        status: sandboxInfo.status,
        supportedRuntimes: this._sandbox.supportedRuntimes,
        resources: sandboxInfo.resources,
      };
    }

    return info;
  }

  /**
   * Get information about how filesystem and sandbox paths relate.
   * Useful for understanding how to access workspace files from sandbox code.
   *
   * @returns PathContext with type, paths, and instructions
   */
  getPathContext(): PathContext {
    const hasFs = !!this._fs;
    const hasSandbox = !!this._sandbox;

    // Filesystem only
    if (hasFs && !hasSandbox) {
      return {
        type: 'filesystem-only',
        filesystem: {
          provider: this._fs!.provider,
          basePath: (this._fs as any).basePath,
        },
        requiresSync: false,
        instructions: 'No sandbox configured. Files can only be accessed via workspace filesystem tools.',
      };
    }

    // Sandbox only
    if (!hasFs && hasSandbox) {
      return {
        type: 'sandbox-only',
        sandbox: {
          provider: this._sandbox!.provider,
          workingDirectory: (this._sandbox as any).workingDirectory,
          scriptDirectory: (this._sandbox as any).scriptDirectory,
        },
        requiresSync: false,
        instructions: 'No filesystem configured. Code execution is available but files are ephemeral.',
      };
    }

    // Both configured - determine context type
    const fsProvider = this._fs!.provider;
    const sandboxProvider = this._sandbox!.provider;

    // Same-context combinations
    const isSameContext =
      (fsProvider === 'local' && sandboxProvider === 'local') || (fsProvider === 'e2b' && sandboxProvider === 'e2b');

    if (isSameContext) {
      const basePath = (this._fs as any).basePath as string | undefined;
      const workingDirectory = (this._sandbox as any).workingDirectory as string | undefined;
      const scriptDirectory = (this._sandbox as any).scriptDirectory as string | undefined;

      let instructions: string;
      if (basePath) {
        instructions = `Filesystem and sandbox share the same environment. Files written to workspace path "/foo" are accessible at "${basePath}/foo" in sandbox code. Working directory for commands: ${workingDirectory ?? 'process.cwd()'}.`;
      } else {
        instructions =
          'Filesystem and sandbox share the same environment. Use workspace_read_file to get file contents, then pass them to your code.';
      }

      return {
        type: 'same-context',
        filesystem: {
          provider: fsProvider,
          basePath,
        },
        sandbox: {
          provider: sandboxProvider,
          workingDirectory,
          scriptDirectory,
        },
        requiresSync: false,
        instructions,
      };
    }

    // Cross-context - requires sync
    return {
      type: 'cross-context',
      filesystem: {
        provider: fsProvider,
        basePath: (this._fs as any).basePath,
      },
      sandbox: {
        provider: sandboxProvider,
        workingDirectory: (this._sandbox as any).workingDirectory,
        scriptDirectory: (this._sandbox as any).scriptDirectory,
      },
      requiresSync: true,
      instructions:
        'Filesystem and sandbox are in different environments. To use workspace files in code: 1) Read file contents using workspace_read_file, 2) Pass contents as variables to your code, or 3) Use workspace_sync_to_sandbox to sync files before execution.',
    };
  }
}

// =============================================================================
// FilesystemState (KV layer over filesystem)
// =============================================================================

/**
 * Key-value state storage backed by the filesystem.
 */
class FilesystemState implements WorkspaceState {
  private readonly fs: WorkspaceFilesystem;
  private readonly stateDir = '/.state';

  constructor(fs: WorkspaceFilesystem) {
    this.fs = fs;
  }

  private keyToPath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${this.stateDir}/${safeKey}.json`;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const path = this.keyToPath(key);
    try {
      const content = await this.fs.readFile(path, { encoding: 'utf-8' });
      return JSON.parse(content as string) as T;
    } catch {
      return null;
    }
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    const path = this.keyToPath(key);
    await this.fs.mkdir(this.stateDir, { recursive: true });
    await this.fs.writeFile(path, JSON.stringify(value, null, 2));
  }

  async delete(key: string): Promise<boolean> {
    const path = this.keyToPath(key);
    try {
      await this.fs.deleteFile(path);
      return true;
    } catch {
      return false;
    }
  }

  async has(key: string): Promise<boolean> {
    const path = this.keyToPath(key);
    return this.fs.exists(path);
  }

  async keys(prefix?: string): Promise<string[]> {
    try {
      const entries = await this.fs.readdir(this.stateDir);
      let keys = entries
        .filter(e => e.type === 'file' && e.name.endsWith('.json'))
        .map(e => e.name.replace('.json', ''));

      if (prefix) {
        const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
        keys = keys.filter(k => k.startsWith(safePrefix));
      }

      return keys;
    } catch {
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      await this.fs.rmdir(this.stateDir, { recursive: true });
    } catch {
      // Ignore
    }
  }
}

// =============================================================================
// Errors
// =============================================================================

export class WorkspaceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly workspaceId?: string,
  ) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

export class FilesystemNotAvailableError extends WorkspaceError {
  constructor() {
    super('Workspace does not have a filesystem configured', 'NO_FILESYSTEM');
    this.name = 'FilesystemNotAvailableError';
  }
}

export class SandboxNotAvailableError extends WorkspaceError {
  constructor() {
    super('Workspace does not have a sandbox configured', 'NO_SANDBOX');
    this.name = 'SandboxNotAvailableError';
  }
}

export class SearchNotAvailableError extends WorkspaceError {
  constructor() {
    super('Workspace does not have search configured (enable bm25 or provide vectorStore + embedder)', 'NO_SEARCH');
    this.name = 'SearchNotAvailableError';
  }
}

export class WorkspaceNotReadyError extends WorkspaceError {
  constructor(workspaceId: string, status: WorkspaceStatus) {
    super(`Workspace is not ready (status: ${status})`, 'NOT_READY', workspaceId);
    this.name = 'WorkspaceNotReadyError';
  }
}

export class WorkspaceReadOnlyError extends WorkspaceError {
  constructor(operation: string) {
    super(`Workspace is in read-only mode. Cannot perform: ${operation}`, 'READ_ONLY');
    this.name = 'WorkspaceReadOnlyError';
  }
}
