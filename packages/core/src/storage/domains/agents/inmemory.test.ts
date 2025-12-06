import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import type { StorageCreateAgentInput } from '../../types';
import { InMemoryAgentsStorage } from './inmemory';
import type { InMemoryAgents } from './inmemory';

describe('InMemoryAgentsStorage', () => {
  let storage: InMemoryAgentsStorage;
  let collection: InMemoryAgents;
  let initialDate: Date;
  let laterDate: Date;

  beforeEach(() => {
    // Set up two fixed dates for testing
    initialDate = new Date('2024-01-01T00:00:00Z');
    laterDate = new Date('2024-01-01T01:00:00Z');

    // Use Vitest fake timers to control Date
    vi.useFakeTimers();
    vi.setSystemTime(initialDate);

    // Initialize fresh collection and storage instance for each test
    collection = new Map();
    storage = new InMemoryAgentsStorage({ collection });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('createAgent', () => {
    it('should create a new agent with timestamps', async () => {
      const agentInput: StorageCreateAgentInput = {
        id: 'agent-1',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: { provider: 'openai', name: 'gpt-4' },
      };

      const result = await storage.createAgent({ agent: agentInput });

      expect(result).toEqual({
        ...agentInput,
        createdAt: initialDate,
        updatedAt: initialDate,
      });
      expect(collection.has('agent-1')).toBe(true);
    });

    it('should throw error when creating agent with existing id', async () => {
      const agentInput: StorageCreateAgentInput = {
        id: 'agent-1',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: { provider: 'openai', name: 'gpt-4' },
      };

      await storage.createAgent({ agent: agentInput });

      await expect(storage.createAgent({ agent: agentInput })).rejects.toThrow('Agent with id agent-1 already exists');
    });

    it('should create agent with all optional fields', async () => {
      const agentInput: StorageCreateAgentInput = {
        id: 'agent-2',
        name: 'Full Agent',
        description: 'A fully configured agent',
        instructions: 'You are a helpful assistant',
        model: { provider: 'openai', name: 'gpt-4' },
        tools: ['calculator'],
        defaultOptions: { maxTokens: 1000 },
        metadata: { category: 'test' },
      };

      const result = await storage.createAgent({ agent: agentInput });

      expect(result).toEqual({
        ...agentInput,
        createdAt: initialDate,
        updatedAt: initialDate,
      });
    });
  });

  describe('getAgentById', () => {
    it('should return null for non-existent agent', async () => {
      const result = await storage.getAgentById({ id: 'non-existent' });
      expect(result).toBeNull();
    });

    it('should return agent by id', async () => {
      const agentInput: StorageCreateAgentInput = {
        id: 'agent-1',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: { provider: 'openai', name: 'gpt-4' },
        metadata: { key: 'value' },
      };

      await storage.createAgent({ agent: agentInput });
      const result = await storage.getAgentById({ id: 'agent-1' });

      expect(result).toEqual({
        ...agentInput,
        createdAt: initialDate,
        updatedAt: initialDate,
      });
    });

    it('should return a deep copy of agent data', async () => {
      const agentInput: StorageCreateAgentInput = {
        id: 'agent-1',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: { provider: 'openai', name: 'gpt-4' },
        metadata: { key: 'value' },
      };

      await storage.createAgent({ agent: agentInput });
      const result1 = await storage.getAgentById({ id: 'agent-1' });
      const result2 = await storage.getAgentById({ id: 'agent-1' });

      // Verify they are different object references
      expect(result1).not.toBe(result2);
      expect(result1?.model).not.toBe(result2?.model);
      expect(result1?.metadata).not.toBe(result2?.metadata);
    });
  });

  describe('updateAgent', () => {
    it('should throw error when updating non-existent agent', async () => {
      await expect(storage.updateAgent({ id: 'non-existent', name: 'Updated Name' })).rejects.toThrow(
        'Agent with id non-existent not found',
      );
    });

    it('should update agent name', async () => {
      const agentInput: StorageCreateAgentInput = {
        id: 'agent-1',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: { provider: 'openai', name: 'gpt-4' },
      };

      await storage.createAgent({ agent: agentInput });

      vi.setSystemTime(laterDate);

      const result = await storage.updateAgent({ id: 'agent-1', name: 'Updated Agent' });

      expect(result.name).toBe('Updated Agent');
      expect(result.updatedAt).toEqual(laterDate);
      expect(result.createdAt).toEqual(initialDate);
    });

    it('should update agent instructions', async () => {
      const agentInput: StorageCreateAgentInput = {
        id: 'agent-1',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: { provider: 'openai', name: 'gpt-4' },
      };

      await storage.createAgent({ agent: agentInput });

      vi.setSystemTime(laterDate);

      const result = await storage.updateAgent({
        id: 'agent-1',
        instructions: 'You are an expert coder',
      });

      expect(result.instructions).toBe('You are an expert coder');
      expect(result.updatedAt).toEqual(laterDate);
    });

    it('should merge metadata on update', async () => {
      const agentInput: StorageCreateAgentInput = {
        id: 'agent-1',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: { provider: 'openai', name: 'gpt-4' },
        metadata: { key1: 'value1', key2: 'value2' },
      };

      await storage.createAgent({ agent: agentInput });

      vi.setSystemTime(laterDate);

      const result = await storage.updateAgent({
        id: 'agent-1',
        metadata: { key2: 'updated', key3: 'value3' },
      });

      expect(result.metadata).toEqual({
        key1: 'value1',
        key2: 'updated',
        key3: 'value3',
      });
    });

    it('should replace model on update', async () => {
      const agentInput: StorageCreateAgentInput = {
        id: 'agent-1',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: { provider: 'openai', name: 'gpt-4' },
      };

      await storage.createAgent({ agent: agentInput });

      const newModel = { provider: 'anthropic', name: 'claude-3' };
      const result = await storage.updateAgent({ id: 'agent-1', model: newModel });

      expect(result.model).toEqual(newModel);
    });
  });

  describe('deleteAgent', () => {
    it('should be idempotent when deleting non-existent agent', async () => {
      // Deleting a non-existent agent should not throw - it's a no-op
      await expect(storage.deleteAgent({ id: 'non-existent' })).resolves.toBeUndefined();
    });

    it('should delete an existing agent', async () => {
      const agentInput: StorageCreateAgentInput = {
        id: 'agent-1',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: { provider: 'openai', name: 'gpt-4' },
      };

      await storage.createAgent({ agent: agentInput });
      expect(collection.has('agent-1')).toBe(true);

      await storage.deleteAgent({ id: 'agent-1' });
      expect(collection.has('agent-1')).toBe(false);
    });

    it('should be idempotent when deleting same agent twice', async () => {
      const agentInput: StorageCreateAgentInput = {
        id: 'agent-1',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model: { provider: 'openai', name: 'gpt-4' },
      };

      await storage.createAgent({ agent: agentInput });
      await storage.deleteAgent({ id: 'agent-1' });

      // Second delete should not throw
      await expect(storage.deleteAgent({ id: 'agent-1' })).resolves.toBeUndefined();
    });
  });

  describe('listAgents', () => {
    const createMultipleAgents = async () => {
      const agents: StorageCreateAgentInput[] = [
        {
          id: 'agent-1',
          name: 'Agent One',
          instructions: 'Instructions 1',
          model: { provider: 'openai', name: 'gpt-4' },
        },
        {
          id: 'agent-2',
          name: 'Agent Two',
          instructions: 'Instructions 2',
          model: { provider: 'openai', name: 'gpt-4' },
        },
        {
          id: 'agent-3',
          name: 'Agent Three',
          instructions: 'Instructions 3',
          model: { provider: 'anthropic', name: 'claude-3' },
        },
      ];

      // Create agents with different timestamps
      for (let i = 0; i < agents.length; i++) {
        vi.setSystemTime(new Date(initialDate.getTime() + i * 1000));
        await storage.createAgent({ agent: agents[i]! });
      }

      return agents;
    };

    it('should return empty list when no agents exist', async () => {
      const result = await storage.listAgents();

      expect(result).toEqual({
        agents: [],
        total: 0,
        page: 0,
        perPage: 100,
        hasMore: false,
      });
    });

    it('should return all agents with default pagination', async () => {
      await createMultipleAgents();

      const result = await storage.listAgents();

      expect(result.agents.length).toBe(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(0);
      expect(result.perPage).toBe(100);
      expect(result.hasMore).toBe(false);
    });

    it('should paginate results correctly', async () => {
      await createMultipleAgents();

      const page1 = await storage.listAgents({ page: 0, perPage: 2 });
      expect(page1.agents.length).toBe(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await storage.listAgents({ page: 1, perPage: 2 });
      expect(page2.agents.length).toBe(1);
      expect(page2.hasMore).toBe(false);
    });

    it('should return all agents when perPage is false', async () => {
      await createMultipleAgents();

      const result = await storage.listAgents({ perPage: false });

      expect(result.agents.length).toBe(3);
      expect(result.perPage).toBe(false);
      expect(result.hasMore).toBe(false);
    });

    it('should sort agents by createdAt descending by default', async () => {
      await createMultipleAgents();

      const result = await storage.listAgents();

      // Default sort is DESC, so newest first
      expect(result.agents[0]?.id).toBe('agent-3');
      expect(result.agents[2]?.id).toBe('agent-1');
    });

    it('should sort agents by createdAt ascending when specified', async () => {
      await createMultipleAgents();

      const result = await storage.listAgents({
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });

      // ASC sort, so oldest first
      expect(result.agents[0]?.id).toBe('agent-1');
      expect(result.agents[2]?.id).toBe('agent-3');
    });

    it('should throw error for negative page number', async () => {
      await expect(storage.listAgents({ page: -1 })).rejects.toThrow('page must be >= 0');
    });

    it('should return cloned agent data', async () => {
      await createMultipleAgents();

      const result1 = await storage.listAgents();
      const result2 = await storage.listAgents();

      expect(result1.agents[0]).not.toBe(result2.agents[0]);
      expect(result1.agents[0]?.model).not.toBe(result2.agents[0]?.model);
    });
  });
});
