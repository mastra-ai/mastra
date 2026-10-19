import { Buffer } from 'node:buffer';
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { createFilesystemTestSuite } from '@internal/workspace-test-utils';
import {
  DirectoryNotEmptyError,
  DirectoryNotFoundError,
  FileExistsError,
  FileNotFoundError,
  IsDirectoryError,
  NotDirectoryError,
} from '@mastra/core/workspace';
import type { EntryInfo, Sandbox } from 'e2b';
import {
  FileNotFoundError as E2BFileNotFoundError,
  InvalidArgumentError,
  SandboxError,
  SandboxNotFoundError,
} from 'e2b';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { E2BSandboxFilesystem } from './filesystem';
import { E2BSandbox } from './index';

/** An E2BSandbox that already holds a live SDK handle whose `files` is the fake. */
function runningSandbox(files: FakeFiles, id?: string): E2BSandbox {
  const sandbox = new E2BSandbox({ id });
  (sandbox as unknown as { _sandbox: Sandbox })._sandbox = { files } as unknown as Sandbox;
  sandbox.status = 'running';
  return sandbox;
}

const code = (error: unknown) => (error as NodeJS.ErrnoException).code;

/**
 * A host-directory stand-in for envd's files API. Errors and `EntryInfo`
 * shapes follow what a live E2B sandbox returned (recorded in the FACT-19
 * progress file): directory reads are `InvalidArgumentError`, `getInfo`
 * reports a symlink's target type with the link's own size, a broken link
 * has no `type`, `write`/`rename`/`makeDir` create parents, and `remove`
 * deletes a link without touching its target.
 */
class FakeFiles {
  calls: string[] = [];
  constructor(private readonly root: string) {}

  private host(path: string) {
    return join(this.root, path);
  }

  private guest(hostPath: string) {
    return hostPath.slice(this.root.length) || '/';
  }

  async read(path: string): Promise<Uint8Array> {
    this.calls.push(`read ${path}`);
    try {
      return new Uint8Array(await readFile(this.host(path)));
    } catch (error) {
      if (code(error) === 'EISDIR') throw new InvalidArgumentError(`path '${path}' is a directory`);
      if (code(error) === 'ENOENT') throw new E2BFileNotFoundError(`path '${path}' does not exist`);
      if (code(error) === 'ENOTDIR') throw new SandboxError(`500: error checking if path exists '${path}'`);
      throw error;
    }
  }

  async write(path: string, data: string | ArrayBuffer): Promise<unknown> {
    this.calls.push(`write ${path}`);
    const target = this.host(path);
    if ((await stat(target).catch(() => undefined))?.isDirectory())
      throw new InvalidArgumentError('path is a directory');
    try {
      await mkdir(dirname(target), { recursive: true });
    } catch {
      throw new SandboxError('500: error ensuring directories: path is a file');
    }
    await writeFile(target, typeof data === 'string' ? data : Buffer.from(data));
    return { name: path, path };
  }

  async list(path: string, opts?: { depth?: number }): Promise<EntryInfo[]> {
    this.calls.push(`list ${path}`);
    const depth = opts?.depth ?? 1;
    if (depth < 1) throw new InvalidArgumentError('depth should be at least one');
    const info = await this.getInfoQuiet(path);
    if (!info) throw new E2BFileNotFoundError(`[not_found] path not found: lstat ${path}`);
    if (info.type !== 'dir') throw new InvalidArgumentError('[invalid_argument] path is not a directory');
    const out: EntryInfo[] = [];
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
    if (existing) throw new InvalidArgumentError('[invalid_argument] path already exists but it is not a directory');
    try {
      await mkdir(this.host(path), { recursive: true });
    } catch {
      throw new SandboxError('13: [internal] error getting file info: not a directory');
    }
    return true;
  }

