import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../errors';
import { LocalFilesystem } from './local-filesystem';

const race = vi.hoisted(() => ({
  root: '',
  onRootRealpath: undefined as undefined | (() => Promise<void>),
  afterOpen: undefined as undefined | (() => Promise<void>),
}));

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    open: async (...args: Parameters<typeof actual.open>) => {
      const handle = await actual.open(...args);
      if (race.afterOpen && args[0] === path.join(race.root, 'a.txt')) {
        const swap = race.afterOpen;
        race.afterOpen = undefined;
        await swap();
      }
      return handle;
    },
    realpath: async (...args: Parameters<typeof actual.realpath>) => {
      const resolved = await actual.realpath(...args);
      if (args[0] === race.root && race.onRootRealpath) {
        const swap = race.onRootRealpath;
        race.onRootRealpath = undefined;
        await swap();
      }
      return resolved;
    },
  };
});

describe('LocalFilesystem contained reads during symlink replacement (#27892)', () => {
  let temp: string;
  let root: string;
  let outside: string;
  let local: LocalFilesystem;

  beforeEach(async () => {
    temp = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-contained-race-'));
    root = path.join(temp, 'workspace');
    outside = path.join(temp, 'outside');
    await fs.mkdir(root);
    await fs.mkdir(outside);
    await fs.writeFile(path.join(root, 'a.txt'), 'safe');
    await fs.writeFile(path.join(outside, 'a.txt'), 'TOP-SECRET');
    local = new LocalFilesystem({ basePath: root, contained: true });
    race.root = root;
  });

  afterEach(async () => {
    race.onRootRealpath = undefined;
    race.afterOpen = undefined;
    race.root = '';
    await fs.rm(temp, { recursive: true, force: true });
  });

  function swapLeaf(target: string) {
    race.onRootRealpath = async () => {
      await fs.rm(path.join(root, 'a.txt'));
      await fs.symlink(target, path.join(root, 'a.txt'));
    };
  }

  it('does not read an outside file swapped in after containment check', async () => {
    swapLeaf(path.join(outside, 'a.txt'));
    await expect(local.readFile('a.txt', { encoding: 'utf-8' })).rejects.toThrow(PermissionError);
    expect(race.onRootRealpath).toBeUndefined();
  });

  it('does not expose outside metadata through stat', async () => {
    swapLeaf(path.join(outside, 'a.txt'));
    await expect(local.stat('a.txt')).rejects.toThrow(PermissionError);
    expect(race.onRootRealpath).toBeUndefined();
  });

  it('does not report an escaped file as existing', async () => {
    swapLeaf(path.join(outside, 'a.txt'));
    await expect(local.exists('a.txt')).rejects.toThrow(PermissionError);
    expect(race.onRootRealpath).toBeUndefined();
  });

  it('does not return an escaped canonical path', async () => {
    swapLeaf(path.join(outside, 'a.txt'));
    await expect(local.realpath('a.txt')).rejects.toThrow(PermissionError);
    expect(race.onRootRealpath).toBeUndefined();
  });

  it('rejects a parent directory swapped to an outside symlink', async () => {
    await fs.mkdir(path.join(root, 'dir'));
    await fs.writeFile(path.join(root, 'dir', 'a.txt'), 'safe');
    race.onRootRealpath = async () => {
      await fs.rename(path.join(root, 'dir'), path.join(root, 'old-dir'));
      await fs.symlink(outside, path.join(root, 'dir'));
    };
    await expect(local.readFile('dir/a.txt', { encoding: 'utf-8' })).rejects.toThrow(PermissionError);
    expect(race.onRootRealpath).toBeUndefined();
  });

  it('rejects a directory swapped to an outside symlink', async () => {
    await fs.mkdir(path.join(root, 'dir'));
    race.onRootRealpath = async () => {
      await fs.rename(path.join(root, 'dir'), path.join(root, 'old-dir'));
      await fs.symlink(outside, path.join(root, 'dir'));
    };
    await expect(local.readdir('dir')).rejects.toThrow(PermissionError);
  });

  it('detects a replacement after opening the descriptor via its inode', async () => {
    const replacement = path.join(root, 'other.txt');
    await fs.writeFile(replacement, 'replacement');
    race.afterOpen = async () => {
      await fs.rm(path.join(root, 'a.txt'));
      await fs.symlink(replacement, path.join(root, 'a.txt'));
    };
    await expect(local.readFile('a.txt', { encoding: 'utf-8' })).rejects.toThrow(PermissionError);
    expect(race.afterOpen).toBeUndefined();
  });

  it('allows a replacement symlink that stays inside the root', async () => {
    const target = path.join(root, 'other.txt');
    await fs.writeFile(target, 'still safe');
    swapLeaf(target);
    await expect(local.readFile('a.txt', { encoding: 'utf-8' })).resolves.toBe('still safe');
    expect(race.onRootRealpath).toBeUndefined();
  });

  it('keeps contained:false access to outside symlinks', async () => {
    const unrestricted = new LocalFilesystem({ basePath: root, contained: false });
    await fs.rm(path.join(root, 'a.txt'));
    await fs.symlink(path.join(outside, 'a.txt'), path.join(root, 'a.txt'));
    await expect(unrestricted.readFile('a.txt', { encoding: 'utf-8' })).resolves.toBe('TOP-SECRET');
    expect(await unrestricted.exists('a.txt')).toBe(true);
  });
});
