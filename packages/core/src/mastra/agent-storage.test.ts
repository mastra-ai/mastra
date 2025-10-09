import { MockLanguageModelV1 } from 'ai/test';
import { describe, expect, it, beforeEach } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { createTool } from '../tools';
import { createWorkflow, createStep } from '../workflows';
import type { Workflow } from '../workflows';
import { Mastra } from './index';

describe('Mastra Agent Storage', () => {
  let mastra: Mastra;
  let storage: InMemoryStore;
  let testWorkflow: Workflow<any, any, any, any, any, any>;

  beforeEach(() => {
    storage = new InMemoryStore();

    // Create a simple test workflow
    const step1 = createStep({
      id: 'step1',
      execute: async () => {
        return { result: 'success' };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    testWorkflow = createWorkflow({
      id: 'testWorkflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
    });

    testWorkflow.then(step1 as any).commit();

    // Create a simple test tool
    const testTool = createTool({
      id: 'testTool',
      description: 'A test tool that returns a greeting',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ greeting: z.string() }),
      execute: async ({ context }) => {
        return { greeting: `Hello, ${context.name}!` };
      },
    });

    mastra = new Mastra({
      storage,
      logger: false,
      workflows: {
        testWorkflow,
      },
      tools: {
        testTool,
      },
    });
  });

  describe('createAgent', () => {
    it('should create an agent configuration in storage', async () => {
      const agentConfig = {
        id: 'test-agent-1',
        name: 'Test Agent 1',
        description: 'This is a test agent for testing purposes',
        workflowIds: ['workflow-1', 'workflow-2'],
        agentIds: [{ agentId: 'sub-agent-1', from: 'CODE' as const }],
        toolIds: ['tool-1', 'tool-2'],
        model: 'gpt-4',
        instructions: 'You are a helpful test agent.',
      };

      await mastra.createAgent(agentConfig);

      // Verify it was stored
      const storedAgent = await storage.getAgent(agentConfig.id);
      expect(storedAgent).not.toBeNull();
      expect(storedAgent!.id).toBe(agentConfig.id);
      expect(storedAgent!.name).toBe(agentConfig.name);
      expect(storedAgent!.description).toBe(agentConfig.description);
      expect(storedAgent!.workflowIds).toEqual(agentConfig.workflowIds);
      expect(storedAgent!.agentIds).toEqual(agentConfig.agentIds);
      expect(storedAgent!.toolIds).toEqual(agentConfig.toolIds);
      expect(storedAgent!.model).toBe(agentConfig.model);
      expect(storedAgent!.instructions).toBe(agentConfig.instructions);
    });

    it('should create an agent without description', async () => {
      const agentConfig = {
        id: 'test-agent-no-desc',
        name: 'Test Agent No Desc',
        model: 'gpt-4',
        instructions: 'You are a helpful test agent.',
      };

      await mastra.createAgent(agentConfig);

      // Verify it was stored without description
      const storedAgent = await storage.getAgent(agentConfig.id);
      expect(storedAgent).not.toBeNull();
      expect(storedAgent!.id).toBe(agentConfig.id);
      expect(storedAgent!.description).toBeUndefined();
    });

    it('should create an agent with memory configuration', async () => {
      const agentConfig = {
        id: 'test-agent-with-memory',
        name: 'Test Agent With Memory',
        model: 'gpt-4',
        instructions: 'You are a helpful test agent with memory.',
        memoryConfig: {
          lastMessages: 10,
          workingMemory: {
            enabled: true,
          },
        },
      };

      await mastra.createAgent(agentConfig);

      // Verify it was stored with memory config
      const storedAgent = await storage.getAgent(agentConfig.id);
      expect(storedAgent).not.toBeNull();
      expect(storedAgent!.id).toBe(agentConfig.id);
      expect(storedAgent!.memoryConfig).toBeDefined();
      expect(storedAgent!.memoryConfig?.lastMessages).toBe(10);
      expect(storedAgent!.memoryConfig?.workingMemory?.enabled).toBe(true);
    });

    it('should throw error when storage is not configured', async () => {
      const mastraWithoutStorage = new Mastra({ logger: false });

      await expect(
        mastraWithoutStorage.createAgent({
          id: 'test-agent',
          name: 'Test Agent',
          model: 'gpt-4',
          instructions: 'Test',
        }),
      ).rejects.toThrow('Storage is not configured');
    });
  });

  describe('getAgentFromConfig', () => {
    it('should retrieve an agent configuration from storage', async () => {
      const agentConfig = {
        id: 'test-agent-2',
        name: 'Test Agent 2',
        workflowIds: ['workflow-a'],
        agentIds: [],
        toolIds: ['tool-x', 'tool-y'],
        model: 'claude-3',
        instructions: 'You are a retrieval test agent.',
      };

      await mastra.createAgent(agentConfig);

      const retrievedAgent = await mastra.getAgentFromConfig(agentConfig.id);

      expect(retrievedAgent).not.toBeNull();
      expect(retrievedAgent!.id).toBe(agentConfig.id);
      expect(retrievedAgent!.name).toBe(agentConfig.name);
      // expect(retrievedAgent!.workflowIds).toEqual(agentConfig.workflowIds);
      // expect(retrievedAgent!.toolIds).toEqual(agentConfig.toolIds);
      expect(retrievedAgent!.model).toBe(agentConfig.model);
      expect(retrievedAgent!.instructions).toBe(agentConfig.instructions);
    });

    it('should return error for non-existent agent', async () => {
      await expect(mastra.getAgentFromConfig('non-existent-id')).rejects.toThrow('Agent not found');
    });

    it('should retrieve an agent with memory configuration', async () => {
      const agentConfig = {
        id: 'memory-agent',
        name: 'Memory Agent',
        model: 'gpt-4',
        instructions: 'You are a test agent with memory.',
        memoryConfig: {
          lastMessages: 5,
          workingMemory: {
            enabled: true,
          },
        },
      };

      await mastra.createAgent(agentConfig);

      const agent = await mastra.getAgentFromConfig(agentConfig.id);
      expect(agent).toBeInstanceOf(Agent);
      expect(agent.name).toBe(agentConfig.name);

      // Verify the agent has memory configured (it will be a function)
      expect(agent.hasOwnMemory()).toBe(true);
    });

    it('should throw error when storage is not configured', async () => {
      const mastraWithoutStorage = new Mastra({ logger: false });

      await expect(mastraWithoutStorage.getAgentFromConfig('test-agent')).rejects.toThrow('Storage is not configured');
    });
  });

  describe('listAgentsFromConfig', () => {
    it('should list all agent configurations from storage', async () => {
      const agent1Config = {
        id: 'list-agent-1',
        name: 'List Agent 1',
        workflowIds: ['workflow-1'],
        toolIds: ['tool-1'],
        model: 'gpt-4',
        instructions: 'First list test agent.',
      };

      const agent2Config = {
        id: 'list-agent-2',
        name: 'List Agent 2',
        workflowIds: ['workflow-2'],
        agentIds: [{ agentId: 'sub-agent-1', from: 'CODE' as const }],
        toolIds: ['tool-2', 'tool-3'],
        model: 'claude-3',
        instructions: 'Second list test agent.',
      };

      await mastra.createAgent(agent1Config);
      await new Promise(resolve => setTimeout(resolve, 1)); // Ensure different timestamps
      await mastra.createAgent(agent2Config);

      const agents = await mastra.listAgentsFromConfig();

      expect(agents).toHaveLength(2);
      // Should be sorted by createdAt DESC (newest first)
      expect(agents[0].id).toBe(agent2Config.id);
      expect(agents[1].id).toBe(agent1Config.id);
    });

    it('should return empty array when no agents exist', async () => {
      const agents = await mastra.listAgentsFromConfig();
      expect(agents).toHaveLength(0);
    });

    it('should throw error when storage is not configured', async () => {
      const mastraWithoutStorage = new Mastra({ logger: false });

      await expect(mastraWithoutStorage.listAgentsFromConfig()).rejects.toThrow('Storage is not configured');
    });
  });

  describe('getAgent - instantiate Agent from config', () => {
    it('should instantiate an Agent from stored configuration', async () => {
      // First create an agent configuration
      const agentConfig = {
        id: 'instantiate-agent-1',
        name: 'Instantiate Agent 1',
        workflowIds: [],
        agentIds: [],
        toolIds: [],
        model: 'gpt-4',
        instructions: 'You are an agent created from storage.',
      };

      await mastra.createAgent(agentConfig);

      // Now get the agent as an Agent instance
      const agent = await mastra.getAgentFromConfig(agentConfig.id);

      expect(agent).toBeInstanceOf(Agent);
      expect(agent.name).toBe(agentConfig.name);
      expect(agent.id).toBe(agentConfig.id);
    });

    it('should create an agent with the correct model', async () => {
      const agentConfig = {
        id: 'model-test-agent',
        name: 'Model Test Agent',
        workflowIds: [],
        agentIds: [],
        toolIds: [],
        model: 'openai/gpt-4o',
        instructions: 'You are a model test agent.',
      };

      await mastra.createAgent(agentConfig);
      const agent = await mastra.getAgentFromConfig(agentConfig.id);

      expect(agent).toBeInstanceOf(Agent);
      // The model string should be stored in the agent
      const model = await agent.getModel();
      expect(model).toBeDefined();
    });

    it('should create an agent with the correct instructions', async () => {
      const agentConfig = {
        id: 'instructions-test-agent',
        name: 'Instructions Test Agent',
        workflowIds: [],
        agentIds: [],
        toolIds: [],
        model: 'gpt-4',
        instructions: 'You are a helpful assistant with specific instructions.',
      };

      await mastra.createAgent(agentConfig);
      const agent = await mastra.getAgentFromConfig(agentConfig.id);

      expect(agent).toBeInstanceOf(Agent);
      const instructions = await agent.getInstructions();
      expect(instructions).toBe(agentConfig.instructions);
    });

    it('should throw null for non-existent agent', async () => {
      await expect(mastra.getAgentFromConfig('foo-agent')).rejects.toThrow('Agent not found');
    });

    it('should throw error when storage is not configured', async () => {
      const mastraWithoutStorage = new Mastra({ logger: false });

      await expect(mastraWithoutStorage.getAgentFromConfig('test-agent')).rejects.toThrow('Storage is not configured');
    });

    it('should create agent with mastra instance injected', async () => {
      const agentConfig = {
        id: 'mastra-injection-test',
        name: 'Mastra Injection Test',
        workflowIds: [],
        agentIds: [],
        toolIds: [],
        model: 'gpt-4',
        instructions: 'You are a test agent.',
      };

      await mastra.createAgent(agentConfig);
      const agent = await mastra.getAgentFromConfig(agentConfig.id);

      expect(agent).toBeInstanceOf(Agent);
      // The agent should have access to the mastra instance
      expect(agent.getMastraInstance()).toBe(mastra);
    });

    it('should work with a functioning agent instance', async () => {
      // Register tools and workflows in mastra
      const mastraWithDeps = new Mastra({
        storage,
        logger: false,
        agents: {
          existingAgent: new Agent({
            name: 'existingAgent',
            instructions: 'Existing agent',
            model: new MockLanguageModelV1({
              doGenerate: async () => ({
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20 },
                text: 'Test response',
              }),
            }),
          }),
        },
      });

      const agentConfig = {
        id: 'functional-agent',
        name: 'Functional Agent',
        workflowIds: [],
        agentIds: [],
        toolIds: [],
        model: 'gpt-4',
        instructions: 'You are a functional test agent.',
      };

      await mastraWithDeps.createAgent(agentConfig);
      const agent = await mastraWithDeps.getAgentFromConfig(agentConfig.id);

      expect(agent).toBeInstanceOf(Agent);
      expect(agent.name).toBe(agentConfig.name);
    });
  });

  describe('Integration test: full lifecycle', () => {
    it('should handle complete agent lifecycle', async () => {
      const agentConfig = {
        id: 'lifecycle-agent',
        name: 'Lifecycle Agent',
        workflowIds: ['workflow-1'],
        agentIds: [],
        toolIds: ['tool-1', 'tool-2'],
        model: 'gpt-4',
        instructions: 'You are a lifecycle test agent.',
      };

      // Create agent
      await mastra.createAgent(agentConfig);

      // List agents
      let agents = await mastra.listAgentsFromConfig();
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe(agentConfig.id);

      // Get agent config
      const storedConfig = await mastra.getAgentFromConfig(agentConfig.id);
      expect(storedConfig).not.toBeNull();
      expect(storedConfig!.name).toBe(agentConfig.name);

      // Get agent instance
      const agent = await mastra.getAgentFromConfig(agentConfig.id);
      expect(agent).toBeInstanceOf(Agent);
      expect(agent.name).toBe(agentConfig.name);
    });
  });

  describe('generate on agent from config', () => {
    it('should generate on agent from config', async () => {
      const agentConfig = {
        id: 'generate-agent',
        name: 'Generate Agent',
        model: 'openai/gpt-4o',
        instructions: 'You are a generate test agent.',
      };

      await mastra.createAgent(agentConfig);
      const agent = await mastra.getAgentFromConfig(agentConfig.id);
      const result = await agent.generate('What is the weather?');
      expect(result).toBeDefined();
      console.log(result);
    });

    it('should resolve workflows when creating agent from config', async () => {
      const agentConfig = {
        id: 'workflow-agent',
        name: 'Workflow Agent',
        model: 'openai/gpt-4o',
        instructions: 'You are an agent with workflows.',
        workflowIds: ['testWorkflow'],
      };

      await mastra.createAgent(agentConfig);
      const agent = await mastra.getAgentFromConfig(agentConfig.id);

      expect(agent).toBeInstanceOf(Agent);
      expect(agent.name).toBe(agentConfig.name);

      // Check that the agent has the workflow
      const workflows = await agent.getWorkflows();
      expect(workflows).toBeDefined();
      expect(workflows.testWorkflow).toBeDefined();
      expect(workflows.testWorkflow.name).toBe('testWorkflow');
    });

    it('should resolve tools when creating agent from config', async () => {
      const agentConfig = {
        id: 'tool-agent',
        name: 'Tool Agent',
        model: 'openai/gpt-4o',
        instructions: 'You are an agent with tools.',
        toolIds: ['testTool'],
      };

      await mastra.createAgent(agentConfig);
      const agent = await mastra.getAgentFromConfig(agentConfig.id);

      expect(agent).toBeInstanceOf(Agent);
      expect(agent.name).toBe(agentConfig.name);

      // Check that the agent has the tool
      const tools = await agent.getTools();
      console.log('Tools returned:', tools, 'Type:', typeof tools, 'IsArray:', Array.isArray(tools));
      expect(tools).toBeDefined();
      // Tools are passed as an array, but getTools() may convert them
      if (Array.isArray(tools)) {
        expect(tools.length).toBeGreaterThan(0);
      } else {
        // If it's an object/record, check it has keys
        expect(Object.keys(tools).length).toBeGreaterThan(0);
      }
    });

    it('should resolve both workflows and tools when creating agent from config', async () => {
      const agentConfig = {
        id: 'combined-agent',
        name: 'Combined Agent',
        model: 'openai/gpt-4o',
        instructions: 'You are an agent with workflows and tools.',
        workflowIds: ['testWorkflow'],
        toolIds: ['testTool'],
      };

      await mastra.createAgent(agentConfig);
      const agent = await mastra.getAgentFromConfig(agentConfig.id);

      expect(agent).toBeInstanceOf(Agent);

      // Check workflows
      const workflows = await agent.getWorkflows();
      expect(workflows).toBeDefined();
      expect(workflows.testWorkflow).toBeDefined();

      // Check tools
      const tools = await agent.getTools();
      expect(tools).toBeDefined();
      expect(tools.testTool).toBeDefined();
    });
  });

  describe('Agent References with CODE and CONFIG', () => {
    it('should resolve CODE agent references from Mastra registry', async () => {
      // Register a code agent in Mastra
      const codeAgent = new Agent({
        name: 'codeAgent',
        instructions: 'I am a code agent',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: 'Code agent response',
          }),
        }),
      });

      const mastraWithCodeAgent = new Mastra({
        storage,
        logger: false,
        agents: {
          codeAgent,
        },
      });

      // Create a config agent that references the code agent
      const parentAgentConfig = {
        id: 'parent-agent',
        name: 'Parent Agent',
        model: 'gpt-4',
        instructions: 'I can use other agents',
        agentIds: [{ agentId: 'codeAgent', from: 'CODE' as const }],
      };

      await mastraWithCodeAgent.createAgent(parentAgentConfig);
      const parentAgent = await mastraWithCodeAgent.getAgentFromConfig('parent-agent');

      expect(parentAgent).toBeInstanceOf(Agent);
      const subAgents = await parentAgent.listAgents();
      expect(subAgents).toBeDefined();
      expect(subAgents.codeAgent).toBeDefined();
      expect(subAgents.codeAgent).toBe(codeAgent);
    });

    it('should resolve CONFIG agent references from storage recursively', async () => {
      // Create a base config agent
      const baseAgentConfig = {
        id: 'base-agent',
        name: 'Base Agent',
        model: 'gpt-4',
        instructions: 'I am a base agent',
      };

      await mastra.createAgent(baseAgentConfig);

      // Create a parent agent that references the base agent from CONFIG
      const parentAgentConfig = {
        id: 'parent-config-agent',
        name: 'Parent Config Agent',
        model: 'gpt-4',
        instructions: 'I use other config agents',
        agentIds: [{ agentId: 'base-agent', from: 'CONFIG' as const }],
      };

      await mastra.createAgent(parentAgentConfig);
      const parentAgent = await mastra.getAgentFromConfig('parent-config-agent');

      expect(parentAgent).toBeInstanceOf(Agent);
      const subAgents = await parentAgent.listAgents();
      expect(subAgents).toBeDefined();
      expect(subAgents['base-agent']).toBeDefined();
      expect(subAgents['base-agent']).toBeInstanceOf(Agent);
      // The agent's name comes from the config's name field, which is 'Base Agent'
      expect(subAgents['base-agent'].name).toBe('Base Agent');
    });

    it('should handle mixed CODE and CONFIG agent references', async () => {
      // Register a code agent
      const codeAgent = new Agent({
        name: 'mixedCodeAgent',
        instructions: 'I am from code',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: 'Response',
          }),
        }),
      });

      const mastraWithMixed = new Mastra({
        storage,
        logger: false,
        agents: {
          mixedCodeAgent: codeAgent,
        },
      });

      // Create a config agent
      const configAgentConfig = {
        id: 'mixed-config-agent',
        name: 'Mixed Config Agent',
        model: 'gpt-4',
        instructions: 'I am from config',
      };

      await mastraWithMixed.createAgent(configAgentConfig);

      // Create a parent agent that references both
      const parentAgentConfig = {
        id: 'mixed-parent-agent',
        name: 'Mixed Parent Agent',
        model: 'gpt-4',
        instructions: 'I use both code and config agents',
        agentIds: [
          { agentId: 'mixedCodeAgent', from: 'CODE' as const },
          { agentId: 'mixed-config-agent', from: 'CONFIG' as const },
        ],
      };

      await mastraWithMixed.createAgent(parentAgentConfig);
      const parentAgent = await mastraWithMixed.getAgentFromConfig('mixed-parent-agent');

      expect(parentAgent).toBeInstanceOf(Agent);
      const subAgents = await parentAgent.listAgents();
      expect(subAgents).toBeDefined();
      expect(Object.keys(subAgents)).toHaveLength(2);
      expect(subAgents.mixedCodeAgent).toBe(codeAgent);
      expect(subAgents['mixed-config-agent']).toBeInstanceOf(Agent);
    });

    it('should handle deeply nested CONFIG agent references', async () => {
      // Create level 3 agent
      await mastra.createAgent({
        id: 'level-3-agent',
        name: 'Level 3',
        model: 'gpt-4',
        instructions: 'Bottom level',
      });

      // Create level 2 agent that references level 3
      await mastra.createAgent({
        id: 'level-2-agent',
        name: 'Level 2',
        model: 'gpt-4',
        instructions: 'Middle level',
        agentIds: [{ agentId: 'level-3-agent', from: 'CONFIG' as const }],
      });

      // Create level 1 agent that references level 2
      await mastra.createAgent({
        id: 'level-1-agent',
        name: 'Level 1',
        model: 'gpt-4',
        instructions: 'Top level',
        agentIds: [{ agentId: 'level-2-agent', from: 'CONFIG' as const }],
      });

      const level1Agent = await mastra.getAgentFromConfig('level-1-agent');
      expect(level1Agent).toBeInstanceOf(Agent);

      const level1SubAgents = await level1Agent.listAgents();
      expect(level1SubAgents['level-2-agent']).toBeDefined();

      const level2Agent = level1SubAgents['level-2-agent'];
      const level2SubAgents = await level2Agent.listAgents();
      expect(level2SubAgents['level-3-agent']).toBeDefined();
      // The agent's name comes from the config's name field, which is 'Level 3'
      expect(level2SubAgents['level-3-agent'].name).toBe('Level 3');
    });

    it('should gracefully handle missing CODE agent references', async () => {
      const parentAgentConfig = {
        id: 'missing-code-ref-agent',
        name: 'Missing Code Ref Agent',
        model: 'gpt-4',
        instructions: 'I reference a missing code agent',
        agentIds: [{ agentId: 'non-existent-code-agent', from: 'CODE' as const }],
      };

      await mastra.createAgent(parentAgentConfig);
      const parentAgent = await mastra.getAgentFromConfig('missing-code-ref-agent');

      expect(parentAgent).toBeInstanceOf(Agent);
      const subAgents = await parentAgent.listAgents();
      // Should be defined but empty since the reference failed
      expect(subAgents).toBeDefined();
      expect(subAgents['non-existent-code-agent']).toBeUndefined();
    });

    it('should gracefully handle missing CONFIG agent references', async () => {
      const parentAgentConfig = {
        id: 'missing-config-ref-agent',
        name: 'Missing Config Ref Agent',
        model: 'gpt-4',
        instructions: 'I reference a missing config agent',
        agentIds: [{ agentId: 'non-existent-config-agent', from: 'CONFIG' as const }],
      };

      await mastra.createAgent(parentAgentConfig);

      // Should not throw, but log a warning
      const parentAgent = await mastra.getAgentFromConfig('missing-config-ref-agent');

      expect(parentAgent).toBeInstanceOf(Agent);
      const subAgents = await parentAgent.listAgents();
      expect(subAgents).toBeDefined();
      expect(subAgents['non-existent-config-agent']).toBeUndefined();
    });
  });
});
