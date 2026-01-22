import { describe, it, expect, vi } from 'vitest';

import type { WorkspaceFilesystem, FileEntry } from '../filesystem';
import type { SearchEngine, SearchResult, IndexInput } from '../search-engine';
import { WorkspaceSkillsImpl } from './workspace-skills';

// =============================================================================
// Mock Filesystem
// =============================================================================

function createMockFilesystem(files: Record<string, string | Buffer> = {}): WorkspaceFilesystem {
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
    writeFile: vi.fn(async (path: string, content: string | Buffer) => {
      fileSystem.set(path, content);
      // Add parent directories
      let dir = path;
      while (dir.includes('/')) {
        dir = dir.substring(0, dir.lastIndexOf('/'));
        if (dir) directories.add(dir);
      }
    }),
    exists: vi.fn(async (path: string) => {
      return fileSystem.has(path) || directories.has(path);
    }),
    readdir: vi.fn(async (path: string): Promise<FileEntry[]> => {
      const entries: FileEntry[] = [];
      const prefix = path === '/' ? '/' : `${path}/`;

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
              path: `${prefix}${name}`,
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
              path: `${prefix}${name}`,
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
    stat: vi.fn(async (path: string) => {
      const content = fileSystem.get(path);
      if (content) {
        return {
          path,
          type: 'file' as const,
          size: typeof content === 'string' ? content.length : content.length,
          modifiedAt: new Date(),
        };
      }
      if (directories.has(path)) {
        return {
          path,
          type: 'directory' as const,
          modifiedAt: new Date(),
        };
      }
      throw new Error(`Path not found: ${path}`);
    }),
    isFile: vi.fn(async (path: string) => fileSystem.has(path)),
    isDirectory: vi.fn(async (path: string) => directories.has(path)),
  };
}

// =============================================================================
// Mock Search Engine
// =============================================================================

function createMockSearchEngine(): SearchEngine & { indexedDocs: IndexInput[] } {
  const indexedDocs: IndexInput[] = [];

  return {
    indexedDocs,
    index: vi.fn(async (input: IndexInput) => {
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
allowed-tools: Read Edit Grep
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
        filesystem,
        skillsPaths: ['/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
      });

      const result = await skills.list();
      expect(result[0]).toMatchObject({
        name: 'test-skill',
        description: 'A test skill for unit testing',
        license: 'MIT',
      });
    });

    it('should parse allowed-tools from SKILL.md', async () => {
      const filesystem = createMockFilesystem({
        '/skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      const result = await skills.list();
      expect(result[0]?.allowedTools).toEqual(['Read', 'Edit', 'Grep']);
    });

    it('should discover skills from multiple skillsPaths', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/custom-skills/api-skill/SKILL.md': VALID_SKILL_MD_WITH_TOOLS,
      });

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills', '/custom-skills'],
      });

      const result = await skills.list();
      expect(result).toHaveLength(2);
    });
  });

  describe('get()', () => {
    it('should return null for non-existent skill', async () => {
      const filesystem = createMockFilesystem({});
      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      const result = await skills.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return full skill data', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
      });

      const result = await skills.has('non-existent');
      expect(result).toBe(false);
    });

    it('should return true for existing skill', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
      });

      const results = await skills.search('test', { topK: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('create()', () => {
    it('should create a new skill', async () => {
      const filesystem = createMockFilesystem({});

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      const newSkill = await skills.create({
        metadata: {
          name: 'new-skill',
          description: 'A newly created skill',
        },
        instructions: '# New Skill\n\nInstructions here.',
      });

      expect(newSkill.name).toBe('new-skill');
      expect(newSkill.description).toBe('A newly created skill');
      expect(await skills.has('new-skill')).toBe(true);

      // Verify file was written
      expect(filesystem.writeFile).toHaveBeenCalled();
    });

    it('should throw when skill already exists', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      await expect(
        skills.create({
          metadata: {
            name: 'test-skill',
            description: 'Duplicate skill',
          },
          instructions: 'Instructions',
        }),
      ).rejects.toThrow('already exists');
    });

    it('should create references, scripts, and assets', async () => {
      const filesystem = createMockFilesystem({});

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      await skills.create({
        metadata: {
          name: 'new-skill',
          description: 'Skill with files',
        },
        instructions: 'Instructions',
        references: [{ path: 'doc.md', content: REFERENCE_CONTENT }],
        scripts: [{ path: 'run.sh', content: SCRIPT_CONTENT }],
        assets: [{ path: 'logo.png', content: Buffer.from('PNG') }],
      });

      const skill = await skills.get('new-skill');
      expect(skill?.references).toContain('doc.md');
      expect(skill?.scripts).toContain('run.sh');
      expect(skill?.assets).toContain('logo.png');
    });
  });

  describe('update()', () => {
    it('should update skill metadata', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      const updated = await skills.update('test-skill', {
        metadata: {
          description: 'Updated description',
        },
      });

      expect(updated.description).toBe('Updated description');
      expect(updated.name).toBe('test-skill'); // Name should not change
    });

    it('should update skill instructions', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      const updated = await skills.update('test-skill', {
        instructions: '# Updated Instructions',
      });

      expect(updated.instructions).toBe('# Updated Instructions');
    });

    it('should throw when updating non-existent skill', async () => {
      const filesystem = createMockFilesystem({});

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      await expect(
        skills.update('non-existent', {
          metadata: { description: 'New' },
        }),
      ).rejects.toThrow('not found');
    });
  });

  describe('delete()', () => {
    it('should delete an existing skill', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      expect(await skills.has('test-skill')).toBe(true);

      await skills.delete('test-skill');

      expect(await skills.has('test-skill')).toBe(false);
      expect(filesystem.rmdir).toHaveBeenCalledWith('/skills/test-skill', { recursive: true });
    });

    it('should throw when deleting non-existent skill', async () => {
      const filesystem = createMockFilesystem({});

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      await expect(skills.delete('non-existent')).rejects.toThrow('not found');
    });
  });

  describe('getReference()', () => {
    it('should return reference content', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/test-skill/references/doc.md': REFERENCE_CONTENT,
      });

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      const content = await skills.getReference('test-skill', 'doc.md');
      expect(content).toBe(REFERENCE_CONTENT);
    });

    it('should return null for non-existent reference', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      const content = await skills.getReference('test-skill', 'non-existent.md');
      expect(content).toBeNull();
    });

    it('should return null for non-existent skill', async () => {
      const filesystem = createMockFilesystem({});

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      const content = await skills.getReference('non-existent', 'doc.md');
      expect(content).toBeNull();
    });
  });

  describe('getScript()', () => {
    it('should return script content', async () => {
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/test-skill/scripts/run.sh': SCRIPT_CONTENT,
      });

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      const content = await skills.getScript('test-skill', 'run.sh');
      expect(content).toBe(SCRIPT_CONTENT);
    });
  });

  describe('getAsset()', () => {
    it('should return asset as Buffer', async () => {
      const assetBuffer = Buffer.from('PNG image data');
      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
        '/skills/test-skill/assets/logo.png': assetBuffer,
      });

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      const content = await skills.getAsset('test-skill', 'logo.png');
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
        filesystem,
        skillsPaths: ['/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
      });

      const skill = await skills.get('test-skill');
      expect(skill?.source.type).toBe('local');
    });

    it('should detect external source from node_modules', async () => {
      const filesystem = createMockFilesystem({
        '/node_modules/@company/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/node_modules/@company/skills'],
      });

      const skill = await skills.get('test-skill');
      expect(skill?.source.type).toBe('external');
    });

    it('should detect managed source from .mastra/skills', async () => {
      const filesystem = createMockFilesystem({
        '/.mastra/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/.mastra/skills'],
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
        filesystem,
        skillsPaths: ['/skills'],
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
      (filesystem.stat as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => ({
        path,
        type: path.includes('.') ? ('file' as const) : ('directory' as const),
        modifiedAt: pastTime,
      }));

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
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
      let modifiedAt = new Date(Date.now() - 10000); // Start with old time

      const filesystem = createMockFilesystem({
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      });

      // Dynamic stat that returns current modifiedAt
      (filesystem.stat as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => ({
        path,
        type: path.includes('.') ? ('file' as const) : ('directory' as const),
        modifiedAt,
      }));

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      // First call initializes
      await skills.list();
      const initialReadFileCalls = (filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length;

      // Simulate directory modification (new file added)
      modifiedAt = new Date(Date.now() + 1000); // Future time

      // maybeRefresh should trigger a refresh
      await skills.maybeRefresh();
      const afterMaybeRefreshCalls = (filesystem.readFile as ReturnType<typeof vi.fn>).mock.calls.length;

      // readFile should be called again (refresh triggered - SKILL.md re-read)
      expect(afterMaybeRefreshCalls).toBeGreaterThan(initialReadFileCalls);
    });

    it('should detect new skills after maybeRefresh', async () => {
      let modifiedAt = new Date(Date.now() - 10000);
      const filesMap: Record<string, string> = {
        '/skills/test-skill/SKILL.md': VALID_SKILL_MD,
      };

      const filesystem = createMockFilesystem(filesMap);

      (filesystem.stat as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => ({
        path,
        type: path.includes('.') ? ('file' as const) : ('directory' as const),
        modifiedAt,
      }));

      const skills = new WorkspaceSkillsImpl({
        filesystem,
        skillsPaths: ['/skills'],
      });

      // Initial discovery
      const initialList = await skills.list();
      expect(initialList).toHaveLength(1);
      expect(initialList[0]!.name).toBe('test-skill');

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
    });
  });
});
