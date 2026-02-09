import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent, Mastra } from '@mastra/core';
import { createScorer } from '@mastra/core/evals';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { MastraEditor } from './index';

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

describe('agent.clearCache', () => {
  it('should clear agent from Editor cache and Mastra registry when agentId is provided', async () => {
    const storage = new InMemoryStore();
    const agentsStore = await storage.getStore('agents');
    await agentsStore?.createAgent({
      agent: {
        id: 'cache-test-agent',
        name: 'Cache Test Agent',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
      },
    });

    const debugSpy = vi.fn();
    const editor = new MastraEditor({
      logger: {
        warn: vi.fn(),
        info: vi.fn(),
        debug: debugSpy,
        error: vi.fn(),
        child: vi.fn().mockReturnThis(),
        trackException: vi.fn(),
      } as any,
    });
    const mastra = new Mastra({
      storage,
      editor,
    });

    // Load agent - this caches it and registers with Mastra
    const agent = await editor.agent.getById('cache-test-agent');
    expect(agent).toBeInstanceOf(Agent);

    // Verify agent is in Mastra registry
    expect(mastra.getAgentById('cache-test-agent')).toBeDefined();

    // Clear the cache for this specific agent
    editor.agent.clearCache('cache-test-agent');

    // Verify agent was removed from Mastra registry
    expect(() => mastra.getAgentById('cache-test-agent')).toThrow();

    // Debug log should indicate cache and registry were cleared
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Cleared cache and registry for agent'));
  });

  it('should clear all agents from Editor cache but not Mastra registry when no agentId', async () => {
    const storage = new InMemoryStore();
    const agentsStore = await storage.getStore('agents');
    await agentsStore?.createAgent({
      agent: {
        id: 'cache-test-agent-1',
        name: 'Cache Test Agent 1',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
      },
    });

    const debugSpy = vi.fn();
    const editor = new MastraEditor({
      logger: {
        warn: vi.fn(),
        info: vi.fn(),
        debug: debugSpy,
        error: vi.fn(),
        child: vi.fn().mockReturnThis(),
        trackException: vi.fn(),
      } as any,
    });

    // Register a code-defined agent
    const codeAgent = new Agent({
      id: 'code-agent',
      name: 'Code Agent',
      instructions: 'A code-defined agent',
      model: 'openai/gpt-4o',
    });

    const mastra = new Mastra({
      storage,
      editor,
      agents: { codeAgent },
    });

    // Load stored agent - this caches it
    await editor.agent.getById('cache-test-agent-1');

    // Clear all from cache
    editor.agent.clearCache();

    // Code-defined agent should still exist in Mastra registry
    expect(mastra.getAgent('codeAgent')).toBeDefined();

    // Debug log should indicate all cached agents were cleared
    expect(debugSpy).toHaveBeenCalledWith('[clearCache] Cleared all cached agents');
  });

  it('should do nothing if editor is not registered with Mastra', () => {
    const editor = new MastraEditor();

    // Should not throw
    expect(() => editor.agent.clearCache('some-id')).not.toThrow();
    expect(() => editor.agent.clearCache()).not.toThrow();
  });

  it('should allow re-registering agent with Mastra after cache clear', async () => {
    const storage = new InMemoryStore();
    const agentsStore = await storage.getStore('agents');

    // Create agent
    await agentsStore?.createAgent({
      agent: {
        id: 'reloadable-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: { provider: 'openai', name: 'gpt-4' },
      },
    });

    const editor = new MastraEditor();
    const mastra = new Mastra({ storage, editor });

    // Load agent first time - this registers it with Mastra
    const agent1 = await editor.agent.getById('reloadable-agent');
    expect(agent1?.name).toBe('Test Agent');
    expect(mastra.getAgentById('reloadable-agent')).toBeDefined();

    // Clear cache - this removes from both cache and Mastra registry
    editor.agent.clearCache('reloadable-agent');

    // Agent should no longer be in Mastra registry
    expect(() => mastra.getAgentById('reloadable-agent')).toThrow();

    // Load agent again - should successfully re-register with Mastra
    const agent2 = await editor.agent.getById('reloadable-agent');
    expect(agent2).toBeInstanceOf(Agent);
    expect(agent2?.name).toBe('Test Agent');

    // Agent should be back in Mastra registry
    expect(mastra.getAgentById('reloadable-agent')).toBeDefined();
  });
});

