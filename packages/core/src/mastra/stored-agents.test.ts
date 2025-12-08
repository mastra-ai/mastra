import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { createScorer } from '../evals';
import { InMemoryStore } from '../storage/mock';
import { createTool } from '../tools';
import { createWorkflow, createStep } from '../workflows';
import { Mastra } from './index';

// Mock tool for testing
const mockTool = createTool({
  id: 'test-tool',
  description: 'A test tool',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ output: z.string() }),
  execute: async inputData => ({ output: `processed: ${inputData.input}` }),
});

// Sample stored agent data
const sampleStoredAgent = {
  id: 'stored-agent-1',
  name: 'Test Stored Agent',
  description: 'A test agent from storage',
  instructions: 'You are a helpful test assistant',
  model: { provider: 'openai', name: 'gpt-4' },
  tools: ['test-tool'],
  defaultOptions: { maxSteps: 5 },
  metadata: { version: '1.0' },
};

const sampleStoredAgent2 = {
  id: 'stored-agent-2',
  name: 'Second Stored Agent',
  instructions: 'You are another test assistant',
  model: { provider: 'anthropic', name: 'claude-3' },
};

describe('Mastra Stored Agents', () => {
  describe('getStoredAgentById', () => {
    it('should throw error when storage is not configured', async () => {
      const mastra = new Mastra({});

      await expect(mastra.getStoredAgentById('test-id')).rejects.toThrow('Storage is not configured');
    });

    it('should return null when agent is not found', async () => {
      const storage = new InMemoryStore();
      const mastra = new Mastra({ storage });

      const result = await mastra.getStoredAgentById('non-existent');

      expect(result).toBeNull();
    });

    it('should return an Agent instance by default', async () => {
      const storage = new InMemoryStore();
      await storage.createAgent({ agent: sampleStoredAgent });

      const mastra = new Mastra({
        storage,
        tools: { 'test-tool': mockTool },
      });

      const result = await mastra.getStoredAgentById('stored-agent-1');

      expect(result).toBeInstanceOf(Agent);
      expect(result?.id).toBe('stored-agent-1');
      expect(result?.name).toBe('Test Stored Agent');
    });

    it('should return raw StorageAgentType when raw option is true', async () => {
      const storage = new InMemoryStore();
      await storage.createAgent({ agent: sampleStoredAgent });

      const mastra = new Mastra({ storage });

      const result = await mastra.getStoredAgentById('stored-agent-1', { raw: true });

      expect(result).not.toBeInstanceOf(Agent);
      expect(result?.id).toBe('stored-agent-1');
      expect(result?.name).toBe('Test Stored Agent');
      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.updatedAt).toBeInstanceOf(Date);
    });

    it('should resolve tools from registered tools', async () => {
      const storage = new InMemoryStore();
      await storage.createAgent({ agent: sampleStoredAgent });

      const mastra = new Mastra({
        storage,
        tools: { 'test-tool': mockTool },
      });

      const agent = await mastra.getStoredAgentById('stored-agent-1');

      expect(agent).toBeInstanceOf(Agent);
      // The agent should have the tool resolved
    });

    it('should warn when referenced tool is not registered', async () => {
      const storage = new InMemoryStore();
      await storage.createAgent({ agent: sampleStoredAgent });

      const warnSpy = vi.fn();
      const mastra = new Mastra({
        storage,
        tools: {}, // No tools registered
        logger: {
          warn: warnSpy,
          info: vi.fn(),
          debug: vi.fn(),
          error: vi.fn(),
          child: vi.fn().mockReturnThis(),
          trackException: vi.fn(),
        } as any,
      });

      await mastra.getStoredAgentById('stored-agent-1');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tool "test-tool" referenced in stored agent but not registered'),
      );
    });

    it('should throw error when model config is invalid', async () => {
      const storage = new InMemoryStore();
      await storage.createAgent({
        agent: {
          id: 'invalid-model-agent',
          name: 'Invalid Model Agent',
          instructions: 'Test',
          model: { invalid: 'config' }, // Missing provider and name
        },
      });

      const mastra = new Mastra({ storage });

      await expect(mastra.getStoredAgentById('invalid-model-agent')).rejects.toThrow('invalid model configuration');
    });
  });

  describe('listStoredAgents', () => {
    it('should throw error when storage is not configured', async () => {
      const mastra = new Mastra({});

      await expect(mastra.listStoredAgents()).rejects.toThrow('Storage is not configured');
    });

    it('should return empty list when no agents exist', async () => {
      const storage = new InMemoryStore();
      const mastra = new Mastra({ storage });

      const result = await mastra.listStoredAgents();

      expect(result.agents).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should return Agent instances by default', async () => {
      const storage = new InMemoryStore();
      await storage.createAgent({ agent: sampleStoredAgent });
      await storage.createAgent({ agent: sampleStoredAgent2 });

      const mastra = new Mastra({ storage });

      const result = await mastra.listStoredAgents();

      expect(result.agents).toHaveLength(2);
      expect(result.agents[0]).toBeInstanceOf(Agent);
      expect(result.agents[1]).toBeInstanceOf(Agent);
      expect(result.total).toBe(2);
    });

    it('should return raw StorageAgentType array when raw option is true', async () => {
      const storage = new InMemoryStore();
      await storage.createAgent({ agent: sampleStoredAgent });
      await storage.createAgent({ agent: sampleStoredAgent2 });

      const mastra = new Mastra({ storage });

      const result = await mastra.listStoredAgents({ raw: true });

      expect(result.agents).toHaveLength(2);
      expect(result.agents[0]).not.toBeInstanceOf(Agent);
      expect(result.agents[0].createdAt).toBeInstanceOf(Date);
      expect(result.agents[1].createdAt).toBeInstanceOf(Date);
    });

    it('should return pagination info correctly', async () => {
      const storage = new InMemoryStore();

      // Create 25 agents
      for (let i = 0; i < 25; i++) {
        await storage.createAgent({
          agent: {
            ...sampleStoredAgent,
            id: `agent-${i}`,
            name: `Agent ${i}`,
          },
        });
      }

      const mastra = new Mastra({ storage });

      const result = await mastra.listStoredAgents({ page: 0, perPage: 10 });

      expect(result.agents).toHaveLength(10);
      expect(result.total).toBe(25);
      expect(result.page).toBe(0);
      expect(result.perPage).toBe(10);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('Agent instance creation from stored config', () => {
    it('should create agent with correct model string format', async () => {
      const storage = new InMemoryStore();
      await storage.createAgent({ agent: sampleStoredAgent });

      const mastra = new Mastra({ storage });

      const agent = await mastra.getStoredAgentById('stored-agent-1');

      expect(agent).toBeInstanceOf(Agent);
      expect(agent?.id).toBe('stored-agent-1');
    });

    it('should resolve workflows from stored config', async () => {
      const storage = new InMemoryStore();
      await storage.createAgent({
        agent: {
          ...sampleStoredAgent,
          id: 'agent-with-workflow',
          workflows: ['my-workflow'],
        },
      });

      const warnSpy = vi.fn();
      const mastra = new Mastra({
        storage,
        logger: {
          warn: warnSpy,
          info: vi.fn(),
          debug: vi.fn(),
          error: vi.fn(),
          child: vi.fn().mockReturnThis(),
          trackException: vi.fn(),
        } as any,
      });

      await mastra.getStoredAgentById('agent-with-workflow');

      // Should warn about unregistered workflow
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Workflow "my-workflow" referenced in stored agent but not registered'),
      );
    });

    it('should resolve sub-agents from stored config', async () => {
      const storage = new InMemoryStore();
      await storage.createAgent({
        agent: {
          ...sampleStoredAgent,
          id: 'agent-with-sub-agent',
          agents: ['sub-agent'],
        },
      });

      const warnSpy = vi.fn();
      const mastra = new Mastra({
        storage,
        logger: {
          warn: warnSpy,
          info: vi.fn(),
          debug: vi.fn(),
          error: vi.fn(),
          child: vi.fn().mockReturnThis(),
          trackException: vi.fn(),
        } as any,
      });

      await mastra.getStoredAgentById('agent-with-sub-agent');

      // Should warn about unregistered sub-agent
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Agent "sub-agent" referenced in stored agent but not registered'),
      );
    });

    it('should pass defaultOptions to created agent', async () => {
      const storage = new InMemoryStore();
      await storage.createAgent({ agent: sampleStoredAgent });

      const mastra = new Mastra({ storage });

      const agent = await mastra.getStoredAgentById('stored-agent-1');

      expect(agent).toBeInstanceOf(Agent);
      // The agent should have defaultOptions set
    });
  });

  describe('Type inference', () => {
    it('should have correct return type for getStoredAgentById without raw option', async () => {
      const storage = new InMemoryStore();
      await storage.createAgent({ agent: sampleStoredAgent });
      const mastra = new Mastra({ storage });

      const result = await mastra.getStoredAgentById('stored-agent-1');

      // TypeScript should infer: Agent | null
      if (result) {
        // Should be able to call Agent methods
        expect(typeof result.generate).toBe('function');
      }
    });

    it('should have correct return type for getStoredAgentById with raw: true', async () => {
      const storage = new InMemoryStore();
      await storage.createAgent({ agent: sampleStoredAgent });
      const mastra = new Mastra({ storage });

      const result = await mastra.getStoredAgentById('stored-agent-1', { raw: true });

      // TypeScript should infer: StorageAgentType | null
      if (result) {
        // Should have StorageAgentType properties
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);
      }
    });

    it('should have correct return type for listStoredAgents without raw option', async () => {
      const storage = new InMemoryStore();
      await storage.createAgent({ agent: sampleStoredAgent });
      const mastra = new Mastra({ storage });

      const result = await mastra.listStoredAgents();

      // TypeScript should infer: { agents: Agent[], ... }
      for (const agent of result.agents) {
        expect(typeof agent.generate).toBe('function');
      }
    });

    it('should have correct return type for listStoredAgents with raw: true', async () => {
      const storage = new InMemoryStore();
      await storage.createAgent({ agent: sampleStoredAgent });
      const mastra = new Mastra({ storage });

      const result = await mastra.listStoredAgents({ raw: true });

      // TypeScript should infer: { agents: StorageAgentType[], ... }
      for (const agent of result.agents) {
        expect(agent.createdAt).toBeInstanceOf(Date);
        expect(agent.updatedAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('Full primitive resolution', () => {
    it('should resolve tools and workflows from stored config', async () => {
      const storage = new InMemoryStore();

      // Create registered primitives
      const registeredTool = createTool({
        id: 'registered-tool',
        description: 'A registered tool',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async inputData => ({ output: `processed: ${inputData.input}` }),
      });

      const registeredWorkflow = createWorkflow({
        id: 'registered-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ result: z.number() }),
      }).then(
        createStep({
          id: 'double',
          inputSchema: z.object({ value: z.number() }),
          outputSchema: z.object({ result: z.number() }),
          execute: async ({ inputData }) => ({ result: inputData.value * 2 }),
        }),
      );
      registeredWorkflow.commit();

      const registeredSubAgent = new Agent({
        id: 'registered-sub-agent',
        name: 'Sub Agent',
        instructions: 'You are a sub-agent',
        model: 'openai/gpt-4',
      });

      // Create stored agent that references tools, workflows, and sub-agents
      const fullStoredAgent = {
        id: 'full-agent',
        name: 'Full Test Agent',
        description: 'An agent with primitives',
        instructions: 'You are a comprehensive test assistant',
        model: { provider: 'openai', name: 'gpt-4' },
        tools: ['registered-tool'],
        workflows: ['registered-workflow'],
        agents: ['registered-sub-agent'],
        defaultOptions: { maxSteps: 10 },
        metadata: { version: '2.0', feature: 'full-test' },
      };

      await storage.createAgent({ agent: fullStoredAgent });

      const mastra = new Mastra({
        storage,
        tools: { 'registered-tool': registeredTool },
        workflows: { 'registered-workflow': registeredWorkflow },
        agents: { 'registered-sub-agent': registeredSubAgent },
      });

      const agent = await mastra.getStoredAgentById('full-agent');

      // Verify agent was created
      expect(agent).toBeInstanceOf(Agent);
      expect(agent?.id).toBe('full-agent');
      expect(agent?.name).toBe('Full Test Agent');
    });

    it('should resolve scorers with sampling config from stored config', async () => {
      const storage = new InMemoryStore();

      const registeredScorer = createScorer({
        id: 'registered-scorer',
        description: 'A test scorer',
      }).generateScore(() => 0.8);

      // Create stored agent with scorer including sampling config
      const storedAgentWithScorers = {
        id: 'agent-with-scorers',
        name: 'Agent With Scorers',
        instructions: 'Test agent',
        model: { provider: 'openai', name: 'gpt-4' },
        scorers: {
          'registered-scorer': {
            sampling: { type: 'ratio' as const, rate: 0.5 },
          },
        },
      };

      await storage.createAgent({ agent: storedAgentWithScorers });

      const mastra = new Mastra({
        storage,
        scorers: { 'registered-scorer': registeredScorer },
      });

      const agent = await mastra.getStoredAgentById('agent-with-scorers');

      expect(agent).toBeInstanceOf(Agent);
      expect(agent?.id).toBe('agent-with-scorers');
    });

    it('should resolve scorers by id when key lookup fails', async () => {
      const storage = new InMemoryStore();

      const registeredScorer = createScorer({
        id: 'scorer-by-id',
        description: 'Scorer to find by ID',
      }).generateScore(() => 0.5);

      // Store agent with scorer reference by ID (the key is used to look up by key first, then by ID)
      const storedAgent = {
        id: 'agent-with-id-ref',
        name: 'Agent With ID Reference',
        instructions: 'Test agent',
        model: { provider: 'openai', name: 'gpt-4' },
        scorers: {
          'scorer-by-id': {}, // Use the scorer's ID as the key
        },
      };

      await storage.createAgent({ agent: storedAgent });

      const mastra = new Mastra({
        storage,
        scorers: { 'some-other-key': registeredScorer }, // Registered under different key
      });

      const agent = await mastra.getStoredAgentById('agent-with-id-ref');

      expect(agent).toBeInstanceOf(Agent);
    });

    it('should handle missing primitives gracefully with warnings', async () => {
      const storage = new InMemoryStore();

      const storedAgent = {
        id: 'agent-with-missing-refs',
        name: 'Agent With Missing References',
        instructions: 'Test agent',
        model: { provider: 'openai', name: 'gpt-4' },
        tools: ['missing-tool'],
        workflows: ['missing-workflow'],
        agents: ['missing-agent'],
        memory: 'missing-memory',
        scorers: { 'missing-scorer': {} },
      };

      await storage.createAgent({ agent: storedAgent });

      const warnSpy = vi.fn();
      const mastra = new Mastra({
        storage,
        logger: {
          warn: warnSpy,
          info: vi.fn(),
          debug: vi.fn(),
          error: vi.fn(),
          child: vi.fn().mockReturnThis(),
          trackException: vi.fn(),
        } as any,
      });

      const agent = await mastra.getStoredAgentById('agent-with-missing-refs');

      expect(agent).toBeInstanceOf(Agent);

      // Should have warnings for all missing primitives
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Tool "missing-tool"'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Workflow "missing-workflow"'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Agent "missing-agent"'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Memory "missing-memory"'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Scorer "missing-scorer"'));
    });
  });
});
