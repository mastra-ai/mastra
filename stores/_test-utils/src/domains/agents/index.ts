import type { MastraStorage, AgentsStorage } from '@mastra/core/storage';
import { createSampleAgent, createFullSampleAgent, createSampleAgents } from './data';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

export function createAgentsTests({ storage }: { storage: MastraStorage }) {
  // Skip tests if storage doesn't have agents domain
  const describeAgents = storage.stores?.agents ? describe : describe.skip;

  let agentsStorage: AgentsStorage;

  describeAgents('Agents Storage', () => {
    beforeAll(async () => {
      const store = await storage.getStore('agents');
      if (!store) {
        throw new Error('Agents storage not found');
      }
      agentsStorage = store;

      const start = Date.now();
      console.log('Clearing agents domain data before tests');
      await agentsStorage.dangerouslyClearAll();
      const end = Date.now();
      console.log(`Agents domain cleared in ${end - start}ms`);
    });

    describe('create', () => {
      it('should create and retrieve an agent', async () => {
        const agent = createSampleAgent();

        // create returns thin record (no config fields)
        const savedAgent = await agentsStorage.create({ agent });

        expect(savedAgent.id).toBe(agent.id);
        expect(savedAgent.status).toBe('draft'); // New behavior: starts as draft
        expect([null, undefined]).toContain(savedAgent.activeVersionId);
        expect(savedAgent.createdAt).toBeInstanceOf(Date);
        expect(savedAgent.updatedAt).toBeInstanceOf(Date);

        // Config is accessible via getByIdResolved (falls back to latest version)
        const resolved = await agentsStorage.getByIdResolved(agent.id);
        expect(resolved).toBeDefined();
        expect(resolved?.name).toBe(agent.name);
        expect(resolved?.instructions).toBe(agent.instructions);
        expect(resolved?.model).toEqual(agent.model);

        // Verify version 1 was created
        const versionCount = await agentsStorage.countVersions(agent.id);
        expect(versionCount).toBe(1);
      });

      it('should create agent with all optional fields', async () => {
        const agent = createFullSampleAgent();

        const savedAgent = await agentsStorage.create({ agent });

        expect(savedAgent.id).toBe(agent.id);
        expect(savedAgent.metadata).toEqual(agent.metadata);

        // All config fields are accessible via resolved agent
        const resolved = await agentsStorage.getByIdResolved(agent.id);
        expect(resolved).toBeDefined();
        expect(resolved?.name).toBe(agent.name);
        expect(resolved?.description).toBe(agent.description);
        expect(resolved?.instructions).toBe(agent.instructions);
        expect(resolved?.model).toEqual(agent.model);
        expect(resolved?.tools).toEqual(agent.tools);
        expect(resolved?.defaultOptions).toEqual(agent.defaultOptions);
        expect(resolved?.workflows).toEqual(agent.workflows);
        expect(resolved?.agents).toEqual(agent.agents);
        expect(resolved?.inputProcessors).toEqual(agent.inputProcessors);
        expect(resolved?.outputProcessors).toEqual(agent.outputProcessors);
        expect(resolved?.memory).toEqual(agent.memory);
        expect(resolved?.scorers).toEqual(agent.scorers);
        expect(resolved?.requestContextSchema).toEqual(agent.requestContextSchema);
        expect(resolved?.metadata).toEqual(agent.metadata);
      });

      it('should handle agents with minimal required fields', async () => {
        const minimalAgent = createSampleAgent({
          name: 'Minimal Agent',
          instructions: 'Minimal instructions',
          model: { provider: 'openai', name: 'gpt-4' },
        });

        const savedAgent = await agentsStorage.create({ agent: minimalAgent });

        expect(savedAgent.id).toBe(minimalAgent.id);

        const resolved = await agentsStorage.getByIdResolved(minimalAgent.id);
        expect(resolved?.name).toBe('Minimal Agent');
        expect([null, undefined]).toContain(resolved?.description);
        expect(resolved?.tools).toBeUndefined();
      });
    });

    describe('getById', () => {
      it('should return null for non-existent agent', async () => {
        const result = await agentsStorage.getById('non-existent-agent');
        expect(result).toBeNull();
      });

      it('should retrieve an existing agent by ID (thin record)', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });

        const retrievedAgent = await agentsStorage.getById(agent.id);

        expect(retrievedAgent).toBeDefined();
        expect(retrievedAgent?.id).toBe(agent.id);
        expect(retrievedAgent?.status).toBe('draft'); // New behavior
        // Different stores may use null or undefined for activeVersionId
        expect([null, undefined]).toContain(retrievedAgent?.activeVersionId); // New behavior

        // Verify thin record has no config fields
        expect((retrievedAgent as any)?.name).toBeUndefined();
        expect((retrievedAgent as any)?.instructions).toBeUndefined();
        expect((retrievedAgent as any)?.model).toBeUndefined();
      });
    });

    describe('getByIdResolved', () => {
      it('should return null for non-existent agent', async () => {
        const result = await agentsStorage.getByIdResolved('non-existent-agent');
        expect(result).toBeNull();
      });

      it('should return agent with config from active version', async () => {
        const agent = createSampleAgent({
          name: 'Resolved Agent',
          instructions: 'Resolve me',
        });
        const created = await agentsStorage.create({ agent });

        // Set an active version
        const versionId = randomUUID();
        await agentsStorage.createVersion({
          id: versionId,
          agentId: agent.id,
          versionNumber: 2,
          name: 'Active Version',
          instructions: 'Active instructions',
          model: agent.model,
          changedFields: ['name', 'instructions'],
          changeMessage: 'Activated version',
        });

        await agentsStorage.update({
          id: agent.id,
          activeVersionId: versionId,
        });

        const resolved = await agentsStorage.getByIdResolved(agent.id);

        expect(resolved).toBeDefined();
        expect(resolved?.id).toBe(agent.id);
        expect(resolved?.name).toBe('Active Version'); // From active version
        expect(resolved?.instructions).toBe('Active instructions');
      });

      it('should fall back to latest version when no active version is set', async () => {
        const agent = createSampleAgent({
          name: 'Initial Name',
          instructions: 'Initial instructions',
        });
        await agentsStorage.create({ agent });

        // Create version 2
        await agentsStorage.createVersion({
          id: randomUUID(),
          agentId: agent.id,
          versionNumber: 2,
          name: 'Version 2',
          instructions: 'Version 2 instructions',
          model: agent.model,
          changedFields: ['name', 'instructions'],
          changeMessage: 'Second version',
        });

        // Create version 3 (latest)
        await agentsStorage.createVersion({
          id: randomUUID(),
          agentId: agent.id,
          versionNumber: 3,
          name: 'Latest Version',
          instructions: 'Latest instructions',
          model: agent.model,
          changedFields: ['name', 'instructions'],
          changeMessage: 'Third version',
        });

        const resolved = await agentsStorage.getByIdResolved(agent.id);

        expect(resolved).toBeDefined();
        expect(resolved?.id).toBe(agent.id);
        expect(resolved?.name).toBe('Latest Version'); // Falls back to latest
        expect(resolved?.instructions).toBe('Latest instructions');
      });
    });

    describe('update', () => {
      it('should update agent metadata without creating new version', async () => {
        const agent = createSampleAgent({
          metadata: { key1: 'value1', key2: 'value2' },
        });
        await agentsStorage.create({ agent });

        const versionCountBefore = await agentsStorage.countVersions(agent.id);
        expect(versionCountBefore).toBe(1);

        const updatedAgent = await agentsStorage.update({
          id: agent.id,
          metadata: { key2: 'updated', key3: 'value3' },
        });

        const refreshed = await agentsStorage.getById(agent.id);
        expect(refreshed?.metadata?.key2).toBe('updated');
        expect(refreshed?.metadata?.key3).toBe('value3');

        // Note: For InMemory adapter, metadata is MERGED
        // For DB adapters (PG, MongoDB, LibSQL), metadata is REPLACED
        // This test will need to be adapter-specific or check both behaviors
        const versionCountAfter = await agentsStorage.countVersions(agent.id);
        expect(versionCountAfter).toBe(1); // No new version for metadata update
      });

      it('should not create new version when updating config fields (versioning handled by server)', async () => {
        const agent = createSampleAgent({
          name: 'Original Name',
          instructions: 'Original instructions',
        });
        await agentsStorage.create({ agent });

        const versionCountBefore = await agentsStorage.countVersions(agent.id);
        expect(versionCountBefore).toBe(1);

        // Update config fields
        const updatedAgent = await agentsStorage.update({
          id: agent.id,
          name: 'Updated Name',
          instructions: 'Updated instructions',
        });

        // Agent status and activeVersionId should remain unchanged
        expect(updatedAgent.status).toBe('draft');
        expect([null, undefined]).toContain(updatedAgent.activeVersionId);

        const versionCountAfter = await agentsStorage.countVersions(agent.id);
        expect(versionCountAfter).toBe(1); // No new version - versioning is handled by server's handleAutoVersioning

        // Config fields are NOT updated by storage.update() — they remain in the original version
        const resolved = await agentsStorage.getByIdResolved(agent.id);
        expect(resolved?.name).toBe('Original Name');
        expect(resolved?.instructions).toBe('Original instructions');
      });

      it('should update activeVersionId while keeping status draft', async () => {
        const agent = createSampleAgent();
        const created = await agentsStorage.create({ agent });
        const originalVersionId = created.activeVersionId;

        // Create a second version
        const versionId = randomUUID();
        await agentsStorage.createVersion({
          id: versionId,
          agentId: agent.id,
          versionNumber: 2,
          name: 'Updated Agent',
          instructions: 'Updated instructions',
          model: { provider: 'openai', name: 'gpt-4' },
          changedFields: ['name', 'instructions'],
          changeMessage: 'Test update',
        });

        const updatedAgent = await agentsStorage.update({
          id: agent.id,
          activeVersionId: versionId,
        });

        expect(updatedAgent.activeVersionId).toBe(versionId);
        // Status should remain as 'draft' - publishing is a separate operation
        expect(updatedAgent.status).toBe('draft');
        expect(updatedAgent.activeVersionId).not.toBe(originalVersionId);
      });

      it('should update updatedAt timestamp', async () => {
        const agent = createSampleAgent();
        const createdAgent = await agentsStorage.create({ agent });
        const originalUpdatedAt = createdAgent.updatedAt;

        // Wait a small amount to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 10));

        const updatedAgent = await agentsStorage.update({
          id: agent.id,
          metadata: { trigger: 'timestamp-update' },
        });

        const updatedAtTime =
          updatedAgent.updatedAt instanceof Date
            ? updatedAgent.updatedAt.getTime()
            : new Date(updatedAgent.updatedAt).getTime();

        const originalTime =
          originalUpdatedAt instanceof Date ? originalUpdatedAt.getTime() : new Date(originalUpdatedAt).getTime();

        expect(updatedAtTime).toBeGreaterThan(originalTime);
      });
    });

    describe('delete', () => {
      it('should delete an existing agent and all its versions', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });

        // Create additional versions
        await agentsStorage.createVersion({
          id: randomUUID(),
          agentId: agent.id,
          versionNumber: 2,
          name: 'Version 2',
          instructions: 'Version 2 instructions',
          model: agent.model,
          changedFields: ['name', 'instructions'],
          changeMessage: 'Second version',
        });

        // Verify agent and versions exist
        const beforeDelete = await agentsStorage.getById(agent.id);
        expect(beforeDelete).toBeDefined();
        const versionCountBefore = await agentsStorage.countVersions(agent.id);
        expect(versionCountBefore).toBe(2);

        // Delete
        await agentsStorage.delete(agent.id);

        // Verify agent and versions are gone
        const afterDelete = await agentsStorage.getById(agent.id);
        expect(afterDelete).toBeNull();
        const versionCountAfter = await agentsStorage.countVersions(agent.id);
        expect(versionCountAfter).toBe(0); // All versions deleted
      });

      it('should be idempotent when deleting non-existent agent', async () => {
        // Deleting a non-existent agent should not throw - it's a no-op
        await expect(agentsStorage.delete('non-existent-agent-id')).resolves.toBeUndefined();
      });

      it('should be idempotent when deleting same agent twice', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });

        // First delete
        await agentsStorage.delete(agent.id);

        // Second delete should not throw
        await expect(agentsStorage.delete(agent.id)).resolves.toBeUndefined();
      });
    });

    describe('list', () => {
      beforeEach(async () => {
        await agentsStorage.dangerouslyClearAll();
      });

      it('should return empty list when no agents exist', async () => {
        const result = await agentsStorage.list();

        expect(result.agents).toHaveLength(0);
        expect(result.total).toBe(0);
        expect(result.hasMore).toBe(false);
      });

      it('should list all agents with default pagination', async () => {
        const agents = createSampleAgents(5);
        for (const agent of agents) {
          await agentsStorage.create({ agent });
        }

        const result = await agentsStorage.list({ status: 'draft' });

        expect(result.agents.length).toBe(5);
        expect(result.total).toBe(5);
        expect(result.hasMore).toBe(false);
      });

      it('should paginate results correctly', async () => {
        const agents = createSampleAgents(15);
        for (const agent of agents) {
          await agentsStorage.create({ agent });
        }

        const page1 = await agentsStorage.list({ status: 'draft', page: 0, perPage: 5 });
        expect(page1.agents.length).toBe(5);
        expect(page1.total).toBe(15);
        expect(page1.page).toBe(0);
        expect(page1.perPage).toBe(5);
        expect(page1.hasMore).toBe(true);

        const page2 = await agentsStorage.list({ status: 'draft', page: 1, perPage: 5 });
        expect(page2.agents.length).toBe(5);
        expect(page2.page).toBe(1);
        expect(page2.hasMore).toBe(true);

        const page3 = await agentsStorage.list({ status: 'draft', page: 2, perPage: 5 });
        expect(page3.agents.length).toBe(5);
        expect(page3.hasMore).toBe(false);
      });

      it('should return all agents when perPage is false', async () => {
        const agents = createSampleAgents(10);
        for (const agent of agents) {
          await agentsStorage.create({ agent });
        }

        const result = await agentsStorage.list({ status: 'draft', perPage: false });

        expect(result.agents.length).toBe(10);
        expect(result.perPage).toBe(false);
        expect(result.hasMore).toBe(false);
      });

      it('should sort agents by createdAt DESC by default', async () => {
        // Create agents with small delays to ensure different timestamps
        const agent1 = createSampleAgent({ name: 'First Agent' });
        await agentsStorage.create({ agent: agent1 });
        await new Promise(resolve => setTimeout(resolve, 10));

        const agent2 = createSampleAgent({ name: 'Second Agent' });
        await agentsStorage.create({ agent: agent2 });
        await new Promise(resolve => setTimeout(resolve, 10));

        const agent3 = createSampleAgent({ name: 'Third Agent' });
        await agentsStorage.create({ agent: agent3 });

        // list returns thin records; use listResolved for names
        const result = await agentsStorage.listResolved({ status: 'draft' });

        // Default sort is DESC, so newest first
        expect(result.agents[0]?.name).toBe('Third Agent');
        expect(result.agents[2]?.name).toBe('First Agent');
      });

      it('should sort agents by createdAt ASC when specified', async () => {
        // Create agents with small delays
        const agent1 = createSampleAgent({ name: 'First Agent' });
        await agentsStorage.create({ agent: agent1 });
        await new Promise(resolve => setTimeout(resolve, 10));

        const agent2 = createSampleAgent({ name: 'Second Agent' });
        await agentsStorage.create({ agent: agent2 });
        await new Promise(resolve => setTimeout(resolve, 10));

        const agent3 = createSampleAgent({ name: 'Third Agent' });
        await agentsStorage.create({ agent: agent3 });

        const result = await agentsStorage.listResolved({
          status: 'draft',
          orderBy: { field: 'createdAt', direction: 'ASC' },
        });

        // ASC sort, so oldest first
        expect(result.agents[0]?.name).toBe('First Agent');
        expect(result.agents[2]?.name).toBe('Third Agent');
      });
    });

    describe('Edge Cases and Error Handling', () => {
      it('should handle large model configurations', async () => {
        const agent = createSampleAgent({
          model: {
            provider: 'openai',
            name: 'gpt-4',
            temperature: 0.7,
            maxTokens: 4000,
            topP: 0.9,
            frequencyPenalty: 0.5,
            presencePenalty: 0.5,
            customConfig: {
              nested: {
                deeply: {
                  value: 'test',
                },
              },
            },
          },
        });

        await agentsStorage.create({ agent });
        const resolved = await agentsStorage.getByIdResolved(agent.id);

        expect(resolved?.model).toEqual(agent.model);
      });

      it('should handle special characters in instructions', async () => {
        const specialInstructions = `You are a helpful assistant.
        Handle these characters: 'quotes' and "double quotes" and emoji 🎉
        Also: <html> tags & ampersands
        And unicode: こんにちは`;

        const agent = createSampleAgent({
          instructions: specialInstructions,
        });

        await agentsStorage.create({ agent });
        const resolved = await agentsStorage.getByIdResolved(agent.id);

        expect(resolved?.instructions).toBe(specialInstructions);
      });

      it('should handle large metadata objects', async () => {
        const largeMetadata = {
          tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`),
          config: {
            nested: {
              array: Array.from({ length: 20 }, (_, i) => ({ index: i, data: 'test'.repeat(10) })),
            },
          },
        };

        const agent = createSampleAgent({
          metadata: largeMetadata,
        });

        await agentsStorage.create({ agent });
        const retrievedAgent = await agentsStorage.getById(agent.id);

        expect(retrievedAgent?.metadata).toEqual(largeMetadata);
      });

      it('should handle concurrent agent metadata updates', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });

        // Perform multiple metadata updates concurrently
        const updates = Array.from({ length: 5 }, (_, i) =>
          agentsStorage.update({
            id: agent.id,
            metadata: { update: i },
          }),
        );

        await expect(Promise.all(updates)).resolves.toBeDefined();

        // Verify final state exists
        const finalAgent = await agentsStorage.getById(agent.id);
        expect(finalAgent).toBeDefined();
      });

      it('should handle mixed metadata and config updates correctly (only metadata persisted)', async () => {
        const agent = createSampleAgent({
          name: 'Initial Name',
          instructions: 'Initial instructions',
          metadata: { category: 'test' },
        });
        await agentsStorage.create({ agent });

        // Mixed update: both metadata and config fields
        const versionCountBefore = await agentsStorage.countVersions(agent.id);
        expect(versionCountBefore).toBe(1);

        await agentsStorage.update({
          id: agent.id,
          metadata: { category: 'updated', newField: 'value' }, // metadata update
          name: 'New Name', // config update — ignored by storage, handled by server
          instructions: 'New instructions', // config update — ignored by storage, handled by server
        });

        // No new version — versioning is handled by server's handleAutoVersioning
        const versionCountAfter = await agentsStorage.countVersions(agent.id);
        expect(versionCountAfter).toBe(1);

        // Config fields remain unchanged (from initial version)
        const resolved = await agentsStorage.getByIdResolved(agent.id);
        expect(resolved?.name).toBe('Initial Name');
        expect(resolved?.instructions).toBe('Initial instructions');
        // Note: metadata merge/replace behavior is adapter-specific
      });

      it('should handle tools configuration', async () => {
        const tools = { calculator: {}, webSearch: {}, codeInterpreter: {} };

        const agent = createSampleAgent({ tools });

        await agentsStorage.create({ agent });
        const resolved = await agentsStorage.getByIdResolved(agent.id);

        expect(resolved?.tools).toEqual(tools);
      });
    });
  });
}
