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

const runSh = promisify(execFile);

/**
 * Point the sandbox's shell at the host directory backing the fake. Every
 * absolute path in a file command is a single-quoted literal, so rooting the
 * script is a plain prefix on each one.
 */
function hostShell(sandbox: E2BSandbox, root: string): E2BSandbox {
  sandbox.executeCommand = async (command, args = []) => {
    const rooted = args.map(arg => arg.replaceAll(`'/`, `'${root}/`));
    try {
      const { stdout, stderr } = await runSh(command, rooted);
      return { success: true, exitCode: 0, stdout, stderr, executionTimeMs: 0 };
    } catch (error) {
      const failure = error as { code: number; stdout: string; stderr: string };
      return {
        success: false,
        exitCode: failure.code,
        stdout: failure.stdout,
        stderr: failure.stderr,
        executionTimeMs: 0,
      };
    }
  };
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
    await mkdir(join(root, 'w/src'), { recursive: true });
    await writeFile(join(root, 'w/a.txt'), 'hello');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  // The operations themselves are covered once, against the shared class, in
  // `@internal/workspace` (files-api-filesystem.test.ts). These tests cover how
  // this provider reads E2B's errors and reaches the sandbox.

  it("reads E2B's file-level errors as typed errors", async () => {
    await expect(fs.readFile('/w/nope')).rejects.toBeInstanceOf(FileNotFoundError);
    await expect(fs.readFile('/w/src')).rejects.toBeInstanceOf(IsDirectoryError);
    await expect(fs.readdir('/w/a.txt')).rejects.toBeInstanceOf(NotDirectoryError);
    await expect(fs.mkdir('/w/a.txt')).rejects.toBeInstanceOf(FileExistsError);
    await expect(fs.rmdir('/w/nope')).rejects.toBeInstanceOf(DirectoryNotFoundError);
  });

  it('passes errors it does not recognise through unchanged', async () => {
    const boom = new SandboxError('13: [internal] error getting file info: not a directory');
    files.getInfo = async () => {
      throw boom;
    };
    await expect(fs.stat('/w/a.txt')).rejects.toBe(boom);
  });

  it('runs copies, appends and no-clobber moves as one executeCommand each, not through the files API', async () => {
    const sandbox = runningSandbox(files);
    const scripts: string[] = [];
    sandbox.executeCommand = vi.fn(async (_command: string, args?: string[]) => {
      scripts.push(args![1]!);
      return { success: true, exitCode: 0, stdout: '', stderr: '', executionTimeMs: 1 };
    });
    await sandbox.filesystem.copyFile('/w/src', '/w/out', { recursive: true });
    await sandbox.filesystem.moveFile('/w/a.txt', '/w/b.txt', { overwrite: false });
    expect(sandbox.executeCommand).toHaveBeenCalledWith('sh', ['-c', expect.any(String)]);
    expect(scripts[0]).toContain(`cp -R -P "$src"/. "$dest"/`);
    expect(scripts[1]).toContain(`mv -n "$src" "$dest"`);
    expect(files.calls).toEqual([]);
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

  it('retries only the call that hit the dead sandbox, never the calls that already succeeded', async () => {
    await symlink('a.txt', join(root, 'w/link.txt'));
    const infos: string[] = [];
    const handle = (label: string, dieOn?: string) => {
      const files = new FakeFiles(root);
      const getInfo = files.getInfo.bind(files);
      files.getInfo = async path => {
        infos.push(`${label} ${path}`);
        if (path === dieOn) throw new E2BFileNotFoundError('paused sandbox sbx_old not found');
        return getInfo(path);
      };
      return files;
    };
    // stat follows the link with a second getInfo; the sandbox dies in between.
    const sandbox = runningSandbox(handle('old', '/w/a.txt'));
    vi.spyOn(sandbox, 'ensureRunning').mockImplementation(async () => {
      const current = sandbox as unknown as { _sandbox: Sandbox | null };
      if (!current._sandbox) current._sandbox = { files: handle('new') } as unknown as Sandbox;
      sandbox.status = 'running';
    });

    expect(await sandbox.filesystem.stat('/w/link.txt')).toMatchObject({ type: 'file', size: 5 });
    expect(infos).toEqual(['old /w/link.txt', 'old /w/a.txt', 'new /w/a.txt']);
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
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'e2b-sandbox-fs-suite-')));
    suiteRoots.push(dir);
    return hostShell(runningSandbox(new FakeFiles(dir)), dir).filesystem;
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
