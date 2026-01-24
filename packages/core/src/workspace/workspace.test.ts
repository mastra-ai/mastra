import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { WorkspaceFilesystem, FileEntry } from './filesystem';
import type { WorkspaceSandbox, CommandResult } from './sandbox';
import { Workspace } from './workspace';

import {
  WorkspaceError,
  FilesystemNotAvailableError,
  SandboxNotAvailableError,
  SearchNotAvailableError,
} from './errors';

// =============================================================================
// Mock Implementations
// =============================================================================

function createMockFilesystem(files: Map<string, string | Buffer> = new Map()): WorkspaceFilesystem {
  const dirs = new Set<string>(['/']);

  return {
    id: 'mock-fs-1',
    name: 'Mock Filesystem',
    provider: 'mock',

    readFile: vi.fn().mockImplementation(async (path: string) => {
      if (!files.has(path)) {
        throw new Error(`File not found: ${path}`);
      }
      return files.get(path)!;
    }),

    writeFile: vi.fn().mockImplementation(async (path: string, content: string | Buffer) => {
      files.set(path, content);
      // Ensure parent directories exist
      const parts = path.split('/').filter(Boolean);
      let current = '';
      for (let i = 0; i < parts.length - 1; i++) {
        current += '/' + parts[i];
        dirs.add(current);
      }
    }),

    appendFile: vi.fn().mockImplementation(async (path: string, content: string | Buffer) => {
      const existing = files.get(path) ?? '';
      if (typeof existing === 'string' && typeof content === 'string') {
        files.set(path, existing + content);
      } else {
        const existingBuf = typeof existing === 'string' ? Buffer.from(existing) : existing;
        const contentBuf = typeof content === 'string' ? Buffer.from(content) : content;
        files.set(path, Buffer.concat([existingBuf, contentBuf]));
      }
    }),

    readdir: vi.fn().mockImplementation(async (path: string): Promise<FileEntry[]> => {
      const entries: FileEntry[] = [];
      const normalizedPath = path === '/' ? '' : path;

      for (const [filePath] of files) {
        if (filePath.startsWith(normalizedPath + '/')) {
          const rest = filePath.slice(normalizedPath.length + 1);
          const parts = rest.split('/');
          if (parts.length === 1) {
            entries.push({
              name: parts[0],
              type: 'file',
            });
          }
        }
      }

      for (const dir of dirs) {
        if (dir !== path && dir.startsWith(normalizedPath + '/')) {
          const rest = dir.slice(normalizedPath.length + 1);
          const parts = rest.split('/');
          if (parts.length === 1 && !entries.some(e => e.name === parts[0])) {
            entries.push({
              name: parts[0],
              type: 'directory',
            });
          }
        }
      }

      return entries;
    }),

    exists: vi.fn().mockImplementation(async (path: string) => {
      return files.has(path) || dirs.has(path);
    }),

    stat: vi.fn().mockImplementation(async (path: string) => {
      const isFile = files.has(path);
      const isDir = dirs.has(path);
      if (!isFile && !isDir) {
        throw new Error(`Path not found: ${path}`);
      }
      const content = files.get(path);
      return {
        name: path.split('/').pop() ?? '',
        path,
        type: isFile ? 'file' : 'directory',
        size: isFile && content ? (typeof content === 'string' ? content.length : content.length) : 0,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
    }),

    isFile: vi.fn().mockImplementation(async (path: string) => {
      return files.has(path);
    }),

    isDirectory: vi.fn().mockImplementation(async (path: string) => {
      return dirs.has(path);
    }),

    mkdir: vi.fn().mockImplementation(async (path: string) => {
      dirs.add(path);
    }),

    deleteFile: vi.fn().mockImplementation(async (path: string) => {
      if (!files.has(path)) {
        throw new Error(`File not found: ${path}`);
      }
      files.delete(path);
    }),

    copyFile: vi.fn().mockImplementation(async (src: string, dest: string) => {
      if (!files.has(src)) {
        throw new Error(`File not found: ${src}`);
      }
      files.set(dest, files.get(src)!);
    }),

    moveFile: vi.fn().mockImplementation(async (src: string, dest: string) => {
      if (!files.has(src)) {
        throw new Error(`File not found: ${src}`);
      }
      files.set(dest, files.get(src)!);
      files.delete(src);
    }),

    rmdir: vi.fn().mockImplementation(async (path: string) => {
      dirs.delete(path);
      // Delete files in dir
      for (const [filePath] of files) {
        if (filePath.startsWith(path + '/')) {
          files.delete(filePath);
        }
      }
    }),

    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockSandbox(): WorkspaceSandbox {
  const sandboxFiles = new Map<string, string | Buffer>();

  return {
    id: 'mock-sandbox-1',
    name: 'Mock Sandbox',
    provider: 'mock-sandbox',
    status: 'running',

    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn().mockResolvedValue(true),

    executeCommand: vi.fn().mockImplementation(async (command: string): Promise<CommandResult> => {
      return {
        success: true,
        stdout: `Command executed: ${command}`,
        stderr: '',
        exitCode: 0,
        executionTimeMs: 5,
      };
    }),

    readFile: vi.fn().mockImplementation(async (path: string) => {
      if (!sandboxFiles.has(path)) {
        throw new Error(`File not found in sandbox: ${path}`);
      }
      return sandboxFiles.get(path)!.toString();
    }),

    writeFile: vi.fn().mockImplementation(async (path: string, content: string | Buffer) => {
      sandboxFiles.set(path, content);
    }),

    listFiles: vi.fn().mockImplementation(async () => {
      return Array.from(sandboxFiles.keys());
    }),

    getInfo: vi.fn().mockResolvedValue({
      status: 'running',
      resources: {
        memoryMB: 512,
        cpuCores: 2,
      },
    }),

    syncFromFilesystem: vi.fn().mockImplementation(async (fs, paths?: string[]) => {
      const start = Date.now();
      const synced: string[] = [];
      const failed: Array<{ path: string; error: string }> = [];
      let bytesTransferred = 0;

      // Get all files from filesystem
      const allPaths = paths ?? [];
      if (!paths) {
        // List all files (simplified mock - just get top level)
        try {
          const entries = await fs.readdir('/');
          for (const entry of entries) {
            if (entry.type === 'file') {
              allPaths.push('/' + entry.name);
            }
          }
        } catch {
          // Ignore
        }
      }

      for (const path of allPaths) {
        try {
          const content = await fs.readFile(path);
          sandboxFiles.set(path, content);
          synced.push(path);
          bytesTransferred += typeof content === 'string' ? content.length : content.length;
        } catch (err) {
          failed.push({ path, error: String(err) });
        }
      }

      return {
        synced,
        failed,
        bytesTransferred,
        duration: Date.now() - start,
      };
    }),

    syncToFilesystem: vi.fn().mockImplementation(async (fs, paths?: string[]) => {
      const start = Date.now();
      const synced: string[] = [];
      const failed: Array<{ path: string; error: string }> = [];
      let bytesTransferred = 0;

      const pathsToSync = paths ?? Array.from(sandboxFiles.keys());

      for (const path of pathsToSync) {
        try {
          const content = sandboxFiles.get(path);
          if (content !== undefined) {
            await fs.writeFile(path, content);
            synced.push(path);
            bytesTransferred += typeof content === 'string' ? content.length : content.length;
          }
        } catch (err) {
          failed.push({ path, error: String(err) });
        }
      }

      return {
        synced,
        failed,
        bytesTransferred,
        duration: Date.now() - start,
      };
    }),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Workspace', () => {
  let mockFs: WorkspaceFilesystem;
  let mockSandbox: WorkspaceSandbox;

  beforeEach(() => {
    mockFs = createMockFilesystem();
    mockSandbox = createMockSandbox();
  });

  // ===========================================================================
  // Constructor
  // ===========================================================================
  describe('constructor', () => {
    it('should create workspace with filesystem only', () => {
      const workspace = new Workspace({ filesystem: mockFs });

      expect(workspace.id).toBeDefined();
      expect(workspace.name).toContain('workspace-');
      expect(workspace.status).toBe('pending');
      expect(workspace.filesystem).toBe(mockFs);
      expect(workspace.sandbox).toBeUndefined();
    });

    it('should create workspace with sandbox only', () => {
      const workspace = new Workspace({ sandbox: mockSandbox });

      expect(workspace.sandbox).toBe(mockSandbox);
      expect(workspace.filesystem).toBeUndefined();
    });

    it('should create workspace with both filesystem and sandbox', () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
      });

      expect(workspace.filesystem).toBe(mockFs);
      expect(workspace.sandbox).toBe(mockSandbox);
    });

    it('should accept custom id and name', () => {
      const workspace = new Workspace({
        id: 'custom-id',
        name: 'Custom Workspace',
        filesystem: mockFs,
      });

      expect(workspace.id).toBe('custom-id');
      expect(workspace.name).toBe('Custom Workspace');
    });

    it('should throw when neither filesystem nor sandbox nor skillsPaths provided', () => {
      expect(() => new Workspace({})).toThrow('Workspace requires at least a filesystem, sandbox, or skillsPaths');
    });

    it('should auto-initialize when autoInit is true', async () => {
      const _workspace = new Workspace({
        filesystem: mockFs,
        autoInit: true,
      });

      // Give time for async init
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockFs.init).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // File Operations
  // ===========================================================================
  describe('file operations', () => {
    let workspace: Workspace;

    beforeEach(() => {
      workspace = new Workspace({
        filesystem: mockFs,
        safety: { requireReadBeforeWrite: false },
      });
    });

    it('should read file from filesystem', async () => {
      const files = new Map<string, string>([['/test.txt', 'Hello World']]);
      mockFs = createMockFilesystem(files);
      workspace = new Workspace({
        filesystem: mockFs,
        safety: { requireReadBeforeWrite: false },
      });

      const content = await workspace.readFile('/test.txt');
      expect(content).toBe('Hello World');
      expect(mockFs.readFile).toHaveBeenCalledWith('/test.txt', undefined);
    });

    it('should write file to filesystem', async () => {
      await workspace.writeFile('/test.txt', 'Hello World');
      expect(mockFs.writeFile).toHaveBeenCalledWith('/test.txt', 'Hello World', undefined);
    });

    it('should list directory contents', async () => {
      const files = new Map<string, string>([['/dir/file.txt', 'content']]);
      mockFs = createMockFilesystem(files);
      workspace = new Workspace({
        filesystem: mockFs,
        safety: { requireReadBeforeWrite: false },
      });

      await workspace.readdir('/dir');
      expect(mockFs.readdir).toHaveBeenCalledWith('/dir', undefined);
    });

    it('should check if path exists', async () => {
      const files = new Map<string, string>([['/exists.txt', 'content']]);
      mockFs = createMockFilesystem(files);
      workspace = new Workspace({
        filesystem: mockFs,
        safety: { requireReadBeforeWrite: false },
      });

      const exists = await workspace.exists('/exists.txt');
      expect(exists).toBe(true);
    });

    it('should update lastAccessedAt on file operations', async () => {
      const initialAccess = workspace.lastAccessedAt;
      await new Promise(resolve => setTimeout(resolve, 5));

      await workspace.writeFile('/test.txt', 'content');
      expect(workspace.lastAccessedAt.getTime()).toBeGreaterThan(initialAccess.getTime());
    });

    it('should throw FilesystemNotAvailableError when no filesystem', async () => {
      const sandboxOnly = new Workspace({ sandbox: mockSandbox });

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
    let workspace: Workspace;

    beforeEach(() => {
      workspace = new Workspace({ sandbox: mockSandbox });
    });

    it('should execute command in sandbox', async () => {
      const result = await workspace.executeCommand('ls', ['-la']);

      expect(result.success).toBe(true);
      expect(mockSandbox.executeCommand).toHaveBeenCalledWith('ls', ['-la'], undefined);
    });

    it('should throw SandboxNotAvailableError when no sandbox', async () => {
      const fsOnly = new Workspace({ filesystem: mockFs });

      await expect(fsOnly.executeCommand('cmd')).rejects.toThrow(SandboxNotAvailableError);
    });
  });

  // ===========================================================================
  // Search Operations
  // ===========================================================================
  describe('search operations', () => {
    it('should have canBM25=true when bm25 is enabled', () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
      });

      expect(workspace.canBM25).toBe(true);
      expect(workspace.canVector).toBe(false);
      expect(workspace.canHybrid).toBe(false);
    });

    it('should have canBM25=false when bm25 not configured', () => {
      const workspace = new Workspace({ filesystem: mockFs });

      expect(workspace.canBM25).toBe(false);
    });

    it('should index and search content', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
      });

      await workspace.index('/doc1.txt', 'The quick brown fox jumps over the lazy dog');
      await workspace.index('/doc2.txt', 'A lazy cat sleeps all day');

      const results = await workspace.search('lazy');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.id === '/doc1.txt')).toBe(true);
    });

    it('should support indexMany', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
      });

      await workspace.indexMany([
        { path: '/doc1.txt', content: 'First document' },
        { path: '/doc2.txt', content: 'Second document' },
      ]);

      const results = await workspace.search('document');
      expect(results.length).toBe(2);
    });

    it('should unindex document', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
      });

      await workspace.index('/doc1.txt', 'Some content');
      await workspace.unindex('/doc1.txt');

      const results = await workspace.search('content');
      expect(results.length).toBe(0);
    });

    it('should rebuild index from filesystem', async () => {
      const files = new Map<string, string>([
        ['/docs/file1.txt', 'Content of file one'],
        ['/docs/file2.txt', 'Content of file two'],
      ]);
      mockFs = createMockFilesystem(files);

      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
        autoIndexPaths: ['/docs'],
      });

      await workspace.rebuildIndex();

      const results = await workspace.search('Content');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should throw SearchNotAvailableError when search not configured', async () => {
      const workspace = new Workspace({ filesystem: mockFs });

      await expect(workspace.index('/test', 'content')).rejects.toThrow(SearchNotAvailableError);
      await expect(workspace.search('query')).rejects.toThrow(SearchNotAvailableError);
      await expect(workspace.rebuildIndex()).rejects.toThrow(SearchNotAvailableError);
    });

    it('should support search with topK and minScore options', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
      });

      await workspace.indexMany([
        { path: '/doc1.txt', content: 'machine learning is great' },
        { path: '/doc2.txt', content: 'machine learning algorithms' },
        { path: '/doc3.txt', content: 'deep learning neural networks' },
      ]);

      const resultsTopK = await workspace.search('learning', { topK: 2 });
      expect(resultsTopK.length).toBe(2);

      const resultsAll = await workspace.search('learning');
      expect(resultsAll.length).toBe(3);
    });

    it('should return lineRange in search results', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
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
      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
      });

      await workspace.index('/doc.txt', 'Test content', { metadata: { category: 'test', priority: 1 } });

      const results = await workspace.search('test');
      expect(results[0]?.metadata?.category).toBe('test');
      expect(results[0]?.metadata?.priority).toBe(1);
    });
  });

  // ===========================================================================
  // Vector Search Operations
  // ===========================================================================
  describe('vector search operations', () => {
    let mockVectorStore: any;
    let mockEmbedder: any;

    beforeEach(() => {
      mockEmbedder = vi.fn(async (text: string) => {
        // Simple mock: convert text to predictable embedding
        const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return [hash % 100, (hash * 2) % 100, (hash * 3) % 100];
      });

      mockVectorStore = {
        upsert: vi.fn(async () => {}),
        query: vi.fn(async () => []),
        deleteVector: vi.fn(async () => {}),
      };
    });

    it('should have canVector=true when vector configured', () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        vectorStore: mockVectorStore,
        embedder: mockEmbedder,
      });

      expect(workspace.canVector).toBe(true);
      expect(workspace.canBM25).toBe(false);
      expect(workspace.canHybrid).toBe(false);
    });

    it('should index and search with vector', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        vectorStore: mockVectorStore,
        embedder: mockEmbedder,
      });

      await workspace.index('/doc1.txt', 'Hello world');

      expect(mockEmbedder).toHaveBeenCalledWith('Hello world');
      expect(mockVectorStore.upsert).toHaveBeenCalled();

      mockVectorStore.query.mockResolvedValue([
        { id: '/doc1.txt', score: 0.95, metadata: { id: '/doc1.txt', text: 'Hello world' } },
      ]);

      const results = await workspace.search('hello');
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('/doc1.txt');
      expect(results[0]?.score).toBe(0.95);
    });

    it('should support filter in vector search', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        vectorStore: mockVectorStore,
        embedder: mockEmbedder,
      });

      await workspace.index('/doc1.txt', 'Test content');

      mockVectorStore.query.mockResolvedValue([]);

      await workspace.search('test', { filter: { category: 'docs' } });

      expect(mockVectorStore.query).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { category: 'docs' },
        }),
      );
    });

    it('should unindex from vector store', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        vectorStore: mockVectorStore,
        embedder: mockEmbedder,
      });

      await workspace.index('/doc1.txt', 'Test content');
      await workspace.unindex('/doc1.txt');

      expect(mockVectorStore.deleteVector).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '/doc1.txt',
        }),
      );
    });
  });

  // ===========================================================================
  // Hybrid Search Operations
  // ===========================================================================
  describe('hybrid search operations', () => {
    let mockVectorStore: any;
    let mockEmbedder: any;

    beforeEach(() => {
      mockEmbedder = vi.fn(async (text: string) => {
        const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return [hash % 100, (hash * 2) % 100, (hash * 3) % 100];
      });

      mockVectorStore = {
        upsert: vi.fn(async () => {}),
        query: vi.fn(async () => []),
        deleteVector: vi.fn(async () => {}),
      };
    });

    it('should have canHybrid=true when both BM25 and vector configured', () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
        vectorStore: mockVectorStore,
        embedder: mockEmbedder,
      });

      expect(workspace.canBM25).toBe(true);
      expect(workspace.canVector).toBe(true);
      expect(workspace.canHybrid).toBe(true);
    });

    it('should use hybrid search by default when both configured', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
        vectorStore: mockVectorStore,
        embedder: mockEmbedder,
      });

      await workspace.index('/doc1.txt', 'Hello world');

      mockVectorStore.query.mockResolvedValue([
        { id: '/doc1.txt', score: 0.8, metadata: { id: '/doc1.txt', text: 'Hello world' } },
      ]);

      const results = await workspace.search('hello');

      // Should have both BM25 and vector scores
      expect(results[0]?.scoreDetails?.bm25).toBeDefined();
      expect(results[0]?.scoreDetails?.vector).toBeDefined();
    });

    it('should support explicit mode selection', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
        vectorStore: mockVectorStore,
        embedder: mockEmbedder,
      });

      await workspace.index('/doc1.txt', 'Hello world');

      // Force BM25 only
      const bm25Results = await workspace.search('hello', { mode: 'bm25' });
      expect(bm25Results[0]?.scoreDetails?.bm25).toBeDefined();
      expect(bm25Results[0]?.scoreDetails?.vector).toBeUndefined();

      // Force vector only
      mockVectorStore.query.mockResolvedValue([
        { id: '/doc1.txt', score: 0.9, metadata: { id: '/doc1.txt', text: 'Hello world' } },
      ]);

      const vectorResults = await workspace.search('hello', { mode: 'vector' });
      expect(vectorResults[0]?.scoreDetails?.vector).toBeDefined();
      expect(vectorResults[0]?.scoreDetails?.bm25).toBeUndefined();
    });

    it('should support custom vectorWeight in hybrid search', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
        vectorStore: mockVectorStore,
        embedder: mockEmbedder,
      });

      await workspace.index('/doc1.txt', 'Hello world');

      mockVectorStore.query.mockResolvedValue([
        { id: '/doc1.txt', score: 0.8, metadata: { id: '/doc1.txt', text: 'Hello world' } },
      ]);

      // With vectorWeight 0.7: combined = 0.7 * 0.8 + 0.3 * 1.0 = 0.86
      const results = await workspace.search('hello', { vectorWeight: 0.7 });
      expect(results[0]?.score).toBeCloseTo(0.86, 1);
    });

    it('should merge results from both search methods', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
        vectorStore: mockVectorStore,
        embedder: mockEmbedder,
      });

      // BM25 will find doc1
      await workspace.index('/doc1.txt', 'Hello world');
      // Vector will also find doc2
      await workspace.index('/doc2.txt', 'Different content');

      mockVectorStore.query.mockResolvedValue([
        { id: '/doc1.txt', score: 0.9, metadata: { id: '/doc1.txt', text: 'Hello world' } },
        { id: '/doc2.txt', score: 0.7, metadata: { id: '/doc2.txt', text: 'Different content' } },
      ]);

      const results = await workspace.search('hello', { mode: 'hybrid' });

      // Should have results from both sources
      const ids = results.map(r => r.id);
      expect(ids).toContain('/doc1.txt');
    });
  });

  // ===========================================================================
  // Skills
  // ===========================================================================
  describe('skills', () => {
    it('should return undefined when no skillsPaths configured', () => {
      const workspace = new Workspace({ filesystem: mockFs });
      expect(workspace.skills).toBeUndefined();
    });

    it('should allow skills without filesystem (read-only mode)', () => {
      const workspace = new Workspace({
        sandbox: mockSandbox,
        skillsPaths: ['/skills'],
      });

      // Skills should be available via LocalSkillSource (read-only)
      expect(workspace.skills).toBeDefined();
      expect(workspace.skills?.isWritable).toBe(false);
    });

    it('should return undefined when no skillsPaths configured', () => {
      const workspace = new Workspace({
        sandbox: mockSandbox,
      });
      expect(workspace.skills).toBeUndefined();
    });

    it('should return skills instance when skillsPaths and filesystem configured', () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        skillsPaths: ['/skills'],
      });
      expect(workspace.skills).toBeDefined();
    });

    it('should return same skills instance on repeated access', () => {
      const workspace = new Workspace({
        filesystem: mockFs,
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
      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
      });

      await workspace.init();

      expect(workspace.status).toBe('ready');
      expect(mockFs.init).toHaveBeenCalled();
      expect(mockSandbox.start).toHaveBeenCalled();
    });

    it('should pause workspace', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
      });

      await workspace.init();
      await workspace.pause();

      expect(workspace.status).toBe('paused');
      expect(mockSandbox.stop).toHaveBeenCalled();
    });

    it('should resume workspace', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
      });

      await workspace.init();
      await workspace.pause();
      await workspace.resume();

      expect(workspace.status).toBe('ready');
    });

    it('should destroy workspace', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
      });

      await workspace.init();
      await workspace.destroy();

      expect(workspace.status).toBe('destroyed');
      expect(mockSandbox.destroy).toHaveBeenCalled();
      expect(mockFs.destroy).toHaveBeenCalled();
    });

    it('should set status to error on init failure', async () => {
      (mockFs.init as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Init failed'));

      const workspace = new Workspace({ filesystem: mockFs });

      await expect(workspace.init()).rejects.toThrow('Init failed');
      expect(workspace.status).toBe('error');
    });
  });

  // ===========================================================================
  // Sync Operations
  // ===========================================================================
  describe('sync operations', () => {
    it('should sync files to sandbox', async () => {
      const files = new Map<string, string>([['/app.py', 'print("hello")']]);
      mockFs = createMockFilesystem(files);

      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
        safety: { requireReadBeforeWrite: false },
      });

      const result = await workspace.syncToSandbox(['/app.py']);

      expect(result.synced).toContain('/app.py');
      expect(result.failed).toHaveLength(0);
      // Verify syncFromFilesystem was called on the sandbox
      expect(mockSandbox.syncFromFilesystem).toHaveBeenCalledWith(mockFs, ['/app.py']);
    });

    it('should sync files from sandbox', async () => {
      // First sync a file to the sandbox so there's something to sync back
      const files = new Map<string, string>([['/output.txt', 'output content']]);
      mockFs = createMockFilesystem(files);

      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
        safety: { requireReadBeforeWrite: false },
      });

      // Sync to sandbox first so there's content to sync back
      await workspace.syncToSandbox(['/output.txt']);

      const result = await workspace.syncFromSandbox(['/output.txt']);

      expect(result.synced).toContain('/output.txt');
      // Verify syncToFilesystem was called on the sandbox
      expect(mockSandbox.syncToFilesystem).toHaveBeenCalledWith(mockFs, ['/output.txt']);
    });

    it('should throw when sync called without both fs and sandbox', async () => {
      const fsOnly = new Workspace({
        filesystem: mockFs,
        safety: { requireReadBeforeWrite: false },
      });

      await expect(fsOnly.syncToSandbox()).rejects.toThrow('Workspace does not have a sandbox configured');
    });
  });

  // ===========================================================================
  // Snapshots
  // ===========================================================================
  describe('snapshots', () => {
    it('should create snapshot of workspace files', async () => {
      const files = new Map<string, string>([
        ['/file1.txt', 'content1'],
        ['/file2.txt', 'content2'],
      ]);
      mockFs = createMockFilesystem(files);

      const workspace = new Workspace({
        filesystem: mockFs,
        safety: { requireReadBeforeWrite: false },
      });
      const snapshot = await workspace.snapshot({ name: 'my-snapshot' });

      expect(snapshot.name).toBe('my-snapshot');
      expect(snapshot.workspaceId).toBe(workspace.id);
      expect(snapshot.data).toHaveProperty('/file1.txt');
      expect(snapshot.data).toHaveProperty('/file2.txt');
    });

    it('should restore snapshot', async () => {
      const files = new Map<string, string>();
      mockFs = createMockFilesystem(files);

      const workspace = new Workspace({
        filesystem: mockFs,
        safety: { requireReadBeforeWrite: false },
      });

      const snapshot = {
        id: 'snap-1',
        workspaceId: workspace.id,
        createdAt: new Date(),
        size: 100,
        data: {
          '/restored.txt': 'restored content',
        },
      };

      await workspace.restore(snapshot);

      expect(mockFs.writeFile).toHaveBeenCalledWith('/restored.txt', 'restored content', { recursive: true });
    });

    it('should restore with merge option', async () => {
      const files = new Map<string, string>([['/existing.txt', 'existing']]);
      mockFs = createMockFilesystem(files);

      const workspace = new Workspace({
        filesystem: mockFs,
        safety: { requireReadBeforeWrite: false },
      });

      const snapshot = {
        id: 'snap-1',
        workspaceId: workspace.id,
        createdAt: new Date(),
        size: 100,
        data: {
          '/new.txt': 'new content',
        },
      };

      await workspace.restore(snapshot, { merge: true });

      // Should not delete existing files when merging
      expect(mockFs.deleteFile).not.toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalledWith('/new.txt', 'new content', { recursive: true });
    });
  });

  // ===========================================================================
  // State Storage
  // ===========================================================================
  describe('state storage', () => {
    it('should have state when filesystem is available', () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        safety: { requireReadBeforeWrite: false },
      });
      expect(workspace.state).toBeDefined();
    });

    it('should not have state when only sandbox is available', () => {
      const workspace = new Workspace({ sandbox: mockSandbox });
      expect(workspace.state).toBeUndefined();
    });

    it('should set and get state values', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        safety: { requireReadBeforeWrite: false },
      });

      await workspace.state!.set('myKey', { value: 42 });
      const result = await workspace.state!.get<{ value: number }>('myKey');

      expect(result).toEqual({ value: 42 });
    });

    it('should return null for non-existent keys', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        safety: { requireReadBeforeWrite: false },
      });

      const result = await workspace.state!.get('nonExistent');
      expect(result).toBeNull();
    });

    it('should check if key exists', async () => {
      const files = new Map<string, string>([['/.state/myKey.json', '{"value":1}']]);
      mockFs = createMockFilesystem(files);
      const workspace = new Workspace({
        filesystem: mockFs,
        safety: { requireReadBeforeWrite: false },
      });

      const exists = await workspace.state!.has('myKey');
      expect(exists).toBe(true);
    });

    it('should delete state value', async () => {
      const files = new Map<string, string>([['/.state/myKey.json', '{"value":1}']]);
      mockFs = createMockFilesystem(files);
      const workspace = new Workspace({
        filesystem: mockFs,
        safety: { requireReadBeforeWrite: false },
      });

      const deleted = await workspace.state!.delete('myKey');
      expect(deleted).toBe(true);
      expect(mockFs.deleteFile).toHaveBeenCalled();
    });

    it('should list state keys', async () => {
      const files = new Map<string, string>([
        ['/.state/key1.json', '{}'],
        ['/.state/key2.json', '{}'],
      ]);
      mockFs = createMockFilesystem(files);
      const workspace = new Workspace({
        filesystem: mockFs,
        safety: { requireReadBeforeWrite: false },
      });

      const keys = await workspace.state!.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });
  });

  // ===========================================================================
  // Info
  // ===========================================================================
  describe('getInfo', () => {
    it('should return workspace info', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
      });

      const info = await workspace.getInfo();

      expect(info.id).toBe(workspace.id);
      expect(info.name).toBe(workspace.name);
      expect(info.status).toBe('pending');
      expect(info.filesystem?.provider).toBe('mock');
      expect(info.sandbox?.provider).toBe('mock-sandbox');
    });

    it('should return info without sandbox when not configured', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        safety: { requireReadBeforeWrite: false },
      });

      const info = await workspace.getInfo();

      expect(info.filesystem).toBeDefined();
      expect(info.sandbox).toBeUndefined();
    });
  });

  // ===========================================================================
  // Path Context
  // ===========================================================================
  describe('getPathContext', () => {
    it('should return same-context for local filesystem + local sandbox', () => {
      // Create mocks that identify as 'local' provider
      const localFs = {
        ...mockFs,
        provider: 'local',
        basePath: '/path/to/workspace',
      };
      const localSandbox = {
        ...mockSandbox,
        provider: 'local',
        workingDirectory: '/path/to/workspace',
        scriptDirectory: '/path/to/workspace/.mastra/sandbox',
      };

      const workspace = new Workspace({
        filesystem: localFs as unknown as WorkspaceFilesystem,
        sandbox: localSandbox as unknown as WorkspaceSandbox,
      });

      const context = workspace.getPathContext();

      expect(context.type).toBe('same-context');
      expect(context.requiresSync).toBe(false);
      expect(context.filesystem?.provider).toBe('local');
      expect(context.filesystem?.basePath).toBe('/path/to/workspace');
      expect(context.sandbox?.provider).toBe('local');
      expect(context.instructions).toContain('/path/to/workspace');
    });

    it('should return cross-context for different providers', () => {
      // AgentFS (provider: 'agentfs') + LocalSandbox (provider: 'local')
      const agentFs = {
        ...mockFs,
        provider: 'agentfs',
      };
      const localSandbox = {
        ...mockSandbox,
        provider: 'local',
        workingDirectory: '/tmp/sandbox',
      };

      const workspace = new Workspace({
        filesystem: agentFs as unknown as WorkspaceFilesystem,
        sandbox: localSandbox as unknown as WorkspaceSandbox,
      });

      const context = workspace.getPathContext();

      expect(context.type).toBe('cross-context');
      expect(context.requiresSync).toBe(true);
      expect(context.instructions).toContain('sync');
    });

    it('should return filesystem-only when no sandbox configured', () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        safety: { requireReadBeforeWrite: false },
      });

      const context = workspace.getPathContext();

      expect(context.type).toBe('filesystem-only');
      expect(context.requiresSync).toBe(false);
      expect(context.filesystem?.provider).toBe('mock');
      expect(context.sandbox).toBeUndefined();
    });

    it('should return sandbox-only when no filesystem configured', () => {
      const workspace = new Workspace({ sandbox: mockSandbox });

      const context = workspace.getPathContext();

      expect(context.type).toBe('sandbox-only');
      expect(context.requiresSync).toBe(false);
      expect(context.filesystem).toBeUndefined();
      expect(context.sandbox?.provider).toBe('mock-sandbox');
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
