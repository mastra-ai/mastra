import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDB } from '../inmemory-db';
import { InMemoryMCPClientsStorage } from './inmemory';

const sampleServers = {
  'my-server': {
    type: 'http' as const,
    url: 'https://api.example.com/mcp',
    timeout: 5000,
  },
};

const sampleStdioServer = {
  'local-tool': {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@example/mcp-tool'],
    env: { NODE_ENV: 'production' },
  },
};

describe('InMemoryMCPClientsStorage', () => {
  let db: InMemoryDB;
  let storage: InMemoryMCPClientsStorage;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new InMemoryMCPClientsStorage({ db });
  });

  // ==========================================================================
  // create
  // ==========================================================================

  describe('create', () => {
    it('should create MCP client with status=draft and activeVersionId=undefined', async () => {
      const result = await storage.create({
        mcpClient: {
          id: 'mcp-1',
          authorId: 'user-123',
          metadata: { category: 'test' },
          name: 'Test MCP Client',
          servers: sampleServers,
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
        mcpClient: {
          id: 'mcp-1',
          name: 'Test MCP Client',
          servers: sampleServers,
        },
      });

      expect(result.id).toBe('mcp-1');
      expect(result.status).toBe('draft');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should auto-create version 1 with initial config', async () => {
      await storage.create({
        mcpClient: {
          id: 'mcp-1',
          name: 'Test MCP Client',
          description: 'A test client',
          servers: sampleServers,
        },
      });

      const versionCount = await storage.countVersions('mcp-1');
      expect(versionCount).toBe(1);

      const latestVersion = await storage.getLatestVersion('mcp-1');
      expect(latestVersion).not.toBeNull();
      expect(latestVersion!.versionNumber).toBe(1);
      expect(latestVersion!.name).toBe('Test MCP Client');
      expect(latestVersion!.description).toBe('A test client');
      expect(latestVersion!.servers).toEqual(sampleServers);
      expect(latestVersion!.changeMessage).toBe('Initial version');
    });

    it('should make config accessible via getByIdResolved', async () => {
      await storage.create({
        mcpClient: {
          id: 'mcp-1',
          name: 'Test MCP Client',
          servers: sampleServers,
        },
      });

      const resolved = await storage.getByIdResolved('mcp-1');
      expect(resolved).not.toBeNull();
      expect(resolved!.name).toBe('Test MCP Client');
      expect(resolved!.servers).toEqual(sampleServers);
    });

    it('should throw if MCP client with same ID already exists', async () => {
      await storage.create({
        mcpClient: { id: 'dup', name: 'First', servers: sampleServers },
      });

      await expect(
        storage.create({
          mcpClient: { id: 'dup', name: 'Second', servers: sampleServers },
        }),
      ).rejects.toThrow('MCP client with id dup already exists');
    });
  });

  // ==========================================================================
  // getById
  // ==========================================================================

  describe('getById', () => {
    it('should return thin record for existing client', async () => {
      await storage.create({
        mcpClient: { id: 'mcp-1', name: 'Test', servers: sampleServers },
      });

      const client = await storage.getById('mcp-1');
      expect(client).not.toBeNull();
      expect(client!.id).toBe('mcp-1');
      expect(client!.status).toBe('draft');
    });

    it('should return null for non-existent client', async () => {
      const client = await storage.getById('nonexistent');
      expect(client).toBeNull();
    });

    it('should return a deep copy (mutation safety)', async () => {
      await storage.create({
        mcpClient: {
          id: 'mcp-1',
          name: 'Test',
          servers: sampleServers,
          metadata: { key: 'value' },
        },
      });

      const client1 = await storage.getById('mcp-1');
      const client2 = await storage.getById('mcp-1');

      client1!.metadata!['key'] = 'mutated';
      expect(client2!.metadata!['key']).toBe('value');
    });
  });

  // ==========================================================================
  // getByIdResolved
  // ==========================================================================

  describe('getByIdResolved', () => {
    it('should fall back to latest version when activeVersionId is undefined', async () => {
      await storage.create({
        mcpClient: {
          id: 'mcp-1',
          name: 'Version 1 Name',
          servers: sampleServers,
        },
      });

      // Create more versions
      await storage.createVersion({
        id: 'v2',
        mcpClientId: 'mcp-1',
        versionNumber: 2,
        name: 'Version 2 Name',
        servers: sampleServers,
        changedFields: ['name'],
        changeMessage: 'v2',
      });

      await storage.createVersion({
        id: 'v3',
        mcpClientId: 'mcp-1',
        versionNumber: 3,
        name: 'Latest Version Name',
        servers: sampleStdioServer,
        changedFields: ['name', 'servers'],
        changeMessage: 'v3',
      });

      const resolved = await storage.getByIdResolved('mcp-1');
      expect(resolved!.name).toBe('Latest Version Name');
      expect(resolved!.servers).toEqual(sampleStdioServer);
    });

    it('should use active version when set', async () => {
      await storage.create({
        mcpClient: {
          id: 'mcp-1',
          name: 'Version 1',
          servers: sampleServers,
        },
      });

      // Create and set active version
      const activeVersionId = 'active-version';
      await storage.createVersion({
        id: activeVersionId,
        mcpClientId: 'mcp-1',
        versionNumber: 2,
        name: 'Active Version',
        servers: sampleStdioServer,
        changedFields: ['name', 'servers'],
        changeMessage: 'Active version',
      });

      await storage.update({
        id: 'mcp-1',
        activeVersionId,
      });

      const resolved = await storage.getByIdResolved('mcp-1');
      expect(resolved!.name).toBe('Active Version');
      expect(resolved!.servers).toEqual(sampleStdioServer);
    });

    it('should return null for non-existent client', async () => {
      const resolved = await storage.getByIdResolved('nonexistent');
      expect(resolved).toBeNull();
    });

    it('should merge thin record fields with snapshot config', async () => {
      await storage.create({
        mcpClient: {
          id: 'mcp-1',
          authorId: 'user-123',
          metadata: { env: 'test' },
          name: 'My Client',
          description: 'A description',
          servers: sampleServers,
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
      expect(resolved!.name).toBe('My Client');
      expect(resolved!.description).toBe('A description');
      expect(resolved!.servers).toEqual(sampleServers);
    });
  });

  // ==========================================================================
  // update
  // ==========================================================================

  describe('update', () => {
    let clientId: string;

    beforeEach(async () => {
      clientId = 'update-client';
      await storage.create({
        mcpClient: {
          id: clientId,
          authorId: 'user-123',
          metadata: { key1: 'val1', key2: 'val2' },
          name: 'Original Name',
          description: 'Original description',
          servers: sampleServers,
        },
      });
    });

    it('should update metadata without creating a new version', async () => {
      const versionCountBefore = await storage.countVersions(clientId);
      expect(versionCountBefore).toBe(1);

      const result = await storage.update({
        id: clientId,
        metadata: { key2: 'updated', key3: 'val3' },
      });

      // Metadata should be MERGED
      expect(result.metadata).toEqual({
        key1: 'val1',
        key2: 'updated',
        key3: 'val3',
      });

      // No new version created
      const versionCountAfter = await storage.countVersions(clientId);
      expect(versionCountAfter).toBe(1);
    });

    it('should not create new version when updating config fields', async () => {
      const versionCountBefore = await storage.countVersions(clientId);
      expect(versionCountBefore).toBe(1);

      await storage.update({
        id: clientId,
        name: 'Updated Name',
        servers: sampleStdioServer,
      });

      // No new version created — update() no longer creates versions
      const versionCountAfter = await storage.countVersions(clientId);
      expect(versionCountAfter).toBe(1);
    });

    it('should handle mixed metadata and config updates', async () => {
      const versionCountBefore = await storage.countVersions(clientId);
      expect(versionCountBefore).toBe(1);

      await storage.update({
        id: clientId,
        metadata: { key3: 'val3' }, // metadata update
        name: 'Mixed Update Name', // config update
        servers: sampleStdioServer, // config update
      });

      // No new version created — update() no longer creates versions
      const versionCountAfter = await storage.countVersions(clientId);
      expect(versionCountAfter).toBe(1);

      const client = await storage.getById(clientId);
      expect(client!.metadata).toEqual({
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
        mcpClientId: clientId,
        versionNumber: 2,
        name: 'Version 2',
        servers: sampleStdioServer,
        changedFields: ['name', 'servers'],
        changeMessage: 'Updated to v2',
      });

      const result = await storage.update({
        id: clientId,
        activeVersionId: versionId,
      });

      // Status remains 'draft' — the handler manages status changes, not the storage layer
      expect(result.status).toBe('draft');
      expect(result.activeVersionId).toBe(versionId);
    });

    it('should throw for non-existent client', async () => {
      await expect(storage.update({ id: 'nonexistent', name: 'Nope' })).rejects.toThrow(
        'MCP client with id nonexistent not found',
      );
    });

    it('should not create new version when config values have not actually changed', async () => {
      const versionCountBefore = await storage.countVersions(clientId);
      expect(versionCountBefore).toBe(1);

      // Update with the same values
      await storage.update({
        id: clientId,
        name: 'Original Name',
        servers: sampleServers,
      });

      // No new version should be created since values are identical
      const versionCountAfter = await storage.countVersions(clientId);
      expect(versionCountAfter).toBe(1);
    });
  });

  // ==========================================================================
  // delete
  // ==========================================================================

  describe('delete', () => {
    it('should cascade delete all versions', async () => {
      await storage.create({
        mcpClient: { id: 'del-client', name: 'To Delete', servers: sampleServers },
      });

      // Create extra versions
      await storage.createVersion({
        id: 'v2',
        mcpClientId: 'del-client',
        versionNumber: 2,
        name: 'V2',
        servers: sampleStdioServer,
        changedFields: ['name', 'servers'],
        changeMessage: 'v2',
      });

      expect(await storage.countVersions('del-client')).toBe(2);

      await storage.delete('del-client');

      expect(await storage.getById('del-client')).toBeNull();
      expect(await storage.countVersions('del-client')).toBe(0);
    });

    it('should be idempotent (no error for non-existent client)', async () => {
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
          mcpClient: {
            id: `mcp-${i}`,
            name: `Client ${i}`,
            servers: sampleServers,
            authorId: i <= 3 ? 'author-a' : 'author-b',
            metadata: { index: i },
          },
        });
        // Stagger creation times slightly
        await new Promise(r => setTimeout(r, 5));
      }
    });

    it('should return all clients with default pagination', async () => {
      const result = await storage.list({ status: 'draft' });
      expect(result.mcpClients).toHaveLength(5);
      expect(result.total).toBe(5);
      expect(result.page).toBe(0);
    });

    it('should filter by authorId', async () => {
      const result = await storage.list({ authorId: 'author-a', status: 'draft' });
      expect(result.mcpClients).toHaveLength(3);
      result.mcpClients.forEach(c => {
        expect(c.authorId).toBe('author-a');
      });
    });

    it('should filter by metadata (AND logic)', async () => {
      const result = await storage.list({ metadata: { index: 3 }, status: 'draft' });
      expect(result.mcpClients).toHaveLength(1);
      expect(result.mcpClients[0]!.id).toBe('mcp-3');
    });

    it('should support pagination', async () => {
      const page0 = await storage.list({ page: 0, perPage: 2, status: 'draft' });
      expect(page0.mcpClients).toHaveLength(2);
      expect(page0.hasMore).toBe(true);
      expect(page0.total).toBe(5);

      const page1 = await storage.list({ page: 1, perPage: 2, status: 'draft' });
      expect(page1.mcpClients).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await storage.list({ page: 2, perPage: 2, status: 'draft' });
      expect(page2.mcpClients).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });

    it('should return empty result when no match', async () => {
      const result = await storage.list({ authorId: 'nonexistent-author' });
      expect(result.mcpClients).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should sort by createdAt DESC by default', async () => {
      const result = await storage.list({ status: 'draft' });
      const ids = result.mcpClients.map(c => c.id);
      // DESC means newest first
      expect(ids[0]).toBe('mcp-5');
      expect(ids[4]).toBe('mcp-1');
    });

    it('should sort by createdAt ASC when specified', async () => {
      const result = await storage.list({
        orderBy: { field: 'createdAt', direction: 'ASC' },
        status: 'draft',
      });
      const ids = result.mcpClients.map(c => c.id);
      expect(ids[0]).toBe('mcp-1');
      expect(ids[4]).toBe('mcp-5');
    });
  });

  // ==========================================================================
  // listResolved
  // ==========================================================================

  describe('listResolved', () => {
    it('should return resolved clients with merged config', async () => {
      await storage.create({
        mcpClient: { id: 'mcp-1', name: 'Client One', servers: sampleServers },
      });
      await storage.create({
        mcpClient: { id: 'mcp-2', name: 'Client Two', servers: sampleStdioServer },
      });

      const result = await storage.listResolved({ status: 'draft' });
      expect(result.mcpClients).toHaveLength(2);

      // Each resolved client should have both thin record fields and snapshot fields
      for (const client of result.mcpClients) {
        expect(client.id).toBeDefined();
        expect(client.status).toBeDefined();
        expect(client.name).toBeDefined();
        expect(client.servers).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Version CRUD
  // ==========================================================================

  describe('version methods', () => {
    const clientId = 'versioned-client';

    beforeEach(async () => {
      await storage.create({
        mcpClient: { id: clientId, name: 'V1', servers: sampleServers },
      });
    });

    it('should create and retrieve version by ID', async () => {
      const v2 = await storage.createVersion({
        id: 'v2-uuid',
        mcpClientId: clientId,
        versionNumber: 2,
        name: 'V2',
        servers: sampleStdioServer,
        changedFields: ['name', 'servers'],
        changeMessage: 'Updated to v2',
      });

      expect(v2.id).toBe('v2-uuid');
      expect(v2.mcpClientId).toBe(clientId);
      expect(v2.versionNumber).toBe(2);
      expect(v2.createdAt).toBeInstanceOf(Date);

      const fetched = await storage.getVersion('v2-uuid');
      expect(fetched).not.toBeNull();
      expect(fetched!.name).toBe('V2');
      expect(fetched!.servers).toEqual(sampleStdioServer);
      expect(fetched!.changedFields).toEqual(['name', 'servers']);
      expect(fetched!.changeMessage).toBe('Updated to v2');
    });

    it('should return null for non-existent version', async () => {
      expect(await storage.getVersion('nonexistent')).toBeNull();
    });

    it('should throw when creating version with duplicate ID', async () => {
      const existingVersion = await storage.getLatestVersion(clientId);
      await expect(
        storage.createVersion({
          id: existingVersion!.id,
          mcpClientId: clientId,
          versionNumber: 2,
          name: 'Dup',
          servers: sampleServers,
        }),
      ).rejects.toThrow('already exists');
    });

    it('should throw when creating version with duplicate versionNumber', async () => {
      await expect(
        storage.createVersion({
          id: 'new-id',
          mcpClientId: clientId,
          versionNumber: 1, // already exists
          name: 'Dup',
          servers: sampleServers,
        }),
      ).rejects.toThrow('Version number 1 already exists');
    });

    it('should get version by client ID and version number', async () => {
      const version = await storage.getVersionByNumber(clientId, 1);
      expect(version).not.toBeNull();
      expect(version!.name).toBe('V1');
      expect(version!.versionNumber).toBe(1);
    });

    it('should return null for non-existent version number', async () => {
      const version = await storage.getVersionByNumber(clientId, 999);
      expect(version).toBeNull();
    });

    it('should get latest version', async () => {
      await storage.createVersion({
        id: 'v2-id',
        mcpClientId: clientId,
        versionNumber: 2,
        name: 'V2',
        servers: sampleServers,
      });
      await storage.createVersion({
        id: 'v3-id',
        mcpClientId: clientId,
        versionNumber: 3,
        name: 'V3',
        servers: sampleStdioServer,
      });

      const latest = await storage.getLatestVersion(clientId);
      expect(latest).not.toBeNull();
      expect(latest!.versionNumber).toBe(3);
      expect(latest!.name).toBe('V3');
    });

    it('should return null for latest version of non-existent client', async () => {
      const latest = await storage.getLatestVersion('nonexistent');
      expect(latest).toBeNull();
    });

    it('should list versions with pagination', async () => {
      await storage.createVersion({
        id: 'v2-id',
        mcpClientId: clientId,
        versionNumber: 2,
        name: 'V2',
        servers: sampleServers,
      });
      await storage.createVersion({
        id: 'v3-id',
        mcpClientId: clientId,
        versionNumber: 3,
        name: 'V3',
        servers: sampleServers,
      });

      const all = await storage.listVersions({ mcpClientId: clientId, perPage: false });
      expect(all.versions).toHaveLength(3);
      expect(all.total).toBe(3);

      // Default sort is versionNumber DESC
      expect(all.versions[0]!.versionNumber).toBe(3);
      expect(all.versions[2]!.versionNumber).toBe(1);

      const page0 = await storage.listVersions({ mcpClientId: clientId, page: 0, perPage: 2 });
      expect(page0.versions).toHaveLength(2);
      expect(page0.hasMore).toBe(true);

      const page1 = await storage.listVersions({ mcpClientId: clientId, page: 1, perPage: 2 });
      expect(page1.versions).toHaveLength(1);
      expect(page1.hasMore).toBe(false);
    });

    it('should list versions sorted by versionNumber ASC', async () => {
      await storage.createVersion({
        id: 'v2-id',
        mcpClientId: clientId,
        versionNumber: 2,
        name: 'V2',
        servers: sampleServers,
      });

      const result = await storage.listVersions({
        mcpClientId: clientId,
        orderBy: { field: 'versionNumber', direction: 'ASC' },
      });
      expect(result.versions[0]!.versionNumber).toBe(1);
      expect(result.versions[1]!.versionNumber).toBe(2);
    });

    it('should delete a single version', async () => {
      const v2 = await storage.createVersion({
        id: 'v2-del',
        mcpClientId: clientId,
        versionNumber: 2,
        name: 'V2',
        servers: sampleServers,
      });

      expect(await storage.countVersions(clientId)).toBe(2);
      await storage.deleteVersion(v2.id);
      expect(await storage.countVersions(clientId)).toBe(1);
      expect(await storage.getVersion('v2-del')).toBeNull();
    });

    it('should delete all versions by client ID', async () => {
      await storage.createVersion({
        id: 'v2-id',
        mcpClientId: clientId,
        versionNumber: 2,
        name: 'V2',
        servers: sampleServers,
      });

      expect(await storage.countVersions(clientId)).toBe(2);
      await storage.deleteVersionsByParentId(clientId);
      expect(await storage.countVersions(clientId)).toBe(0);
    });

    it('should count versions correctly', async () => {
      expect(await storage.countVersions(clientId)).toBe(1);

      await storage.createVersion({
        id: 'v2-id',
        mcpClientId: clientId,
        versionNumber: 2,
        name: 'V2',
        servers: sampleServers,
      });

      expect(await storage.countVersions(clientId)).toBe(2);
      expect(await storage.countVersions('nonexistent')).toBe(0);
    });
  });

  // ==========================================================================
  // dangerouslyClearAll
  // ==========================================================================

  describe('dangerouslyClearAll', () => {
    it('should clear all MCP clients and versions', async () => {
      await storage.create({
        mcpClient: { id: 'mcp-1', name: 'C1', servers: sampleServers },
      });
      await storage.create({
        mcpClient: { id: 'mcp-2', name: 'C2', servers: sampleStdioServer },
      });

      expect(db.mcpClients.size).toBe(2);
      expect(db.mcpClientVersions.size).toBe(2); // one version per client

      await storage.dangerouslyClearAll();

      expect(db.mcpClients.size).toBe(0);
      expect(db.mcpClientVersions.size).toBe(0);
    });
  });
});
