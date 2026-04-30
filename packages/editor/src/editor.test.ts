import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import { RequestContext } from '@mastra/core/request-context';
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
  tools: { 'test-tool': {} },
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
    await agentsStore?.create({
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

    // Debug log should indicate cache was cleared
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Cleared cache for "cache-test-agent"'));
  });

  it('should clear all agents from Editor cache but not Mastra registry when no agentId', async () => {
    const storage = new InMemoryStore();
    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
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

    // Debug log should indicate all cached entities were cleared
    expect(debugSpy).toHaveBeenCalledWith('[clearCache] Cleared all cached entities');
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
    await agentsStore?.create({
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
      await agentsStore?.create({ agent: sampleStoredAgent });

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

    it('should expose raw config via toRawConfig()', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.create({ agent: sampleStoredAgent });

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('stored-agent-1');
      expect(agent).toBeInstanceOf(Agent);

      const rawConfig = agent?.toRawConfig();
      expect(rawConfig).toBeDefined();
      expect(rawConfig?.id).toBe('stored-agent-1');
      expect(rawConfig?.name).toBe('Test Stored Agent');
      expect(rawConfig?.createdAt).toBeInstanceOf(Date);
      expect(rawConfig?.updatedAt).toBeInstanceOf(Date);
    });

    it('should resolve tools from registered tools', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.create({ agent: sampleStoredAgent });

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
      await agentsStore?.create({ agent: sampleStoredAgent });

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
      await agentsStore?.create({
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
      await agentsStore?.create({ agent: sampleStoredAgent });

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
      await agentsStore?.create({ agent: sampleStoredAgent });

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

    it('should expose raw config via toRawConfig() when fetching a specific version', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.create({ agent: sampleStoredAgent });

      // Get the version that was created
      const versions = await agentsStore?.listVersions({ agentId: 'stored-agent-1' });
      const versionId = versions?.versions[0]?.id;

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('stored-agent-1', { versionId });
      expect(agent).toBeInstanceOf(Agent);

      const rawConfig = agent?.toRawConfig();
      expect(rawConfig).toBeDefined();
      expect(rawConfig?.id).toBe('stored-agent-1');
      expect(rawConfig?.name).toBe('Test Stored Agent');
      expect(rawConfig?.createdAt).toBeInstanceOf(Date);
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

    it('should return raw agent configs', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.create({ agent: sampleStoredAgent });
      await agentsStore?.create({ agent: sampleStoredAgent2 });

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const result = await editor.agent.list();

      expect(result.agents).toHaveLength(2);
      expect(result.agents[0]!.createdAt).toBeInstanceOf(Date);
      expect(result.agents[1]!.createdAt).toBeInstanceOf(Date);
      expect(result.total).toBe(2);
    });

    it('should return pagination info correctly', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      // Create 25 agents
      for (let i = 0; i < 25; i++) {
        await agentsStore?.create({
          agent: {
            ...sampleStoredAgent,
            id: `agent-${i}`,
            name: `Agent ${i}`,
          },
        });
      }

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const result = await editor.agent.list({ page: 0, perPage: 10 });

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
      await agentsStore?.create({ agent: sampleStoredAgent });

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('stored-agent-1');

      expect(agent).toBeInstanceOf(Agent);
      expect(agent?.id).toBe('stored-agent-1');
    });

    it('should resolve workflows from stored config', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.create({
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
      await agentsStore?.create({
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
      await agentsStore?.create({ agent: sampleStoredAgent });

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('stored-agent-1');

      expect(agent).toBeInstanceOf(Agent);
      // The agent should have defaultOptions set
    });

    it('should resolve memory config when editor is available', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.create({
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
    it('should return Agent from getById with generate method', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.create({ agent: sampleStoredAgent });
      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const result = await editor.agent.getById('stored-agent-1');

      // TypeScript should infer: Agent | null
      if (result) {
        expect(typeof result.generate).toBe('function');
      }
    });

    it('should expose raw config via toRawConfig() with storage fields', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.create({ agent: sampleStoredAgent });
      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('stored-agent-1');

      if (agent) {
        const rawConfig = agent.toRawConfig();
        expect(rawConfig).toBeDefined();
        expect(rawConfig?.createdAt).toBeInstanceOf(Date);
        expect(rawConfig?.updatedAt).toBeInstanceOf(Date);
      }
    });

    it('should return raw agent configs from list()', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.create({ agent: sampleStoredAgent });
      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const result = await editor.agent.list();

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
        tools: { 'registered-tool': {} },
        workflows: ['registered-workflow'],
        agents: ['registered-sub-agent'],
        defaultOptions: { maxSteps: 10 },
        metadata: { version: '2.0', feature: 'full-test' },
      };

      await agentsStore?.create({ agent: fullStoredAgent });

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

      await agentsStore?.create({ agent: storedAgentWithScorers });

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

      await agentsStore?.create({ agent: storedAgent });

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
        tools: { 'missing-tool': {} },
        workflows: ['missing-workflow'],
        agents: ['missing-agent'],
        memory: {
          options: {
            readOnly: false,
          },
        } as any,
        scorers: { 'missing-scorer': {} },
      };

      await agentsStore?.create({ agent: storedAgent });

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

    it('should apply tool description overrides from stored config', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'agent-with-tool-override',
          name: 'Tool Override Agent',
          instructions: 'Test agent with tool description override',
          model: { provider: 'openai', name: 'gpt-4' },
          tools: {
            'test-tool': { description: 'Custom overridden description' },
          },
        },
      });

      const editor = new MastraEditor();
      const mastra = new Mastra({
        storage,
        tools: { 'test-tool': mockTool },
        editor,
      });

      const agent = await editor.agent.getById('agent-with-tool-override');
      expect(agent).toBeInstanceOf(Agent);

      const tools = await agent!.listTools();
      expect(tools['test-tool']).toBeDefined();
      expect(tools['test-tool'].description).toBe('Custom overridden description');
    });

    it('should keep original tool description when no override is provided', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'agent-without-tool-override',
          name: 'No Override Agent',
          instructions: 'Test agent without tool description override',
          model: { provider: 'openai', name: 'gpt-4' },
          tools: {
            'test-tool': {},
          },
        },
      });

      const editor = new MastraEditor();
      const mastra = new Mastra({
        storage,
        tools: { 'test-tool': mockTool },
        editor,
      });

      const agent = await editor.agent.getById('agent-without-tool-override');
      expect(agent).toBeInstanceOf(Agent);

      const tools = await agent!.listTools();
      expect(tools['test-tool']).toBeDefined();
      expect(tools['test-tool'].description).toBe('A test tool');
    });
  });

  describe('conditional fields', () => {
    it('should resolve conditional tools based on request context', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      const toolA = createTool({
        id: 'tool-a',
        description: 'Tool A',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async () => ({ output: 'a' }),
      });
      const toolB = createTool({
        id: 'tool-b',
        description: 'Tool B',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async () => ({ output: 'b' }),
      });

      await agentsStore?.create({
        agent: {
          id: 'conditional-tools-agent',
          name: 'Conditional Tools Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          tools: [
            {
              value: { 'tool-a': {} },
              rules: {
                operator: 'AND' as const,
                conditions: [{ field: 'tier', operator: 'equals' as const, value: 'premium' }],
              },
            },
            {
              value: { 'tool-b': {} },
              // No rules = unconditional, always included
            },
          ],
        },
      });

      const editor = new MastraEditor();
      const mastra = new Mastra({
        storage,
        tools: { 'tool-a': toolA, 'tool-b': toolB },
        editor,
      });

      const agent = await editor.agent.getById('conditional-tools-agent');
      expect(agent).toBeInstanceOf(Agent);

      // With premium tier context → should accumulate both tool-a (matched) and tool-b (unconditional)
      const premiumCtx = new RequestContext([['tier', 'premium']]);
      const premiumTools = await agent!.listTools({ requestContext: premiumCtx });
      expect(premiumTools['tool-a']).toBeDefined();
      expect(premiumTools['tool-b']).toBeDefined();

      // With no context → should only get tool-b (unconditional); tool-a rule doesn't match
      const defaultCtx = new RequestContext();
      const defaultTools = await agent!.listTools({ requestContext: defaultCtx });
      expect(defaultTools['tool-b']).toBeDefined();
      expect(defaultTools['tool-a']).toBeUndefined();
    });

    it('should resolve conditional model based on request context', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      // With accumulation, the fallback (no rules) comes first so it always
      // applies, and conditional variants override specific keys on top.
      await agentsStore?.create({
        agent: {
          id: 'conditional-model-agent',
          name: 'Conditional Model Agent',
          instructions: 'Test',
          model: [
            {
              // Base/default model — always included (no rules)
              value: { provider: 'openai', name: 'gpt-4o-mini', temperature: 0.5 },
            },
            {
              // Premium override — merges on top when matched
              value: { provider: 'anthropic', name: 'claude-3-opus', temperature: 0.9, topP: 0.95 },
              rules: {
                operator: 'AND' as const,
                conditions: [{ field: 'tier', operator: 'equals' as const, value: 'premium' }],
              },
            },
          ],
        },
      });

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('conditional-model-agent');
      expect(agent).toBeInstanceOf(Agent);

      // Premium context: base {openai/gpt-4o-mini} merged with {anthropic/claude-3-opus} → anthropic wins
      const premiumCtx = new RequestContext([['tier', 'premium']]);
      const premiumModel = await agent!.getModel({ requestContext: premiumCtx });
      expect(premiumModel.modelId).toBe('claude-3-opus');
      expect(premiumModel.provider).toBe('anthropic');

      // Model-level settings should be forwarded into defaultOptions.modelSettings
      const premiumOpts = await agent!.getDefaultOptions({ requestContext: premiumCtx });
      expect(premiumOpts.modelSettings?.temperature).toBe(0.9);
      expect(premiumOpts.modelSettings?.topP).toBe(0.95);

      // Default context: only base applies → openai/gpt-4o-mini
      const defaultCtx = new RequestContext();
      const defaultModel = await agent!.getModel({ requestContext: defaultCtx });
      expect(defaultModel.modelId).toBe('gpt-4o-mini');
      expect(defaultModel.provider).toBe('openai');

      // Default context model settings
      const defaultOpts = await agent!.getDefaultOptions({ requestContext: defaultCtx });
      expect(defaultOpts.modelSettings?.temperature).toBe(0.5);
    });

    it('should resolve conditional workflows based on request context', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      const workflowA = createWorkflow({
        id: 'workflow-a',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      })
        .then(
          createStep({
            id: 'step-a',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            execute: async () => ({}),
          }),
        )
        .commit();

      const workflowB = createWorkflow({
        id: 'workflow-b',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      })
        .then(
          createStep({
            id: 'step-b',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            execute: async () => ({}),
          }),
        )
        .commit();

      await agentsStore?.create({
        agent: {
          id: 'conditional-wf-agent',
          name: 'Conditional WF Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          workflows: [
            {
              value: ['workflow-a'],
              rules: {
                operator: 'AND' as const,
                conditions: [{ field: 'env', operator: 'equals' as const, value: 'production' }],
              },
            },
            {
              value: ['workflow-b'],
            },
          ],
        },
      });

      const editor = new MastraEditor();
      const mastra = new Mastra({
        storage,
        workflows: { 'workflow-a': workflowA, 'workflow-b': workflowB },
        editor,
      });

      const agent = await editor.agent.getById('conditional-wf-agent');
      expect(agent).toBeInstanceOf(Agent);

      const { RequestContext } = await import('@mastra/core/request-context');

      // Production: accumulates workflow-a (matched) + workflow-b (unconditional)
      const prodCtx = new RequestContext([['env', 'production']]);
      const prodWorkflows = await agent!.listWorkflows({ requestContext: prodCtx });
      expect(Object.keys(prodWorkflows)).toContain('workflow-a');
      expect(Object.keys(prodWorkflows)).toContain('workflow-b');

      // Development: only workflow-b (unconditional); workflow-a rule doesn't match
      const devCtx = new RequestContext([['env', 'development']]);
      const devWorkflows = await agent!.listWorkflows({ requestContext: devCtx });
      expect(Object.keys(devWorkflows)).toContain('workflow-b');
      expect(Object.keys(devWorkflows)).not.toContain('workflow-a');
    });

    it('should pass requestContextSchema to the Agent instance when present', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'agent-with-rcs',
          name: 'Agent With Request Context Schema',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          requestContextSchema: {
            type: 'object',
            properties: {
              tier: { type: 'string', enum: ['free', 'premium'] },
              locale: { type: 'string' },
            },
            required: ['tier'],
          },
        },
      });

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('agent-with-rcs');
      expect(agent).toBeInstanceOf(Agent);
      expect(agent!.requestContextSchema).toBeDefined();
    });

    it('should not set requestContextSchema when not provided in stored agent', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'agent-no-rcs',
          name: 'Agent Without RCS',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
        },
      });

      const editor = new MastraEditor();
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('agent-no-rcs');
      expect(agent).toBeInstanceOf(Agent);
      expect(agent!.requestContextSchema).toBeUndefined();
    });

    it('should handle static fields alongside conditional fields', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'mixed-agent',
          name: 'Mixed Agent',
          instructions: 'Test',
          // Static model
          model: { provider: 'openai', name: 'gpt-4' },
          // Conditional tools
          tools: [
            {
              value: { 'test-tool': { description: 'Premium tool' } },
              rules: {
                operator: 'AND' as const,
                conditions: [{ field: 'tier', operator: 'equals' as const, value: 'premium' }],
              },
            },
            {
              value: { 'test-tool': {} },
            },
          ],
          // Static defaultOptions
          defaultOptions: { maxSteps: 10 },
        },
      });

      const editor = new MastraEditor();
      const mastra = new Mastra({
        storage,
        tools: { 'test-tool': mockTool },
        editor,
      });

      const agent = await editor.agent.getById('mixed-agent');
      expect(agent).toBeInstanceOf(Agent);

      // Static model should work normally
      const { RequestContext } = await import('@mastra/core/request-context');
      const ctx = new RequestContext();
      const model = await agent!.getModel({ requestContext: ctx });
      expect(model.modelId).toBe('gpt-4');
      expect(model.provider).toBe('openai');

      // With no context: only the unconditional fallback matches → test-tool with no description override
      const defaultTools = await agent!.listTools({ requestContext: ctx });
      expect(defaultTools['test-tool']).toBeDefined();
      expect(defaultTools['test-tool'].description).toBe('A test tool');

      // With premium context: both variants match → later unconditional fallback's `test-tool` (no override)
      // merges on top of the conditional variant's `test-tool` (description override 'Premium tool')
      // Since object merge is shallow and the unconditional variant comes second, its empty config wins
      const premiumCtx = new RequestContext([['tier', 'premium']]);
      const premiumTools = await agent!.listTools({ requestContext: premiumCtx });
      expect(premiumTools['test-tool']).toBeDefined();
    });

    it('should handle conditional variant with OR rule group', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      const toolX = createTool({
        id: 'tool-x',
        description: 'Tool X',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async () => ({ output: 'x' }),
      });

      await agentsStore?.create({
        agent: {
          id: 'or-rules-agent',
          name: 'OR Rules Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          tools: [
            {
              value: { 'tool-x': {} },
              rules: {
                operator: 'OR' as const,
                conditions: [
                  { field: 'role', operator: 'equals' as const, value: 'admin' },
                  { field: 'role', operator: 'equals' as const, value: 'superadmin' },
                ],
              },
            },
            {
              value: {},
              // fallback: no tools
            },
          ],
        },
      });

      const editor = new MastraEditor();
      const mastra = new Mastra({
        storage,
        tools: { 'tool-x': toolX },
        editor,
      });

      const agent = await editor.agent.getById('or-rules-agent');
      expect(agent).toBeInstanceOf(Agent);

      const { RequestContext } = await import('@mastra/core/request-context');

      // Admin should get tool-x
      const adminCtx = new RequestContext([['role', 'admin']]);
      const adminTools = await agent!.listTools({ requestContext: adminCtx });
      expect(adminTools['tool-x']).toBeDefined();

      // Superadmin should also get tool-x
      const superCtx = new RequestContext([['role', 'superadmin']]);
      const superTools = await agent!.listTools({ requestContext: superCtx });
      expect(superTools['tool-x']).toBeDefined();

      // Regular user should get empty tools (fallback)
      const userCtx = new RequestContext([['role', 'user']]);
      const userTools = await agent!.listTools({ requestContext: userCtx });
      expect(userTools['tool-x']).toBeUndefined();
    });
  });
});

