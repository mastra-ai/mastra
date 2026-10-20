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

import {
  DirectoryNotFoundError,
  FileExistsError,
  FileNotFoundError,
  IsDirectoryError,
  NotDirectoryError,
} from '@mastra/core/workspace';
import type { EntryInfo } from 'e2b';
import {
  AuthenticationError,
  FileNotFoundError as E2BFileNotFoundError,
  InvalidArgumentError,
  SandboxError,
  TimeoutError,
} from 'e2b';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { E2BFiles } from './e2b-exec.js';
import { PlatformSandboxFilesystem } from './sandbox-filesystem.js';
import { PlatformSandbox, SandboxDestroyedError } from './sandbox.js';

const code = (error: unknown) => (error as NodeJS.ErrnoException).code;

/**
 * A host-directory stand-in for envd's files API. Errors and `EntryInfo`
 * shapes follow what a live E2B sandbox returned (recorded in the FACT-19
 * progress file): directory reads are `InvalidArgumentError`, `getInfo`
 * reports a symlink's target type with the link's own size, a broken link
 * has no `type`, `write`/`rename`/`makeDir` create parents, and `remove`
 * deletes a link without touching its target.
 */
class FakeFiles implements E2BFiles {
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

describe('PlatformSandboxFilesystem', () => {
  let root: string;
  let files: FakeFiles;
  let scripts: string[];
  let fs: PlatformSandboxFilesystem;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'platform-sandbox-fs-'));
    files = new FakeFiles(root);
    scripts = [];
    fs = new PlatformSandboxFilesystem({
      id: 'sbx',
      withFiles: (_op, fn) => fn(files),
      runCommand: async script => {
        scripts.push(script);
        return { exitCode: 0, stderr: '' };
      },
    });
    await mkdir(join(root, 'w/src'), { recursive: true });
    await writeFile(join(root, 'w/a.txt'), 'hello');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  // The operations themselves are covered once, against the shared class, in
  // `@internal/workspace` (files-api-filesystem.test.ts). These tests cover how
  // this provider reads E2B's errors and hands commands to the sandbox.

  it("reads E2B's file-level errors as typed errors", async () => {
    await expect(fs.readFile('/w/nope')).rejects.toBeInstanceOf(FileNotFoundError);
    await expect(fs.readFile('/w/src')).rejects.toBeInstanceOf(IsDirectoryError);
    await expect(fs.readdir('/w/a.txt')).rejects.toBeInstanceOf(NotDirectoryError);
    await expect(fs.mkdir('/w/a.txt')).rejects.toBeInstanceOf(FileExistsError);
    await expect(fs.rmdir('/w/nope')).rejects.toBeInstanceOf(DirectoryNotFoundError);
  });

  it('does not read a dead-sandbox 404 as a missing file', async () => {
    const dead = new E2BFileNotFoundError('paused sandbox sbx_1 not found');
    files.getInfo = async () => {
      throw dead;
    };
    files.read = async () => {
      throw dead;
    };
    await expect(fs.exists('/w/a.txt')).rejects.toBe(dead);
    await expect(fs.readFile('/w/a.txt')).rejects.toBe(dead);
    await expect(fs.deleteFile('/w/a.txt', { force: true })).rejects.toBe(dead);
  });

  it('passes errors it does not recognise through unchanged', async () => {
    const boom = new SandboxError('13: [internal] error getting file info: not a directory');
    files.getInfo = async () => {
      throw boom;
    };
    await expect(fs.stat('/w/a.txt')).rejects.toBe(boom);
  });

  it('runs copies, appends and no-clobber moves as one sandbox command', async () => {
    await fs.copyFile('/w/src', '/w/out', { recursive: true });
    await fs.appendFile('/w/a.txt', '!');
    await fs.moveFile('/w/a.txt', '/w/b.txt', { overwrite: false });
    expect(scripts).toHaveLength(3);
    expect(scripts[0]).toContain(`cp -R -P "$src"/. "$dest"/`);
    expect(scripts[1]).toContain(`cat "$tmp" >> "$dest"`);
    expect(scripts[2]).toContain(`mv -n "$src" "$dest"`);
    expect(files.calls).toEqual([expect.stringMatching(/^write \/w\/\.a\.txt\.mastra-tmp-/)]);
  });
});

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });
}

function e2bLease(jwt = 'envd-token-1', provider = 'e2b') {
  return json({
    provider,
    sandboxId: 'sbx_1',
    providerResourceId: 'e2b_sbx_1',
    jwt,
    wsEndpoint: 'https://49983-e2b-sbx-1.e2b.app',
    subprotocol: 'e2b-access-token',
    expiresAt: '2030-01-01T00:00:00.000Z',
  });
}

const created = () => json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' });
const isLeaseCall = (call: unknown[]) => String(call[0]).endsWith('/exec-lease');

