import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MastraClient } from '../client';
import type { Workspace } from './workspace';
import { WorkspaceSkillResource } from './workspace';

// Mock fetch globally
global.fetch = vi.fn();

describe('Workspace Resource', () => {
  let client: MastraClient;
  let workspace: Workspace;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  // Helper to mock successful API responses
  const mockFetchResponse = (data: any) => {
    const response = new Response(undefined, {
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
    });
    response.json = () => Promise.resolve(data);
    (global.fetch as any).mockResolvedValueOnce(response);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
    workspace = client.getWorkspace();
  });

  // ===========================================================================
  // Workspace Info
  // ===========================================================================
  describe('info()', () => {
    it('should get workspace info when not configured', async () => {
      const mockResponse = {
        isWorkspaceConfigured: false,
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.info();

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should get workspace info with capabilities', async () => {
      const mockResponse = {
        isWorkspaceConfigured: true,
        id: 'workspace-1',
        name: 'My Workspace',
        status: 'ready',
        capabilities: {
          hasFilesystem: true,
          hasSandbox: false,
          canBM25: true,
          canVector: true,
          canHybrid: false,
          hasSkills: true,
        },
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.info();

      expect(result).toEqual(mockResponse);
      expect(result.isWorkspaceConfigured).toBe(true);
      expect(result.capabilities?.hasFilesystem).toBe(true);
    });
  });

  // ===========================================================================
  // Filesystem Operations
  // ===========================================================================
  describe('readFile()', () => {
    it('should read file with default encoding', async () => {
      const mockResponse = {
        path: '/test.txt',
        content: 'Hello World',
        type: 'file',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.readFile('/test.txt');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/fs/read?path=%2Ftest.txt`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should read file with custom encoding', async () => {
      const mockResponse = {
        path: '/binary.bin',
        content: 'SGVsbG8=',
        type: 'file',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.readFile('/binary.bin', 'base64');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/fs/read?path=%2Fbinary.bin&encoding=base64`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });

  describe('writeFile()', () => {
    it('should write file content', async () => {
      const mockResponse = {
        success: true,
        path: '/new-file.txt',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.writeFile('/new-file.txt', 'New content');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/fs/write`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining(clientOptions.headers),
          body: JSON.stringify({ path: '/new-file.txt', content: 'New content' }),
        }),
      );
    });

    it('should write file with recursive option', async () => {
      const mockResponse = {
        success: true,
        path: '/nested/path/file.txt',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.writeFile('/nested/path/file.txt', 'Content', true);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/fs/write`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ path: '/nested/path/file.txt', content: 'Content', recursive: true }),
        }),
      );
    });
  });

  describe('listFiles()', () => {
    it('should list directory contents', async () => {
      const mockResponse = {
        path: '/docs',
        entries: [
          { name: 'readme.md', type: 'file', size: 1024 },
          { name: 'images', type: 'directory' },
        ],
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.listFiles('/docs');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/fs/list?path=%2Fdocs`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should list recursively', async () => {
      const mockResponse = {
        path: '/',
        entries: [
          { name: 'file1.txt', type: 'file', size: 100 },
          { name: 'subdir/file2.txt', type: 'file', size: 200 },
        ],
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.listFiles('/', true);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/fs/list?path=%2F&recursive=true`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });

  describe('delete()', () => {
    it('should delete file', async () => {
      const mockResponse = {
        success: true,
        path: '/test.txt',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.delete('/test.txt');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/fs/delete?path=%2Ftest.txt`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should delete with recursive and force options', async () => {
      const mockResponse = {
        success: true,
        path: '/dir',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.delete('/dir', { recursive: true, force: true });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/fs/delete?path=%2Fdir&recursive=true&force=true`,
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  describe('mkdir()', () => {
    it('should create directory', async () => {
      const mockResponse = {
        success: true,
        path: '/new-dir',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.mkdir('/new-dir');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/fs/mkdir`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ path: '/new-dir' }),
        }),
      );
    });

    it('should create directory with recursive option', async () => {
      const mockResponse = {
        success: true,
        path: '/nested/dirs/path',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.mkdir('/nested/dirs/path', true);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/fs/mkdir`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ path: '/nested/dirs/path', recursive: true }),
        }),
      );
    });
  });

  describe('stat()', () => {
    it('should get file stats', async () => {
      const mockResponse = {
        path: '/test.txt',
        type: 'file',
        size: 1024,
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-02T00:00:00.000Z',
        mimeType: 'text/plain',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.stat('/test.txt');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/fs/stat?path=%2Ftest.txt`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should get directory stats', async () => {
      const mockResponse = {
        path: '/docs',
        type: 'directory',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.stat('/docs');

      expect(result).toEqual(mockResponse);
      expect(result.type).toBe('directory');
    });
  });

  // ===========================================================================
  // Search Operations
  // ===========================================================================
  describe('search()', () => {
    it('should search with query only', async () => {
      const mockResponse = {
        results: [{ id: '/doc.txt', content: 'match', score: 0.9 }],
        query: 'test query',
        mode: 'bm25',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.search({ query: 'test query' });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/search?query=test+query`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should search with all parameters', async () => {
      const mockResponse = {
        results: [{ id: '/doc.txt', content: 'match', score: 0.95 }],
        query: 'search term',
        mode: 'vector',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.search({
        query: 'search term',
        topK: 10,
        mode: 'vector',
        minScore: 0.5,
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/search?query=search+term&topK=10&mode=vector&minScore=0.5`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });

  describe('index()', () => {
    it('should index content', async () => {
      const mockResponse = {
        success: true,
        path: '/doc.txt',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.index({
        path: '/doc.txt',
        content: 'Document content to index',
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/index`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ path: '/doc.txt', content: 'Document content to index' }),
        }),
      );
    });

    it('should index content with metadata', async () => {
      const mockResponse = {
        success: true,
        path: '/doc.txt',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.index({
        path: '/doc.txt',
        content: 'Content',
        metadata: { author: 'Test', category: 'docs' },
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/index`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            path: '/doc.txt',
            content: 'Content',
            metadata: { author: 'Test', category: 'docs' },
          }),
        }),
      );
    });
  });

  describe('unindex()', () => {
    it('should unindex content', async () => {
      const mockResponse = {
        success: true,
        path: '/doc.txt',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.unindex('/doc.txt');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/unindex?path=%2Fdoc.txt`,
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  // ===========================================================================
  // Skills Operations
  // ===========================================================================
  describe('listSkills()', () => {
    it('should list all skills', async () => {
      const mockResponse = {
        skills: [
          { name: 'code-review', description: 'Code review skill', allowedTools: ['read_file'] },
          { name: 'documentation', description: 'Documentation skill' },
        ],
        isSkillsConfigured: true,
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.listSkills();

      expect(result).toEqual(mockResponse);
      expect(result.skills).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/skills`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should return empty when no skills configured', async () => {
      const mockResponse = {
        skills: [],
        isSkillsConfigured: false,
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.listSkills();

      expect(result.skills).toEqual([]);
      expect(result.isSkillsConfigured).toBe(false);
    });
  });

  describe('searchSkills()', () => {
    it('should search skills with query only', async () => {
      const mockResponse = {
        results: [{ skillName: 'skill1', source: 'instructions', content: 'match', score: 0.9 }],
        query: 'test',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.searchSkills({ query: 'test' });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/skills/search?query=test`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should search skills with all parameters', async () => {
      const mockResponse = {
        results: [],
        query: 'search term',
      };
      mockFetchResponse(mockResponse);

      const result = await workspace.searchSkills({
        query: 'search term',
        topK: 5,
        minScore: 0.7,
        skillNames: ['skill1', 'skill2'],
        includeReferences: true,
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/skills/search?query=search+term&topK=5&minScore=0.7&skillNames=skill1%2Cskill2&includeReferences=true`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });

  describe('getSkill()', () => {
    it('should return WorkspaceSkillResource', () => {
      const skillResource = workspace.getSkill('my-skill');

      expect(skillResource).toBeInstanceOf(WorkspaceSkillResource);
    });
  });
});

describe('WorkspaceSkillResource', () => {
  let client: MastraClient;
  let skillResource: WorkspaceSkillResource;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  // Helper to mock successful API responses
  const mockFetchResponse = (data: any) => {
    const response = new Response(undefined, {
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
    });
    response.json = () => Promise.resolve(data);
    (global.fetch as any).mockResolvedValueOnce(response);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
    skillResource = client.getWorkspace().getSkill('my-skill');
  });

  describe('details()', () => {
    it('should get skill details', async () => {
      const mockResponse = {
        name: 'my-skill',
        description: 'My skill description',
        instructions: 'Do the thing...',
        path: '/skills/my-skill',
        source: { type: 'local', path: '/skills/my-skill' },
        references: ['api.md', 'guide.md'],
        scripts: [],
        assets: [],
        allowedTools: ['read_file', 'write_file'],
      };
      mockFetchResponse(mockResponse);

      const result = await skillResource.details();

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/skills/my-skill`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should encode skill name with special characters', async () => {
      const specialSkillResource = client.getWorkspace().getSkill('skill/with/slashes');
      const mockResponse = { name: 'skill/with/slashes' };
      mockFetchResponse(mockResponse);

      await specialSkillResource.details();

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/skills/skill%2Fwith%2Fslashes`,
        expect.anything(),
      );
    });
  });

  describe('listReferences()', () => {
    it('should list skill references', async () => {
      const mockResponse = {
        skillName: 'my-skill',
        references: ['api.md', 'guide.md', 'examples/basic.md'],
      };
      mockFetchResponse(mockResponse);

      const result = await skillResource.listReferences();

      expect(result).toEqual(mockResponse);
      expect(result.references).toHaveLength(3);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/skills/my-skill/references`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });

  describe('getReference()', () => {
    it('should get reference content', async () => {
      const mockResponse = {
        skillName: 'my-skill',
        referencePath: 'api.md',
        content: '# API Documentation\n\nThis is the API...',
      };
      mockFetchResponse(mockResponse);

      const result = await skillResource.getReference('api.md');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/skills/my-skill/references/api.md`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should encode reference path with special characters', async () => {
      const mockResponse = {
        skillName: 'my-skill',
        referencePath: 'examples/nested/doc.md',
        content: 'Content',
      };
      mockFetchResponse(mockResponse);

      await skillResource.getReference('examples/nested/doc.md');

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/workspace/skills/my-skill/references/examples%2Fnested%2Fdoc.md`,
        expect.anything(),
      );
    });
  });
});
