import path from 'node:path';

import {
  DirectoryNotEmptyError,
  DirectoryNotFoundError,
  FileExistsError,
  FileNotFoundError,
  IsDirectoryError,
  MastraFilesystem,
  NotDirectoryError,
  PermissionError,
  StaleFileError,
  WorkspaceReadOnlyError,
} from '@mastra/core/workspace';
import type {
  CopyOptions,
  FileContent,
  FileEntry,
  FileStat,
  FilesystemInfo,
  ListOptions,
  ProviderStatus,
  ReadOptions,
  RemoveOptions,
  WriteOptions,
} from '@mastra/core/workspace';
import { SandboxFileNotFoundError } from '@mastra/railway';
import type { RailwaySandbox } from '@mastra/railway';

export interface RailwayFilesystemOptions {
  id?: string;
  sandbox: RailwaySandbox;
  basePath: string;
  readOnly?: boolean;
}

export class RailwayFilesystem extends MastraFilesystem {
  readonly id: string;
  readonly name = 'RailwayFilesystem';
  readonly provider = 'railway';
  readonly readOnly?: boolean;
  readonly basePath: string;
  readonly sandbox: RailwaySandbox;

  status: ProviderStatus = 'pending';

  constructor(options: RailwayFilesystemOptions) {
    super({ name: 'RailwayFilesystem' });
    this.id = options.id ?? `railway-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.sandbox = options.sandbox;
    this.basePath = path.posix.resolve(options.basePath);
    this.readOnly = options.readOnly;
  }

  async init(): Promise<void> {
    await this.withRetry(() => this.files().mkdir(this.basePath)).catch(() => {});
  }

  async getInfo(): Promise<FilesystemInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      readOnly: this.readOnly,
      metadata: { basePath: this.basePath },
    };
  }

  getInstructions(): string {
    return `Railway filesystem rooted at ${this.basePath}. File operations use the Railway SDK files API.`;
  }

  async readFile(inputPath: string, options?: ReadOptions): Promise<string | Buffer> {
    const fullPath = this.resolvePath(inputPath);
    try {
      const data = await this.withRetry(() => this.files().read(fullPath, { format: 'bytes' }));
      const buffer = Buffer.from(data);
      return options?.encoding ? buffer.toString(options.encoding) : buffer;
    } catch (error) {
      throw this.mapError(error, inputPath, 'readFile');
    }
  }

  async writeFile(inputPath: string, content: FileContent, options?: WriteOptions): Promise<void> {
    this.assertWritable('writeFile');
    const fullPath = this.resolvePath(inputPath);

    if (options?.overwrite === false) {
      if (await this.withRetry(() => this.files().exists(fullPath))) {
        throw new FileExistsError(inputPath);
      }
    }

    if (options?.expectedMtime) {
      try {
        const entry = await this.withRetry(() => this.files().stat(fullPath));
        const currentMtime = new Date(entry.modTime).getTime();
        if (currentMtime !== options.expectedMtime.getTime()) {
          throw new StaleFileError(inputPath, options.expectedMtime, new Date(currentMtime));
        }
      } catch (error) {
        if (error instanceof StaleFileError) throw error;
        // File doesn't exist yet — fine for a new file
      }
    }

    const data = this.toBuffer(content);
    await this.withRetry(() => this.files().write(fullPath, data));
  }

  async appendFile(inputPath: string, content: FileContent): Promise<void> {
    this.assertWritable('appendFile');
    const fullPath = this.resolvePath(inputPath);
    const existing = await this.withRetry(() => this.files().read(fullPath, { format: 'bytes' })).catch(
      () => new Uint8Array(),
    );
    const existingBuf = Buffer.from(existing);
    const newBuf = this.toBuffer(content);
    const combined = Buffer.concat([existingBuf, newBuf]);
    await this.withRetry(() => this.files().write(fullPath, combined));
  }

  async deleteFile(inputPath: string, options?: RemoveOptions): Promise<void> {
    this.assertWritable('deleteFile');
    const fullPath = this.resolvePath(inputPath);
    try {
      const entry = await this.withRetry(() => this.files().stat(fullPath));
      if (entry.isDir) {
        throw new IsDirectoryError(inputPath);
      }
      await this.withRetry(() => this.files().remove(fullPath));
    } catch (error) {
      if (options?.force && error instanceof FileNotFoundError) return;
      throw this.mapError(error, inputPath, 'deleteFile');
    }
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    this.assertWritable('copyFile');
    const fullSrc = this.resolvePath(src);
    const fullDest = this.resolvePath(dest);

    if (options?.overwrite === false && (await this.withRetry(() => this.files().exists(fullDest)))) {
      throw new FileExistsError(dest);
    }

    const entry = await this.withRetry(() => this.files().stat(fullSrc));
    if (entry.isDir) {
      if (!options?.recursive) {
        throw new IsDirectoryError(src);
      }
      // Recursive copy via shell command (SDK has no recursive copy)
      await this.exec(`cp -r ${shellQuote(fullSrc)} ${shellQuote(fullDest)}`);
    } else {
      const data = await this.withRetry(() => this.files().read(fullSrc, { format: 'bytes' }));
      await this.withRetry(() => this.files().write(fullDest, data));
    }
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    this.assertWritable('moveFile');
    const fullSrc = this.resolvePath(src);
    const fullDest = this.resolvePath(dest);

    if (options?.overwrite === false && (await this.withRetry(() => this.files().exists(fullDest)))) {
      throw new FileExistsError(dest);
    }

    try {
      await this.withRetry(() => this.files().rename(fullSrc, fullDest));
    } catch (error) {
      throw this.mapError(error, src, 'moveFile');
    }
  }

  async mkdir(inputPath: string, options?: { recursive?: boolean }): Promise<void> {
    this.assertWritable('mkdir');
    const fullPath = this.resolvePath(inputPath);
    if (options?.recursive === false) {
      // SDK's mkdir always acts like mkdir -p; for non-recursive, check parent exists
      const parent = path.posix.dirname(fullPath);
      if (!(await this.withRetry(() => this.files().exists(parent)))) {
        throw new FileNotFoundError(parent);
      }
    }
    await this.withRetry(() => this.files().mkdir(fullPath));
  }

  async rmdir(inputPath: string, options?: RemoveOptions): Promise<void> {
    this.assertWritable('rmdir');
    const fullPath = this.resolvePath(inputPath);
    try {
      if (options?.recursive) {
        // SDK's remove only handles empty dirs; use exec for recursive
        await this.exec(`rm -rf ${shellQuote(fullPath)}`);
      } else {
        await this.withRetry(() => this.files().remove(fullPath));
      }
    } catch (error) {
      if (options?.force && error instanceof DirectoryNotFoundError) return;
      throw this.mapError(error, inputPath, 'rmdir');
    }
  }

  async readdir(inputPath: string, options?: ListOptions): Promise<FileEntry[]> {
    const fullPath = this.resolvePath(inputPath);
    let entries: FileEntry[];

    try {
      const items = await this.withRetry(() => this.files().list(fullPath));
      entries = items.map(item => ({
        name: item.name,
        type: item.isDir ? 'directory' : 'file',
        size: item.isDir ? 0 : item.size,
        isSymlink: false,
      }));
    } catch (error) {
      throw this.mapError(error, inputPath, 'readdir');
    }

    // Filter by extension (directories always pass)
    if (options?.extension) {
      const extensions = Array.isArray(options.extension) ? options.extension : [options.extension];
      entries = entries.filter(entry => entry.type === 'directory' || extensions.some(ext => entry.name.endsWith(ext)));
    }

    // For recursive listing, walk subdirectories
    if (options?.recursive) {
      const maxDepth = options.maxDepth ?? Infinity;
      if (maxDepth > 1) {
        const expanded: FileEntry[] = [];
        for (const entry of entries) {
          expanded.push(entry);
          if (entry.type === 'directory') {
            const childPath = path.posix.join(inputPath, entry.name);
            const children = await this.readdir(childPath, {
              ...options,
              maxDepth: maxDepth === Infinity ? undefined : maxDepth - 1,
              recursive: true,
            });
            for (const child of children) {
              expanded.push({
                ...child,
                name: path.posix.join(entry.name, child.name),
              });
            }
          }
        }
        entries = expanded;
      }
    }

    return entries;
  }

  async exists(inputPath: string): Promise<boolean> {
    const fullPath = this.resolvePath(inputPath);
    return this.withRetry(() => this.files().exists(fullPath));
  }

  async stat(inputPath: string): Promise<FileStat> {
    const fullPath = this.resolvePath(inputPath);
    try {
      const entry = await this.withRetry(() => this.files().stat(fullPath));
      const mtime = new Date(entry.modTime);
      return {
        name: path.posix.basename(fullPath),
        path: fullPath,
        type: entry.isDir ? 'directory' : 'file',
        size: entry.isDir ? 0 : entry.size,
        createdAt: mtime,
        modifiedAt: mtime,
      };
    } catch (error) {
      throw this.mapError(error, inputPath, 'stat');
    }
  }

  async realpath(inputPath: string): Promise<string> {
    const fullPath = this.resolvePath(inputPath);
    const result = await this.exec(`realpath ${shellQuote(fullPath)}`);
    return result.trim();
  }

  // --- Internal helpers ---

  private files() {
    return this.sandbox.railway.files;
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    return this.sandbox.withRestartRetry(operation);
  }

  private async exec(command: string): Promise<string> {
    const result = await this.sandbox.executeCommand(command, [], { cwd: this.basePath });
    if (!result.success) {
      throw new Error(result.stderr || result.stdout || `Railway exec failed: ${command}`);
    }
    return result.stdout;
  }

  private resolvePath(inputPath: string): string {
    const resolved = path.posix.resolve(this.basePath, inputPath || '.');
    if (!this.isWithinBasePath(resolved)) {
      throw new PermissionError(inputPath, 'access');
    }
    return resolved;
  }

  private isWithinBasePath(resolvedPath: string): boolean {
    return resolvedPath === this.basePath || resolvedPath.startsWith(`${this.basePath}/`);
  }

  private assertWritable(operation: string): void {
    if (this.readOnly) {
      throw new WorkspaceReadOnlyError(operation);
    }
  }

  private toBuffer(content: FileContent): Buffer {
    return Buffer.isBuffer(content) ? content : Buffer.from(content);
  }

  private mapError(error: unknown, userPath: string, operation: string): Error {
    if (error instanceof SandboxFileNotFoundError) {
      return operation === 'readdir' || operation === 'rmdir'
        ? new DirectoryNotFoundError(userPath)
        : new FileNotFoundError(userPath);
    }
    if (error instanceof FileNotFoundError || error instanceof IsDirectoryError) {
      return error;
    }
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('is a directory')) {
        return new IsDirectoryError(userPath);
      }
      if (msg.includes('not a directory')) {
        return new NotDirectoryError(userPath);
      }
      if (msg.includes('directory not empty')) {
        return new DirectoryNotEmptyError(userPath);
      }
      if (msg.includes('permission denied')) {
        return new PermissionError(userPath, operation);
      }
    }
    return error instanceof Error ? error : new Error(`Railway filesystem operation failed: ${operation}`);
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
