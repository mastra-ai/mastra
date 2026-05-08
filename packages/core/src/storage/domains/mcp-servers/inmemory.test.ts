import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDB } from '../inmemory-db';
import { InMemoryMCPServersStorage } from './inmemory';

const sampleSnapshot = {
  name: 'My MCP Server',
  version: '1.0.0',
  description: 'A test server',
  tools: {
    'my-tool': { description: 'A tool' },
  },
};

const sampleSnapshotAlt = {
  name: 'Alt MCP Server',
  version: '2.0.0',
  description: 'An alternative server',
  tools: {
    'alt-tool': { description: 'Another tool' },
  },
};

describe('InMemoryMCPServersStorage', () => {
  let db: InMemoryDB;
  let storage: InMemoryMCPServersStorage;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new InMemoryMCPServersStorage({ db });
  });

  // ==========================================================================
  // create
  // ==========================================================================

  describe('create', () => {
    it('should create MCP server with status=draft and activeVersionId=undefined', async () => {
      const result = await storage.create({
        mcpServer: {
          id: 'mcp-1',
          authorId: 'user-123',
          metadata: { category: 'test' },
          ...sampleSnapshot,
        },
      });

      expect(result.id).toBe('mcp-1');
      expect(result.status).toBe('draft');
      expect(result.activeVersionId).toBeUndefined();
      expect(result.authorId).toBe('user-123');
      expect(result.metadata).toEqual({ category: 'test' });
    });

    it('should return thin record with correct fields', async () => {
      const result = await storage.create({
        mcpServer: {
          id: 'mcp-1',
          ...sampleSnapshot,
        },
      });

      expect(result.id).toBe('mcp-1');
      expect(result.status).toBe('draft');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should auto-create version 1 with initial config', async () => {
      await storage.create({
        mcpServer: {
          id: 'mcp-1',
          ...sampleSnapshot,
        },
      });

      const versionCount = await storage.countVersions('mcp-1');
      expect(versionCount).toBe(1);

      const latestVersion = await storage.getLatestVersion('mcp-1');
      expect(latestVersion).not.toBeNull();
      expect(latestVersion!.versionNumber).toBe(1);
      expect(latestVersion!.name).toBe('My MCP Server');
      expect(latestVersion!.version).toBe('1.0.0');
      expect(latestVersion!.description).toBe('A test server');
      expect(latestVersion!.tools).toEqual({ 'my-tool': { description: 'A tool' } });
      expect(latestVersion!.changeMessage).toBe('Initial version');
    });

    it('should make config accessible via getByIdResolved', async () => {
      await storage.create({
        mcpServer: {
          id: 'mcp-1',
          ...sampleSnapshot,
        },
      });

      const resolved = await storage.getByIdResolved('mcp-1');
      expect(resolved).not.toBeNull();
      expect(resolved!.name).toBe('My MCP Server');
      expect(resolved!.version).toBe('1.0.0');
      expect(resolved!.tools).toEqual({ 'my-tool': { description: 'A tool' } });
    });

    it('should throw if MCP server with same ID already exists', async () => {
      await storage.create({
        mcpServer: { id: 'dup', ...sampleSnapshot },
      });

      await expect(
        storage.create({
          mcpServer: { id: 'dup', ...sampleSnapshotAlt },
        }),
      ).rejects.toThrow('MCP server with id dup already exists');
    });
  });

  // ==========================================================================
  // getById
  // ==========================================================================

  describe('getById', () => {
    it('should return thin record for existing server', async () => {
      await storage.create({
        mcpServer: { id: 'mcp-1', ...sampleSnapshot },
      });

      const server = await storage.getById('mcp-1');
      expect(server).not.toBeNull();
      expect(server!.id).toBe('mcp-1');
      expect(server!.status).toBe('draft');
    });

    it('should return null for non-existent server', async () => {
      const server = await storage.getById('nonexistent');
      expect(server).toBeNull();
    });

    it('should return a deep copy (mutation safety)', async () => {
      await storage.create({
        mcpServer: {
          id: 'mcp-1',
          ...sampleSnapshot,
          metadata: { key: 'value' },
        },
      });

      const server1 = await storage.getById('mcp-1');
      const server2 = await storage.getById('mcp-1');

      server1!.metadata!['key'] = 'mutated';
      expect(server2!.metadata!['key']).toBe('value');
    });
  });

  // ==========================================================================
  // getByIdResolved
  // ==========================================================================

  describe('getByIdResolved', () => {
    it('should fall back to latest version when activeVersionId is undefined', async () => {
      await storage.create({
        mcpServer: {
          id: 'mcp-1',
          ...sampleSnapshot,
        },
      });

      // Create more versions
      await storage.createVersion({
        id: 'v2',
        mcpServerId: 'mcp-1',
        versionNumber: 2,
        name: 'Version 2 Name',
        version: '2.0.0',
        changedFields: ['name', 'version'],
        changeMessage: 'v2',
      });

      await storage.createVersion({
        id: 'v3',
        mcpServerId: 'mcp-1',
        versionNumber: 3,
        name: 'Latest Version Name',
        version: '3.0.0',
        tools: { 'new-tool': { description: 'New tool' } },
        changedFields: ['name', 'version', 'tools'],
        changeMessage: 'v3',
      });

      const resolved = await storage.getByIdResolved('mcp-1');
      expect(resolved!.name).toBe('Latest Version Name');
      expect(resolved!.version).toBe('3.0.0');
      expect(resolved!.tools).toEqual({ 'new-tool': { description: 'New tool' } });
    });

    it('should use active version when set', async () => {
      await storage.create({
        mcpServer: {
          id: 'mcp-1',
          ...sampleSnapshot,
        },
      });

      // Create and set active version
      const activeVersionId = 'active-version';
      await storage.createVersion({
        id: activeVersionId,
        mcpServerId: 'mcp-1',
        versionNumber: 2,
        name: 'Active Version',
        version: '2.0.0',
        tools: { 'active-tool': { description: 'Active tool' } },
        changedFields: ['name', 'version', 'tools'],
        changeMessage: 'Active version',
      });

      await storage.update({
        id: 'mcp-1',
        activeVersionId,
      });

      const resolved = await storage.getByIdResolved('mcp-1');
      expect(resolved!.name).toBe('Active Version');
      expect(resolved!.version).toBe('2.0.0');
      expect(resolved!.tools).toEqual({ 'active-tool': { description: 'Active tool' } });
    });

    it('should return null for non-existent server', async () => {
      const resolved = await storage.getByIdResolved('nonexistent');
      expect(resolved).toBeNull();
    });

    it('should merge thin record fields with snapshot config', async () => {
      await storage.create({
        mcpServer: {
          id: 'mcp-1',
          authorId: 'user-123',
          metadata: { env: 'test' },
          ...sampleSnapshot,
        },
      });

      const resolved = await storage.getByIdResolved('mcp-1');
      expect(resolved).not.toBeNull();

      // Thin record fields
      expect(resolved!.id).toBe('mcp-1');
      expect(resolved!.status).toBe('draft');
      expect(resolved!.authorId).toBe('user-123');
      expect(resolved!.metadata).toEqual({ env: 'test' });
      expect(resolved!.createdAt).toBeInstanceOf(Date);
      expect(resolved!.updatedAt).toBeInstanceOf(Date);

      // Snapshot config fields
      expect(resolved!.name).toBe('My MCP Server');
      expect(resolved!.version).toBe('1.0.0');
      expect(resolved!.description).toBe('A test server');
      expect(resolved!.tools).toEqual({ 'my-tool': { description: 'A tool' } });
    });
  });

  // ==========================================================================
  // update
  // ==========================================================================

  describe('update', () => {
    let serverId: string;

    beforeEach(async () => {
      serverId = 'update-server';
      await storage.create({
        mcpServer: {
          id: serverId,
          authorId: 'user-123',
          metadata: { key1: 'val1', key2: 'val2' },
          ...sampleSnapshot,
        },
      });
    });

    it('should update metadata without creating a new version', async () => {
      const versionCountBefore = await storage.countVersions(serverId);
      expect(versionCountBefore).toBe(1);

      const result = await storage.update({
        id: serverId,
        metadata: { key2: 'updated', key3: 'val3' },
      });

      // Metadata should be MERGED
      expect(result.metadata).toEqual({
        key1: 'val1',
        key2: 'updated',
        key3: 'val3',
      });

      // No new version created
      const versionCountAfter = await storage.countVersions(serverId);
      expect(versionCountAfter).toBe(1);
    });

    it('should not create new version when updating config fields', async () => {
      const versionCountBefore = await storage.countVersions(serverId);
      expect(versionCountBefore).toBe(1);

      await storage.update({
        id: serverId,
        name: 'Updated Name',
        version: '2.0.0',
      });

      // No new version created — update() no longer creates versions
      const versionCountAfter = await storage.countVersions(serverId);
      expect(versionCountAfter).toBe(1);
    });

    it('should handle mixed metadata and config updates', async () => {
      const versionCountBefore = await storage.countVersions(serverId);
      expect(versionCountBefore).toBe(1);

      await storage.update({
        id: serverId,
        metadata: { key3: 'val3' }, // metadata update
        name: 'Mixed Update Name', // config update
        version: '3.0.0', // config update
      });

      // No new version created — update() no longer creates versions
      const versionCountAfter = await storage.countVersions(serverId);
      expect(versionCountAfter).toBe(1);

      const server = await storage.getById(serverId);
      expect(server!.metadata).toEqual({
        key1: 'val1',
        key2: 'val2',
        key3: 'val3',
      });
    });

    it('should not auto-publish when activeVersionId is updated', async () => {
      // Create a second version
      const versionId = 'version-2';
      await storage.createVersion({
        id: versionId,
        mcpServerId: serverId,
        versionNumber: 2,
        name: 'Version 2',
        version: '2.0.0',
        tools: sampleSnapshotAlt.tools,
        changedFields: ['name', 'version', 'tools'],
        changeMessage: 'Updated to v2',
      });

      const result = await storage.update({
        id: serverId,
        activeVersionId: versionId,
      });

      // Status remains 'draft' — the handler manages status changes, not the storage layer
      expect(result.status).toBe('draft');
      expect(result.activeVersionId).toBe(versionId);
    });

    it('should throw for non-existent server', async () => {
      await expect(storage.update({ id: 'nonexistent', name: 'Nope' })).rejects.toThrow(
        'MCP server with id nonexistent not found',
      );
    });

    it('should not create new version when config values have not actually changed', async () => {
      const versionCountBefore = await storage.countVersions(serverId);
      expect(versionCountBefore).toBe(1);

      // Update with the same values
      await storage.update({
        id: serverId,
        name: 'My MCP Server',
        version: '1.0.0',
      });

      // No new version should be created since values are identical
      const versionCountAfter = await storage.countVersions(serverId);
      expect(versionCountAfter).toBe(1);
    });
  });

  // ==========================================================================
  // delete
  // ==========================================================================

  describe('delete', () => {
    it('should cascade delete all versions', async () => {
      await storage.create({
        mcpServer: { id: 'del-server', ...sampleSnapshot },
      });

      // Create extra versions
      await storage.createVersion({
        id: 'v2',
        mcpServerId: 'del-server',
        versionNumber: 2,
        name: 'V2',
        version: '2.0.0',
        changedFields: ['name', 'version'],
        changeMessage: 'v2',
      });

      expect(await storage.countVersions('del-server')).toBe(2);

      await storage.delete('del-server');

      expect(await storage.getById('del-server')).toBeNull();
      expect(await storage.countVersions('del-server')).toBe(0);
    });

    it('should be idempotent (no error for non-existent server)', async () => {
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
          mcpServer: {
            id: `mcp-${i}`,
            name: `Server ${i}`,
            version: `${i}.0.0`,
            authorId: i <= 3 ? 'author-a' : 'author-b',
            metadata: { index: i },
          },
        });
        // Stagger creation times slightly
        await new Promise(r => setTimeout(r, 5));
      }
    });

    it('should return all servers with default pagination', async () => {
      const result = await storage.list({ status: 'draft' });
      expect(result.mcpServers).toHaveLength(5);
      expect(result.total).toBe(5);
      expect(result.page).toBe(0);
    });

    it('should filter by authorId', async () => {
      const result = await storage.list({ authorId: 'author-a', status: 'draft' });
      expect(result.mcpServers).toHaveLength(3);
      result.mcpServers.forEach(s => {
        expect(s.authorId).toBe('author-a');
      });
    });

    it('should filter by metadata (AND logic)', async () => {
      const result = await storage.list({ metadata: { index: 3 }, status: 'draft' });
      expect(result.mcpServers).toHaveLength(1);
      expect(result.mcpServers[0]!.id).toBe('mcp-3');
    });

    it('should support pagination', async () => {
      const page0 = await storage.list({ page: 0, perPage: 2, status: 'draft' });
      expect(page0.mcpServers).toHaveLength(2);
      expect(page0.hasMore).toBe(true);
      expect(page0.total).toBe(5);

      const page1 = await storage.list({ page: 1, perPage: 2, status: 'draft' });
      expect(page1.mcpServers).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await storage.list({ page: 2, perPage: 2, status: 'draft' });
      expect(page2.mcpServers).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });

    it('should return empty result when no match', async () => {
      const result = await storage.list({ authorId: 'nonexistent-author' });
      expect(result.mcpServers).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should sort by createdAt DESC by default', async () => {
      const result = await storage.list({ status: 'draft' });
      const ids = result.mcpServers.map(s => s.id);
      // DESC means newest first
      expect(ids[0]).toBe('mcp-5');
      expect(ids[4]).toBe('mcp-1');
    });

    it('should sort by createdAt ASC when specified', async () => {
      const result = await storage.list({
        orderBy: { field: 'createdAt', direction: 'ASC' },
        status: 'draft',
      });
      const ids = result.mcpServers.map(s => s.id);
      expect(ids[0]).toBe('mcp-1');
      expect(ids[4]).toBe('mcp-5');
    });
  });

  // ==========================================================================
  // listResolved
  // ==========================================================================

  describe('listResolved', () => {
    it('should return resolved servers with merged config', async () => {
      await storage.create({
        mcpServer: { id: 'mcp-1', ...sampleSnapshot },
      });
      await storage.create({
        mcpServer: { id: 'mcp-2', ...sampleSnapshotAlt },
      });

      const result = await storage.listResolved({ status: 'draft' });
      expect(result.mcpServers).toHaveLength(2);

      // Each resolved server should have both thin record fields and snapshot fields
      for (const server of result.mcpServers) {
        expect(server.id).toBeDefined();
        expect(server.status).toBeDefined();
        expect(server.name).toBeDefined();
        expect(server.version).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Version CRUD
  // ==========================================================================

  describe('version methods', () => {
    const serverId = 'versioned-server';

    beforeEach(async () => {
      await storage.create({
        mcpServer: { id: serverId, ...sampleSnapshot },
      });
    });

    it('should create and retrieve version by ID', async () => {
      const v2 = await storage.createVersion({
        id: 'v2-uuid',
        mcpServerId: serverId,
        versionNumber: 2,
        name: 'V2',
        version: '2.0.0',
        tools: sampleSnapshotAlt.tools,
        changedFields: ['name', 'version', 'tools'],
        changeMessage: 'Updated to v2',
      });

      expect(v2.id).toBe('v2-uuid');
      expect(v2.mcpServerId).toBe(serverId);
      expect(v2.versionNumber).toBe(2);
      expect(v2.createdAt).toBeInstanceOf(Date);

      const fetched = await storage.getVersion('v2-uuid');
      expect(fetched).not.toBeNull();
      expect(fetched!.name).toBe('V2');
      expect(fetched!.version).toBe('2.0.0');
      expect(fetched!.tools).toEqual(sampleSnapshotAlt.tools);
      expect(fetched!.changedFields).toEqual(['name', 'version', 'tools']);
      expect(fetched!.changeMessage).toBe('Updated to v2');
    });

    it('should return null for non-existent version', async () => {
      expect(await storage.getVersion('nonexistent')).toBeNull();
    });

    it('should throw when creating version with duplicate ID', async () => {
      const existingVersion = await storage.getLatestVersion(serverId);
      await expect(
        storage.createVersion({
          id: existingVersion!.id,
          mcpServerId: serverId,
          versionNumber: 2,
          name: 'Dup',
          version: '2.0.0',
        }),
      ).rejects.toThrow('already exists');
    });

    it('should throw when creating version with duplicate versionNumber', async () => {
      await expect(
        storage.createVersion({
          id: 'new-id',
          mcpServerId: serverId,
          versionNumber: 1, // already exists
          name: 'Dup',
          version: '1.0.0',
        }),
      ).rejects.toThrow('Version number 1 already exists');
    });

    it('should get version by server ID and version number', async () => {
      const version = await storage.getVersionByNumber(serverId, 1);
      expect(version).not.toBeNull();
      expect(version!.name).toBe('My MCP Server');
      expect(version!.versionNumber).toBe(1);
    });

    it('should return null for non-existent version number', async () => {
      const version = await storage.getVersionByNumber(serverId, 999);
      expect(version).toBeNull();
    });

    it('should get latest version', async () => {
      await storage.createVersion({
        id: 'v2-id',
        mcpServerId: serverId,
        versionNumber: 2,
        name: 'V2',
        version: '2.0.0',
      });
      await storage.createVersion({
        id: 'v3-id',
        mcpServerId: serverId,
        versionNumber: 3,
        name: 'V3',
        version: '3.0.0',
        tools: sampleSnapshotAlt.tools,
      });

      const latest = await storage.getLatestVersion(serverId);
      expect(latest).not.toBeNull();
      expect(latest!.versionNumber).toBe(3);
      expect(latest!.name).toBe('V3');
    });

    it('should return null for latest version of non-existent server', async () => {
      const latest = await storage.getLatestVersion('nonexistent');
      expect(latest).toBeNull();
    });

    it('should list versions with pagination', async () => {
      await storage.createVersion({
        id: 'v2-id',
        mcpServerId: serverId,
        versionNumber: 2,
        name: 'V2',
        version: '2.0.0',
      });
      await storage.createVersion({
        id: 'v3-id',
        mcpServerId: serverId,
        versionNumber: 3,
        name: 'V3',
        version: '3.0.0',
      });

      const all = await storage.listVersions({ mcpServerId: serverId, perPage: false });
      expect(all.versions).toHaveLength(3);
      expect(all.total).toBe(3);

      // Default sort is versionNumber DESC
      expect(all.versions[0]!.versionNumber).toBe(3);
      expect(all.versions[2]!.versionNumber).toBe(1);

      const page0 = await storage.listVersions({ mcpServerId: serverId, page: 0, perPage: 2 });
      expect(page0.versions).toHaveLength(2);
      expect(page0.hasMore).toBe(true);

      const page1 = await storage.listVersions({ mcpServerId: serverId, page: 1, perPage: 2 });
      expect(page1.versions).toHaveLength(1);
      expect(page1.hasMore).toBe(false);
    });

    it('should list versions sorted by versionNumber ASC', async () => {
      await storage.createVersion({
        id: 'v2-id',
        mcpServerId: serverId,
        versionNumber: 2,
        name: 'V2',
        version: '2.0.0',
      });

      const result = await storage.listVersions({
        mcpServerId: serverId,
        orderBy: { field: 'versionNumber', direction: 'ASC' },
      });
      expect(result.versions[0]!.versionNumber).toBe(1);
      expect(result.versions[1]!.versionNumber).toBe(2);
    });

    it('should delete a single version', async () => {
      const v2 = await storage.createVersion({
        id: 'v2-del',
        mcpServerId: serverId,
        versionNumber: 2,
        name: 'V2',
        version: '2.0.0',
      });

      expect(await storage.countVersions(serverId)).toBe(2);
      await storage.deleteVersion(v2.id);
      expect(await storage.countVersions(serverId)).toBe(1);
      expect(await storage.getVersion('v2-del')).toBeNull();
    });

    it('should delete all versions by server ID', async () => {
      await storage.createVersion({
        id: 'v2-id',
        mcpServerId: serverId,
        versionNumber: 2,
        name: 'V2',
        version: '2.0.0',
      });

      expect(await storage.countVersions(serverId)).toBe(2);
      await storage.deleteVersionsByParentId(serverId);
      expect(await storage.countVersions(serverId)).toBe(0);
    });

    it('should count versions correctly', async () => {
      expect(await storage.countVersions(serverId)).toBe(1);

      await storage.createVersion({
        id: 'v2-id',
        mcpServerId: serverId,
        versionNumber: 2,
        name: 'V2',
        version: '2.0.0',
      });

      expect(await storage.countVersions(serverId)).toBe(2);
      expect(await storage.countVersions('nonexistent')).toBe(0);
    });
  });

  // ==========================================================================
  // dangerouslyClearAll
  // ==========================================================================

  describe('dangerouslyClearAll', () => {
    it('should clear all MCP servers and versions', async () => {
      await storage.create({
        mcpServer: { id: 'mcp-1', ...sampleSnapshot },
      });
      await storage.create({
        mcpServer: { id: 'mcp-2', ...sampleSnapshotAlt },
      });

      expect(db.mcpServers.size).toBe(2);
      expect(db.mcpServerVersions.size).toBe(2); // one version per server

      await storage.dangerouslyClearAll();

      expect(db.mcpServers.size).toBe(0);
      expect(db.mcpServerVersions.size).toBe(0);
    });
  });
});
