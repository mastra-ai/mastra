import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { MastraVector } from '@mastra/core/vector';
import { CompositeVoice } from '@mastra/core/voice';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { vi } from 'vitest';
import type { AdapterTestContext } from './route-adapter-test-suite';

/**
 * Create a mock test tool
 */
export function createTestTool() {
  return createTool({
    id: 'test-tool',
    description: 'A test tool',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    execute: async () => ({ result: 'test' }),
  });
}

/**
 * Create a mock voice provider
 */
export function createMockVoice() {
  const voice = new CompositeVoice({});

  // Mock voice methods to avoid "No provider configured" errors
  vi.spyOn(voice, 'getSpeakers').mockResolvedValue([]);
  vi.spyOn(voice, 'getListener').mockResolvedValue({ enabled: false } as any);

  return voice;
}

/**
 * Create a mock memory instance
 */
export function createMockMemory() {
  const storage = new InMemoryStore();
  const mockMemory = new MockMemory({ storage });

  return mockMemory;
}

/**
 * Create a test agent with all necessary mocks
 */
export function createTestAgent(
  options: {
    name?: string;
    description?: string;
    instructions?: string;
    tools?: Record<string, any>;
    voice?: any;
    memory?: any;
    model?: any;
  } = {},
) {
  const testTool = createTestTool();
  const mockVoice = createMockVoice();
  const mockMemory = createMockMemory();

  const agent = new Agent({
    name: options.name || 'test-agent',
    description: options.description || 'A test agent',
    instructions: options.instructions || 'Test instructions',
    model: options.model || 'openai/gpt-4.1',
    tools: options.tools || { 'test-tool': testTool },
    voice: options.voice || mockVoice,
    memory: options.memory || mockMemory,
  });

  return agent;
}

/**
 * Mock all agent methods that would normally require API calls
 */
export function mockAgentMethods(agent: Agent) {
  // Mock generate method
  vi.spyOn(agent, 'generate').mockResolvedValue({ text: 'test response' } as any);

  // Create a reusable mock stream that returns a proper ReadableStream
  const createMockStream = () => {
    return new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'text-delta', textDelta: 'test' });
        controller.close();
      },
    });
  };

  // Mock stream method
  vi.spyOn(agent, 'stream').mockResolvedValue(createMockStream() as any);

  // Mock legacy generate - returns a stream
  vi.spyOn(agent, 'generateLegacy').mockResolvedValue(createMockStream() as any);

  // Mock streamLegacy - needs to return an object with toDataStreamResponse method
  const mockStreamResult = {
    ...createMockStream(),
    toDataStreamResponse: vi.fn().mockReturnValue(createMockStream()),
  };
  vi.spyOn(agent, 'streamLegacy').mockResolvedValue(mockStreamResult as any);

  // Mock approveToolCall method
  vi.spyOn(agent, 'approveToolCall').mockResolvedValue(createMockStream() as any);

  // Mock declineToolCall method
  vi.spyOn(agent, 'declineToolCall').mockResolvedValue(createMockStream() as any);

  // Mock network method
  vi.spyOn(agent, 'network').mockResolvedValue(createMockStream() as any);

  // Mock getVoice to return the voice object
  const mockVoice = createMockVoice();
  vi.spyOn(agent, 'getVoice').mockReturnValue(mockVoice);
}

/**
 * Create a test workflow with mocked methods
 */
export function createTestWorkflow(
  options: {
    id?: string;
    description?: string;
  } = {},
) {
  const workflow = createWorkflow({
    id: options.id || 'test-workflow',
    description: options.description || 'A test workflow',
  })
    .step(
      createStep({
        id: 'step-1',
        execute: async () => ({ result: 'test' }),
      }),
    )
    .commit();

  return workflow;
}

/**
 * Mock workflow execution methods
 */
export function mockWorkflowMethods(workflow: any) {
  // Create a mock stream for workflow execution
  const createMockWorkflowStream = () => {
    return {
      fullStream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'step-start', stepId: 'step-1' });
          controller.enqueue({ type: 'step-end', stepId: 'step-1', result: { result: 'test' } });
          controller.close();
        },
      }),
    };
  };

  // Mock execute method
  vi.spyOn(workflow, 'execute').mockResolvedValue({ result: 'test' });

  // Mock stream methods
  vi.spyOn(workflow, 'stream').mockResolvedValue(createMockWorkflowStream() as any);
  vi.spyOn(workflow, 'streamVNext').mockResolvedValue(createMockWorkflowStream() as any);
}

/**
 * Create a default test context with mocked Mastra instance, agents, workflows, etc.
 * This provides everything needed for adapter integration tests.
 */
export function createDefaultTestContext(): AdapterTestContext {
  // Create test agent with mocks
  const agent = createTestAgent({ name: 'test-agent' });
  mockAgentMethods(agent);

  // Create test workflow with mocks
  const workflow = createTestWorkflow({ id: 'test-workflow' });
  mockWorkflowMethods(workflow);

  // Create Mastra instance with all test entities
  const mastra = new Mastra({
    logger: false,
    agents: {
      'test-agent': agent,
    },
    workflows: {
      'test-workflow': workflow,
    },
  });

  return {
    mastra,
  };
}
