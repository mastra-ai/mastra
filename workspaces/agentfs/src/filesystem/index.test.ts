/**
 * AgentFS Filesystem Unit Tests
 *
 * Tests constructor, getInfo, getInstructions, lifecycle, type-checks,
 * read-only enforcement, and error mapping.
 * No mocks — these tests hit the real agentfs-sdk.
 */

import os from 'node:os';
import nodePath from 'node:path';
import {
  FileNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
  WorkspaceReadOnlyError,
} from '@mastra/core/workspace';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { AgentFSFilesystem } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Constructor & metadata (no SDK needed)
// ---------------------------------------------------------------------------

describe('AgentFSFilesystem', () => {
  describe('Constructor & Options', () => {
    it('throws if no agentId, path, or agent provided', () => {
      expect(() => new AgentFSFilesystem({} as any)).toThrow(/requires at least one of/);
    });

    it('generates unique id if not provided', () => {
      const fs1 = new AgentFSFilesystem({ agentId: 'test' });
      const fs2 = new AgentFSFilesystem({ agentId: 'test' });

      expect(fs1.id).toMatch(/^agentfs-/);
      expect(fs2.id).toMatch(/^agentfs-/);
      expect(fs1.id).not.toBe(fs2.id);
    });

    it('uses provided id', () => {
      const fs = new AgentFSFilesystem({ id: 'my-id', agentId: 'test' });
      expect(fs.id).toBe('my-id');
    });

    it('has correct provider and name', () => {
      const fs = new AgentFSFilesystem({ agentId: 'test' });
      expect(fs.provider).toBe('agentfs');
      expect(fs.name).toBe('AgentFSFilesystem');
    });

    it('defaults icon to database and displayName to AgentFS', () => {
      const fs = new AgentFSFilesystem({ agentId: 'test' });
      expect(fs.icon).toBe('database');
      expect(fs.displayName).toBe('AgentFS');
    });

    it('accepts custom icon, displayName, and description', () => {
      const fs = new AgentFSFilesystem({
        agentId: 'test',
        icon: 'folder',
        displayName: 'Custom FS',
        description: 'A custom filesystem',
      });
      expect(fs.icon).toBe('folder');
      expect(fs.displayName).toBe('Custom FS');
      expect(fs.description).toBe('A custom filesystem');
    });

    it('sets readOnly from options', () => {
      const fsRO = new AgentFSFilesystem({ agentId: 'test', readOnly: true });
      const fsDef = new AgentFSFilesystem({ agentId: 'test' });
      expect(fsRO.readOnly).toBe(true);
      expect(fsDef.readOnly).toBeUndefined();
    });
  });

  describe('Path resolution', () => {
    it('resolves relative path to absolute', () => {
      const fs = new AgentFSFilesystem({ path: './data/test.db' });
      const info = fs.getInfo();
      expect(info.metadata?.dbPath).toBe(nodePath.resolve('./data/test.db'));
    });

    it('expands tilde in path', () => {
      const fs = new AgentFSFilesystem({ path: '~/agentfs/test.db' });
      const info = fs.getInfo();
      expect(info.metadata?.dbPath).toBe(nodePath.join(os.homedir(), 'agentfs/test.db'));
    });

    it('keeps absolute path as-is', () => {
      const fs = new AgentFSFilesystem({ path: '/tmp/test.db' });
      expect(fs.getInfo().metadata?.dbPath).toBe('/tmp/test.db');
    });

    it('resolves bare filename to absolute', () => {
      const fs = new AgentFSFilesystem({ path: 'mydb.db' });
      expect(fs.getInfo().metadata?.dbPath).toBe(nodePath.resolve('mydb.db'));
    });

    it('resolves parent traversal', () => {
      const fs = new AgentFSFilesystem({ path: '../sibling/test.db' });
      expect(fs.getInfo().metadata?.dbPath).toBe(nodePath.resolve('../sibling/test.db'));
    });

    it('does not resolve agentId (left to SDK)', () => {
      const fs = new AgentFSFilesystem({ agentId: 'my-agent' });
      const info = fs.getInfo();
      expect(info.metadata?.dbPath).toBeUndefined();
      expect(info.metadata?.agentId).toBe('my-agent');
    });
  });

  describe('getInfo()', () => {
    it('includes agentId in metadata', () => {
      const fs = new AgentFSFilesystem({ id: 'test-id', agentId: 'my-agent' });
      const info = fs.getInfo();

      expect(info.id).toBe('test-id');
      expect(info.provider).toBe('agentfs');
      expect(info.icon).toBe('database');
      expect(info.metadata?.agentId).toBe('my-agent');
    });

    it('includes dbPath in metadata when set', () => {
      const fs = new AgentFSFilesystem({ path: '/tmp/test.db' });
      expect(fs.getInfo().metadata?.dbPath).toBe('/tmp/test.db');
    });

    it('excludes unset metadata fields', () => {
      const fs = new AgentFSFilesystem({ agentId: 'test' });
      expect(fs.getInfo().metadata?.dbPath).toBeUndefined();
    });

    it('reflects readOnly in info', () => {
      const fs = new AgentFSFilesystem({ agentId: 'test', readOnly: true });
      expect(fs.getInfo().readOnly).toBe(true);
    });

    it('reports current status', () => {
      const fs = new AgentFSFilesystem({ agentId: 'test' });
      expect(fs.getInfo().status).toBe('pending');
    });
  });

  describe('getInstructions()', () => {
    it('includes agent label and access mode', () => {
      const fs = new AgentFSFilesystem({ agentId: 'my-agent' });
      expect(fs.getInstructions()).toContain('my-agent');
      expect(fs.getInstructions()).toContain('Persistent');
    });

    it('indicates read-only when set', () => {
      const fs = new AgentFSFilesystem({ agentId: 'test', readOnly: true });
      expect(fs.getInstructions()).toContain('Read-only');
    });

    it('uses generic label when only path is set', () => {
      const fs = new AgentFSFilesystem({ path: '/tmp/test.db' });
      expect(fs.getInstructions()).toContain('database');
    });
  });

  // ---------------------------------------------------------------------------
  // Tests that need a live SDK instance
  // ---------------------------------------------------------------------------

  describe('Lifecycle', () => {
    it('init sets status to ready, destroy sets destroyed', async () => {
      const fs = new AgentFSFilesystem({ agentId: uniqueId('lifecycle') });
      expect(fs.status).toBe('pending');

      await fs._init();
      expect(fs.status).toBe('ready');

      await fs._destroy();
      expect(fs.status).toBe('destroyed');
    });

    it('skips open for pre-opened agent and does not close on destroy', async () => {
      const owner = new AgentFSFilesystem({ agentId: uniqueId('pre-opened') });
      await owner._init();

      const borrower = new AgentFSFilesystem({ agent: owner.agent! });
      await borrower._init();
      expect(borrower.status).toBe('ready');

      // Borrower destroy should not close the underlying agent
      await borrower._destroy();
      expect(borrower.status).toBe('destroyed');

      // Owner should still work
      await owner.writeFile('/still-alive.txt', 'yes');
      const content = await owner.readFile('/still-alive.txt', { encoding: 'utf-8' });
      expect(content).toBe('yes');

      await owner._destroy();
    });

    it('exposes agent after init', async () => {
      const fs = new AgentFSFilesystem({ agentId: uniqueId('agent-access') });
      expect(fs.agent).toBeNull();

      await fs._init();
      expect(fs.agent).not.toBeNull();

      await fs._destroy();
    });
  });

  // ---------------------------------------------------------------------------
  // isFile / isDirectory
  // ---------------------------------------------------------------------------

  describe('isFile() / isDirectory()', () => {
    let fs: AgentFSFilesystem;

    beforeAll(async () => {
      fs = new AgentFSFilesystem({ agentId: uniqueId('type-checks') });
      await fs._init();
      await fs.writeFile('/test-file.txt', 'hello');
      await fs.mkdir('/test-dir');
    });

    afterAll(async () => {
      await fs._destroy();
    });

    it('isFile returns true for a file', async () => {
      expect(await fs.isFile('/test-file.txt')).toBe(true);
    });

    it('isFile returns false for a directory', async () => {
      expect(await fs.isFile('/test-dir')).toBe(false);
    });

    it('isFile returns false for non-existent path', async () => {
      expect(await fs.isFile('/does-not-exist.txt')).toBe(false);
    });

    it('isDirectory returns true for a directory', async () => {
      expect(await fs.isDirectory('/test-dir')).toBe(true);
    });

    it('isDirectory returns false for a file', async () => {
      expect(await fs.isDirectory('/test-file.txt')).toBe(false);
    });

    it('isDirectory returns false for non-existent path', async () => {
      expect(await fs.isDirectory('/does-not-exist')).toBe(false);
    });

    it('isDirectory returns true for root', async () => {
      expect(await fs.isDirectory('/')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Read-only enforcement
  // ---------------------------------------------------------------------------

  describe('Read-only mode', () => {
    let fs: AgentFSFilesystem;

    beforeAll(async () => {
      // Create a writable instance to set up test data, then use read-only
      const setup = new AgentFSFilesystem({ agentId: uniqueId('readonly') });
      await setup._init();
      await setup.writeFile('/existing.txt', 'data');
      await setup.mkdir('/existing-dir');

      // Create read-only instance sharing the same agent
      fs = new AgentFSFilesystem({ agent: setup.agent!, readOnly: true });
      await fs._init();
    });

    afterAll(async () => {
      await fs._destroy();
    });

    it('allows readFile', async () => {
      const content = await fs.readFile('/existing.txt', { encoding: 'utf-8' });
      expect(content).toBe('data');
    });

    it('allows exists', async () => {
      expect(await fs.exists('/existing.txt')).toBe(true);
    });

    it('allows stat', async () => {
      const st = await fs.stat('/existing.txt');
      expect(st.type).toBe('file');
    });

    it('allows readdir', async () => {
      const entries = await fs.readdir('/');
      expect(entries.length).toBeGreaterThan(0);
    });

    it('allows isFile / isDirectory', async () => {
      expect(await fs.isFile('/existing.txt')).toBe(true);
      expect(await fs.isDirectory('/existing-dir')).toBe(true);
    });

    it('blocks writeFile', async () => {
      await expect(fs.writeFile('/new.txt', 'nope')).rejects.toThrow(WorkspaceReadOnlyError);
    });

    it('blocks appendFile', async () => {
      await expect(fs.appendFile('/existing.txt', 'more')).rejects.toThrow(WorkspaceReadOnlyError);
    });

    it('blocks deleteFile', async () => {
      await expect(fs.deleteFile('/existing.txt')).rejects.toThrow(WorkspaceReadOnlyError);
    });

    it('blocks mkdir', async () => {
      await expect(fs.mkdir('/new-dir')).rejects.toThrow(WorkspaceReadOnlyError);
    });

    it('blocks rmdir', async () => {
      await expect(fs.rmdir('/existing-dir')).rejects.toThrow(WorkspaceReadOnlyError);
    });

    it('blocks copyFile', async () => {
      await expect(fs.copyFile('/existing.txt', '/copy.txt')).rejects.toThrow(WorkspaceReadOnlyError);
    });

    it('blocks moveFile', async () => {
      await expect(fs.moveFile('/existing.txt', '/moved.txt')).rejects.toThrow(WorkspaceReadOnlyError);
    });
  });

  // ---------------------------------------------------------------------------
  // Error mapping
  // ---------------------------------------------------------------------------

  describe('Error mapping', () => {
    let fs: AgentFSFilesystem;

    beforeAll(async () => {
      fs = new AgentFSFilesystem({ agentId: uniqueId('errors') });
      await fs._init();
      await fs.writeFile('/a-file.txt', 'content');
      await fs.mkdir('/a-dir');
    });

    afterAll(async () => {
      await fs._destroy();
    });

    it('readFile on missing path throws FileNotFoundError', async () => {
      await expect(fs.readFile('/missing.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('writeFile with overwrite=false on existing file throws FileExistsError', async () => {
      await expect(fs.writeFile('/a-file.txt', 'new', { overwrite: false })).rejects.toThrow(FileExistsError);
    });

    it('deleteFile on missing path throws FileNotFoundError', async () => {
      await expect(fs.deleteFile('/missing.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('deleteFile with force on missing path succeeds', async () => {
      await expect(fs.deleteFile('/missing.txt', { force: true })).resolves.toBeUndefined();
    });

    it('deleteFile on a directory throws IsDirectoryError', async () => {
      await expect(fs.deleteFile('/a-dir')).rejects.toThrow(IsDirectoryError);
    });

    it('readdir on a file throws NotDirectoryError', async () => {
      await expect(fs.readdir('/a-file.txt')).rejects.toThrow(NotDirectoryError);
    });

    it('rmdir on non-empty directory without recursive throws DirectoryNotEmptyError', async () => {
      await fs.writeFile('/a-dir/child.txt', 'child');
      await expect(fs.rmdir('/a-dir')).rejects.toThrow(DirectoryNotEmptyError);
    });

    it('stat on missing path throws FileNotFoundError', async () => {
      await expect(fs.stat('/missing')).rejects.toThrow(FileNotFoundError);
    });
  });

  // ---------------------------------------------------------------------------
  // appendFile
  // ---------------------------------------------------------------------------

  describe('appendFile', () => {
    let fs: AgentFSFilesystem;

    beforeAll(async () => {
      fs = new AgentFSFilesystem({ agentId: uniqueId('append') });
      await fs._init();
    });

    afterAll(async () => {
      await fs._destroy();
    });

    it('creates file if it does not exist', async () => {
      await fs.appendFile('/new-append.txt', 'first');
      const content = await fs.readFile('/new-append.txt', { encoding: 'utf-8' });
      expect(content).toBe('first');
    });

    it('appends to existing file', async () => {
      await fs.writeFile('/append-target.txt', 'hello');
      await fs.appendFile('/append-target.txt', ' world');
      const content = await fs.readFile('/append-target.txt', { encoding: 'utf-8' });
      expect(content).toBe('hello world');
    });

    it('preserves binary data when appending', async () => {
      const first = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      const second = Buffer.from([0xde, 0xad, 0xbe, 0xef]);

      await fs.writeFile('/binary.bin', first);
      await fs.appendFile('/binary.bin', second);

      const result = await fs.readFile('/binary.bin');
      const buf = Buffer.isBuffer(result) ? result : Buffer.from(result);
      expect(buf).toEqual(Buffer.concat([first, second]));
    });
  });

  // ---------------------------------------------------------------------------
  // stat
  // ---------------------------------------------------------------------------

  describe('stat()', () => {
    let fs: AgentFSFilesystem;

    beforeAll(async () => {
      fs = new AgentFSFilesystem({ agentId: uniqueId('stat') });
      await fs._init();
      await fs.writeFile('/stat-file.txt', 'hello world');
      await fs.mkdir('/stat-dir');
    });

    afterAll(async () => {
      await fs._destroy();
    });

    it('returns file metadata', async () => {
      const st = await fs.stat('/stat-file.txt');
      expect(st.name).toBe('stat-file.txt');
      expect(st.path).toBe('/stat-file.txt');
      expect(st.type).toBe('file');
      expect(st.size).toBeGreaterThan(0);
      expect(st.createdAt).toBeInstanceOf(Date);
      expect(st.modifiedAt).toBeInstanceOf(Date);
    });

    it('returns directory metadata', async () => {
      const st = await fs.stat('/stat-dir');
      expect(st.name).toBe('stat-dir');
      expect(st.type).toBe('directory');
    });

    it('returns correct name for nested paths', async () => {
      await fs.writeFile('/stat-dir/nested.txt', 'data');
      const st = await fs.stat('/stat-dir/nested.txt');
      expect(st.name).toBe('nested.txt');
      expect(st.path).toBe('/stat-dir/nested.txt');
    });
  });
});
