import { describe, it, expect, vi } from 'vitest';

import type { SearchResult, IndexDocument } from '../search';
import type { SkillSource, SkillSourceEntry, SkillSourceStat } from './skill-source';
import { WorkspaceSkillsImpl } from './workspace-skills';

/**
 * Mock skill source with write methods for test setup (simulating filesystem changes).
 */
type MockSkillSource = SkillSource & {
  writeFile(path: string, content: string | Buffer): Promise<void>;
  mkdir(path: string): Promise<void>;
  rmdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  deleteFile(path: string, options?: { force?: boolean }): Promise<void>;
};

// =============================================================================
// Mock Skill Source
// =============================================================================

function createMockFilesystem(files: Record<string, string | Buffer> = {}): MockSkillSource {
  const fileSystem = new Map<string, string | Buffer>(Object.entries(files));
  const directories = new Set<string>();

  // Initialize directories from file paths
  for (const path of Object.keys(files)) {
    let dir = path;
    while (dir.includes('/')) {
      dir = dir.substring(0, dir.lastIndexOf('/'));
      if (dir) directories.add(dir);
    }
  }

  // Normalize ./ prefixed paths to / prefixed (workspace root convention).
  // The real LocalFilesystem resolves both to basePath; the mock stores files with / prefix.
  const normalizePath = (p: string): string => (p === '.' || p === './' ? '/' : p.startsWith('./') ? p.slice(1) : p);

  return {
    readFile: vi.fn(async (path: string) => {
      const content = fileSystem.get(normalizePath(path));
      if (content === undefined) {
        throw new Error(`File not found: ${path}`);
      }
      return content;
    }),
    writeFile: vi.fn(async (path: string, content: string | Buffer) => {
      fileSystem.set(normalizePath(path), content);
      // Add parent directories
      let dir = normalizePath(path);
      while (dir.includes('/')) {
        dir = dir.substring(0, dir.lastIndexOf('/'));
        if (dir) directories.add(dir);
      }
    }),
    exists: vi.fn(async (path: string) => {
      const n = normalizePath(path);
      return fileSystem.has(n) || directories.has(n);
    }),
    readdir: vi.fn(async (path: string): Promise<SkillSourceEntry[]> => {
      const entries: SkillSourceEntry[] = [];
      const normalizedPath = normalizePath(path);
      const prefix = normalizedPath === '/' ? '/' : `${normalizedPath}/`;

      // Find immediate children
      for (const [filePath] of fileSystem) {
        if (filePath.startsWith(prefix)) {
          const relativePath = filePath.substring(prefix.length);
          const parts = relativePath.split('/');
          const name = parts[0]!;

          // Check if already added
          if (!entries.some(e => e.name === name)) {
            const isDir = parts.length > 1;
            entries.push({
              name,
              type: isDir ? 'directory' : 'file',
            });
          }
        }
      }

      // Add directories that might be empty
      for (const dir of directories) {
        if (dir.startsWith(prefix)) {
          const relativePath = dir.substring(prefix.length);
          const parts = relativePath.split('/');
          const name = parts[0]!;

          if (!entries.some(e => e.name === name)) {
            entries.push({
              name,
              type: 'directory',
            });
          }
        }
      }

      return entries;
    }),
    mkdir: vi.fn(async (path: string) => {
      directories.add(path);
    }),
    deleteFile: vi.fn(async (path: string) => {
      fileSystem.delete(path);
    }),
    rmdir: vi.fn(async (path: string) => {
      // Remove all files under the directory
      for (const [filePath] of fileSystem) {
        if (filePath.startsWith(`${path}/`)) {
          fileSystem.delete(filePath);
        }
      }
      directories.delete(path);
    }),
    stat: vi.fn(async (path: string): Promise<SkillSourceStat> => {
      const n = normalizePath(path);
      const name = n.split('/').pop() || n;
      const content = fileSystem.get(n);
      if (content) {
        return {
          name,
          type: 'file',
          size: typeof content === 'string' ? content.length : content.length,
          createdAt: new Date(),
          modifiedAt: new Date(),
        };
      }
      if (directories.has(n)) {
        return {
          name,
          type: 'directory',
          size: 0,
          createdAt: new Date(),
          modifiedAt: new Date(),
        };
      }
      throw new Error(`Path not found: ${path}`);
    }),
  };
}

// =============================================================================
// Mock Search Engine
// =============================================================================

/**
 * Minimal search engine interface for testing.
 */
interface MockSearchEngine {
  index(doc: IndexDocument): Promise<void>;
  search(query: string, options?: { topK?: number }): Promise<SearchResult[]>;
  clear(): void;
  canBM25: boolean;
  canVector: boolean;
  canHybrid: boolean;
}

function createMockSearchEngine(): MockSearchEngine & { indexedDocs: IndexDocument[] } {
  const indexedDocs: IndexDocument[] = [];

  return {
    indexedDocs,
    index: vi.fn(async (input: IndexDocument) => {
      indexedDocs.push(input);
    }),
    search: vi.fn(async (query: string, options?: { topK?: number }): Promise<SearchResult[]> => {
      const results: SearchResult[] = [];
      const queryLower = query.toLowerCase();

      for (const doc of indexedDocs) {
        if (doc.content.toLowerCase().includes(queryLower)) {
          results.push({
            id: doc.id,
            content: doc.content,
            score: 1,
            metadata: doc.metadata,
          });
        }
      }

      return results.slice(0, options?.topK ?? 10);
    }),
    clear: vi.fn(() => {
      indexedDocs.length = 0;
    }),
    canBM25: true,
    canVector: false,
    canHybrid: false,
  };
}

// =============================================================================
// Test Fixtures
// =============================================================================

