import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDB } from '../inmemory-db';
import { InMemoryPromptBlocksStorage } from './inmemory';

describe('InMemoryPromptBlocksStorage', () => {
  let db: InMemoryDB;
  let storage: InMemoryPromptBlocksStorage;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new InMemoryPromptBlocksStorage({ db });
  });

  // ==========================================================================
  // create
  // ==========================================================================

  describe('create', () => {
    it('should create a block with status=draft and no activeVersionId', async () => {
      const result = await storage.create({
        promptBlock: {
          id: 'block-1',
          name: 'Test Block',
          content: 'Hello world',
        },
      });

      expect(result.id).toBe('block-1');
      expect(result.status).toBe('draft');
      expect(result.activeVersionId).toBeUndefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should auto-create version 1 with initial config', async () => {
      await storage.create({
        promptBlock: {
          id: 'block-1',
          name: 'Test Block',
          content: 'Hello world',
          description: 'A test block',
        },
      });

      const versionCount = await storage.countVersions('block-1');
      expect(versionCount).toBe(1);

      const latestVersion = await storage.getLatestVersion('block-1');
      expect(latestVersion).not.toBeNull();
      expect(latestVersion!.versionNumber).toBe(1);
      expect(latestVersion!.name).toBe('Test Block');
      expect(latestVersion!.content).toBe('Hello world');
      expect(latestVersion!.description).toBe('A test block');
      expect(latestVersion!.changeMessage).toBe('Initial version');
    });

    it('should store optional fields (authorId, metadata, rules)', async () => {
      const rules = {
        operator: 'AND' as const,
        conditions: [{ field: 'user.role', operator: 'equals' as const, value: 'admin' }],
      };

      const result = await storage.create({
        promptBlock: {
          id: 'block-2',
          name: 'Admin Block',
          content: 'Admin content',
          authorId: 'user-123',
          metadata: { category: 'admin' },
          rules,
        },
      });

      expect(result.authorId).toBe('user-123');
      expect(result.metadata).toEqual({ category: 'admin' });

      // Rules should be on the version, not the thin record
      const latestVersion = await storage.getLatestVersion('block-2');
      expect(latestVersion!.rules).toEqual(rules);
    });

    it('should throw if block with same ID already exists', async () => {
      await storage.create({
        promptBlock: { id: 'dup', name: 'First', content: 'First' },
      });

      await expect(
        storage.create({
          promptBlock: { id: 'dup', name: 'Second', content: 'Second' },
        }),
      ).rejects.toThrow('Prompt block with id dup already exists');
    });
  });

  // ==========================================================================
  // getById
  // ==========================================================================

  describe('getById', () => {
    it('should return thin record for existing block', async () => {
      await storage.create({
        promptBlock: { id: 'block-1', name: 'Test', content: 'Content' },
      });

      const block = await storage.getById('block-1');
      expect(block).not.toBeNull();
      expect(block!.id).toBe('block-1');
      expect(block!.status).toBe('draft');
    });

    it('should return null for non-existent block', async () => {
      const block = await storage.getById('nonexistent');
      expect(block).toBeNull();
    });

    it('should return a deep copy (mutation safety)', async () => {
      await storage.create({
        promptBlock: { id: 'block-1', name: 'Test', content: 'Content', metadata: { key: 'value' } },
      });

      const block1 = await storage.getById('block-1');
      const block2 = await storage.getById('block-1');

      block1!.metadata!['key'] = 'mutated';
      expect(block2!.metadata!['key']).toBe('value');
    });
  });

  // ==========================================================================
  // getByIdResolved
  // ==========================================================================

  describe('getByIdResolved', () => {
    it('should resolve latest version for block without activeVersionId', async () => {
      await storage.create({
        promptBlock: { id: 'block-1', name: 'Test', content: 'Content v1' },
      });

      const resolved = await storage.getByIdResolved('block-1');
      expect(resolved).not.toBeNull();
      expect(resolved!.id).toBe('block-1');
      expect(resolved!.name).toBe('Test');
      expect(resolved!.content).toBe('Content v1');
      expect(resolved!.status).toBe('draft');
    });

    it('should resolve the active version when activeVersionId is set', async () => {
      await storage.create({
        promptBlock: { id: 'block-1', name: 'V1 Name', content: 'V1 Content' },
      });

      // Create version 2 with different content
      const v2Id = 'version-2';
      await storage.createVersion({
        id: v2Id,
        blockId: 'block-1',
        versionNumber: 2,
        name: 'V2 Name',
        content: 'V2 Content',
        changedFields: ['name', 'content'],
        changeMessage: 'Updated to v2',
      });

      // Set active to version 2 (but latest is also v2)
      await storage.update({
        id: 'block-1',
        activeVersionId: v2Id,
      });

      const resolved = await storage.getByIdResolved('block-1');
      expect(resolved!.name).toBe('V2 Name');
      expect(resolved!.content).toBe('V2 Content');
      // Status remains 'draft' — auto-publish was removed from storage
      expect(resolved!.status).toBe('draft');
    });

    it('should fall back to latest version when activeVersionId points to missing version', async () => {
      await storage.create({
        promptBlock: { id: 'block-1', name: 'Test', content: 'Content' },
      });

      // Manually set an invalid activeVersionId
      db.promptBlocks.get('block-1')!.activeVersionId = 'nonexistent-version';

      const resolved = await storage.getByIdResolved('block-1');
      expect(resolved).not.toBeNull();
      expect(resolved!.name).toBe('Test');
      expect(resolved!.content).toBe('Content');
    });

    it('should return null for non-existent block', async () => {
      const resolved = await storage.getByIdResolved('nonexistent');
      expect(resolved).toBeNull();
    });
  });

  // ==========================================================================
  // update
  // ==========================================================================

  describe('update', () => {
    let blockId: string;

    beforeEach(async () => {
      blockId = 'update-block';
      await storage.create({
        promptBlock: {
          id: blockId,
          name: 'Original Name',
          content: 'Original content',
          authorId: 'user-1',
          metadata: { key1: 'val1', key2: 'val2' },
        },
      });
    });

    it('should update metadata without creating a new version', async () => {
      const versionCountBefore = await storage.countVersions(blockId);
      expect(versionCountBefore).toBe(1);

      const result = await storage.update({
        id: blockId,
        metadata: { key2: 'updated', key3: 'val3' },
      });

      // Metadata merged
      expect(result.metadata).toEqual({
        key1: 'val1',
        key2: 'updated',
        key3: 'val3',
      });

      // No new version
      const versionCountAfter = await storage.countVersions(blockId);
      expect(versionCountAfter).toBe(1);
    });

    it('should not create a new version when updating config fields', async () => {
      const versionCountBefore = await storage.countVersions(blockId);
      expect(versionCountBefore).toBe(1);

      await storage.update({
        id: blockId,
        name: 'Updated Name',
        content: 'Updated content',
      });

      // No new version created — update() no longer creates versions
      const versionCountAfter = await storage.countVersions(blockId);
      expect(versionCountAfter).toBe(1);
    });

    it('should not auto-publish when activeVersionId is updated (handler manages status)', async () => {
      // Create a second version
      const versionId = 'v2-id';
      await storage.createVersion({
        id: versionId,
        blockId,
        versionNumber: 2,
        name: 'Version 2',
        content: 'Version 2 content',
        changedFields: ['name', 'content'],
      });

      const result = await storage.update({
        id: blockId,
        activeVersionId: versionId,
      });

      // Status remains 'draft' — auto-publish was removed from storage
      expect(result.status).toBe('draft');
      expect(result.activeVersionId).toBe(versionId);
    });

    it('should handle mixed metadata and config updates without creating a version', async () => {
      await storage.update({
        id: blockId,
        metadata: { key3: 'val3' },
        name: 'Mixed Update Name',
      });

      // No new version created — update() no longer creates versions
      const versionCount = await storage.countVersions(blockId);
      expect(versionCount).toBe(1);

      const block = await storage.getById(blockId);
      expect(block!.metadata).toEqual({
        key1: 'val1',
        key2: 'val2',
        key3: 'val3',
      });
    });

    it('should throw for non-existent block', async () => {
      await expect(storage.update({ id: 'nonexistent', name: 'Nope' })).rejects.toThrow(
        'Prompt block with id nonexistent not found',
      );
    });
  });

  // ==========================================================================
  // delete
  // ==========================================================================

  describe('delete', () => {
    it('should delete block and all its versions', async () => {
      await storage.create({
        promptBlock: { id: 'del-block', name: 'To Delete', content: 'Content' },
      });

      // Create extra version
      await storage.createVersion({
        id: 'v2',
        blockId: 'del-block',
        versionNumber: 2,
        name: 'V2',
        content: 'V2 Content',
      });

      expect(await storage.countVersions('del-block')).toBe(2);

      await storage.delete('del-block');

      expect(await storage.getById('del-block')).toBeNull();
      expect(await storage.countVersions('del-block')).toBe(0);
    });

    it('should be idempotent (no error for non-existent block)', async () => {
      await expect(storage.delete('nonexistent')).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // list
  // ==========================================================================

  describe('list', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 5; i++) {
        await storage.create({
          promptBlock: {
            id: `block-${i}`,
            name: `Block ${i}`,
            content: `Content ${i}`,
            authorId: i <= 3 ? 'author-a' : 'author-b',
            metadata: { index: i },
          },
        });
        // Stagger creation times slightly
        await new Promise(r => setTimeout(r, 5));
      }
    });

    it('should return all blocks with default pagination', async () => {
      const result = await storage.list({ status: 'draft' });
      expect(result.promptBlocks).toHaveLength(5);
      expect(result.total).toBe(5);
      expect(result.page).toBe(0);
    });

    it('should support pagination', async () => {
      const page0 = await storage.list({ status: 'draft', page: 0, perPage: 2 });
      expect(page0.promptBlocks).toHaveLength(2);
      expect(page0.hasMore).toBe(true);
      expect(page0.total).toBe(5);

      const page1 = await storage.list({ status: 'draft', page: 1, perPage: 2 });
      expect(page1.promptBlocks).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await storage.list({ status: 'draft', page: 2, perPage: 2 });
      expect(page2.promptBlocks).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });

    it('should filter by authorId', async () => {
      const result = await storage.list({ status: 'draft', authorId: 'author-a' });
      expect(result.promptBlocks).toHaveLength(3);
      result.promptBlocks.forEach(b => {
        expect(b.authorId).toBe('author-a');
      });
    });

    it('should filter by metadata', async () => {
      const result = await storage.list({ status: 'draft', metadata: { index: 3 } });
      expect(result.promptBlocks).toHaveLength(1);
      expect(result.promptBlocks[0]!.id).toBe('block-3');
    });

    it('should sort by createdAt DESC by default', async () => {
      const result = await storage.list({ status: 'draft' });
      const ids = result.promptBlocks.map(b => b.id);
      // DESC means newest first
      expect(ids[0]).toBe('block-5');
      expect(ids[4]).toBe('block-1');
    });

    it('should sort by createdAt ASC when specified', async () => {
      const result = await storage.list({
        status: 'draft',
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });
      const ids = result.promptBlocks.map(b => b.id);
      expect(ids[0]).toBe('block-1');
      expect(ids[4]).toBe('block-5');
    });

    it('should return empty list when no blocks exist', async () => {
      db.promptBlocks.clear();
      const result = await storage.list();
      expect(result.promptBlocks).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ==========================================================================
  // listResolved
  // ==========================================================================

  describe('listResolved', () => {
    it('should return blocks with version config resolved', async () => {
      await storage.create({
        promptBlock: { id: 'block-1', name: 'Block One', content: 'Content One' },
      });
      await storage.create({
        promptBlock: { id: 'block-2', name: 'Block Two', content: 'Content Two' },
      });

      const result = await storage.listResolved({ status: 'draft' });
      expect(result.promptBlocks).toHaveLength(2);

      // Each resolved block should have both thin record fields and snapshot fields
      for (const block of result.promptBlocks) {
        expect(block.name).toBeDefined();
        expect(block.content).toBeDefined();
        expect(block.status).toBeDefined();
        expect(block.id).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Version CRUD
  // ==========================================================================

  describe('version methods', () => {
    const blockId = 'versioned-block';

    beforeEach(async () => {
      await storage.create({
        promptBlock: { id: blockId, name: 'V1', content: 'Content V1' },
      });
    });

    it('should create and retrieve version by ID', async () => {
      const v2 = await storage.createVersion({
        id: 'v2-uuid',
        blockId,
        versionNumber: 2,
        name: 'V2',
        content: 'Content V2',
        changedFields: ['name', 'content'],
        changeMessage: 'Updated to v2',
      });

      expect(v2.id).toBe('v2-uuid');
      expect(v2.blockId).toBe(blockId);
      expect(v2.versionNumber).toBe(2);
      expect(v2.createdAt).toBeInstanceOf(Date);

      const fetched = await storage.getVersion('v2-uuid');
      expect(fetched).not.toBeNull();
      expect(fetched!.name).toBe('V2');
      expect(fetched!.content).toBe('Content V2');
      expect(fetched!.changedFields).toEqual(['name', 'content']);
      expect(fetched!.changeMessage).toBe('Updated to v2');
    });

    it('should return null for non-existent version', async () => {
      expect(await storage.getVersion('nonexistent')).toBeNull();
    });

    it('should throw when creating version with duplicate ID', async () => {
      const existingVersion = await storage.getLatestVersion(blockId);
      await expect(
        storage.createVersion({
          id: existingVersion!.id,
          blockId,
          versionNumber: 2,
          name: 'Dup',
          content: 'Dup',
        }),
      ).rejects.toThrow('already exists');
    });

    it('should throw when creating version with duplicate versionNumber', async () => {
      await expect(
        storage.createVersion({
          id: 'new-id',
          blockId,
          versionNumber: 1, // already exists
          name: 'Dup',
          content: 'Dup',
        }),
      ).rejects.toThrow('Version number 1 already exists');
    });

    it('should get version by block ID and version number', async () => {
      const version = await storage.getVersionByNumber(blockId, 1);
      expect(version).not.toBeNull();
      expect(version!.name).toBe('V1');
      expect(version!.versionNumber).toBe(1);
    });

    it('should return null for non-existent version number', async () => {
      const version = await storage.getVersionByNumber(blockId, 999);
      expect(version).toBeNull();
    });

    it('should get latest version', async () => {
      await storage.createVersion({
        id: 'v2-id',
        blockId,
        versionNumber: 2,
        name: 'V2',
        content: 'V2 Content',
      });
      await storage.createVersion({
        id: 'v3-id',
        blockId,
        versionNumber: 3,
        name: 'V3',
        content: 'V3 Content',
      });

      const latest = await storage.getLatestVersion(blockId);
      expect(latest).not.toBeNull();
      expect(latest!.versionNumber).toBe(3);
      expect(latest!.name).toBe('V3');
    });

    it('should return null for latest version of non-existent block', async () => {
      const latest = await storage.getLatestVersion('nonexistent');
      expect(latest).toBeNull();
    });

    it('should list versions with pagination', async () => {
      await storage.createVersion({
        id: 'v2-id',
        blockId,
        versionNumber: 2,
        name: 'V2',
        content: 'V2',
      });
      await storage.createVersion({
        id: 'v3-id',
        blockId,
        versionNumber: 3,
        name: 'V3',
        content: 'V3',
      });

      const all = await storage.listVersions({ blockId, perPage: false });
      expect(all.versions).toHaveLength(3);
      expect(all.total).toBe(3);

      // Default sort is versionNumber DESC
      expect(all.versions[0]!.versionNumber).toBe(3);
      expect(all.versions[2]!.versionNumber).toBe(1);

      const page0 = await storage.listVersions({ blockId, page: 0, perPage: 2 });
      expect(page0.versions).toHaveLength(2);
      expect(page0.hasMore).toBe(true);

      const page1 = await storage.listVersions({ blockId, page: 1, perPage: 2 });
      expect(page1.versions).toHaveLength(1);
      expect(page1.hasMore).toBe(false);
    });

    it('should list versions sorted by versionNumber ASC', async () => {
      await storage.createVersion({
        id: 'v2-id',
        blockId,
        versionNumber: 2,
        name: 'V2',
        content: 'V2',
      });

      const result = await storage.listVersions({
        blockId,
        orderBy: { field: 'versionNumber', direction: 'ASC' },
      });
      expect(result.versions[0]!.versionNumber).toBe(1);
      expect(result.versions[1]!.versionNumber).toBe(2);
    });

    it('should delete a single version', async () => {
      const v2 = await storage.createVersion({
        id: 'v2-del',
        blockId,
        versionNumber: 2,
        name: 'V2',
        content: 'V2',
      });

      expect(await storage.countVersions(blockId)).toBe(2);
      await storage.deleteVersion(v2.id);
      expect(await storage.countVersions(blockId)).toBe(1);
      expect(await storage.getVersion('v2-del')).toBeNull();
    });

    it('should delete all versions by block ID', async () => {
      await storage.createVersion({
        id: 'v2-id',
        blockId,
        versionNumber: 2,
        name: 'V2',
        content: 'V2',
      });

      expect(await storage.countVersions(blockId)).toBe(2);
      await storage.deleteVersionsByParentId(blockId);
      expect(await storage.countVersions(blockId)).toBe(0);
    });

    it('should count versions correctly', async () => {
      expect(await storage.countVersions(blockId)).toBe(1);

      await storage.createVersion({
        id: 'v2-id',
        blockId,
        versionNumber: 2,
        name: 'V2',
        content: 'V2',
      });

      expect(await storage.countVersions(blockId)).toBe(2);
      expect(await storage.countVersions('nonexistent')).toBe(0);
    });
  });

  // ==========================================================================
  // dangerouslyClearAll
  // ==========================================================================

  describe('dangerouslyClearAll', () => {
    it('should clear all prompt blocks and versions', async () => {
      await storage.create({
        promptBlock: { id: 'block-1', name: 'B1', content: 'C1' },
      });
      await storage.create({
        promptBlock: { id: 'block-2', name: 'B2', content: 'C2' },
      });

      expect(db.promptBlocks.size).toBe(2);
      expect(db.promptBlockVersions.size).toBe(2); // one version per block

      await storage.dangerouslyClearAll();

      expect(db.promptBlocks.size).toBe(0);
      expect(db.promptBlockVersions.size).toBe(0);
    });
  });
});
