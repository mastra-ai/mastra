import { execFile } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readdir, readFile, readlink, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  FILE_COMMAND_EXIT,
  appendFromCommand,
  copyCommand,
  linkNoClobberCommand,
  moveNoClobberCommand,
  shellQuote,
  siblingTempPath,
} from './file-commands';

const run = promisify(execFile);

async function sh(script: string): Promise<number> {
  try {
    await run('sh', ['-c', script]);
    return 0;
  } catch (error) {
    return (error as { code: number }).code;
  }
}

let dir: string;

beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'file-commands-')));
  await mkdir(join(dir, 'src/nested'), { recursive: true });
  await writeFile(join(dir, 'a.txt'), 'A');
  await writeFile(join(dir, 'src/b.ts'), 'B');
  await writeFile(join(dir, 'src/nested/c.ts'), 'C');
  await symlink('b.ts', join(dir, 'src/link.ts'));
  await symlink('a.txt', join(dir, 'filelink'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const at = (path: string) => join(dir, path);
const text = (path: string) => readFile(at(path), 'utf8');

describe('shellQuote', () => {
  it('survives quotes, spaces and $ in a path', async () => {
    const odd = at(`it's a $HOME "file"`);
    expect(await sh(`printf x > ${shellQuote(odd)}`)).toBe(0);
    expect(await readFile(odd, 'utf8')).toBe('x');
  });
});

describe('copyCommand', () => {
  it('copies a file, creating the destination parent', async () => {
    expect(await sh(copyCommand(at('a.txt'), at('out/deep/a.txt')))).toBe(0);
    expect(await text('out/deep/a.txt')).toBe('A');
  });

  it('copies what a symlinked file source points at', async () => {
    expect(await sh(copyCommand(at('filelink'), at('copy.txt')))).toBe(0);
    expect((await lstat(at('copy.txt'))).isSymbolicLink()).toBe(false);
    expect(await text('copy.txt')).toBe('A');
  });

  it('replaces an existing file by default', async () => {
    await writeFile(at('dest.txt'), 'old');
    expect(await sh(copyCommand(at('a.txt'), at('dest.txt')))).toBe(0);
    expect(await text('dest.txt')).toBe('A');
  });

  it('reports a missing source, including a broken symlink', async () => {
    await symlink('nowhere', at('dangling'));
    expect(await sh(copyCommand(at('missing'), at('x')))).toBe(FILE_COMMAND_EXIT.notFound);
    expect(await sh(copyCommand(at('dangling'), at('x')))).toBe(FILE_COMMAND_EXIT.notFound);
  });

  it('refuses a directory source without recursive', async () => {
    expect(await sh(copyCommand(at('src'), at('out')))).toBe(FILE_COMMAND_EXIT.isDirectory);
  });

  it('refuses to copy a file onto a directory or a link to one', async () => {
    await symlink('src', at('dirlink'));
    expect(await sh(copyCommand(at('a.txt'), at('dirlink')))).toBe(FILE_COMMAND_EXIT.destIsDirectory);
    expect(await readdir(at('src'))).not.toContain('a.txt');
    expect(await sh(copyCommand(at('a.txt'), at('src')))).toBe(FILE_COMMAND_EXIT.destIsDirectory);
  });

  it('copies a tree recursively and keeps symlinks inside it as links', async () => {
    expect(await sh(copyCommand(at('src'), at('out'), { recursive: true }))).toBe(0);
    expect(await text('out/nested/c.ts')).toBe('C');
    expect(await readlink(at('out/link.ts'))).toBe('b.ts');
  });

  it('merges a recursive copy into an existing directory', async () => {
    await mkdir(at('out'));
    await writeFile(at('out/keep.txt'), 'K');
    expect(await sh(copyCommand(at('src'), at('out'), { recursive: true }))).toBe(0);
    expect((await readdir(at('out'))).sort()).toEqual(['b.ts', 'keep.txt', 'link.ts', 'nested']);
  });

  describe('overwrite: false', () => {
    it('copies a file to a free destination and leaves no temp file', async () => {
      expect(await sh(copyCommand(at('a.txt'), at('new.txt'), { overwrite: false }))).toBe(0);
      expect(await text('new.txt')).toBe('A');
      expect((await readdir(dir)).filter(name => name.includes('mastra-tmp'))).toEqual([]);
    });

    it('refuses a taken file destination without touching it', async () => {
      await writeFile(at('dest.txt'), 'old');
      expect(await sh(copyCommand(at('a.txt'), at('dest.txt'), { overwrite: false }))).toBe(FILE_COMMAND_EXIT.exists);
      expect(await text('dest.txt')).toBe('old');
    });

    it('treats a broken symlink at the destination as taken', async () => {
      await symlink('nowhere', at('dangling'));
      expect(await sh(copyCommand(at('a.txt'), at('dangling'), { overwrite: false }))).toBe(FILE_COMMAND_EXIT.exists);
    });

    it('refuses a taken directory destination', async () => {
      await mkdir(at('out'));
      expect(await sh(copyCommand(at('src'), at('out'), { recursive: true, overwrite: false }))).toBe(
        FILE_COMMAND_EXIT.exists,
      );
      expect(await readdir(at('out'))).toEqual([]);
    });

    it('lets exactly one of several racing copies claim the destination', async () => {
      const codes = await Promise.all(
        Array.from({ length: 8 }, () => sh(copyCommand(at('a.txt'), at('race.txt'), { overwrite: false }))),
      );
      expect(codes.filter(code => code === 0)).toHaveLength(1);
      expect(codes.filter(code => code === FILE_COMMAND_EXIT.exists)).toHaveLength(7);
    });
  });
});

describe('moveNoClobberCommand', () => {
  it('moves to a free destination, creating its parent', async () => {
    expect(await sh(moveNoClobberCommand(at('a.txt'), at('moved/a.txt')))).toBe(0);
    expect(await text('moved/a.txt')).toBe('A');
    await expect(lstat(at('a.txt'))).rejects.toThrow();
  });

  it('leaves both sides alone when the destination is taken', async () => {
    await writeFile(at('dest.txt'), 'old');
    expect(await sh(moveNoClobberCommand(at('a.txt'), at('dest.txt')))).toBe(FILE_COMMAND_EXIT.exists);
    expect(await text('a.txt')).toBe('A');
    expect(await text('dest.txt')).toBe('old');
  });

  it('reports a missing source', async () => {
    expect(await sh(moveNoClobberCommand(at('missing'), at('x')))).toBe(FILE_COMMAND_EXIT.notFound);
  });
});

describe('appendFromCommand', () => {
  it('appends the temp file and deletes it', async () => {
    await writeFile(at('tmp'), '+more');
    expect(await sh(appendFromCommand(at('tmp'), at('a.txt')))).toBe(0);
    expect(await text('a.txt')).toBe('A+more');
    await expect(lstat(at('tmp'))).rejects.toThrow();
  });

  it('creates a missing destination and its parent', async () => {
    await writeFile(at('tmp'), 'new');
    expect(await sh(appendFromCommand(at('tmp'), at('logs/x.log')))).toBe(0);
    expect(await text('logs/x.log')).toBe('new');
  });

  it('refuses a directory destination and still cleans up', async () => {
    await writeFile(at('tmp'), 'x');
    expect(await sh(appendFromCommand(at('tmp'), at('src')))).toBe(FILE_COMMAND_EXIT.isDirectory);
    await expect(lstat(at('tmp'))).rejects.toThrow();
  });
});

describe('linkNoClobberCommand', () => {
  it('publishes the temp file at a free destination', async () => {
    const tmp = siblingTempPath(at('fresh.txt'));
    await writeFile(tmp, 'F');
    expect(await sh(linkNoClobberCommand(tmp, at('fresh.txt')))).toBe(0);
    expect(await text('fresh.txt')).toBe('F');
    await expect(lstat(tmp)).rejects.toThrow();
  });

  it('refuses a taken destination and deletes the temp file', async () => {
    const tmp = siblingTempPath(at('a.txt'));
    await writeFile(tmp, 'new');
    expect(await sh(linkNoClobberCommand(tmp, at('a.txt')))).toBe(FILE_COMMAND_EXIT.exists);
    expect(await text('a.txt')).toBe('A');
    await expect(lstat(tmp)).rejects.toThrow();
  });

  it.each(['src', 'dirlink'])('refuses %s (a directory) and leaves nothing inside it', async name => {
    await symlink('src', at('dirlink'));
    const before = await readdir(at('src'));
    const tmp = siblingTempPath(at(name));
    await writeFile(tmp, 'new');
    expect(await sh(linkNoClobberCommand(tmp, at(name)))).toBe(FILE_COMMAND_EXIT.exists);
    expect(await readdir(at('src'))).toEqual(before);
    await expect(lstat(tmp)).rejects.toThrow();
  });

  it('undoes the link when the destination becomes a directory after the check', async () => {
    // Skip the pre-check to reach the race path: ln lands inside the directory.
    const tmp = siblingTempPath(at('src'));
    await writeFile(tmp, 'new');
    const lines = linkNoClobberCommand(tmp, at('src')).split('\n');
    const script = lines.filter(line => !line.startsWith('if { [ -e "$dest" ]')).join('\n');
    expect(script.split('\n')).toHaveLength(lines.length - 1);
    expect(await sh(script)).toBe(FILE_COMMAND_EXIT.exists);
    expect(await readdir(at('src'))).toEqual(['b.ts', 'link.ts', 'nested']);
    await expect(lstat(tmp)).rejects.toThrow();
  });
});

describe('siblingTempPath', () => {
  it('is a hidden, unique sibling', () => {
    const a = siblingTempPath('/w/dir/file.ts');
    expect(a).toMatch(/^\/w\/dir\/\.file\.ts\.mastra-tmp-[a-z0-9]+$/);
    expect(siblingTempPath('/w/dir/file.ts')).not.toBe(a);
  });
});
