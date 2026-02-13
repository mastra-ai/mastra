import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { PermissionError } from '../errors';
import { CompositeFilesystem } from './composite-filesystem';
import type { WorkspaceFilesystem } from './filesystem';
import { LocalFilesystem } from './local-filesystem';

describe('CompositeFilesystem', () => {
  let tempDirA: string;
  let tempDirB: string;
  let localA: LocalFilesystem;
  let localB: LocalFilesystem;

  beforeEach(async () => {
    tempDirA = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-cfs-a-'));
    tempDirB = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-cfs-b-'));
    localA = new LocalFilesystem({ basePath: tempDirA });
    localB = new LocalFilesystem({ basePath: tempDirB });
  });

  afterEach(async () => {
    for (const dir of [tempDirA, tempDirB]) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  // ===========================================================================
  // 1. Constructor Validation
  // ===========================================================================
  describe('constructor', () => {
    it('should create with at least one mount', () => {
      const cfs = new CompositeFilesystem({ mounts: { '/a': localA } });
      expect(cfs.name).toBe('CompositeFilesystem');
      expect(cfs.provider).toBe('composite');
      expect(cfs.id).toBeDefined();
    });

    it('should throw on empty mounts', () => {
      expect(() => new CompositeFilesystem({ mounts: {} })).toThrow('at least one mount');
    });

    it('should reject nested mount paths', () => {
      expect(
        () =>
          new CompositeFilesystem({
            mounts: {
              '/data': localA,
              '/data/sub': localB,
            },
          }),
      ).toThrow('Nested mount paths are not supported');
    });

    it('should normalize mount paths', () => {
      const cfs = new CompositeFilesystem({
        mounts: { 'local/': localA, s3: localB },
      });
      expect(cfs.mountPaths).toContain('/local');
      expect(cfs.mountPaths).toContain('/s3');
    });
  });

  // ===========================================================================
  // 2. Mount Resolution & Path Normalization
  // ===========================================================================
  describe('mount resolution', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(() => {
      cfs = new CompositeFilesystem({
        mounts: { '/local': localA, '/s3': localB },
      });
    });

    it('should resolve path to the correct filesystem', () => {
      expect(cfs.getFilesystemForPath('/local/file.txt')).toBe(localA);
      expect(cfs.getFilesystemForPath('/s3/data.json')).toBe(localB);
    });

    it('should resolve mount root path', () => {
      expect(cfs.getFilesystemForPath('/local')).toBe(localA);
      expect(cfs.getMountPathForPath('/local')).toBe('/local');
    });

    it('should return undefined for unmounted path', () => {
      expect(cfs.getFilesystemForPath('/unknown/file.txt')).toBeUndefined();
      expect(cfs.getMountPathForPath('/unknown/file.txt')).toBeUndefined();
    });

    it('should return undefined for root path when no root mount', () => {
      expect(cfs.getFilesystemForPath('/')).toBeUndefined();
    });

    it('should handle paths without leading slash', () => {
      expect(cfs.getFilesystemForPath('local/file.txt')).toBe(localA);
    });

    it('should handle paths with trailing slash', () => {
      expect(cfs.getFilesystemForPath('/local/')).toBe(localA);
    });
  });

  // ===========================================================================
  // 2b. Prefix Mount Path Routing
  // ===========================================================================
  describe('prefix mount path routing', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(async () => {
      // /data and /data2 are NOT nested — tests the startsWith(mountPath + '/') check
      cfs = new CompositeFilesystem({
        mounts: { '/data': localA, '/data2': localB },
      });
      await cfs.init();
    });

    it('should route /data/file.txt to /data mount, not /data2', async () => {
      await cfs.writeFile('/data/file.txt', 'in data');
      expect(await cfs.readFile('/data/file.txt', { encoding: 'utf-8' })).toBe('in data');
      expect(await cfs.exists('/data2/file.txt')).toBe(false);
    });

    it('should route /data2/file.txt to /data2 mount, not /data', async () => {
      await cfs.writeFile('/data2/file.txt', 'in data2');
      expect(await cfs.readFile('/data2/file.txt', { encoding: 'utf-8' })).toBe('in data2');
      expect(await cfs.exists('/data/file.txt')).toBe(false);
    });
  });

  // ===========================================================================
  // 3. Single-Mount File Operation Routing
  // ===========================================================================
  describe('single-mount routing', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(async () => {
      cfs = new CompositeFilesystem({ mounts: { '/data': localA } });
      await cfs.init();
    });

    it('should write and read a file', async () => {
      await cfs.writeFile('/data/hello.txt', 'Hello World');
      const content = await cfs.readFile('/data/hello.txt', { encoding: 'utf-8' });
      expect(content).toBe('Hello World');
    });

    it('should append to a file', async () => {
      await cfs.writeFile('/data/log.txt', 'line1');
      await cfs.appendFile('/data/log.txt', '\nline2');
      const content = await cfs.readFile('/data/log.txt', { encoding: 'utf-8' });
      expect(content).toBe('line1\nline2');
    });

    it('should delete a file', async () => {
      await cfs.writeFile('/data/temp.txt', 'temp');
      await cfs.deleteFile('/data/temp.txt');
      expect(await cfs.exists('/data/temp.txt')).toBe(false);
    });

    it('should create and remove a directory', async () => {
      await cfs.mkdir('/data/subdir');
      expect(await cfs.exists('/data/subdir')).toBe(true);
      await cfs.rmdir('/data/subdir');
      expect(await cfs.exists('/data/subdir')).toBe(false);
    });

    it('should list directory contents', async () => {
      await cfs.writeFile('/data/a.txt', 'a');
      await cfs.writeFile('/data/b.txt', 'b');
      const entries = await cfs.readdir('/data');
      const names = entries.map(e => e.name).sort();
      expect(names).toEqual(['a.txt', 'b.txt']);
    });

    it('should check existence', async () => {
      await cfs.writeFile('/data/exists.txt', 'yes');
      expect(await cfs.exists('/data/exists.txt')).toBe(true);
      expect(await cfs.exists('/data/nope.txt')).toBe(false);
    });

    it('should return stat for a file', async () => {
      await cfs.writeFile('/data/info.txt', 'content');
      const stat = await cfs.stat('/data/info.txt');
      expect(stat.type).toBe('file');
      expect(stat.name).toBe('info.txt');
      expect(stat.size).toBe(7);
    });
  });

  // ===========================================================================
  // 4. Multi-Mount Isolation
  // ===========================================================================
  describe('multi-mount isolation', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(async () => {
      cfs = new CompositeFilesystem({
        mounts: { '/local': localA, '/s3': localB },
      });
      await cfs.init();
    });

    it('should isolate files between mounts', async () => {
      await cfs.writeFile('/local/file.txt', 'local content');
      expect(await cfs.exists('/s3/file.txt')).toBe(false);
    });

    it('should read from correct mount', async () => {
      await cfs.writeFile('/local/shared.txt', 'from local');
      await cfs.writeFile('/s3/shared.txt', 'from s3');

      const localContent = await cfs.readFile('/local/shared.txt', { encoding: 'utf-8' });
      const s3Content = await cfs.readFile('/s3/shared.txt', { encoding: 'utf-8' });

      expect(localContent).toBe('from local');
      expect(s3Content).toBe('from s3');
    });

    it('should list each mount independently', async () => {
      await cfs.writeFile('/local/a.txt', 'a');
      await cfs.writeFile('/s3/b.txt', 'b');

      const localEntries = await cfs.readdir('/local');
      const s3Entries = await cfs.readdir('/s3');

      expect(localEntries.map(e => e.name)).toEqual(['a.txt']);
      expect(s3Entries.map(e => e.name)).toEqual(['b.txt']);
    });
  });

  // ===========================================================================
  // 5. Cross-Mount copyFile
  // ===========================================================================
  describe('cross-mount copyFile', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(async () => {
      cfs = new CompositeFilesystem({
        mounts: { '/local': localA, '/s3': localB },
      });
      await cfs.init();
    });

    it('should copy file within the same mount (delegation)', async () => {
      await cfs.writeFile('/local/src.txt', 'data');
      await cfs.copyFile('/local/src.txt', '/local/dest.txt');

      expect(await cfs.readFile('/local/src.txt', { encoding: 'utf-8' })).toBe('data');
      expect(await cfs.readFile('/local/dest.txt', { encoding: 'utf-8' })).toBe('data');
    });

    it('should copy file across mounts (read-then-write)', async () => {
      await cfs.writeFile('/local/src.txt', 'cross-mount');
      await cfs.copyFile('/local/src.txt', '/s3/dest.txt');

      // Source preserved
      expect(await cfs.readFile('/local/src.txt', { encoding: 'utf-8' })).toBe('cross-mount');
      // Dest written
      expect(await cfs.readFile('/s3/dest.txt', { encoding: 'utf-8' })).toBe('cross-mount');
    });

    it('should throw when source mount does not exist', async () => {
      await expect(cfs.copyFile('/unknown/src.txt', '/local/dest.txt')).rejects.toThrow('No mount for source');
    });

    it('should throw when dest mount does not exist', async () => {
      await cfs.writeFile('/local/src.txt', 'data');
      await expect(cfs.copyFile('/local/src.txt', '/unknown/dest.txt')).rejects.toThrow('No mount for dest');
    });
  });

  // ===========================================================================
  // 6. Cross-Mount moveFile
  // ===========================================================================
  describe('cross-mount moveFile', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(async () => {
      cfs = new CompositeFilesystem({
        mounts: { '/local': localA, '/s3': localB },
      });
      await cfs.init();
    });

    it('should move file within the same mount (delegation)', async () => {
      await cfs.writeFile('/local/src.txt', 'data');
      await cfs.moveFile('/local/src.txt', '/local/dest.txt');

      expect(await cfs.exists('/local/src.txt')).toBe(false);
      expect(await cfs.readFile('/local/dest.txt', { encoding: 'utf-8' })).toBe('data');
    });

    it('should move file across mounts (copy-then-delete)', async () => {
      await cfs.writeFile('/local/src.txt', 'moving');
      await cfs.moveFile('/local/src.txt', '/s3/dest.txt');

      // Source gone
      expect(await cfs.exists('/local/src.txt')).toBe(false);
      // Dest written
      expect(await cfs.readFile('/s3/dest.txt', { encoding: 'utf-8' })).toBe('moving');
    });

    it('should throw when source mount does not exist', async () => {
      await expect(cfs.moveFile('/unknown/src.txt', '/local/dest.txt')).rejects.toThrow('No mount for source');
    });

    it('should throw when dest mount does not exist', async () => {
      await cfs.writeFile('/local/src.txt', 'data');
      await expect(cfs.moveFile('/local/src.txt', '/unknown/dest.txt')).rejects.toThrow('No mount for dest');
    });
  });

  // ===========================================================================
  // 7. Virtual Paths & Root Directory Listing
  // ===========================================================================
  describe('virtual paths', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(() => {
      cfs = new CompositeFilesystem({
        mounts: { '/local': localA, '/s3': localB },
      });
    });

    it('should list mount names at root', async () => {
      const entries = await cfs.readdir('/');
      const names = entries.map(e => e.name).sort();
      expect(names).toEqual(['local', 's3']);
      expect(entries.every(e => e.type === 'directory')).toBe(true);
    });

    it('should include mount metadata in root listing', async () => {
      const entries = await cfs.readdir('/');
      const localEntry = entries.find(e => e.name === 'local');
      expect(localEntry?.mount).toBeDefined();
      expect(localEntry?.mount?.provider).toBe('local');
    });

    it('should report root as existing', async () => {
      expect(await cfs.exists('/')).toBe(true);
    });

    it('should report mount root as existing', async () => {
      expect(await cfs.exists('/local')).toBe(true);
      expect(await cfs.exists('/s3')).toBe(true);
    });

    it('should return directory stat for root', async () => {
      const stat = await cfs.stat('/');
      expect(stat.type).toBe('directory');
      expect(stat.size).toBe(0);
    });

    it('should return directory stat for mount root', async () => {
      const stat = await cfs.stat('/local');
      expect(stat.type).toBe('directory');
      expect(stat.name).toBe('local');
    });

    it('should report root as directory', async () => {
      expect(await cfs.isDirectory('/')).toBe(true);
    });

    it('should report root as not a file', async () => {
      expect(await cfs.isFile('/')).toBe(false);
    });
  });

  // ===========================================================================
  // 8. Read-Only Enforcement
  // ===========================================================================
  describe('read-only enforcement', () => {
    let readOnlyFs: LocalFilesystem;
    let tempDirRo: string;
    let cfs: CompositeFilesystem<any>;

    beforeEach(async () => {
      tempDirRo = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-cfs-ro-'));
      // Pre-create a file in the read-only mount
      await fs.writeFile(path.join(tempDirRo, 'existing.txt'), 'read me');
      readOnlyFs = new LocalFilesystem({ basePath: tempDirRo, readOnly: true });
      cfs = new CompositeFilesystem({
        mounts: { '/ro': readOnlyFs, '/rw': localA },
      });
      await cfs.init();
    });

    afterEach(async () => {
      try {
        await fs.rm(tempDirRo, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    });

    it('should allow reading from read-only mount', async () => {
      const content = await cfs.readFile('/ro/existing.txt', { encoding: 'utf-8' });
      expect(content).toBe('read me');
    });

    it('should throw PermissionError on writeFile to read-only mount', async () => {
      await expect(cfs.writeFile('/ro/new.txt', 'fail')).rejects.toThrow(PermissionError);
    });

    it('should throw PermissionError on appendFile to read-only mount', async () => {
      await expect(cfs.appendFile('/ro/existing.txt', 'more')).rejects.toThrow(PermissionError);
    });

    it('should throw PermissionError on deleteFile to read-only mount', async () => {
      await expect(cfs.deleteFile('/ro/existing.txt')).rejects.toThrow(PermissionError);
    });

    it('should throw PermissionError on mkdir to read-only mount', async () => {
      await expect(cfs.mkdir('/ro/newdir')).rejects.toThrow(PermissionError);
    });

    it('should throw PermissionError on rmdir to read-only mount', async () => {
      await expect(cfs.rmdir('/ro')).rejects.toThrow(PermissionError);
    });

    it('should throw PermissionError on copyFile to read-only dest', async () => {
      await cfs.writeFile('/rw/src.txt', 'data');
      await expect(cfs.copyFile('/rw/src.txt', '/ro/dest.txt')).rejects.toThrow(PermissionError);
    });

    it('should throw PermissionError on moveFile from read-only source', async () => {
      // moveFile needs source writable for delete
      await expect(cfs.moveFile('/ro/existing.txt', '/rw/dest.txt')).rejects.toThrow(PermissionError);
    });
  });

  // ===========================================================================
  // 9. Lifecycle (init / destroy)
  // ===========================================================================
  describe('lifecycle', () => {
    it('should transition to ready after init', async () => {
      const cfs = new CompositeFilesystem({ mounts: { '/a': localA } });
      expect(cfs.status).toBe('ready'); // Starts ready since constructor sets it
      await cfs.init();
      expect(cfs.status).toBe('ready');
    });

    it('should stay ready even if a mount fails to initialize', async () => {
      const failingFs: WorkspaceFilesystem = {
        id: 'failing',
        name: 'FailingFS',
        provider: 'failing',
        status: 'pending',
        async init() {
          throw new Error('init failed');
        },
        readFile: vi.fn(),
        writeFile: vi.fn(),
        appendFile: vi.fn(),
        deleteFile: vi.fn(),
        copyFile: vi.fn(),
        moveFile: vi.fn(),
        mkdir: vi.fn(),
        rmdir: vi.fn(),
        readdir: vi.fn(),
        exists: vi.fn(),
        stat: vi.fn(),
      };

      const cfs = new CompositeFilesystem({
        mounts: { '/ok': localA, '/fail': failingFs },
      });

      // Should not throw
      await cfs.init();
      expect(cfs.status).toBe('ready');
    });

    it('should transition to destroyed after destroy', async () => {
      const cfs = new CompositeFilesystem({ mounts: { '/a': localA } });
      await cfs.init();
      await cfs.destroy();
      expect(cfs.status).toBe('destroyed');
    });

    it('should throw AggregateError when a mount fails to destroy', async () => {
      const failingFs: WorkspaceFilesystem = {
        id: 'failing',
        name: 'FailingFS',
        provider: 'failing',
        status: 'ready',
        async destroy() {
          throw new Error('destroy failed');
        },
        readFile: vi.fn(),
        writeFile: vi.fn(),
        appendFile: vi.fn(),
        deleteFile: vi.fn(),
        copyFile: vi.fn(),
        moveFile: vi.fn(),
        mkdir: vi.fn(),
        rmdir: vi.fn(),
        readdir: vi.fn(),
        exists: vi.fn(),
        stat: vi.fn(),
      };

      const cfs = new CompositeFilesystem({
        mounts: { '/fail': failingFs },
      });

      await expect(cfs.destroy()).rejects.toThrow(AggregateError);
      expect(cfs.status).toBe('error');
    });
  });

  // ===========================================================================
  // 10. getInstructions()
  // ===========================================================================
  describe('getInstructions', () => {
    it('should list mounts with read-write status', () => {
      const cfs = new CompositeFilesystem({
        mounts: { '/local': localA, '/s3': localB },
      });
      const instructions = cfs.getInstructions();
      expect(instructions).toContain('/local');
      expect(instructions).toContain('/s3');
      expect(instructions).toContain('(read-write)');
    });

    it('should indicate read-only mounts', async () => {
      const tempDirRo = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-cfs-ro-'));
      try {
        const roFs = new LocalFilesystem({ basePath: tempDirRo, readOnly: true });
        const cfs = new CompositeFilesystem({
          mounts: { '/ro': roFs, '/rw': localA },
        });
        const instructions = cfs.getInstructions();
        expect(instructions).toContain('(read-only)');
        expect(instructions).toContain('(read-write)');
      } finally {
        await fs.rm(tempDirRo, { recursive: true, force: true });
      }
    });

    it('should mention sandbox path semantics', () => {
      const cfs = new CompositeFilesystem({ mounts: { '/a': localA } });
      const instructions = cfs.getInstructions();
      expect(instructions).toContain('sandbox');
    });
  });

  // ===========================================================================
  // 11. isFile / isDirectory for Real Files
  // ===========================================================================
  describe('isFile and isDirectory', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(async () => {
      cfs = new CompositeFilesystem({
        mounts: { '/data': localA, '/other': localB },
      });
      await cfs.init();
    });

    it('should return true for isFile on a real file', async () => {
      await cfs.writeFile('/data/file.txt', 'content');
      expect(await cfs.isFile('/data/file.txt')).toBe(true);
    });

    it('should return false for isFile on a directory', async () => {
      await cfs.mkdir('/data/subdir');
      expect(await cfs.isFile('/data/subdir')).toBe(false);
    });

    it('should return false for isFile on non-existent path', async () => {
      expect(await cfs.isFile('/data/nope.txt')).toBe(false);
    });

    it('should return false for isFile on unmounted path', async () => {
      expect(await cfs.isFile('/unknown/file.txt')).toBe(false);
    });

    it('should return true for isDirectory on a real directory', async () => {
      await cfs.mkdir('/data/subdir');
      expect(await cfs.isDirectory('/data/subdir')).toBe(true);
    });

    it('should return false for isDirectory on a file', async () => {
      await cfs.writeFile('/data/file.txt', 'content');
      expect(await cfs.isDirectory('/data/file.txt')).toBe(false);
    });

    it('should return true for isDirectory on mount root', async () => {
      expect(await cfs.isDirectory('/data')).toBe(true);
    });

    it('should return false for isDirectory on unmounted path', async () => {
      expect(await cfs.isDirectory('/unknown')).toBe(false);
    });
  });

  // ===========================================================================
  // 12. Buffer Content in Cross-Mount Operations
  // ===========================================================================
  describe('buffer content cross-mount', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(async () => {
      cfs = new CompositeFilesystem({
        mounts: { '/a': localA, '/b': localB },
      });
      await cfs.init();
    });

    it('should preserve binary data in cross-mount copy', async () => {
      const binary = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x80, 0x7f]);
      await cfs.writeFile('/a/bin.dat', binary);
      await cfs.copyFile('/a/bin.dat', '/b/bin.dat');

      const result = await cfs.readFile('/b/bin.dat');
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(Buffer.from(result as Buffer).equals(binary)).toBe(true);
    });

    it('should preserve binary data in cross-mount move', async () => {
      const binary = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
      await cfs.writeFile('/a/bin.dat', binary);
      await cfs.moveFile('/a/bin.dat', '/b/bin.dat');

      expect(await cfs.exists('/a/bin.dat')).toBe(false);
      const result = await cfs.readFile('/b/bin.dat');
      expect(Buffer.from(result as Buffer).equals(binary)).toBe(true);
    });
  });

  // ===========================================================================
  // 13. readdir Delegation vs Virtual Entries
  // ===========================================================================
  describe('readdir delegation vs virtual', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(async () => {
      cfs = new CompositeFilesystem({
        mounts: { '/mount': localA },
      });
      await cfs.init();
    });

    it('should delegate readdir on mount root to underlying filesystem', async () => {
      await cfs.writeFile('/mount/file.txt', 'data');
      await cfs.mkdir('/mount/sub');

      const entries = await cfs.readdir('/mount');
      expect(entries.some(e => e.name === 'file.txt' && e.type === 'file')).toBe(true);
      expect(entries.some(e => e.name === 'sub' && e.type === 'directory')).toBe(true);
    });

    it('should return virtual entries for root, not delegate', async () => {
      // Root is virtual — readdir should return mount names, not filesystem contents
      const entries = await cfs.readdir('/');
      expect(entries).toHaveLength(1);
      expect(entries[0]?.name).toBe('mount');
      expect(entries[0]?.type).toBe('directory');
    });

    it('should delegate readdir on subdirectory within mount', async () => {
      await cfs.mkdir('/mount/sub');
      await cfs.writeFile('/mount/sub/deep.txt', 'deep');

      const entries = await cfs.readdir('/mount/sub');
      expect(entries).toHaveLength(1);
      expect(entries[0]?.name).toBe('deep.txt');
    });
  });

  // ===========================================================================
  // 14. stat Delegation for Files Inside Mounts
  // ===========================================================================
  describe('stat delegation', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(async () => {
      cfs = new CompositeFilesystem({
        mounts: { '/data': localA },
      });
      await cfs.init();
    });

    it('should return full stat from underlying fs for a file', async () => {
      await cfs.writeFile('/data/readme.md', '# Hello');
      const stat = await cfs.stat('/data/readme.md');

      expect(stat.type).toBe('file');
      expect(stat.name).toBe('readme.md');
      expect(stat.size).toBe(7);
      expect(stat.createdAt).toBeInstanceOf(Date);
      expect(stat.modifiedAt).toBeInstanceOf(Date);
    });

    it('should return full stat from underlying fs for a directory', async () => {
      await cfs.mkdir('/data/subdir');
      const stat = await cfs.stat('/data/subdir');

      expect(stat.type).toBe('directory');
      expect(stat.name).toBe('subdir');
    });

    it('should return synthetic stat for mount root', async () => {
      const stat = await cfs.stat('/data');
      expect(stat.type).toBe('directory');
      expect(stat.name).toBe('data');
      expect(stat.size).toBe(0);
    });
  });

  // ===========================================================================
  // 15. exists Edge Cases
  // ===========================================================================
  describe('exists edge cases', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(async () => {
      cfs = new CompositeFilesystem({
        mounts: { '/data': localA },
      });
      await cfs.init();
    });

    it('should return false for non-existent file within valid mount', async () => {
      expect(await cfs.exists('/data/nonexistent.txt')).toBe(false);
    });

    it('should return true for mount root even without init', async () => {
      const fresh = new CompositeFilesystem({ mounts: { '/m': localB } });
      expect(await fresh.exists('/m')).toBe(true);
    });

    it('should return true for root even with single mount', async () => {
      expect(await cfs.exists('/')).toBe(true);
    });
  });

  // ===========================================================================
  // 16. Cross-Mount overwrite:false
  // ===========================================================================
  describe('cross-mount overwrite:false', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(async () => {
      cfs = new CompositeFilesystem({
        mounts: { '/a': localA, '/b': localB },
      });
      await cfs.init();
    });

    it('should reject cross-mount copy when dest exists and overwrite is false', async () => {
      await cfs.writeFile('/a/src.txt', 'source');
      await cfs.writeFile('/b/src.txt', 'existing');

      await expect(cfs.copyFile('/a/src.txt', '/b/src.txt', { overwrite: false })).rejects.toThrow();
    });

    it('should allow cross-mount copy when overwrite is true (default)', async () => {
      await cfs.writeFile('/a/src.txt', 'new');
      await cfs.writeFile('/b/src.txt', 'old');

      await cfs.copyFile('/a/src.txt', '/b/src.txt');
      expect(await cfs.readFile('/b/src.txt', { encoding: 'utf-8' })).toBe('new');
    });
  });

  // ===========================================================================
  // 17. readdir with Options Through Composite
  // ===========================================================================
  describe('readdir with options', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(async () => {
      cfs = new CompositeFilesystem({
        mounts: { '/data': localA },
      });
      await cfs.init();
    });

    it('should support recursive readdir through mount', async () => {
      await cfs.writeFile('/data/top.txt', 'top');
      await cfs.writeFile('/data/sub/deep.txt', 'deep');

      const entries = await cfs.readdir('/data', { recursive: true });
      const names = entries.map(e => e.name).sort();
      expect(names).toContain('top.txt');
      expect(names).toContain('sub/deep.txt');
    });

    it('should support extension filter through mount', async () => {
      await cfs.writeFile('/data/code.ts', 'const x = 1');
      await cfs.writeFile('/data/readme.md', '# Hi');

      const tsOnly = await cfs.readdir('/data', { extension: '.ts' });
      expect(tsOnly).toHaveLength(1);
      expect(tsOnly[0]?.name).toBe('code.ts');
    });
  });

  // ===========================================================================
  // 18. deleteFile and rmdir with Options
  // ===========================================================================
  describe('deleteFile and rmdir with options', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(async () => {
      cfs = new CompositeFilesystem({
        mounts: { '/data': localA },
      });
      await cfs.init();
    });

    it('should not throw on deleteFile with force for non-existent file', async () => {
      await expect(cfs.deleteFile('/data/ghost.txt', { force: true })).resolves.not.toThrow();
    });

    it('should remove non-empty directory with recursive rmdir', async () => {
      await cfs.writeFile('/data/dir/file.txt', 'content');
      await cfs.rmdir('/data/dir', { recursive: true, force: true });
      expect(await cfs.exists('/data/dir')).toBe(false);
    });
  });

  // ===========================================================================
  // 19. Mounts Getter
  // ===========================================================================
  describe('mounts getter', () => {
    it('should expose all mounts via readonly map', () => {
      const cfs = new CompositeFilesystem({
        mounts: { '/a': localA, '/b': localB },
      });

      expect(cfs.mounts.size).toBe(2);
      expect(cfs.mounts.get('/a')).toBe(localA);
      expect(cfs.mounts.get('/b')).toBe(localB);
    });

    it('should expose mount paths as array', () => {
      const cfs = new CompositeFilesystem({
        mounts: { '/x': localA, '/y': localB },
      });

      expect(cfs.mountPaths.sort()).toEqual(['/x', '/y']);
    });
  });

  // ===========================================================================
  // 20. writeFile with overwrite:false
  // ===========================================================================
  describe('writeFile overwrite:false', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(async () => {
      cfs = new CompositeFilesystem({
        mounts: { '/data': localA },
      });
      await cfs.init();
    });

    it('should reject write when file exists and overwrite is false', async () => {
      await cfs.writeFile('/data/existing.txt', 'original');
      await expect(cfs.writeFile('/data/existing.txt', 'new', { overwrite: false })).rejects.toThrow();
    });

    it('should allow write when file does not exist and overwrite is false', async () => {
      await cfs.writeFile('/data/new.txt', 'content', { overwrite: false });
      expect(await cfs.readFile('/data/new.txt', { encoding: 'utf-8' })).toBe('content');
    });
  });

  // ===========================================================================
  // 21. No-Mount Error Paths
  // ===========================================================================
  describe('no-mount error paths', () => {
    let cfs: CompositeFilesystem<any>;

    beforeEach(async () => {
      cfs = new CompositeFilesystem({ mounts: { '/data': localA } });
      await cfs.init();
    });

    it('should throw on readFile for unmounted path', async () => {
      await expect(cfs.readFile('/unknown/file.txt')).rejects.toThrow('No mount for path');
    });

    it('should throw on writeFile for unmounted path', async () => {
      await expect(cfs.writeFile('/unknown/file.txt', 'data')).rejects.toThrow('No mount for path');
    });

    it('should throw on appendFile for unmounted path', async () => {
      await expect(cfs.appendFile('/unknown/file.txt', 'data')).rejects.toThrow('No mount for path');
    });

    it('should throw on deleteFile for unmounted path', async () => {
      await expect(cfs.deleteFile('/unknown/file.txt')).rejects.toThrow('No mount for path');
    });

    it('should throw on mkdir for unmounted path', async () => {
      await expect(cfs.mkdir('/unknown/dir')).rejects.toThrow('No mount for path');
    });

    it('should throw on rmdir for unmounted path', async () => {
      await expect(cfs.rmdir('/unknown/dir')).rejects.toThrow('No mount for path');
    });

    it('should throw on readdir for unmounted path', async () => {
      await expect(cfs.readdir('/unknown/dir')).rejects.toThrow('No mount for path');
    });

    it('should return false on exists for unmounted path', async () => {
      expect(await cfs.exists('/unknown/file.txt')).toBe(false);
    });

    it('should throw on stat for unmounted path', async () => {
      await expect(cfs.stat('/unknown/file.txt')).rejects.toThrow('No mount for path');
    });
  });
});
