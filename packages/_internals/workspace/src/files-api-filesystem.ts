import { Buffer } from 'node:buffer';
import { posix } from 'node:path';

import type {
  CopyOptions,
  FileContent,
  FileEntry,
  FileStat,
  ListOptions,
  ReadOptions,
  RemoveOptions,
  WriteOptions,
} from '@mastra/core/workspace';
import {
  DirectoryNotEmptyError,
  DirectoryNotFoundError,
  FileExistsError,
  FileNotFoundError,
  IsDirectoryError,
  MastraFilesystem,
  NotDirectoryError,
} from '@mastra/core/workspace';

import {
  FILE_COMMAND_EXIT,
  appendFromCommand,
  copyCommand,
  linkNoClobberCommand,
  moveNoClobberCommand,
  siblingTempPath,
} from './file-commands';

/** One entry as E2B's envd files API reports it (`EntryInfo`), reduced to the fields used here. */
export interface FilesApiEntry {
  name: string;
  /** `'file'` or `'dir'`, resolved through a symlink. Absent for a symlink whose target is missing. */
  type?: string;
  path: string;
  /** The entry's own size: a symlink's is the link's, not its target's. */
  size: number;
  modifiedTime?: Date;
  /** Set only on symlinks. */
  symlinkTarget?: string;
}

/** The envd files calls the filesystem makes (E2B's `sandbox.files`). */
export interface FilesApi {
  read(path: string, opts: { format: 'bytes' }): Promise<Uint8Array>;
  /** Creates missing parent directories. */
  write(path: string, data: string | ArrayBuffer): Promise<unknown>;
  list(path: string, opts?: { depth?: number }): Promise<FilesApiEntry[]>;
  /** Recursive; resolves `false` when the directory already exists. */
  makeDir(path: string): Promise<boolean>;
  /** Creates missing destination parents and replaces an existing file. */
  rename(oldPath: string, newPath: string): Promise<unknown>;
  /** Recursive; a symlink is unlinked, never followed. */
  remove(path: string): Promise<void>;
  /** Does not follow the entry itself. */
  getInfo(path: string): Promise<FilesApiEntry>;
}

/**
 * The file-level answers a provider recognizes in its SDK's errors.
 * `'not-found'` must not include "the sandbox itself is gone".
 */
export type FilesApiErrorKind = 'not-found' | 'invalid-argument';

export interface FilesCommandResult {
  exitCode: number;
  stderr: string;
}

/** Default recursion depth for `readdir({ recursive: true })`, matching `LocalFilesystem`. */
const DEFAULT_MAX_DEPTH = 100;

const toAbsolute = (path: string) => posix.resolve('/', path);

/** The entry's own type: a symlink is a link even when it points at a directory. */
const isSymlink = (info: FilesApiEntry) => info.symlinkTarget !== undefined;

function toWriteData(content: FileContent): string | ArrayBuffer {
  if (typeof content === 'string') return content;
  return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
}

function matchesExtension(name: string, extension: ListOptions['extension']): boolean {
  if (!extension) return true;
  const ext = posix.extname(name);
  const wanted = Array.isArray(extension) ? extension : [extension];
  return wanted.some(e => e === ext || e === ext.slice(1));
}

/**
 * A sandbox's disk, read and written through E2B's envd files API, with the
 * operations the files API can't do in one call (copy, append, no-clobber
 * writes and moves) run as one shell command inside the VM so they are atomic
 * and file bytes never round-trip through the host. Paths are absolute inside
 * the sandbox; this class does not confine paths or symlinks to any root.
 *
 * Providers supply how to reach the files API and the shell, and how to read
 * their SDK's errors.
 */
export abstract class FilesApiFilesystem extends MastraFilesystem {
  /** Run `fn` with the provider's files API (starting the sandbox, retrying, … as the provider needs). */
  protected abstract runFiles<T>(operation: string, fn: (files: FilesApi) => Promise<T>): Promise<T>;

  /** Run a POSIX `sh` script inside the sandbox. */
  protected abstract runCommand(operation: string, script: string): Promise<FilesCommandResult>;

