/**
 * Test Setup Helpers
 *
 * Reusable factory functions for creating test resources (agents, workflows, etc.)
 * to be used across route test files.
 */

import { PassThrough } from 'stream';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { MockStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { MastraVoice, CompositeVoice } from '@mastra/core/voice';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { vi } from 'vitest';
import { z } from 'zod';

/**
 * Mock Voice implementation for testing
 */
export class MockVoice extends MastraVoice {
  async speak(): Promise<NodeJS.ReadableStream> {
    const stream = new PassThrough();
    stream.end('mock audio');
    return stream;
  }

  async listen(): Promise<string> {
    return 'transcribed text';
  }

  async getSpeakers() {
    return [];
  }

  async getListener() {
    return { enabled: false };
  }
}

/**
 * Creates a test tool with basic schema
 */
export function createTestTool(
  overrides: {
    id?: string;
    description?: string;
    inputSchema?: z.ZodTypeAny;
    outputSchema?: z.ZodTypeAny;
    execute?: (input: any) => Promise<any>;
  } = {},
) {
  return createTool({
    id: overrides.id || 'test-tool',
    description: overrides.description || 'A test tool',
    inputSchema: overrides.inputSchema || z.object({ key: z.string() }),
    outputSchema: overrides.outputSchema || z.object({ result: z.string() }),
    execute: overrides.execute || (async _inputData => ({ result: 'success' })),
  });
}

/**
 * Creates a mock voice provider
 */
export function createMockVoice(speaker = 'alloy') {
  return new CompositeVoice({
    output: new MockVoice({ speaker }),
    input: new MockVoice({ speaker }),
  });
}

/**
 * Creates a mock memory instance with __registerMastra
 */
export function createMockMemory() {
  const mockMemory = new MockMemory();
  (mockMemory as any).__registerMastra = vi.fn();
  return mockMemory;
}

/**
 * Creates a test agent with all common mocks configured
 */
export function createTestAgent(
  overrides: {
    name?: string;
    description?: string;
    instructions?: string;
    tools?: Record<string, any>;
    voice?: CompositeVoice;
    memory?: MockMemory;
    model?: any;
  } = {},
) {
  const testTool = createTestTool();
  const mockVoice = createMockVoice();
  const mockMemory = createMockMemory();

  const agent = new Agent({
    name: overrides.name || 'test-agent',
    description: overrides.description || 'A test agent',
    instructions: overrides.instructions || 'Test instructions',
    model: overrides.model || openai('gpt-4o'),
    tools: overrides.tools || { 'test-tool': testTool },
    voice: overrides.voice || mockVoice,
    memory: overrides.memory || mockMemory,
  });

  return agent;
}

/**
 * Adds common agent mocks (generate, stream, getModelList)
 */
export function mockAgentMethods(agent: Agent) {
  // Mock agent methods that would normally require API calls
  vi.spyOn(agent, 'generate').mockResolvedValue({ text: 'test response' } as any);
  vi.spyOn(agent, 'stream').mockResolvedValue({
    toTextStreamResponse: vi.fn().mockReturnValue(new Response()),
    toDataStreamResponse: vi.fn().mockReturnValue(new Response()),
  } as any);

  // Mock model list methods with proper model data structure
  vi.spyOn(agent, 'getModelList').mockResolvedValue([
    {
      id: 'id1',
      modelId: 'gpt-4o',
      provider: 'openai',
      model: {
        modelId: 'gpt-4o',
        provider: 'openai',
        specificationVersion: 'v1',
      },
    },
    {
      id: 'id2',
      modelId: 'gpt-4o-mini',
      provider: 'openai',
      model: {
        modelId: 'gpt-4o-mini',
        provider: 'openai',
        specificationVersion: 'v1',
      },
    },
  ] as any);

  return agent;
}

/**
 * Creates a test workflow with a simple step
 */
export function createTestWorkflow(
  overrides: {
    id?: string;
    description?: string;
    inputSchema?: z.ZodTypeAny;
    outputSchema?: z.ZodTypeAny;
  } = {},
) {
  const step1 = createStep({
    id: 'step1',
    description: 'First step',
    inputSchema: z.object({ name: z.string() }),
    outputSchema: z.object({ greeting: z.string() }),
    execute: async ({ inputData }) => ({ greeting: `Hello ${inputData.name}` }),
  });

  const workflow = createWorkflow({
    id: overrides.id || 'test-workflow',
    description: overrides.description || 'A test workflow',
    inputSchema: overrides.inputSchema || z.object({ name: z.string() }),
    outputSchema: overrides.outputSchema || z.object({ greeting: z.string() }),
  });

  workflow.then(step1);

  return workflow;
}

/**
 * Creates a test Mastra instance with optional resources
 */
export function createTestMastra(
  config: {
    agents?: Record<string, Agent>;
    workflows?: Record<string, any>;
    storage?: MockStore;
    [key: string]: any;
  } = {},
) {
  return new Mastra({
    logger: false,
    storage: config.storage || new MockStore(),
    ...config,
  });
}

/**
 * Complete setup for agent routes testing
 * Returns a configured agent and mastra instance
 */
export function setupAgentTests() {
  const agent = createTestAgent();
  mockAgentMethods(agent);

  const mastra = createTestMastra({
    agents: { 'test-agent': agent },
  });

  return { agent, mastra };
}

/**
 * Complete setup for workflow routes testing
 * Returns a configured workflow and mastra instance
 */
export function setupWorkflowTests() {
  const workflow = createTestWorkflow();

  const mastra = createTestMastra({
    workflows: { 'test-workflow': workflow },
  });

  return { workflow, mastra };
}

/**
 * Complete setup for memory routes testing
 * Returns a configured memory and mastra instance
 */
export function setupMemoryTests() {
  const memory = createMockMemory();

  const mastra = createTestMastra({
    memory,
  });

  return { memory, mastra };
}

/**
 * Creates an InMemoryTaskStore for A2A testing
 */
export function createTaskStore() {
  // Import InMemoryTaskStore dynamically to avoid circular deps
  const { InMemoryTaskStore } = require('../../../a2a/store');
  return new InMemoryTaskStore();
}

/**
 * Complete setup for A2A routes testing
 * Returns a configured agent, task store, and mastra instance
 */
export function setupA2ATests() {
  const agent = createTestAgent();
  mockAgentMethods(agent);
  const taskStore = createTaskStore();

  const mastra = createTestMastra({
    agents: { 'test-agent': agent },
  });

  return { agent, taskStore, mastra };
}
