import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { createFilesystemTestSuite } from '@internal/workspace-test-utils';
import {
  DirectoryNotEmptyError,
  DirectoryNotFoundError,
  FileExistsError,
  FileNotFoundError,
  IsDirectoryError,
  NotDirectoryError,
} from '@mastra/core/workspace';
import type { ProviderStatus } from '@mastra/core/workspace';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FilesApiFilesystem } from './files-api-filesystem';
import type { FilesApi, FilesApiEntry, FilesApiErrorKind, FilesCommandResult } from './files-api-filesystem';

const code = (error: unknown) => (error as NodeJS.ErrnoException).code;
const runSh = promisify(execFile);

/** Stand-ins for the E2B SDK error classes envd's answers arrive as. */
class NotFound extends Error {}
class InvalidArgument extends Error {}
class ServerError extends Error {}

/**
 * A filesystem over {@link FakeFiles} whose commands run in the host shell.
 * Sandbox paths are host paths (a realpath'd temp dir), so the same absolute
 * path works for the files API and for `sh`.
 */
let nextId = 0;

class TestFilesystem extends FilesApiFilesystem {
  readonly id = `test-filesystem-${nextId++}`;
  readonly name = 'TestFilesystem';
  readonly provider = 'test';
  status: ProviderStatus = 'ready';
  commands: string[] = [];

  constructor(
    readonly files: FakeFiles,
    private readonly root = '',
  ) {
    super({ name: 'TestFilesystem' });
  }

  protected runFiles<T>(_operation: string, fn: (files: FilesApi) => Promise<T>): Promise<T> {
    return fn(this.files);
  }

  protected async runCommand(operation: string, script: string): Promise<FilesCommandResult> {
    this.commands.push(operation);
    // Every absolute path in a file command is a single-quoted literal, so
    // rooting the script is a plain prefix on each one.
    const rooted = this.root ? script.replaceAll(`'/`, `'${this.root}/`) : script;
    try {
      const { stderr } = await runSh('sh', ['-c', rooted]);
      return { exitCode: 0, stderr };
    } catch (error) {
      const failure = error as { code: number; stderr: string };
      return { exitCode: failure.code, stderr: failure.stderr };
    }
  }

  protected errorKind(error: unknown): FilesApiErrorKind | undefined {
    if (error instanceof NotFound) return 'not-found';
    if (error instanceof InvalidArgument) return 'invalid-argument';
    return undefined;
  }
}

/**
 * A host-directory stand-in for envd's files API. Errors and `EntryInfo`
 * shapes follow what a live E2B sandbox returned (recorded in the FACT-19
 * progress file): directory reads are `InvalidArgument`, `getInfo`
 * reports a symlink's target type with the link's own size, a broken link
 * has no `type`, `write`/`rename`/`makeDir` create parents, and `remove`
 * deletes a link without touching its target.
 */
class FakeFiles implements FilesApi {
  calls: string[] = [];

  /** Sandbox paths live under `root` on the host; `''` makes them host paths. */
  constructor(private readonly root = '') {}

  private host(path: string) {
    return this.root + path;
  }

  private guest(hostPath: string) {
    return hostPath.slice(this.root.length) || '/';
  }

  async read(path: string): Promise<Uint8Array> {
    this.calls.push(`read ${path}`);
    try {
      return new Uint8Array(await readFile(this.host(path)));
    } catch (error) {
      if (code(error) === 'EISDIR') throw new InvalidArgument(`path '${path}' is a directory`);
      if (code(error) === 'ENOENT') throw new NotFound(`path '${path}' does not exist`);
      if (code(error) === 'ENOTDIR') throw new ServerError(`500: error checking if path exists '${path}'`);
      throw error;
    }
  }

  async write(path: string, data: string | ArrayBuffer): Promise<unknown> {
    this.calls.push(`write ${path}`);
    const target = this.host(path);
    if ((await stat(target).catch(() => undefined))?.isDirectory()) throw new InvalidArgument('path is a directory');
    try {
      await mkdir(dirname(target), { recursive: true });
    } catch {
      throw new ServerError('500: error ensuring directories: path is a file');
    }
    await writeFile(target, typeof data === 'string' ? data : Buffer.from(data));
    return { name: path, path };
  }