const VALID_SKILL_MD = `---
name: test-skill
description: A test skill for unit testing
license: MIT
---

# Test Skill

This is the test skill instructions.

## Usage

Use this skill when you need to test things.
`;

const VALID_SKILL_MD_WITH_TOOLS = `---
name: api-skill
description: API design skill
---

# API Design

Design APIs according to best practices.
`;

const INVALID_SKILL_MD_BAD_NAME = `---
name: Invalid Name With Spaces
description: A skill with invalid name
---

Instructions here.
`;

const REFERENCE_CONTENT = `# Reference Document

This is a reference document for the skill.
`;

const SCRIPT_CONTENT = `#!/bin/bash
echo "Hello from script"
`;

// =============================================================================
// Tests
// =============================================================================

describe('WorkspaceSkillsImpl', () => {
  describe('list()', () => {
    it('should return empty array when no skills exist', async () => {
      const filesystem = createMockFilesystem({});
      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const result = await skills.list();
      expect(result).toEqual([]);
    });

    it('should list all discovered skills', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name)).toContain('test-skill');
      expect(result.map(s => s.name)).toContain('api-skill');
    });

    it('should include skill metadata in list results', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const result = await skills.list();
      expect(result[0]).toMatchObject({
        name: 'test-skill',
        description: 'A test skill for unit testing',
        license: 'MIT',
      });
    });

    it('should discover skills from multiple paths', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/custom-skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills', '/custom-skills'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(2);
    });
  });

  describe('get()', () => {
    it('should return null for non-existent skill', async () => {
      const filesystem = createMockFilesystem({});
      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const result = await skills.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return full skill data', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const result = await skills.get('test-skill');
      expect(result).not.toBeNull();
      expect(result?.name).toBe('test-skill');
      expect(result?.description).toBe('A test skill for unit testing');
      expect(result?.instructions).toContain('# Test Skill');
      expect(result?.path).toBe('/skills/test-skill');
    });

    it('should include discovered references, scripts, and assets', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/test-skill/references/doc.md': REFERENCE_CONTENT,
        '/skills/test-skill/scripts/run.sh': SCRIPT_CONTENT,
        '/skills/test-skill/assets/logo.png': Buffer.from('PNG'),
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const result = await skills.get('test-skill');
      expect(result?.references).toContain('doc.md');
      expect(result?.scripts).toContain('run.sh');
      expect(result?.assets).toContain('logo.png');
    });
  });

  describe('has()', () => {
    it('should return false for non-existent skill', async () => {
      const filesystem = createMockFilesystem({});
      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const result = await skills.has('non-existent');
      expect(result).toBe(false);
    });

    it('should return true for existing skill', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const result = await skills.has('test-skill');
      expect(result).toBe(true);
    });
  });

  describe('refresh()', () => {
    it('should re-discover skills after refresh', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      // Initial discovery
      let result = await skills.list();
      expect(result).toHaveLength(1);

      // Add a new skill to the filesystem
      await filesystem.writeFile('/skills/new-skill/SKILL.md', VALID_SKILL_MD.replace('test-skill', 'new-skill'));

      // Before refresh, should still be 1
      result = await skills.list();
      expect(result).toHaveLength(1);

      // After refresh, should be 2
      await skills.refresh();
      result = await skills.list();
      expect(result).toHaveLength(2);
    });
  });

  describe('search()', () => {
    it('should search skills by content using simple search', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const results = await skills.search('API');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.skillName).toBe('api-skill');
    });

    it('should use search engine when configured', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const searchEngine = createMockSearchEngine();

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
        searchEngine,
      });

      // Trigger initialization which indexes skills
      await skills.list();

      // Verify skill was indexed
      expect(searchEngine.indexedDocs.length).toBeGreaterThan(0);
      expect(searchEngine.indexedDocs[0]?.metadata?.skillName).toBe('test-skill');
    });

    it('should filter by skill names', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const results = await skills.search('skill', { skillNames: ['test-skill'] });
      expect(results.every(r => r.skillName === 'test-skill')).toBe(true);
    });

    it('should respect topK option', async () => {
      const filesystem = createMockFilesystem({
        '/skills/skill1/SKILL.md': VALID_SKILL_MD.replace('test-skill', 'skill1'),
        '/skills/skill2/SKILL.md': VALID_SKILL_MD.replace('test-skill', 'skill2'),
        '/skills/skill3/SKILL.md': VALID_SKILL_MD.replace('test-skill', 'skill3'),
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const results = await skills.search('test', { topK: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getReference()', () => {
    it('should return reference content using full skill-root-relative path', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/test-skill/references/doc.md': REFERENCE_CONTENT,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const content = await skills.getReference('test-skill', 'references/doc.md');
      expect(content).toBe(REFERENCE_CONTENT);
    });

    it('should resolve paths in non-references subdirectories', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/test-skill/docs/schema.md': 'schema content',
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const content = await skills.getReference('test-skill', 'docs/schema.md');
      expect(content).toBe('schema content');
    });

    it('should resolve ./prefixed paths relative to skill root', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/test-skill/config.json': '{}',
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const content = await skills.getReference('test-skill', './config.json');
      expect(content).toBe('{}');
    });

    it('should block path traversal attacks', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      await expect(skills.getReference('test-skill', '../../etc/passwd')).rejects.toThrow('Invalid reference path');
    });

    it('should return null for non-existent reference', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const content = await skills.getReference('test-skill', 'non-existent.md');
      expect(content).toBeNull();
    });

    it('should return null for non-existent skill', async () => {
      const filesystem = createMockFilesystem({});

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const content = await skills.getReference('non-existent', 'doc.md');
      expect(content).toBeNull();
    });
  });

  describe('getScript()', () => {
    it('should return script content using full skill-root-relative path', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/test-skill/scripts/run.sh': SCRIPT_CONTENT,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const content = await skills.getScript('test-skill', 'scripts/run.sh');
      expect(content).toBe(SCRIPT_CONTENT);
    });
  });

  describe('getAsset()', () => {
    it('should return asset as Buffer using full skill-root-relative path', async () => {
      const assetBuffer = Buffer.from('PNG image data');
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/test-skill/assets/logo.png': assetBuffer,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const content = await skills.getAsset('test-skill', 'assets/logo.png');
      expect(content).toBeInstanceOf(Buffer);
      expect(content?.toString()).toBe('PNG image data');
    });
  });

  describe('listReferences()', () => {
    it('should list all references for a skill', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/test-skill/references/doc1.md': 'Doc 1',
        '/skills/test-skill/references/doc2.md': 'Doc 2',
        '/skills/test-skill/references/nested/doc3.md': 'Doc 3',
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const refs = await skills.listReferences('test-skill');
      expect(refs).toContain('doc1.md');
      expect(refs).toContain('doc2.md');
      expect(refs).toContain('nested/doc3.md');
    });

    it('should return empty array for skill without references', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const refs = await skills.listReferences('test-skill');
      expect(refs).toEqual([]);
    });
  });

  describe('listScripts()', () => {
    it('should list all scripts for a skill', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/test-skill/scripts/run.sh': SCRIPT_CONTENT,
        '/skills/test-skill/scripts/build.sh': '#!/bin/bash\necho build',
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const scripts = await skills.listScripts('test-skill');
      expect(scripts).toContain('run.sh');
      expect(scripts).toContain('build.sh');
    });
  });

  describe('listAssets()', () => {
    it('should list all assets for a skill', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/test-skill/assets/logo.png': Buffer.from('PNG'),
        '/skills/test-skill/assets/icon.svg': '<svg></svg>',
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const assets = await skills.listAssets('test-skill');
      expect(assets).toContain('logo.png');
      expect(assets).toContain('icon.svg');
    });
  });

  describe('validation', () => {
    it('should reject skills with invalid names', async () => {
      const filesystem = createMockFilesystem({
        '/skills/invalid-skill/SKILL.md': INVALID_SKILL_MD_BAD_NAME,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
        validateOnLoad: true,
      });

      // Should skip invalid skills during discovery
      const result = await skills.list();
      expect(result).toHaveLength(0);
    });

    it('should skip validation when validateOnLoad is false', async () => {
      const filesystem = createMockFilesystem({
        '/skills/invalid-skill/SKILL.md': INVALID_SKILL_MD_BAD_NAME,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
        validateOnLoad: false,
      });

      const result = await skills.list();
      expect(result).toHaveLength(1);
    });

    it('should require skill name to match directory name', async () => {
      const filesystem = createMockFilesystem({
        '/skills/wrong-dir/SKILL.md': VALID_SKILL_MD, // skill name is 'test-skill' but dir is 'wrong-dir'
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
        validateOnLoad: true,
      });

      // Should skip skills where name doesn't match directory
      const result = await skills.list();
      expect(result).toHaveLength(0);
    });
  });

  describe('source detection', () => {
    it('should detect local source', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const skill = await skills.get('test-skill');
      expect(skill?.source.type).toBe('local');
    });

    it('should detect external source from node_modules', async () => {
      const filesystem = createMockFilesystem({
        '/node_modules/@company/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/node_modules/@company/skills'],
      });

      const skill = await skills.get('test-skill');
      expect(skill?.source.type).toBe('external');
    });

    it('should detect managed source from .mastra/skills', async () => {
      const filesystem = createMockFilesystem({
        '/.mastra/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/.mastra/skills'],
      });

      const skill = await skills.get('test-skill');
      expect(skill?.source.type).toBe('managed');
    });
  });

  describe('concurrent initialization', () => {
    it('should not discover skills multiple times when called concurrently', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      // Call list() concurrently
      const [result1, result2, result3] = await Promise.all([skills.list(), skills.list(), skills.list()]);

      // All should return the same result
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);

      // readdir should only be called once for the skills directory
      const readdirCalls = (filesystem.readdir as ReturnType<typeof vi.fn>).mock.calls.filter(
        call => call[0] === '/skills',
      );
      expect(readdirCalls.length).toBe(1);
    });
  });

  describe('maybeRefresh', () => {
    it('should not refresh when no changes have occurred', async () => {
      const pastTime = new Date(Date.now() - 10000); // 10 seconds ago
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      // Override stat to return old modification time
      (filesystem.stat as ReturnType<typeof vi.fn>).mockImplementation(
        async (path: string): Promise<SkillSourceStat> => ({
          name: path.split('/').pop() || path,
          type: path.includes('.') ? ('file' as const) : ('directory' as const),
          size: 0,
          createdAt: pastTime,
          modifiedAt: pastTime,
        }),
      );

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      // First call initializes
      await skills.list();
      const initialReadFileCalls = (filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length;

      // maybeRefresh should not trigger a refresh when nothing changed
      await skills.maybeRefresh();
      const afterMaybeRefreshCalls = (filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length;

      // readFile should not be called again (no refresh - SKILL.md files not re-read)
      expect(afterMaybeRefreshCalls).toBe(initialReadFileCalls);
    });

    it('should refresh when skillsPath has been modified', async () => {
      vi.useFakeTimers();
      try {
        let modifiedAt = new Date(Date.now() - 10000); // Start with old time

        const filesystem = createMockFilesystem({
          '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        });

        // Dynamic stat that returns current modifiedAt
        (filesystem.stat as ReturnType<typeof vi.fn>).mockImplementation(
          async (path: string): Promise<SkillSourceStat> => ({
            name: path.split('/').pop() || path,
            type: path.includes('.') ? ('file' as const) : ('directory' as const),
            size: 0,
            createdAt: modifiedAt,
            modifiedAt,
          }),
        );

        const skills = new WorkspaceSkillsImpl({
          source: filesystem,
          skills: ['/skills'],
        });

        // First call initializes
        await skills.list();
        const initialReadFileCalls = (filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length;

        // Advance past the staleness check cooldown
        vi.advanceTimersByTime(WorkspaceSkillsImpl.STALENESS_CHECK_COOLDOWN + 100);

        // Simulate directory modification (new file added)
        modifiedAt = new Date(Date.now() + 1000); // Future time

        // maybeRefresh should trigger a refresh
        await skills.maybeRefresh();
        const afterMaybeRefreshCalls = (filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length;

        // readFile should be called again (refresh triggered - SKILL.md re-read)
        expect(afterMaybeRefreshCalls).toBeGreaterThan(initialReadFileCalls);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should detect new skills after maybeRefresh', async () => {
      vi.useFakeTimers();
      try {
        let modifiedAt = new Date(Date.now() - 10000);
        const filesMap: Record<string, string> = {
          '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        };

        const filesystem = createMockFilesystem(filesMap);

        (filesystem.stat as ReturnType<typeof vi.fn>).mockImplementation(
          async (path: string): Promise<SkillSourceStat> => ({
            name: path.split('/').pop() || path,
            type: path.includes('.') ? ('file' as const) : ('directory' as const),
            size: 0,
            createdAt: modifiedAt,
            modifiedAt,
          }),
        );

        const skills = new WorkspaceSkillsImpl({
          source: filesystem,
          skills: ['/skills'],
        });

        // Initial discovery
        const initialList = await skills.list();
        expect(initialList).toHaveLength(1);
        expect(initialList[0]!.name).toBe('test-skill');

        // Advance past the staleness check cooldown
        vi.advanceTimersByTime(WorkspaceSkillsImpl.STALENESS_CHECK_COOLDOWN + 100);

        // Add a new skill to the filesystem
        const newSkillMd = `---
name: new-skill
description: A newly added skill
---

# New Skill

Instructions for the new skill.`;
        filesMap['/skills/new-skill/SKILL.md'] = newSkillMd;
        await filesystem.writeFile('/skills/new-skill/SKILL.md', newSkillMd);

        // Update modification time
        modifiedAt = new Date(Date.now() + 1000);

        // maybeRefresh should pick up the new skill
        await skills.maybeRefresh();
        const updatedList = await skills.list();

        expect(updatedList).toHaveLength(2);
        expect(updatedList.map(s => s.name).sort()).toEqual(['new-skill', 'test-skill']);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('maybeRefresh with file-level globs', () => {
    it('should detect new skills when using **/SKILL.md glob', async () => {
      vi.useFakeTimers();
      try {
        let modifiedAt = new Date(Date.now() - 10000);
        const filesMap: Record<string, string> = {
          '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        };

        const filesystem = createMockFilesystem(filesMap);

        (filesystem.stat as ReturnType<typeof vi.fn>).mockImplementation(
          async (path: string): Promise<SkillSourceStat> => ({
            name: path.split('/').pop() || path,
            type: path.includes('.') ? ('file' as const) : ('directory' as const),
            size: 0,
            createdAt: modifiedAt,
            modifiedAt,
          }),
        );

        const skills = new WorkspaceSkillsImpl({
          source: filesystem,
          skills: ['**/SKILL.md'],
        });

        // Initial discovery
        const initialList = await skills.list();
        expect(initialList).toHaveLength(1);
        expect(initialList[0]!.name).toBe('test-skill');

        // Advance past the staleness check cooldown
        vi.advanceTimersByTime(WorkspaceSkillsImpl.STALENESS_CHECK_COOLDOWN + 100);

        // Add a new skill
        const newSkillMd = `---
name: new-skill
description: A newly added skill
---

# New Skill

Instructions for the new skill.`;
        filesMap['/other/new-skill/SKILL.md'] = newSkillMd;
        await filesystem.writeFile('/other/new-skill/SKILL.md', newSkillMd);

        // Update modification time
        modifiedAt = new Date(Date.now() + 1000);

        // maybeRefresh should detect the change and pick up the new skill
        await skills.maybeRefresh();
        const updatedList = await skills.list();

        expect(updatedList).toHaveLength(2);
        expect(updatedList.map(s => s.name).sort()).toEqual(['new-skill', 'test-skill']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should detect new skills when using /skills/**/SKILL.md glob', async () => {
      vi.useFakeTimers();
      try {
        let modifiedAt = new Date(Date.now() - 10000);
        const filesMap: Record<string, string> = {
          '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        };

        const filesystem = createMockFilesystem(filesMap);

        (filesystem.stat as ReturnType<typeof vi.fn>).mockImplementation(
          async (path: string): Promise<SkillSourceStat> => ({
            name: path.split('/').pop() || path,
            type: path.includes('.') ? ('file' as const) : ('directory' as const),
            size: 0,
            createdAt: modifiedAt,
            modifiedAt,
          }),
        );

        const skills = new WorkspaceSkillsImpl({
          source: filesystem,
          skills: ['/skills/**/SKILL.md'],
        });

        // Initial discovery
        const initialList = await skills.list();
        expect(initialList).toHaveLength(1);

        // Advance past the staleness check cooldown
        vi.advanceTimersByTime(WorkspaceSkillsImpl.STALENESS_CHECK_COOLDOWN + 100);

        // Add a new skill under /skills
        const newSkillMd = `---
name: new-skill
description: A newly added skill
---

# New Skill

Instructions for the new skill.`;
        filesMap['/skills/new-skill/SKILL.md'] = newSkillMd;
        await filesystem.writeFile('/skills/new-skill/SKILL.md', newSkillMd);

        modifiedAt = new Date(Date.now() + 1000);

        await skills.maybeRefresh();
        const updatedList = await skills.list();

        expect(updatedList).toHaveLength(2);
        expect(updatedList.map(s => s.name).sort()).toEqual(['new-skill', 'test-skill']);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('read-only mode (SkillSource)', () => {
    // Create a mock read-only source (no write methods)
    function createMockReadOnlySource(files: Record<string, string | Buffer> = {}) {
      const fileSystem = new Map<string, string | Buffer>(Object.entries(files));
      const directories = new Set<string>();

      // Initialize directories from file paths
      for (const path of Object.keys(files)) {
        let dir = path;
        while (dir.includes('/')) {
          dir = dir.substring(0, dir.lastIndexOf('/'));
          if (dir) directories.add(dir);
        }
      }

      return {
        readFile: vi.fn(async (path: string) => {
          const content = fileSystem.get(path);
          if (content === undefined) {
            throw new Error(`File not found: ${path}`);
          }
          return content;
        }),
        exists: vi.fn(async (path: string) => {
          return fileSystem.has(path) || directories.has(path);
        }),
        readdir: vi.fn(async (path: string): Promise<Array<{ name: string; type: 'file' | 'directory' }>> => {
          const entries: Array<{ name: string; type: 'file' | 'directory' }> = [];
          const prefix = path === '/' ? '/' : `${path}/`;

          for (const [filePath] of fileSystem) {
            if (filePath.startsWith(prefix)) {
              const relativePath = filePath.substring(prefix.length);
              const parts = relativePath.split('/');
              const name = parts[0]!;

              if (!entries.some(e => e.name === name)) {
                const isDir = parts.length > 1;
                entries.push({
                  name,
                  type: isDir ? 'directory' : 'file',
                });
              }
            }
          }

          for (const dir of directories) {
            if (dir.startsWith(prefix)) {
              const relativePath = dir.substring(prefix.length);
              const parts = relativePath.split('/');
              const name = parts[0]!;

              if (!entries.some(e => e.name === name)) {
                entries.push({
                  name,
                  type: 'directory',
                });
              }
            }
          }

          return entries;
        }),
        stat: vi.fn(async (path: string): Promise<SkillSourceStat> => {
          const name = path.split('/').pop() || path;
          const content = fileSystem.get(path);
          if (content) {
            return {
              name,
              type: 'file',
              size: typeof content === 'string' ? content.length : content.length,
              createdAt: new Date(),
              modifiedAt: new Date(),
            };
          }
          if (directories.has(path)) {
            return {
              name,
              type: 'directory',
              size: 0,
              createdAt: new Date(),
              modifiedAt: new Date(),
            };
          }
          throw new Error(`Path not found: ${path}`);
        }),
        // NOTE: No writeFile, mkdir, rmdir - this is a read-only source
      };
    }

    it('should list skills from read-only source', async () => {
      const source = createMockReadOnlySource({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source,
        skills: ['/skills'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name)).toContain('test-skill');
      expect(result.map(s => s.name)).toContain('api-skill');
    });

    it('should get skill from read-only source', async () => {
      const source = createMockReadOnlySource({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/test-skill/references/doc.md': REFERENCE_CONTENT,
      });

      const skills = new WorkspaceSkillsImpl({
        source,
        skills: ['/skills'],
      });

      const skill = await skills.get('test-skill');
      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('test-skill');
      expect(skill?.references).toContain('doc.md');
    });

    it('should search skills from read-only source', async () => {
      const source = createMockReadOnlySource({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source,
        skills: ['/skills'],
      });

      const results = await skills.search('API');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.skillName).toBe('api-skill');
    });
  });

  describe('glob skills paths', () => {
    it('should discover skills in directories matching glob pattern', async () => {
      const filesystem = createMockFilesystem({
        '/project/src/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/project/lib/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['**/skills'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name).sort()).toEqual(['api-skill', 'test-skill']);
    });

    it('should still work with plain paths (backward compat)', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('test-skill');
    });

    it('should return empty list when glob matches no directories', async () => {
      const filesystem = createMockFilesystem({
        '/other/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['**/nonexistent'],
      });

      const result = await skills.list();
      expect(result).toEqual([]);
    });

    it('should mix plain paths and glob patterns', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/project/nested/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills', '**/nested/skills'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name).sort()).toEqual(['api-skill', 'test-skill']);
    });

    it('should discover skills in dot-directories via glob', async () => {
      const filesystem = createMockFilesystem({
        '/.agents/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['**/skills'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name).sort()).toEqual(['api-skill', 'test-skill']);
    });

    it('should handle glob pattern with non-existent base gracefully', async () => {
      const filesystem = createMockFilesystem({});

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/nonexistent/**/skills'],
      });

      const result = await skills.list();
      expect(result).toEqual([]);
    });

    it('should discover skills with ./ prefixed glob pattern', async () => {
      const filesystem = createMockFilesystem({
        '/src/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/.agents/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['./**/skills'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name).sort()).toEqual(['api-skill', 'test-skill']);
    });

    it('should handle redundant globstars like /**/**/skills', async () => {
      const filesystem = createMockFilesystem({
        '/src/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/**/**/skills'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('test-skill');
    });

    it('should not discover skills beyond maxDepth', async () => {
      const filesystem = createMockFilesystem({
        // Depth 2 from root — within maxDepth=4
        '/a/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        // Depth 5 from root — beyond maxDepth=4
        '/a/b/c/d/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['**/skills'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('test-skill');
    });

    it('should use walk root to extend effective depth', async () => {
      const filesystem = createMockFilesystem({
        // Depth 4 from root, but only depth 2 from /a/b (the walk root)
        '/a/b/c/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/a/b/**/skills'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('test-skill');
    });

    it('should discover skills with /skills/** glob', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills/**'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name).sort()).toEqual(['api-skill', 'test-skill']);
    });

    it('should discover skills with **/skills/** glob', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/src/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['**/skills/**'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name).sort()).toEqual(['api-skill', 'test-skill']);
    });

    it('should discover skills with file-level glob **/SKILL.md', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/other/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['**/SKILL.md'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name).sort()).toEqual(['api-skill', 'test-skill']);
    });

    it('should discover skills with /skills/**/SKILL.md glob', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/nested/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills/**/SKILL.md'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name).sort()).toEqual(['api-skill', 'test-skill']);
    });

    it('should discover a specific skill with **/skills/test-skill/SKILL.md glob', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['**/skills/test-skill/SKILL.md'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('test-skill');
    });

    it('should discover skills with trailing slash /skills/', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills/'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name).sort()).toEqual(['api-skill', 'test-skill']);
    });

    it('should not produce duplicate skills when multiple patterns match the same skill', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills', '**/skills'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('test-skill');
    });
  });

  describe('direct skill path discovery', () => {
    it('should discover a skill when path points to a directory containing SKILL.md', async () => {
      const filesystem = createMockFilesystem({
        '/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/test-skill'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('test-skill');

      const skill = await skills.get('test-skill');
      expect(skill?.path).toBe('/test-skill');
    });

    it('should discover a skill when path points directly to SKILL.md', async () => {
      const filesystem = createMockFilesystem({
        '/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/test-skill/SKILL.md'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('test-skill');

      const skill = await skills.get('test-skill');
      expect(skill?.path).toBe('/test-skill');
    });

    it('should handle mixed direct and directory scanning paths', async () => {
      const filesystem = createMockFilesystem({
        '/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/test-skill', '/skills'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name).sort()).toEqual(['api-skill', 'test-skill']);
    });

    it('should gracefully handle non-existent direct skill path', async () => {
      const filesystem = createMockFilesystem({});

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/non-existent/SKILL.md'],
      });

      const result = await skills.list();
      expect(result).toEqual([]);
    });

    it('should gracefully handle non-existent direct directory path', async () => {
      const filesystem = createMockFilesystem({});

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/non-existent-dir'],
      });

      const result = await skills.list();
      expect(result).toEqual([]);
    });

    it('should still scan subdirectories for a directory without SKILL.md', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name).sort()).toEqual(['api-skill', 'test-skill']);
    });

    it('should include references, scripts, and assets from direct skill path', async () => {
      const filesystem = createMockFilesystem({
        '/test-skill/SKILL.md': VALID_SKILL_MD,
        '/test-skill/references/doc.md': REFERENCE_CONTENT,
        '/test-skill/scripts/run.sh': SCRIPT_CONTENT,
        '/test-skill/assets/logo.png': Buffer.from('PNG'),
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/test-skill'],
      });

      const skill = await skills.get('test-skill');
      expect(skill?.references).toContain('doc.md');
      expect(skill?.scripts).toContain('run.sh');
      expect(skill?.assets).toContain('logo.png');
    });

    it('should handle staleness check for direct SKILL.md path', async () => {
      vi.useFakeTimers();
      try {
        let modifiedAt = new Date(Date.now() - 10000);

        const filesystem = createMockFilesystem({
          '/test-skill/SKILL.md': VALID_SKILL_MD,
        });

        (filesystem.stat as ReturnType<typeof vi.fn>).mockImplementation(
          async (path: string): Promise<SkillSourceStat> => ({
            name: path.split('/').pop() || path,
            type: path.endsWith('.md') ? ('file' as const) : ('directory' as const),
            size: 0,
            createdAt: modifiedAt,
            modifiedAt,
          }),
        );

        const skills = new WorkspaceSkillsImpl({
          source: filesystem,
          skills: ['/test-skill/SKILL.md'],
        });

        await skills.list();
        const initialReadFileCalls = (filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length;

        // Advance past cooldown so the staleness check actually runs
        vi.advanceTimersByTime(WorkspaceSkillsImpl.STALENESS_CHECK_COOLDOWN + 100);

        // No change — should not refresh (mtime is old)
        await skills.maybeRefresh();
        expect((filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length).toBe(initialReadFileCalls);

        // Simulate modification
        modifiedAt = new Date(Date.now() + 1000);
        await skills.maybeRefresh();
        expect((filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
          initialReadFileCalls,
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('addSkill()', () => {
    it('should add a new skill to cache and search index', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const searchEngine = createMockSearchEngine();

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
        searchEngine,
      });

      // Initial discovery — 1 skill
      await skills.list();
      expect(await skills.has('test-skill')).toBe(true);
      expect(await skills.has('api-skill')).toBe(false);

      // Write a new skill to the filesystem
      await filesystem.writeFile('/skills/api-skill/SKILL.md', VALID_SKILL_MD_WITH_TOOLS);

      // Surgically add it
      await skills.addSkill('/skills/api-skill');

      expect(await skills.has('api-skill')).toBe(true);
      const list = await skills.list();
      expect(list).toHaveLength(2);

      // Verify it was indexed for search
      const searchResults = await skills.search('API');
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults.some(r => r.skillName === 'api-skill')).toBe(true);
    });

    it('should replace existing skill in cache (update case)', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const searchEngine = createMockSearchEngine();

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
        searchEngine,
      });

      // Initial discovery
      await skills.list();
      const original = await skills.get('test-skill');
      expect(original?.instructions).toContain('This is the test skill instructions.');

      // Update the skill's SKILL.md with new content
      const updatedContent = `---
name: test-skill
description: Updated test skill
license: MIT
---

# Updated Test Skill

These are the updated instructions.
`;
      await filesystem.writeFile('/skills/test-skill/SKILL.md', updatedContent);

      // Surgically update
      await skills.addSkill('/skills/test-skill');

      const updated = await skills.get('test-skill');
      expect(updated?.description).toBe('Updated test skill');
      expect(updated?.instructions).toContain('updated instructions');

      // Should still be only 1 skill
      const list = await skills.list();
      expect(list).toHaveLength(1);
    });

    it('should accept a SKILL.md file path directly', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      // Initialize empty, then add via SKILL.md path
      await skills.list();

      await filesystem.writeFile('/skills/api-skill/SKILL.md', VALID_SKILL_MD_WITH_TOOLS);
      await skills.addSkill('/skills/api-skill/SKILL.md');

      expect(await skills.has('api-skill')).toBe(true);
    });

    it('should update lastDiscoveryTime so maybeRefresh does not trigger full scan', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      // Use an old mtime so staleness check doesn't trigger
      const pastTime = new Date(Date.now() - 10000);
      (filesystem.stat as ReturnType<typeof vi.fn>).mockImplementation(
        async (path: string): Promise<SkillSourceStat> => ({
          name: path.split('/').pop() || path,
          type: path.includes('.') ? ('file' as const) : ('directory' as const),
          size: 0,
          createdAt: pastTime,
          modifiedAt: pastTime,
        }),
      );

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      await skills.list();

      // Add a new skill
      await filesystem.writeFile('/skills/api-skill/SKILL.md', VALID_SKILL_MD_WITH_TOOLS);
      await skills.addSkill('/skills/api-skill');

      const readFileCallsAfterAdd = (filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length;

      // maybeRefresh should NOT trigger a full refresh since addSkill bumped the timestamp
      await skills.maybeRefresh();

      const readFileCallsAfterMaybeRefresh = (filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(readFileCallsAfterMaybeRefresh).toBe(readFileCallsAfterAdd);
    });
  });

  describe('removeSkill()', () => {
    it('should remove skill from cache and search index', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const searchEngine = createMockSearchEngine();

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
        searchEngine,
      });

      // Initial discovery — 2 skills
      await skills.list();
      expect(await skills.has('test-skill')).toBe(true);
      expect(await skills.has('api-skill')).toBe(true);

      // Surgically remove one
      await skills.removeSkill('test-skill');

      expect(await skills.has('test-skill')).toBe(false);
      expect(await skills.has('api-skill')).toBe(true);

      const list = await skills.list();
      expect(list).toHaveLength(1);
      expect(list[0]?.name).toBe('api-skill');
    });

    it('should be a no-op for unknown skill name', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      await skills.list();

      // Should not throw
      await skills.removeSkill('non-existent');

      // Original skill should still exist
      expect(await skills.has('test-skill')).toBe(true);
      const list = await skills.list();
      expect(list).toHaveLength(1);
    });

    it('should update lastDiscoveryTime so maybeRefresh does not trigger full scan', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const pastTime = new Date(Date.now() - 10000);
      (filesystem.stat as ReturnType<typeof vi.fn>).mockImplementation(
        async (path: string): Promise<SkillSourceStat> => ({
          name: path.split('/').pop() || path,
          type: path.includes('.') ? ('file' as const) : ('directory' as const),
          size: 0,
          createdAt: pastTime,
          modifiedAt: pastTime,
        }),
      );

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
      });

      await skills.list();

      await skills.removeSkill('test-skill');
      const readFileCallsAfterRemove = (filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length;

      // maybeRefresh should NOT trigger a full refresh since removeSkill bumped the timestamp
      await skills.maybeRefresh();

      const readFileCallsAfterMaybeRefresh = (filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(readFileCallsAfterMaybeRefresh).toBe(readFileCallsAfterRemove);
    });

    it('should remove search index entries including references', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/test-skill/references/doc.md': REFERENCE_CONTENT,
      });

      const removedIds: string[] = [];
      const searchEngine = {
        ...createMockSearchEngine(),
        remove: vi.fn(async (id: string) => {
          removedIds.push(id);
        }),
      };

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ['/skills'],
        searchEngine,
      });

      await skills.list();

      await skills.removeSkill('test-skill');

      // Should have removed SKILL.md and reference entries
      expect(removedIds).toContain('skill:test-skill:SKILL.md');
      expect(removedIds).toContain('skill:test-skill:doc.md');
    });
  });

  describe('dynamic skills paths', () => {
    const BASIC_SKILL_MD = `---
name: basic-skill
description: A basic skill
---

# Basic Skill

Basic instructions.
`;

    const PREMIUM_SKILL_MD = `---
name: premium-skill
description: A premium skill
---

# Premium Skill

Premium instructions.
`;

    it('should accept a function for skills config', async () => {
      const filesystem = createMockFilesystem({
        '/skills/basic/basic-skill/SKILL.md': BASIC_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: () => ['/skills/basic'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('basic-skill');
    });

    it('should accept an async function for skills config', async () => {
      const filesystem = createMockFilesystem({
        '/skills/basic/basic-skill/SKILL.md': BASIC_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: async () => {
          // Simulate async operation (e.g., fetching config)
          await new Promise(resolve => setTimeout(resolve, 10));
          return ['/skills/basic'];
        },
      });

      const result = await skills.list();
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('basic-skill');
    });

    it('should pass context to skills function', async () => {
      const filesystem = createMockFilesystem({
        '/skills/basic/basic-skill/SKILL.md': BASIC_SKILL_MD,
        '/skills/premium/premium-skill/SKILL.md': PREMIUM_SKILL_MD,
      });

      let capturedContext: { requestContext?: unknown } | undefined;

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ctx => {
          capturedContext = ctx;
          return ['/skills/basic'];
        },
      });

      // list() calls with empty context (requestContext is undefined)
      await skills.list();
      expect(capturedContext).toBeDefined();
      expect(capturedContext?.requestContext).toBeUndefined(); // No context provided on initial call

      // maybeRefresh() can be called with explicit context
      const mockRequestContext = { get: (_key: string) => 'test-value' };
      await skills.maybeRefresh({ requestContext: mockRequestContext as unknown as undefined });

      // Now context should have requestContext
      expect(capturedContext?.requestContext).toBeDefined();
    });

    it('should return different skills based on context', async () => {
      const filesystem = createMockFilesystem({
        '/skills/basic/basic-skill/SKILL.md': BASIC_SKILL_MD,
        '/skills/premium/premium-skill/SKILL.md': PREMIUM_SKILL_MD,
      });

      // Create a mock RequestContext-like object
      const createMockRequestContext = (tier: string) => ({
        get: (key: string) => (key === 'userTier' ? tier : undefined),
      });

      let currentTier = 'basic';

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: ctx => {
          const tier = (ctx.requestContext as ReturnType<typeof createMockRequestContext>)?.get?.('userTier');
          if (tier === 'premium') {
            return ['/skills/basic', '/skills/premium'];
          }
          return ['/skills/basic'];
        },
      });

      // Initial list with basic tier (empty context)
      const basicResult = await skills.list();
      expect(basicResult).toHaveLength(1);
      expect(basicResult[0]?.name).toBe('basic-skill');

      // Now change tier to premium and call maybeRefresh with context
      currentTier = 'premium';
      await skills.maybeRefresh({
        requestContext: createMockRequestContext(currentTier) as unknown as undefined,
      });

      const premiumResult = await skills.list();
      expect(premiumResult).toHaveLength(2);
      expect(premiumResult.map(s => s.name).sort()).toEqual(['basic-skill', 'premium-skill']);
    });

    it('should detect when dynamic paths change and trigger refresh', async () => {
      const filesystem = createMockFilesystem({
        '/skills/path-a/skill-a/SKILL.md': BASIC_SKILL_MD.replace('basic-skill', 'skill-a'),
        '/skills/path-b/skill-b/SKILL.md': BASIC_SKILL_MD.replace('basic-skill', 'skill-b'),
      });

      let currentPath = '/skills/path-a';

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: () => [currentPath],
      });

      // Initial list
      const initialResult = await skills.list();
      expect(initialResult).toHaveLength(1);
      expect(initialResult[0]?.name).toBe('skill-a');

      // Change path and call maybeRefresh
      currentPath = '/skills/path-b';
      await skills.maybeRefresh();

      const newResult = await skills.list();
      expect(newResult).toHaveLength(1);
      expect(newResult[0]?.name).toBe('skill-b');
    });

    it('should not refresh when dynamic paths return same result', async () => {
      const pastTime = new Date(Date.now() - 10000);
      const filesystem = createMockFilesystem({
        '/skills/basic-skill/SKILL.md': BASIC_SKILL_MD,
      });

      // Override stat to return old modification time
      (filesystem.stat as ReturnType<typeof vi.fn>).mockImplementation(
        async (path: string): Promise<SkillSourceStat> => ({
          name: path.split('/').pop() || path,
          type: path.includes('.') ? ('file' as const) : ('directory' as const),
          size: 0,
          createdAt: pastTime,
          modifiedAt: pastTime,
        }),
      );

      const pathsResolver = vi.fn(() => ['/skills']);

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: pathsResolver,
      });

      // Initial list
      await skills.list();
      const initialReadFileCalls = (filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length;

      // Call maybeRefresh multiple times - paths don't change, mtime is old
      await skills.maybeRefresh();
      await skills.maybeRefresh();
      await skills.maybeRefresh();

      // readFile should not be called again (no refresh triggered)
      const afterMaybeRefreshCalls = (filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(afterMaybeRefreshCalls).toBe(initialReadFileCalls);

      // But pathsResolver should be called each time to check for path changes
      expect(pathsResolver).toHaveBeenCalledTimes(4); // 1 initial + 3 maybeRefresh
    });

    it('should handle empty paths from dynamic resolver', async () => {
      const filesystem = createMockFilesystem({});

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        skills: () => [],
      });

      const result = await skills.list();
      expect(result).toEqual([]);
    });

    it('should work with order-independent path comparison', async () => {
      const filesystem = createMockFilesystem({
        '/skills/a/skill-a/SKILL.md': BASIC_SKILL_MD.replace('basic-skill', 'skill-a'),
        '/skills/b/skill-b/SKILL.md': BASIC_SKILL_MD.replace('basic-skill', 'skill-b'),
      });

      let callCount = 0;

      const skills = new WorkspaceSkillsImpl({
        source: filesystem,
        // Return paths in different order but same content
        skills: () => {
          callCount++;
          return callCount % 2 === 0 ? ['/skills/b', '/skills/a'] : ['/skills/a', '/skills/b'];
        },
      });

      // Initial list
      await skills.list();
      const initialReadFileCalls = (filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length;

      // Call maybeRefresh - paths are same (just different order)
      const pastTime = new Date(Date.now() - 10000);
      (filesystem.stat as ReturnType<typeof vi.fn>).mockImplementation(
        async (path: string): Promise<SkillSourceStat> => ({
          name: path.split('/').pop() || path,
          type: path.includes('.') ? ('file' as const) : ('directory' as const),
          size: 0,
          createdAt: pastTime,
          modifiedAt: pastTime,
        }),
      );

      await skills.maybeRefresh();

      // Should not trigger refresh since paths are the same (order-independent)
      const afterMaybeRefreshCalls = (filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(afterMaybeRefreshCalls).toBe(initialReadFileCalls);
    });
  });
});
