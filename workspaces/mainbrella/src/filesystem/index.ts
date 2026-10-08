import { randomUUID } from 'node:crypto';
import posix from 'node:path/posix';

import { MainbrellaError } from '@mainbrella/sdk';
import type { FileEntry as MainbrellaFileEntry } from '@mainbrella/sdk';
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
  FilesystemInfo,
  FileStat,
  ListOptions,
  MastraFilesystemOptions,
  ProviderStatus,
  ReadOptions,
  RemoveOptions,
  WriteOptions,
} from '@mastra/core/workspace';

import type { MainbrellaSandbox } from '../sandbox';

export interface MainbrellaFilesystemOptions extends MastraFilesystemOptions {
  id?: string;
  /** The filesystem shares this sandbox and does not stop it on destroy. */
  sandbox: MainbrellaSandbox;
  /** Guest directory used as the workspace root. Defaults to /workspace. */
  basePath?: string;
  readOnly?: boolean;
}

function bytes(content: FileContent): Buffer {
  return Buffer.from(content);
}

/** HTTP filesystem over the same generation used for command execution. */
export class MainbrellaFilesystem extends MastraFilesystem {
  readonly id: string;
  readonly name = 'MainbrellaFilesystem';
  readonly provider = 'mainbrella';
  readonly basePath: string;
  readonly readOnly: boolean;
  status: ProviderStatus = 'pending';
  private readonly sandbox: MainbrellaSandbox;
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(options: MainbrellaFilesystemOptions) {
    super({ ...options, name: 'MainbrellaFilesystem' });
    this.id = options.id ?? `mainbrella-fs-${randomUUID()}`;
    this.sandbox = options.sandbox;
    const basePath = options.basePath ?? '/workspace';
    if (!posix.isAbsolute(basePath) || basePath.includes('\0'))
      throw new Error('basePath must be an absolute guest path');
    this.basePath = posix.normalize(basePath);
    this.readOnly = options.readOnly ?? false;
  }

  async init(): Promise<void> {
    await this.sandbox.ensureRunning();
    await this.requireCapability('stat');
    await this.checkParents(this.basePath, this.basePath);
    if (!this.readOnly && this.basePath !== '/') {
      await this.requireCapability('mkdir');
      await this.sandbox.mainbrella.files.mkdir(this.basePath, { recursive: true });
    }
    const root = await this.sandbox.mainbrella.files.stat(this.basePath);
    if (root.type !== 'directory') throw new NotDirectoryError(this.basePath);
  }

  async destroy(): Promise<void> {
    // Lifecycle belongs to the sandbox, which may have other consumers.
    this.status = 'destroyed';
  }

  async isReady(): Promise<boolean> {
    return this.status === 'ready' && (await this.sandbox.isReady());
  }

  getInfo(): FilesystemInfo {
    return { id: this.id, name: this.name, provider: this.provider, status: this.status, readOnly: this.readOnly };
  }

  getInstructions(): string {
    return `Workspace paths resolve under ${this.basePath} in the Mainbrella sandbox. Files are limited to 1 MiB and unsaved data is lost on sandbox stop. Symlinks and special files are not followed. Append and copy use HTTP read/write and are not atomic against external writers. Moves never overwrite existing destinations.`;
  }

  private resolvePath(path: string): string {
    if (path.includes('\0')) throw new PermissionError(path, 'invalid path');
    const relative = path.replace(/^\/+/, '');
    const resolved = posix.resolve(this.basePath, relative);
    if (resolved !== this.basePath && !resolved.startsWith(`${this.basePath === '/' ? '' : this.basePath}/`)) {
      throw new PermissionError(path, 'access outside filesystem base path');
    }
    return resolved;
  }

  private async requireCapability(operation: string): Promise<void> {
    if ((await this.sandbox.getCapabilities()).files[operation] !== true)
      throw new MainbrellaError('files_unavailable');
  }