// ============================================================================
// applyStoredOverrides
// ============================================================================

describe('agent.applyStoredOverrides', () => {
  it('should return the code agent unchanged when no stored config exists', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor();
    const codeAgent = new Agent({
      id: 'code-only-agent',
      name: 'Code Only',
      instructions: 'Original instructions',
      model: 'openai/gpt-4o',
    });

    const mastra = new Mastra({ storage, editor, agents: { codeAgent } });

    const result = await editor.agent.applyStoredOverrides(codeAgent);
    expect(result).toBe(codeAgent); // same reference, no mutation
    const instructions = await result.getInstructions({ requestContext: new RequestContext() });
    expect(instructions).toBe('Original instructions');
  });

  it('should override instructions when stored config has instructions', async () => {
    const storage = new InMemoryStore();
    const agentsStore = await storage.getStore('agents');

    // Create a stored config for the same ID as the code agent
    await agentsStore?.create({
      agent: {
        id: 'override-agent',
        name: 'Override Agent',
        instructions: 'Stored instructions override',
        model: { provider: 'openai', name: 'gpt-4o' },
      },
    });

    const editor = new MastraEditor();
    const codeAgent = new Agent({
      id: 'override-agent',
      name: 'Code Agent',
      instructions: 'Original code instructions',
      model: 'openai/gpt-4o',
    });

    const mastra = new Mastra({ storage, editor, agents: { codeAgent } });

    const result = await editor.agent.applyStoredOverrides(codeAgent);
    const instructions = await result.getInstructions({ requestContext: new RequestContext() });
    expect(instructions).toBe('Stored instructions override');
  });

  it('should NOT override model — model is never overridden from stored config', async () => {
    const storage = new InMemoryStore();
    const agentsStore = await storage.getStore('agents');

    await agentsStore?.create({
      agent: {
        id: 'model-override-agent',
        name: 'Model Override Agent',
        instructions: 'Test',
        model: { provider: 'anthropic', name: 'claude-sonnet-4-20250514' },
      },
    });

    const editor = new MastraEditor();
    const codeAgent = new Agent({
      id: 'model-override-agent',
      name: 'Code Agent',
      instructions: 'Test',
      model: 'openai/gpt-4o',
    });

    const mastra = new Mastra({ storage, editor, agents: { codeAgent } });

    const result = await editor.agent.applyStoredOverrides(codeAgent);
    // Model should remain the code-defined value — stored config model is never applied
    expect(result.model).toBe('openai/gpt-4o');
  });

  it('should merge tools — stored tools override code tools, code-only tools preserved', async () => {
    const anotherTool = createTool({
      id: 'another-tool',
      description: 'Another tool',
      inputSchema: z.object({ x: z.string() }),
      outputSchema: z.object({ y: z.string() }),
      execute: async ({ x }) => ({ y: x }),
    });

    const storage = new InMemoryStore();
    const agentsStore = await storage.getStore('agents');

    // Stored config references 'test-tool' with a description override
    await agentsStore?.create({
      agent: {
        id: 'tools-merge-agent',
        name: 'Tools Merge Agent',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4o' },
        tools: {
          'test-tool': { description: 'Overridden description' },
        },
      },
    });

    const editor = new MastraEditor();
    const codeAgent = new Agent({
      id: 'tools-merge-agent',
      name: 'Code Agent',
      instructions: 'Test',
      model: 'openai/gpt-4o',
      tools: {
        'test-tool': mockTool,
        'another-tool': anotherTool,
      },
    });

    const mastra = new Mastra({
      storage,
      editor,
      agents: { codeAgent },
      tools: { 'test-tool': mockTool, 'another-tool': anotherTool },
    });

    const result = await editor.agent.applyStoredOverrides(codeAgent);
    const tools = await result.listTools();

    // 'another-tool' from code should be preserved
    expect(tools['another-tool']).toBeDefined();

    // 'test-tool' should have the stored description override
    expect(tools['test-tool']).toBeDefined();
    expect(tools['test-tool'].description).toBe('Overridden description');
  });

  it('should not fail when editor is not registered with Mastra', async () => {
    const editor = new MastraEditor();
    const codeAgent = new Agent({
      id: 'orphan-agent',
      name: 'Orphan',
      instructions: 'Test',
      model: 'openai/gpt-4o',
    });

    // applyStoredOverrides should handle the error gracefully and return the agent unchanged
    const result = await editor.agent.applyStoredOverrides(codeAgent);
    expect(result).toBe(codeAgent);
  });
});

