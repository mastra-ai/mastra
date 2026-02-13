import { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import { Workspace } from '@mastra/core/workspace';
import type { WorkspaceFilesystem, FileEntry, FileStat } from '@mastra/core/workspace';
import { describe, it, expect, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import { createTestServerContext } from './test-utils';
import {
  GET_WORKSPACE_ROUTE,
  WORKSPACE_FS_READ_ROUTE,
  WORKSPACE_FS_WRITE_ROUTE,
  WORKSPACE_FS_LIST_ROUTE,
  WORKSPACE_FS_DELETE_ROUTE,
  WORKSPACE_FS_MKDIR_ROUTE,
  WORKSPACE_FS_STAT_ROUTE,
  WORKSPACE_SEARCH_ROUTE,
  WORKSPACE_INDEX_ROUTE,
  WORKSPACE_LIST_SKILLS_ROUTE,
  WORKSPACE_GET_SKILL_ROUTE,
  WORKSPACE_LIST_SKILL_REFERENCES_ROUTE,
  WORKSPACE_GET_SKILL_REFERENCE_ROUTE,
  WORKSPACE_SEARCH_SKILLS_ROUTE,
} from './workspace';

// =============================================================================
// Mock Filesystem Factory
// =============================================================================

/**
 * Creates a mock filesystem that implements WorkspaceFilesystem interface.
 * Uses an in-memory Map for file storage - no real file I/O.
 */
function createMockFilesystem(
  files: Map<string, string> = new Map(),
  options: { readOnly?: boolean } = {},
): WorkspaceFilesystem {
  const directories = new Set<string>();

  // Initialize directories from file paths
  for (const filePath of files.keys()) {
    let dir = filePath;
    while (dir.includes('/')) {
      dir = dir.substring(0, dir.lastIndexOf('/'));
      if (dir) directories.add(dir);
    }
  }

  return {
    // Required identity properties
    id: 'mock-filesystem',
    name: 'MockFilesystem',
    provider: 'mock',
    status: 'ready' as const,
    readOnly: options.readOnly ?? false,

    readFile: vi.fn(async (path: string) => {
      const content = files.get(path);
      if (content === undefined) {
        const error = new Error(`File not found: ${path}`);
        (error as any).code = 'ENOENT';
        throw error;
      }
      return content;
    }),
    writeFile: vi.fn(async (path: string, content: string | Buffer) => {
      files.set(path, typeof content === 'string' ? content : content.toString());
    }),
    appendFile: vi.fn(async (path: string, content: string | Buffer) => {
      const existing = files.get(path) ?? '';
      files.set(path, existing + (typeof content === 'string' ? content : content.toString()));
    }),
    readdir: vi.fn(async (path: string): Promise<FileEntry[]> => {
      const entries: FileEntry[] = [];
      const prefix = path === '/' ? '/' : `${path}/`;

      // Find immediate children
      for (const [filePath, content] of files) {
        if (filePath.startsWith(prefix)) {
          const relativePath = filePath.substring(prefix.length);
          const parts = relativePath.split('/');
          const name = parts[0]!;

          if (!entries.some(e => e.name === name)) {
            const isDir = parts.length > 1;
            entries.push({
              name,
              type: isDir ? 'directory' : 'file',
              size: isDir ? 0 : content.length,
            });
          }
        }
      }

      // Add directories
      for (const dir of directories) {
        if (dir.startsWith(prefix) || (path === '/' && !dir.includes('/'))) {
          const relativePath = path === '/' ? dir : dir.substring(prefix.length);
          const parts = relativePath.split('/');
          const name = parts[0]!;

          if (name && !entries.some(e => e.name === name)) {
            entries.push({ name, type: 'directory', size: 0 });
          }
        }
      }

      return entries;
    }),
    exists: vi.fn(async (path: string) => path === '/' || files.has(path) || directories.has(path)),
    mkdir: vi.fn(async (path: string) => {
      directories.add(path);
    }),
    deleteFile: vi.fn(async (path: string) => {
      if (!files.has(path)) {
        const error = new Error(`File not found: ${path}`);
        (error as any).code = 'ENOENT';
        throw error;
      }
      files.delete(path);
    }),
    rmdir: vi.fn(async () => {}),
    copyFile: vi.fn(async (src: string, dest: string) => {
      const content = files.get(src);
      if (content === undefined) {
        const error = new Error(`File not found: ${src}`);
        (error as any).code = 'ENOENT';
        throw error;
      }
      files.set(dest, content);
    }),
    moveFile: vi.fn(async (src: string, dest: string) => {
      const content = files.get(src);
      if (content === undefined) {
        const error = new Error(`File not found: ${src}`);
        (error as any).code = 'ENOENT';
        throw error;
      }
      files.set(dest, content);
      files.delete(src);
    }),
    stat: vi.fn(async (path: string): Promise<FileStat> => {
      const name = path.split('/').pop() || path;
      if (files.has(path)) {
        return {
          name,
          path,
          type: 'file',
          size: files.get(path)!.length,
          createdAt: new Date(),
          modifiedAt: new Date(),
          mimeType: 'text/plain',
        };
      }
      if (directories.has(path) || path === '/') {
        return {
          name: path === '/' ? '/' : name,
          path,
          type: 'directory',
          size: 0,
          createdAt: new Date(),
          modifiedAt: new Date(),
        };
      }
      const error = new Error(`Not found: ${path}`);
      (error as any).code = 'ENOENT';
      throw error;
    }),
  } as WorkspaceFilesystem;
}

// =============================================================================
// Mock Skills Factory
// =============================================================================

interface SkillSearchResult {
  skillName: string;
  source: string;
  content: string;
  score: number;
}

/**
 * Creates mock skills implementation for testing.
 */
function createMockSkills(skillsData: Map<string, any> = new Map()) {
  return {
    list: vi.fn(async () =>
      Array.from(skillsData.values()).map(s => ({
        name: s.name,
        description: s.description,
        license: s.license,
      })),
    ),
    get: vi.fn(async (name: string) => skillsData.get(name) ?? null),
    has: vi.fn(async (name: string) => skillsData.has(name)),
    search: vi.fn(async (): Promise<SkillSearchResult[]> => []),
    listReferences: vi.fn(async () => ['api.md', 'guide.md']),
    getReference: vi.fn(async (): Promise<string | null> => 'Reference content'),
    listScripts: vi.fn(async () => []),
    listAssets: vi.fn(async () => []),
    maybeRefresh: vi.fn(async () => {}),
  };
}

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Creates a real Workspace with mock filesystem.
 */
function createWorkspace(
  id: string,
  options: {
    name?: string;
    files?: Map<string, string>;
    skills?: ReturnType<typeof createMockSkills>;
    bm25?: boolean;
    readOnly?: boolean;
  } = {},
): Workspace {
  const filesystem = createMockFilesystem(options.files ?? new Map(), { readOnly: options.readOnly });

  // Create workspace with mock filesystem
  const workspace = new Workspace({
    id,
    name: options.name ?? `Workspace ${id}`,
    filesystem,
    bm25: options.bm25,
  });

  // Inject mock skills if provided (accessing private field for testing)
  if (options.skills) {
    (workspace as any)._skills = options.skills;
    (workspace as any)._config = { ...(workspace as any)._config, skills: ['mock'] };
  }

  return workspace;
}

/**
 * Creates a real Mastra instance with the given workspace registered.
 */
function createMastra(workspace?: Workspace): Mastra {
  const mastra = new Mastra({ logger: false });
  if (workspace) {
    mastra.addWorkspace(workspace);
  }
  return mastra;
}

// =============================================================================
// Tests
// =============================================================================

describe('Workspace Handlers', () => {
  // ===========================================================================
  // GET_WORKSPACE_ROUTE
  // ===========================================================================
  describe('GET_WORKSPACE_ROUTE', () => {
    it('should return isWorkspaceConfigured: false when workspace not found', async () => {
      const mastra = createMastra();
      const result = await GET_WORKSPACE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'nonexistent',
      });

      expect(result).toEqual({ isWorkspaceConfigured: false });
    });

    it('should return workspace info with capabilities', async () => {
      const workspace = createWorkspace('test-workspace', { name: 'Test Workspace', bm25: true });
      const mastra = createMastra(workspace);

      const result = await GET_WORKSPACE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
      });

      expect(result).toEqual({
        isWorkspaceConfigured: true,
        id: 'test-workspace',
        name: 'Test Workspace',
        status: 'pending', // Workspace starts as pending until init() is called
        capabilities: {
          hasFilesystem: true,
          hasSandbox: false,
          canBM25: true,
          canVector: false,
          canHybrid: false,
          hasSkills: false,
        },
        safety: {
          readOnly: false,
        },
      });
    });
  });

  // ===========================================================================
  // Filesystem Routes
  // ===========================================================================
  describe('WORKSPACE_FS_READ_ROUTE', () => {
    it('should read file content', async () => {
      const files = new Map([['/test.txt', 'Hello World']]);
      const workspace = createWorkspace('test-workspace', { files });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_FS_READ_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        path: '/test.txt',
        encoding: 'utf-8',
      });

      expect(result.content).toBe('Hello World');
      expect(result.path).toBe('/test.txt');
    });

    it('should throw 404 when file not found', async () => {
      const workspace = createWorkspace('test-workspace');
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_FS_READ_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          path: '/nonexistent.txt',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_FS_READ_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          path: '/nonexistent.txt',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });

    it('should throw 404 when workspace not found', async () => {
      const mastra = createMastra();

      await expect(
        WORKSPACE_FS_READ_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'nonexistent-workspace',
          path: '/test.txt',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_FS_READ_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'nonexistent-workspace',
          path: '/test.txt',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });

    it('should throw 400 when path parameter missing', async () => {
      const workspace = createWorkspace('test-workspace');
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_FS_READ_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          path: undefined as unknown as string,
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_FS_READ_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          path: undefined as unknown as string,
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(400);
      }
    });
  });

  describe('WORKSPACE_FS_WRITE_ROUTE', () => {
    it('should write file content', async () => {
      const files = new Map<string, string>();
      const workspace = createWorkspace('test-workspace', { files });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_FS_WRITE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        path: '/new.txt',
        content: 'New content',
        encoding: 'utf-8',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/new.txt');
      expect(workspace.filesystem!.writeFile).toHaveBeenCalledWith('/new.txt', 'New content', { recursive: true });
    });

    it('should handle base64 encoding', async () => {
      const files = new Map<string, string>();
      const workspace = createWorkspace('test-workspace', { files });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_FS_WRITE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        path: '/binary.bin',
        content: 'SGVsbG8=', // "Hello" in base64
        encoding: 'base64',
      });

      expect(result.success).toBe(true);
      expect(workspace.filesystem!.writeFile).toHaveBeenCalled();
    });

    it('should throw 400 when path and content missing', async () => {
      const workspace = createWorkspace('test-workspace');
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_FS_WRITE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          path: undefined as unknown as string,
          content: undefined as unknown as string,
          encoding: 'utf-8',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_FS_WRITE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          path: undefined as unknown as string,
          content: undefined as unknown as string,
          encoding: 'utf-8',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(400);
      }
    });

    it('should throw 403 when workspace is read-only', async () => {
      const workspace = createWorkspace('test-workspace', { readOnly: true });
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_FS_WRITE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          path: '/test.txt',
          content: 'content',
          encoding: 'utf-8',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_FS_WRITE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          path: '/test.txt',
          content: 'content',
          encoding: 'utf-8',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(403);
        expect((e as HTTPException).message).toBe('Workspace is in read-only mode');
      }
    });
  });

  describe('WORKSPACE_FS_LIST_ROUTE', () => {
    it('should list directory contents', async () => {
      const files = new Map([['/dir/file.txt', 'content']]);
      const workspace = createWorkspace('test-workspace', { files });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_FS_LIST_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        path: '/dir',
      });

      expect(result.path).toBe('/dir');
      expect(result.entries).toBeDefined();
    });

    it('should list root directory', async () => {
      const files = new Map([
        ['/file1.txt', 'content1'],
        ['/subdir/file2.txt', 'content2'],
      ]);
      const workspace = createWorkspace('test-workspace', { files });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_FS_LIST_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        path: '/',
      });

      expect(result.path).toBe('/');
      expect(result.entries).toBeDefined();
    });
  });

  describe('WORKSPACE_FS_DELETE_ROUTE', () => {
    it('should delete file', async () => {
      const files = new Map([['/test.txt', 'content']]);
      const workspace = createWorkspace('test-workspace', { files });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_FS_DELETE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        path: '/test.txt',
      });

      expect(result.success).toBe(true);
    });

    it('should throw 404 when file not found and force is false', async () => {
      const workspace = createWorkspace('test-workspace');
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_FS_DELETE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          path: '/nonexistent.txt',
          force: false,
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_FS_DELETE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          path: '/nonexistent.txt',
          force: false,
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });

    it('should throw 403 when workspace is read-only', async () => {
      const files = new Map([['/test.txt', 'content']]);
      const workspace = createWorkspace('test-workspace', { files, readOnly: true });
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_FS_DELETE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          path: '/test.txt',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_FS_DELETE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          path: '/test.txt',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(403);
        expect((e as HTTPException).message).toBe('Workspace is in read-only mode');
      }
    });
  });

  describe('WORKSPACE_FS_MKDIR_ROUTE', () => {
    it('should create directory', async () => {
      const workspace = createWorkspace('test-workspace');
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_FS_MKDIR_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        path: '/newdir',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/newdir');
      expect(workspace.filesystem!.mkdir).toHaveBeenCalledWith('/newdir', { recursive: true });
    });

    it('should throw 403 when workspace is read-only', async () => {
      const workspace = createWorkspace('test-workspace', { readOnly: true });
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_FS_MKDIR_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          path: '/newdir',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_FS_MKDIR_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          path: '/newdir',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(403);
        expect((e as HTTPException).message).toBe('Workspace is in read-only mode');
      }
    });
  });

  describe('WORKSPACE_FS_STAT_ROUTE', () => {
    it('should return file stats', async () => {
      const files = new Map([['/test.txt', 'content']]);
      const workspace = createWorkspace('test-workspace', { files });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_FS_STAT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        path: '/test.txt',
      });

      expect(result.path).toBe('/test.txt');
      expect(result.type).toBe('file');
    });
  });

  // ===========================================================================
  // Search Routes
  // ===========================================================================
  describe('WORKSPACE_SEARCH_ROUTE', () => {
    it('should return empty results when no workspace', async () => {
      const mastra = createMastra();

      const result = await WORKSPACE_SEARCH_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'nonexistent',
        query: 'test',
        topK: 10,
      });

      expect(result.results).toEqual([]);
      expect(result.query).toBe('test');
    });

    it('should return empty results when search not configured', async () => {
      const workspace = createWorkspace('test-workspace');
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_SEARCH_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        query: 'test',
        topK: 10,
      });

      expect(result.results).toEqual([]);
    });

    it('should search with BM25', async () => {
      const workspace = createWorkspace('test-workspace', { bm25: true });
      const mastra = createMastra(workspace);

      // Index some content first
      await workspace.index('/doc.txt', 'This is a test document with some content');

      const result = await WORKSPACE_SEARCH_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        query: 'test document',
        topK: 10,
      });

      expect(result.results.length).toBeGreaterThanOrEqual(1);
      expect(result.results[0].id).toBe('/doc.txt');
    });

    it('should throw 400 when query parameter missing', async () => {
      const workspace = createWorkspace('test-workspace', { bm25: true });
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_SEARCH_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          query: undefined as unknown as string,
          topK: 10,
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SEARCH_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          query: undefined as unknown as string,
          topK: 10,
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(400);
      }
    });
  });

  describe('WORKSPACE_INDEX_ROUTE', () => {
    it('should index content', async () => {
      const workspace = createWorkspace('test-workspace', { bm25: true });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_INDEX_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        path: '/doc.txt',
        content: 'Document content',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/doc.txt');
    });

    it('should throw 400 when search not configured', async () => {
      const workspace = createWorkspace('test-workspace');
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_INDEX_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          path: '/doc.txt',
          content: 'content',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_INDEX_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          path: '/doc.txt',
          content: 'content',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(400);
      }
    });
  });

  // ===========================================================================
  // Skills Routes
  // ===========================================================================
  describe('WORKSPACE_LIST_SKILLS_ROUTE', () => {
    it('should return empty when no skills configured', async () => {
      const mastra = createMastra();

      const result = await WORKSPACE_LIST_SKILLS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'nonexistent',
      });

      expect(result.skills).toEqual([]);
      expect(result.isSkillsConfigured).toBe(false);
    });

    it('should list all skills', async () => {
      const skillsData = new Map([
        ['skill1', { name: 'skill1', description: 'Skill 1', license: 'MIT' }],
        ['skill2', { name: 'skill2', description: 'Skill 2' }],
      ]);
      const skills = createMockSkills(skillsData);
      const workspace = createWorkspace('test-workspace', { skills });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_LIST_SKILLS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
      });

      expect(result.isSkillsConfigured).toBe(true);
      expect(result.skills).toHaveLength(2);
      expect(result.skills[0].name).toBe('skill1');
    });
  });

  describe('WORKSPACE_GET_SKILL_ROUTE', () => {
    it('should get skill details', async () => {
      const skill = {
        name: 'my-skill',
        description: 'My skill',
        instructions: 'Do things',
        path: '/skills/my-skill',
        source: { type: 'local', path: '/skills/my-skill' },
        references: ['api.md'],
        scripts: [],
        assets: [],
      };
      const skillsData = new Map([['my-skill', skill]]);
      const skills = createMockSkills(skillsData);
      const workspace = createWorkspace('test-workspace', { skills });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_GET_SKILL_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        skillName: 'my-skill',
      });

      expect(result.name).toBe('my-skill');
      expect(result.instructions).toBe('Do things');
    });

    it('should throw 404 for non-existent skill', async () => {
      const skills = createMockSkills();
      const workspace = createWorkspace('test-workspace', { skills });
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_GET_SKILL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          skillName: 'nonexistent',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_GET_SKILL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          skillName: 'nonexistent',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });

    it('should throw 404 when no skills configured', async () => {
      const mastra = createMastra();

      await expect(
        WORKSPACE_GET_SKILL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'nonexistent',
          skillName: 'my-skill',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_GET_SKILL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'nonexistent',
          skillName: 'my-skill',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });
  });

  describe('WORKSPACE_LIST_SKILL_REFERENCES_ROUTE', () => {
    it('should list skill references', async () => {
      const skillsData = new Map([['my-skill', { name: 'my-skill' }]]);
      const skills = createMockSkills(skillsData);
      const workspace = createWorkspace('test-workspace', { skills });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_LIST_SKILL_REFERENCES_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        skillName: 'my-skill',
      });

      expect(result.skillName).toBe('my-skill');
      expect(result.references).toContain('api.md');
    });

    it('should throw 404 for non-existent skill', async () => {
      const skills = createMockSkills();
      const workspace = createWorkspace('test-workspace', { skills });
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_LIST_SKILL_REFERENCES_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          skillName: 'nonexistent',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_LIST_SKILL_REFERENCES_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          skillName: 'nonexistent',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });
  });

  describe('WORKSPACE_GET_SKILL_REFERENCE_ROUTE', () => {
    it('should get reference content', async () => {
      const skillsData = new Map([['my-skill', { name: 'my-skill' }]]);
      const skills = createMockSkills(skillsData);
      const workspace = createWorkspace('test-workspace', { skills });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_GET_SKILL_REFERENCE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        skillName: 'my-skill',
        referencePath: 'api.md',
      });

      expect(result.skillName).toBe('my-skill');
      expect(result.content).toBe('Reference content');
    });

    it('should throw 404 when reference not found', async () => {
      const skillsData = new Map([['my-skill', { name: 'my-skill' }]]);
      const skills = createMockSkills(skillsData);
      skills.getReference = vi.fn(async (): Promise<string | null> => null);
      const workspace = createWorkspace('test-workspace', { skills });
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_GET_SKILL_REFERENCE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          skillName: 'my-skill',
          referencePath: 'nonexistent.md',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_GET_SKILL_REFERENCE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          skillName: 'my-skill',
          referencePath: 'nonexistent.md',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });
  });

  describe('WORKSPACE_SEARCH_SKILLS_ROUTE', () => {
    it('should return empty when no skills configured', async () => {
      const mastra = createMastra();

      const result = await WORKSPACE_SEARCH_SKILLS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'nonexistent',
        query: 'test',
        topK: 10,
        includeReferences: false,
      });

      expect(result.results).toEqual([]);
    });

    it('should search skills', async () => {
      const skills = createMockSkills();
      skills.search = vi.fn(async () => [
        { skillName: 'skill1', source: 'instructions', content: 'match', score: 0.9 },
      ]);
      const workspace = createWorkspace('test-workspace', { skills });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_SEARCH_SKILLS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        query: 'test',
        topK: 5,
        includeReferences: false,
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].skillName).toBe('skill1');
    });

    it('should parse comma-separated skill names', async () => {
      const skills = createMockSkills();
      skills.search = vi.fn(async () => []);
      const workspace = createWorkspace('test-workspace', { skills });
      const mastra = createMastra(workspace);

      await WORKSPACE_SEARCH_SKILLS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        query: 'test',
        topK: 10,
        includeReferences: false,
        skillNames: 'skill1,skill2',
      });

      expect(skills.search).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          skillNames: ['skill1', 'skill2'],
        }),
      );
    });
  });

  // ===========================================================================
  // Dynamic Skills Context
  // ===========================================================================
  describe('Dynamic Skills Context', () => {
    it('WORKSPACE_LIST_SKILLS_ROUTE should call maybeRefresh with requestContext', async () => {
      const skillsData = new Map([['skill1', { name: 'skill1', description: 'Skill 1' }]]);
      const skills = createMockSkills(skillsData);
      const workspace = createWorkspace('test-workspace', { skills });
      const mastra = createMastra(workspace);
      const mockRequestContext = new RequestContext();
      mockRequestContext.set('userRole', 'developer');

      await WORKSPACE_LIST_SKILLS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        requestContext: mockRequestContext,
      });

      expect(skills.maybeRefresh).toHaveBeenCalledWith({ requestContext: mockRequestContext });
      expect(skills.list).toHaveBeenCalled();
    });

    it('WORKSPACE_GET_SKILL_ROUTE should call maybeRefresh with requestContext', async () => {
      const skill = {
        name: 'my-skill',
        description: 'My skill',
        instructions: 'Do things',
        path: '/skills/my-skill',
        source: { type: 'local', path: '/skills/my-skill' },
        references: [],
        scripts: [],
        assets: [],
      };
      const skillsData = new Map([['my-skill', skill]]);
      const skills = createMockSkills(skillsData);
      const workspace = createWorkspace('test-workspace', { skills });
      const mastra = createMastra(workspace);
      const mockRequestContext = new RequestContext();
      mockRequestContext.set('userRole', 'admin');

      await WORKSPACE_GET_SKILL_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        skillName: 'my-skill',
        requestContext: mockRequestContext,
      });

      expect(skills.maybeRefresh).toHaveBeenCalledWith({ requestContext: mockRequestContext });
      expect(skills.get).toHaveBeenCalledWith('my-skill');
    });

    it('WORKSPACE_LIST_SKILL_REFERENCES_ROUTE should call maybeRefresh with requestContext', async () => {
      const skillsData = new Map([['my-skill', { name: 'my-skill' }]]);
      const skills = createMockSkills(skillsData);
      const workspace = createWorkspace('test-workspace', { skills });
      const mastra = createMastra(workspace);
      const mockRequestContext = new RequestContext();
      mockRequestContext.set('tenantId', 'tenant-123');

      await WORKSPACE_LIST_SKILL_REFERENCES_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        skillName: 'my-skill',
        requestContext: mockRequestContext,
      });

      expect(skills.maybeRefresh).toHaveBeenCalledWith({ requestContext: mockRequestContext });
      expect(skills.has).toHaveBeenCalledWith('my-skill');
    });

    it('WORKSPACE_GET_SKILL_REFERENCE_ROUTE should call maybeRefresh with requestContext', async () => {
      const skillsData = new Map([['my-skill', { name: 'my-skill' }]]);
      const skills = createMockSkills(skillsData);
      const workspace = createWorkspace('test-workspace', { skills });
      const mastra = createMastra(workspace);
      const mockRequestContext = new RequestContext();
      mockRequestContext.set('feature', 'beta');

      await WORKSPACE_GET_SKILL_REFERENCE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        skillName: 'my-skill',
        referencePath: 'api.md',
        requestContext: mockRequestContext,
      });

      expect(skills.maybeRefresh).toHaveBeenCalledWith({ requestContext: mockRequestContext });
      expect(skills.getReference).toHaveBeenCalledWith('my-skill', 'api.md');
    });

    it('WORKSPACE_SEARCH_SKILLS_ROUTE should call maybeRefresh with requestContext', async () => {
      const skills = createMockSkills();
      skills.search = vi.fn(async () => []);
      const workspace = createWorkspace('test-workspace', { skills });
      const mastra = createMastra(workspace);
      const mockRequestContext = new RequestContext();
      mockRequestContext.set('locale', 'en-US');

      await WORKSPACE_SEARCH_SKILLS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        query: 'test',
        topK: 10,
        includeReferences: false,
        requestContext: mockRequestContext,
      });

      expect(skills.maybeRefresh).toHaveBeenCalledWith({ requestContext: mockRequestContext });
      expect(skills.search).toHaveBeenCalled();
    });

    it('should handle undefined requestContext gracefully', async () => {
      const skillsData = new Map([['skill1', { name: 'skill1', description: 'Skill 1' }]]);
      const skills = createMockSkills(skillsData);
      const workspace = createWorkspace('test-workspace', { skills });
      const mastra = createMastra(workspace);

      await WORKSPACE_LIST_SKILLS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        requestContext: undefined as unknown as RequestContext,
      });

      expect(skills.maybeRefresh).toHaveBeenCalledWith({ requestContext: undefined });
      expect(skills.list).toHaveBeenCalled();
    });
  });
});