  private async run<T>(operation: string, path: string, action: (resolved: string) => Promise<T>): Promise<T> {
    const resolved = this.resolvePath(path);
    await this.ensureReady();
    await this.sandbox.ensureRunning();
    await this.requireCapability(operation);
    await this.checkParents(resolved, path);
    try {
      return await action(resolved);
    } catch (error) {
      if (!(error instanceof MainbrellaError)) throw error;
      switch (error.code) {
        case 'file_not_found':
          throw new FileNotFoundError(path);
        case 'file_exists':
          throw new FileExistsError(path);
        case 'not_directory':
          throw new NotDirectoryError(path);
        case 'directory_not_empty':
          throw new DirectoryNotEmptyError(path);
        case 'symlink_not_allowed':
        case 'file_access_denied':
          throw new PermissionError(path, operation);
        default:
          throw error;
      }
    }
  }

  private async checkParents(resolved: string, path: string): Promise<void> {
    // Refuse existing symlink ancestors. Guest processes can still race these
    // checks; the directory namespace is not an isolation boundary within a VM.
    const parents: string[] = [];
    for (let parent = posix.dirname(resolved); parent !== '/'; parent = posix.dirname(parent)) parents.unshift(parent);
    for (const parent of parents) {
      try {
        const stat = await this.sandbox.mainbrella.files.stat(parent);
        if (stat.type === 'symlink') throw new PermissionError(path, 'follow symlink');
      } catch (error) {
        if (error instanceof MainbrellaError && error.code === 'file_not_found') break;
        throw error;
      }
    }
  }

  private mutate<T>(operation: string, action: () => Promise<T>): Promise<T> {
    if (this.readOnly) return Promise.reject(new WorkspaceReadOnlyError(operation));
    const next = this.writeQueue.then(action);
    this.writeQueue = next.catch(() => {});
    return next;
  }