describe('MastraEditor.hasEnabledBuilderConfig', () => {
  it('returns false when builder is omitted', () => {
    const editor = new MastraEditor({});
    expect(editor.hasEnabledBuilderConfig()).toBe(false);
  });

  it('returns false when builder.enabled is false', () => {
    const editor = new MastraEditor({ builder: { enabled: false } });
    expect(editor.hasEnabledBuilderConfig()).toBe(false);
  });

  it('returns true when builder is present with defaults', () => {
    const editor = new MastraEditor({ builder: {} });
    expect(editor.hasEnabledBuilderConfig()).toBe(true);
  });

  it('returns true when builder.enabled is true', () => {
    const editor = new MastraEditor({ builder: { enabled: true } });
    expect(editor.hasEnabledBuilderConfig()).toBe(true);
  });

  it('returns true when builder has features', () => {
    const editor = new MastraEditor({ builder: { features: { agent: {} } } });
    expect(editor.hasEnabledBuilderConfig()).toBe(true);
  });
});

describe('MastraEditor.resolveBuilder', () => {
  it('returns undefined when builder is omitted', async () => {
    const editor = new MastraEditor({});
    const result = await editor.resolveBuilder();
    expect(result).toBeUndefined();
  });

  it('returns undefined when builder.enabled is false', async () => {
    const editor = new MastraEditor({ builder: { enabled: false } });
    const result = await editor.resolveBuilder();
    expect(result).toBeUndefined();
  });

  it('returns IAgentBuilder when builder is enabled', async () => {
    const editor = new MastraEditor({ builder: { enabled: true } });
    const result = await editor.resolveBuilder();
    expect(result).toBeDefined();
    expect(typeof result?.enabled).toBe('boolean');
    expect(typeof result?.getFeatures).toBe('function');
    expect(typeof result?.getConfiguration).toBe('function');
  });

  it('caches the builder instance', async () => {
    const editor = new MastraEditor({ builder: {} });
    const result1 = await editor.resolveBuilder();
    const result2 = await editor.resolveBuilder();
    expect(result1).toBe(result2);
  });

  it('passes options to EditorAgentBuilder', async () => {
    const features = { agent: { tools: true } };
    const configuration = { agent: { memory: {} } };
    const editor = new MastraEditor({ builder: { features, configuration } });
    const result = await editor.resolveBuilder();
    expect(result?.getFeatures()).toBe(features);
    expect(result?.getConfiguration()).toBe(configuration);
  });

  it('downgrades browser feature when provider not registered in __browsers', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const editor = new MastraEditor({
      builder: {
        features: { agent: { browser: true } },
        configuration: {
          agent: {
            browser: { type: 'inline' as const, config: { provider: 'stagehand' } },
          },
        },
      },
      // No browsers registered
    });
    const result = await editor.resolveBuilder();
    expect(result?.getFeatures()?.agent?.browser).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no matching browser provider is registered'));
    warnSpy.mockRestore();
  });

  it('keeps browser feature when provider is registered in __browsers', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockBrowserProvider = {
      id: 'stagehand',
      name: 'Stagehand',
      createBrowser: () => ({}) as any,
    };
    const editor = new MastraEditor({
      builder: {
        features: { agent: { browser: true } },
        configuration: {
          agent: {
            browser: { type: 'inline' as const, config: { provider: 'stagehand' } },
          },
        },
      },
      browsers: { stagehand: mockBrowserProvider },
    });
    const result = await editor.resolveBuilder();
    expect(result?.getFeatures()?.agent?.browser).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ============================================================================
// agent.create with builder defaults
// ============================================================================

describe('agent.create with builder defaults', () => {
  it('applies default memory config when input has none', async () => {
    const storage = new InMemoryStore();
    const builderMemory = { vector: 'default-vector', options: { lastMessages: 10 } };
    const editor = new MastraEditor({
      builder: {
        enabled: true,
        configuration: { agent: { memory: builderMemory } },
      },
    });
    new Mastra({ storage, editor });

    const agent = await editor.agent.create({
      id: 'test-agent-no-memory',
      name: 'Test Agent',
      instructions: 'Test',
      model: { provider: 'openai', name: 'gpt-4' },
    });

    const rawConfig = agent.toRawConfig?.();
    expect(rawConfig?.memory).toEqual(builderMemory);
  });

  it('preserves input memory config when provided', async () => {
    const storage = new InMemoryStore();
    const builderMemory = { vector: 'default-vector', options: { lastMessages: 10 } };
    const inputMemory = { vector: 'custom-vector', options: { lastMessages: 5 } };
    const editor = new MastraEditor({
      builder: {
        enabled: true,
        configuration: { agent: { memory: builderMemory } },
      },
    });
    new Mastra({ storage, editor });

    const agent = await editor.agent.create({
      id: 'test-agent-with-memory',
      name: 'Test Agent',
      instructions: 'Test',
      model: { provider: 'openai', name: 'gpt-4' },
      memory: inputMemory,
    });

    const rawConfig = agent.toRawConfig?.();
    expect(rawConfig?.memory).toEqual(inputMemory);
  });

  it('does not override null memory (explicit disable)', async () => {
    const storage = new InMemoryStore();
    const builderMemory = { vector: 'default-vector', options: { lastMessages: 10 } };
    const editor = new MastraEditor({
      builder: {
        enabled: true,
        configuration: { agent: { memory: builderMemory } },
      },
    });
    new Mastra({ storage, editor });

    const agent = await editor.agent.create({
      id: 'test-agent-null-memory',
      name: 'Test Agent',
      instructions: 'Test',
      model: { provider: 'openai', name: 'gpt-4' },
      memory: null,
    });

    const rawConfig = agent.toRawConfig?.();
    expect(rawConfig?.memory).toBeNull();
  });

  it('does nothing when builder has no configuration', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor({
      builder: { enabled: true },
    });
    new Mastra({ storage, editor });

    const agent = await editor.agent.create({
      id: 'test-agent-no-config',
      name: 'Test Agent',
      instructions: 'Test',
      model: { provider: 'openai', name: 'gpt-4' },
    });

    const rawConfig = agent.toRawConfig?.();
    expect(rawConfig?.memory).toBeUndefined();
  });

  it('does nothing when builder is disabled', async () => {
    const storage = new InMemoryStore();
    const builderMemory = { vector: 'default-vector', options: { lastMessages: 10 } };
    const editor = new MastraEditor({
      builder: {
        enabled: false,
        configuration: { agent: { memory: builderMemory } },
      },
    });
    new Mastra({ storage, editor });

    const agent = await editor.agent.create({
      id: 'test-agent-disabled-builder',
      name: 'Test Agent',
      instructions: 'Test',
      model: { provider: 'openai', name: 'gpt-4' },
    });

    const rawConfig = agent.toRawConfig?.();
    expect(rawConfig?.memory).toBeUndefined();
  });

  it('clone() does not apply builder default memory', async () => {
    const storage = new InMemoryStore();
    const builderMemory = { vector: 'default-vector', options: { lastMessages: 50 } };
    const editor = new MastraEditor({
      builder: {
        enabled: true,
        configuration: { agent: { memory: builderMemory } },
      },
    });
    new Mastra({ storage, editor });

    // Create an agent via storage directly (bypassing builder defaults) with no memory
    const agentsStore = await storage.getStore('agents');
    await agentsStore.create({
      agent: {
        id: 'no-memory-agent',
        name: 'No Memory Agent',
        instructions: 'No memory',
        model: { provider: 'openai', name: 'gpt-4' },
        // memory is undefined - no memory config
      },
    });

    const noMemoryAgent = await editor.agent.getById('no-memory-agent');
    expect(noMemoryAgent).not.toBeNull();

    // Clone this agent - should NOT pick up builder defaults
    // clone() copies source agent config exactly, bypassing EditorAgentNamespace.create()
    const clonedNoMemory = await editor.agent.clone(noMemoryAgent!, { newId: 'cloned-no-memory' });
    expect(clonedNoMemory.memory).toBeUndefined();
  });

  it('applies default workspace config when input has none', async () => {
    const storage = new InMemoryStore();
    const builderWorkspace = { type: 'id' as const, workspaceId: 'default-workspace-id' };
    const editor = new MastraEditor({
      builder: {
        enabled: true,
        configuration: { agent: { workspace: builderWorkspace } },
      },
    });
    new Mastra({ storage, editor });

    const agent = await editor.agent.create({
      id: 'test-agent-no-workspace',
      name: 'Test Agent',
      instructions: 'Test',
      model: { provider: 'openai', name: 'gpt-4' },
    });

    const rawConfig = agent.toRawConfig?.();
    expect(rawConfig?.workspace).toEqual(builderWorkspace);
  });

  it('preserves input workspace config when provided', async () => {
    const storage = new InMemoryStore();
    const builderWorkspace = { type: 'id' as const, workspaceId: 'default-workspace-id' };
    const inputWorkspace = { type: 'id' as const, workspaceId: 'custom-workspace-id' };
    const editor = new MastraEditor({
      builder: {
        enabled: true,
        configuration: { agent: { workspace: builderWorkspace } },
      },
    });
    new Mastra({ storage, editor });

    const agent = await editor.agent.create({
      id: 'test-agent-with-workspace',
      name: 'Test Agent',
      instructions: 'Test',
      model: { provider: 'openai', name: 'gpt-4' },
      workspace: inputWorkspace,
    });

    const rawConfig = agent.toRawConfig?.();
    expect(rawConfig?.workspace).toEqual(inputWorkspace);
  });

  it('does not override null workspace (explicit disable)', async () => {
    const storage = new InMemoryStore();
    const builderWorkspace = { type: 'id' as const, workspaceId: 'default-workspace-id' };
    const editor = new MastraEditor({
      builder: {
        enabled: true,
        configuration: { agent: { workspace: builderWorkspace } },
      },
    });
    new Mastra({ storage, editor });

    const agent = await editor.agent.create({
      id: 'test-agent-null-workspace',
      name: 'Test Agent',
      instructions: 'Test',
      model: { provider: 'openai', name: 'gpt-4' },
      workspace: null,
    });

    const rawConfig = agent.toRawConfig?.();
    expect(rawConfig?.workspace).toBeNull();
  });

  it('applies default browser config when input has none', async () => {
    const storage = new InMemoryStore();
    const builderBrowser = {
      type: 'inline' as const,
      config: { provider: 'stagehand', config: { headless: true } },
    };
    const editor = new MastraEditor({
      builder: {
        enabled: true,
        configuration: { agent: { browser: builderBrowser } },
      },
    });
    new Mastra({ storage, editor });

    const agent = await editor.agent.create({
      id: 'test-agent-no-browser',
      name: 'Test Agent',
      instructions: 'Test',
      model: { provider: 'openai', name: 'gpt-4' },
    });

    const rawConfig = agent.toRawConfig?.();
    expect(rawConfig?.browser).toEqual(builderBrowser);
  });

  it('preserves input browser config when provided', async () => {
    const storage = new InMemoryStore();
    const builderBrowser = {
      type: 'inline' as const,
      config: { provider: 'stagehand', config: { headless: true } },
    };
    const inputBrowser = {
      type: 'inline' as const,
      config: { provider: 'browserbase', config: { headless: false } },
    };
    const editor = new MastraEditor({
      builder: {
        enabled: true,
        configuration: { agent: { browser: builderBrowser } },
      },
    });
    new Mastra({ storage, editor });

    const agent = await editor.agent.create({
      id: 'test-agent-with-browser',
      name: 'Test Agent',
      instructions: 'Test',
      model: { provider: 'openai', name: 'gpt-4' },
      browser: inputBrowser,
    });

    const rawConfig = agent.toRawConfig?.();
    expect(rawConfig?.browser).toEqual(inputBrowser);
  });

  it('does not override null browser (explicit disable)', async () => {
    const storage = new InMemoryStore();
    const builderBrowser = {
      type: 'inline' as const,
      config: { provider: 'stagehand', config: { headless: true } },
    };
    const editor = new MastraEditor({
      builder: {
        enabled: true,
        configuration: { agent: { browser: builderBrowser } },
      },
    });
    new Mastra({ storage, editor });

    const agent = await editor.agent.create({
      id: 'test-agent-null-browser',
      name: 'Test Agent',
      instructions: 'Test',
      model: { provider: 'openai', name: 'gpt-4' },
      browser: null,
    });

    const rawConfig = agent.toRawConfig?.();
    expect(rawConfig?.browser).toBeNull();
  });

  it('seeds model from models.default when input omits it', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor({
      builder: {
        enabled: true,
        configuration: {
          agent: {
            models: { default: { provider: 'openai', modelId: 'gpt-4o-mini' } },
          },
        },
      },
    });
    new Mastra({ storage, editor });

    const agent = await editor.agent.create({
      // intentionally no `model` field
      id: 'test-agent-no-model',
      name: 'Test Agent',
      instructions: 'Test',
    } as any);

    const rawConfig = agent.toRawConfig?.();
    // Stored shape uses { provider, name }, not { provider, modelId }.
    expect(rawConfig?.model).toEqual({ provider: 'openai', name: 'gpt-4o-mini' });
  });

  it('does not overwrite an input model with the admin default', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor({
      builder: {
        enabled: true,
        configuration: {
          agent: {
            models: { default: { provider: 'openai', modelId: 'gpt-4o-mini' } },
          },
        },
      },
    });
    new Mastra({ storage, editor });

    const agent = await editor.agent.create({
      id: 'test-agent-with-model',
      name: 'Test Agent',
      instructions: 'Test',
      model: { provider: 'anthropic', name: 'claude-opus-4-7' },
    });

    const rawConfig = agent.toRawConfig?.();
    expect(rawConfig?.model).toEqual({ provider: 'anthropic', name: 'claude-opus-4-7' });
  });

  it('does not seed a model when no admin default is configured', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor({
      builder: {
        enabled: true,
        configuration: { agent: { models: { allowed: [{ provider: 'openai' }] } } },
      },
    });
    new Mastra({ storage, editor });

    // Without a model on input AND no admin default, today's create-path validation
    // continues to require a model — assert by attempting create + expecting a
    // model-related error (not just any throw).
    await expect(
      editor.agent.create({
        id: 'test-agent-no-default',
        name: 'Test Agent',
        instructions: 'Test',
      } as any),
    ).rejects.toThrow(/model/i);
  });
});

