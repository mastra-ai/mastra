import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import {
  createWorkspace,
  createLocalWorkspace,
  createMemoryWorkspace,
} from './workspace';
import type { Workspace } from './types';
import { FilesystemNotAvailableError, ExecutorNotAvailableError } from './types';

describe('Workspace', () => {
  describe('createMemoryWorkspace', () => {
    let workspace: Workspace;

    beforeEach(async () => {
      workspace = await createMemoryWorkspace({
        id: 'test-workspace',
        name: 'Test Workspace',
        scope: 'thread',
        agentId: 'test-agent',
        threadId: 'test-thread',
      });
    });

    afterEach(async () => {
      await workspace.destroy();
    });

    it('should create a workspace with memory filesystem', async () => {
      expect(workspace.id).toBe('test-workspace');
      expect(workspace.name).toBe('Test Workspace');
      expect(workspace.scope).toBe('thread');
      expect(workspace.fs).toBeDefined();
      expect(workspace.executor).toBeUndefined();
    });

    it('should read and write files', async () => {
      await workspace.writeFile('/test.txt', 'Hello, Workspace!');
      const content = await workspace.readFile('/test.txt', { encoding: 'utf-8' });
      expect(content).toBe('Hello, Workspace!');
    });

    it('should list directory contents', async () => {
      await workspace.writeFile('/dir/file1.txt', 'content1');
      await workspace.writeFile('/dir/file2.txt', 'content2');

      const entries = await workspace.readdir('/dir');
      expect(entries).toHaveLength(2);
    });

    it('should check file existence', async () => {
      await workspace.writeFile('/exists.txt', 'content');
      expect(await workspace.exists('/exists.txt')).toBe(true);
      expect(await workspace.exists('/not-exists.txt')).toBe(false);
    });

    it('should throw ExecutorNotAvailableError when executing code without executor', async () => {
      await expect(workspace.executeCode('console.log("test")')).rejects.toThrow(
        ExecutorNotAvailableError,
      );
    });

    it('should support state operations', async () => {
      const state = workspace.state!;

      await state.set('myKey', { value: 42 });
      const result = await state.get<{ value: number }>('myKey');
      expect(result).toEqual({ value: 42 });

      expect(await state.has('myKey')).toBe(true);
      expect(await state.has('otherKey')).toBe(false);

      const keys = await state.keys();
      expect(keys).toContain('myKey');

      await state.delete('myKey');
      expect(await state.has('myKey')).toBe(false);
    });

    it('should conform to Workspace interface', () => {
      expect(workspace.id).toBeDefined();
      expect(workspace.name).toBeDefined();
      expect(workspace.scope).toBeDefined();
      expect(workspace.owner).toBeDefined();
      expect(workspace.status).toBeDefined();
      expect(workspace.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('createMemoryWorkspace with executor', () => {
    let workspace: Workspace;

    beforeEach(async () => {
      workspace = await createMemoryWorkspace({
        id: 'test-workspace-exec',
        scope: 'thread',
        withExecutor: true,
      });
    });

    afterEach(async () => {
      await workspace.destroy();
    });

    it('should have both filesystem and executor', () => {
      expect(workspace.fs).toBeDefined();
      expect(workspace.executor).toBeDefined();
    });

    it('should execute code', async () => {
      const result = await workspace.executeCode('console.log("Hello from workspace")', {
        runtime: 'node',
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('Hello from workspace');
    });

    it('should execute commands', async () => {
      const result = await workspace.executeCommand('echo', ['Hello from command']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('Hello from command');
    });
  });

  describe('createLocalWorkspace', () => {
    let workspace: Workspace;
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-test-'));
      workspace = await createLocalWorkspace({
        id: 'local-workspace',
        name: 'Local Workspace',
        basePath: tempDir,
        scope: 'agent',
        agentId: 'test-agent',
      });
    });

    afterEach(async () => {
      await workspace.destroy();
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should create a workspace with local filesystem', () => {
      expect(workspace.id).toBe('local-workspace');
      expect(workspace.fs).toBeDefined();
      expect(workspace.executor).toBeDefined();
    });

    it('should write files to disk', async () => {
      await workspace.writeFile('/test.txt', 'Hello, Local!');

      // Verify file exists on disk
      const diskContent = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(diskContent).toBe('Hello, Local!');
    });

    it('should read files from disk', async () => {
      // Write directly to disk
      await fs.writeFile(path.join(tempDir, 'disk-file.txt'), 'From disk');

      // Read via workspace
      const content = await workspace.readFile('/disk-file.txt', { encoding: 'utf-8' });
      expect(content).toBe('From disk');
    });

    it('should execute code with local executor', async () => {
      const result = await workspace.executeCode('console.log("Local execution")', {
        runtime: 'node',
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('Local execution');
    });
  });

  describe('workspace snapshots', () => {
    let workspace: Workspace;

    beforeEach(async () => {
      workspace = await createMemoryWorkspace({
        id: 'snapshot-workspace',
        scope: 'thread',
      });
    });

    afterEach(async () => {
      await workspace.destroy();
    });

    it('should create and restore snapshots', async () => {
      // Create some files
      await workspace.writeFile('/file1.txt', 'content1');
      await workspace.writeFile('/dir/file2.txt', 'content2');

      // Take snapshot
      const snapshot = await workspace.snapshot!({ name: 'test-snapshot' });
      expect(snapshot.name).toBe('test-snapshot');
      expect(snapshot.size).toBeGreaterThan(0);

      // Modify files
      await workspace.writeFile('/file1.txt', 'modified');
      await workspace.writeFile('/file3.txt', 'new file');

      // Restore snapshot
      await workspace.restore!(snapshot);

      // Verify restoration
      const content1 = await workspace.readFile('/file1.txt', { encoding: 'utf-8' });
      expect(content1).toBe('content1');

      const content2 = await workspace.readFile('/dir/file2.txt', { encoding: 'utf-8' });
      expect(content2).toBe('content2');

      // file3 should not exist after restore
      expect(await workspace.exists('/file3.txt')).toBe(false);
    });

    it('should merge snapshots when option is set', async () => {
      await workspace.writeFile('/file1.txt', 'original');
      const snapshot = await workspace.snapshot!();

      await workspace.writeFile('/file2.txt', 'new file');
      await workspace.writeFile('/file1.txt', 'modified');

      await workspace.restore!(snapshot, { merge: true });

      // file1 should be restored
      expect(await workspace.readFile('/file1.txt', { encoding: 'utf-8' })).toBe('original');
      // file2 should still exist (merge mode)
      expect(await workspace.exists('/file2.txt')).toBe(true);
    });
  });

  describe('workspace info', () => {
    it('should return workspace information', async () => {
      const workspace = await createMemoryWorkspace({
        id: 'info-workspace',
        name: 'Info Workspace',
        scope: 'agent',
        agentId: 'test-agent',
        withExecutor: true,
      });

      try {
        const info = await workspace.getInfo();

        expect(info.id).toBe('info-workspace');
        expect(info.name).toBe('Info Workspace');
        expect(info.scope).toBe('agent');
        expect(info.status).toBe('ready');
        expect(info.filesystem).toBeDefined();
        expect(info.filesystem?.provider).toBe('memory');
        expect(info.executor).toBeDefined();
        expect(info.executor?.provider).toBe('local');
      } finally {
        await workspace.destroy();
      }
    });
  });

  describe('workspace lifecycle', () => {
    it('should track status through lifecycle', async () => {
      const workspace = await createMemoryWorkspace({
        id: 'lifecycle-workspace',
        scope: 'thread',
      });

      expect(workspace.status).toBe('ready');

      await workspace.destroy();
      expect(workspace.status).toBe('destroyed');
    });

    it('should update lastAccessedAt on operations', async () => {
      const workspace = await createMemoryWorkspace({
        id: 'access-workspace',
        scope: 'thread',
      });

      const initialAccess = workspace.lastAccessedAt;

      // Wait a bit and perform an operation
      await new Promise((r) => setTimeout(r, 10));
      await workspace.writeFile('/test.txt', 'content');

      expect(workspace.lastAccessedAt.getTime()).toBeGreaterThanOrEqual(
        initialAccess.getTime(),
      );

      await workspace.destroy();
    });
  });

  describe('factory functions return interface types', () => {
    it('createMemoryWorkspace returns Workspace interface', async () => {
      const workspace: Workspace = await createMemoryWorkspace({ scope: 'thread' });
      // TypeScript will fail if this doesn't match the interface
      expect(workspace.readFile).toBeInstanceOf(Function);
      expect(workspace.writeFile).toBeInstanceOf(Function);
      expect(workspace.executeCode).toBeInstanceOf(Function);
      await workspace.destroy();
    });

    it('createLocalWorkspace returns Workspace interface', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-'));
      const workspace: Workspace = await createLocalWorkspace({
        basePath: tempDir,
        scope: 'agent',
      });
      expect(workspace.readFile).toBeInstanceOf(Function);
      await workspace.destroy();
      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });
});
