/**
 * Workspace Implementation
 *
 * Combines a filesystem and executor into a unified workspace for agents.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Workspace,
  WorkspaceScope,
  WorkspaceOwner,
  WorkspaceStatus,
  WorkspaceInfo,
  WorkspaceConfig,
  WorkspaceAudit,
  WorkspaceAuditEntry,
  WorkspaceAuditOptions,
  SyncResult,
  SnapshotOptions,
  WorkspaceSnapshot,
  RestoreOptions,
} from './types';
import {
  WorkspaceNotReadyError,
  FilesystemNotAvailableError,
  ExecutorNotAvailableError,
} from './types';
import type {
  WorkspaceFilesystem,
  WorkspaceState,
  FileContent,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
} from '../filesystem/types';
import type {
  WorkspaceExecutor,
  CodeResult,
  CommandResult,
  ExecuteCodeOptions,
  ExecuteCommandOptions,
} from '../executor/types';

// Import providers
import { LocalFilesystem, createLocalFilesystem } from '../filesystem/local';
import { MemoryFilesystem, createMemoryFilesystem } from '../filesystem/memory';
import { LocalExecutor, createLocalExecutor } from '../executor/local';

/**
 * Default Workspace implementation.
 */
export class BaseWorkspace implements Workspace {
  readonly id: string;
  readonly name: string;
  readonly scope: WorkspaceScope;
  readonly owner: WorkspaceOwner;
  readonly createdAt: Date;
  lastAccessedAt: Date;

  private _status: WorkspaceStatus = 'pending';
  private _fs?: WorkspaceFilesystem;
  private _executor?: WorkspaceExecutor;
  private _state?: WorkspaceState;
  private _audit?: WorkspaceAudit;

  constructor(
    config: WorkspaceConfig,
    owner: WorkspaceOwner,
    fs?: WorkspaceFilesystem,
    executor?: WorkspaceExecutor,
  ) {
    this.id = config.id ?? uuidv4();
    this.name = config.name ?? `workspace-${this.id.slice(0, 8)}`;
    this.scope = config.scope;
    this.owner = owner;
    this.createdAt = new Date();
    this.lastAccessedAt = new Date();

    this._fs = fs;
    this._executor = executor;

    // Create state layer if filesystem is available
    if (this._fs) {
      this._state = new FilesystemState(this._fs);
    }
  }

  get status(): WorkspaceStatus {
    return this._status;
  }

  get fs(): WorkspaceFilesystem | undefined {
    return this._fs;
  }

  get executor(): WorkspaceExecutor | undefined {
    return this._executor;
  }

  get state(): WorkspaceState | undefined {
    return this._state;
  }

  get audit(): WorkspaceAudit | undefined {
    return this._audit;
  }

