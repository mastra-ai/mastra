import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDB } from '../inmemory-db';
import { InMemoryAgentsStorage } from './inmemory';

describe('InMemoryAgentsStorage - Stored Agents Feature', () => {
  let db: InMemoryDB;
  let storage: InMemoryAgentsStorage;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new InMemoryAgentsStorage({ db });
  });

  describe('create', () => {
    it('should create agent with status=draft and activeVersionId=undefined', async () => {
      const agentId = 'test-agent-1';
      const result = await storage.create({
        agent: {
          id: agentId,
          authorId: 'user-123',
          metadata: { category: 'test' },
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: { provider: 'openai', name: 'gpt-4' },
        },
      });

      // Thin record returned
      expect(result.id).toBe(agentId);
      expect(result.status).toBe('draft');
      expect(result.activeVersionId).toBeUndefined();
      expect(result.authorId).toBe('user-123');
      expect(result.metadata).toEqual({ category: 'test' });

      // Verify version 1 was created
      const versionCount = await storage.countVersions(agentId);
      expect(versionCount).toBe(1);

      // Verify config is accessible via resolved method
      const resolved = await storage.getByIdResolved(agentId);
      expect(resolved?.name).toBe('Test Agent');
      expect(resolved?.instructions).toBe('You are a helpful assistant');
    });
  });

  describe('update', () => {
    let agentId: string;

    beforeEach(async () => {
      agentId = 'test-agent-update';
      await storage.create({
        agent: {
          id: agentId,
          authorId: 'user-123',
          metadata: { key1: 'value1', key2: 'value2' },
          name: 'Original Name',
          instructions: 'Original instructions',
          model: { provider: 'openai', name: 'gpt-3.5' },
        },
      });
    });

    it('should update metadata without creating new version', async () => {
      const versionCountBefore = await storage.countVersions(agentId);
      expect(versionCountBefore).toBe(1);

      const result = await storage.update({
        id: agentId,
        metadata: { key2: 'updated', key3: 'value3' },
      });

      // Metadata should be MERGED for InMemory adapter
      expect(result.metadata).toEqual({
        key1: 'value1',
        key2: 'updated',
        key3: 'value3',
      });

      // No new version created
      const versionCountAfter = await storage.countVersions(agentId);
      expect(versionCountAfter).toBe(1);
    });

    it('should not create version when updating config fields (handler responsibility)', async () => {
      const versionCountBefore = await storage.countVersions(agentId);
      expect(versionCountBefore).toBe(1);

      const result = await storage.update({
        id: agentId,
        name: 'Updated Name',
        instructions: 'Updated instructions',
      });

      // Status and activeVersionId unchanged
      expect(result.status).toBe('draft');
      expect(result.activeVersionId).toBeUndefined();

      // No new version created — update() only handles metadata fields
      const versionCountAfter = await storage.countVersions(agentId);
      expect(versionCountAfter).toBe(1);

      // Config still shows original values since no version was created
      const resolved = await storage.getByIdResolved(agentId);
      expect(resolved?.name).toBe('Original Name');
      expect(resolved?.instructions).toBe('Original instructions');
    });

    it('should handle mixed metadata and config updates (config fields ignored)', async () => {
      const versionCountBefore = await storage.countVersions(agentId);
      expect(versionCountBefore).toBe(1);

      await storage.update({
        id: agentId,
        metadata: { key3: 'value3' }, // metadata update
        name: 'Mixed Update Name', // config update — ignored by update()
        model: { provider: 'anthropic', name: 'claude-3' }, // config update — ignored by update()
      });

      // No new version created — config fields are ignored by update()
      const versionCountAfter = await storage.countVersions(agentId);
      expect(versionCountAfter).toBe(1);

      // Metadata should still be merged
      const agent = await storage.getById(agentId);
      expect(agent?.metadata).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      });
    });

    it('should not auto-publish when activeVersionId is updated', async () => {
      // Create a second version
      const versionId = 'version-2';
      await storage.createVersion({
        id: versionId,
        agentId,
        versionNumber: 2,
        name: 'Version 2',
        instructions: 'Version 2 instructions',
        model: { provider: 'openai', name: 'gpt-4' },
        changedFields: ['name', 'instructions'],
        changeMessage: 'Updated to v2',
      });

      const result = await storage.update({
        id: agentId,
        activeVersionId: versionId,
      });

      // Auto-publish was removed — status stays as 'draft'
      expect(result.status).toBe('draft');
      expect(result.activeVersionId).toBe(versionId);
    });
  });

  describe('getByIdResolved', () => {
    it('should fall back to latest version when activeVersionId is undefined', async () => {
      const agentId = 'test-fallback';
      await storage.create({
        agent: {
          id: agentId,
          authorId: 'user-123',
          name: 'Version 1 Name',
          instructions: 'Version 1 instructions',
          model: { provider: 'openai', name: 'gpt-3.5' },
        },
      });

      // Create more versions
      await storage.createVersion({
        id: 'v2',
        agentId,
        versionNumber: 2,
        name: 'Version 2 Name',
        instructions: 'Version 2 instructions',
        model: { provider: 'openai', name: 'gpt-3.5' },
        changedFields: ['name', 'instructions'],
        changeMessage: 'v2',
      });

      await storage.createVersion({
        id: 'v3',
        agentId,
        versionNumber: 3,
        name: 'Latest Version Name',
        instructions: 'Latest instructions',
        model: { provider: 'openai', name: 'gpt-4' },
        changedFields: ['name', 'instructions', 'model'],
        changeMessage: 'v3',
      });

      const resolved = await storage.getByIdResolved(agentId);
      expect(resolved?.name).toBe('Latest Version Name');
      expect(resolved?.model.name).toBe('gpt-4');
    });

    it('should use active version when set', async () => {
      const agentId = 'test-active';
      await storage.create({
        agent: {
          id: agentId,
          authorId: 'user-123',
          name: 'Version 1',
          instructions: 'V1 instructions',
          model: { provider: 'openai', name: 'gpt-3.5' },
        },
      });

      // Create and set active version
      const activeVersionId = 'active-version';
      await storage.createVersion({
        id: activeVersionId,
        agentId,
        versionNumber: 2,
        name: 'Active Version',
        instructions: 'Active instructions',
        model: { provider: 'openai', name: 'gpt-4' },
        changedFields: ['name', 'instructions', 'model'],
        changeMessage: 'Active version',
      });

      await storage.update({
        id: agentId,
        activeVersionId,
      });

      const resolved = await storage.getByIdResolved(agentId);
      expect(resolved?.name).toBe('Active Version');
      expect(resolved?.instructions).toBe('Active instructions');
    });
  });

  describe('requestContextSchema persistence', () => {
    it('should persist requestContextSchema through create and resolve', async () => {
      const agentId = 'test-rcs-create';
      const schema = {
        type: 'object',
        properties: {
          tenantId: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'user'] },
        },
        required: ['tenantId'],
      };

      await storage.create({
        agent: {
          id: agentId,
          name: 'RCS Agent',
          instructions: 'You are a helpful assistant',
          model: { provider: 'openai', name: 'gpt-4' },
          requestContextSchema: schema,
        },
      });

      const resolved = await storage.getByIdResolved(agentId);
      expect(resolved?.requestContextSchema).toEqual(schema);
    });

    it('should persist requestContextSchema through createVersion and getVersion', async () => {
      const agentId = 'test-rcs-version';
      await storage.create({
        agent: {
          id: agentId,
          name: 'RCS Agent',
          instructions: 'You are a helpful assistant',
          model: { provider: 'openai', name: 'gpt-4' },
        },
      });

      const schema = {
        type: 'object',
        properties: { userId: { type: 'string' } },
      };

      const versionId = 'rcs-version-2';
      await storage.createVersion({
        id: versionId,
        agentId,
        versionNumber: 2,
        name: 'RCS Agent',
        instructions: 'Updated instructions',
        model: { provider: 'openai', name: 'gpt-4' },
        requestContextSchema: schema,
        changedFields: ['instructions', 'requestContextSchema'],
        changeMessage: 'Added requestContextSchema',
      });

      const version = await storage.getVersion(versionId);
      expect(version?.requestContextSchema).toEqual(schema);
    });

    it('should not create version for requestContextSchema in update (handler responsibility)', async () => {
      const agentId = 'test-rcs-update';
      await storage.create({
        agent: {
          id: agentId,
          name: 'RCS Agent',
          instructions: 'You are a helpful assistant',
          model: { provider: 'openai', name: 'gpt-4' },
        },
      });

      const versionCountBefore = await storage.countVersions(agentId);
      expect(versionCountBefore).toBe(1);

      const schema = {
        type: 'object',
        properties: { tenantId: { type: 'string' } },
      };

      await storage.update({
        id: agentId,
        requestContextSchema: schema,
      });

      // No new version created — update() only handles metadata fields
      const versionCountAfter = await storage.countVersions(agentId);
      expect(versionCountAfter).toBe(1);

      // requestContextSchema is a config field, so it's not reflected without a new version
      const resolved = await storage.getByIdResolved(agentId);
      expect(resolved?.requestContextSchema).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should cascade delete all versions', async () => {
      const agentId = 'test-delete';
      await storage.create({
        agent: {
          id: agentId,
          authorId: 'user-123',
          name: 'To Delete',
          instructions: 'Delete me',
          model: { provider: 'openai', name: 'gpt-3.5' },
        },
      });

      // Create additional versions
      for (let i = 2; i <= 3; i++) {
        await storage.createVersion({
          id: `v${i}`,
          agentId,
          versionNumber: i,
          name: `Version ${i}`,
          instructions: `Version ${i} instructions`,
          model: { provider: 'openai', name: 'gpt-3.5' },
          changedFields: ['name', 'instructions'],
          changeMessage: `v${i}`,
        });
      }

      // Verify agent and versions exist
      const beforeDelete = await storage.getById(agentId);
      expect(beforeDelete).toBeDefined();
      const versionsBefore = await storage.countVersions(agentId);
      expect(versionsBefore).toBe(3);

      // Delete
      await storage.delete(agentId);

      // Verify all deleted
      const afterDelete = await storage.getById(agentId);
      expect(afterDelete).toBeNull();
      const versionsAfter = await storage.countVersions(agentId);
      expect(versionsAfter).toBe(0);
    });
  });
});
