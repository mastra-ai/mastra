import { createHash } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';

import { InMemoryBlobStore } from '../../storage/domains/blobs/inmemory';
import type { SkillVersionTree, StorageBlobEntry } from '../../storage/types';
import { CompositeVersionedSkillSource } from './composite-versioned-skill-source';
import { collectSkillForPublish, publishSkillFromSource } from './publish';
import type { SkillSource, SkillSourceEntry, SkillSourceStat } from './skill-source';
import { VersionedSkillSource } from './versioned-skill-source';
import { WorkspaceSkillsImpl } from './workspace-skills';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create a mock SkillSource from an in-memory file map.
 * Keys are relative paths (e.g. 'SKILL.md', 'references/api.md').
 * Directories are computed automatically from file paths.
 */
function createMockSource(files: Record<string, string>): SkillSource {
  const fileMap = new Map<string, string>(Object.entries(files));
  const directories = new Set<string>();
  directories.add('');

  for (const filePath of Object.keys(files)) {
    const parts = filePath.split('/');
    for (let i = 1; i < parts.length; i++) {
      directories.add(parts.slice(0, i).join('/'));
    }
  }

  return {
    exists: vi.fn(async (path: string): Promise<boolean> => {
      return fileMap.has(path) || directories.has(path);
    }),
    stat: vi.fn(async (path: string): Promise<SkillSourceStat> => {
      const name = path.split('/').pop() || path || '.';
      if (fileMap.has(path)) {
        const content = fileMap.get(path)!;
        return {
          name,
          type: 'file',
          size: Buffer.byteLength(content, 'utf-8'),
          createdAt: new Date('2024-01-01'),
          modifiedAt: new Date('2024-01-01'),
        };
      }
      if (directories.has(path)) {
        return {
          name,
          type: 'directory',
          size: 0,
          createdAt: new Date('2024-01-01'),
          modifiedAt: new Date('2024-01-01'),
        };
      }
      throw new Error(`Path not found: ${path}`);
    }),
    readFile: vi.fn(async (path: string): Promise<string | Buffer> => {
      const content = fileMap.get(path);
      if (content === undefined) {
        throw new Error(`File not found: ${path}`);
      }
      return content;
    }),
    readdir: vi.fn(async (path: string): Promise<SkillSourceEntry[]> => {
      const prefix = path === '' ? '' : path + '/';
      const seen = new Set<string>();
      const entries: SkillSourceEntry[] = [];

      for (const filePath of fileMap.keys()) {
        if (!filePath.startsWith(prefix)) continue;
        const remaining = filePath.slice(prefix.length);
        const nextSegment = remaining.split('/')[0];
        if (!nextSegment || seen.has(nextSegment)) continue;
        seen.add(nextSegment);

        const isDirectory = remaining.includes('/');
        entries.push({
          name: nextSegment,
          type: isDirectory ? 'directory' : 'file',
        });
      }

      return entries;
    }),
  };
}

/**
 * Build a SKILL.md string from frontmatter fields and markdown body.
 */