  async rename(oldPath: string, newPath: string): Promise<unknown> {
    this.calls.push(`rename ${oldPath} ${newPath}`);
    if (!(await lstat(this.host(oldPath)).catch(() => undefined))) {
      throw new E2BFileNotFoundError(`[not_found] source file not found: rename ${oldPath}`);
    }
    await mkdir(dirname(this.host(newPath)), { recursive: true });
    await rename(this.host(oldPath), this.host(newPath));
    return this.entry(newPath);
  }

  async remove(path: string): Promise<void> {
    this.calls.push(`remove ${path}`);
    await rm(this.host(path), { recursive: true, force: true });
  }

  async getInfo(path: string): Promise<EntryInfo> {
    this.calls.push(`getInfo ${path}`);
    const info = await this.getInfoQuiet(path);
    if (!info) throw new E2BFileNotFoundError(`[not_found] file not found: lstat ${path}`);
    return info;
  }

  private async getInfoQuiet(path: string): Promise<EntryInfo | undefined> {
    if (!(await lstat(this.host(path)).catch(() => undefined))) return undefined;
    return this.entry(path);
  }

  private async entry(path: string): Promise<EntryInfo> {
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
    if (!own.isSymbolicLink()) return { ...base, type: (own.isDirectory() ? 'dir' : 'file') as EntryInfo['type'] };
    const targetHost = resolve(dirname(host), await readlink(host));
    const target = await stat(host).catch(() => undefined);
    return {
      ...base,
      symlinkTarget: this.guest(targetHost),
      ...(target && { type: (target.isDirectory() ? 'dir' : 'file') as EntryInfo['type'] }),
    } as EntryInfo;
  }
}

