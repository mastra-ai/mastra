/**
 * ModalFilesystem unit tests.
 *
 * The Modal sandbox is replaced by a fake whose exec() runs the real shell
 * scripts locally against a temp directory, so path handling, argument
 * passing, and exit-code → error mapping are exercised end to end.
 * Requires GNU coreutils/findutils (Linux, as in Modal images).
 */

import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DirectoryNotEmptyError,
  DirectoryNotFoundError,
  FileExistsError,
  FileNotFoundError,
  IsDirectoryError,
  NotDirectoryError,
  PermissionError,
  StaleFileError,
  WorkspaceReadOnlyError,
} from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModalSandbox } from '../sandbox';
import { ModalFilesystem } from './index';

const hasGnuTools = (() => {
  try {
    return execFileSync('find', ['--version'], { encoding: 'utf8' }).includes('GNU');
  } catch {
    return false;
  }
})();

function createFakeSandbox() {
  const exec = vi.fn(async (argv: string[]) => {
    const child = spawn(argv[0]!, argv.slice(1));
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', c => stdout.push(c));
    child.stderr.on('data', c => stderr.push(c));
    const exit = new Promise<number>(resolve => child.on('close', code => resolve(code ?? 1)));
    return {
      stdin: {
        writeBytes: async (bytes: Uint8Array) => {
          child.stdin.write(bytes);
        },
        close: async () => {
          child.stdin.end();
        },
      },
      stdout: { readBytes: () => exit.then(() => new Uint8Array(Buffer.concat(stdout))) },
      stderr: { readBytes: () => exit.then(() => new Uint8Array(Buffer.concat(stderr))) },
      wait: () => exit,
    };
  });
  const sandbox = {
    ensureRunning: vi.fn(async () => {}),
    retryOnDead: vi.fn(<T>(fn: () => Promise<T>) => fn()),
    modal: { exec },
  };
  return { sandbox: sandbox as unknown as ModalSandbox, exec, raw: sandbox };
}

describe('ModalFilesystem (construction)', () => {
  it('requires an absolute basePath', () => {
    const { sandbox } = createFakeSandbox();
    expect(() => new ModalFilesystem({ sandbox, basePath: 'mnt/agent' })).toThrow(/must be absolute/);
  });

  it('resolves paths under basePath and rejects escapes', () => {
    const { sandbox } = createFakeSandbox();
    const fs = new ModalFilesystem({ sandbox, basePath: '/mnt/agent/' });
    expect(fs.resolvePath('/notes.md')).toBe('/mnt/agent/notes.md');
    expect(fs.resolvePath('a/../b.txt')).toBe('/mnt/agent/b.txt');
    expect(fs.resolvePath('/')).toBe('/mnt/agent');
    expect(() => fs.resolvePath('../etc/passwd')).toThrow(PermissionError);
    expect(() => fs.resolvePath('/a/../../x')).toThrow(PermissionError);
  });

  it('passes paths as argv, never interpolated into the script', async () => {
    const { sandbox, exec } = createFakeSandbox();
    const fs = new ModalFilesystem({ sandbox, basePath: '/tmp' });
    await fs.exists('$(touch pwned); x');
    const argv = exec.mock.calls[0]![0];
    expect(argv.slice(0, 2)).toEqual(['sh', '-c']);
    expect(argv[2]).not.toContain('pwned');
    expect(argv.at(-1)).toBe('/tmp/$(touch pwned); x');
  });

  it('reports info and instructions', () => {
    const { sandbox } = createFakeSandbox();
    const fs = new ModalFilesystem({ id: 'fs-1', sandbox, basePath: '/mnt/agent', readOnly: true });
    expect(fs.getInfo()).toMatchObject({
      id: 'fs-1',
      provider: 'modal',
      readOnly: true,
      metadata: { basePath: '/mnt/agent' },
    });
    expect(fs.getInstructions()).toContain('Read-only');
  });

  it('rejects writes when readOnly', async () => {
    const { sandbox, exec } = createFakeSandbox();
    const fs = new ModalFilesystem({ sandbox, basePath: '/mnt/agent', readOnly: true });
    await expect(fs.writeFile('a.txt', 'x')).rejects.toThrow(WorkspaceReadOnlyError);
    await expect(fs.deleteFile('a.txt')).rejects.toThrow(WorkspaceReadOnlyError);
    await expect(fs.mkdir('d')).rejects.toThrow(WorkspaceReadOnlyError);
    expect(exec).not.toHaveBeenCalled();
  });

  it('starts the sandbox lazily and routes execs through retryOnDead', async () => {
    const { sandbox, raw } = createFakeSandbox();
    const fs = new ModalFilesystem({ sandbox, basePath: '/tmp' });
    expect(raw.ensureRunning).not.toHaveBeenCalled();
    await fs.exists('x');
    expect(raw.ensureRunning).toHaveBeenCalledTimes(1);
    expect(raw.retryOnDead).toHaveBeenCalledTimes(1);
  });

  it('serializes stdin writes', async () => {
    const { sandbox, exec } = createFakeSandbox();
    let active = 0;
    let maxActive = 0;
    exec.mockImplementation(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(r => setTimeout(r, 5));
      active--;
      const empty = { readBytes: async () => new Uint8Array() };
      return {
        stdin: { writeBytes: async () => {}, close: async () => {} },
        stdout: empty,
        stderr: empty,
        wait: async () => 0,
      };
    });
    const fs = new ModalFilesystem({ sandbox, basePath: '/tmp' });
    await Promise.all([fs.writeFile('a', '1'), fs.writeFile('b', '2'), fs.appendFile('c', '3')]);
    expect(exec).toHaveBeenCalledTimes(3);
    expect(maxActive).toBe(1);
  });
});