  /** Which file-level answer, if any, a files API error is. Anything else propagates unchanged. */
  protected abstract errorKind(error: unknown): FilesApiErrorKind | undefined;

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const abs = toAbsolute(path);
    const bytes = await this.runFiles('readFile', async files => {
      try {
        return await files.read(abs, { format: 'bytes' });
      } catch (error) {
        const kind = this.errorKind(error);
        if (kind === 'not-found') throw new FileNotFoundError(path);
        if (kind === 'invalid-argument') throw new IsDirectoryError(path);
        throw error;
      }
    });
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return options?.encoding ? buffer.toString(options.encoding) : buffer;
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    const abs = toAbsolute(path);
    if (options?.overwrite !== false) {
      await this.runFiles('writeFile', async files => {
        if (options?.recursive === false) await this.#assertParentDirectory(files, abs, path);
        await this.#write(files, abs, path, toWriteData(content));
      });
      return;
    }
    // Write beside the destination, then hard-link it into place: `ln` fails
    // when the destination exists, so the exclusivity check can't race.
    const tmp = siblingTempPath(abs);
    await this.runFiles('writeFile', async files => {
      if (options.recursive === false) await this.#assertParentDirectory(files, abs, path);
      await this.#write(files, tmp, path, toWriteData(content));
    });
    await this.#command('writeFile', linkNoClobberCommand(tmp, abs), path, {
      exists: () => new FileExistsError(path),
      notDirectory: () => new NotDirectoryError(posix.dirname(path)),
    });
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    const abs = toAbsolute(path);
    // Only the new bytes cross the network; the append itself runs in the VM.
    const tmp = siblingTempPath(abs);
    await this.runFiles('appendFile', files => this.#write(files, tmp, path, toWriteData(content)));
    await this.#command('appendFile', appendFromCommand(tmp, abs), path, {
      isDirectory: () => new IsDirectoryError(path),
    });
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    const abs = toAbsolute(path);
    await this.runFiles('deleteFile', async files => {
      const info = await this.#info(files, abs);
      if (!info) {
        if (options?.force) return;
        throw new FileNotFoundError(path);
      }
      if (!isSymlink(info) && info.type === 'dir') throw new IsDirectoryError(path);
      await files.remove(abs);
    });
  }

  /**
   * One `cp` inside the VM. A recursive copy keeps symlinks inside the tree as
   * links; `overwrite: false` claims the destination atomically.
   */
  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const command = copyCommand(toAbsolute(src), toAbsolute(dest), {
      recursive: options?.recursive,
      overwrite: options?.overwrite,
    });
    await this.#command('copyFile', command, `${src} -> ${dest}`, {
      notFound: () => new FileNotFoundError(src),
      isDirectory: () => new IsDirectoryError(src),
      destIsDirectory: () => new IsDirectoryError(dest),
      exists: () => new FileExistsError(dest),
    });
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const srcAbs = toAbsolute(src);
    const destAbs = toAbsolute(dest);
    if (options?.overwrite === false) {
      await this.#command('moveFile', moveNoClobberCommand(srcAbs, destAbs), `${src} -> ${dest}`, {
        notFound: () => new FileNotFoundError(src),
        exists: () => new FileExistsError(dest),
      });
      return;
    }
    await this.runFiles('moveFile', async files => {
      try {
        // rename creates missing destination parents, like exec's `mkdir -p` before `mv`.
        await files.rename(srcAbs, destAbs);
      } catch (error) {
        if (this.errorKind(error) === 'not-found') throw new FileNotFoundError(src);
        throw error;
      }
    });
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const abs = toAbsolute(path);
    await this.runFiles('mkdir', async files => {
      if (options?.recursive === false) await this.#assertParentDirectory(files, abs, path);
      try {
        await files.makeDir(abs);
      } catch (error) {
        // envd: "path already exists but it is not a directory"
        if (this.errorKind(error) === 'invalid-argument') throw new FileExistsError(path);
        throw error;
      }
    });
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    const abs = toAbsolute(path);
    await this.runFiles('rmdir', async files => {
      const info = await this.#info(files, abs);
      if (!info) {
        if (options?.force) return;
        throw new DirectoryNotFoundError(path);
      }
      if (!options?.recursive) {
        if (isSymlink(info) || info.type !== 'dir') throw new NotDirectoryError(path);
        if ((await files.list(abs)).length > 0) throw new DirectoryNotEmptyError(path);
      } else if (!isSymlink(info) && info.type !== 'dir') {
        throw new NotDirectoryError(path);
      }
      await files.remove(abs);
    });
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    const abs = toAbsolute(path);
    const depth = options?.recursive ? (options.maxDepth ?? DEFAULT_MAX_DEPTH) + 1 : 1;
    const entries = await this.runFiles('readdir', async files => {
      try {
        return await files.list(abs, { depth });
      } catch (error) {
        const kind = this.errorKind(error);
        if (kind === 'not-found') throw new DirectoryNotFoundError(path);
        // envd: "path is not a directory"
        if (kind === 'invalid-argument') throw new NotDirectoryError(path);
        throw error;
      }
    });
    const result: FileEntry[] = [];
    for (const entry of entries) {
      // envd omits `type` for a symlink whose target is missing.
      if (!entry.type) continue;
      const name = posix.relative(abs, entry.path);
      const type = entry.type === 'dir' ? 'directory' : 'file';
      if (type === 'file' && !matchesExtension(name, options?.extension)) continue;
      const link = isSymlink(entry);
      result.push({
        name,
        type,
        ...(type === 'file' && !link && { size: entry.size }),
        ...(link && { isSymlink: true, symlinkTarget: entry.symlinkTarget }),
      });
    }
    return result;
  }

  async exists(path: string): Promise<boolean> {
    const abs = toAbsolute(path);
    return this.runFiles('exists', async files => Boolean((await this.#info(files, abs))?.type));
  }

  async stat(path: string): Promise<FileStat> {
    const abs = toAbsolute(path);
    return this.runFiles('stat', async files => {
      let info = await this.#info(files, abs);
      // Follow symlinks like `fs.stat`: the size and times are the target's.
      if (info?.type && isSymlink(info)) {
        info = await this.#info(files, posix.resolve(posix.dirname(abs), info.symlinkTarget!));
      }
      if (!info?.type) throw new FileNotFoundError(path);
      const modifiedAt = info.modifiedTime ?? new Date(0);
      return {
        name: posix.basename(abs),
        path: abs,
        type: info.type === 'dir' ? 'directory' : 'file',
        size: info.type === 'dir' ? 0 : info.size,
        createdAt: modifiedAt,
        modifiedAt,
      };
    });
  }

  /** `getInfo` without following the entry itself, or `undefined` when nothing is there. */
  async #info(files: FilesApi, abs: string): Promise<FilesApiEntry | undefined> {
    try {
      return await files.getInfo(abs);
    } catch (error) {
      if (this.errorKind(error) === 'not-found') return undefined;
      throw error;
    }
  }

  async #assertParentDirectory(files: FilesApi, abs: string, path: string): Promise<void> {
    const parent = await this.#info(files, posix.dirname(abs));
    if (!parent?.type) throw new DirectoryNotFoundError(posix.dirname(path));
    if (parent.type !== 'dir') throw new NotDirectoryError(posix.dirname(path));
  }

  async #write(files: FilesApi, abs: string, path: string, data: string | ArrayBuffer): Promise<void> {
    try {
      await files.write(abs, data);
    } catch (error) {
      // envd: "path is a directory"
      if (this.errorKind(error) === 'invalid-argument') throw new IsDirectoryError(path);
      throw error;
    }
  }

  /** Run a file command and turn its known exit codes into typed errors. */
  async #command(
    operation: string,
    script: string,
    subject: string,
    errors: Partial<Record<keyof typeof FILE_COMMAND_EXIT, () => Error>>,
  ): Promise<void> {
    const result = await this.runCommand(operation, script);
    if (result.exitCode === 0) return;
    for (const [outcome, code] of Object.entries(FILE_COMMAND_EXIT)) {
      const toError = errors[outcome as keyof typeof FILE_COMMAND_EXIT];
      if (code === result.exitCode && toError) throw toError();
    }
    throw new Error(`${operation} ${subject} failed (exit ${result.exitCode}): ${result.stderr.trim()}`);
  }
}