  private async optionalStat(path: string): Promise<FileStat | undefined> {
    try {
      return await this.stat(path);
    } catch (error) {
      if (error instanceof FileNotFoundError) return undefined;
      throw error;
    }
  }

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const stat = await this.stat(path);
    if (stat.type === 'directory') throw new IsDirectoryError(path);
    const result = await this.run('read', path, resolved => this.sandbox.mainbrella.files.read(resolved));
    const buffer = Buffer.from(result);
    return options?.encoding ? buffer.toString(options.encoding) : buffer;
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    await this.mutate('writeFile', () => this.write(path, bytes(content), options));
  }

  private async write(path: string, content: Buffer, options?: WriteOptions): Promise<void> {
    this.resolvePath(path);
    if (content.byteLength > (await this.sandbox.getCapabilities()).files.maxFileBytes) {
      throw new MainbrellaError('file_too_large', 413);
    }
    const current = await this.optionalStat(path);
    if (current?.type === 'directory') throw new IsDirectoryError(path);
    if (current && options?.overwrite === false) throw new FileExistsError(path);
    if (current && options?.expectedMtime && current.modifiedAt.getTime() !== options.expectedMtime.getTime()) {
      throw new StaleFileError(path, options.expectedMtime, current.modifiedAt);
    }
    await this.run('write', path, async resolved => {
      if (options?.recursive !== false) {
        await this.requireCapability('mkdir');
        if (posix.dirname(resolved) !== '/')
          await this.sandbox.mainbrella.files.mkdir(posix.dirname(resolved), { recursive: true });
      } else {
        const parent = await this.sandbox.mainbrella.files.stat(posix.dirname(resolved)).catch(error => {
          if (error instanceof MainbrellaError && error.code === 'file_not_found') {
            throw new DirectoryNotFoundError(posix.dirname(path));
          }
          throw error;
        });
        if (parent.type !== 'directory') throw new NotDirectoryError(posix.dirname(path));
      }
      await this.sandbox.mainbrella.files.write(resolved, content);
    });
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    await this.mutate('appendFile', async () => {
      const current = await this.optionalStat(path);
      const previous = current ? ((await this.readFile(path)) as Buffer) : Buffer.alloc(0);
      await this.write(path, Buffer.concat([previous, bytes(content)]));
    });
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    await this.mutate('deleteFile', async () => {
      const current = await this.optionalStat(path);
      if (!current) {
        if (options?.force) return;
        throw new FileNotFoundError(path);
      }
      if (current.type === 'directory') throw new IsDirectoryError(path);
      await this.run('delete', path, resolved => this.sandbox.mainbrella.files.remove(resolved));
    });
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.mutate('copyFile', () => this.copy(src, dest, options));
  }

  private async copy(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const source = this.resolvePath(src);
    const destination = this.resolvePath(dest);
    if (source === destination || destination.startsWith(`${source}/`)) throw new FileExistsError(dest);
    const stat = await this.stat(src);
    if (stat.type === 'directory') {
      if (!options?.recursive) throw new IsDirectoryError(src);
      if ((await this.exists(dest)) && options.overwrite === false) throw new FileExistsError(dest);
      await this.makeDirectory(dest, true);
      for (const entry of await this.readdir(src)) {
        if (entry.isSymlink) throw new PermissionError(posix.join(src, entry.name), 'copy symlink');
        await this.copy(posix.join(src, entry.name), posix.join(dest, entry.name), options);
      }
    } else {
      await this.write(dest, (await this.readFile(src)) as Buffer, { overwrite: options?.overwrite });
    }
  }

  async moveFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    await this.mutate('moveFile', async () => {
      if (this.resolvePath(src) === this.basePath) throw new PermissionError(src, 'move filesystem base path');
      // The backend's move operation never overwrites, including races.
      // Do not emulate overwrite by deleting a destination before the move.
      await this.run('move', dest, async destination => {
        await this.run('move', src, source => this.sandbox.mainbrella.files.move(source, destination));
      });
    });
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await this.mutate('mkdir', () => this.makeDirectory(path, options?.recursive !== false));
  }

  private async makeDirectory(path: string, recursive: boolean): Promise<void> {
    await this.run('mkdir', path, resolved => this.sandbox.mainbrella.files.mkdir(resolved, { recursive }));
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    await this.mutate('rmdir', async () => {
      if (this.resolvePath(path) === this.basePath) throw new PermissionError(path, 'remove filesystem base path');
      const current = await this.optionalStat(path);
      if (!current) {
        if (options?.force) return;
        throw new DirectoryNotFoundError(path);
      }
      if (current.type !== 'directory') throw new NotDirectoryError(path);
      await this.run('delete', path, resolved =>
        this.sandbox.mainbrella.files.remove(resolved, { recursive: options?.recursive ?? false }),
      );
    });
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    const entries: FileEntry[] = [];
    const extensions = options?.extension ? [options.extension].flat() : undefined;
    const visit = async (directory: string, prefix: string, depth: number): Promise<void> => {
      await this.run('list', directory, async resolved => {
        let offset = 0;
        while (true) {
          const page = await this.sandbox.mainbrella.files.list(resolved, { offset });
          for (const entry of page.entries) {
            const name = posix.join(prefix, entry.name);
            const type = entry.type === 'directory' ? 'directory' : 'file';
            if (
              type === 'directory' ||
              !extensions ||
              extensions.some(ext => ext.replace(/^\./, '') === posix.extname(name).slice(1))
            ) {
              entries.push({
                name,
                type,
                size: entry.size,
                ...(entry.type === 'symlink' && { isSymlink: true, symlinkTarget: entry.linkTarget }),
              });
            }
            if (entry.type === 'directory' && options?.recursive && depth < (options.maxDepth ?? 100)) {
              await visit(posix.join(directory, entry.name), name, depth + 1);
            }
          }
          if (page.nextOffset === null) break;
          if (page.nextOffset <= offset) throw new MainbrellaError('invalid_directory_response');
          offset = page.nextOffset;
        }
      });
    };
    try {
      if ((await this.stat(path)).type !== 'directory') throw new NotDirectoryError(path);
      await visit(path, '', 0);
    } catch (error) {
      if (error instanceof FileNotFoundError) throw new DirectoryNotFoundError(path);
      throw error;
    }
    return entries;
  }

  async exists(path: string): Promise<boolean> {
    return (await this.optionalStat(path)) !== undefined;
  }

  async stat(path: string): Promise<FileStat> {
    const entry: MainbrellaFileEntry = await this.run('stat', path, resolved =>
      this.sandbox.mainbrella.files.stat(resolved),
    );
    if (entry.type !== 'file' && entry.type !== 'directory')
      throw new PermissionError(path, 'access symlink or special file');
    // The metadata API exposes mtime only; use it as the creation-time fallback.
    const modifiedAt = new Date(entry.modifiedAt);
    return {
      name: entry.name,
      path: this.resolvePath(path),
      type: entry.type,
      size: entry.type === 'directory' ? 0 : entry.size,
      createdAt: modifiedAt,
      modifiedAt,
    };
  }
}