describe.skipIf(!hasGnuTools)('ModalFilesystem (operations)', () => {
  let root: string;
  let fs: ModalFilesystem;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'modal-fs-'));
    fs = new ModalFilesystem({ sandbox: createFakeSandbox().sandbox, basePath: root });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes and reads text and binary files', async () => {
    await fs.writeFile('/notes/today.md', '# hello');
    expect(await fs.readFile('/notes/today.md', { encoding: 'utf-8' })).toBe('# hello');

    const bytes = Buffer.from([0, 1, 2, 255]);
    await fs.writeFile('bin.dat', bytes);
    expect(Buffer.compare((await fs.readFile('bin.dat')) as Buffer, bytes)).toBe(0);
  });

  it('writes an empty file', async () => {
    await fs.writeFile('empty.txt', '');
    expect(await fs.readFile('empty.txt', { encoding: 'utf-8' })).toBe('');
  });

  it('honors overwrite and recursive write options', async () => {
    await fs.writeFile('a.txt', '1');
    await expect(fs.writeFile('a.txt', '2', { overwrite: false })).rejects.toThrow(FileExistsError);
    await expect(fs.writeFile('missing/a.txt', '1', { recursive: false })).rejects.toThrow(DirectoryNotFoundError);
  });

  it('detects stale writes via expectedMtime', async () => {
    await fs.writeFile('a.txt', '1');
    await expect(fs.writeFile('a.txt', '2', { expectedMtime: new Date(0) })).rejects.toThrow(StaleFileError);
    const { modifiedAt } = await fs.stat('a.txt');
    await fs.writeFile('a.txt', '3', { expectedMtime: modifiedAt });
    expect(await fs.readFile('a.txt', { encoding: 'utf-8' })).toBe('3');
  });

  it('appends to files', async () => {
    await fs.appendFile('log.txt', 'a');
    await fs.appendFile('log.txt', 'b');
    expect(await fs.readFile('log.txt', { encoding: 'utf-8' })).toBe('ab');
  });

  it('maps read errors', async () => {
    await fs.mkdir('dir');
    await expect(fs.readFile('nope.txt')).rejects.toThrow(FileNotFoundError);
    await expect(fs.readFile('dir')).rejects.toThrow(IsDirectoryError);
  });

  it('deletes files', async () => {
    await fs.writeFile('a.txt', '1');
    await fs.deleteFile('a.txt');
    expect(await fs.exists('a.txt')).toBe(false);
    await expect(fs.deleteFile('a.txt')).rejects.toThrow(FileNotFoundError);
    await fs.deleteFile('a.txt', { force: true });
  });

  it('copies and moves files and directories', async () => {
    await fs.writeFile('src/a.txt', 'A');
    await fs.copyFile('src/a.txt', 'copy/a.txt');
    expect(await fs.readFile('copy/a.txt', { encoding: 'utf-8' })).toBe('A');

    await expect(fs.copyFile('src', 'dir-copy')).rejects.toThrow(IsDirectoryError);
    await fs.copyFile('src', 'dir-copy', { recursive: true });
    expect(await fs.exists('dir-copy/a.txt')).toBe(true);

    await expect(fs.copyFile('src/a.txt', 'copy/a.txt', { overwrite: false })).rejects.toThrow(FileExistsError);

    await fs.moveFile('copy/a.txt', 'moved.txt');
    expect(await fs.exists('copy/a.txt')).toBe(false);
    expect(await fs.readFile('moved.txt', { encoding: 'utf-8' })).toBe('A');
    await expect(fs.moveFile('ghost', 'x')).rejects.toThrow(FileNotFoundError);
  });

  it('creates and removes directories', async () => {
    await fs.mkdir('a/b/c');
    expect((await fs.stat('a/b/c')).type).toBe('directory');
    await expect(fs.mkdir('x/y', { recursive: false })).rejects.toThrow(DirectoryNotFoundError);
    await expect(fs.mkdir('a', { recursive: false })).rejects.toThrow(FileExistsError);

    await expect(fs.rmdir('a')).rejects.toThrow(DirectoryNotEmptyError);
    await fs.rmdir('a', { recursive: true });
    expect(await fs.exists('a')).toBe(false);
    await expect(fs.rmdir('a')).rejects.toThrow(DirectoryNotFoundError);
    await fs.rmdir('a', { force: true });
    await expect(fs.rmdir('/')).rejects.toThrow(PermissionError);
  });

  it('lists directories', async () => {
    await fs.writeFile('a.ts', '12');
    await fs.writeFile('b.md', '1');
    await fs.writeFile('sub/c.ts', '123');
    await fs.writeFile('sub/deep/d.ts', '1');
    execFileSync('ln', ['-s', 'a.ts', join(root, 'link.ts')]);

    const top = await fs.readdir('/');
    expect(top.sort((x, y) => x.name.localeCompare(y.name))).toEqual([
      { name: 'a.ts', type: 'file', size: 2 },
      { name: 'b.md', type: 'file', size: 1 },
      { name: 'link.ts', type: 'file', isSymlink: true, symlinkTarget: 'a.ts' },
      { name: 'sub', type: 'directory' },
    ]);

    const recursive = await fs.readdir('/', { recursive: true, extension: '.ts' });
    expect(recursive.map(e => e.name).sort()).toEqual([
      'a.ts',
      'link.ts',
      'sub',
      'sub/c.ts',
      'sub/deep',
      'sub/deep/d.ts',
    ]);

    const shallow = await fs.readdir('/', { recursive: true, maxDepth: 0 });
    expect(shallow.map(e => e.name)).not.toContain('sub/c.ts');

    await expect(fs.readdir('missing')).rejects.toThrow(DirectoryNotFoundError);
    await expect(fs.readdir('a.ts')).rejects.toThrow(NotDirectoryError);
  });

  it('stats files and directories', async () => {
    await fs.writeFile('dir/f.txt', 'hello');
    const file = await fs.stat('dir/f.txt');
    expect(file).toMatchObject({ name: 'f.txt', path: join(root, 'dir/f.txt'), type: 'file', size: 5 });
    expect(file.modifiedAt.getTime()).toBeGreaterThan(0);
    expect((await fs.stat('dir')).type).toBe('directory');
    await expect(fs.stat('nope')).rejects.toThrow(FileNotFoundError);
  });

  it('rejects symlinks that escape basePath', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'modal-fs-outside-'));
    try {
      execFileSync('sh', ['-c', 'echo secret > "$1/secret.txt"', 'sh', outside]);
      execFileSync('ln', ['-s', outside, join(root, 'escape')]);
      execFileSync('ln', ['-s', join(outside, 'new.txt'), join(root, 'dangling')]);

      await expect(fs.readFile('escape/secret.txt')).rejects.toThrow(PermissionError);
      await expect(fs.writeFile('escape/pwned.txt', 'x')).rejects.toThrow(PermissionError);
      await expect(fs.writeFile('dangling', 'x')).rejects.toThrow(PermissionError);
      await expect(fs.readdir('escape')).rejects.toThrow(PermissionError);
      await expect(fs.stat('escape/secret.txt')).rejects.toThrow(PermissionError);
      await expect(fs.copyFile('a-missing', 'escape/copy.txt')).rejects.toThrow(PermissionError);
      expect(await fs.exists('escape/secret.txt')).toBe(false);
      expect(execFileSync('ls', [outside], { encoding: 'utf8' }).trim()).toBe('secret.txt');
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