describe('PlatformSandbox.filesystem', () => {
  let root: string;

  beforeEach(async () => {
    vi.stubEnv('SANDBOX_PROVIDER', 'e2b');
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    root = await mkdtemp(join(tmpdir(), 'platform-sandbox-fs-'));
    await writeFile(join(root, 'a.txt'), 'hello');
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  function makeSandbox(
    fetchMock: ReturnType<typeof vi.fn>,
    filesFor: (jwt: string) => E2BFiles = () => new FakeFiles(root),
  ) {
    const leases: string[] = [];
    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock as unknown as typeof fetch,
      e2bExecRunner: () => {
        throw new Error('file operations must not exec');
      },
      e2bFilesFactory: lease => {
        leases.push(lease.jwt);
        return filesFor(lease.jwt);
      },
    });
    return { sandbox, leases };
  }

  it('is memoized and exported', async () => {
    const { sandbox } = makeSandbox(vi.fn());
    expect(sandbox.filesystem).toBe(sandbox.filesystem);
    const index = await import('./index.js');
    expect(sandbox.filesystem).toBeInstanceOf(index.PlatformSandboxFilesystem);
  });

  it('starts the sandbox, then reuses one lease and one files handle across sequential ops', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(created()).mockResolvedValueOnce(e2bLease());
    const { sandbox, leases } = makeSandbox(fetchMock);
    expect(await sandbox.filesystem.readFile('/a.txt', { encoding: 'utf-8' })).toBe('hello');
    await sandbox.filesystem.writeFile('/b.txt', 'b');
    expect(await sandbox.filesystem.exists('/b.txt')).toBe(true);
    await sandbox.filesystem.stat('/a.txt');
    expect(sandbox.status).toBe('running');
    expect(fetchMock.mock.calls.filter(isLeaseCall)).toHaveLength(1);
    expect(leases).toEqual(['envd-token-1']);
  });

  it('coalesces concurrent first ops into one lease mint', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(created()).mockResolvedValueOnce(e2bLease());
    const { sandbox } = makeSandbox(fetchMock);
    await sandbox._start();
    await Promise.all(Array.from({ length: 5 }, () => sandbox.filesystem.readFile('/a.txt')));
    expect(fetchMock.mock.calls.filter(isLeaseCall)).toHaveLength(1);
  });

  it('turns a 410 lease into SandboxDestroyedError and clears state like executeCommand', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(created())
      .mockResolvedValueOnce(json({ error: { message: 'Gone', type: 'gone' } }, { status: 410 }));
    const { sandbox } = makeSandbox(fetchMock);
    await sandbox._start();
    const error = await sandbox.filesystem.readFile('/a.txt').catch(e => e);
    expect(error).toBeInstanceOf(SandboxDestroyedError);
    expect(error).toMatchObject({ sandboxId: 'sbx_1', command: 'filesystem.readFile', attempts: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((sandbox as unknown as { _sandboxId: unknown })._sandboxId).toBeUndefined();
    expect((sandbox as unknown as { _lease: unknown })._lease).toBeNull();
    expect(sandbox.status).toBe('stopped');
  });

  it('retries exactly once with a fresh lease when envd rejects the token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(created())
      .mockResolvedValueOnce(e2bLease('stale'))
      .mockResolvedValueOnce(e2bLease('fresh'));
    const { sandbox, leases } = makeSandbox(fetchMock, jwt => {
      const files = new FakeFiles(root);
      if (jwt === 'stale') {
        files.read = async () => {
          throw new AuthenticationError('access token present in header but does not match');
        };
      }
      return files;
    });
    expect(await sandbox.filesystem.readFile('/a.txt', { encoding: 'utf-8' })).toBe('hello');
    expect(leases).toEqual(['stale', 'fresh']);
    expect(fetchMock.mock.calls.filter(isLeaseCall)).toHaveLength(2);
  });

  it('gives up after the second authentication rejection', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(created())
      .mockResolvedValueOnce(e2bLease('a'))
      .mockResolvedValueOnce(e2bLease('b'));
    const read = vi.fn(async () => {
      throw new AuthenticationError('unauthorized');
    });
    const { sandbox } = makeSandbox(fetchMock, () => Object.assign(new FakeFiles(root), { read }));
    await expect(sandbox.filesystem.readFile('/a.txt')).rejects.toBeInstanceOf(AuthenticationError);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['moveFile', (fs: PlatformSandboxFilesystem) => fs.moveFile('/a.txt', '/b.txt'), 'rename'],
    ['deleteFile', (fs: PlatformSandboxFilesystem) => fs.deleteFile('/a.txt'), 'remove'],
  ] as const)('does not replay %s after a connection error', async (_name, op, method) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(created()).mockResolvedValueOnce(e2bLease());
    const lost = new TypeError('fetch failed');
    const failing = vi.fn(async () => {
      throw lost;
    });
    const { sandbox } = makeSandbox(fetchMock, () => Object.assign(new FakeFiles(root), { [method]: failing }));
    await expect(op(sandbox.filesystem)).rejects.toBe(lost);
    expect(failing).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.filter(isLeaseCall)).toHaveLength(1);
  });

  it('retries only the call envd rejected, never the calls that already succeeded', async () => {
    await symlink('a.txt', join(root, 'link.txt'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(created())
      .mockResolvedValueOnce(e2bLease('stale'))
      .mockResolvedValueOnce(e2bLease('fresh'));
    const infos: string[] = [];
    const { sandbox, leases } = makeSandbox(fetchMock, jwt => {
      const files = new FakeFiles(root);
      const getInfo = files.getInfo.bind(files);
      files.getInfo = async path => {
        infos.push(`${jwt} ${path}`);
        // stat follows the link with a second getInfo; the lease expires in between.
        if (jwt === 'stale' && path === '/a.txt') throw new AuthenticationError('unauthorized');
        return getInfo(path);
      };
      return files;
    });
    expect(await sandbox.filesystem.stat('/link.txt')).toMatchObject({ type: 'file', size: 5 });
    expect(infos).toEqual(['stale /link.txt', 'stale /a.txt', 'fresh /a.txt']);
    expect(leases).toEqual(['stale', 'fresh']);
  });

  it('runs file commands through executeCommand, not the files API', async () => {
    const fetchMock: ReturnType<typeof vi.fn> = vi
      .fn()
      .mockResolvedValueOnce(created())
      .mockResolvedValueOnce(e2bLease());
    const commands: string[] = [];
    const timeouts: Array<number | undefined> = [];
    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      fetch: fetchMock as unknown as typeof fetch,
      e2bExecRunner: async (_lease, options) => {
        commands.push(options.command);
        timeouts.push(options.timeoutMs);
        return { exitCode: 0, stdout: '', stderr: '', truncated: false, timedOut: false };
      },
      e2bFilesFactory: () => {
        throw new Error('copyFile must not use the files API');
      },
    });
    await sandbox.filesystem.copyFile('/a.txt', '/b.txt');
    expect(commands).toHaveLength(1);
    expect(timeouts).toEqual([10 * 60_000]);
    expect(commands[0]).toMatch(/^sh -c .*cp "\$src" "\$dest"/s);
    expect(fetchMock.mock.calls.filter(isLeaseCall)).toHaveLength(1);
  });

  it.each([
    ['a timeout', () => new TimeoutError('502: The sandbox was not found')],
    ['a dead-sandbox 404', () => new E2BFileNotFoundError('paused sandbox sbx_1 not found')],
    ['a dropped connection', () => new TypeError('fetch failed')],
  ])('after %s on a cached lease, the next op learns the sandbox was destroyed', async (_name, failure) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(created())
      .mockResolvedValueOnce(e2bLease())
      .mockResolvedValueOnce(json({ error: { message: 'Gone', type: 'gone' } }, { status: 410 }));
    const error = failure();
    const read = vi.fn(async () => {
      throw error;
    });
    const { sandbox } = makeSandbox(fetchMock, () => Object.assign(new FakeFiles(root), { read }));
    await expect(sandbox.filesystem.readFile('/a.txt')).rejects.toBe(error);
    expect(read).toHaveBeenCalledTimes(1);
    await expect(sandbox.filesystem.readFile('/a.txt')).rejects.toBeInstanceOf(SandboxDestroyedError);
    expect(sandbox.status).toBe('stopped');
  });

  it('drops the fresh lease too when the retried call loses the sandbox', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(created())
      .mockResolvedValueOnce(e2bLease('stale'))
      .mockResolvedValueOnce(e2bLease('fresh'))
      .mockResolvedValueOnce(json({ error: { message: 'Gone', type: 'gone' } }, { status: 410 }));
    const timeout = new TimeoutError('502: The sandbox was not found');
    const { sandbox } = makeSandbox(fetchMock, jwt =>
      Object.assign(new FakeFiles(root), {
        read: async () => {
          throw jwt === 'stale' ? new AuthenticationError('unauthorized') : timeout;
        },
      }),
    );
    await expect(sandbox.filesystem.readFile('/a.txt')).rejects.toBe(timeout);
    await expect(sandbox.filesystem.readFile('/a.txt')).rejects.toBeInstanceOf(SandboxDestroyedError);
  });

  it('keeps the cached lease after an ordinary file error', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(created()).mockResolvedValueOnce(e2bLease());
    const { sandbox } = makeSandbox(fetchMock);
    await expect(sandbox.filesystem.readFile('/missing')).rejects.toBeInstanceOf(FileNotFoundError);
    await sandbox.filesystem.readFile('/a.txt');
    expect(fetchMock.mock.calls.filter(isLeaseCall)).toHaveLength(1);
  });

  it('rejects a sandbox whose lease is not E2B', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(created()).mockResolvedValueOnce(e2bLease('jwt', 'railway'));
    const { sandbox, leases } = makeSandbox(fetchMock);
    await expect(sandbox.filesystem.readFile('/a.txt')).rejects.toThrow(/requires an E2B-backed sandbox.*"railway"/);
    expect(leases).toEqual([]);
  });
});
