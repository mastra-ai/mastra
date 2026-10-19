import { Buffer } from 'node:buffer';
import { posix } from 'node:path';

import type {
  CopyOptions,
  FileContent,
  FileEntry,
  FileStat,
  ListOptions,
  ProviderStatus,
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
import { InvalidArgumentError, NotFoundError, SandboxNotFoundError } from 'e2b';
import type { EntryInfo, Sandbox } from 'e2b';

import type { E2BSandbox } from './index';

type E2BFiles = Sandbox['files'];

/** The files calls the filesystem makes, each one retried on its own. */
interface FilesCalls {
  read(path: string, opts: { format: 'bytes' }): Promise<Uint8Array>;
  write(path: string, data: string | ArrayBuffer): Promise<unknown>;
  list(path: string, opts?: { depth?: number }): Promise<EntryInfo[]>;
  makeDir(path: string): Promise<boolean>;
  rename(oldPath: string, newPath: string): Promise<unknown>;
  remove(path: string): Promise<void>;
  getInfo(path: string): Promise<EntryInfo>;
}

/** Default recursion depth for `readdir({ recursive: true })`, matching `LocalFilesystem`. */
const DEFAULT_MAX_DEPTH = 100;

/**
 * envd's edge answers a paused or missing sandbox with a 404 that the SDK
 * reports as `FileNotFoundError`. Same pattern as `E2BSandbox`'s dead-sandbox
 * check, so those errors reach `retryOnDead` instead of reading as a missing file.
 */
const DEAD_SANDBOX = /\b(?:paused\s+)?sandbox(?:\s+\S+)?\s+(?:was\s+)?not found\b/i;

const isFileNotFound = (error: unknown) =>
  error instanceof NotFoundError &&
  !(error instanceof SandboxNotFoundError) &&
  !(error instanceof Error && DEAD_SANDBOX.test(error.message));

const toAbsolute = (path: string) => posix.resolve('/', path);

/** The entry's own type: a symlink is a link even when it points at a directory. */
const isSymlink = (info: EntryInfo) => info.symlinkTarget !== undefined;

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
 * The disk of an {@link E2BSandbox}, read and written through E2B's files API
 * (`sandbox.e2b.files`). Each operation starts the sandbox if needed and is
 * retried once on a sandbox that died server-side, like `executeCommand`.
 * Paths are absolute inside the sandbox; this class does not confine paths or
 * symlinks to any root.
 *
 * Not atomic: `appendFile` (read then write), `writeFile({ overwrite: false })`
 * and `copyFile({ overwrite: false })` (exists check then write), and recursive
 * `copyFile` (one write per file). Use `executeCommand` when you need atomicity.
 * A recursive `copyFile` copies what symlinks point at rather than the links.
 *
 * Kept in step with `PlatformSandboxFilesystem` in `@mastra/platform-workspace`, which maps the same files API;
 * the two can't share code without one package depending on the other.
 */
export class E2BSandboxFilesystem extends MastraFilesystem {
  readonly id: string;
  readonly name = 'E2BSandboxFilesystem';
  readonly provider = 'e2b';
  status: ProviderStatus = 'ready';

  readonly #sandbox: E2BSandbox;

  constructor(sandbox: E2BSandbox) {
    super({ name: 'E2BSandboxFilesystem' });
    this.id = `${sandbox.id}-filesystem`;
    this.#sandbox = sandbox;
  }

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const abs = toAbsolute(path);
    const bytes = await this.#run(async files => {
      try {
        return await files.read(abs, { format: 'bytes' });
      } catch (error) {
        if (isFileNotFound(error)) throw new FileNotFoundError(path);
        if (error instanceof InvalidArgumentError) throw new IsDirectoryError(path);
        throw error;
      }
    });
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return options?.encoding ? buffer.toString(options.encoding) : buffer;
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    const abs = toAbsolute(path);
    await this.#run(async files => {
      if (options?.recursive === false) await this.#assertParentDirectory(files, abs, path);
      if (options?.overwrite === false && (await this.#info(files, abs))) throw new FileExistsError(path);
      await this.#write(files, abs, path, toWriteData(content));
    });
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    const abs = toAbsolute(path);
    await this.#run(async files => {
      let existing: Uint8Array = new Uint8Array();
      try {
        existing = await files.read(abs, { format: 'bytes' });
      } catch (error) {
        if (error instanceof InvalidArgumentError) throw new IsDirectoryError(path);
        if (!isFileNotFound(error)) throw error;
      }
      const appended = Buffer.concat([existing, typeof content === 'string' ? Buffer.from(content) : content]);
      await this.#write(files, abs, path, toWriteData(appended));
    });
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    const abs = toAbsolute(path);
    await this.#run(async files => {
      const info = await this.#info(files, abs);
      if (!info) {
        if (options?.force) return;
        throw new FileNotFoundError(path);
      }
      if (!isSymlink(info) && info.type === 'dir') throw new IsDirectoryError(path);
      await files.remove(abs);
    });
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const srcAbs = toAbsolute(src);
    const destAbs = toAbsolute(dest);
    await this.#run(async files => {
      const info = await this.#info(files, srcAbs);
      if (!info?.type) throw new FileNotFoundError(src);
      if (info.type !== 'dir') {
        await this.#copyOne(files, srcAbs, destAbs, dest, options);
        return;
      }
      if (!options?.recursive) throw new IsDirectoryError(src);
      await this.#copyTree(files, srcAbs, destAbs, options, new Set([info.symlinkTarget ?? srcAbs]));
    });
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const srcAbs = toAbsolute(src);
    const destAbs = toAbsolute(dest);
    await this.#run(async files => {
      if (options?.overwrite === false && (await this.#info(files, destAbs))) throw new FileExistsError(dest);
      try {
        // rename creates missing destination parents, like exec's `mkdir -p` before `mv`.
        await files.rename(srcAbs, destAbs);
      } catch (error) {
        if (isFileNotFound(error)) throw new FileNotFoundError(src);
        throw error;
      }
    });
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const abs = toAbsolute(path);
    await this.#run(async files => {
      if (options?.recursive === false) await this.#assertParentDirectory(files, abs, path);
      try {
        await files.makeDir(abs);
      } catch (error) {
        // envd: "path already exists but it is not a directory"
        if (error instanceof InvalidArgumentError) throw new FileExistsError(path);
        throw error;
      }
    });
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    const abs = toAbsolute(path);
    await this.#run(async files => {
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
    const entries = await this.#run(async files => {
      try {
        return await files.list(abs, { depth });
      } catch (error) {
        if (isFileNotFound(error)) throw new DirectoryNotFoundError(path);
        // envd: "path is not a directory"
        if (error instanceof InvalidArgumentError) throw new NotDirectoryError(path);
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
    return this.#run(async files => Boolean((await this.#info(files, abs))?.type));
  }

  async stat(path: string): Promise<FileStat> {
    const abs = toAbsolute(path);
    return this.#run(async files => {
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

  /**
   * Run an operation with each files call wrapped in `retryOnDead`, so a
   * sandbox that died mid-operation is restarted and only the call that failed
   * runs again; the calls before it are never replayed. If the sandbox was
   * killed and replaced rather than paused, the rest of a multi-call operation
   * (a recursive copy) runs against the new sandbox's disk.
   */
  async #run<T>(fn: (files: FilesCalls) => Promise<T>): Promise<T> {
    await this.#sandbox.ensureRunning();
    // Re-read `e2b` on every call: after a restart it is a new handle.
    const call = <R>(invoke: (files: E2BFiles) => Promise<R>) =>
      this.#sandbox.retryOnDead(() => invoke(this.#sandbox.e2b.files));
    return fn({
      read: path => call(files => files.read(path, { format: 'bytes' })),
      write: (path, data) => call(files => files.write(path, data)),
      list: (path, opts) => call(files => files.list(path, opts)),
      makeDir: path => call(files => files.makeDir(path)),
      rename: (oldPath, newPath) => call(files => files.rename(oldPath, newPath)),
      remove: path => call(files => files.remove(path)),
      getInfo: path => call(files => files.getInfo(path)),
    });
  }

  /** `getInfo` without following the entry itself, or `undefined` when nothing is there. */
  async #info(files: FilesCalls, abs: string): Promise<EntryInfo | undefined> {
    try {
      return await files.getInfo(abs);
    } catch (error) {
      if (isFileNotFound(error)) return undefined;
      throw error;
    }
  }

  async #assertParentDirectory(files: FilesCalls, abs: string, path: string): Promise<void> {
    const parent = await this.#info(files, posix.dirname(abs));
    if (!parent?.type) throw new DirectoryNotFoundError(posix.dirname(path));
    if (parent.type !== 'dir') throw new NotDirectoryError(posix.dirname(path));
  }

  async #write(files: FilesCalls, abs: string, path: string, data: string | ArrayBuffer): Promise<void> {
    try {
      await files.write(abs, data);
    } catch (error) {
      // envd: "path is a directory"
      if (error instanceof InvalidArgumentError) throw new IsDirectoryError(path);
      throw error;
    }
  }

  async #copyOne(
    files: FilesCalls,
    srcAbs: string,
    destAbs: string,
    dest: string,
    options: CopyOptions | undefined,
  ): Promise<void> {
    if (options?.overwrite === false && (await this.#info(files, destAbs))) throw new FileExistsError(dest);
    const bytes = await files.read(srcAbs, { format: 'bytes' });
    await this.#write(files, destAbs, dest, toWriteData(bytes));
  }

  async #copyTree(
    files: FilesCalls,
    srcAbs: string,
    destAbs: string,
    options: CopyOptions | undefined,
    visited: Set<string>,
  ): Promise<void> {
    await files.makeDir(destAbs);
    for (const entry of await files.list(srcAbs)) {
      if (!entry.type) continue;
      const destEntry = posix.join(destAbs, entry.name);
      if (entry.type !== 'dir') {
        await this.#copyOne(files, entry.path, destEntry, destEntry, options);
        continue;
      }
      // A symlinked directory can point back up the tree; copy each real directory once.
      const real = entry.symlinkTarget ?? entry.path;
      if (visited.has(real)) continue;
      visited.add(real);
      await this.#copyTree(files, entry.path, destEntry, options, visited);
    }
  }
}
