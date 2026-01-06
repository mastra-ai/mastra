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

import type {
  WorkspaceFilesystem,
  WorkspaceState,
  FileContent,
  FileEntry,
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
   * Filesystem provider instance.
   * Use LocalFilesystem for a folder on disk, or AgentFS for Turso-backed storage.
   */
  filesystem?: WorkspaceFilesystem;

  /**
   * Sandbox provider instance.
   * Use ComputeSDKSandbox to access E2B, Modal, Docker, etc.
   */
  sandbox?: WorkspaceSandbox;

  /** Auto-initialize on construction (default: false) */
  autoInit?: boolean;

  /** Auto-sync between fs and sandbox (default: false) */
  autoSync?: boolean;

  /** Timeout for individual operations in milliseconds */
  operationTimeout?: number;
}

// =============================================================================
// Workspace Status & Info
// =============================================================================

export type WorkspaceStatus = 'pending' | 'initializing' | 'ready' | 'paused' | 'error' | 'destroying' | 'destroyed';

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

  constructor(config: WorkspaceConfig) {
    this.id = config.id ?? this.generateId();
    this.name = config.name ?? `workspace-${this.id.slice(0, 8)}`;
    this.createdAt = new Date();
    this.lastAccessedAt = new Date();

    this._config = config;
    this._fs = config.filesystem;
    this._sandbox = config.sandbox;

    // Create state layer if filesystem is available
    if (this._fs) {
      this._state = new FilesystemState(this._fs);
    }

    // Validate at least one provider is given
    if (!this._fs && !this._sandbox) {
      throw new WorkspaceError('Workspace requires at least a filesystem or sandbox provider', 'NO_PROVIDERS');
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

  // ---------------------------------------------------------------------------
  // Convenience Methods (delegate to filesystem)
  // ---------------------------------------------------------------------------

  /**
   * Read a file from the workspace filesystem.
   * @throws {FilesystemNotAvailableError} if no filesystem is configured
   */
  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError();
    }
    this.lastAccessedAt = new Date();
    return this._fs.readFile(path, options);
  }

  /**
   * Write a file to the workspace filesystem.
   * @throws {FilesystemNotAvailableError} if no filesystem is configured
   */
  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError();
    }
    this.lastAccessedAt = new Date();
    return this._fs.writeFile(path, content, options);
  }

  /**
   * List directory contents.
   * @throws {FilesystemNotAvailableError} if no filesystem is configured
   */
  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError();
    }
    this.lastAccessedAt = new Date();
    return this._fs.readdir(path, options);
  }

  /**
   * Check if a path exists.
   * @throws {FilesystemNotAvailableError} if no filesystem is configured
   */
  async exists(path: string): Promise<boolean> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError();
    }
    return this._fs.exists(path);
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

  private async getAllFiles(dir: string): Promise<string[]> {
    if (!this._fs) return [];

    const files: string[] = [];
    const entries = await this._fs.readdir(dir);

    for (const entry of entries) {
      const fullPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
      if (entry.type === 'file') {
        files.push(fullPath);
      } else if (entry.type === 'directory') {
        files.push(...(await this.getAllFiles(fullPath)));
      }
    }

    return files;
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
  async init(): Promise<void> {
    this._status = 'initializing';

    try {
      if (this._fs?.init) {
        await this._fs.init();
      }

      if (this._sandbox) {
        await this._sandbox.start();
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
        .filter((e) => e.type === 'file' && e.name.endsWith('.json'))
        .map((e) => e.name.replace('.json', ''));

      if (prefix) {
        const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
        keys = keys.filter((k) => k.startsWith(safePrefix));
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

export class WorkspaceNotReadyError extends WorkspaceError {
  constructor(workspaceId: string, status: WorkspaceStatus) {
    super(`Workspace is not ready (status: ${status})`, 'NOT_READY', workspaceId);
    this.name = 'WorkspaceNotReadyError';
  }
}
