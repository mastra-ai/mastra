import { describe, expect, it, beforeEach } from 'vitest';
import { StoreOperationsInMemory } from '../operations/inmemory';
import { AgentsInMemory } from './inmemory';
import type { InMemoryAgents } from './inmemory';

describe('AgentsInMemory', () => {
  let agentsStorage: AgentsInMemory;
  let collection: InMemoryAgents;
  let operations: StoreOperationsInMemory;

  beforeEach(() => {
    operations = new StoreOperationsInMemory();
    const database = operations.getDatabase();
    collection = database.mastra_agents as InMemoryAgents;

    agentsStorage = new AgentsInMemory({
      collection,
      operations,
    });
  });

  it('should create an agent', async () => {
    const config = {
      id: 'test-agent',
      name: 'Test Agent',
      workflowIds: ['workflow-1'],
      agentIds: ['sub-agent-1'],
      toolIds: ['tool-1', 'tool-2'],
      model: 'gpt-4',
      instructions: 'You are a test agent.',
    };

    await agentsStorage.createAgent(config);

    expect(collection.has(config.id)).toBe(true);
    const stored = collection.get(config.id)!;
    expect(stored.id).toBe(config.id);
    expect(stored.name).toBe(config.name);
    expect(JSON.parse(stored.workflowIds)).toEqual(config.workflowIds);
    expect(JSON.parse(stored.agentIds)).toEqual(config.agentIds);
    expect(JSON.parse(stored.toolIds)).toEqual(config.toolIds);
    expect(stored.model).toBe(config.model);
    expect(stored.instructions).toBe(config.instructions);
    expect(stored.createdAt).toBeInstanceOf(Date);
    expect(stored.updatedAt).toBeInstanceOf(Date);
  });

  it('should get an agent by ID', async () => {
    const config = {
      id: 'get-test-agent',
      name: 'Get Test Agent',
      workflowIds: ['workflow-1'],
      agentIds: [],
      toolIds: ['tool-1'],
      model: 'gpt-4',
      instructions: 'You are a get test agent.',
    };

    await agentsStorage.createAgent(config);
    const agent = await agentsStorage.getAgent(config.id);

    expect(agent).not.toBeNull();
    expect(agent!.id).toBe(config.id);
    expect(agent!.name).toBe(config.name);
    expect(agent!.workflowIds).toEqual(config.workflowIds);
    expect(agent!.agentIds).toEqual(config.agentIds);
    expect(agent!.toolIds).toEqual(config.toolIds);
    expect(agent!.model).toBe(config.model);
    expect(agent!.instructions).toBe(config.instructions);
    expect(agent!.createdAt).toBeInstanceOf(Date);
    expect(agent!.updatedAt).toBeInstanceOf(Date);
  });

  it('should return null for non-existent agent', async () => {
    const agent = await agentsStorage.getAgent('non-existent');
    expect(agent).toBeNull();
  });

  it('should list all agents sorted by createdAt DESC', async () => {
    const agent1 = {
      id: 'agent-1',
      name: 'Agent 1',
      workflowIds: ['workflow-1'],
      agentIds: [],
      toolIds: ['tool-1'],
      model: 'gpt-4',
      instructions: 'First agent.',
    };

    const agent2 = {
      id: 'agent-2',
      name: 'Agent 2',
      workflowIds: ['workflow-2'],
      agentIds: [],
      toolIds: ['tool-2'],
      model: 'claude-3',
      instructions: 'Second agent.',
    };

    await agentsStorage.createAgent(agent1);
    // Add a small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1));
    await agentsStorage.createAgent(agent2);

    const agents = await agentsStorage.listAgents();

    expect(agents).toHaveLength(2);
    // Should be sorted by createdAt DESC (newest first)
    expect(agents[0].id).toBe(agent2.id);
    expect(agents[1].id).toBe(agent1.id);
  });

  it('should update an agent', async () => {
    const config = {
      id: 'update-test-agent',
      name: 'Update Test Agent',
      workflowIds: ['workflow-1'],
      agentIds: [],
      toolIds: ['tool-1'],
      model: 'gpt-4',
      instructions: 'Original instructions.',
    };

    await agentsStorage.createAgent(config);

    // Add a small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1));

    const updates = {
      name: 'Updated Agent Name',
      toolIds: ['tool-1', 'tool-2', 'tool-3'],
      instructions: 'Updated instructions.',
    };

    const updatedAgent = await agentsStorage.updateAgent(config.id, updates);

    expect(updatedAgent).not.toBeNull();
    expect(updatedAgent!.id).toBe(config.id);
    expect(updatedAgent!.name).toBe(updates.name);
    expect(updatedAgent!.workflowIds).toEqual(config.workflowIds); // unchanged
    expect(updatedAgent!.agentIds).toEqual(config.agentIds); // unchanged
    expect(updatedAgent!.toolIds).toEqual(updates.toolIds);
    expect(updatedAgent!.model).toBe(config.model); // unchanged
    expect(updatedAgent!.instructions).toBe(updates.instructions);
    expect(updatedAgent!.createdAt).toBeInstanceOf(Date);
    expect(updatedAgent!.updatedAt).toBeInstanceOf(Date);
    expect(updatedAgent!.updatedAt.getTime()).toBeGreaterThan(updatedAgent!.createdAt.getTime());
  });

  it('should return null when updating non-existent agent', async () => {
    const result = await agentsStorage.updateAgent('non-existent', { name: 'New Name' });
    expect(result).toBeNull();
  });

  it('should delete an agent', async () => {
    const config = {
      id: 'delete-test-agent',
      name: 'Delete Test Agent',
      workflowIds: [],
      agentIds: [],
      toolIds: [],
      model: 'gpt-4',
      instructions: 'To be deleted.',
    };

    await agentsStorage.createAgent(config);
    expect(collection.has(config.id)).toBe(true);

    await agentsStorage.deleteAgent(config.id);
    expect(collection.has(config.id)).toBe(false);

    const agent = await agentsStorage.getAgent(config.id);
    expect(agent).toBeNull();
  });

  it('should handle deleting non-existent agent gracefully', async () => {
    // Should not throw
    await expect(agentsStorage.deleteAgent('non-existent')).resolves.toBeUndefined();
  });
});