describe('E2BSandboxFilesystem', () => {
  let root: string;
  let files: FakeFiles;
  let fs: E2BSandboxFilesystem;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'e2b-sandbox-fs-'));
    files = new FakeFiles(root);
    fs = runningSandbox(files).filesystem;
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
      const buffer = await fs.readFile('/w/a.txt');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.toString()).toBe('hello');
      expect(await fs.readFile('/w/a.txt', { encoding: 'utf-8' })).toBe('hello');
    });

    it('maps a missing file or broken link to FileNotFoundError and a directory to IsDirectoryError', async () => {
      await expect(fs.readFile('/w/nope')).rejects.toBeInstanceOf(FileNotFoundError);
      await expect(fs.readFile('/w/broken')).rejects.toBeInstanceOf(FileNotFoundError);
      await expect(fs.readFile('/w/src')).rejects.toBeInstanceOf(IsDirectoryError);
    });
  });

  describe('writeFile', () => {
    it('writes strings and bytes, creating parents by default', async () => {
      await fs.writeFile('/w/new/deep/x.txt', 'x');
      await fs.writeFile('/w/bytes.bin', new Uint8Array([1, 2, 3]));
      expect(await readFile(join(root, 'w/new/deep/x.txt'), 'utf-8')).toBe('x');
      expect([...(await readFile(join(root, 'w/bytes.bin')))]).toEqual([1, 2, 3]);
    });

    it('writes only the view of a Buffer that shares a larger pool', async () => {
      const pooled = Buffer.from('xxhelloyy').subarray(2, 7);
      await fs.writeFile('/w/view.txt', pooled);
      expect(await readFile(join(root, 'w/view.txt'), 'utf-8')).toBe('hello');
    });

    it('with recursive: false, rejects a missing parent instead of creating it', async () => {
      await expect(fs.writeFile('/w/missing/x.txt', 'x', { recursive: false })).rejects.toBeInstanceOf(
        DirectoryNotFoundError,
      );
      await expect(fs.writeFile('/w/a.txt/x.txt', 'x', { recursive: false })).rejects.toBeInstanceOf(NotDirectoryError);
      expect(files.calls.some(c => c.startsWith('write'))).toBe(false);
      await fs.writeFile('/w/src/ok.ts', 'ok', { recursive: false });
      expect(await readFile(join(root, 'w/src/ok.ts'), 'utf-8')).toBe('ok');
    });

    it('with overwrite: false, rejects an existing file and writes a new one', async () => {
      await expect(fs.writeFile('/w/a.txt', 'x', { overwrite: false })).rejects.toBeInstanceOf(FileExistsError);
      expect(await readFile(join(root, 'w/a.txt'), 'utf-8')).toBe('hello');
      await fs.writeFile('/w/fresh.txt', 'x', { overwrite: false });
      expect(await readFile(join(root, 'w/fresh.txt'), 'utf-8')).toBe('x');
    });

    it('maps writing onto a directory to IsDirectoryError', async () => {
      await expect(fs.writeFile('/w/src', 'x')).rejects.toBeInstanceOf(IsDirectoryError);
    });
  });

  describe('appendFile', () => {
    it('appends to an existing file and creates a missing one', async () => {
      await fs.appendFile('/w/a.txt', ' world');
      await fs.appendFile('/w/log.txt', Buffer.from('first'));
      expect(await readFile(join(root, 'w/a.txt'), 'utf-8')).toBe('hello world');
      expect(await readFile(join(root, 'w/log.txt'), 'utf-8')).toBe('first');
    });

    it('rejects a directory', async () => {
      await expect(fs.appendFile('/w/src', 'x')).rejects.toBeInstanceOf(IsDirectoryError);
    });
  });

  describe('deleteFile', () => {
    it('deletes a file, and only the link for a symlink to a directory', async () => {
      await fs.deleteFile('/w/a.txt');
      await fs.deleteFile('/w/dirlink');
      await fs.deleteFile('/w/broken');
      expect(await lstat(join(root, 'w/a.txt')).catch(() => null)).toBeNull();
      expect(await lstat(join(root, 'w/dirlink')).catch(() => null)).toBeNull();
      expect(await lstat(join(root, 'w/broken')).catch(() => null)).toBeNull();
      expect((await stat(join(root, 'w/src'))).isDirectory()).toBe(true);
    });

    it('rejects a directory and a missing file unless force is set', async () => {
      await expect(fs.deleteFile('/w/src')).rejects.toBeInstanceOf(IsDirectoryError);
      await expect(fs.deleteFile('/w/nope')).rejects.toBeInstanceOf(FileNotFoundError);
      await fs.deleteFile('/w/nope', { force: true });
      expect(files.calls.some(c => c.startsWith('remove'))).toBe(false);
    });
  });

  describe('copyFile', () => {
    it('copies a file, refusing to overwrite when asked', async () => {
      await fs.copyFile('/w/a.txt', '/w/copy/a.txt');
      expect(await readFile(join(root, 'w/copy/a.txt'), 'utf-8')).toBe('hello');
      await expect(fs.copyFile('/w/src/b.ts', '/w/a.txt', { overwrite: false })).rejects.toBeInstanceOf(
        FileExistsError,
      );
      expect(await readFile(join(root, 'w/a.txt'), 'utf-8')).toBe('hello');
    });

    it('copies a directory tree only with recursive', async () => {
      await expect(fs.copyFile('/w/src', '/w/out')).rejects.toBeInstanceOf(IsDirectoryError);
      await fs.copyFile('/w/src', '/w/out', { recursive: true });
      expect(await readFile(join(root, 'w/out/b.ts'), 'utf-8')).toBe('export {}');
      expect(await readFile(join(root, 'w/out/nested/c.ts'), 'utf-8')).toBe('c');
    });

    it('rejects a missing source', async () => {
      await expect(fs.copyFile('/w/nope', '/w/x')).rejects.toBeInstanceOf(FileNotFoundError);
      await expect(fs.copyFile('/w/broken', '/w/x')).rejects.toBeInstanceOf(FileNotFoundError);
    });
  });

  describe('moveFile', () => {
    it('renames, creating the destination parent', async () => {
      await fs.moveFile('/w/a.txt', '/w/moved/deep/a.txt');
      expect(await readFile(join(root, 'w/moved/deep/a.txt'), 'utf-8')).toBe('hello');
      expect(await lstat(join(root, 'w/a.txt')).catch(() => null)).toBeNull();
    });

    it('rejects a missing source and an existing destination with overwrite: false', async () => {
      await expect(fs.moveFile('/w/nope', '/w/x')).rejects.toBeInstanceOf(FileNotFoundError);
      await expect(fs.moveFile('/w/src/b.ts', '/w/a.txt', { overwrite: false })).rejects.toBeInstanceOf(
        FileExistsError,
      );
      expect(await readFile(join(root, 'w/a.txt'), 'utf-8')).toBe('hello');
    });
  });

  describe('mkdir', () => {
    it('creates nested directories by default and is a no-op on an existing one', async () => {
      await fs.mkdir('/w/m1/m2');
      await fs.mkdir('/w/src');
      expect((await stat(join(root, 'w/m1/m2'))).isDirectory()).toBe(true);
    });

    it('with recursive: false, requires the parent', async () => {
      await expect(fs.mkdir('/w/x/y', { recursive: false })).rejects.toBeInstanceOf(DirectoryNotFoundError);
      await fs.mkdir('/w/x', { recursive: false });
      expect((await stat(join(root, 'w/x'))).isDirectory()).toBe(true);
    });

    it('maps a file in the way to FileExistsError', async () => {
      await expect(fs.mkdir('/w/a.txt')).rejects.toBeInstanceOf(FileExistsError);
    });
  });

  describe('rmdir', () => {
    it('removes an empty directory, and a non-empty one only with recursive', async () => {
      await fs.rmdir('/w/empty');
      await expect(fs.rmdir('/w/src')).rejects.toBeInstanceOf(DirectoryNotEmptyError);
      await fs.rmdir('/w/src', { recursive: true });
      expect(await lstat(join(root, 'w/empty')).catch(() => null)).toBeNull();
      expect(await lstat(join(root, 'w/src')).catch(() => null)).toBeNull();
    });

    it('rejects a file, a symlink to a directory without recursive, and a missing path unless force', async () => {
      await expect(fs.rmdir('/w/a.txt')).rejects.toBeInstanceOf(NotDirectoryError);
      await expect(fs.rmdir('/w/dirlink')).rejects.toBeInstanceOf(NotDirectoryError);
      await expect(fs.rmdir('/w/nope')).rejects.toBeInstanceOf(DirectoryNotFoundError);
      await fs.rmdir('/w/nope', { force: true });
    });

    it('removes only the link when recursively removing a symlink to a directory', async () => {
      await fs.rmdir('/w/dirlink', { recursive: true });
      expect(await lstat(join(root, 'w/dirlink')).catch(() => null)).toBeNull();
      expect(await readFile(join(root, 'w/src/b.ts'), 'utf-8')).toBe('export {}');
    });
  });

  describe('readdir', () => {
    it('lists names relative to the directory, resolving links and dropping broken ones', async () => {
      const entries = await fs.readdir('/w');
      expect(entries.map(e => [e.name, e.type])).toEqual([
        ['a.txt', 'file'],
        ['dirlink', 'directory'],
        ['empty', 'directory'],
        ['filelink', 'file'],
        ['src', 'directory'],
      ]);
      expect(entries.find(e => e.name === 'a.txt')).toMatchObject({ size: 5 });
      expect(entries.find(e => e.name === 'dirlink')).toMatchObject({ isSymlink: true, symlinkTarget: '/w/src' });
      expect(files.calls).toEqual(['list /w']);
    });

    it('lists recursively with a/b-style names, honoring maxDepth and filtering only files by extension', async () => {
      const all = await fs.readdir('/w/src', { recursive: true });
      expect(all.map(e => e.name).sort()).toEqual(['b.ts', 'nested', 'nested/c.ts', 'nested/d.md']);
      const shallow = await fs.readdir('/w/src', { recursive: true, maxDepth: 0 });
      expect(shallow.map(e => e.name).sort()).toEqual(['b.ts', 'nested']);
      const ts = await fs.readdir('/w/src', { recursive: true, extension: '.ts' });
      expect(ts.map(e => e.name).sort()).toEqual(['b.ts', 'nested', 'nested/c.ts']);
      const md = await fs.readdir('/w/src', { recursive: true, extension: ['md'] });
      expect(md.map(e => e.name).sort()).toEqual(['nested', 'nested/d.md']);
    });

    it('lists through a symlinked directory', async () => {
      expect((await fs.readdir('/w/dirlink')).map(e => e.name)).toEqual(['b.ts', 'nested']);
    });

    it('maps a missing path to DirectoryNotFoundError and a file to NotDirectoryError', async () => {
      await expect(fs.readdir('/w/nope')).rejects.toBeInstanceOf(DirectoryNotFoundError);
      await expect(fs.readdir('/w/a.txt')).rejects.toBeInstanceOf(NotDirectoryError);
    });
  });

  describe('exists', () => {
    it('is true for files, directories and live links, false for missing paths and broken links', async () => {
      expect(await fs.exists('/w/a.txt')).toBe(true);
      expect(await fs.exists('/w/src')).toBe(true);
      expect(await fs.exists('/w/filelink')).toBe(true);
      expect(await fs.exists('/w/nope')).toBe(false);
      expect(await fs.exists('/w/broken')).toBe(false);
    });
  });

  describe('stat', () => {
    it('reports a file and a directory with absolute paths', async () => {
      const file = await fs.stat('/w/a.txt');
      expect(file).toMatchObject({ name: 'a.txt', path: '/w/a.txt', type: 'file', size: 5 });
      expect(file.modifiedAt).toBeInstanceOf(Date);
      expect(file.createdAt).toEqual(file.modifiedAt);
      expect(await fs.stat('/w/src')).toMatchObject({ name: 'src', type: 'directory' });
    });

    it('reports a directory size of 0', async () => {
      expect((await fs.stat('/w/src')).size).toBe(0);
      expect((await fs.stat('/w/dirlink')).size).toBe(0);
    });

    it("follows symlinks to the target's type and size", async () => {
      expect(await fs.stat('/w/filelink')).toMatchObject({
        name: 'filelink',
        path: '/w/filelink',
        type: 'file',
        size: 5,
      });
      expect(await fs.stat('/w/dirlink')).toMatchObject({ type: 'directory' });
    });

    it('maps a missing path and a broken link to FileNotFoundError', async () => {
      await expect(fs.stat('/w/nope')).rejects.toBeInstanceOf(FileNotFoundError);
      await expect(fs.stat('/w/broken')).rejects.toBeInstanceOf(FileNotFoundError);
    });

    it('falls back to the epoch when envd omits modifiedTime', async () => {
      const original = files.getInfo.bind(files);
      files.getInfo = async path => ({ ...(await original(path)), modifiedTime: undefined });
      expect((await fs.stat('/w/a.txt')).modifiedAt).toEqual(new Date(0));
    });
  });

  it('passes errors it does not recognise through unchanged', async () => {
    const boom = new SandboxError('13: [internal] error getting file info: not a directory');
    files.getInfo = async () => {
      throw boom;
    };
    await expect(fs.stat('/w/a.txt')).rejects.toBe(boom);
  });
});