  async list(path: string, opts?: { depth?: number }): Promise<FilesApiEntry[]> {
    this.calls.push(`list ${path}`);
    const depth = opts?.depth ?? 1;
    if (depth < 1) throw new InvalidArgument('depth should be at least one');
    const info = await this.getInfoQuiet(path);
    if (!info) throw new NotFound(`[not_found] path not found: lstat ${path}`);
    if (info.type !== 'dir') throw new InvalidArgument('[invalid_argument] path is not a directory');
    const out: FilesApiEntry[] = [];
    let level = [path];
    for (let d = 0; d < depth && level.length; d++) {
      const next: string[] = [];
      for (const dir of level) {
        for (const name of (await readdir(this.host(dir))).sort()) {
          const child = `${dir === '/' ? '' : dir}/${name}`;
          const entry = await this.entry(child);
          out.push(entry);
          if (entry.type === 'dir' && entry.symlinkTarget === undefined) next.push(child);
        }
      }
      level = next;
    }
    return out;
  }

  async makeDir(path: string): Promise<boolean> {
    this.calls.push(`makeDir ${path}`);
    const existing = await stat(this.host(path)).catch(() => undefined);
    if (existing?.isDirectory()) return false;
    if (existing) throw new InvalidArgument('[invalid_argument] path already exists but it is not a directory');
    try {
      await mkdir(this.host(path), { recursive: true });
    } catch {
      throw new ServerError('13: [internal] error getting file info: not a directory');
    }
    return true;
  }

  async rename(oldPath: string, newPath: string): Promise<unknown> {
    this.calls.push(`rename ${oldPath} ${newPath}`);
    if (!(await lstat(this.host(oldPath)).catch(() => undefined))) {
      throw new NotFound(`[not_found] source file not found: rename ${oldPath}`);
    }
    await mkdir(dirname(this.host(newPath)), { recursive: true });
    await rename(this.host(oldPath), this.host(newPath));
    return this.entry(newPath);
  }

  async remove(path: string): Promise<void> {
    this.calls.push(`remove ${path}`);
    await rm(this.host(path), { recursive: true, force: true });
  }

  async getInfo(path: string): Promise<FilesApiEntry> {
    this.calls.push(`getInfo ${path}`);
    const info = await this.getInfoQuiet(path);
    if (!info) throw new NotFound(`[not_found] file not found: lstat ${path}`);
    return info;
  }

  private async getInfoQuiet(path: string): Promise<FilesApiEntry | undefined> {
    if (!(await lstat(this.host(path)).catch(() => undefined))) return undefined;
    return this.entry(path);
  }