  // ---------------------------------------------------------------------------
  // Convenience Methods (delegate to fs)
  // ---------------------------------------------------------------------------

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError(this.id);
    }
    this.lastAccessedAt = new Date();
    return this._fs.readFile(path, options);
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError(this.id);
    }
    this.lastAccessedAt = new Date();
    return this._fs.writeFile(path, content, options);
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError(this.id);
    }
    this.lastAccessedAt = new Date();
    return this._fs.readdir(path, options);
  }

  async exists(path: string): Promise<boolean> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError(this.id);
    }
    return this._fs.exists(path);
  }

  // ---------------------------------------------------------------------------
  // Convenience Methods (delegate to executor)
  // ---------------------------------------------------------------------------

  async executeCode(code: string, options?: ExecuteCodeOptions): Promise<CodeResult> {
    if (!this._executor) {
      throw new ExecutorNotAvailableError(this.id);
    }
    this.lastAccessedAt = new Date();
    return this._executor.executeCode(code, options);
  }

  async executeCommand(
    command: string,
    args?: string[],
    options?: ExecuteCommandOptions,
  ): Promise<CommandResult> {
    if (!this._executor) {
      throw new ExecutorNotAvailableError(this.id);
    }
    this.lastAccessedAt = new Date();
    return this._executor.executeCommand(command, args, options);
  }

  // ---------------------------------------------------------------------------
  // Sync Operations
  // ---------------------------------------------------------------------------

  async syncToExecutor(paths?: string[]): Promise<SyncResult> {
    if (!this._fs || !this._executor) {
      throw new Error('Both filesystem and executor are required for sync operations');
    }

    const synced: string[] = [];
    const failed: Array<{ path: string; error: string }> = [];
    let bytesTransferred = 0;
    const startTime = Date.now();

    // Get all files to sync
    const filesToSync = paths ?? await this.getAllFiles('/');

    for (const filePath of filesToSync) {
      try {
        const content = await this._fs.readFile(filePath);
        await this._executor.writeFile!(filePath, content as string | Buffer);
        synced.push(filePath);
        bytesTransferred += typeof content === 'string' ? Buffer.byteLength(content) : content.length;
      } catch (error: any) {
        failed.push({ path: filePath, error: error.message });
      }
    }

    return {
      synced,
      failed,
      bytesTransferred,
      duration: Date.now() - startTime,
    };
  }

  async syncFromExecutor(paths?: string[]): Promise<SyncResult> {
    if (!this._fs || !this._executor) {
      throw new Error('Both filesystem and executor are required for sync operations');
    }

    const synced: string[] = [];
    const failed: Array<{ path: string; error: string }> = [];
    let bytesTransferred = 0;
    const startTime = Date.now();

    // Get files from executor
    const filesToSync = paths ?? await this._executor.listFiles!('/');

    for (const filePath of filesToSync) {
      try {
        const content = await this._executor.readFile!(filePath);
        await this._fs.writeFile(filePath, content);
        synced.push(filePath);
        bytesTransferred += Buffer.byteLength(content);
      } catch (error: any) {
        failed.push({ path: filePath, error: error.message });
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
        files.push(...await this.getAllFiles(fullPath));
      }
    }

    return files;
  }

  // ---------------------------------------------------------------------------
  // Snapshots
  // ---------------------------------------------------------------------------

  async snapshot(options?: SnapshotOptions): Promise<WorkspaceSnapshot> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError(this.id);
    }

    const files: Record<string, string | Buffer> = {};
    const pathsToSnapshot = options?.paths ?? await this.getAllFiles('/');

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
      id: uuidv4(),
      workspaceId: this.id,
      name: options?.name,
      createdAt: new Date(),
      size,
      data: files,
      metadata: options?.metadata,
    };
  }

  async restore(snapshot: WorkspaceSnapshot, options?: RestoreOptions): Promise<void> {
    if (!this._fs) {
      throw new FilesystemNotAvailableError(this.id);
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

  async init(): Promise<void> {
    this._status = 'initializing';

    try {
      // Initialize filesystem
      if (this._fs?.init) {
        await this._fs.init();
      }

      // Initialize executor
      if (this._executor) {
        await this._executor.start();
      }

      this._status = 'ready';
    } catch (error) {
      this._status = 'error';
      throw error;
    }
  }

  async pause(): Promise<void> {
    if (this._executor?.stop) {
      await this._executor.stop();
    }
    this._status = 'paused';
  }

  async resume(): Promise<void> {
    if (this._executor) {
      await this._executor.start();
    }
    this._status = 'ready';
  }

  async destroy(): Promise<void> {
    this._status = 'destroying';

    try {
      // Destroy executor first
      if (this._executor) {
        await this._executor.destroy();
      }

      // Then filesystem
      if (this._fs?.destroy) {
        await this._fs.destroy();
      }
    } finally {
      this._status = 'destroyed';
    }
  }

  async keepAlive(): Promise<void> {
    this.lastAccessedAt = new Date();
  }

  async getInfo(): Promise<WorkspaceInfo> {
    const info: WorkspaceInfo = {
      id: this.id,
      name: this.name,
      scope: this.scope,
      owner: this.owner,
      status: this._status,
      createdAt: this.createdAt,
      lastAccessedAt: this.lastAccessedAt,
    };

    if (this._fs) {
      info.filesystem = {
        provider: this._fs.provider,
      };

      // Try to get file count
      try {
        const files = await this.getAllFiles('/');
        info.filesystem.totalFiles = files.length;
      } catch {
        // Ignore
      }
    }

    if (this._executor) {
      const executorInfo = await this._executor.getInfo();
      info.executor = {
        provider: this._executor.provider,
        status: executorInfo.status,
        supportedRuntimes: this._executor.supportedRuntimes,
        resources: executorInfo.resources,
      };
    }

    return info;
  }
}

/**
 * Simple key-value state storage backed by the filesystem.
 * Stores JSON files in a .state directory.
 */
class FilesystemState implements WorkspaceState {
  private readonly fs: WorkspaceFilesystem;
  private readonly stateDir = '/.state';

  constructor(fs: WorkspaceFilesystem) {
    this.fs = fs;
  }

  private keyToPath(key: string): string {
    // Sanitize key to be filesystem-safe
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
      // Ignore if directory doesn't exist
    }
  }
}

