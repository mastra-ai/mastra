import type { MastraStorage, AgentsStorage } from '@mastra/core/storage';
import { createSampleAgent, createFullSampleAgent, createSampleAgents } from './data';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

export function createAgentsTests({ storage }: { storage: MastraStorage }) {
  // Skip tests if storage doesn't support agents
  const describeAgents = storage.supports.agents ? describe : describe.skip;

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

    describe('createAgent', () => {
      it('should create and retrieve an agent', async () => {
        const agent = createSampleAgent();

        const savedAgent = await agentsStorage.createAgent({ agent });

        expect(savedAgent.id).toBe(agent.id);
        expect(savedAgent.name).toBe(agent.name);
        expect(savedAgent.instructions).toBe(agent.instructions);
        expect(savedAgent.model).toEqual(agent.model);
        expect(savedAgent.createdAt).toBeInstanceOf(Date);
        expect(savedAgent.updatedAt).toBeInstanceOf(Date);

        // Retrieve and verify
        const retrievedAgent = await agentsStorage.getAgentById({ id: agent.id });
        expect(retrievedAgent).toBeDefined();
        expect(retrievedAgent?.name).toBe(agent.name);
      });

      it('should create agent with all optional fields', async () => {
        const agent = createFullSampleAgent();

        const savedAgent = await agentsStorage.createAgent({ agent });

        expect(savedAgent.id).toBe(agent.id);
        expect(savedAgent.name).toBe(agent.name);
        expect(savedAgent.description).toBe(agent.description);
        expect(savedAgent.instructions).toBe(agent.instructions);
        expect(savedAgent.model).toEqual(agent.model);
        expect(savedAgent.tools).toEqual(agent.tools);
        expect(savedAgent.defaultOptions).toEqual(agent.defaultOptions);
        expect(savedAgent.workflows).toEqual(agent.workflows);
        expect(savedAgent.agents).toEqual(agent.agents);
        expect(savedAgent.inputProcessors).toEqual(agent.inputProcessors);
        expect(savedAgent.outputProcessors).toEqual(agent.outputProcessors);
        expect(savedAgent.memory).toEqual(agent.memory);
        expect(savedAgent.scorers).toEqual(agent.scorers);
        expect(savedAgent.metadata).toEqual(agent.metadata);
      });

      it('should handle agents with minimal required fields', async () => {
        const minimalAgent = {
          id: `agent-minimal-${randomUUID()}`,
          name: 'Minimal Agent',
          instructions: 'Minimal instructions',
          model: { provider: 'openai' },
        };

        const savedAgent = await agentsStorage.createAgent({ agent: minimalAgent });

        expect(savedAgent.id).toBe(minimalAgent.id);
        expect(savedAgent.name).toBe(minimalAgent.name);
        expect(savedAgent.description).toBeUndefined();
        expect(savedAgent.tools).toBeUndefined();
      });
    });

    describe('getAgentById', () => {
      it('should return null for non-existent agent', async () => {
        const result = await agentsStorage.getAgentById({ id: 'non-existent-agent' });
        expect(result).toBeNull();
      });

      it('should retrieve an existing agent by ID', async () => {
        const agent = createSampleAgent();
        await agentsStorage.createAgent({ agent });

        const retrievedAgent = await agentsStorage.getAgentById({ id: agent.id });

        expect(retrievedAgent).toBeDefined();
        expect(retrievedAgent?.id).toBe(agent.id);
        expect(retrievedAgent?.name).toBe(agent.name);
        expect(retrievedAgent?.instructions).toBe(agent.instructions);
      });
    });

    describe('updateAgent', () => {
      it('should update agent name', async () => {
        const agent = createSampleAgent();
        await agentsStorage.createAgent({ agent });

        const updatedAgent = await agentsStorage.updateAgent({
          id: agent.id,
          name: 'Updated Agent Name',
        });

        expect(updatedAgent.name).toBe('Updated Agent Name');
        expect(updatedAgent.instructions).toBe(agent.instructions); // Unchanged

        // Verify persistence
        const retrievedAgent = await agentsStorage.getAgentById({ id: agent.id });
        expect(retrievedAgent?.name).toBe('Updated Agent Name');
      });

      it('should update agent instructions', async () => {
        const agent = createSampleAgent();
        await agentsStorage.createAgent({ agent });

        const newInstructions = 'You are an updated expert assistant';
        const updatedAgent = await agentsStorage.updateAgent({
          id: agent.id,
          instructions: newInstructions,
        });

        expect(updatedAgent.instructions).toBe(newInstructions);
      });

      it('should update agent model', async () => {
        const agent = createSampleAgent();
        await agentsStorage.createAgent({ agent });

        const newModel = { provider: 'anthropic', name: 'claude-3-opus' };
        const updatedAgent = await agentsStorage.updateAgent({
          id: agent.id,
          model: newModel,
        });

        expect(updatedAgent.model).toEqual(newModel);
      });

      it('should merge metadata on update', async () => {
        const agent = createSampleAgent({
          metadata: { key1: 'value1', key2: 'value2' },
        });
        await agentsStorage.createAgent({ agent });

        const updatedAgent = await agentsStorage.updateAgent({
          id: agent.id,
          metadata: { key2: 'updated', key3: 'value3' },
        });

        expect(updatedAgent.metadata).toEqual({
          key1: 'value1',
          key2: 'updated',
          key3: 'value3',
        });
      });

      it('should update multiple fields at once', async () => {
        const agent = createSampleAgent();
        await agentsStorage.createAgent({ agent });

        const updatedAgent = await agentsStorage.updateAgent({
          id: agent.id,
          name: 'Completely Updated Agent',
          description: 'New description',
          instructions: 'New instructions',
          model: { provider: 'google', name: 'gemini-pro' },
        });

        expect(updatedAgent.name).toBe('Completely Updated Agent');
        expect(updatedAgent.description).toBe('New description');
        expect(updatedAgent.instructions).toBe('New instructions');
        expect(updatedAgent.model).toEqual({ provider: 'google', name: 'gemini-pro' });
      });

      it('should update updatedAt timestamp', async () => {
        const agent = createSampleAgent();
        const createdAgent = await agentsStorage.createAgent({ agent });
        const originalUpdatedAt = createdAgent.updatedAt;

        // Wait a small amount to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 10));

        const updatedAgent = await agentsStorage.updateAgent({
          id: agent.id,
          name: 'Updated Name',
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

    describe('deleteAgent', () => {
      it('should delete an existing agent', async () => {
        const agent = createSampleAgent();
        await agentsStorage.createAgent({ agent });

        // Verify it exists
        const beforeDelete = await agentsStorage.getAgentById({ id: agent.id });
        expect(beforeDelete).toBeDefined();

        // Delete
        await agentsStorage.deleteAgent({ id: agent.id });

        // Verify it's gone
        const afterDelete = await agentsStorage.getAgentById({ id: agent.id });
        expect(afterDelete).toBeNull();
      });

      it('should be idempotent when deleting non-existent agent', async () => {
        // Deleting a non-existent agent should not throw - it's a no-op
        await expect(storage.deleteAgent({ id: 'non-existent-agent-id' })).resolves.toBeUndefined();
      });

      it('should be idempotent when deleting same agent twice', async () => {
        const agent = createSampleAgent();
        await agentsStorage.createAgent({ agent });

        // First delete
        await agentsStorage.deleteAgent({ id: agent.id });

        // Second delete should not throw
        await expect(storage.deleteAgent({ id: agent.id })).resolves.toBeUndefined();
      });
    });

    describe('listAgents', () => {
      beforeEach(async () => {
        await agentsStorage.dangerouslyClearAll();
      });

      it('should return empty list when no agents exist', async () => {
        const result = await agentsStorage.listAgents();

        expect(result.agents).toHaveLength(0);
        expect(result.total).toBe(0);
        expect(result.hasMore).toBe(false);
      });

      it('should list all agents with default pagination', async () => {
        const agents = createSampleAgents(5);
        for (const agent of agents) {
          await agentsStorage.createAgent({ agent });
        }

        const result = await agentsStorage.listAgents();

        expect(result.agents.length).toBe(5);
        expect(result.total).toBe(5);
        expect(result.hasMore).toBe(false);
      });

      it('should paginate results correctly', async () => {
        const agents = createSampleAgents(15);
        for (const agent of agents) {
          await agentsStorage.createAgent({ agent });
        }

        const page1 = await agentsStorage.listAgents({ page: 0, perPage: 5 });
        expect(page1.agents.length).toBe(5);
        expect(page1.total).toBe(15);
        expect(page1.page).toBe(0);
        expect(page1.perPage).toBe(5);
        expect(page1.hasMore).toBe(true);

        const page2 = await agentsStorage.listAgents({ page: 1, perPage: 5 });
        expect(page2.agents.length).toBe(5);
        expect(page2.page).toBe(1);
        expect(page2.hasMore).toBe(true);

        const page3 = await agentsStorage.listAgents({ page: 2, perPage: 5 });
        expect(page3.agents.length).toBe(5);
        expect(page3.hasMore).toBe(false);
      });

      it('should return all agents when perPage is false', async () => {
        const agents = createSampleAgents(10);
        for (const agent of agents) {
          await agentsStorage.createAgent({ agent });
        }

        const result = await agentsStorage.listAgents({ perPage: false });

        expect(result.agents.length).toBe(10);
        expect(result.perPage).toBe(false);
        expect(result.hasMore).toBe(false);
      });

      it('should sort agents by createdAt DESC by default', async () => {
        // Create agents with small delays to ensure different timestamps
        const agent1 = createSampleAgent({ name: 'First Agent' });
        await agentsStorage.createAgent({ agent: agent1 });
        await new Promise(resolve => setTimeout(resolve, 10));

        const agent2 = createSampleAgent({ name: 'Second Agent' });
        await agentsStorage.createAgent({ agent: agent2 });
        await new Promise(resolve => setTimeout(resolve, 10));

        const agent3 = createSampleAgent({ name: 'Third Agent' });
        await agentsStorage.createAgent({ agent: agent3 });

        const result = await agentsStorage.listAgents();

        // Default sort is DESC, so newest first
        expect(result.agents[0]?.name).toBe('Third Agent');
        expect(result.agents[2]?.name).toBe('First Agent');
      });

      it('should sort agents by createdAt ASC when specified', async () => {
        // Create agents with small delays
        const agent1 = createSampleAgent({ name: 'First Agent' });
        await agentsStorage.createAgent({ agent: agent1 });
        await new Promise(resolve => setTimeout(resolve, 10));

        const agent2 = createSampleAgent({ name: 'Second Agent' });
        await agentsStorage.createAgent({ agent: agent2 });
        await new Promise(resolve => setTimeout(resolve, 10));

        const agent3 = createSampleAgent({ name: 'Third Agent' });
        await agentsStorage.createAgent({ agent: agent3 });

        const result = await agentsStorage.listAgents({
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

        await agentsStorage.createAgent({ agent });
        const retrievedAgent = await agentsStorage.getAgentById({ id: agent.id });

        expect(retrievedAgent?.model).toEqual(agent.model);
      });

      it('should handle special characters in instructions', async () => {
        const specialInstructions = `You are a helpful assistant.
        Handle these characters: 'quotes' and "double quotes" and emoji 🎉
        Also: <html> tags & ampersands
        And unicode: こんにちは`;

        const agent = createSampleAgent({
          instructions: specialInstructions,
        });

        await agentsStorage.createAgent({ agent });
        const retrievedAgent = await agentsStorage.getAgentById({ id: agent.id });

        expect(retrievedAgent?.instructions).toBe(specialInstructions);
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

        await agentsStorage.createAgent({ agent });
        const retrievedAgent = await agentsStorage.getAgentById({ id: agent.id });

        expect(retrievedAgent?.metadata).toEqual(largeMetadata);
      });

      it('should handle concurrent agent updates', async () => {
        const agent = createSampleAgent();
        await agentsStorage.createAgent({ agent });

        // Perform multiple updates concurrently
        const updates = Array.from({ length: 5 }, (_, i) =>
          agentsStorage.updateAgent({
            id: agent.id,
            name: `Update ${i}`,
            metadata: { update: i },
          }),
        );

        await expect(Promise.all(updates)).resolves.toBeDefined();

        // Verify final state exists
        const finalAgent = await agentsStorage.getAgentById({ id: agent.id });
        expect(finalAgent).toBeDefined();
      });

      it('should handle tools configuration', async () => {
        const tools = ['calculator', 'webSearch', 'codeInterpreter'];

        const agent = createSampleAgent({ tools });

        await agentsStorage.createAgent({ agent });
        const retrievedAgent = await agentsStorage.getAgentById({ id: agent.id });

        expect(retrievedAgent?.tools).toEqual(tools);
      });
    });
  });
}
