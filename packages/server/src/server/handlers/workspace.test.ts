import { describe, it, expect, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import {
  WORKSPACE_INFO_ROUTE,
  WORKSPACE_FS_READ_ROUTE,
  WORKSPACE_FS_WRITE_ROUTE,
  WORKSPACE_FS_LIST_ROUTE,
  WORKSPACE_FS_DELETE_ROUTE,
  WORKSPACE_FS_MKDIR_ROUTE,
  WORKSPACE_FS_STAT_ROUTE,
  WORKSPACE_SEARCH_ROUTE,
  WORKSPACE_INDEX_ROUTE,
  WORKSPACE_UNINDEX_ROUTE,
  WORKSPACE_LIST_SKILLS_ROUTE,
  WORKSPACE_GET_SKILL_ROUTE,
  WORKSPACE_LIST_SKILL_REFERENCES_ROUTE,
  WORKSPACE_GET_SKILL_REFERENCE_ROUTE,
  WORKSPACE_SEARCH_SKILLS_ROUTE,
} from './workspace';

// =============================================================================
// Mock Factories
// =============================================================================

function createMockFilesystem(files: Map<string, string> = new Map()) {
  return {
    provider: 'mock',
    readFile: vi.fn().mockImplementation(async (path: string) => {
      if (!files.has(path)) throw new Error(`File not found: ${path}`);
      return files.get(path)!;
    }),
    writeFile: vi.fn().mockImplementation(async (path: string, content: string) => {
      files.set(path, content);
    }),
    readdir: vi.fn().mockResolvedValue([
      { name: 'file1.txt', type: 'file', size: 100 },
      { name: 'dir1', type: 'directory' },
    ]),
    exists: vi.fn().mockImplementation(async (path: string) => files.has(path)),
    mkdir: vi.fn().mockResolvedValue(undefined),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    rmdir: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockImplementation(async (path: string) => ({
      path,
      type: files.has(path) ? 'file' : 'directory',
      size: files.get(path)?.length ?? 0,
      createdAt: new Date(),
      modifiedAt: new Date(),
      mimeType: 'text/plain',
    })),
    isFile: vi.fn().mockImplementation(async (path: string) => files.has(path)),
    isDirectory: vi.fn().mockResolvedValue(false),
  };
}

function createMockSkills(skillsData: Map<string, any> = new Map()) {
  return {
    list: vi.fn().mockResolvedValue(
      Array.from(skillsData.values()).map(s => ({
        name: s.name,
        description: s.description,
        license: s.license,
        allowedTools: s.allowedTools,
      })),
    ),
    get: vi.fn().mockImplementation((name: string) => Promise.resolve(skillsData.get(name) ?? null)),
    has: vi.fn().mockImplementation((name: string) => Promise.resolve(skillsData.has(name))),
    search: vi.fn().mockResolvedValue([]),
    listReferences: vi.fn().mockResolvedValue(['api.md', 'guide.md']),
    getReference: vi.fn().mockResolvedValue('Reference content'),
    listScripts: vi.fn().mockResolvedValue([]),
    listAssets: vi.fn().mockResolvedValue([]),
  };
}

function createMockWorkspace(
  options: {
    fs?: any;
    skills?: any;
    canBM25?: boolean;
    canVector?: boolean;
    canHybrid?: boolean;
  } = {},
) {
  return {
    id: 'test-workspace',
    name: 'Test Workspace',
    status: 'ready',
    fs: options.fs,
    sandbox: null,
    skills: options.skills,
    canBM25: options.canBM25 ?? false,
    canVector: options.canVector ?? false,
    canHybrid: options.canHybrid ?? false,
    search: vi.fn().mockResolvedValue([]),
    index: vi.fn().mockResolvedValue(undefined),
    unindex: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockMastra(workspace?: any) {
  return {
    getWorkspace: workspace ? vi.fn().mockReturnValue(workspace) : vi.fn().mockReturnValue(undefined),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Workspace Handlers', () => {
  // ===========================================================================
  // WORKSPACE_INFO_ROUTE
  // ===========================================================================
  describe('WORKSPACE_INFO_ROUTE', () => {
    it('should return isWorkspaceConfigured: false when no workspace', async () => {
      const mastra = createMockMastra();
      const result = await WORKSPACE_INFO_ROUTE.handler({ mastra });

      expect(result).toEqual({ isWorkspaceConfigured: false });
    });

    it('should return workspace info with capabilities', async () => {
      const fs = createMockFilesystem();
      const skills = createMockSkills();
      const workspace = createMockWorkspace({ fs, skills, canBM25: true });
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_INFO_ROUTE.handler({ mastra });

      expect(result).toEqual({
        isWorkspaceConfigured: true,
        id: 'test-workspace',
        name: 'Test Workspace',
        status: 'ready',
        capabilities: {
          hasFilesystem: true,
          hasSandbox: false,
          canBM25: true,
          canVector: false,
          canHybrid: false,
          hasSkills: true,
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
      const fs = createMockFilesystem(files);
      const workspace = createMockWorkspace({ fs });
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_FS_READ_ROUTE.handler({
        mastra,
        path: '/test.txt',
        encoding: 'utf-8',
      });

      expect(result.content).toBe('Hello World');
      expect(result.path).toBe('/test.txt');
    });

    it('should throw 404 when file not found', async () => {
      const fs = createMockFilesystem();
      const workspace = createMockWorkspace({ fs });
      const mastra = createMockMastra(workspace);

      await expect(
        WORKSPACE_FS_READ_ROUTE.handler({
          mastra,
          path: '/nonexistent.txt',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_FS_READ_ROUTE.handler({
          mastra,
          path: '/nonexistent.txt',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });

    it('should throw 404 when no filesystem configured', async () => {
      const workspace = createMockWorkspace();
      const mastra = createMockMastra(workspace);

      await expect(
        WORKSPACE_FS_READ_ROUTE.handler({
          mastra,
          path: '/test.txt',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_FS_READ_ROUTE.handler({
          mastra,
          path: '/test.txt',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });

    it('should throw 400 when path parameter missing', async () => {
      const fs = createMockFilesystem();
      const workspace = createMockWorkspace({ fs });
      const mastra = createMockMastra(workspace);

      await expect(
        WORKSPACE_FS_READ_ROUTE.handler({
          mastra,
          path: undefined,
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_FS_READ_ROUTE.handler({
          mastra,
          path: undefined,
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(400);
      }
    });
  });

  describe('WORKSPACE_FS_WRITE_ROUTE', () => {
    it('should write file content', async () => {
      const files = new Map<string, string>();
      const fs = createMockFilesystem(files);
      const workspace = createMockWorkspace({ fs });
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_FS_WRITE_ROUTE.handler({
        mastra,
        path: '/new.txt',
        content: 'New content',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/new.txt');
      expect(fs.writeFile).toHaveBeenCalledWith('/new.txt', 'New content', { recursive: true });
    });

    it('should handle base64 encoding', async () => {
      const files = new Map<string, string>();
      const fs = createMockFilesystem(files);
      const workspace = createMockWorkspace({ fs });
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_FS_WRITE_ROUTE.handler({
        mastra,
        path: '/binary.bin',
        content: 'SGVsbG8=', // "Hello" in base64
        encoding: 'base64',
      });

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should throw 400 when path and content missing', async () => {
      const fs = createMockFilesystem();
      const workspace = createMockWorkspace({ fs });
      const mastra = createMockMastra(workspace);

      await expect(
        WORKSPACE_FS_WRITE_ROUTE.handler({
          mastra,
          path: undefined,
          content: undefined,
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_FS_WRITE_ROUTE.handler({
          mastra,
          path: undefined,
          content: undefined,
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(400);
      }
    });
  });

  describe('WORKSPACE_FS_LIST_ROUTE', () => {
    it('should list directory contents', async () => {
      const files = new Map([['/dir/file.txt', 'content']]);
      const fs = createMockFilesystem(files);
      (fs.exists as any).mockResolvedValue(true);
      const workspace = createMockWorkspace({ fs });
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_FS_LIST_ROUTE.handler({
        mastra,
        path: '/dir',
      });

      expect(result.path).toBe('/dir');
      expect(result.entries).toBeDefined();
    });

    it('should pass recursive option', async () => {
      const fs = createMockFilesystem();
      (fs.exists as any).mockResolvedValue(true);
      const workspace = createMockWorkspace({ fs });
      const mastra = createMockMastra(workspace);

      await WORKSPACE_FS_LIST_ROUTE.handler({
        mastra,
        path: '/',
        recursive: true,
      });

      expect(fs.readdir).toHaveBeenCalledWith('/', { recursive: true });
    });
  });

  describe('WORKSPACE_FS_DELETE_ROUTE', () => {
    it('should delete file', async () => {
      const files = new Map([['/test.txt', 'content']]);
      const fs = createMockFilesystem(files);
      const workspace = createMockWorkspace({ fs });
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_FS_DELETE_ROUTE.handler({
        mastra,
        path: '/test.txt',
      });

      expect(result.success).toBe(true);
    });

    it('should throw 404 when file not found and force is false', async () => {
      const fs = createMockFilesystem();
      const workspace = createMockWorkspace({ fs });
      const mastra = createMockMastra(workspace);

      await expect(
        WORKSPACE_FS_DELETE_ROUTE.handler({
          mastra,
          path: '/nonexistent.txt',
          force: false,
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_FS_DELETE_ROUTE.handler({
          mastra,
          path: '/nonexistent.txt',
          force: false,
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });
  });

  describe('WORKSPACE_FS_MKDIR_ROUTE', () => {
    it('should create directory', async () => {
      const fs = createMockFilesystem();
      const workspace = createMockWorkspace({ fs });
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_FS_MKDIR_ROUTE.handler({
        mastra,
        path: '/newdir',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/newdir');
      expect(fs.mkdir).toHaveBeenCalledWith('/newdir', { recursive: true });
    });
  });

  describe('WORKSPACE_FS_STAT_ROUTE', () => {
    it('should return file stats', async () => {
      const files = new Map([['/test.txt', 'content']]);
      const fs = createMockFilesystem(files);
      const workspace = createMockWorkspace({ fs });
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_FS_STAT_ROUTE.handler({
        mastra,
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
      const mastra = createMockMastra();

      const result = await WORKSPACE_SEARCH_ROUTE.handler({
        mastra,
        query: 'test',
      });

      expect(result.results).toEqual([]);
      expect(result.query).toBe('test');
    });

    it('should return empty results when search not configured', async () => {
      const workspace = createMockWorkspace();
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_SEARCH_ROUTE.handler({
        mastra,
        query: 'test',
      });

      expect(result.results).toEqual([]);
    });

    it('should search with BM25', async () => {
      const workspace = createMockWorkspace({ canBM25: true });
      workspace.search = vi.fn().mockResolvedValue([{ id: '/doc.txt', content: 'match', score: 0.9 }]);
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_SEARCH_ROUTE.handler({
        mastra,
        query: 'test',
        topK: 10,
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('/doc.txt');
    });

    it('should throw 400 when query parameter missing', async () => {
      const workspace = createMockWorkspace({ canBM25: true });
      const mastra = createMockMastra(workspace);

      await expect(
        WORKSPACE_SEARCH_ROUTE.handler({
          mastra,
          query: undefined,
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_SEARCH_ROUTE.handler({
          mastra,
          query: undefined,
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(400);
      }
    });
  });

  describe('WORKSPACE_INDEX_ROUTE', () => {
    it('should index content', async () => {
      const workspace = createMockWorkspace({ canBM25: true });
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_INDEX_ROUTE.handler({
        mastra,
        path: '/doc.txt',
        content: 'Document content',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/doc.txt');
      expect(workspace.index).toHaveBeenCalledWith('/doc.txt', 'Document content', { metadata: undefined });
    });

    it('should throw 400 when search not configured', async () => {
      const workspace = createMockWorkspace();
      const mastra = createMockMastra(workspace);

      await expect(
        WORKSPACE_INDEX_ROUTE.handler({
          mastra,
          path: '/doc.txt',
          content: 'content',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_INDEX_ROUTE.handler({
          mastra,
          path: '/doc.txt',
          content: 'content',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(400);
      }
    });
  });

  describe('WORKSPACE_UNINDEX_ROUTE', () => {
    it('should unindex content', async () => {
      const workspace = createMockWorkspace({ canBM25: true });
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_UNINDEX_ROUTE.handler({
        mastra,
        path: '/doc.txt',
      });

      expect(result.success).toBe(true);
      expect(workspace.unindex).toHaveBeenCalledWith('/doc.txt');
    });
  });

  // ===========================================================================
  // Skills Routes
  // ===========================================================================
  describe('WORKSPACE_LIST_SKILLS_ROUTE', () => {
    it('should return empty when no skills configured', async () => {
      const mastra = createMockMastra();

      const result = await WORKSPACE_LIST_SKILLS_ROUTE.handler({ mastra });

      expect(result.skills).toEqual([]);
      expect(result.isSkillsConfigured).toBe(false);
    });

    it('should list all skills', async () => {
      const skillsData = new Map([
        ['skill1', { name: 'skill1', description: 'Skill 1', license: 'MIT' }],
        ['skill2', { name: 'skill2', description: 'Skill 2' }],
      ]);
      const skills = createMockSkills(skillsData);
      const workspace = createMockWorkspace({ skills });
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_LIST_SKILLS_ROUTE.handler({ mastra });

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
      const workspace = createMockWorkspace({ skills });
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_GET_SKILL_ROUTE.handler({
        mastra,
        skillName: 'my-skill',
      });

      expect(result.name).toBe('my-skill');
      expect(result.instructions).toBe('Do things');
    });

    it('should throw 404 for non-existent skill', async () => {
      const skills = createMockSkills();
      const workspace = createMockWorkspace({ skills });
      const mastra = createMockMastra(workspace);

      await expect(
        WORKSPACE_GET_SKILL_ROUTE.handler({
          mastra,
          skillName: 'nonexistent',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_GET_SKILL_ROUTE.handler({
          mastra,
          skillName: 'nonexistent',
        });
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
      }
    });

    it('should throw 404 when no skills configured', async () => {
      const mastra = createMockMastra();

      await expect(
        WORKSPACE_GET_SKILL_ROUTE.handler({
          mastra,
          skillName: 'my-skill',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_GET_SKILL_ROUTE.handler({
          mastra,
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
      const workspace = createMockWorkspace({ skills });
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_LIST_SKILL_REFERENCES_ROUTE.handler({
        mastra,
        skillName: 'my-skill',
      });

      expect(result.skillName).toBe('my-skill');
      expect(result.references).toContain('api.md');
    });

    it('should throw 404 for non-existent skill', async () => {
      const skills = createMockSkills();
      const workspace = createMockWorkspace({ skills });
      const mastra = createMockMastra(workspace);

      await expect(
        WORKSPACE_LIST_SKILL_REFERENCES_ROUTE.handler({
          mastra,
          skillName: 'nonexistent',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_LIST_SKILL_REFERENCES_ROUTE.handler({
          mastra,
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
      const workspace = createMockWorkspace({ skills });
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_GET_SKILL_REFERENCE_ROUTE.handler({
        mastra,
        skillName: 'my-skill',
        referencePath: 'api.md',
      });

      expect(result.skillName).toBe('my-skill');
      expect(result.content).toBe('Reference content');
    });

    it('should throw 404 when reference not found', async () => {
      const skillsData = new Map([['my-skill', { name: 'my-skill' }]]);
      const skills = createMockSkills(skillsData);
      skills.getReference = vi.fn().mockResolvedValue(null);
      const workspace = createMockWorkspace({ skills });
      const mastra = createMockMastra(workspace);

      await expect(
        WORKSPACE_GET_SKILL_REFERENCE_ROUTE.handler({
          mastra,
          skillName: 'my-skill',
          referencePath: 'nonexistent.md',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await WORKSPACE_GET_SKILL_REFERENCE_ROUTE.handler({
          mastra,
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
      const mastra = createMockMastra();

      const result = await WORKSPACE_SEARCH_SKILLS_ROUTE.handler({
        mastra,
        query: 'test',
      });

      expect(result.results).toEqual([]);
    });

    it('should search skills', async () => {
      const skills = createMockSkills();
      skills.search = vi
        .fn()
        .mockResolvedValue([{ skillName: 'skill1', source: 'instructions', content: 'match', score: 0.9 }]);
      const workspace = createMockWorkspace({ skills });
      const mastra = createMockMastra(workspace);

      const result = await WORKSPACE_SEARCH_SKILLS_ROUTE.handler({
        mastra,
        query: 'test',
        topK: 5,
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].skillName).toBe('skill1');
    });

    it('should parse comma-separated skill names', async () => {
      const skills = createMockSkills();
      skills.search = vi.fn().mockResolvedValue([]);
      const workspace = createMockWorkspace({ skills });
      const mastra = createMockMastra(workspace);

      await WORKSPACE_SEARCH_SKILLS_ROUTE.handler({
        mastra,
        query: 'test',
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
});
