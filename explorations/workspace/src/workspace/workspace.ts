/**
 * Workspace Implementation
 *
 * Combines a filesystem and executor into a unified workspace for agents.
 * Factory functions return the Workspace interface type.
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
  SyncResult,
  SnapshotOptions,
  WorkspaceSnapshot,
  RestoreOptions,
} from './types';
import {
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

// Import factories (not concrete implementations)
import { createFilesystem, createMemoryFilesystem, createLocalFilesystem } from '../filesystem/factory';
import { createExecutor, createLocalExecutor } from '../executor/factory';

/**
 * Base workspace implementation.
 *
 * Implements the Workspace interface by composing filesystem and executor.
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

    const filesToSync = paths ?? (await this.getAllFiles('/'));

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

    const filesToSync = paths ?? (await this._executor.listFiles!('/'));

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
        files.push(...(await this.getAllFiles(fullPath)));
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
      if (this._fs?.init) {
        await this._fs.init();
      }

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
      if (this._executor) {
        await this._executor.destroy();
      }

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
// Factory Functions (return interface types)
// =============================================================================

/**
 * Create a workspace with the given configuration.
 *
 * @param config - Workspace configuration
 * @param owner - Workspace owner information
 * @returns Workspace interface
 */
export async function createWorkspace(
  config: WorkspaceConfig,
  owner: WorkspaceOwner,
): Promise<Workspace> {
  let fs: WorkspaceFilesystem | undefined;
  let executor: WorkspaceExecutor | undefined;

  // Create filesystem using factory
  if (config.filesystem) {
    fs = createFilesystem(config.filesystem);
  }

  // Create executor using factory
  if (config.executor) {
    executor = createExecutor(config.executor);
  }

  const workspace = new BaseWorkspace(config, owner, fs, executor);

  if (config.autoInit !== false) {
    await workspace.init();
  }

  return workspace;
}

/**
 * Create a local development workspace.
 *
 * @param options - Local workspace options
 * @returns Workspace interface
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
  const id = options.id ?? uuidv4();

  const owner: WorkspaceOwner = {
    scope,
    agentId: options.agentId,
    threadId: options.threadId,
  };

  const fs = createLocalFilesystem({
    id: `local-fs-${id}`,
    basePath: options.basePath,
    sandbox: true,
  });

  const executor = createLocalExecutor({
    id: `local-exec-${id}`,
    cwd: options.basePath,
  });

  const workspace = new BaseWorkspace(
    { id, name: options.name, scope },
    owner,
    fs,
    executor,
  );

  await workspace.init();

  return workspace;
}

/**
 * Create an in-memory workspace.
 *
 * @param options - Memory workspace options
 * @returns Workspace interface
 */
export async function createMemoryWorkspace(options?: {
  id?: string;
  name?: string;
  scope?: WorkspaceScope;
  agentId?: string;
  threadId?: string;
  withExecutor?: boolean;
  initialFiles?: Record<string, string | Buffer>;
}): Promise<Workspace> {
  const scope = options?.scope ?? 'thread';
  const id = options?.id ?? uuidv4();

  const owner: WorkspaceOwner = {
    scope,
    agentId: options?.agentId,
    threadId: options?.threadId,
  };

  const fs = createMemoryFilesystem({
    id: `memory-fs-${id}`,
    initialFiles: options?.initialFiles,
  });

  let executor: WorkspaceExecutor | undefined;
  if (options?.withExecutor) {
    executor = createLocalExecutor({
      id: `local-exec-${id}`,
    });
  }

  const workspace = new BaseWorkspace(
    { id, name: options?.name, scope },
    owner,
    fs,
    executor,
  );

  await workspace.init();

  return workspace;
}