  private async entry(path: string): Promise<FilesApiEntry> {
    const host = this.host(path);
    const own = await lstat(host);
    const base = {
      name: path.split('/').pop()!,
      path,
      size: own.size,
      mode: own.mode & 0o777,
      permissions: '',
      owner: 'user',
      group: 'user',
      modifiedTime: own.mtime,
    };
    if (!own.isSymbolicLink()) return { ...base, type: own.isDirectory() ? 'dir' : 'file' };
    const targetHost = resolve(dirname(host), await readlink(host));
    const target = await stat(host).catch(() => undefined);
    return {
      ...base,
      symlinkTarget: this.guest(targetHost),
      ...(target && { type: target.isDirectory() ? 'dir' : 'file' }),
    };
  }
}
describe('FilesApiFilesystem', () => {
  let root: string;
  let files: FakeFiles;
  let fs: TestFilesystem;
  let W: string;

  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'files-api-fs-')));
    W = join(root, 'w');
    files = new FakeFiles();
    fs = new TestFilesystem(files);
    await mkdir(join(root, 'w/src/nested'), { recursive: true });
    await writeFile(join(root, 'w/a.txt'), 'hello');
    await writeFile(join(root, 'w/src/b.ts'), 'export {}');
    await writeFile(join(root, 'w/src/nested/c.ts'), 'c');
    await writeFile(join(root, 'w/src/nested/d.md'), 'd');
    await symlink('src', join(root, 'w/dirlink'));
    await symlink('a.txt', join(root, 'w/filelink'));
    await symlink('missing', join(root, 'w/broken'));
    await mkdir(join(root, 'w/empty'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe('readFile', () => {
    it('returns a Buffer, or a string with an encoding', async () => {
      const buffer = await fs.readFile(`${W}/a.txt`);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.toString()).toBe('hello');
      expect(await fs.readFile(`${W}/a.txt`, { encoding: 'utf-8' })).toBe('hello');
    });

    it('maps a missing file or broken link to FileNotFoundError and a directory to IsDirectoryError', async () => {
      await expect(fs.readFile(`${W}/nope`)).rejects.toBeInstanceOf(FileNotFoundError);
      await expect(fs.readFile(`${W}/broken`)).rejects.toBeInstanceOf(FileNotFoundError);
      await expect(fs.readFile(`${W}/src`)).rejects.toBeInstanceOf(IsDirectoryError);
    });
  });

  describe('writeFile', () => {
    it('writes strings and bytes, creating parents by default', async () => {
      await fs.writeFile(`${W}/new/deep/x.txt`, 'x');
      await fs.writeFile(`${W}/bytes.bin`, new Uint8Array([1, 2, 3]));
      expect(await readFile(join(root, 'w/new/deep/x.txt'), 'utf-8')).toBe('x');
      expect([...(await readFile(join(root, 'w/bytes.bin')))]).toEqual([1, 2, 3]);
    });

    it('writes only the view of a Buffer that shares a larger pool', async () => {
      const pooled = Buffer.from('xxhelloyy').subarray(2, 7);
      await fs.writeFile(`${W}/view.txt`, pooled);
      expect(await readFile(join(root, 'w/view.txt'), 'utf-8')).toBe('hello');
    });

    it('with recursive: false, rejects a missing parent instead of creating it', async () => {
      await expect(fs.writeFile(`${W}/missing/x.txt`, 'x', { recursive: false })).rejects.toBeInstanceOf(
        DirectoryNotFoundError,
      );
      await expect(fs.writeFile(`${W}/a.txt/x.txt`, 'x', { recursive: false })).rejects.toBeInstanceOf(
        NotDirectoryError,
      );
      expect(files.calls.some(c => c.startsWith('write'))).toBe(false);
      await fs.writeFile(`${W}/src/ok.ts`, 'ok', { recursive: false });
      expect(await readFile(join(root, 'w/src/ok.ts'), 'utf-8')).toBe('ok');
    });

    it('with overwrite: false, rejects an existing file and writes a new one', async () => {
      await expect(fs.writeFile(`${W}/a.txt`, 'x', { overwrite: false })).rejects.toBeInstanceOf(FileExistsError);
      expect(await readFile(join(root, 'w/a.txt'), 'utf-8')).toBe('hello');
      await fs.writeFile(`${W}/fresh.txt`, 'x', { overwrite: false });
      expect(await readFile(join(root, 'w/fresh.txt'), 'utf-8')).toBe('x');
    });

    it('maps writing onto a directory to IsDirectoryError', async () => {
      await expect(fs.writeFile(`${W}/src`, 'x')).rejects.toBeInstanceOf(IsDirectoryError);
    });
  });

  describe('appendFile', () => {
    it('appends to an existing file and creates a missing one', async () => {
      await fs.appendFile(`${W}/a.txt`, ' world');
      await fs.appendFile(`${W}/log.txt`, Buffer.from('first'));
      expect(await readFile(join(root, 'w/a.txt'), 'utf-8')).toBe('hello world');
      expect(await readFile(join(root, 'w/log.txt'), 'utf-8')).toBe('first');
    });

    it('rejects a directory', async () => {
      await expect(fs.appendFile(`${W}/src`, 'x')).rejects.toBeInstanceOf(IsDirectoryError);
    });
  });

  describe('deleteFile', () => {
    it('deletes a file, and only the link for a symlink to a directory', async () => {
      await fs.deleteFile(`${W}/a.txt`);
      await fs.deleteFile(`${W}/dirlink`);
      await fs.deleteFile(`${W}/broken`);
      expect(await lstat(join(root, 'w/a.txt')).catch(() => null)).toBeNull();
      expect(await lstat(join(root, 'w/dirlink')).catch(() => null)).toBeNull();
      expect(await lstat(join(root, 'w/broken')).catch(() => null)).toBeNull();
      expect((await stat(join(root, 'w/src'))).isDirectory()).toBe(true);
    });

    it('rejects a directory and a missing file unless force is set', async () => {
      await expect(fs.deleteFile(`${W}/src`)).rejects.toBeInstanceOf(IsDirectoryError);
      await expect(fs.deleteFile(`${W}/nope`)).rejects.toBeInstanceOf(FileNotFoundError);
      await fs.deleteFile(`${W}/nope`, { force: true });
      expect(files.calls.some(c => c.startsWith('remove'))).toBe(false);
    });
  });

  describe('copyFile', () => {
    it('copies a file, refusing to overwrite when asked', async () => {
      await fs.copyFile(`${W}/a.txt`, `${W}/copy/a.txt`);
      expect(await readFile(join(root, 'w/copy/a.txt'), 'utf-8')).toBe('hello');
      await expect(fs.copyFile(`${W}/src/b.ts`, `${W}/a.txt`, { overwrite: false })).rejects.toBeInstanceOf(
        FileExistsError,
      );
      expect(await readFile(join(root, 'w/a.txt'), 'utf-8')).toBe('hello');
    });

    it('copies a directory tree only with recursive', async () => {
      await expect(fs.copyFile(`${W}/src`, `${W}/out`)).rejects.toBeInstanceOf(IsDirectoryError);
      await fs.copyFile(`${W}/src`, `${W}/out`, { recursive: true });
      expect(await readFile(join(root, 'w/out/b.ts'), 'utf-8')).toBe('export {}');
      expect(await readFile(join(root, 'w/out/nested/c.ts'), 'utf-8')).toBe('c');
    });

    it('rejects a missing source', async () => {
      await expect(fs.copyFile(`${W}/nope`, `${W}/x`)).rejects.toBeInstanceOf(FileNotFoundError);
      await expect(fs.copyFile(`${W}/broken`, `${W}/x`)).rejects.toBeInstanceOf(FileNotFoundError);
    });
  });

  describe('moveFile', () => {
    it('renames, creating the destination parent', async () => {
      await fs.moveFile(`${W}/a.txt`, `${W}/moved/deep/a.txt`);
      expect(await readFile(join(root, 'w/moved/deep/a.txt'), 'utf-8')).toBe('hello');
      expect(await lstat(join(root, 'w/a.txt')).catch(() => null)).toBeNull();
    });

    it('rejects a missing source and an existing destination with overwrite: false', async () => {
      await expect(fs.moveFile(`${W}/nope`, `${W}/x`)).rejects.toBeInstanceOf(FileNotFoundError);
      await expect(fs.moveFile(`${W}/src/b.ts`, `${W}/a.txt`, { overwrite: false })).rejects.toBeInstanceOf(
        FileExistsError,
      );
      expect(await readFile(join(root, 'w/a.txt'), 'utf-8')).toBe('hello');
    });
  });

  describe('mkdir', () => {
    it('creates nested directories by default and is a no-op on an existing one', async () => {
      await fs.mkdir(`${W}/m1/m2`);
      await fs.mkdir(`${W}/src`);
      expect((await stat(join(root, 'w/m1/m2'))).isDirectory()).toBe(true);
    });

    it('with recursive: false, requires the parent', async () => {
      await expect(fs.mkdir(`${W}/x/y`, { recursive: false })).rejects.toBeInstanceOf(DirectoryNotFoundError);
      await fs.mkdir(`${W}/x`, { recursive: false });
      expect((await stat(join(root, 'w/x'))).isDirectory()).toBe(true);
    });

    it('maps a file in the way to FileExistsError', async () => {
      await expect(fs.mkdir(`${W}/a.txt`)).rejects.toBeInstanceOf(FileExistsError);
    });
  });

  describe('rmdir', () => {
    it('removes an empty directory, and a non-empty one only with recursive', async () => {
      await fs.rmdir(`${W}/empty`);
      await expect(fs.rmdir(`${W}/src`)).rejects.toBeInstanceOf(DirectoryNotEmptyError);
      await fs.rmdir(`${W}/src`, { recursive: true });
      expect(await lstat(join(root, 'w/empty')).catch(() => null)).toBeNull();
      expect(await lstat(join(root, 'w/src')).catch(() => null)).toBeNull();
    });

    it('rejects a file, a symlink to a directory without recursive, and a missing path unless force', async () => {
      await expect(fs.rmdir(`${W}/a.txt`)).rejects.toBeInstanceOf(NotDirectoryError);
      await expect(fs.rmdir(`${W}/dirlink`)).rejects.toBeInstanceOf(NotDirectoryError);
      await expect(fs.rmdir(`${W}/nope`)).rejects.toBeInstanceOf(DirectoryNotFoundError);
      await fs.rmdir(`${W}/nope`, { force: true });
    });

    it('removes only the link when recursively removing a symlink to a directory', async () => {
      await fs.rmdir(`${W}/dirlink`, { recursive: true });
      expect(await lstat(join(root, 'w/dirlink')).catch(() => null)).toBeNull();
      expect(await readFile(join(root, 'w/src/b.ts'), 'utf-8')).toBe('export {}');
    });
  });

  describe('readdir', () => {
    it('lists names relative to the directory, resolving links and dropping broken ones', async () => {
      const entries = await fs.readdir(W);
      expect(entries.map(e => [e.name, e.type])).toEqual([
        ['a.txt', 'file'],
        ['dirlink', 'directory'],
        ['empty', 'directory'],
        ['filelink', 'file'],
        ['src', 'directory'],
      ]);
      expect(entries.find(e => e.name === 'a.txt')).toMatchObject({ size: 5 });
      expect(entries.find(e => e.name === 'dirlink')).toMatchObject({ isSymlink: true, symlinkTarget: `${W}/src` });
      expect(files.calls).toEqual([`list ${W}`]);
    });

    it('lists recursively with a/b-style names, honoring maxDepth and filtering only files by extension', async () => {
      const all = await fs.readdir(`${W}/src`, { recursive: true });
      expect(all.map(e => e.name).sort()).toEqual(['b.ts', 'nested', 'nested/c.ts', 'nested/d.md']);
      const shallow = await fs.readdir(`${W}/src`, { recursive: true, maxDepth: 0 });
      expect(shallow.map(e => e.name).sort()).toEqual(['b.ts', 'nested']);
      const ts = await fs.readdir(`${W}/src`, { recursive: true, extension: '.ts' });
      expect(ts.map(e => e.name).sort()).toEqual(['b.ts', 'nested', 'nested/c.ts']);
      const md = await fs.readdir(`${W}/src`, { recursive: true, extension: ['md'] });
      expect(md.map(e => e.name).sort()).toEqual(['nested', 'nested/d.md']);
    });

    it('lists through a symlinked directory', async () => {
      expect((await fs.readdir(`${W}/dirlink`)).map(e => e.name)).toEqual(['b.ts', 'nested']);
    });

    it('maps a missing path to DirectoryNotFoundError and a file to NotDirectoryError', async () => {
      await expect(fs.readdir(`${W}/nope`)).rejects.toBeInstanceOf(DirectoryNotFoundError);
      await expect(fs.readdir(`${W}/a.txt`)).rejects.toBeInstanceOf(NotDirectoryError);
    });
  });

  describe('exists', () => {
    it('is true for files, directories and live links, false for missing paths and broken links', async () => {
      expect(await fs.exists(`${W}/a.txt`)).toBe(true);
      expect(await fs.exists(`${W}/src`)).toBe(true);
      expect(await fs.exists(`${W}/filelink`)).toBe(true);
      expect(await fs.exists(`${W}/nope`)).toBe(false);
      expect(await fs.exists(`${W}/broken`)).toBe(false);
    });
  });

  describe('stat', () => {
    it('reports a file and a directory with absolute paths', async () => {
      const file = await fs.stat(`${W}/a.txt`);
      expect(file).toMatchObject({ name: 'a.txt', path: `${W}/a.txt`, type: 'file', size: 5 });
      expect(file.modifiedAt).toBeInstanceOf(Date);
      expect(file.createdAt).toEqual(file.modifiedAt);
      expect(await fs.stat(`${W}/src`)).toMatchObject({ name: 'src', type: 'directory' });
    });

    it('reports a directory size of 0', async () => {
      expect((await fs.stat(`${W}/src`)).size).toBe(0);
      expect((await fs.stat(`${W}/dirlink`)).size).toBe(0);
    });

    it("follows symlinks to the target's type and size", async () => {
      expect(await fs.stat(`${W}/filelink`)).toMatchObject({
        name: 'filelink',
        path: `${W}/filelink`,
        type: 'file',
        size: 5,
      });
      expect(await fs.stat(`${W}/dirlink`)).toMatchObject({ type: 'directory' });
    });

    it('maps a missing path and a broken link to FileNotFoundError', async () => {
      await expect(fs.stat(`${W}/nope`)).rejects.toBeInstanceOf(FileNotFoundError);
      await expect(fs.stat(`${W}/broken`)).rejects.toBeInstanceOf(FileNotFoundError);
    });

    it('falls back to the epoch when envd omits modifiedTime', async () => {
      const original = files.getInfo.bind(files);
      files.getInfo = async path => ({ ...(await original(path)), modifiedTime: undefined });
      expect((await fs.stat(`${W}/a.txt`)).modifiedAt).toEqual(new Date(0));
    });
  });

  describe('operations that run in the sandbox shell', () => {
    it('copies a file and a tree with one command and no file reads or writes', async () => {
      await fs.copyFile(`${W}/a.txt`, `${W}/copy/a.txt`);
      await fs.copyFile(`${W}/src`, `${W}/out`, { recursive: true });
      expect(fs.commands).toEqual(['copyFile', 'copyFile']);
      expect(files.calls).toEqual([]);
    });

    it('keeps symlinks inside a recursively copied tree as links', async () => {
      await symlink('b.ts', join(root, 'w/src/link.ts'));
      await fs.copyFile(`${W}/src`, `${W}/out`, { recursive: true });
      expect(await readlink(join(root, 'w/out/link.ts'))).toBe('b.ts');
    });

    it('refuses a file copied onto a directory', async () => {
      await expect(fs.copyFile(`${W}/a.txt`, `${W}/src`)).rejects.toBeInstanceOf(IsDirectoryError);
    });

    it('appends by sending only the new bytes, and leaves no temp file', async () => {
      await fs.appendFile(`${W}/a.txt`, ' world');
      expect(files.calls).toEqual([expect.stringMatching(/^write .*\/\.a\.txt\.mastra-tmp-/)]);
      expect(fs.commands).toEqual(['appendFile']);
      expect((await readdir(W)).filter(name => name.includes('mastra-tmp'))).toEqual([]);
    });

    it('lets exactly one of several racing no-overwrite writes win', async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 6 }, (_, i) => fs.writeFile(`${W}/race.txt`, `w${i}`, { overwrite: false })),
      );
      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
      for (const r of results.filter(r => r.status === 'rejected')) {
        expect((r as PromiseRejectedResult).reason).toBeInstanceOf(FileExistsError);
      }
      expect((await readdir(W)).filter(name => name.includes('mastra-tmp'))).toEqual([]);
    });

    it('moves without clobbering atomically, and with rename otherwise', async () => {
      await expect(fs.moveFile(`${W}/a.txt`, `${W}/src/b.ts`, { overwrite: false })).rejects.toBeInstanceOf(
        FileExistsError,
      );
      await fs.moveFile(`${W}/a.txt`, `${W}/fresh.txt`, { overwrite: false });
      await fs.moveFile(`${W}/fresh.txt`, `${W}/again.txt`);
      expect(fs.commands).toEqual(['moveFile', 'moveFile']);
      expect(files.calls).toEqual([`rename ${W}/fresh.txt ${W}/again.txt`]);
    });

    it('surfaces an unknown command failure with its exit code and stderr', async () => {
      await rm(join(root, 'w/src/b.ts'));
      await mkdir(join(root, 'w/src/b.ts'));
      await expect(fs.copyFile(`${W}/src`, `${W}/a.txt`, { recursive: true })).rejects.toThrow(
        /copyFile .* failed \(exit 1\)/,
      );
    });
  });

  it('passes errors it does not recognise through unchanged', async () => {
    const boom = new ServerError('13: [internal] error getting file info: not a directory');
    files.getInfo = async () => {
      throw boom;
    };
    await expect(fs.stat(`${W}/a.txt`)).rejects.toBe(boom);
    await expect(fs.exists(`${W}/a.txt`)).rejects.toBe(boom);
  });
});

const suiteRoots: string[] = [];
afterAll(async () => {
  await Promise.all(suiteRoots.map(dir => rm(dir, { recursive: true, force: true })));
});

createFilesystemTestSuite({
  suiteName: 'FilesApiFilesystem Conformance (host-backed files fake)',
  createFilesystem: async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'files-api-fs-suite-')));
    suiteRoots.push(dir);
    return new TestFilesystem(new FakeFiles(dir), dir);
  },
  testDomains: { mountConfig: false },
  capabilities: {
    supportsAppend: true,
    supportsBinaryFiles: true,
    supportsForceDelete: true,
    supportsOverwrite: true,
    supportsEmptyDirectories: true,
    deleteThrowsOnMissing: true,
    supportsConcurrency: true,
    supportsPermissions: false,
    supportsMounting: false,
  },
});