describe('Stored Agents via MastraEditor', () => {
  describe('agent.getById', () => {
    it('should throw error when editor is not registered with Mastra', async () => {
      const editor = new MastraEditor();

      await expect(editor.agent.getById('test-id')).rejects.toThrow(
        'MastraEditor is not registered with a Mastra instance',
      );
    });

    it('should throw error when storage is not configured', async () => {
      const editor = new MastraEditor();
      const mastra = new Mastra({ editor });

      await expect(editor.agent.getById('test-id')).rejects.toThrow('Storage is not configured');
    });

    it('should return null when agent is not found', async () => {
      const storage = new InMemoryStore();
      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const result = await editor.agent.getById('non-existent');

      expect(result).toBeNull();
    });

    it('should return an Agent instance by default', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({ agent: sampleStoredAgent });

      const editor = new MastraEditor();
      const mastra = new Mastra({
        storage,
        tools: { 'test-tool': mockTool },
        editor,
      });

      const result = await editor.agent.getById('stored-agent-1');

      expect(result).toBeInstanceOf(Agent);
      expect(result?.id).toBe('stored-agent-1');
      expect(result?.name).toBe('Test Stored Agent');
    });

    it('should return raw StorageResolvedAgentType when raw option is true', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({ agent: sampleStoredAgent });

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const result = await editor.agent.getById('stored-agent-1', { returnRaw: true });

      expect(result).not.toBeInstanceOf(Agent);
      expect(result?.id).toBe('stored-agent-1');
      expect(result?.name).toBe('Test Stored Agent');
      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.updatedAt).toBeInstanceOf(Date);
    });

    it('should resolve tools from registered tools', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({ agent: sampleStoredAgent });

      const editor = new MastraEditor();
      const mastra = new Mastra({
        storage,
        tools: { 'test-tool': mockTool },
        editor,
      });

      const agent = await editor.agent.getById('stored-agent-1');

      expect(agent).toBeInstanceOf(Agent);
      // The agent should have the tool resolved
    });

    it('should warn when referenced tool is not registered', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({ agent: sampleStoredAgent });

      const warnSpy = vi.fn();
      const editor = new MastraEditor({
        logger: {
          warn: warnSpy,
          info: vi.fn(),
          debug: vi.fn(),
          error: vi.fn(),
          child: vi.fn().mockReturnThis(),
          trackException: vi.fn(),
        } as any,
      });
      const mastra = new Mastra({
        storage,
        tools: {}, // No tools registered
        editor,
      });

      await editor.agent.getById('stored-agent-1');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tool "test-tool" referenced in stored agent but not registered'),
      );
    });

    it('should throw error when model config is invalid', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({
        agent: {
          id: 'invalid-model-agent',
          name: 'Invalid Model Agent',
          instructions: 'Test',
          model: { invalid: 'config' } as any, // Missing provider and name
        },
      });

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      await expect(editor.agent.getById('invalid-model-agent')).rejects.toThrow('invalid model configuration');
    });

    it('should return specific version when versionId is provided', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({ agent: sampleStoredAgent });

      // Get the version that was created
      const versions = await agentsStore?.listVersions({ agentId: 'stored-agent-1' });
      const versionId = versions?.versions[0]?.id;

      const editor = new MastraEditor();
      const mastra = new Mastra({
        storage,
        tools: { 'test-tool': mockTool },
        editor,
      });

      const agent = await editor.agent.getById('stored-agent-1', { versionId });

      expect(agent).toBeInstanceOf(Agent);
      expect(agent?.id).toBe('stored-agent-1');
      expect(agent?.name).toBe('Test Stored Agent');
    });

    it('should return specific version when versionNumber is provided', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({ agent: sampleStoredAgent });

      const editor = new MastraEditor();
      const mastra = new Mastra({
        storage,
        tools: { 'test-tool': mockTool },
        editor,
      });

      const agent = await editor.agent.getById('stored-agent-1', { versionNumber: 1 });

      expect(agent).toBeInstanceOf(Agent);
      expect(agent?.id).toBe('stored-agent-1');
      expect(agent?.name).toBe('Test Stored Agent');
    });

    it('should return raw version config when raw option is used with versionId', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({ agent: sampleStoredAgent });

      // Get the version that was created
      const versions = await agentsStore?.listVersions({ agentId: 'stored-agent-1' });
      const versionId = versions?.versions[0]?.id;

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const result = await editor.agent.getById('stored-agent-1', { returnRaw: true, versionId });

      expect(result).not.toBeInstanceOf(Agent);
      expect(result?.id).toBe('stored-agent-1');
      expect(result?.name).toBe('Test Stored Agent');
      expect(result?.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('agent.list', () => {
    it('should throw error when storage is not configured', async () => {
      const editor = new MastraEditor();
      const mastra = new Mastra({ editor });

      await expect(editor.agent.list()).rejects.toThrow('Storage is not configured');
    });

    it('should return empty list when no agents exist', async () => {
      const storage = new InMemoryStore();
      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const result = await editor.agent.list();

      expect(result.agents).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should return Agent instances by default', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({ agent: sampleStoredAgent });
      await agentsStore?.createAgent({ agent: sampleStoredAgent2 });

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const result = await editor.agent.list();

      expect(result.agents).toHaveLength(2);
      expect(result.agents[0]).toBeInstanceOf(Agent);
      expect(result.agents[1]).toBeInstanceOf(Agent);
      expect(result.total).toBe(2);
    });

    it('should return raw StorageResolvedAgentType array when raw option is true', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({ agent: sampleStoredAgent });
      await agentsStore?.createAgent({ agent: sampleStoredAgent2 });

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const result = await editor.agent.list({ returnRaw: true });

      expect(result.agents).toHaveLength(2);
      expect(result.agents[0]).not.toBeInstanceOf(Agent);
      expect(result.agents[0].createdAt).toBeInstanceOf(Date);
      expect(result.agents[1].createdAt).toBeInstanceOf(Date);
    });

    it('should return pagination info correctly', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      // Create 25 agents
      for (let i = 0; i < 25; i++) {
        await agentsStore?.createAgent({
          agent: {
            ...sampleStoredAgent,
            id: `agent-${i}`,
            name: `Agent ${i}`,
          },
        });
      }

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const result = await editor.agent.list({ page: 0, pageSize: 10 });

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
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({ agent: sampleStoredAgent });

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('stored-agent-1');

      expect(agent).toBeInstanceOf(Agent);
      expect(agent?.id).toBe('stored-agent-1');
    });

    it('should resolve workflows from stored config', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({
        agent: {
          ...sampleStoredAgent,
          id: 'agent-with-workflow',
          workflows: ['my-workflow'],
        },
      });

      const warnSpy = vi.fn();
      const editor = new MastraEditor({
        logger: {
          warn: warnSpy,
          info: vi.fn(),
          debug: vi.fn(),
          error: vi.fn(),
          child: vi.fn().mockReturnThis(),
          trackException: vi.fn(),
        } as any,
      });
      const mastra = new Mastra({ storage, editor });

      await editor.agent.getById('agent-with-workflow');

      // Should warn about unregistered workflow
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Workflow "my-workflow" referenced in stored agent but not registered'),
      );
    });

    it('should resolve sub-agents from stored config', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({
        agent: {
          ...sampleStoredAgent,
          id: 'agent-with-sub-agent',
          agents: ['sub-agent'],
        },
      });

      const warnSpy = vi.fn();
      const editor = new MastraEditor({
        logger: {
          warn: warnSpy,
          info: vi.fn(),
          debug: vi.fn(),
          error: vi.fn(),
          child: vi.fn().mockReturnThis(),
          trackException: vi.fn(),
        } as any,
      });
      const mastra = new Mastra({ storage, editor });

      await editor.agent.getById('agent-with-sub-agent');

      // Should warn about unregistered sub-agent
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Agent "sub-agent" referenced in stored agent but not registered'),
      );
    });

    it('should pass defaultOptions to created agent', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({ agent: sampleStoredAgent });

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('stored-agent-1');

      expect(agent).toBeInstanceOf(Agent);
      // The agent should have defaultOptions set
    });

    it('should resolve memory config when editor is available', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({
        agent: {
          ...sampleStoredAgent,
          id: 'agent-with-memory',
          memory: {
            options: {
              readOnly: false,
            },
          } as any,
        },
      });

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      // Editor CAN resolve memory (via @mastra/memory), so this should succeed
      const agent = await editor.agent.getById('agent-with-memory');
      expect(agent).toBeInstanceOf(Agent);
    });
  });

  describe('Type inference', () => {
    it('should have correct return type for agent.getById without raw option', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({ agent: sampleStoredAgent });
      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const result = await editor.agent.getById('stored-agent-1');

      // TypeScript should infer: Agent | null
      if (result) {
        // Should be able to call Agent methods
        expect(typeof result.generate).toBe('function');
      }
    });

    it('should have correct return type for agent.getById with returnRaw: true', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({ agent: sampleStoredAgent });
      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const result = await editor.agent.getById('stored-agent-1', { returnRaw: true });

      // TypeScript should infer: StorageResolvedAgentType | null
      if (result) {
        // Should have StorageResolvedAgentType properties
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);
      }
    });

    it('should have correct return type for agent.list without raw option', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({ agent: sampleStoredAgent });
      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const result = await editor.agent.list();

      // TypeScript should infer: { agents: Agent[], ... }
      for (const agent of result.agents) {
        expect(typeof agent.generate).toBe('function');
      }
    });

    it('should have correct return type for agent.list with returnRaw: true', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.createAgent({ agent: sampleStoredAgent });
      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const result = await editor.agent.list({ returnRaw: true });

      // TypeScript should infer: { agents: StorageResolvedAgentType[], ... }
      for (const agent of result.agents) {
        expect(agent.createdAt).toBeInstanceOf(Date);
        expect(agent.updatedAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('Full primitive resolution', () => {
    it('should resolve tools and workflows from stored config', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

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

      await agentsStore?.createAgent({ agent: fullStoredAgent });

      const editor = new MastraEditor();
      const mastra = new Mastra({
        storage,
        tools: { 'registered-tool': registeredTool },
        workflows: { 'registered-workflow': registeredWorkflow },
        agents: { 'registered-sub-agent': registeredSubAgent },
        editor,
      });

      const agent = await editor.agent.getById('full-agent');

      // Verify agent was created
      expect(agent).toBeInstanceOf(Agent);
      expect(agent?.id).toBe('full-agent');
      expect(agent?.name).toBe('Full Test Agent');
    });

    it('should resolve scorers with sampling config from stored config', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

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

      await agentsStore?.createAgent({ agent: storedAgentWithScorers });

      const editor = new MastraEditor();
      const mastra = new Mastra({
        storage,
        scorers: { 'registered-scorer': registeredScorer },
        editor,
      });

      const agent = await editor.agent.getById('agent-with-scorers');

      expect(agent).toBeInstanceOf(Agent);
      expect(agent?.id).toBe('agent-with-scorers');
    });

    it('should resolve scorers by id when key lookup fails', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

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

      await agentsStore?.createAgent({ agent: storedAgent });

      const editor = new MastraEditor();
      const mastra = new Mastra({
        storage,
        scorers: { 'some-other-key': registeredScorer }, // Registered under different key
        editor,
      });

      const agent = await editor.agent.getById('agent-with-id-ref');

      expect(agent).toBeInstanceOf(Agent);
    });

    it('should handle missing primitives gracefully with warnings', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      const storedAgent = {
        id: 'agent-with-missing-refs',
        name: 'Agent With Missing References',
        instructions: 'Test agent',
        model: { provider: 'openai', name: 'gpt-4' },
        tools: ['missing-tool'],
        workflows: ['missing-workflow'],
        agents: ['missing-agent'],
        memory: {
          options: {
            readOnly: false,
          },
        } as any,
        scorers: { 'missing-scorer': {} },
      };

      await agentsStore?.createAgent({ agent: storedAgent });

      const warnSpy = vi.fn();
      const editor = new MastraEditor({
        logger: {
          warn: warnSpy,
          info: vi.fn(),
          debug: vi.fn(),
          error: vi.fn(),
          child: vi.fn().mockReturnThis(),
          trackException: vi.fn(),
        } as any,
      });
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('agent-with-missing-refs');

      expect(agent).toBeInstanceOf(Agent);

      // Should have warnings for missing tools, workflows, agents, and scorers
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Tool "missing-tool"'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Workflow "missing-workflow"'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Agent "missing-agent"'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Scorer "missing-scorer"'));
    });
  });
});