describe('E2BSandbox.filesystem', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'e2b-sandbox-fs-'));
    await mkdir(join(root, 'w'));
    await writeFile(join(root, 'w/a.txt'), 'hello');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('is memoized and exported', async () => {
    const sandbox = runningSandbox(new FakeFiles(root));
    expect(sandbox.filesystem).toBe(sandbox.filesystem);
    expect(sandbox.filesystem).toBeInstanceOf(E2BSandboxFilesystem);
    expect((await import('../index')).E2BSandboxFilesystem).toBe(E2BSandboxFilesystem);
  });

  it('starts the sandbox before the first operation', async () => {
    const files = new FakeFiles(root);
    const sandbox = new E2BSandbox({ id: 'sbx' });
    const order: string[] = [];
    vi.spyOn(sandbox, 'ensureRunning').mockImplementation(async () => {
      order.push('ensureRunning');
      (sandbox as unknown as { _sandbox: Sandbox })._sandbox = { files } as unknown as Sandbox;
      sandbox.status = 'running';
    });
    const read = files.read.bind(files);
    files.read = async path => {
      order.push('read');
      return read(path);
    };
    expect(await sandbox.filesystem.readFile('/w/a.txt', { encoding: 'utf-8' })).toBe('hello');
    expect(order).toEqual(['ensureRunning', 'read']);
  });

  it('restarts a sandbox that died server-side and retries the operation once on the new handle', async () => {
    const dead = new FakeFiles(root);
    dead.read = async () => {
      throw new SandboxNotFoundError('Sandbox sbx_old not found');
    };
    const fresh = new FakeFiles(root);
    const sandbox = runningSandbox(dead);
    const ensureRunning = vi.spyOn(sandbox, 'ensureRunning').mockImplementation(async () => {
      const handle = sandbox as unknown as { _sandbox: Sandbox | null };
      if (!handle._sandbox) handle._sandbox = { files: fresh } as unknown as Sandbox;
      sandbox.status = 'running';
    });

    expect(await sandbox.filesystem.readFile('/w/a.txt', { encoding: 'utf-8' })).toBe('hello');
    expect(ensureRunning).toHaveBeenCalledTimes(2);
    expect(fresh.calls).toEqual(['read /w/a.txt']);
  });

  it('treats the 404 envd returns for a paused sandbox as a dead sandbox, not a missing file', async () => {
    const dead = new FakeFiles(root);
    dead.getInfo = async () => {
      throw new E2BFileNotFoundError('paused sandbox sbx_old not found');
    };
    const fresh = new FakeFiles(root);
    const sandbox = runningSandbox(dead);
    vi.spyOn(sandbox, 'ensureRunning').mockImplementation(async () => {
      const handle = sandbox as unknown as { _sandbox: Sandbox | null };
      if (!handle._sandbox) handle._sandbox = { files: fresh } as unknown as Sandbox;
      sandbox.status = 'running';
    });

    expect(await sandbox.filesystem.exists('/w/a.txt')).toBe(true);
    expect(fresh.calls).toEqual(['getInfo /w/a.txt']);
  });

  it('surfaces the error when the sandbox is dead again after the restart', async () => {
    const dead = () => {
      const files = new FakeFiles(root);
      files.remove = async () => {
        throw new SandboxNotFoundError('Sandbox sbx_old not found');
      };
      return files;
    };
    const sandbox = runningSandbox(dead());
    vi.spyOn(sandbox, 'ensureRunning').mockImplementation(async () => {
      const handle = sandbox as unknown as { _sandbox: Sandbox | null };
      if (!handle._sandbox) handle._sandbox = { files: dead() } as unknown as Sandbox;
      sandbox.status = 'running';
    });
    await expect(sandbox.filesystem.deleteFile('/w/a.txt')).rejects.toBeInstanceOf(SandboxNotFoundError);
  });

  it('does not retry errors that do not mean the sandbox is gone', async () => {
    const files = new FakeFiles(root);
    const boom = new SandboxError('500: connection reset');
    let removes = 0;
    files.remove = async () => {
      removes++;
      throw boom;
    };
    const sandbox = runningSandbox(files);
    const ensureRunning = vi.spyOn(sandbox, 'ensureRunning');
    await expect(sandbox.filesystem.deleteFile('/w/a.txt')).rejects.toBe(boom);
    expect(removes).toBe(1);
    expect(ensureRunning).toHaveBeenCalledTimes(1);
  });
});

const suiteRoots: string[] = [];
afterAll(async () => {
  await Promise.all(suiteRoots.map(dir => rm(dir, { recursive: true, force: true })));
});

createFilesystemTestSuite({
  suiteName: 'E2BSandboxFilesystem Conformance (host-backed files fake)',
  createFilesystem: async () => {
    const dir = await mkdtemp(join(tmpdir(), 'e2b-sandbox-fs-suite-'));
    suiteRoots.push(dir);
    return runningSandbox(new FakeFiles(dir)).filesystem;
  },
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
