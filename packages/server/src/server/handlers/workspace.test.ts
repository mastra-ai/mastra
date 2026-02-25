import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { Workspace } from '@mastra/core/workspace';
import type { WorkspaceFilesystem, FileEntry, FileStat } from '@mastra/core/workspace';
import { afterEach, describe, it, expect, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import { createTestServerContext } from './test-utils';
import {
  LIST_WORKSPACES_ROUTE,
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
  WORKSPACE_SKILLS_SH_SEARCH_ROUTE,
  WORKSPACE_SKILLS_SH_POPULAR_ROUTE,
  WORKSPACE_SKILLS_SH_PREVIEW_ROUTE,
  WORKSPACE_SKILLS_SH_INSTALL_ROUTE,
  WORKSPACE_SKILLS_SH_REMOVE_ROUTE,
  WORKSPACE_SKILLS_SH_UPDATE_ROUTE,
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

/** Polls until a workspace with the given ID appears in the registry. */
async function waitForWorkspace(mastra: Mastra, id: string, timeout = 2000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!mastra.listWorkspaces()[id]) {
    if (Date.now() > deadline) throw new Error(`Workspace ${id} not registered within ${timeout}ms`);
    await new Promise(r => setTimeout(r, 10));
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('Workspace Handlers', () => {
  // ===========================================================================
  // LIST_WORKSPACES_ROUTE
  // ===========================================================================
  describe('LIST_WORKSPACES_ROUTE', () => {
    it('should return empty list when no workspaces registered', async () => {
      const mastra = createMastra();

      const result = await LIST_WORKSPACES_ROUTE.handler({
        ...createTestServerContext({ mastra }),
      });

      expect(result.workspaces).toEqual([]);
    });

    it('should list workspaces from registry', async () => {
      const workspace = createWorkspace('ws-1', { name: 'My Workspace', bm25: true });
      const mastra = createMastra(workspace);

      const result = await LIST_WORKSPACES_ROUTE.handler({
        ...createTestServerContext({ mastra }),
      });

      expect(result.workspaces).toHaveLength(1);
      expect(result.workspaces[0]).toMatchObject({
        id: 'ws-1',
        name: 'My Workspace',
        source: 'mastra',
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

    it('should report readOnly in safety', async () => {
      const workspace = createWorkspace('ro-ws', { name: 'Read Only', readOnly: true });
      const mastra = createMastra(workspace);

      const result = await LIST_WORKSPACES_ROUTE.handler({
        ...createTestServerContext({ mastra }),
      });

      expect(result.workspaces).toHaveLength(1);
      expect(result.workspaces[0].safety.readOnly).toBe(true);
    });

    it('should report hasSkills when skills are configured', async () => {
      const skills = createMockSkills();
      const workspace = createWorkspace('sk-ws', { name: 'Skills Workspace', skills });
      const mastra = createMastra(workspace);

      const result = await LIST_WORKSPACES_ROUTE.handler({
        ...createTestServerContext({ mastra }),
      });

      expect(result.workspaces).toHaveLength(1);
      expect(result.workspaces[0].capabilities.hasSkills).toBe(true);
    });

    it('should mark agent workspaces with source agent and populate agentId/agentName', async () => {
      const globalWorkspace = createWorkspace('global-ws', { name: 'Global Workspace' });
      const agentWorkspace = createWorkspace('agent-ws', { name: 'Agent Workspace' });

      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: { provider: 'openai', name: 'gpt-4o' } as any,
        workspace: agentWorkspace,
      });

      const mastra = new Mastra({
        logger: false,
        workspace: globalWorkspace,
        agents: { testAgent: agent },
      });

      await waitForWorkspace(mastra, 'agent-ws');

      const result = await LIST_WORKSPACES_ROUTE.handler({
        ...createTestServerContext({ mastra }),
      });

      expect(result.workspaces).toHaveLength(2);

      const global = result.workspaces.find((w: any) => w.id === 'global-ws');
      const agentWs = result.workspaces.find((w: any) => w.id === 'agent-ws');

      expect(global).toMatchObject({
        id: 'global-ws',
        name: 'Global Workspace',
        source: 'mastra',
      });

      expect(agentWs).toMatchObject({
        id: 'agent-ws',
        name: 'Agent Workspace',
        source: 'agent',
        agentId: 'test-agent',
        agentName: 'test-agent',
      });
    });

    it('should mark workspace as source agent when only agents have workspaces', async () => {
      const agentWorkspace = createWorkspace('only-agent-ws', { name: 'Only Agent Workspace' });

      const agent = new Agent({
        name: 'solo-agent',
        instructions: 'test',
        model: { provider: 'openai', name: 'gpt-4o' } as any,
        workspace: agentWorkspace,
      });

      const mastra = new Mastra({
        logger: false,
        agents: { soloAgent: agent },
      });

      await waitForWorkspace(mastra, 'only-agent-ws');

      const result = await LIST_WORKSPACES_ROUTE.handler({
        ...createTestServerContext({ mastra }),
      });

      expect(result.workspaces).toHaveLength(1);
      expect(result.workspaces[0]).toMatchObject({
        id: 'only-agent-ws',
        name: 'Only Agent Workspace',
        source: 'agent',
        agentId: 'solo-agent',
        agentName: 'solo-agent',
      });
    });
  });

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

  // ===========================================================================
  // Skills.sh Proxy Routes
  // ===========================================================================

  describe('WORKSPACE_SKILLS_SH_SEARCH_ROUTE', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should proxy search to skills.sh API and return mapped results', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          skills: [
            {
              skillId: 'sk-1',
              name: 'code-review',
              installs: 42,
              source: 'github',
              owner: 'o',
              repo: 'r',
              githubUrl: '',
              displayName: 'Code Review',
            },
            {
              skillId: 'sk-2',
              name: 'api-design',
              installs: 10,
              source: 'github',
              owner: 'o',
              repo: 'r',
              githubUrl: '',
              displayName: 'API Design',
            },
          ],
          total: 2,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        }),
      });

      const result = await WORKSPACE_SKILLS_SH_SEARCH_ROUTE.handler({
        ...createTestServerContext({ mastra: createMastra() }),
        workspaceId: 'test-workspace',
        q: 'code',
        limit: 10,
      });

      expect(result.query).toBe('code');
      expect(result.searchType).toBe('query');
      expect(result.count).toBe(2);
      expect(result.skills).toHaveLength(2);
      expect(result.skills[0]).toEqual({ id: 'sk-1', name: 'code-review', installs: 42, topSource: 'github' });
    });

    it('should throw 502 when skills.sh API returns error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        WORKSPACE_SKILLS_SH_SEARCH_ROUTE.handler({
          ...createTestServerContext({ mastra: createMastra() }),
          workspaceId: 'test-workspace',
          q: 'test',
          limit: 10,
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SKILLS_SH_SEARCH_ROUTE.handler({
          ...createTestServerContext({ mastra: createMastra() }),
          workspaceId: 'test-workspace',
          q: 'test',
          limit: 10,
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(502);
      }
    });

    it('should encode query parameter in URL', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ skills: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }),
      });

      await WORKSPACE_SKILLS_SH_SEARCH_ROUTE.handler({
        ...createTestServerContext({ mastra: createMastra() }),
        workspaceId: 'test-workspace',
        q: 'hello world & more',
        limit: 5,
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('hello%20world%20%26%20more'),
        expect.any(Object),
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('pageSize=5'), expect.any(Object));
    });
  });

  describe('WORKSPACE_SKILLS_SH_POPULAR_ROUTE', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should return popular skills with pagination', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          skills: [
            {
              skillId: 'sk-1',
              name: 'popular-skill',
              installs: 100,
              source: 'github',
              owner: 'o',
              repo: 'r',
              githubUrl: '',
              displayName: 'Popular',
            },
          ],
          total: 50,
        }),
      });

      const result = await WORKSPACE_SKILLS_SH_POPULAR_ROUTE.handler({
        ...createTestServerContext({ mastra: createMastra() }),
        workspaceId: 'test-workspace',
        limit: 10,
        offset: 0,
      });

      expect(result.count).toBe(50);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0]).toEqual({ id: 'sk-1', name: 'popular-skill', installs: 100, topSource: 'github' });
    });

    it('should calculate page from offset', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ skills: [], total: 0 }),
      });

      await WORKSPACE_SKILLS_SH_POPULAR_ROUTE.handler({
        ...createTestServerContext({ mastra: createMastra() }),
        workspaceId: 'test-workspace',
        limit: 10,
        offset: 20,
      });

      // offset=20, limit=10 -> page = floor(20/10) + 1 = 3
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('page=3'), expect.any(Object));
    });

    it('should throw 502 when API returns error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      await expect(
        WORKSPACE_SKILLS_SH_POPULAR_ROUTE.handler({
          ...createTestServerContext({ mastra: createMastra() }),
          workspaceId: 'test-workspace',
          limit: 10,
          offset: 0,
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SKILLS_SH_POPULAR_ROUTE.handler({
          ...createTestServerContext({ mastra: createMastra() }),
          workspaceId: 'test-workspace',
          limit: 10,
          offset: 0,
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(502);
      }
    });
  });

  describe('WORKSPACE_SKILLS_SH_PREVIEW_ROUTE', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should return skill content preview', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          instructions: '# Code Review\n\nReview code for quality.',
          raw: '---\nname: code-review\n---\n# Code Review',
        }),
      });

      const result = await WORKSPACE_SKILLS_SH_PREVIEW_ROUTE.handler({
        ...createTestServerContext({ mastra: createMastra() }),
        workspaceId: 'test-workspace',
        owner: 'mastra-ai',
        repo: 'skills',
        path: 'code-review',
      });

      expect(result.content).toBe('# Code Review\n\nReview code for quality.');
    });

    it('should fall back to raw content when instructions is empty', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          instructions: '',
          raw: '---\nname: my-skill\n---\nRaw content here',
        }),
      });

      const result = await WORKSPACE_SKILLS_SH_PREVIEW_ROUTE.handler({
        ...createTestServerContext({ mastra: createMastra() }),
        workspaceId: 'test-workspace',
        owner: 'owner',
        repo: 'repo',
        path: 'my-skill',
      });

      expect(result.content).toBe('---\nname: my-skill\n---\nRaw content here');
    });

    it('should throw 404 when skill not found on API', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        WORKSPACE_SKILLS_SH_PREVIEW_ROUTE.handler({
          ...createTestServerContext({ mastra: createMastra() }),
          workspaceId: 'test-workspace',
          owner: 'owner',
          repo: 'repo',
          path: 'nonexistent',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SKILLS_SH_PREVIEW_ROUTE.handler({
          ...createTestServerContext({ mastra: createMastra() }),
          workspaceId: 'test-workspace',
          owner: 'owner',
          repo: 'repo',
          path: 'nonexistent',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });

    it('should throw 404 when content is empty', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ instructions: '', raw: '' }),
      });

      await expect(
        WORKSPACE_SKILLS_SH_PREVIEW_ROUTE.handler({
          ...createTestServerContext({ mastra: createMastra() }),
          workspaceId: 'test-workspace',
          owner: 'owner',
          repo: 'repo',
          path: 'empty-skill',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SKILLS_SH_PREVIEW_ROUTE.handler({
          ...createTestServerContext({ mastra: createMastra() }),
          workspaceId: 'test-workspace',
          owner: 'owner',
          repo: 'repo',
          path: 'empty-skill',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });
  });

  // ===========================================================================
  // Skills.sh Install/Remove/Update Routes
  // ===========================================================================

  describe('WORKSPACE_SKILLS_SH_INSTALL_ROUTE', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should install skill by fetching files and writing to filesystem', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          skillId: 'code-review',
          owner: 'mastra-ai',
          repo: 'skills',
          branch: 'main',
          files: [
            { path: 'SKILL.md', content: '# Code Review Skill', encoding: 'utf-8' },
            { path: 'references/guide.md', content: '# Guide', encoding: 'utf-8' },
          ],
        }),
      });

      const files = new Map<string, string>();
      const workspace = createWorkspace('test-workspace', { files });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_SKILLS_SH_INSTALL_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        owner: 'mastra-ai',
        repo: 'skills',
        skillName: 'code-review',
      });

      expect(result.success).toBe(true);
      expect(result.skillName).toBe('code-review');
      expect(result.installedPath).toBe('.agents/skills/code-review');
      // 2 skill files + 1 .meta.json
      expect(result.filesWritten).toBe(3);

      // Verify files were written
      expect(workspace.filesystem!.writeFile).toHaveBeenCalledWith(
        '.agents/skills/code-review/SKILL.md',
        '# Code Review Skill',
      );
      expect(workspace.filesystem!.writeFile).toHaveBeenCalledWith(
        '.agents/skills/code-review/references/guide.md',
        '# Guide',
      );
      // Metadata file
      expect(workspace.filesystem!.writeFile).toHaveBeenCalledWith(
        '.agents/skills/code-review/.meta.json',
        expect.stringContaining('"skillName": "code-review"'),
      );
    });

    it('should handle base64-encoded files', async () => {
      const base64Content = Buffer.from('binary content').toString('base64');
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          skillId: 'my-skill',
          owner: 'owner',
          repo: 'repo',
          branch: 'main',
          files: [{ path: 'image.png', content: base64Content, encoding: 'base64' }],
        }),
      });

      const files = new Map<string, string>();
      const workspace = createWorkspace('test-workspace', { files });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_SKILLS_SH_INSTALL_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        owner: 'owner',
        repo: 'repo',
        skillName: 'my-skill',
      });

      expect(result.success).toBe(true);
      // Buffer should have been passed for base64 content
      expect(workspace.filesystem!.writeFile).toHaveBeenCalledWith(
        '.agents/skills/my-skill/image.png',
        expect.any(Buffer),
      );
    });

    it('should throw 404 when workspace not found', async () => {
      const mastra = createMastra();

      await expect(
        WORKSPACE_SKILLS_SH_INSTALL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'nonexistent',
          owner: 'owner',
          repo: 'repo',
          skillName: 'skill',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SKILLS_SH_INSTALL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'nonexistent',
          owner: 'owner',
          repo: 'repo',
          skillName: 'skill',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });

    it('should throw 403 when workspace is read-only', async () => {
      const workspace = createWorkspace('test-workspace', { readOnly: true });
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_SKILLS_SH_INSTALL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          owner: 'owner',
          repo: 'repo',
          skillName: 'skill',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SKILLS_SH_INSTALL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          owner: 'owner',
          repo: 'repo',
          skillName: 'skill',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(403);
      }
    });

    it('should throw 404 when skill not found on API', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          skillId: 'missing',
          owner: 'owner',
          repo: 'repo',
          branch: 'main',
          files: [],
        }),
      });

      const workspace = createWorkspace('test-workspace');
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_SKILLS_SH_INSTALL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          owner: 'owner',
          repo: 'repo',
          skillName: 'missing',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SKILLS_SH_INSTALL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          owner: 'owner',
          repo: 'repo',
          skillName: 'missing',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });

    it('should reject path traversal in skill name from API response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          skillId: '../../../etc', // malicious skillId from API
          owner: 'owner',
          repo: 'repo',
          branch: 'main',
          files: [{ path: 'SKILL.md', content: 'evil', encoding: 'utf-8' }],
        }),
      });

      const workspace = createWorkspace('test-workspace');
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_SKILLS_SH_INSTALL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          owner: 'owner',
          repo: 'repo',
          skillName: 'evil-skill',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SKILLS_SH_INSTALL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          owner: 'owner',
          repo: 'repo',
          skillName: 'evil-skill',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(400);
      }
    });

    it('should reject path traversal in file paths from API response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          skillId: 'legit-skill',
          owner: 'owner',
          repo: 'repo',
          branch: 'main',
          files: [{ path: '../../etc/passwd', content: 'evil', encoding: 'utf-8' }],
        }),
      });

      const workspace = createWorkspace('test-workspace');
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_SKILLS_SH_INSTALL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          owner: 'owner',
          repo: 'repo',
          skillName: 'legit-skill',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SKILLS_SH_INSTALL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          owner: 'owner',
          repo: 'repo',
          skillName: 'legit-skill',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(400);
      }
    });
  });

  describe('WORKSPACE_SKILLS_SH_REMOVE_ROUTE', () => {
    it('should remove skill directory', async () => {
      const files = new Map([
        ['.agents/skills/my-skill/SKILL.md', '# My Skill'],
        ['.agents/skills/my-skill/.meta.json', '{}'],
      ]);
      const workspace = createWorkspace('test-workspace', { files });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_SKILLS_SH_REMOVE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        skillName: 'my-skill',
      });

      expect(result.success).toBe(true);
      expect(result.skillName).toBe('my-skill');
      expect(result.removedPath).toBe('.agents/skills/my-skill');
      expect(workspace.filesystem!.rmdir).toHaveBeenCalledWith('.agents/skills/my-skill', { recursive: true });
    });

    it.todo('should use skill path from discovery for glob-discovered skills', async () => {
      const files = new Map([['/custom/path/skills/web-design/SKILL.md', '# Web Design']]);
      const skills = createMockSkills();
      skills.get = vi.fn(async () => ({
        name: 'web-design',
        path: '/custom/path/skills/web-design',
        description: 'Web design skill',
        instructions: 'Design web pages',
      }));
      const workspace = createWorkspace('test-workspace', { files, skills });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_SKILLS_SH_REMOVE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        skillName: 'web-design',
      });

      expect(result.success).toBe(true);
      expect(result.removedPath).toBe('/custom/path/skills/web-design');
      expect(workspace.filesystem!.rmdir).toHaveBeenCalledWith('/custom/path/skills/web-design', { recursive: true });
    });

    it('should fall back to SKILLS_SH_DIR when skill not in discovery', async () => {
      const files = new Map([['.agents/skills/fallback-skill/SKILL.md', '# Fallback']]);
      const skills = createMockSkills();
      skills.get = vi.fn(async () => null);
      const workspace = createWorkspace('test-workspace', { files, skills });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_SKILLS_SH_REMOVE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        skillName: 'fallback-skill',
      });

      expect(result.success).toBe(true);
      expect(result.removedPath).toBe('.agents/skills/fallback-skill');
    });

    it('should throw 404 when workspace not found', async () => {
      const mastra = createMastra();

      await expect(
        WORKSPACE_SKILLS_SH_REMOVE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'nonexistent',
          skillName: 'skill',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SKILLS_SH_REMOVE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'nonexistent',
          skillName: 'skill',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });

    it('should throw 403 when workspace is read-only', async () => {
      const workspace = createWorkspace('test-workspace', { readOnly: true });
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_SKILLS_SH_REMOVE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          skillName: 'skill',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SKILLS_SH_REMOVE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          skillName: 'skill',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(403);
      }
    });

    it('should throw 404 when skill not found on filesystem', async () => {
      const workspace = createWorkspace('test-workspace');
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_SKILLS_SH_REMOVE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          skillName: 'nonexistent',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SKILLS_SH_REMOVE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          skillName: 'nonexistent',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });

    it('should reject invalid skill names (path traversal)', async () => {
      const workspace = createWorkspace('test-workspace');
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_SKILLS_SH_REMOVE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          skillName: '../../../etc',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SKILLS_SH_REMOVE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          skillName: '../../../etc',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(400);
      }
    });
  });

  describe('WORKSPACE_SKILLS_SH_UPDATE_ROUTE', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should update a single skill by re-fetching from API', async () => {
      const metaJson = JSON.stringify({
        skillName: 'code-review',
        owner: 'mastra-ai',
        repo: 'skills',
        branch: 'main',
        installedAt: '2025-01-01T00:00:00Z',
      });
      const files = new Map<string, string>([
        ['.agents/skills/code-review/SKILL.md', '# Old Content'],
        ['.agents/skills/code-review/.meta.json', metaJson],
      ]);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          skillId: 'code-review',
          owner: 'mastra-ai',
          repo: 'skills',
          branch: 'main',
          files: [{ path: 'SKILL.md', content: '# Updated Content', encoding: 'utf-8' }],
        }),
      });

      const workspace = createWorkspace('test-workspace', { files });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_SKILLS_SH_UPDATE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        skillName: 'code-review',
      });

      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].skillName).toBe('code-review');
      expect(result.updated[0].success).toBe(true);
      // 1 skill file + 1 updated .meta.json
      expect(result.updated[0].filesWritten).toBe(2);

      // Verify new content was written
      expect(workspace.filesystem!.writeFile).toHaveBeenCalledWith(
        '.agents/skills/code-review/SKILL.md',
        '# Updated Content',
      );
    });

    it('should update all skills when skillName is omitted', async () => {
      const meta1 = JSON.stringify({ skillName: 'skill-a', owner: 'o', repo: 'r', branch: 'main', installedAt: '' });
      const meta2 = JSON.stringify({ skillName: 'skill-b', owner: 'o', repo: 'r', branch: 'main', installedAt: '' });
      const files = new Map<string, string>([
        ['.agents/skills/skill-a/SKILL.md', '# A'],
        ['.agents/skills/skill-a/.meta.json', meta1],
        ['.agents/skills/skill-b/SKILL.md', '# B'],
        ['.agents/skills/skill-b/.meta.json', meta2],
      ]);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          skillId: 'updated',
          owner: 'o',
          repo: 'r',
          branch: 'main',
          files: [{ path: 'SKILL.md', content: '# Updated', encoding: 'utf-8' }],
        }),
      });

      const workspace = createWorkspace('test-workspace', { files });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_SKILLS_SH_UPDATE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        skillName: undefined,
      });

      expect(result.updated).toHaveLength(2);
      expect(result.updated.every(u => u.success)).toBe(true);
    });

    it('should return empty result when no skills directory exists', async () => {
      const workspace = createWorkspace('test-workspace');
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_SKILLS_SH_UPDATE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        skillName: undefined,
      });

      expect(result.updated).toEqual([]);
    });

    it('should handle individual skill update failure gracefully', async () => {
      const metaJson = JSON.stringify({
        skillName: 'broken-skill',
        owner: 'o',
        repo: 'r',
        branch: 'main',
        installedAt: '',
      });
      const files = new Map<string, string>([
        ['.agents/skills/broken-skill/SKILL.md', '# Broken'],
        ['.agents/skills/broken-skill/.meta.json', metaJson],
      ]);

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const workspace = createWorkspace('test-workspace', { files });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_SKILLS_SH_UPDATE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        skillName: 'broken-skill',
      });

      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].success).toBe(false);
      expect(result.updated[0].error).toBeDefined();
    });

    it('should throw 404 when workspace not found', async () => {
      const mastra = createMastra();

      await expect(
        WORKSPACE_SKILLS_SH_UPDATE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'nonexistent',
          skillName: 'skill',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SKILLS_SH_UPDATE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'nonexistent',
          skillName: 'skill',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });

    it('should throw 403 when workspace is read-only', async () => {
      const workspace = createWorkspace('test-workspace', { readOnly: true });
      const mastra = createMastra(workspace);

      await expect(
        WORKSPACE_SKILLS_SH_UPDATE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          skillName: 'skill',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SKILLS_SH_UPDATE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          workspaceId: 'test-workspace',
          skillName: 'skill',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(403);
      }
    });

    it('should handle skill with missing .meta.json', async () => {
      const files = new Map<string, string>([['.agents/skills/no-meta/SKILL.md', '# No Meta']]);

      const workspace = createWorkspace('test-workspace', { files });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_SKILLS_SH_UPDATE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        skillName: 'no-meta',
      });

      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].success).toBe(false);
      expect(result.updated[0].error).toBeDefined();
    });

    it('should handle API returning no files for a skill', async () => {
      const metaJson = JSON.stringify({
        skillName: 'empty',
        owner: 'o',
        repo: 'r',
        branch: 'main',
        installedAt: '',
      });
      const files = new Map<string, string>([['.agents/skills/empty-skill/.meta.json', metaJson]]);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          skillId: 'empty',
          owner: 'o',
          repo: 'r',
          branch: 'main',
          files: [],
        }),
      });

      const workspace = createWorkspace('test-workspace', { files });
      const mastra = createMastra(workspace);

      const result = await WORKSPACE_SKILLS_SH_UPDATE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workspaceId: 'test-workspace',
        skillName: 'empty-skill',
      });

      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].success).toBe(false);
      expect(result.updated[0].error).toBe('No files found in skill directory');
    });
  });
});
