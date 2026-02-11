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

    it('should create new version when updating config fields', async () => {
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

      // New version created
      const versionCountAfter = await storage.countVersions(agentId);
      expect(versionCountAfter).toBe(2);

      // Verify config via resolved method
      const resolved = await storage.getByIdResolved(agentId);
      expect(resolved?.name).toBe('Updated Name');
      expect(resolved?.instructions).toBe('Updated instructions');
    });

    it('should handle mixed metadata and config updates', async () => {
      const versionCountBefore = await storage.countVersions(agentId);
      expect(versionCountBefore).toBe(1);

      await storage.update({
        id: agentId,
        metadata: { key3: 'value3' }, // metadata update
        name: 'Mixed Update Name', // config update
        model: { provider: 'anthropic', name: 'claude-3' }, // config update
      });

      // Should create new version for config changes
      const versionCountAfter = await storage.countVersions(agentId);
      expect(versionCountAfter).toBe(2);

      const agent = await storage.getById(agentId);
      expect(agent?.metadata).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      });

      const resolved = await storage.getByIdResolved(agentId);
      expect(resolved?.name).toBe('Mixed Update Name');
      expect(resolved?.model).toEqual({ provider: 'anthropic', name: 'claude-3' });
    });

    it('should set status=published when activeVersionId is updated', async () => {
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

      expect(result.status).toBe('published');
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
