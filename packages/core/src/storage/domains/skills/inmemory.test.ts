import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryDB } from '../inmemory-db';
import { InMemorySkillsStorage } from './inmemory';

describe('InMemorySkillsStorage', () => {
  let db: InMemoryDB;
  let storage: InMemorySkillsStorage;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new InMemorySkillsStorage({ db });
  });

  describe('create', () => {
    it('should create skill with status=draft and activeVersionId=undefined', async () => {
      const result = await storage.create({
        skill: {
          id: 'test-skill',
          authorId: 'user-123',
          name: 'Test Skill',
          description: 'A test skill',
          instructions: 'Do something helpful',
        },
      });

      expect(result.id).toBe('test-skill');
      expect(result.status).toBe('draft');
      expect(result.activeVersionId).toBeUndefined();
      expect(result.authorId).toBe('user-123');

      const versionCount = await storage.countVersions('test-skill');
      expect(versionCount).toBe(1);

      const resolved = await storage.getByIdResolved('test-skill');
      expect(resolved?.name).toBe('Test Skill');
      expect(resolved?.description).toBe('A test skill');
      expect(resolved?.instructions).toBe('Do something helpful');
    });

    it('should default visibility to private when authorId is set', async () => {
      const result = await storage.create({
        skill: {
          id: 'private-skill',
          authorId: 'user-123',
          name: 'Private Skill',
          description: 'desc',
          instructions: 'instr',
        },
      });

      expect(result.visibility).toBe('private');
    });

    it('should default visibility to undefined when no authorId', async () => {
      const result = await storage.create({
        skill: {
          id: 'public-skill',
          name: 'Public Skill',
          description: 'desc',
          instructions: 'instr',
        },
      });

      expect(result.visibility).toBeUndefined();
    });

    it('should reject duplicate skill IDs', async () => {
      await storage.create({
        skill: {
          id: 'dup-skill',
          name: 'First',
          description: 'desc',
          instructions: 'instr',
        },
      });

      await expect(
        storage.create({
          skill: {
            id: 'dup-skill',
            name: 'Second',
            description: 'desc',
            instructions: 'instr',
          },
        }),
      ).rejects.toThrow('already exists');
    });
  });

  describe('update', () => {
    beforeEach(async () => {
      await storage.create({
        skill: {
          id: 'update-skill',
          authorId: 'user-123',
          name: 'Original Name',
          description: 'Original description',
          instructions: 'Original instructions',
        },
      });
    });

    it('should update metadata without creating new version', async () => {
      const versionCountBefore = await storage.countVersions('update-skill');
      expect(versionCountBefore).toBe(1);

      await storage.update({
        id: 'update-skill',
        visibility: 'public',
      });

      const versionCountAfter = await storage.countVersions('update-skill');
      expect(versionCountAfter).toBe(1);

      const skill = await storage.getById('update-skill');
      expect(skill?.visibility).toBe('public');
    });

    it('should create new version when config fields change', async () => {
      const versionCountBefore = await storage.countVersions('update-skill');
      expect(versionCountBefore).toBe(1);

      await storage.update({
        id: 'update-skill',
        name: 'Updated Name',
        instructions: 'Updated instructions',
      });

      const versionCountAfter = await storage.countVersions('update-skill');
      expect(versionCountAfter).toBe(2);

      // Latest version should have updated fields
      const latestVersion = await storage.getLatestVersion('update-skill');
      expect(latestVersion?.name).toBe('Updated Name');
      expect(latestVersion?.instructions).toBe('Updated instructions');
      // Unchanged fields should carry forward
      expect(latestVersion?.description).toBe('Original description');
    });

    it('should not create version when config values are unchanged', async () => {
      await storage.update({
        id: 'update-skill',
        name: 'Original Name',
        instructions: 'Original instructions',
      });

      const versionCount = await storage.countVersions('update-skill');
      expect(versionCount).toBe(1);
    });

    it('should not create version for reordered metadata, reordered tree entries, or undefined license', async () => {
      await storage.create({
        skill: {
          id: 'stable-snapshot-skill',
          name: 'Stable Snapshot',
          description: 'Original description',
          instructions: 'Original instructions',
          metadata: {
            alpha: { enabled: true, count: 1 },
            beta: ['one', 'two'],
          },
          tree: {
            entries: {
              'SKILL.md': { blobHash: 'hash-1', size: 100, mimeType: 'text/markdown' },
              'scripts/setup.sh': { blobHash: 'hash-2', size: 50 },
            },
          },
        },
      });

      await storage.update({
        id: 'stable-snapshot-skill',
        license: undefined,
        metadata: {
          beta: ['one', 'two'],
          alpha: { count: 1, enabled: true },
        },
        tree: {
          entries: {
            'scripts/setup.sh': { size: 50, blobHash: 'hash-2' },
            'SKILL.md': { mimeType: 'text/markdown', size: 100, blobHash: 'hash-1' },
          },
        },
      });

      expect(await storage.countVersions('stable-snapshot-skill')).toBe(1);
    });
  });

  describe('getByIdResolved', () => {
    it('should fall back to latest version when activeVersionId is undefined', async () => {
      await storage.create({
        skill: {
          id: 'fallback-skill',
          name: 'Version 1',
          description: 'desc',
          instructions: 'v1',
        },
      });

      await storage.createVersion({
        id: 'v2',
        skillId: 'fallback-skill',
        versionNumber: 2,
        name: 'Version 2',
        description: 'desc',
        instructions: 'v2',
        changedFields: ['name', 'instructions'],
        changeMessage: 'v2',
      });

      const resolved = await storage.getByIdResolved('fallback-skill');
      expect(resolved?.name).toBe('Version 2');
      expect(resolved?.instructions).toBe('v2');
    });

    it('should use active version when set', async () => {
      await storage.create({
        skill: {
          id: 'active-skill',
          name: 'Version 1',
          description: 'desc',
          instructions: 'v1',
        },
      });

      const activeVersionId = 'active-v';
      await storage.createVersion({
        id: activeVersionId,
        skillId: 'active-skill',
        versionNumber: 2,
        name: 'Active Version',
        description: 'active desc',
        instructions: 'active',
        changedFields: ['name', 'instructions'],
        changeMessage: 'activated',
      });

      // Create a newer version that should NOT be used
      await storage.createVersion({
        id: 'v3',
        skillId: 'active-skill',
        versionNumber: 3,
        name: 'Latest Draft',
        description: 'draft desc',
        instructions: 'draft',
        changedFields: ['name', 'instructions'],
        changeMessage: 'draft',
      });

      await storage.update({
        id: 'active-skill',
        activeVersionId,
      });

      const resolved = await storage.getByIdResolved('active-skill');
      expect(resolved?.name).toBe('Active Version');
      expect(resolved?.instructions).toBe('active');
    });

    it('should return null for nonexistent skill', async () => {
      const resolved = await storage.getByIdResolved('nonexistent');
      expect(resolved).toBeNull();
    });
  });

  describe('list pagination with empty entity IDs', () => {
    it.each([NaN, Infinity, -Infinity, 0.5, -0.5, -1])(
      'rejects invalid page %s before returning no candidates',
      async page => {
        for (const perPage of [undefined, 0, 10, false] as const) {
          await expect(storage.list({ page, perPage, entityIds: [] })).rejects.toThrow('page must be >= 0');
        }
      },
    );

    it.each([undefined, 0, 10, false] as const)('preserves valid empty results with perPage %s', async perPage => {
      await expect(storage.list({ page: 0, perPage, entityIds: [] })).resolves.toEqual({
        skills: [],
        total: 0,
        page: 0,
        perPage: perPage ?? 100,
        hasMore: false,
      });
    });
  });

  describe('listResolved', () => {
    beforeEach(async () => {
      await storage.create({
        skill: {
          id: 'skill-a',
          authorId: 'user-1',
          name: 'Skill A',
          description: 'desc a',
          instructions: 'instr a',
        },
      });
      await storage.create({
        skill: {
          id: 'skill-b',
          authorId: 'user-2',
          name: 'Skill B',
          description: 'desc b',
          instructions: 'instr b',
        },
      });
    });

    it('should return resolved skills with version config', async () => {
      const result = await storage.listResolved({ status: 'draft' });
      expect(result.skills).toHaveLength(2);
      expect(result.skills.map(s => s.name).sort()).toEqual(['Skill A', 'Skill B']);
    });

    it('should filter by authorId', async () => {
      const result = await storage.listResolved({ authorId: 'user-1' });
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0]!.name).toBe('Skill A');
    });

    it('should batch-fetch active versions instead of one lookup per entity', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        const id = `published-${i}`;
        ids.push(id);
        await storage.create({ skill: { id, name: `Published ${i}`, description: 'd', instructions: `instr ${i}` } });
        const latest = await storage.getLatestVersion(id);
        await storage.update({ id, activeVersionId: latest!.id, status: 'published' });
      }

      const getVersionsSpy = vi.spyOn(storage, 'getVersions');
      const getLatestVersionSpy = vi.spyOn(storage, 'getLatestVersion');

      const result = await storage.listResolved({ perPage: false, status: 'published' });

      expect(result.skills).toHaveLength(10);
      expect(getVersionsSpy).toHaveBeenCalledTimes(1);
      expect(getVersionsSpy.mock.calls[0]![0]).toHaveLength(10);
      expect(getLatestVersionSpy).not.toHaveBeenCalled();
      for (const skill of result.skills) {
        expect(skill.resolvedVersionId).toBe(skill.activeVersionId);
        expect(skill.instructions).toBe(`instr ${skill.id.replace('published-', '')}`);
      }
    });

    it('should fall back to the latest version when the active version is missing', async () => {
      await storage.create({ skill: { id: 'orphan', name: 'Orphan', description: 'd', instructions: 'v1' } });
      const latest = await storage.getLatestVersion('orphan');
      await storage.update({ id: 'orphan', activeVersionId: latest!.id, status: 'published' });
      // Add a second version, then drop the active one so the pointer dangles.
      await storage.createVersion({
        id: 'orphan-v2',
        skillId: 'orphan',
        versionNumber: 2,
        name: 'Orphan',
        description: 'd',
        instructions: 'v2',
      });
      await storage.deleteVersion(latest!.id);

      const getLatestVersionSpy = vi.spyOn(storage, 'getLatestVersion');
      const result = await storage.listResolved({ status: 'published' });

      expect(result.skills).toHaveLength(1);
      expect(result.skills[0]!.instructions).toBe('v2');
      expect(result.skills[0]!.resolvedVersionId).not.toBe(latest!.id);
      expect(getLatestVersionSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('delete', () => {
    it('should delete skill and all its versions', async () => {
      await storage.create({
        skill: {
          id: 'delete-me',
          name: 'Delete Me',
          description: 'desc',
          instructions: 'instr',
        },
      });

      const versionCount = await storage.countVersions('delete-me');
      expect(versionCount).toBe(1);

      await storage.delete('delete-me');

      const skill = await storage.getById('delete-me');
      expect(skill).toBeNull();

      const versionsAfter = await storage.countVersions('delete-me');
      expect(versionsAfter).toBe(0);
    });

    it('should be idempotent', async () => {
      await storage.delete('nonexistent');
      // Should not throw
    });
  });

  // ==========================================================================
  // Files persistence
  // ==========================================================================

  describe('files persistence', () => {
    it('should persist files through create and resolve', async () => {
      const files = [
        {
          id: 'root',
          name: 'my-skill',
          type: 'folder' as const,
          children: [
            { id: 'skill-md', name: 'SKILL.md', type: 'file' as const, content: '# My Skill\nDo things' },
            { id: 'license-md', name: 'LICENSE.md', type: 'file' as const, content: 'MIT' },
            {
              id: 'references',
              name: 'references',
              type: 'folder' as const,
              children: [
                { id: 'ref-1', name: 'api-template.md', type: 'file' as const, content: '# API Template\nGET /foo' },
              ],
            },
            {
              id: 'scripts',
              name: 'scripts',
              type: 'folder' as const,
              children: [
                { id: 'script-1', name: 'generate.sh', type: 'file' as const, content: '#!/bin/bash\necho hi' },
              ],
            },
            { id: 'assets', name: 'assets', type: 'folder' as const, children: [] },
          ],
        },
      ];

      await storage.create({
        skill: {
          id: 'files-skill',
          name: 'Files Skill',
          description: 'A skill with files',
          instructions: '# My Skill\nDo things',
          files,
        },
      });

      const resolved = await storage.getByIdResolved('files-skill');
      expect(resolved?.files).toBeDefined();
      expect(resolved!.files).toHaveLength(1);

      const root = resolved!.files![0]!;
      expect(root.name).toBe('my-skill');
      expect(root.children).toHaveLength(5);

      // Verify reference file content
      const refsFolder = root.children!.find(c => c.name === 'references');
      expect(refsFolder?.children).toHaveLength(1);
      expect(refsFolder!.children![0]!.name).toBe('api-template.md');
      expect(refsFolder!.children![0]!.content).toBe('# API Template\nGET /foo');

      // Verify script file content
      const scriptsFolder = root.children!.find(c => c.name === 'scripts');
      expect(scriptsFolder?.children).toHaveLength(1);
      expect(scriptsFolder!.children![0]!.name).toBe('generate.sh');
      expect(scriptsFolder!.children![0]!.content).toBe('#!/bin/bash\necho hi');
    });

    it('should persist files through version creation', async () => {
      await storage.create({
        skill: {
          id: 'version-files',
          name: 'Version Files',
          description: 'desc',
          instructions: 'instr',
        },
      });

      const files = [
        {
          id: 'root',
          name: 'version-files',
          type: 'folder' as const,
          children: [
            { id: 'skill-md', name: 'SKILL.md', type: 'file' as const, content: 'updated' },
            {
              id: 'references',
              name: 'references',
              type: 'folder' as const,
              children: [{ id: 'ref-1', name: 'ref.md', type: 'file' as const, content: 'reference content' }],
            },
          ],
        },
      ];

      await storage.createVersion({
        id: 'v2-with-files',
        skillId: 'version-files',
        versionNumber: 2,
        name: 'Version Files',
        description: 'desc',
        instructions: 'updated',
        files,
        changedFields: ['instructions', 'files'],
        changeMessage: 'Added files',
      });

      const version = await storage.getVersion('v2-with-files');
      expect(version?.files).toBeDefined();
      expect(version!.files![0]!.children).toHaveLength(2);

      // Resolved should also return the files from latest version
      const resolved = await storage.getByIdResolved('version-files');
      expect(resolved?.files).toBeDefined();
      expect(resolved!.files![0]!.children![1]!.name).toBe('references');
    });

    it('should update files via update() and create a new version', async () => {
      const initialFiles = [
        {
          id: 'root',
          name: 'updatable',
          type: 'folder' as const,
          children: [
            { id: 'skill-md', name: 'SKILL.md', type: 'file' as const, content: 'initial' },
            { id: 'references', name: 'references', type: 'folder' as const, children: [] },
          ],
        },
      ];

      await storage.create({
        skill: {
          id: 'updatable-skill',
          name: 'Updatable Skill',
          description: 'desc',
          instructions: 'initial',
          files: initialFiles,
        },
      });

      const updatedFiles = [
        {
          id: 'root',
          name: 'updatable',
          type: 'folder' as const,
          children: [
            { id: 'skill-md', name: 'SKILL.md', type: 'file' as const, content: 'updated' },
            {
              id: 'references',
              name: 'references',
              type: 'folder' as const,
              children: [{ id: 'ref-new', name: 'new-ref.md', type: 'file' as const, content: 'new ref' }],
            },
          ],
        },
      ];

      await storage.update({
        id: 'updatable-skill',
        files: updatedFiles,
      });

      const versionCount = await storage.countVersions('updatable-skill');
      expect(versionCount).toBe(2);

      const resolved = await storage.getByIdResolved('updatable-skill');
      const root = resolved!.files![0]!;
      const refsFolder = root.children!.find(c => c.name === 'references');
      expect(refsFolder?.children).toHaveLength(1);
      expect(refsFolder!.children![0]!.name).toBe('new-ref.md');
    });

    it('should deep-copy files to prevent mutation of stored data', async () => {
      const files = [
        {
          id: 'root',
          name: 'deep-copy',
          type: 'folder' as const,
          children: [{ id: 'skill-md', name: 'SKILL.md', type: 'file' as const, content: 'original' }],
        },
      ];

      await storage.create({
        skill: {
          id: 'deep-copy-skill',
          name: 'Deep Copy',
          description: 'desc',
          instructions: 'instr',
          files,
        },
      });

      // Mutate the original input
      files[0]!.children![0]!.content = 'MUTATED';

      // Stored data should be unaffected
      const resolved = await storage.getByIdResolved('deep-copy-skill');
      expect(resolved!.files![0]!.children![0]!.content).toBe('original');
    });

    it('should handle skills with no files', async () => {
      await storage.create({
        skill: {
          id: 'no-files-skill',
          name: 'No Files',
          description: 'desc',
          instructions: 'instr',
        },
      });

      const resolved = await storage.getByIdResolved('no-files-skill');
      expect(resolved?.files).toBeUndefined();
    });

    it('should handle empty files array', async () => {
      await storage.create({
        skill: {
          id: 'empty-files-skill',
          name: 'Empty Files',
          description: 'desc',
          instructions: 'instr',
          files: [],
        },
      });

      const resolved = await storage.getByIdResolved('empty-files-skill');
      expect(resolved?.files).toEqual([]);
    });
  });

  // ==========================================================================
  // References, scripts, assets persistence
  // ==========================================================================

  describe('references/scripts/assets persistence', () => {
    it('should persist references array through create and resolve', async () => {
      await storage.create({
        skill: {
          id: 'refs-skill',
          name: 'Refs Skill',
          description: 'desc',
          instructions: 'instr',
          references: ['references/api-template.md', 'references/guide.md'],
        },
      });

      const resolved = await storage.getByIdResolved('refs-skill');
      expect(resolved?.references).toEqual(['references/api-template.md', 'references/guide.md']);
    });

    it('should persist scripts array through create and resolve', async () => {
      await storage.create({
        skill: {
          id: 'scripts-skill',
          name: 'Scripts Skill',
          description: 'desc',
          instructions: 'instr',
          scripts: ['scripts/generate.sh'],
        },
      });

      const resolved = await storage.getByIdResolved('scripts-skill');
      expect(resolved?.scripts).toEqual(['scripts/generate.sh']);
    });

    it('should persist assets array through create and resolve', async () => {
      await storage.create({
        skill: {
          id: 'assets-skill',
          name: 'Assets Skill',
          description: 'desc',
          instructions: 'instr',
          assets: ['assets/logo.png'],
        },
      });

      const resolved = await storage.getByIdResolved('assets-skill');
      expect(resolved?.assets).toEqual(['assets/logo.png']);
    });

    it('should update references via update() and create new version', async () => {
      await storage.create({
        skill: {
          id: 'update-refs',
          name: 'Update Refs',
          description: 'desc',
          instructions: 'instr',
        },
      });

      await storage.update({
        id: 'update-refs',
        references: ['references/new-ref.md'],
      });

      const versionCount = await storage.countVersions('update-refs');
      expect(versionCount).toBe(2);

      const resolved = await storage.getByIdResolved('update-refs');
      expect(resolved?.references).toEqual(['references/new-ref.md']);
    });
  });

  // ==========================================================================
  // Version management
  // ==========================================================================

  describe('version management', () => {
    it('should list versions with pagination', async () => {
      await storage.create({
        skill: {
          id: 'paginated-skill',
          name: 'Paginated',
          description: 'desc',
          instructions: 'v1',
        },
      });

      for (let i = 2; i <= 5; i++) {
        await storage.createVersion({
          id: `v${i}`,
          skillId: 'paginated-skill',
          versionNumber: i,
          name: 'Paginated',
          description: 'desc',
          instructions: `v${i}`,
          changedFields: ['instructions'],
          changeMessage: `v${i}`,
        });
      }

      const allVersions = await storage.listVersions({
        skillId: 'paginated-skill',
        perPage: false,
      });
      expect(allVersions.versions).toHaveLength(5);

      const page0 = await storage.listVersions({
        skillId: 'paginated-skill',
        perPage: 2,
        page: 0,
      });
      expect(page0.versions).toHaveLength(2);
      expect(page0.hasMore).toBe(true);
    });

    it('should count versions', async () => {
      await storage.create({
        skill: {
          id: 'count-skill',
          name: 'Count',
          description: 'desc',
          instructions: 'v1',
        },
      });

      expect(await storage.countVersions('count-skill')).toBe(1);

      await storage.createVersion({
        id: 'cv2',
        skillId: 'count-skill',
        versionNumber: 2,
        name: 'Count',
        description: 'desc',
        instructions: 'v2',
        changedFields: ['instructions'],
        changeMessage: 'v2',
      });

      expect(await storage.countVersions('count-skill')).toBe(2);
    });

    it('should reject duplicate version numbers', async () => {
      await storage.create({
        skill: {
          id: 'dup-version',
          name: 'Dup',
          description: 'desc',
          instructions: 'v1',
        },
      });

      await expect(
        storage.createVersion({
          id: 'dup-v1',
          skillId: 'dup-version',
          versionNumber: 1, // already exists from create
          name: 'Dup',
          description: 'desc',
          instructions: 'v1',
          changedFields: [],
          changeMessage: 'dup',
        }),
      ).rejects.toThrow('already exists');
    });
  });

  describe('publishVersion', () => {
    const publishedSnapshot = {
      name: 'Published Skill',
      description: 'Published description',
      instructions: '# Published',
      files: [{ name: 'SKILL.md', type: 'file' as const, content: '# Published' }],
      tree: {
        entries: {
          'SKILL.md': {
            blobHash: 'published-hash',
            size: 11,
            mimeType: 'text/markdown',
          },
        },
      },
    };

    it('creates and activates the exact caller-known version without changing the source version', async () => {
      await storage.create({
        skill: {
          id: 'publish-skill',
          name: 'Draft Skill',
          description: 'Draft description',
          instructions: '# Draft',
          files: [{ name: 'SKILL.md', type: 'file', content: '# Draft' }],
        },
      });
      const sourceVersion = await storage.getLatestVersion('publish-skill');

      const published = await storage.publishVersion({
        skillId: 'publish-skill',
        sourceVersionId: sourceVersion!.id,
        versionId: 'published-version-id',
        snapshot: publishedSnapshot,
      });

      expect(published.id).toBe('published-version-id');
      expect((await storage.getById('publish-skill'))?.activeVersionId).toBe('published-version-id');
      expect((await storage.getById('publish-skill'))?.status).toBe('published');
      expect(await storage.getVersion(sourceVersion!.id)).toMatchObject({
        id: sourceVersion!.id,
        name: 'Draft Skill',
        instructions: '# Draft',
      });
      expect(await storage.getVersion('published-version-id')).toMatchObject({
        ...publishedSnapshot,
        id: 'published-version-id',
      });
    });

    it('rejects a source version belonging to another skill', async () => {
      await storage.create({
        skill: { id: 'publish-owner', name: 'Owner', description: 'desc', instructions: 'owner' },
      });
      await storage.create({
        skill: { id: 'publish-other', name: 'Other', description: 'desc', instructions: 'other' },
      });
      const otherVersion = await storage.getLatestVersion('publish-other');

      await expect(
        storage.publishVersion({
          skillId: 'publish-owner',
          sourceVersionId: otherVersion!.id,
          versionId: 'must-not-exist',
          snapshot: publishedSnapshot,
        }),
      ).rejects.toThrow(/version.*publish-other.*publish-owner/i);
      expect(await storage.getVersion('must-not-exist')).toBeNull();
    });

    it('removes the inactive version and preserves the previous active version when activation fails', async () => {
      await storage.create({
        skill: { id: 'publish-failure', name: 'Draft', description: 'desc', instructions: 'draft' },
      });
      const sourceVersion = await storage.getLatestVersion('publish-failure');
      await storage.update({ id: 'publish-failure', activeVersionId: sourceVersion!.id, status: 'published' });
      vi.spyOn(storage, 'update').mockRejectedValueOnce(new Error('activation failed'));

      await expect(
        storage.publishVersion({
          skillId: 'publish-failure',
          sourceVersionId: sourceVersion!.id,
          versionId: 'inactive-orphan',
          snapshot: publishedSnapshot,
        }),
      ).rejects.toThrow('activation failed');

      expect(await storage.getVersion('inactive-orphan')).toBeNull();
      expect((await storage.getById('publish-failure'))?.activeVersionId).toBe(sourceVersion!.id);
      expect((await storage.getById('publish-failure'))?.status).toBe('published');
    });

    it('serializes concurrent fallback publications for the same skill in invocation order', async () => {
      await storage.create({
        skill: { id: 'publish-race', name: 'Draft', description: 'desc', instructions: 'draft' },
      });
      const sourceVersion = await storage.getLatestVersion('publish-race');
      const update = storage.update.bind(storage);
      let firstActivationStarted!: () => void;
      const firstActivation = new Promise<void>(resolve => {
        firstActivationStarted = resolve;
      });
      let releaseFirstActivation!: () => void;
      const firstActivationRelease = new Promise<void>(resolve => {
        releaseFirstActivation = resolve;
      });
      const updateSpy = vi.spyOn(storage, 'update').mockImplementation(async input => {
        if (input.activeVersionId === 'race-a') {
          firstActivationStarted();
          await firstActivationRelease;
        }
        return update(input);
      });

      const first = storage.publishVersion({
        skillId: 'publish-race',
        sourceVersionId: sourceVersion!.id,
        versionId: 'race-a',
        snapshot: { ...publishedSnapshot, instructions: 'A' },
      });
      await firstActivation;
      const second = storage.publishVersion({
        skillId: 'publish-race',
        sourceVersionId: sourceVersion!.id,
        versionId: 'race-b',
        snapshot: { ...publishedSnapshot, instructions: 'B' },
      });

      for (let i = 0; i < 10; i++) await Promise.resolve();
      const activationCallsBeforeRelease = updateSpy.mock.calls.length;
      releaseFirstActivation();

      await expect(Promise.all([first, second])).resolves.toMatchObject([
        { id: 'race-a', versionNumber: 2 },
        { id: 'race-b', versionNumber: 3 },
      ]);
      expect(activationCallsBeforeRelease).toBe(1);
      expect((await storage.getById('publish-race'))?.activeVersionId).toBe('race-b');
    });

    it('does not serialize fallback publications for different skills', async () => {
      await storage.create({
        skill: { id: 'publish-one', name: 'One', description: 'desc', instructions: 'one' },
      });
      await storage.create({
        skill: { id: 'publish-two', name: 'Two', description: 'desc', instructions: 'two' },
      });
      const firstSource = await storage.getLatestVersion('publish-one');
      const secondSource = await storage.getLatestVersion('publish-two');
      const update = storage.update.bind(storage);
      let firstActivationStarted!: () => void;
      const firstActivation = new Promise<void>(resolve => {
        firstActivationStarted = resolve;
      });
      let releaseFirstActivation!: () => void;
      const firstActivationRelease = new Promise<void>(resolve => {
        releaseFirstActivation = resolve;
      });
      let secondActivated = false;
      vi.spyOn(storage, 'update').mockImplementation(async input => {
        if (input.activeVersionId === 'published-one') {
          firstActivationStarted();
          await firstActivationRelease;
        } else if (input.activeVersionId === 'published-two') {
          secondActivated = true;
        }
        return update(input);
      });

      const first = storage.publishVersion({
        skillId: 'publish-one',
        sourceVersionId: firstSource!.id,
        versionId: 'published-one',
        snapshot: publishedSnapshot,
      });
      await firstActivation;
      const second = storage.publishVersion({
        skillId: 'publish-two',
        sourceVersionId: secondSource!.id,
        versionId: 'published-two',
        snapshot: publishedSnapshot,
      });

      for (let i = 0; i < 10; i++) await Promise.resolve();
      const secondActivatedBeforeRelease = secondActivated;
      releaseFirstActivation();

      await Promise.all([first, second]);
      expect(secondActivatedBeforeRelease).toBe(true);
    });

    it('continues the fallback queue after a publication fails', async () => {
      await storage.create({
        skill: { id: 'publish-retry', name: 'Draft', description: 'desc', instructions: 'draft' },
      });
      const sourceVersion = await storage.getLatestVersion('publish-retry');
      const update = storage.update.bind(storage);
      vi.spyOn(storage, 'update').mockRejectedValueOnce(new Error('activation failed')).mockImplementation(update);

      await expect(
        storage.publishVersion({
          skillId: 'publish-retry',
          sourceVersionId: sourceVersion!.id,
          versionId: 'failed-publication',
          snapshot: publishedSnapshot,
        }),
      ).rejects.toThrow('activation failed');

      await expect(
        storage.publishVersion({
          skillId: 'publish-retry',
          sourceVersionId: sourceVersion!.id,
          versionId: 'successful-publication',
          snapshot: publishedSnapshot,
        }),
      ).resolves.toMatchObject({ id: 'successful-publication' });
      expect(await storage.getVersion('failed-publication')).toBeNull();
      expect((await storage.getById('publish-retry'))?.activeVersionId).toBe('successful-publication');
    });
  });
});
