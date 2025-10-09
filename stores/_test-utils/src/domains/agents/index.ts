import { describe, it, expect, beforeAll } from 'vitest';
import type { MastraStorage } from '@mastra/core/storage';
import { TABLE_AGENTS } from '@mastra/core/storage';

export function createAgentsTest({ storage }: { storage: MastraStorage }) {
  beforeAll(async () => {
    const start = Date.now();
    console.log('Clearing agents table before tests');
    await storage.clearTable({ tableName: TABLE_AGENTS });
    const end = Date.now();
    console.log(`Agents table cleared in ${end - start}ms`);
  });

  describe('Agents Storage', () => {
    it('should create an agent', async () => {
      const agentConfig = {
        id: 'test-agent-1',
        name: 'Test Agent 1',
        description: 'A test agent',
        workflowIds: ['workflow-1'],
        agentIds: [{ agentId: 'sub-agent-1', from: 'CODE' as const }],
        toolIds: ['tool-1'],
        model: 'gpt-4',
        instructions: 'You are a helpful test agent.',
        memoryConfig: {
          lastMessages: 10,
        },
      };

      await storage.createAgent(agentConfig);

      const retrieved = await storage.getAgent(agentConfig.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(agentConfig.id);
      expect(retrieved!.name).toBe(agentConfig.name);
      expect(retrieved!.description).toBe(agentConfig.description);
      expect(retrieved!.model).toBe(agentConfig.model);
      expect(retrieved!.instructions).toBe(agentConfig.instructions);
      expect(retrieved!.workflowIds).toEqual(agentConfig.workflowIds);
      expect(retrieved!.agentIds).toEqual(agentConfig.agentIds);
      expect(retrieved!.toolIds).toEqual(agentConfig.toolIds);
      expect(retrieved!.memoryConfig).toEqual(agentConfig.memoryConfig);
    });

    it('should list agents', async () => {
      const agent1 = {
        id: 'list-agent-1',
        name: 'List Agent 1',
        model: 'gpt-4',
        instructions: 'First agent',
      };

      const agent2 = {
        id: 'list-agent-2',
        name: 'List Agent 2',
        model: 'claude-3',
        instructions: 'Second agent',
      };

      await storage.createAgent(agent1);
      await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different timestamps
      await storage.createAgent(agent2);

      const agents = await storage.listAgents();
      expect(agents.length).toBeGreaterThanOrEqual(2);

      // Should be sorted by createdAt DESC (newest first)
      const ourAgents = agents.filter(a => a.id.startsWith('list-agent-'));
      expect(ourAgents.length).toBe(2);
      expect(ourAgents[0]!.id).toBe(agent2.id);
      expect(ourAgents[1]!.id).toBe(agent1.id);
    });

    it('should update an agent', async () => {
      const agentConfig = {
        id: 'update-agent',
        name: 'Update Agent',
        model: 'gpt-4',
        instructions: 'Original instructions',
      };

      await storage.createAgent(agentConfig);

      const updates = {
        name: 'Updated Agent',
        description: 'Updated description',
        instructions: 'Updated instructions',
        memoryConfig: {
          lastMessages: 5,
          workingMemory: {
            enabled: true,
          },
        },
      };

      const updated = await storage.updateAgent(agentConfig.id, updates);
      expect(updated).toBeDefined();
      expect(updated!.name).toBe(updates.name);
      expect(updated!.description).toBe(updates.description);
      expect(updated!.instructions).toBe(updates.instructions);
      expect(updated!.memoryConfig).toEqual(updates.memoryConfig);
      expect(updated!.model).toBe(agentConfig.model); // Should remain unchanged
    });

    it('should delete an agent', async () => {
      const agentConfig = {
        id: 'delete-agent',
        name: 'Delete Agent',
        model: 'gpt-4',
        instructions: 'To be deleted',
      };

      await storage.createAgent(agentConfig);

      let retrieved = await storage.getAgent(agentConfig.id);
      expect(retrieved).toBeDefined();

      await storage.deleteAgent(agentConfig.id);

      retrieved = await storage.getAgent(agentConfig.id);
      expect(retrieved).toBeNull();
    });

    it('should return null for non-existent agent', async () => {
      const agent = await storage.getAgent('non-existent-id');
      expect(agent).toBeNull();
    });

    it('should handle agents without optional fields', async () => {
      const agentConfig = {
        id: 'minimal-agent',
        name: 'Minimal Agent',
        model: 'gpt-4',
        instructions: 'Minimal configuration',
      };

      await storage.createAgent(agentConfig);

      const retrieved = await storage.stores!.agents!.getAgent(agentConfig.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.description).toBeUndefined();
      expect(retrieved!.memoryConfig).toBeUndefined();
      expect(retrieved!.workflowIds).toEqual([]);
      expect(retrieved!.agentIds).toEqual([]);
      expect(retrieved!.toolIds).toEqual([]);
    });
  });
}
