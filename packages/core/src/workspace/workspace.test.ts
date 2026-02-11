import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  WorkspaceError,
  FilesystemNotAvailableError,
  SandboxNotAvailableError,
  SearchNotAvailableError,
} from './errors';
import { LocalFilesystem } from './filesystem';
import { LocalSandbox } from './sandbox';
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

      const content = await workspace.filesystem!.readFile('/test.txt');
      expect(content.toString()).toBe('Hello World');
    });

    it('should write file to filesystem', async () => {
      const filesystem = new LocalFilesystem({
        basePath: tempDir,
      });
      const workspace = new Workspace({ filesystem });

      await workspace.filesystem!.writeFile('/test.txt', 'Hello World');

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

      const entries = await workspace.filesystem!.readdir('/dir');
      expect(entries).toHaveLength(1);
      expect(entries[0]?.name).toBe('file.txt');
    });

    it('should check if path exists', async () => {
      await fs.writeFile(path.join(tempDir, 'exists.txt'), 'content');

      const filesystem = new LocalFilesystem({
        basePath: tempDir,
      });
      const workspace = new Workspace({ filesystem });

      expect(await workspace.filesystem!.exists('/exists.txt')).toBe(true);
      expect(await workspace.filesystem!.exists('/notexists.txt')).toBe(false);
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
      const result = await workspace.sandbox!.executeCommand!('echo', ['hello']);

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
  // Path Context
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
});
