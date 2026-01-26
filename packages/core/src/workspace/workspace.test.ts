import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  WorkspaceError,
  FilesystemNotAvailableError,
  SandboxNotAvailableError,
  SearchNotAvailableError,
} from './errors';
import { LocalFilesystem } from './local-filesystem';
import { LocalSandbox } from './local-sandbox';
import { Workspace } from './workspace';

// =============================================================================
// Tests
// =============================================================================

describe('Workspace', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ===========================================================================
  // Constructor
  // ===========================================================================
  describe('constructor', () => {
    it('should create workspace with filesystem only', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({ filesystem });

      expect(workspace.id).toBeDefined();
      expect(workspace.name).toContain('workspace-');
      expect(workspace.status).toBe('pending');
      expect(workspace.filesystem).toBe(filesystem);
      expect(workspace.sandbox).toBeUndefined();
    });

    it('should create workspace with sandbox only', () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ sandbox });

      expect(workspace.sandbox).toBe(sandbox);
      expect(workspace.filesystem).toBeUndefined();
    });

    it('should create workspace with both filesystem and sandbox', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ filesystem, sandbox });

      expect(workspace.filesystem).toBe(filesystem);
      expect(workspace.sandbox).toBe(sandbox);
    });

    it('should accept custom id and name', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        id: 'custom-id',
        name: 'Custom Workspace',
        filesystem,
      });

      expect(workspace.id).toBe('custom-id');
      expect(workspace.name).toBe('Custom Workspace');
    });

    it('should throw when neither filesystem nor sandbox nor skillsPaths provided', () => {
      expect(() => new Workspace({})).toThrow('Workspace requires at least a filesystem, sandbox, or skillsPaths');
    });

    it('should auto-initialize when autoInit is true', async () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        autoInit: true,
      });

      // Give time for async init
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(workspace.status).toBe('ready');
    });
  });

  // ===========================================================================
  // File Operations
  // ===========================================================================
  describe('file operations', () => {
    it('should read file from filesystem', async () => {
      // Create a test file
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');

      const filesystem = new LocalFilesystem({
        basePath: tempDir,
        safety: { requireReadBeforeWrite: false },
      });
      const workspace = new Workspace({ filesystem });

      const content = await workspace.readFile('/test.txt');
      expect(content.toString()).toBe('Hello World');
    });

    it('should write file to filesystem', async () => {
      const filesystem = new LocalFilesystem({
        basePath: tempDir,
        safety: { requireReadBeforeWrite: false },
      });
      const workspace = new Workspace({ filesystem });

      await workspace.writeFile('/test.txt', 'Hello World');

      const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(content).toBe('Hello World');
    });

    it('should list directory contents', async () => {
      // Create test files
      await fs.mkdir(path.join(tempDir, 'dir'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'dir', 'file.txt'), 'content');

      const filesystem = new LocalFilesystem({
        basePath: tempDir,
        safety: { requireReadBeforeWrite: false },
      });
      const workspace = new Workspace({ filesystem });

      const entries = await workspace.readdir('/dir');
      expect(entries).toHaveLength(1);
      expect(entries[0]?.name).toBe('file.txt');
    });

    it('should check if path exists', async () => {
      await fs.writeFile(path.join(tempDir, 'exists.txt'), 'content');

      const filesystem = new LocalFilesystem({
        basePath: tempDir,
        safety: { requireReadBeforeWrite: false },
      });
      const workspace = new Workspace({ filesystem });

      expect(await workspace.exists('/exists.txt')).toBe(true);
      expect(await workspace.exists('/notexists.txt')).toBe(false);
    });

    it('should update lastAccessedAt on file operations', async () => {
      const filesystem = new LocalFilesystem({
        basePath: tempDir,
        safety: { requireReadBeforeWrite: false },
      });
      const workspace = new Workspace({ filesystem });

      const initialAccess = workspace.lastAccessedAt;
      await new Promise(resolve => setTimeout(resolve, 5));

      await workspace.writeFile('/test.txt', 'content');
      expect(workspace.lastAccessedAt.getTime()).toBeGreaterThan(initialAccess.getTime());
    });

    it('should throw FilesystemNotAvailableError when no filesystem', async () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const sandboxOnly = new Workspace({ sandbox });

      await expect(sandboxOnly.readFile('/test.txt')).rejects.toThrow(FilesystemNotAvailableError);
      await expect(sandboxOnly.writeFile('/test.txt', 'content')).rejects.toThrow(FilesystemNotAvailableError);
      await expect(sandboxOnly.readdir('/')).rejects.toThrow(FilesystemNotAvailableError);
      await expect(sandboxOnly.exists('/test.txt')).rejects.toThrow(FilesystemNotAvailableError);
    });
  });

  // ===========================================================================
  // Sandbox Operations
  // ===========================================================================
  describe('sandbox operations', () => {
    it('should execute command in sandbox', async () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir, inheritEnv: true });
      const workspace = new Workspace({ sandbox });

      await workspace.init();
      const result = await workspace.executeCommand('echo', ['hello']);

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('hello');

      await workspace.destroy();
    });

    it('should throw SandboxNotAvailableError when no sandbox', async () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const fsOnly = new Workspace({ filesystem });

      await expect(fsOnly.executeCommand('cmd')).rejects.toThrow(SandboxNotAvailableError);
    });
  });

  // ===========================================================================
  // Search Operations
  // ===========================================================================
  describe('search operations', () => {
    it('should have canBM25=true when bm25 is enabled', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
      });

      expect(workspace.canBM25).toBe(true);
      expect(workspace.canVector).toBe(false);
      expect(workspace.canHybrid).toBe(false);
    });

    it('should have canBM25=false when bm25 not configured', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({ filesystem });

      expect(workspace.canBM25).toBe(false);
    });

    it('should index and search content', async () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
      });

      await workspace.index('/doc1.txt', 'The quick brown fox jumps over the lazy dog');
      await workspace.index('/doc2.txt', 'A lazy cat sleeps all day');

      const results = await workspace.search('lazy');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.id === '/doc1.txt')).toBe(true);
    });

    it('should throw SearchNotAvailableError when search not configured', async () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({ filesystem });

      await expect(workspace.index('/test', 'content')).rejects.toThrow(SearchNotAvailableError);
      await expect(workspace.search('query')).rejects.toThrow(SearchNotAvailableError);
    });

    it('should support search with topK and minScore options', async () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
      });

      await workspace.index('/doc1.txt', 'machine learning is great');
      await workspace.index('/doc2.txt', 'machine learning algorithms');
      await workspace.index('/doc3.txt', 'deep learning neural networks');

      const resultsTopK = await workspace.search('learning', { topK: 2 });
      expect(resultsTopK.length).toBe(2);

      const resultsAll = await workspace.search('learning');
      expect(resultsAll.length).toBe(3);
    });

    it('should return lineRange in search results', async () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
      });

      const content = `Line 1 introduction
Line 2 has machine learning
Line 3 conclusion`;

      await workspace.index('/doc.txt', content);

      const results = await workspace.search('machine');
      expect(results[0]?.lineRange).toEqual({ start: 2, end: 2 });
    });

    it('should support metadata in indexed documents', async () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
      });

      await workspace.index('/doc.txt', 'Test content', { metadata: { category: 'test', priority: 1 } });

      const results = await workspace.search('test');
      expect(results[0]?.metadata?.category).toBe('test');
      expect(results[0]?.metadata?.priority).toBe(1);
    });
  });

  // ===========================================================================
  // Skills
  // ===========================================================================
  describe('skills', () => {
    it('should return undefined when no skillsPaths configured', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({ filesystem });
      expect(workspace.skills).toBeUndefined();
    });

    it('should allow skills without filesystem (read-only mode)', () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({
        sandbox,
        skillsPaths: ['/skills'],
      });

      // Skills should be available via LocalSkillSource (read-only)
      expect(workspace.skills).toBeDefined();
      expect(workspace.skills?.isWritable).toBe(false);
    });

    it('should return undefined when no skillsPaths configured', () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ sandbox });
      expect(workspace.skills).toBeUndefined();
    });

    it('should return skills instance when skillsPaths and filesystem configured', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        skillsPaths: ['/skills'],
      });
      expect(workspace.skills).toBeDefined();
    });

    it('should return same skills instance on repeated access', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        skillsPaths: ['/skills'],
      });

      const skills1 = workspace.skills;
      const skills2 = workspace.skills;
      expect(skills1).toBe(skills2);
    });
  });

  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  describe('lifecycle', () => {
    it('should initialize workspace', async () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ filesystem, sandbox });

      await workspace.init();

      expect(workspace.status).toBe('ready');

      await workspace.destroy();
    });

    it('should destroy workspace', async () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ filesystem, sandbox });

      await workspace.init();
      await workspace.destroy();

      expect(workspace.status).toBe('destroyed');
    });
  });

  // ===========================================================================
  // Info
  // ===========================================================================
  describe('getInfo', () => {
    it('should return workspace info', async () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ filesystem, sandbox });

      const info = await workspace.getInfo();

      expect(info.id).toBe(workspace.id);
      expect(info.name).toBe(workspace.name);
      expect(info.status).toBe('pending');
      expect(info.filesystem?.provider).toBe('local');
      expect(info.sandbox?.provider).toBe('local');
    });

    it('should return info without sandbox when not configured', async () => {
      const filesystem = new LocalFilesystem({
        basePath: tempDir,
        safety: { requireReadBeforeWrite: false },
      });
      const workspace = new Workspace({ filesystem });

      const info = await workspace.getInfo();

      expect(info.filesystem).toBeDefined();
      expect(info.sandbox).toBeUndefined();
    });
  });

  // ===========================================================================
  // Path Context
  // ===========================================================================
  describe('getPathContext', () => {
    it('should return same-context for local filesystem + local sandbox with same path', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });

      const workspace = new Workspace({ filesystem, sandbox });

      const context = workspace.getPathContext();

      expect(context.type).toBe('same-context');
      expect(context.requiresSync).toBe(false);
      expect(context.filesystem?.provider).toBe('local');
      expect(context.sandbox?.provider).toBe('local');
    });

    it('should return filesystem-only when no sandbox configured', () => {
      const filesystem = new LocalFilesystem({
        basePath: tempDir,
        safety: { requireReadBeforeWrite: false },
      });
      const workspace = new Workspace({ filesystem });

      const context = workspace.getPathContext();

      expect(context.type).toBe('filesystem-only');
      expect(context.requiresSync).toBe(false);
      expect(context.filesystem?.provider).toBe('local');
      expect(context.sandbox).toBeUndefined();
    });

    it('should return sandbox-only when no filesystem configured', () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ sandbox });

      const context = workspace.getPathContext();

      expect(context.type).toBe('sandbox-only');
      expect(context.requiresSync).toBe(false);
      expect(context.filesystem).toBeUndefined();
      expect(context.sandbox?.provider).toBe('local');
    });
  });

  // ===========================================================================
  // Error Classes
  // ===========================================================================
  describe('error classes', () => {
    it('should create WorkspaceError with code', () => {
      const error = new WorkspaceError('Test error', 'TEST_CODE', 'ws-123');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.workspaceId).toBe('ws-123');
      expect(error.name).toBe('WorkspaceError');
    });

    it('should create FilesystemNotAvailableError', () => {
      const error = new FilesystemNotAvailableError();

      expect(error.code).toBe('NO_FILESYSTEM');
      expect(error.name).toBe('FilesystemNotAvailableError');
    });

    it('should create SandboxNotAvailableError', () => {
      const error = new SandboxNotAvailableError();

      expect(error.code).toBe('NO_SANDBOX');
      expect(error.name).toBe('SandboxNotAvailableError');
    });

    it('should create SearchNotAvailableError', () => {
      const error = new SearchNotAvailableError();

      expect(error.code).toBe('NO_SEARCH');
      expect(error.name).toBe('SearchNotAvailableError');
    });
  });
});