function createSkillMd(
  meta: {
    name: string;
    description: string;
    license?: string;
    compatibility?: string;
    metadata?: Record<string, unknown>;
  },
  body: string,
): string {
  const lines = ['---'];
  lines.push(`name: ${meta.name}`);
  lines.push(`description: ${meta.description}`);
  if (meta.license) lines.push(`license: ${meta.license}`);
  if (meta.compatibility) lines.push(`compatibility: ${meta.compatibility}`);
  if (meta.metadata) {
    lines.push('metadata:');
    for (const [key, value] of Object.entries(meta.metadata)) {
      lines.push(`  ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push(body);
  return lines.join('\n');
}

/**
 * Compute SHA-256 hex hash of content (mirrors publish.ts logic).
 */
function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

// =============================================================================
// 1. collectSkillForPublish
// =============================================================================

describe('collectSkillForPublish', () => {
  /**
   * Helper: create a mock source where files are nested under a skill directory path.
   * walkSkillDirectory expects basePath to be a non-empty path so that
   * relativePath = entryPath.substring(basePath.length + 1) works correctly.
   */
  function createSkillSource(
    files: Record<string, string>,
    skillDir = 'my-skill',
  ): { source: SkillSource; skillPath: string } {
    const prefixed: Record<string, string> = {};
    for (const [key, value] of Object.entries(files)) {
      prefixed[`${skillDir}/${key}`] = value;
    }
    return { source: createMockSource(prefixed), skillPath: skillDir };
  }

  it('should collect a simple skill with SKILL.md only', async () => {
    const skillMd = createSkillMd(
      { name: 'simple-skill', description: 'A simple skill' },
      '# Simple Skill\n\nDo simple things.',
    );
    const { source, skillPath } = createSkillSource({ 'SKILL.md': skillMd });

    const result = await collectSkillForPublish(source, skillPath);

    expect(result.snapshot.name).toBe('simple-skill');
    expect(result.snapshot.description).toBe('A simple skill');
    expect(result.snapshot.instructions).toBe('# Simple Skill\n\nDo simple things.');
    expect(Object.keys(result.tree.entries)).toHaveLength(1);
    expect(result.tree.entries['SKILL.md']).toBeDefined();
    expect(result.blobs).toHaveLength(1);
  });

  it('should collect skill with references, scripts, assets', async () => {
    const skillMd = createSkillMd(
      { name: 'full-skill', description: 'A full skill' },
      '# Full Skill\n\nInstructions here.',
    );
    const { source, skillPath } = createSkillSource({
      'SKILL.md': skillMd,
      'references/api.md': '# API Reference\n\nEndpoints...',
      'scripts/setup.sh': '#!/bin/bash\necho "setup"',
      'assets/logo.png': 'PNG_BINARY_DATA',
    });

    const result = await collectSkillForPublish(source, skillPath);

    expect(Object.keys(result.tree.entries)).toHaveLength(4);
    expect(result.tree.entries['SKILL.md']).toBeDefined();
    expect(result.tree.entries['references/api.md']).toBeDefined();
    expect(result.tree.entries['scripts/setup.sh']).toBeDefined();
    expect(result.tree.entries['assets/logo.png']).toBeDefined();

    expect(result.snapshot.references).toEqual(['api.md']);
    expect(result.snapshot.scripts).toEqual(['setup.sh']);
    expect(result.snapshot.assets).toEqual(['logo.png']);
  });

  it('should deduplicate identical file contents', async () => {
    const skillMd = createSkillMd({ name: 'dedup-skill', description: 'Dedup test' }, '# Dedup');
    const duplicateContent = 'This content is identical in both files.';
    const { source, skillPath } = createSkillSource({
      'SKILL.md': skillMd,
      'references/a.md': duplicateContent,
      'references/b.md': duplicateContent,
    });

    const result = await collectSkillForPublish(source, skillPath);

    // 3 tree entries (SKILL.md + 2 references)
    expect(Object.keys(result.tree.entries)).toHaveLength(3);
    // But only 2 blobs (SKILL.md + one shared blob for the duplicate content)
    expect(result.blobs).toHaveLength(2);

    // Both reference entries should point to the same blob hash
    const hashA = result.tree.entries['references/a.md']!.blobHash;
    const hashB = result.tree.entries['references/b.md']!.blobHash;
    expect(hashA).toBe(hashB);
  });

  it('should hash files consistently', async () => {
    const content = 'Consistent content for hashing test.';
    const expectedHash = sha256(content);

    const skillMd = createSkillMd({ name: 'hash-skill', description: 'Hash test' }, '# Hash');
    const { source, skillPath } = createSkillSource({
      'SKILL.md': skillMd,
      'references/doc.md': content,
    });

    const result = await collectSkillForPublish(source, skillPath);

    expect(result.tree.entries['references/doc.md']!.blobHash).toBe(expectedHash);
  });

  it('should detect MIME types', async () => {
    const skillMd = createSkillMd({ name: 'mime-skill', description: 'MIME test' }, '# MIME');
    const { source, skillPath } = createSkillSource({
      'SKILL.md': skillMd,
      'references/doc.md': '# Doc',
      'references/data.json': '{}',
      'scripts/run.py': 'print("hi")',
      'scripts/build.sh': '#!/bin/bash',
      'assets/image.png': 'PNG',
      'assets/style.css': 'body {}',
    });

    const result = await collectSkillForPublish(source, skillPath);

    expect(result.tree.entries['SKILL.md']!.mimeType).toBe('text/markdown');
    expect(result.tree.entries['references/doc.md']!.mimeType).toBe('text/markdown');
    expect(result.tree.entries['references/data.json']!.mimeType).toBe('application/json');
    expect(result.tree.entries['scripts/run.py']!.mimeType).toBe('text/x-python');
    expect(result.tree.entries['scripts/build.sh']!.mimeType).toBe('text/x-shellscript');
    expect(result.tree.entries['assets/image.png']!.mimeType).toBe('image/png');
    expect(result.tree.entries['assets/style.css']!.mimeType).toBe('text/css');
  });

  it('should throw if SKILL.md is missing', async () => {
    const { source, skillPath } = createSkillSource({
      'references/api.md': '# API',
    });

    await expect(collectSkillForPublish(source, skillPath)).rejects.toThrow('SKILL.md not found');
  });

  it('should handle nested directories', async () => {
    const skillMd = createSkillMd({ name: 'nested-skill', description: 'Nested test' }, '# Nested');
    const { source, skillPath } = createSkillSource({
      'SKILL.md': skillMd,
      'references/deep/nested/file.md': '# Deep nested file',
    });

    const result = await collectSkillForPublish(source, skillPath);

    expect(result.tree.entries['references/deep/nested/file.md']).toBeDefined();
    expect(result.tree.entries['references/deep/nested/file.md']!.mimeType).toBe('text/markdown');
    expect(result.snapshot.references).toEqual(['deep/nested/file.md']);
  });

  it('should parse frontmatter fields correctly', async () => {
    const skillMd = createSkillMd(
      {
        name: 'meta-skill',
        description: 'Metadata test skill',
        license: 'Apache-2.0',
        compatibility: 'node>=18',
        metadata: { author: 'test-user', version: '1.0.0' },
      },
      '# Meta Skill\n\nInstructions.',
    );
    const { source, skillPath } = createSkillSource({ 'SKILL.md': skillMd });

    const result = await collectSkillForPublish(source, skillPath);

    expect(result.snapshot.name).toBe('meta-skill');
    expect(result.snapshot.description).toBe('Metadata test skill');
    expect(result.snapshot.license).toBe('Apache-2.0');
    expect(result.snapshot.compatibility).toBe('node>=18');
    expect(result.snapshot.metadata).toBeDefined();
    expect(result.snapshot.metadata!.author).toBe('test-user');
  });
});

// =============================================================================
// 2. publishSkillFromSource
// =============================================================================

describe('publishSkillFromSource', () => {
  function createSkillSource(
    files: Record<string, string>,
    skillDir = 'my-skill',
  ): { source: SkillSource; skillPath: string } {
    const prefixed: Record<string, string> = {};
    for (const [key, value] of Object.entries(files)) {
      prefixed[`${skillDir}/${key}`] = value;
    }
    return { source: createMockSource(prefixed), skillPath: skillDir };
  }

  it('should store blobs in the blob store', async () => {
    const skillMd = createSkillMd({ name: 'publish-skill', description: 'Publish test' }, '# Publish\n\nInstructions.');
    const { source, skillPath } = createSkillSource({
      'SKILL.md': skillMd,
      'references/api.md': '# API Reference',
    });
    const blobStore = new InMemoryBlobStore();

    const result = await publishSkillFromSource(source, skillPath, blobStore);

    // Verify blobs are stored
    for (const blob of result.blobs) {
      const stored = await blobStore.get(blob.hash);
      expect(stored).not.toBeNull();
      expect(stored!.content).toBe(blob.content);
    }

    // Verify we can retrieve by tree entry hash
    const skillMdHash = result.tree.entries['SKILL.md']!.blobHash;
    const storedSkillMd = await blobStore.get(skillMdHash);
    expect(storedSkillMd).not.toBeNull();
    expect(storedSkillMd!.content).toBe(skillMd);
  });

  it('should deduplicate blobs across publishes', async () => {
    const skillMd = createSkillMd({ name: 'dedup-publish', description: 'Dedup publish test' }, '# Dedup Publish');
    const { source, skillPath } = createSkillSource({ 'SKILL.md': skillMd });
    const blobStore = new InMemoryBlobStore();

    // Spy on put to count calls
    const putSpy = vi.spyOn(blobStore, 'put');

    await publishSkillFromSource(source, skillPath, blobStore);
    const firstPutCount = putSpy.mock.calls.length;

    await publishSkillFromSource(source, skillPath, blobStore);
    const secondPutCount = putSpy.mock.calls.length - firstPutCount;

    // Second publish should still call put (putMany calls put for each),
    // but InMemoryBlobStore.put is a no-op if hash exists
    expect(secondPutCount).toBeGreaterThan(0);

    // Verify the blob is still correct (not corrupted by second put)
    const hash = sha256(skillMd);
    const stored = await blobStore.get(hash);
    expect(stored).not.toBeNull();
    expect(stored!.content).toBe(skillMd);
  });
});

// =============================================================================
// 3. InMemoryBlobStore
// =============================================================================

describe('InMemoryBlobStore', () => {
  function createEntry(content: string): StorageBlobEntry {
    return {
      hash: sha256(content),
      content,
      size: Buffer.byteLength(content, 'utf-8'),
      mimeType: 'text/plain',
      createdAt: new Date(),
    };
  }

  it('put and get', async () => {
    const store = new InMemoryBlobStore();
    const entry = createEntry('hello world');

    await store.put(entry);
    const result = await store.get(entry.hash);

    expect(result).not.toBeNull();
    expect(result!.content).toBe('hello world');
    expect(result!.hash).toBe(entry.hash);
  });

  it('put is idempotent', async () => {
    const store = new InMemoryBlobStore();
    const entry1 = createEntry('same content');
    const entry2: StorageBlobEntry = {
      ...createEntry('same content'),
      mimeType: 'text/markdown', // different metadata
    };

    await store.put(entry1);
    await store.put(entry2);

    const result = await store.get(entry1.hash);
    expect(result).not.toBeNull();
    // First entry wins (put is no-op if hash exists)
    expect(result!.mimeType).toBe('text/plain');
  });

  it('get returns null for missing', async () => {
    const store = new InMemoryBlobStore();
    const result = await store.get('nonexistent-hash');
    expect(result).toBeNull();
  });

  it('has returns true/false correctly', async () => {
    const store = new InMemoryBlobStore();
    const entry = createEntry('test content');

    expect(await store.has(entry.hash)).toBe(false);
    await store.put(entry);
    expect(await store.has(entry.hash)).toBe(true);
  });

  it('delete removes blob', async () => {
    const store = new InMemoryBlobStore();
    const entry = createEntry('to be deleted');

    await store.put(entry);
    expect(await store.has(entry.hash)).toBe(true);

    const deleted = await store.delete(entry.hash);
    expect(deleted).toBe(true);
    expect(await store.get(entry.hash)).toBeNull();
  });

  it('delete returns false for missing', async () => {
    const store = new InMemoryBlobStore();
    const deleted = await store.delete('nonexistent');
    expect(deleted).toBe(false);
  });

  it('putMany stores multiple blobs', async () => {
    const store = new InMemoryBlobStore();
    const entries = [createEntry('blob-a'), createEntry('blob-b'), createEntry('blob-c')];

    await store.putMany(entries);

    for (const entry of entries) {
      const result = await store.get(entry.hash);
      expect(result).not.toBeNull();
      expect(result!.content).toBe(entry.content);
    }
  });

  it('getMany returns Map with found entries, omits missing', async () => {
    const store = new InMemoryBlobStore();
    const entryA = createEntry('found-a');
    const entryB = createEntry('found-b');

    await store.put(entryA);
    await store.put(entryB);

    const result = await store.getMany([entryA.hash, entryB.hash, 'missing-hash']);

    expect(result.size).toBe(2);
    expect(result.has(entryA.hash)).toBe(true);
    expect(result.has(entryB.hash)).toBe(true);
    expect(result.has('missing-hash')).toBe(false);
  });

  it('dangerouslyClearAll clears everything', async () => {
    const store = new InMemoryBlobStore();
    await store.put(createEntry('a'));
    await store.put(createEntry('b'));

    await store.dangerouslyClearAll();

    expect(await store.has(sha256('a'))).toBe(false);
    expect(await store.has(sha256('b'))).toBe(false);
  });
});

// =============================================================================
// 4. VersionedSkillSource
// =============================================================================

describe('VersionedSkillSource', () => {
  const now = new Date('2024-06-01');

  function createVersionedSource() {
    const blobStore = new InMemoryBlobStore();
    const skillMdContent = '---\nname: test\ndescription: test\n---\n\n# Test';
    const refContent = '# API Reference\n\nDetails here.';
    const nestedContent = '# Nested doc';

    const skillMdHash = sha256(skillMdContent);
    const refHash = sha256(refContent);
    const nestedHash = sha256(nestedContent);

    const tree: SkillVersionTree = {
      entries: {
        'SKILL.md': { blobHash: skillMdHash, size: Buffer.byteLength(skillMdContent), mimeType: 'text/markdown' },
        'references/api.md': { blobHash: refHash, size: Buffer.byteLength(refContent), mimeType: 'text/markdown' },
        'references/deep/nested.md': {
          blobHash: nestedHash,
          size: Buffer.byteLength(nestedContent),
          mimeType: 'text/markdown',
        },
      },
    };

    // Store blobs
    blobStore.put({
      hash: skillMdHash,
      content: skillMdContent,
      size: Buffer.byteLength(skillMdContent),
      createdAt: now,
    });
    blobStore.put({ hash: refHash, content: refContent, size: Buffer.byteLength(refContent), createdAt: now });
    blobStore.put({ hash: nestedHash, content: nestedContent, size: Buffer.byteLength(nestedContent), createdAt: now });

    const source = new VersionedSkillSource(tree, blobStore, now);
    return { source, blobStore, tree, skillMdContent, refContent, nestedContent };
  }

  it('exists returns true for files', async () => {
    const { source } = createVersionedSource();
    expect(await source.exists('SKILL.md')).toBe(true);
    expect(await source.exists('references/api.md')).toBe(true);
  });

  it('exists returns true for directories', async () => {
    const { source } = createVersionedSource();
    expect(await source.exists('references')).toBe(true);
    expect(await source.exists('references/deep')).toBe(true);
  });

  it('exists returns true for root', async () => {
    const { source } = createVersionedSource();
    expect(await source.exists('')).toBe(true);
    expect(await source.exists('.')).toBe(true);
  });

  it('exists returns false for missing paths', async () => {
    const { source } = createVersionedSource();
    expect(await source.exists('nonexistent.md')).toBe(false);
    expect(await source.exists('references/missing.md')).toBe(false);
  });

  it('stat returns file info', async () => {
    const { source, skillMdContent } = createVersionedSource();
    const stat = await source.stat('SKILL.md');

    expect(stat.name).toBe('SKILL.md');
    expect(stat.type).toBe('file');
    expect(stat.size).toBe(Buffer.byteLength(skillMdContent));
    expect(stat.mimeType).toBe('text/markdown');
  });

  it('stat returns directory info', async () => {
    const { source } = createVersionedSource();
    const stat = await source.stat('references');

    expect(stat.name).toBe('references');
    expect(stat.type).toBe('directory');
    expect(stat.size).toBe(0);
  });

  it('stat throws for missing paths', async () => {
    const { source } = createVersionedSource();
    await expect(source.stat('nonexistent')).rejects.toThrow('Path not found');
  });

  it('readFile returns blob content', async () => {
    const { source, skillMdContent, refContent } = createVersionedSource();

    const content1 = await source.readFile('SKILL.md');
    expect(content1).toBe(skillMdContent);

    const content2 = await source.readFile('references/api.md');
    expect(content2).toBe(refContent);
  });

  it('readFile throws for missing file', async () => {
    const { source } = createVersionedSource();
    await expect(source.readFile('nonexistent.md')).rejects.toThrow('File not found');
  });

  it('readFile throws for missing blob', async () => {
    const blobStore = new InMemoryBlobStore();
    const tree: SkillVersionTree = {
      entries: {
        'SKILL.md': { blobHash: 'missing-hash', size: 10, mimeType: 'text/markdown' },
      },
    };
    const source = new VersionedSkillSource(tree, blobStore, now);

    await expect(source.readFile('SKILL.md')).rejects.toThrow('Blob not found');
  });

  it('readdir at root lists immediate children', async () => {
    const { source } = createVersionedSource();
    const entries = await source.readdir('');

    const names = entries.map(e => e.name).sort();
    expect(names).toEqual(['SKILL.md', 'references'].sort());

    const skillEntry = entries.find(e => e.name === 'SKILL.md');
    expect(skillEntry!.type).toBe('file');

    const refEntry = entries.find(e => e.name === 'references');
    expect(refEntry!.type).toBe('directory');
  });

  it('readdir at subdirectory lists entries in that subdirectory', async () => {
    const { source } = createVersionedSource();
    const entries = await source.readdir('references');

    const names = entries.map(e => e.name).sort();
    expect(names).toEqual(['api.md', 'deep'].sort());
  });

  it('readdir throws for non-directory', async () => {
    const { source } = createVersionedSource();
    await expect(source.readdir('nonexistent')).rejects.toThrow('Directory not found');
  });

  it('normalizes paths correctly', async () => {
    const { source, skillMdContent } = createVersionedSource();

    // Leading './' should be stripped
    expect(await source.exists('./SKILL.md')).toBe(true);
    expect(await source.exists('./references/api.md')).toBe(true);

    const content = await source.readFile('./SKILL.md');
    expect(content).toBe(skillMdContent);

    // Leading '/' should be stripped
    expect(await source.exists('/SKILL.md')).toBe(true);
  });
});

// =============================================================================
// 5. CompositeVersionedSkillSource
// =============================================================================

describe('CompositeVersionedSkillSource', () => {
  const now = new Date('2024-06-01');

  function createCompositeSetup() {
    const blobStore = new InMemoryBlobStore();

    const skillAMd = '---\nname: skill-a\ndescription: Skill A\n---\n\n# Skill A instructions';
    const skillARef = '# Skill A API reference';
    const skillBMd = '---\nname: skill-b\ndescription: Skill B\n---\n\n# Skill B instructions';

    const hashAMd = sha256(skillAMd);
    const hashARef = sha256(skillARef);
    const hashBMd = sha256(skillBMd);

    blobStore.put({ hash: hashAMd, content: skillAMd, size: Buffer.byteLength(skillAMd), createdAt: now });
    blobStore.put({ hash: hashARef, content: skillARef, size: Buffer.byteLength(skillARef), createdAt: now });
    blobStore.put({ hash: hashBMd, content: skillBMd, size: Buffer.byteLength(skillBMd), createdAt: now });

    const treeA: SkillVersionTree = {
      entries: {
        'SKILL.md': { blobHash: hashAMd, size: Buffer.byteLength(skillAMd), mimeType: 'text/markdown' },
        'references/api.md': { blobHash: hashARef, size: Buffer.byteLength(skillARef), mimeType: 'text/markdown' },
      },
    };

    const treeB: SkillVersionTree = {
      entries: {
        'SKILL.md': { blobHash: hashBMd, size: Buffer.byteLength(skillBMd), mimeType: 'text/markdown' },
      },
    };

    const composite = new CompositeVersionedSkillSource(
      [
        { dirName: 'skill-a', tree: treeA, versionCreatedAt: now },
        { dirName: 'skill-b', tree: treeB, versionCreatedAt: now },
      ],
      blobStore,
    );

    return { composite, blobStore, skillAMd, skillARef, skillBMd, treeA, treeB };
  }

  it('readdir at root lists all mounted skills', async () => {
    const { composite } = createCompositeSetup();
    const entries = await composite.readdir('');

    const names = entries.map(e => e.name).sort();
    expect(names).toEqual(['skill-a', 'skill-b']);
    expect(entries.every(e => e.type === 'directory')).toBe(true);
  });

  it('routes to correct versioned source for skill-a', async () => {
    const { composite, skillAMd } = createCompositeSetup();
    const content = await composite.readFile('skill-a/SKILL.md');
    expect(content).toBe(skillAMd);
  });

  it('routes to correct versioned source for skill-b', async () => {
    const { composite, skillBMd } = createCompositeSetup();
    const content = await composite.readFile('skill-b/SKILL.md');
    expect(content).toBe(skillBMd);
  });

  it('readdir within a skill lists contents of that skill subtree', async () => {
    const { composite } = createCompositeSetup();
    const entries = await composite.readdir('skill-a');

    const names = entries.map(e => e.name).sort();
    expect(names).toEqual(['SKILL.md', 'references'].sort());
  });

  it('exists at root is always true', async () => {
    const { composite } = createCompositeSetup();
    expect(await composite.exists('')).toBe(true);
  });

  it('stat at root returns directory type', async () => {
    const { composite } = createCompositeSetup();
    const stat = await composite.stat('');
    expect(stat.type).toBe('directory');
    expect(stat.name).toBe('.');
  });

  it('fallback routing for live skills', async () => {
    const blobStore = new InMemoryBlobStore();
    const fallbackSource = createMockSource({
      'live-skill/SKILL.md': '---\nname: live-skill\ndescription: Live\n---\n\n# Live',
    });

    const composite = new CompositeVersionedSkillSource([], blobStore, {
      fallback: fallbackSource,
      fallbackSkills: ['live-skill'],
    });

    const content = await composite.readFile('live-skill/SKILL.md');
    expect(content).toBe('---\nname: live-skill\ndescription: Live\n---\n\n# Live');
  });

  it('fallback for unknown paths', async () => {
    const blobStore = new InMemoryBlobStore();
    const fallbackSource = createMockSource({
      'unknown-skill/SKILL.md': '---\nname: unknown\ndescription: Unknown\n---\n\n# Unknown',
    });

    const composite = new CompositeVersionedSkillSource([], blobStore, {
      fallback: fallbackSource,
    });

    const exists = await composite.exists('unknown-skill/SKILL.md');
    expect(exists).toBe(true);
  });

  it('root readdir includes fallback skills', async () => {
    const { blobStore, skillAMd } = createCompositeSetup();
    const hashAMd = sha256(skillAMd);
    const treeA: SkillVersionTree = {
      entries: {
        'SKILL.md': { blobHash: hashAMd, size: Buffer.byteLength(skillAMd), mimeType: 'text/markdown' },
      },
    };

    const fallbackSource = createMockSource({});
    const composite = new CompositeVersionedSkillSource(
      [{ dirName: 'versioned-skill', tree: treeA, versionCreatedAt: now }],
      blobStore,
      {
        fallback: fallbackSource,
        fallbackSkills: ['live-skill'],
      },
    );

    const entries = await composite.readdir('');
    const names = entries.map(e => e.name).sort();
    expect(names).toContain('versioned-skill');
    expect(names).toContain('live-skill');
  });

  it('throws for missing path without fallback', async () => {
    const blobStore = new InMemoryBlobStore();
    const composite = new CompositeVersionedSkillSource([], blobStore);

    await expect(composite.readFile('nonexistent/SKILL.md')).rejects.toThrow();
  });
});

// =============================================================================
// 6. WorkspaceSkillsImpl with VersionedSkillSource
// =============================================================================

describe('WorkspaceSkillsImpl with VersionedSkillSource', () => {
  const now = new Date('2024-06-01');

  function createIntegrationSetup() {
    const blobStore = new InMemoryBlobStore();

    const skillAMd = createSkillMd(
      { name: 'brand-guidelines', description: 'Brand guidelines for consistent messaging' },
      '# Brand Guidelines\n\nAlways use the brand colors and tone.',
    );
    const skillARef = '# Color Palette\n\nPrimary: #FF0000\nSecondary: #00FF00';

    const skillBMd = createSkillMd(
      { name: 'api-design', description: 'API design best practices' },
      '# API Design\n\nFollow RESTful conventions.',
    );

    const hashAMd = sha256(skillAMd);
    const hashARef = sha256(skillARef);
    const hashBMd = sha256(skillBMd);

    // Store blobs
    blobStore.put({ hash: hashAMd, content: skillAMd, size: Buffer.byteLength(skillAMd), createdAt: now });
    blobStore.put({ hash: hashARef, content: skillARef, size: Buffer.byteLength(skillARef), createdAt: now });
    blobStore.put({ hash: hashBMd, content: skillBMd, size: Buffer.byteLength(skillBMd), createdAt: now });

    const treeA: SkillVersionTree = {
      entries: {
        'SKILL.md': { blobHash: hashAMd, size: Buffer.byteLength(skillAMd), mimeType: 'text/markdown' },
        'references/colors.md': { blobHash: hashARef, size: Buffer.byteLength(skillARef), mimeType: 'text/markdown' },
      },
    };

    const treeB: SkillVersionTree = {
      entries: {
        'SKILL.md': { blobHash: hashBMd, size: Buffer.byteLength(skillBMd), mimeType: 'text/markdown' },
      },
    };

    const compositeSource = new CompositeVersionedSkillSource(
      [
        { dirName: 'brand-guidelines', tree: treeA, versionCreatedAt: now },
        { dirName: 'api-design', tree: treeB, versionCreatedAt: now },
      ],
      blobStore,
    );

    const workspaceSkills = new WorkspaceSkillsImpl({
      source: compositeSource,
      skills: [''],
      validateOnLoad: false,
    });

    return { workspaceSkills, compositeSource, blobStore, skillAMd, skillARef, skillBMd };
  }

  it('should discover skills from versioned source', async () => {
    const { workspaceSkills } = createIntegrationSetup();
    const skills = await workspaceSkills.list();

    expect(skills).toHaveLength(2);
    const names = skills.map(s => s.name).sort();
    expect(names).toEqual(['api-design', 'brand-guidelines']);

    const brand = skills.find(s => s.name === 'brand-guidelines');
    expect(brand!.description).toBe('Brand guidelines for consistent messaging');

    const api = skills.find(s => s.name === 'api-design');
    expect(api!.description).toBe('API design best practices');
  });

  it('should get full skill details', async () => {
    const { workspaceSkills } = createIntegrationSetup();
    const skill = await workspaceSkills.get('brand-guidelines');

    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('brand-guidelines');
    expect(skill!.instructions).toBe('# Brand Guidelines\n\nAlways use the brand colors and tone.');
    expect(skill!.references).toEqual(['colors.md']);
  });

  it('should search skills', async () => {
    const { workspaceSkills } = createIntegrationSetup();
    const results = await workspaceSkills.search('brand');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.skillName).toBe('brand-guidelines');
  });

  it('should read references through versioned source', async () => {
    const { workspaceSkills, skillARef } = createIntegrationSetup();
    const refContent = await workspaceSkills.getReference('brand-guidelines', 'colors.md');

    expect(refContent).not.toBeNull();
    expect(refContent).toBe(skillARef);
  });

  it('should handle skill with no references', async () => {
    const { workspaceSkills } = createIntegrationSetup();
    const skill = await workspaceSkills.get('api-design');

    expect(skill).not.toBeNull();
    expect(skill!.references).toEqual([]);
    expect(skill!.instructions).toBe('# API Design\n\nFollow RESTful conventions.');
  });
});