// ---------------------------------------------------------------------------
// Factory Functions
// ---------------------------------------------------------------------------

/**
 * Create a workspace with the given configuration.
 */
export async function createWorkspace(
  config: WorkspaceConfig,
  owner: WorkspaceOwner,
): Promise<Workspace> {
  let fs: WorkspaceFilesystem | undefined;
  let executor: WorkspaceExecutor | undefined;

  // Create filesystem
  if (config.filesystem) {
    switch (config.filesystem.provider) {
      case 'local':
        fs = createLocalFilesystem(config.filesystem);
        break;
      case 'memory':
        fs = createMemoryFilesystem(config.filesystem);
        break;
      // Add more providers as they're implemented
      default:
        throw new Error(`Unknown filesystem provider: ${(config.filesystem as any).provider}`);
    }
  }

  // Create executor
  if (config.executor) {
    switch (config.executor.provider) {
      case 'local':
        executor = createLocalExecutor(config.executor);
        break;
      // Add more providers as they're implemented
      default:
        throw new Error(`Unknown executor provider: ${(config.executor as any).provider}`);
    }
  }

  const workspace = new BaseWorkspace(config, owner, fs, executor);

  // Auto-init if configured (default: true)
  if (config.autoInit !== false) {
    await workspace.init();
  }

  return workspace;
}

/**
 * Create a local development workspace with both filesystem and executor.
 * Uses the local filesystem and local shell for execution.
 */
export async function createLocalWorkspace(options: {
  id?: string;
  name?: string;
  basePath: string;
  scope?: WorkspaceScope;
  agentId?: string;
  threadId?: string;
}): Promise<Workspace> {
  const scope = options.scope ?? 'agent';
  const owner: WorkspaceOwner = {
    scope,
    agentId: options.agentId,
    threadId: options.threadId,
  };

  return createWorkspace(
    {
      id: options.id,
      name: options.name,
      scope,
      filesystem: {
        provider: 'local',
        id: `local-fs-${options.id ?? uuidv4()}`,
        basePath: options.basePath,
        sandbox: true,
      },
      executor: {
        provider: 'local',
        id: `local-exec-${options.id ?? uuidv4()}`,
        cwd: options.basePath,
      },
    },
    owner,
  );
}

/**
 * Create an in-memory workspace (no persistence).
 * Useful for testing and ephemeral operations.
 */
export async function createMemoryWorkspace(options?: {
  id?: string;
  name?: string;
  scope?: WorkspaceScope;
  agentId?: string;
  threadId?: string;
  withExecutor?: boolean;
}): Promise<Workspace> {
  const scope = options?.scope ?? 'thread';
  const owner: WorkspaceOwner = {
    scope,
    agentId: options?.agentId,
    threadId: options?.threadId,
  };

  const config: WorkspaceConfig = {
    id: options?.id,
    name: options?.name,
    scope,
    filesystem: {
      provider: 'memory',
      id: `memory-fs-${options?.id ?? uuidv4()}`,
    },
  };

  // Add local executor if requested
  if (options?.withExecutor) {
    config.executor = {
      provider: 'local',
      id: `local-exec-${options?.id ?? uuidv4()}`,
    };
  }

  return createWorkspace(config, owner);
}
