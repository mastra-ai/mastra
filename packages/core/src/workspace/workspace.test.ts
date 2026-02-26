import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { RequestContext } from '../request-context';
import { WORKSPACE_TOOLS } from './constants';
import {
  WorkspaceError,
  FilesystemNotAvailableError,
  SandboxNotAvailableError,
  SearchNotAvailableError,
} from './errors';
import { CompositeFilesystem, LocalFilesystem } from './filesystem';
import { LSPManager } from './lsp';
import { LocalSandbox } from './sandbox';
import { createWorkspaceTools } from './tools';
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

    it('should throw when neither filesystem nor sandbox nor skills provided', () => {
      expect(() => new Workspace({})).toThrow('Workspace requires at least a filesystem, sandbox, or skills');
    });
  });

  // ===========================================================================
  // File Operations (via filesystem property)
  // ===========================================================================
  describe('file operations', () => {
    it('should read file from filesystem', async () => {
      // Create a test file
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');

      const filesystem = new LocalFilesystem({
        basePath: tempDir,
      });
      const workspace = new Workspace({ filesystem });

      const content = await workspace.filesystem.readFile('/test.txt');
      expect(content.toString()).toBe('Hello World');
    });

    it('should write file to filesystem', async () => {
      const filesystem = new LocalFilesystem({
        basePath: tempDir,
      });
      const workspace = new Workspace({ filesystem });

      await workspace.filesystem.writeFile('/test.txt', 'Hello World');

      const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(content).toBe('Hello World');
    });

    it('should list directory contents', async () => {
      // Create test files
      await fs.mkdir(path.join(tempDir, 'dir'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'dir', 'file.txt'), 'content');

      const filesystem = new LocalFilesystem({
        basePath: tempDir,
      });
      const workspace = new Workspace({ filesystem });

      const entries = await workspace.filesystem.readdir('/dir');
      expect(entries).toHaveLength(1);
      expect(entries[0]?.name).toBe('file.txt');
    });

    it('should check if path exists', async () => {
      await fs.writeFile(path.join(tempDir, 'exists.txt'), 'content');

      const filesystem = new LocalFilesystem({
        basePath: tempDir,
      });
      const workspace = new Workspace({ filesystem });

      expect(await workspace.filesystem.exists('/exists.txt')).toBe(true);
      expect(await workspace.filesystem.exists('/notexists.txt')).toBe(false);
    });

    it('should expose filesystem as undefined when not configured', async () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const sandboxOnly = new Workspace({ sandbox });

      expect(sandboxOnly.filesystem).toBeUndefined();
    });
  });

  // ===========================================================================
  // Sandbox Operations (via sandbox property)
  // ===========================================================================
  describe('sandbox operations', () => {
    it('should execute command in sandbox', async () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir, env: process.env });
      const workspace = new Workspace({ sandbox });

      await workspace.init();
      const result = await workspace.sandbox.executeCommand('echo', ['hello']);

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('hello');

      await workspace.destroy();
    });

    it('should expose sandbox as undefined when not configured', async () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const fsOnly = new Workspace({ filesystem });

      expect(fsOnly.sandbox).toBeUndefined();
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

    it('should generate SQL-compatible index names for vector stores', async () => {
      // SQL identifier pattern used by PgVector, LibSQL, etc.
      const SQL_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

      // Track what index name is passed to the vector store
      let capturedIndexName: string | undefined;

      // Mock vector store that validates index names like PgVector does
      const mockVectorStore = {
        id: 'mock-vector',
        upsert: vi.fn(async ({ indexName }: { indexName: string }) => {
          capturedIndexName = indexName;
          // Validate like PgVector does
          if (!indexName.match(SQL_IDENTIFIER_PATTERN)) {
            throw new Error(
              `Invalid index name: ${indexName}. Must start with a letter or underscore, contain only letters, numbers, or underscores.`,
            );
          }
          return [];
        }),
        query: vi.fn(async () => []),
        deleteVector: vi.fn(async () => {}),
      };

      const mockEmbedder = vi.fn(async () => [0.1, 0.2, 0.3]);

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        id: 'test_workspace', // Underscore-only ID
        filesystem,
        vectorStore: mockVectorStore as any,
        embedder: mockEmbedder,
      });

      // This should work - the generated index name should be SQL-compatible
      await workspace.index('/doc.txt', 'Test content for vector search');

      // Verify the index name passed to vector store is SQL-compatible
      expect(capturedIndexName).toBeDefined();
      expect(capturedIndexName).toMatch(SQL_IDENTIFIER_PATTERN);
      // Should not contain hyphens
      expect(capturedIndexName).not.toContain('-');
    });

    it('should sanitize hyphenated workspace IDs in index names', async () => {
      const SQL_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      let capturedIndexName: string | undefined;

      const mockVectorStore = {
        id: 'mock-vector',
        upsert: vi.fn(async ({ indexName }: { indexName: string }) => {
          capturedIndexName = indexName;
          if (!indexName.match(SQL_IDENTIFIER_PATTERN)) {
            throw new Error(`Invalid index name: ${indexName}`);
          }
          return [];
        }),
        query: vi.fn(async () => []),
        deleteVector: vi.fn(async () => {}),
      };

      const mockEmbedder = vi.fn(async () => [0.1, 0.2, 0.3]);

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        id: 'my-workspace-id', // Hyphenated ID (like auto-generated IDs)
        filesystem,
        vectorStore: mockVectorStore as any,
        embedder: mockEmbedder,
      });

      await workspace.index('/doc.txt', 'Test content');

      // Hyphens should be replaced with underscores
      expect(capturedIndexName).toBe('my_workspace_id_search');
      expect(capturedIndexName).toMatch(SQL_IDENTIFIER_PATTERN);
    });

    it('should allow custom searchIndexName configuration', async () => {
      let capturedIndexName: string | undefined;

      const mockVectorStore = {
        id: 'mock-vector',
        upsert: vi.fn(async ({ indexName }: { indexName: string }) => {
          capturedIndexName = indexName;
          return [];
        }),
        query: vi.fn(async () => []),
        deleteVector: vi.fn(async () => {}),
      };

      const mockEmbedder = vi.fn(async () => [0.1, 0.2, 0.3]);

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        id: 'my-workspace',
        filesystem,
        vectorStore: mockVectorStore as any,
        embedder: mockEmbedder,
        searchIndexName: 'custom_index_name', // Custom index name
      });

      await workspace.index('/doc.txt', 'Test content');

      // Should use the custom index name
      expect(capturedIndexName).toBe('custom_index_name');
    });

    it('should throw error for invalid searchIndexName starting with digit', () => {
      const mockVectorStore = {
        id: 'mock-vector',
        upsert: vi.fn(async () => []),
        query: vi.fn(async () => []),
        deleteVector: vi.fn(async () => {}),
      };

      const mockEmbedder = vi.fn(async () => [0.1, 0.2, 0.3]);
      const filesystem = new LocalFilesystem({ basePath: tempDir });

      expect(
        () =>
          new Workspace({
            filesystem,
            vectorStore: mockVectorStore as any,
            embedder: mockEmbedder,
            searchIndexName: '123_invalid', // Invalid: starts with digit
          }),
      ).toThrow(/Invalid searchIndexName/);
    });

    it('should throw error for searchIndexName exceeding 63 characters', () => {
      const mockVectorStore = {
        id: 'mock-vector',
        upsert: vi.fn(async () => []),
        query: vi.fn(async () => []),
        deleteVector: vi.fn(async () => {}),
      };

      const mockEmbedder = vi.fn(async () => [0.1, 0.2, 0.3]);
      const filesystem = new LocalFilesystem({ basePath: tempDir });

      const longName = 'a'.repeat(64); // 64 characters, exceeds limit

      expect(
        () =>
          new Workspace({
            filesystem,
            vectorStore: mockVectorStore as any,
            embedder: mockEmbedder,
            searchIndexName: longName,
          }),
      ).toThrow(/exceeds 63 characters/);
    });

    it('should sanitize special characters in workspace ID for index name', async () => {
      const SQL_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      let capturedIndexName: string | undefined;

      const mockVectorStore = {
        id: 'mock-vector',
        upsert: vi.fn(async ({ indexName }: { indexName: string }) => {
          capturedIndexName = indexName;
          return [];
        }),
        query: vi.fn(async () => []),
        deleteVector: vi.fn(async () => {}),
      };

      const mockEmbedder = vi.fn(async () => [0.1, 0.2, 0.3]);

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        id: 'my.workspace@123', // Special characters that need sanitizing
        filesystem,
        vectorStore: mockVectorStore as any,
        embedder: mockEmbedder,
      });

      await workspace.index('/doc.txt', 'Test content');

      // All special chars should be replaced with underscores
      expect(capturedIndexName).toBe('my_workspace_123_search');
      expect(capturedIndexName).toMatch(SQL_IDENTIFIER_PATTERN);
    });
  });

  // ===========================================================================
  // Skills
  // ===========================================================================
  describe('skills', () => {
    it('should return undefined when no skills configured', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({ filesystem });
      expect(workspace.skills).toBeUndefined();
    });

    it('should allow skills without filesystem (via LocalSkillSource)', () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({
        sandbox,
        skills: ['/skills'],
      });

      // Skills should be available via LocalSkillSource
      expect(workspace.skills).toBeDefined();
    });

    it('should return undefined when no skills configured', () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ sandbox });
      expect(workspace.skills).toBeUndefined();
    });

    it('should return skills instance when skills and filesystem configured', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        skills: ['/skills'],
      });
      expect(workspace.skills).toBeDefined();
    });

    it('should return same skills instance on repeated access', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        skills: ['/skills'],
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
      });
      const workspace = new Workspace({ filesystem });

      const info = await workspace.getInfo();

      expect(info.filesystem).toBeDefined();
      expect(info.sandbox).toBeUndefined();
    });
  });

  // ===========================================================================
  // getInstructions
  // ===========================================================================
  describe('getInstructions', () => {
    it('should return filesystem instructions when only filesystem configured', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({ filesystem });

      const instructions = workspace.getInstructions();

      expect(instructions).toContain('Local filesystem');
      expect(instructions).not.toContain('command execution');
    });

    it('should return sandbox instructions when only sandbox configured', () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ sandbox });

      const instructions = workspace.getInstructions();

      expect(instructions).toContain('Local command execution');
      expect(instructions).toContain(tempDir);
    });

    it('should return both sandbox and filesystem instructions', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ filesystem, sandbox });

      const instructions = workspace.getInstructions();

      expect(instructions).toContain('Local command execution');
      expect(instructions).toContain('Local filesystem');
    });

    it('should classify mounted filesystems by mount state', () => {
      // Create a workspace with a mock sandbox that has mounts in different states
      const mockMountEntries = new Map([
        [
          '/mounted',
          {
            filesystem: { provider: 'local', displayName: 'LocalFS', readOnly: false } as any,
            state: 'mounted' as const,
          },
        ],
        [
          '/pending',
          {
            filesystem: { provider: 's3', displayName: 'S3Bucket', readOnly: true } as any,
            state: 'pending' as const,
          },
        ],
        [
          '/error',
          {
            filesystem: { provider: 'r2', displayName: '', readOnly: false } as any,
            state: 'error' as const,
          },
        ],
      ]);

      const mockSandbox = {
        provider: 'e2b',
        status: 'running',
        executeCommand: vi.fn(),
        getInstructions: () => 'Cloud sandbox. Working directory: /home/user.',
        mounts: { entries: mockMountEntries },
      } as any;

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        sandbox: mockSandbox,
      });

      const instructions = workspace.getInstructions();

      // Sandbox-level instructions should be present
      expect(instructions).toContain('Cloud sandbox');

      // Mounted filesystem should be listed as sandbox-accessible
      expect(instructions).toContain('Sandbox-mounted filesystems');
      expect(instructions).toContain('/mounted: LocalFS (read-write)');

      // Pending and error mounts should be listed as workspace-only
      expect(instructions).toContain('Workspace-only filesystems');
      expect(instructions).toContain('/pending: S3Bucket (read-only)');
      expect(instructions).toContain('/error: r2 (read-write)');
    });

    it('should fall back to fs instructions when sandbox has no mounts', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ filesystem, sandbox });

      const instructions = workspace.getInstructions();

      // No mounts → falls back to fs-level instructions
      expect(instructions).toContain('Local filesystem');
      expect(instructions).toContain('Local command execution');
    });

    it('should return empty string when workspace has no instructions', () => {
      const mockSandbox = {
        provider: 'custom',
        status: 'running',
        executeCommand: vi.fn(),
      } as any;

      const workspace = new Workspace({ sandbox: mockSandbox });

      expect(workspace.getInstructions()).toBe('');
    });

    it('should pass requestContext to filesystem getInstructions', () => {
      const ctx = new RequestContext([['locale', 'fr']]);
      const filesystem = new LocalFilesystem({
        basePath: tempDir,
        instructions: ({ defaultInstructions, requestContext }: any) => {
          return `${defaultInstructions} locale=${requestContext?.get('locale')}`;
        },
      });
      const workspace = new Workspace({ filesystem });

      const instructions = workspace.getInstructions({ requestContext: ctx });
      expect(instructions).toContain('locale=fr');
      expect(instructions).toContain('Local filesystem');
    });

    it('should pass requestContext to sandbox getInstructions', () => {
      const ctx = new RequestContext([['tenant', 'acme']]);
      const sandbox = new LocalSandbox({
        workingDirectory: tempDir,
        instructions: ({ defaultInstructions, requestContext }: any) => {
          return `${defaultInstructions} tenant=${requestContext?.get('tenant')}`;
        },
      });
      const workspace = new Workspace({ sandbox });

      const instructions = workspace.getInstructions({ requestContext: ctx });
      expect(instructions).toContain('tenant=acme');
      expect(instructions).toContain('Local command execution');
    });
  });

  // ===========================================================================
  // Path Context (deprecated — kept for backward compat)
  // ===========================================================================
  describe('getPathContext', () => {
    it('should combine instructions from both filesystem and sandbox', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });

      const workspace = new Workspace({ filesystem, sandbox });

      const context = workspace.getPathContext();

      expect(context.filesystem?.provider).toBe('local');
      expect(context.filesystem?.basePath).toBe(tempDir);
      expect(context.sandbox?.provider).toBe('local');
      expect(context.sandbox?.workingDirectory).toBe(tempDir);
      expect(context.instructions).toContain('Local filesystem');
      expect(context.instructions).toContain('Local command execution');
    });

    it('should return only filesystem instructions when no sandbox configured', () => {
      const filesystem = new LocalFilesystem({
        basePath: tempDir,
      });
      const workspace = new Workspace({ filesystem });

      const context = workspace.getPathContext();

      expect(context.filesystem?.provider).toBe('local');
      expect(context.sandbox).toBeUndefined();
      expect(context.instructions).toContain('Local filesystem');
      expect(context.instructions).not.toContain('command execution');
    });

    it('should return only sandbox instructions when no filesystem configured', () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ sandbox });

      const context = workspace.getPathContext();

      expect(context.filesystem).toBeUndefined();
      expect(context.sandbox?.provider).toBe('local');
      expect(context.instructions).toContain('Local command execution');
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

  // ===========================================================================
  // getToolsConfig
  // ===========================================================================
  describe('getToolsConfig', () => {
    it('should return undefined when no tools config provided', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({ filesystem });

      expect(workspace.getToolsConfig()).toBeUndefined();
    });

    it('should return tools config when provided', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const toolsConfig = {
        mastra_workspace_read_file: { enabled: true, requireApproval: false },
        mastra_workspace_write_file: { enabled: true, requireApproval: true },
      };
      const workspace = new Workspace({ filesystem, tools: toolsConfig });

      expect(workspace.getToolsConfig()).toBe(toolsConfig);
    });
  });

  // ===========================================================================
  // setToolsConfig
  // ===========================================================================
  describe('setToolsConfig', () => {
    it('should disable tools excluded by config on next createWorkspaceTools call', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({ filesystem });

      // All tools available initially
      const toolsBefore = createWorkspaceTools(workspace);
      expect(toolsBefore[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]).toBeDefined();
      expect(toolsBefore[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]).toBeDefined();

      // Disable write and edit tools
      workspace.setToolsConfig({
        mastra_workspace_write_file: { enabled: false },
        mastra_workspace_edit_file: { enabled: false },
      });

      const toolsAfter = createWorkspaceTools(workspace);
      expect(toolsAfter[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]).toBeUndefined();
      expect(toolsAfter[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]).toBeUndefined();
      // Other tools still available
      expect(toolsAfter[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]).toBeDefined();
    });

    it('should re-enable all tools when config is cleared', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        tools: { mastra_workspace_write_file: { enabled: false } },
      });

      // Write tool disabled initially
      const toolsBefore = createWorkspaceTools(workspace);
      expect(toolsBefore[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]).toBeUndefined();

      // Clear config — all tools re-enabled
      workspace.setToolsConfig(undefined);

      const toolsAfter = createWorkspaceTools(workspace);
      expect(toolsAfter[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]).toBeDefined();
    });

    it('should replace existing config entirely', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        tools: { mastra_workspace_write_file: { enabled: false } },
      });

      // Write disabled, edit enabled
      const tools1 = createWorkspaceTools(workspace);
      expect(tools1[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]).toBeUndefined();
      expect(tools1[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]).toBeDefined();

      // Replace: now edit disabled, write re-enabled
      workspace.setToolsConfig({
        mastra_workspace_edit_file: { enabled: false },
      });

      const tools2 = createWorkspaceTools(workspace);
      expect(tools2[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]).toBeDefined();
      expect(tools2[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]).toBeUndefined();
    });
  });

  // ===========================================================================
  // __setLogger
  // ===========================================================================
  describe('__setLogger', () => {
    it('should propagate logger to MastraFilesystem', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const spy = vi.spyOn(filesystem, '__setLogger');
      const workspace = new Workspace({ filesystem });

      const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
      workspace.__setLogger(mockLogger);

      expect(spy).toHaveBeenCalledWith(mockLogger);
    });

    it('should propagate logger to MastraSandbox', () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const spy = vi.spyOn(sandbox, '__setLogger');
      const workspace = new Workspace({ sandbox });

      const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
      workspace.__setLogger(mockLogger);

      expect(spy).toHaveBeenCalledWith(mockLogger);
    });

    it('should propagate logger to both providers', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const fsSpy = vi.spyOn(filesystem, '__setLogger');
      const sbSpy = vi.spyOn(sandbox, '__setLogger');
      const workspace = new Workspace({ filesystem, sandbox });

      const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
      workspace.__setLogger(mockLogger);

      expect(fsSpy).toHaveBeenCalledWith(mockLogger);
      expect(sbSpy).toHaveBeenCalledWith(mockLogger);
    });

    it('should not throw for non-Mastra filesystem providers', () => {
      // A plain object implementing WorkspaceFilesystem (not extending MastraFilesystem)
      const plainFs = {
        id: 'plain',
        name: 'Plain',
        provider: 'plain',
        status: 'ready',
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
      } as any;
      const workspace = new Workspace({ filesystem: plainFs });

      const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
      // Should not throw
      expect(() => workspace.__setLogger(mockLogger)).not.toThrow();
    });
  });

  // ===========================================================================
  // Auto-indexing (rebuildSearchIndex via init)
  // ===========================================================================
  describe('auto-indexing', () => {
    it('should auto-index files during init when autoIndexPaths configured', async () => {
      // Create test files on disk
      await fs.mkdir(path.join(tempDir, 'docs'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'docs', 'readme.txt'), 'Welcome to the project');
      await fs.writeFile(path.join(tempDir, 'docs', 'guide.txt'), 'Installation guide for users');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
        autoIndexPaths: ['/docs'],
      });

      await workspace.init();

      // Files should be searchable after init
      const results = await workspace.search('project');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.id === '/docs/readme.txt')).toBe(true);

      await workspace.destroy();
    });

    it('should auto-index files from multiple paths', async () => {
      await fs.mkdir(path.join(tempDir, 'docs'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'support'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'docs', 'api.txt'), 'API reference documentation');
      await fs.writeFile(path.join(tempDir, 'support', 'faq.txt'), 'Frequently asked questions');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
        autoIndexPaths: ['/docs', '/support'],
      });

      await workspace.init();

      const docsResults = await workspace.search('API reference');
      expect(docsResults.some(r => r.id === '/docs/api.txt')).toBe(true);

      const faqResults = await workspace.search('frequently asked');
      expect(faqResults.some(r => r.id === '/support/faq.txt')).toBe(true);

      await workspace.destroy();
    });

    it('should skip non-existent autoIndexPaths gracefully', async () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
        autoIndexPaths: ['/nonexistent'],
      });

      // Should not throw
      await workspace.init();
      expect(workspace.status).toBe('ready');

      await workspace.destroy();
    });

    it('should recursively index nested directories', async () => {
      await fs.mkdir(path.join(tempDir, 'docs', 'nested'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'docs', 'top.txt'), 'Top level file');
      await fs.writeFile(path.join(tempDir, 'docs', 'nested', 'deep.txt'), 'Deeply nested content');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
        autoIndexPaths: ['/docs'],
      });

      await workspace.init();

      const results = await workspace.search('nested content');
      expect(results.some(r => r.id === '/docs/nested/deep.txt')).toBe(true);

      await workspace.destroy();
    });

    it('should auto-index only matching files when autoIndexPaths uses glob pattern', async () => {
      await fs.mkdir(path.join(tempDir, 'docs'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'docs', 'readme.md'), 'Welcome to the project');
      await fs.writeFile(path.join(tempDir, 'docs', 'guide.md'), 'Installation guide for users');
      await fs.writeFile(path.join(tempDir, 'docs', 'notes.txt'), 'Internal notes');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
        autoIndexPaths: ['/docs/**/*.md'],
      });

      await workspace.init();

      // .md files should be searchable
      const mdResults = await workspace.search('project');
      expect(mdResults.some(r => r.id === '/docs/readme.md')).toBe(true);

      // .txt files should NOT be indexed
      const txtResults = await workspace.search('Internal notes');
      expect(txtResults.some(r => r.id === '/docs/notes.txt')).toBe(false);

      await workspace.destroy();
    });

    it('should support plain paths alongside glob patterns in autoIndexPaths', async () => {
      await fs.mkdir(path.join(tempDir, 'docs'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'support'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'docs', 'api.md'), 'API reference documentation');
      await fs.writeFile(path.join(tempDir, 'docs', 'changelog.txt'), 'Changelog text');
      await fs.writeFile(path.join(tempDir, 'support', 'faq.txt'), 'Frequently asked questions');
      await fs.writeFile(path.join(tempDir, 'support', 'guide.md'), 'Support guide markdown');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
        // Mix of plain path and glob pattern
        autoIndexPaths: ['/support', '/docs/**/*.md'],
      });

      await workspace.init();

      // /support is a plain path — all files indexed
      const faqResults = await workspace.search('frequently asked');
      expect(faqResults.some(r => r.id === '/support/faq.txt')).toBe(true);

      const guideResults = await workspace.search('Support guide');
      expect(guideResults.some(r => r.id === '/support/guide.md')).toBe(true);

      // /docs/**/*.md is a glob — only .md files indexed
      const apiResults = await workspace.search('API reference');
      expect(apiResults.some(r => r.id === '/docs/api.md')).toBe(true);

      const changelogResults = await workspace.search('Changelog text');
      expect(changelogResults.some(r => r.id === '/docs/changelog.txt')).toBe(false);

      await workspace.destroy();
    });

    it('should handle glob pattern with non-existent base gracefully', async () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
        autoIndexPaths: ['/nonexistent/**/*.md'],
      });

      // Should not throw
      await workspace.init();
      expect(workspace.status).toBe('ready');

      await workspace.destroy();
    });

    it('should auto-index with ./ prefixed glob patterns', async () => {
      await fs.mkdir(path.join(tempDir, 'docs'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'docs', 'readme.md'), 'Welcome markdown');
      await fs.writeFile(path.join(tempDir, 'docs', 'notes.txt'), 'Plain text notes');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
        autoIndexPaths: ['./docs/**/*.md'],
      });

      await workspace.init();

      // .md files should be searchable (IDs retain the ./ prefix from the glob base)
      const mdResults = await workspace.search('Welcome markdown');
      expect(mdResults.some(r => r.id === './docs/readme.md')).toBe(true);

      // .txt files should NOT be indexed
      const txtResults = await workspace.search('Plain text notes');
      expect(txtResults.some(r => r.id === './docs/notes.txt')).toBe(false);

      await workspace.destroy();
    });

    it('should auto-index with brace expansion patterns', async () => {
      await fs.mkdir(path.join(tempDir, 'docs'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'docs', 'readme.md'), 'Markdown content');
      await fs.writeFile(path.join(tempDir, 'docs', 'notes.txt'), 'Text content');
      await fs.writeFile(path.join(tempDir, 'docs', 'image.png'), 'binary data');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
        autoIndexPaths: ['/docs/**/*.{md,txt}'],
      });

      await workspace.init();

      const mdResults = await workspace.search('Markdown content');
      expect(mdResults.some(r => r.id === '/docs/readme.md')).toBe(true);

      const txtResults = await workspace.search('Text content');
      expect(txtResults.some(r => r.id === '/docs/notes.txt')).toBe(true);

      // .png should NOT be indexed
      const pngResults = await workspace.search('binary data');
      expect(pngResults.some(r => r.id === '/docs/image.png')).toBe(false);

      await workspace.destroy();
    });

    it('should auto-index with deeply nested glob patterns', async () => {
      await fs.mkdir(path.join(tempDir, 'docs', 'api', 'v2'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'docs', 'api', 'v2', 'endpoints.md'), 'API v2 endpoints');
      await fs.writeFile(path.join(tempDir, 'docs', 'api', 'overview.md'), 'API overview');
      await fs.writeFile(path.join(tempDir, 'docs', 'readme.md'), 'Top-level readme');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
        autoIndexPaths: ['/docs/api/**/*.md'],
      });

      await workspace.init();

      // Files under /docs/api/ should be indexed
      const v2Results = await workspace.search('API v2 endpoints');
      expect(v2Results.some(r => r.id === '/docs/api/v2/endpoints.md')).toBe(true);

      const overviewResults = await workspace.search('API overview');
      expect(overviewResults.some(r => r.id === '/docs/api/overview.md')).toBe(true);

      // File outside /docs/api/ should NOT be indexed
      const topResults = await workspace.search('Top-level readme');
      expect(topResults.some(r => r.id === '/docs/readme.md')).toBe(false);

      await workspace.destroy();
    });

    it('should not auto-index when no search engine configured', async () => {
      await fs.mkdir(path.join(tempDir, 'docs'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'docs', 'file.txt'), 'content');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        // No bm25 or vectorStore — no search engine
        autoIndexPaths: ['/docs'],
      });

      await workspace.init();
      expect(workspace.status).toBe('ready');

      // Search should throw because no search engine
      await expect(workspace.search('content')).rejects.toThrow(SearchNotAvailableError);

      await workspace.destroy();
    });

    it('should auto-index a single file path (not a directory)', async () => {
      await fs.mkdir(path.join(tempDir, 'content'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'content', 'faq.md'), 'Billing FAQ content');
      await fs.writeFile(path.join(tempDir, 'content', 'guide.md'), 'Setup guide content');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
        autoIndexPaths: ['/content/faq.md'],
      });

      await workspace.init();

      // The single file should be indexed
      const results = await workspace.search('Billing FAQ');
      expect(results.some(r => r.id === '/content/faq.md')).toBe(true);

      // The other file should NOT be indexed
      const otherResults = await workspace.search('Setup guide');
      expect(otherResults.some(r => r.id === '/content/guide.md')).toBe(false);

      await workspace.destroy();
    });

    it('should auto-index with trailing slash path /docs/', async () => {
      await fs.mkdir(path.join(tempDir, 'docs'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'docs', 'readme.txt'), 'Welcome to the project');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
        autoIndexPaths: ['/docs/'],
      });

      await workspace.init();

      const results = await workspace.search('project');
      expect(results.some(r => r.id === '/docs/readme.txt')).toBe(true);

      await workspace.destroy();
    });

    it('should auto-index with unscoped file glob **/*.md', async () => {
      await fs.mkdir(path.join(tempDir, 'docs'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'content'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'docs', 'api.md'), 'API reference documentation');
      await fs.writeFile(path.join(tempDir, 'content', 'faq.md'), 'Frequently asked questions');
      await fs.writeFile(path.join(tempDir, 'notes.txt'), 'Internal notes text file');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
        autoIndexPaths: ['**/*.md'],
      });

      await workspace.init();

      // .md files anywhere should be indexed
      const apiResults = await workspace.search('API reference');
      expect(apiResults.some(r => r.id === '/docs/api.md')).toBe(true);

      const faqResults = await workspace.search('Frequently asked');
      expect(faqResults.some(r => r.id === '/content/faq.md')).toBe(true);

      // .txt files should NOT be indexed
      const txtResults = await workspace.search('Internal notes');
      expect(txtResults.some(r => r.id === '/notes.txt')).toBe(false);

      await workspace.destroy();
    });

    it('should auto-index with directory-matching glob **/content', async () => {
      await fs.mkdir(path.join(tempDir, 'content'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'src', 'content'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'content', 'faq.md'), 'Root FAQ content');
      await fs.writeFile(path.join(tempDir, 'src', 'content', 'api.md'), 'API documentation');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({
        filesystem,
        bm25: true,
        autoIndexPaths: ['**/content'],
      });

      await workspace.init();

      // Files inside /content should be indexed
      const rootResults = await workspace.search('Root FAQ');
      expect(rootResults.some(r => r.id === '/content/faq.md')).toBe(true);

      // Files inside /src/content should also be indexed
      const nestedResults = await workspace.search('API documentation');
      expect(nestedResults.some(r => r.id === '/src/content/api.md')).toBe(true);

      await workspace.destroy();
    });
  });

  // ===========================================================================
  // getAllFiles (tested indirectly via getInfo with includeFileCount)
  // ===========================================================================
  describe('getInfo with includeFileCount', () => {
    it('should count files when includeFileCount is true', async () => {
      await fs.writeFile(path.join(tempDir, 'a.txt'), 'a');
      await fs.writeFile(path.join(tempDir, 'b.txt'), 'b');
      await fs.mkdir(path.join(tempDir, 'sub'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'sub', 'c.txt'), 'c');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({ filesystem });

      const info = await workspace.getInfo({ includeFileCount: true });

      expect(info.filesystem?.totalFiles).toBe(3);
    });

    it('should not count files when includeFileCount is false or omitted', async () => {
      await fs.writeFile(path.join(tempDir, 'a.txt'), 'a');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({ filesystem });

      const info = await workspace.getInfo();
      expect(info.filesystem?.totalFiles).toBeUndefined();

      const info2 = await workspace.getInfo({ includeFileCount: false });
      expect(info2.filesystem?.totalFiles).toBeUndefined();
    });
  });

  // ===========================================================================
  // Workspace with CompositeFilesystem
  // ===========================================================================
  describe('with CompositeFilesystem', () => {
    let tempDirA: string;
    let tempDirB: string;

    beforeEach(async () => {
      tempDirA = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-cfs-a-'));
      tempDirB = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-cfs-b-'));
    });

    afterEach(async () => {
      for (const dir of [tempDirA, tempDirB]) {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch {
          // Ignore
        }
      }
    });

    it('should initialize and reach ready status', async () => {
      const cfs = new CompositeFilesystem({
        mounts: {
          '/local': new LocalFilesystem({ basePath: tempDirA }),
          '/backup': new LocalFilesystem({ basePath: tempDirB }),
        },
      });
      const workspace = new Workspace({ filesystem: cfs });

      await workspace.init();
      expect(workspace.status).toBe('ready');

      await workspace.destroy();
    });

    it('should read and write files through workspace.filesystem', async () => {
      const cfs = new CompositeFilesystem({
        mounts: {
          '/local': new LocalFilesystem({ basePath: tempDirA }),
          '/backup': new LocalFilesystem({ basePath: tempDirB }),
        },
      });
      const workspace = new Workspace({ filesystem: cfs });
      await workspace.init();

      await workspace.filesystem.writeFile('/local/doc.txt', 'hello from workspace');
      const content = await workspace.filesystem.readFile('/local/doc.txt', { encoding: 'utf-8' });
      expect(content).toBe('hello from workspace');

      // Verify isolation — file shouldn't exist in the other mount
      expect(await workspace.filesystem.exists('/backup/doc.txt')).toBe(false);

      await workspace.destroy();
    });

    it('should list mount points at root via workspace.filesystem', async () => {
      const cfs = new CompositeFilesystem({
        mounts: {
          '/local': new LocalFilesystem({ basePath: tempDirA }),
          '/backup': new LocalFilesystem({ basePath: tempDirB }),
        },
      });
      const workspace = new Workspace({ filesystem: cfs });

      const entries = await workspace.filesystem.readdir('/');
      const names = entries.map(e => e.name).sort();
      expect(names).toEqual(['backup', 'local']);
    });

    it('should copy files across mounts through workspace', async () => {
      const cfs = new CompositeFilesystem({
        mounts: {
          '/local': new LocalFilesystem({ basePath: tempDirA }),
          '/backup': new LocalFilesystem({ basePath: tempDirB }),
        },
      });
      const workspace = new Workspace({ filesystem: cfs });
      await workspace.init();

      await workspace.filesystem.writeFile('/local/important.txt', 'critical data');
      await workspace.filesystem.copyFile('/local/important.txt', '/backup/important.txt');

      const backupContent = await workspace.filesystem.readFile('/backup/important.txt', { encoding: 'utf-8' });
      expect(backupContent).toBe('critical data');

      // Source still exists
      expect(await workspace.filesystem.exists('/local/important.txt')).toBe(true);

      await workspace.destroy();
    });

    it('should support search with auto-indexing across mounts', async () => {
      // Pre-create files in both mount dirs
      await fs.mkdir(path.join(tempDirA, 'docs'), { recursive: true });
      await fs.writeFile(path.join(tempDirA, 'docs', 'api.txt'), 'REST API reference');
      await fs.writeFile(path.join(tempDirB, 'notes.txt'), 'Meeting notes about deployment');

      const cfs = new CompositeFilesystem({
        mounts: {
          '/local': new LocalFilesystem({ basePath: tempDirA }),
          '/backup': new LocalFilesystem({ basePath: tempDirB }),
        },
      });
      const workspace = new Workspace({
        filesystem: cfs,
        bm25: true,
        autoIndexPaths: ['/local/docs', '/backup'],
      });

      await workspace.init();

      const apiResults = await workspace.search('REST API');
      expect(apiResults.some(r => r.id === '/local/docs/api.txt')).toBe(true);

      const noteResults = await workspace.search('deployment');
      expect(noteResults.some(r => r.id === '/backup/notes.txt')).toBe(true);

      await workspace.destroy();
    });

    it('should return composite instructions in path context', () => {
      const cfs = new CompositeFilesystem({
        mounts: {
          '/local': new LocalFilesystem({ basePath: tempDirA }),
          '/backup': new LocalFilesystem({ basePath: tempDirB }),
        },
      });
      const workspace = new Workspace({ filesystem: cfs });
      const context = workspace.getPathContext();

      expect(context.instructions).toContain('/local');
      expect(context.instructions).toContain('/backup');
      expect(context.instructions).toContain('(read-write)');
    });

    it('should count files across mounts via getInfo', async () => {
      await fs.writeFile(path.join(tempDirA, 'a.txt'), 'a');
      await fs.writeFile(path.join(tempDirA, 'b.txt'), 'b');
      await fs.writeFile(path.join(tempDirB, 'c.txt'), 'c');

      const cfs = new CompositeFilesystem({
        mounts: {
          '/local': new LocalFilesystem({ basePath: tempDirA }),
          '/backup': new LocalFilesystem({ basePath: tempDirB }),
        },
      });
      const workspace = new Workspace({ filesystem: cfs });
      await workspace.init();

      const info = await workspace.getInfo({ includeFileCount: true });
      expect(info.filesystem?.totalFiles).toBe(3);

      await workspace.destroy();
    });

    it('should move files across mounts through workspace', async () => {
      const cfs = new CompositeFilesystem({
        mounts: {
          '/local': new LocalFilesystem({ basePath: tempDirA }),
          '/backup': new LocalFilesystem({ basePath: tempDirB }),
        },
      });
      const workspace = new Workspace({ filesystem: cfs });
      await workspace.init();

      await workspace.filesystem.writeFile('/local/moveme.txt', 'moving data');
      await workspace.filesystem.moveFile('/local/moveme.txt', '/backup/moveme.txt');

      // Source should be gone
      expect(await workspace.filesystem.exists('/local/moveme.txt')).toBe(false);
      // Dest should have the content
      const content = await workspace.filesystem.readFile('/backup/moveme.txt', { encoding: 'utf-8' });
      expect(content).toBe('moving data');

      await workspace.destroy();
    });

    it('should enforce read-only mount through workspace', async () => {
      const tempDirRo = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-cfs-ro-'));
      try {
        await fs.writeFile(path.join(tempDirRo, 'protected.txt'), 'do not modify');

        const cfs = new CompositeFilesystem({
          mounts: {
            '/ro': new LocalFilesystem({ basePath: tempDirRo, readOnly: true }),
            '/rw': new LocalFilesystem({ basePath: tempDirA }),
          },
        });
        const workspace = new Workspace({ filesystem: cfs });
        await workspace.init();

        // Reads work
        const content = await workspace.filesystem.readFile('/ro/protected.txt', { encoding: 'utf-8' });
        expect(content).toBe('do not modify');

        // Writes fail
        await expect(workspace.filesystem.writeFile('/ro/new.txt', 'fail')).rejects.toThrow();

        // Can still write to the read-write mount
        await workspace.filesystem.writeFile('/rw/ok.txt', 'success');
        expect(await workspace.filesystem.readFile('/rw/ok.txt', { encoding: 'utf-8' })).toBe('success');

        await workspace.destroy();
      } finally {
        await fs.rm(tempDirRo, { recursive: true, force: true });
      }
    });

    it('should work with both composite filesystem and sandbox', async () => {
      const cfs = new CompositeFilesystem({
        mounts: {
          '/local': new LocalFilesystem({ basePath: tempDirA }),
        },
      });
      const sandbox = new LocalSandbox({ workingDirectory: tempDirA, env: process.env });
      const workspace = new Workspace({ filesystem: cfs, sandbox });

      await workspace.init();
      expect(workspace.status).toBe('ready');
      expect(workspace.filesystem).toBe(cfs);
      expect(workspace.sandbox).toBe(sandbox);

      // Filesystem works
      await workspace.filesystem.writeFile('/local/test.txt', 'via composite');
      expect(await workspace.filesystem.readFile('/local/test.txt', { encoding: 'utf-8' })).toBe('via composite');

      // Sandbox works — the file written via composite is on disk in tempDirA
      const result = await workspace.sandbox.executeCommand('cat', ['test.txt']);
      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('via composite');

      await workspace.destroy();
    });

    it('should report composite provider in getInfo', async () => {
      const cfs = new CompositeFilesystem({
        mounts: {
          '/local': new LocalFilesystem({ basePath: tempDirA }),
        },
      });
      const workspace = new Workspace({ filesystem: cfs });

      const info = await workspace.getInfo();
      expect(info.filesystem?.provider).toBe('composite');
    });

    it('should handle nested directory operations across mounts', async () => {
      const cfs = new CompositeFilesystem({
        mounts: {
          '/src': new LocalFilesystem({ basePath: tempDirA }),
          '/dest': new LocalFilesystem({ basePath: tempDirB }),
        },
      });
      const workspace = new Workspace({ filesystem: cfs });
      await workspace.init();

      // Create nested structure in source
      await workspace.filesystem.writeFile('/src/project/config.json', '{"key":"value"}');
      await workspace.filesystem.writeFile('/src/project/lib/utils.ts', 'export const x = 1;');

      // Pre-create empty files at dest to ensure parent directories exist
      // (cross-mount copyFile doesn't auto-create parent dirs, writeFile does)
      await workspace.filesystem.writeFile('/dest/project/config.json', '');
      await workspace.filesystem.copyFile('/src/project/config.json', '/dest/project/config.json');
      await workspace.filesystem.writeFile('/dest/project/lib/utils.ts', '');
      await workspace.filesystem.copyFile('/src/project/lib/utils.ts', '/dest/project/lib/utils.ts');

      // Verify the nested structure was created correctly
      const config = await workspace.filesystem.readFile('/dest/project/config.json', { encoding: 'utf-8' });
      expect(config).toBe('{"key":"value"}');

      const utils = await workspace.filesystem.readFile('/dest/project/lib/utils.ts', { encoding: 'utf-8' });
      expect(utils).toBe('export const x = 1;');

      // Verify source is untouched
      expect(await workspace.filesystem.exists('/src/project/config.json')).toBe(true);
      expect(await workspace.filesystem.exists('/src/project/lib/utils.ts')).toBe(true);

      await workspace.destroy();
    });
  });

  // ===========================================================================
  // Workspace mounts config (auto-creates CompositeFilesystem)
  // ===========================================================================
  describe('mounts config', () => {
    let tempDirA: string;
    let tempDirB: string;

    beforeEach(async () => {
      tempDirA = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-mounts-a-'));
      tempDirB = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-mounts-b-'));
    });

    afterEach(async () => {
      for (const dir of [tempDirA, tempDirB]) {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch {
          // Ignore
        }
      }
    });

    it('should auto-create CompositeFilesystem from mounts config', async () => {
      const workspace = new Workspace({
        mounts: {
          '/a': new LocalFilesystem({ basePath: tempDirA }),
          '/b': new LocalFilesystem({ basePath: tempDirB }),
        },
      });
      await workspace.init();

      expect(workspace.filesystem).toBeInstanceOf(CompositeFilesystem);

      expect(workspace.filesystem.mountPaths.sort()).toEqual(['/a', '/b']);

      // Verify operations work through the auto-created composite
      await workspace.filesystem.writeFile('/a/test.txt', 'from mount a');
      expect(await workspace.filesystem.readFile('/a/test.txt', { encoding: 'utf-8' })).toBe('from mount a');
      expect(await workspace.filesystem.exists('/b/test.txt')).toBe(false);

      await workspace.destroy();
    });

    it('should throw when both filesystem and mounts are provided', () => {
      expect(
        () =>
          new Workspace({
            filesystem: new LocalFilesystem({ basePath: tempDirA }),
            mounts: {
              '/b': new LocalFilesystem({ basePath: tempDirB }),
            },
          }),
      ).toThrow('Cannot use both "filesystem" and "mounts"');
    });

    it('should warn when a mount uses LocalFilesystem with contained: false', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        new Workspace({
          mounts: {
            '/a': new LocalFilesystem({ basePath: tempDirA }),
            '/b': new LocalFilesystem({ basePath: tempDirB, contained: false }),
          },
        });
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('contained: false'));
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('incompatible with mounts'));
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('should include mount path in warning for contained: false mount', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        new Workspace({
          mounts: {
            '/data': new LocalFilesystem({ basePath: tempDirA, contained: false }),
          },
        });
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('mount "/data"'));
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('should not warn for contained: true LocalFilesystem in mounts', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const workspace = new Workspace({
          mounts: {
            '/a': new LocalFilesystem({ basePath: tempDirA }),
            '/b': new LocalFilesystem({ basePath: tempDirB, contained: true }),
          },
        });
        expect(workspace.filesystem).toBeInstanceOf(CompositeFilesystem);
        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  // ===========================================================================
  // Lifecycle error handling
  // ===========================================================================
  describe('lifecycle error handling', () => {
    it('should set status to error when init fails', async () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const sandbox = {
        provider: 'broken',
        status: 'pending',
        start: vi.fn().mockRejectedValue(new Error('Sandbox start failed')),
        destroy: vi.fn(),
        getInfo: vi.fn(),
      } as any;
      const workspace = new Workspace({ filesystem, sandbox });

      await expect(workspace.init()).rejects.toThrow('Sandbox start failed');
      expect(workspace.status).toBe('error');
    });

    it('should set status to error when destroy fails', async () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const sandbox = {
        provider: 'broken',
        status: 'pending',
        start: vi.fn(),
        destroy: vi.fn().mockRejectedValue(new Error('Sandbox destroy failed')),
        getInfo: vi.fn(),
      } as any;
      const workspace = new Workspace({ filesystem, sandbox });

      await workspace.init();
      await expect(workspace.destroy()).rejects.toThrow('Sandbox destroy failed');
      expect(workspace.status).toBe('error');
    });
  });

  // ===========================================================================
  // LSP Initialization
  // ===========================================================================
  describe('LSP initialization', () => {
    it('creates LSPManager when lsp:true and sandbox has processes', () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ sandbox, lsp: true });

      expect(workspace.lsp).toBeInstanceOf(LSPManager);
    });

    it('does not create LSPManager when lsp is not configured', () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ sandbox });

      expect(workspace.lsp).toBeUndefined();
    });

    it('does not create LSPManager when sandbox has no process manager', () => {
      const sandbox = {
        provider: 'mock',
        status: 'running' as const,
        start: vi.fn(),
        destroy: vi.fn(),
        getInfo: vi.fn(),
      } as any;
      const workspace = new Workspace({ sandbox, lsp: true });

      expect(workspace.lsp).toBeUndefined();
    });

    it('does not create LSPManager when no sandbox is provided', () => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({ filesystem, lsp: true });

      expect(workspace.lsp).toBeUndefined();
    });

    it('uses explicit root from LSPConfig', () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ sandbox, lsp: { root: '/explicit/root' } });

      expect(workspace.lsp).toBeInstanceOf(LSPManager);
      expect(workspace.lsp!.root).toBe('/explicit/root');
    });

    it('resolves root via findProjectRoot when no explicit root', () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ sandbox, lsp: true });

      // findProjectRoot(process.cwd()) finds the repo root (has package.json, tsconfig.json)
      // The resolved root should be an absolute path that contains a project marker
      expect(workspace.lsp).toBeInstanceOf(LSPManager);
      const root = workspace.lsp!.root;
      expect(path.isAbsolute(root)).toBe(true);
      // Verify it found a real project root (not just cwd fallback) by checking for markers
      const hasMarker =
        existsSync(path.join(root, 'package.json')) ||
        existsSync(path.join(root, 'tsconfig.json')) ||
        existsSync(path.join(root, 'go.mod'));
      expect(hasMarker).toBe(true);
    });

    it('passes LSPConfig root through to LSPManager', () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({
        sandbox,
        lsp: { root: tempDir, disableServers: ['eslint'], diagnosticTimeout: 5000, initTimeout: 3000 },
      });

      expect(workspace.lsp).toBeInstanceOf(LSPManager);
      // root is the only publicly exposed LSPConfig property on LSPManager;
      // disableServers, diagnosticTimeout, and initTimeout are verified in manager.test.ts
      expect(workspace.lsp!.root).toBe(tempDir);
    });

    it('treats lsp:true as empty LSPConfig', () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const ws1 = new Workspace({ sandbox, lsp: true });
      const ws2 = new Workspace({ sandbox, lsp: {} });

      expect(ws1.lsp).toBeInstanceOf(LSPManager);
      expect(ws2.lsp).toBeInstanceOf(LSPManager);
      expect(ws1.lsp!.root).toBe(ws2.lsp!.root);
    });

    it('shuts down LSP on destroy', async () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ sandbox, lsp: true });
      const lsp = workspace.lsp!;
      const shutdownSpy = vi.spyOn(lsp, 'shutdownAll').mockResolvedValue(undefined);

      await workspace.init();
      await workspace.destroy();

      expect(shutdownSpy).toHaveBeenCalled();
      expect(workspace.lsp).toBeUndefined();
    });

    it('does not fail destroy when LSP shutdown throws', async () => {
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ sandbox, lsp: true });
      vi.spyOn(workspace.lsp!, 'shutdownAll').mockRejectedValue(new Error('LSP shutdown failed'));

      await workspace.init();
      await workspace.destroy();
      expect(workspace.lsp).toBeUndefined();
    });
  });
});