describe('Phase 6: agent.create enforces model allowlist', () => {
  it('rejects a create whose model is not in the allowlist', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor({
      builder: {
        enabled: true,
        configuration: {
          agent: {
            models: {
              allowed: [{ provider: 'openai', modelId: 'gpt-4o-mini' }],
              default: { provider: 'openai', modelId: 'gpt-4o-mini' },
            },
          },
        },
      },
    });
    new Mastra({ storage, editor });

    await expect(
      editor.agent.create({
        id: 'rejected',
        name: 'Rejected Agent',
        instructions: 'Test',
        model: { provider: 'anthropic', name: 'claude-opus-4-7' },
      }),
    ).rejects.toMatchObject({ code: 'MODEL_NOT_ALLOWED' });
  });

  it('passes when model matches an allowlist entry', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor({
      builder: {
        enabled: true,
        configuration: {
          agent: {
            models: {
              allowed: [{ provider: 'openai', modelId: 'gpt-4o-mini' }],
              default: { provider: 'openai', modelId: 'gpt-4o-mini' },
            },
          },
        },
      },
    });
    new Mastra({ storage, editor });

    const agent = await editor.agent.create({
      id: 'allowed',
      name: 'Allowed Agent',
      instructions: 'Test',
      model: { provider: 'openai', name: 'gpt-4o-mini' },
    });
    expect(agent.toRawConfig?.()?.model).toEqual({ provider: 'openai', name: 'gpt-4o-mini' });
  });

  it('does not enforce when policy is inactive (no models config)', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor({ builder: { enabled: true } });
    new Mastra({ storage, editor });

    const agent = await editor.agent.create({
      id: 'inactive-ok',
      name: 'OK',
      instructions: 'Test',
      model: { provider: 'anthropic', name: 'claude-opus-4-7' },
    });
    expect(agent).toBeDefined();
  });

  it('rejects a conditional model whose variant is outside the allowlist', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor({
      builder: {
        enabled: true,
        configuration: {
          agent: {
            models: {
              allowed: [{ provider: 'openai', modelId: 'gpt-4o-mini' }],
              default: { provider: 'openai', modelId: 'gpt-4o-mini' },
            },
          },
        },
      },
    });
    new Mastra({ storage, editor });

    await expect(
      editor.agent.create({
        id: 'conditional-rejected',
        name: 'Conditional Rejected',
        instructions: 'Test',
        model: [
          {
            value: { provider: 'openai', name: 'gpt-4o-mini' },
            rules: { operator: 'AND', conditions: [{ field: 'env', operator: 'equals', value: 'prod' }] },
          },
          { value: { provider: 'anthropic', name: 'claude-opus-4-7' } },
        ],
      }),
    ).rejects.toMatchObject({ code: 'MODEL_NOT_ALLOWED' });
  });
});
