import { PassThrough } from 'stream';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { SpanType } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { MastraVector } from '@mastra/core/vector';
import { MastraVoice, CompositeVoice } from '@mastra/core/voice';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { vi } from 'vitest';
import { InMemoryTaskStore } from '../../../a2a/store';
import { WorkflowRegistry } from '../../../utils';
import { RequestContext } from '@mastra/core/request-context';
import type { ZodSchema, ZodTypeAny } from 'zod';
import type { ServerRoute } from '..';

vi.mock('@mastra/core/vector');

vi.mock('zod', async importOriginal => {
  const actual: {} = await importOriginal();
  return {
    ...actual,
    object: vi.fn(() => ({
      parse: vi.fn(input => input),
      safeParse: vi.fn(input => ({ success: true, data: input })),
    })),
    string: vi.fn(() => ({
      parse: vi.fn(input => input),
    })),
  };
});

const z = require('zod');

/**
 * Mock Voice implementation for testing
 */
export class MockVoice extends MastraVoice {
  async speak(): Promise<ReadableStream> {
    // Return a web ReadableStream instead of NodeJS stream
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('mock audio data'));
        controller.close();
      },
    });
    return stream as any;
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
    inputSchema?: ZodTypeAny;
    outputSchema?: ZodTypeAny;
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
 * Creates a mock memory instance with InMemoryStore
 * Following the pattern from handler tests - uses actual MockMemory implementation
 */
export function createMockMemory() {
  const storage = new InMemoryStore();
  const mockMemory = new MockMemory({ storage });
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

  // Create a reusable mock stream that has ReadableStream interface
  const createMockStream = () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type":"text-delta","textDelta":"test"}\n\n'));
        controller.close();
      },
    });

    return {
      getReader: () => stream.getReader(),
      [Symbol.asyncIterator]: async function* () {
        yield { type: 'text-delta', textDelta: 'test' };
      },
    };
  };

  // Mock stream method
  vi.spyOn(agent, 'stream').mockResolvedValue(createMockStream() as any);

  // Mock approveToolCall method
  vi.spyOn(agent, 'approveToolCall').mockResolvedValue(createMockStream() as any);

  // Mock declineToolCall method
  vi.spyOn(agent, 'declineToolCall').mockResolvedValue(createMockStream() as any);

  // Mock network method
  vi.spyOn(agent, 'network').mockResolvedValue(createMockStream() as any);

  // Mock getVoice to return the voice object that the handler expects
  const mockVoice = createMockVoice();
  vi.spyOn(agent, 'getVoice').mockResolvedValue(mockVoice);

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
 * Creates a test workflow with a suspending step
 * Following the pattern from handler tests - always includes suspend for resume tests
 */
export function createTestWorkflow(
  overrides: {
    id?: string;
    description?: string;
  } = {},
) {
  const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
  const stepA = createStep({
    id: 'test-step',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    execute: async ({ suspend }: any) => {
      await suspend({ test: 'data' });
    },
  });
  const stepB = createStep({
    id: 'test-step2',
    inputSchema: z.object({ name: z.string() }),
    outputSchema: z.object({ result: z.string() }),
    execute,
  });

  return createWorkflow({
    id: overrides.id || 'test-workflow',
    description: overrides.description || 'A test workflow',
    steps: [stepA, stepB],
    inputSchema: z.object({}),
    outputSchema: z.object({ result: z.string() }),
  })
    .then(stepA)
    .then(stepB)
    .commit();
}

/**
 * Creates a test Mastra instance with optional resources
 */
export function createTestMastra(
  config: {
    agents?: Record<string, Agent>;
    workflows?: Record<string, any>;
    storage?: InMemoryStore;
    [key: string]: any;
  } = {},
) {
  return new Mastra({
    logger: false,
    storage: config.storage || new InMemoryStore(),
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
 * Complete setup for workflow routes testing with suspended workflow support
 * Returns a configured workflow and mastra instance
 */
export async function setupWorkflowTests() {
  // Create a workflow with suspending enabled (for resume-async tests)
  const workflow = createTestWorkflow();

  const mastra = createTestMastra({
    workflows: { 'test-workflow': workflow },
  });

  // Create and start a workflow run - it will suspend at step1
  // Use empty object as input since suspending workflow expects empty input schema
  const run = await workflow.createRun({
    runId: 'test-run',
  });
  await run.start({ inputData: {} }).catch(() => {});

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
  return new InMemoryTaskStore();
}

/**
 * Creates a test task for A2A routes
 */
export function createTestTask(
  overrides: {
    taskId?: string;
    agentId?: string;
    contextId?: string;
    state?: string;
  } = {},
) {
  return {
    id: overrides.taskId || 'test-task-id',
    contextId: overrides.contextId || 'test-context-id',
    state: overrides.state || 'completed',
    artifacts: [],
    metadata: {},
    message: {
      messageId: 'test-message-id',
      kind: 'message' as const,
      role: 'agent' as const,
      parts: [{ kind: 'text' as const, text: 'Test response' }],
    },
  };
}

/**
 * Pre-populates a taskStore with test tasks
 */
export async function populateTaskStore(taskStore: any, tasks: Array<{ agentId: string; task: any }>) {
  for (const { agentId, task } of tasks) {
    await taskStore.save({ agentId, data: task });
  }
}

/**
 * Complete setup for A2A routes testing
 * Returns a configured agent, task store, and mastra instance
 */
export async function setupA2ATests() {
  const agent = createTestAgent();
  mockAgentMethods(agent);
  const taskStore = createTaskStore();

  // Pre-populate taskStore with test task
  const testTask = createTestTask();
  await populateTaskStore(taskStore, [{ agentId: 'test-agent', task: testTask }]);

  const mastra = createTestMastra({
    agents: { 'test-agent': agent },
  });

  return { agent, taskStore, mastra };
}

/**
 * Creates a mock vector for testing (following handler test pattern)
 */
export function createMockVector() {
  // @ts-expect-error - Mocking for tests
  const mockVector: MastraVector = new MastraVector();
  mockVector.upsert = vi.fn().mockResolvedValue(['id1', 'id2']);
  mockVector.createIndex = vi.fn().mockResolvedValue(undefined);
  mockVector.query = vi.fn().mockResolvedValue([{ id: '1', score: 0.9, vector: [1, 2, 3] }]);
  mockVector.listIndexes = vi.fn().mockResolvedValue(['test-index']);
  mockVector.describeIndex = vi.fn().mockResolvedValue({ dimension: 3, count: 100, metric: 'cosine' });
  mockVector.deleteIndex = vi.fn().mockResolvedValue(undefined);

  return mockVector;
}

/**
 * Complete setup for agent-builder routes testing
 * Returns configured workflows, agent, and mastra instance with WorkflowRegistry mocks
 */
export async function setupAgentBuilderTests() {
  const agent = createTestAgent();
  mockAgentMethods(agent);

  // Create test workflows with agent-builder names
  const mergeTemplateWorkflow = createTestWorkflow({ id: 'merge-template' });
  const workflowBuilderWorkflow = createTestWorkflow({ id: 'workflow-builder' });

  const mastra = createTestMastra({
    agents: { 'test-agent': agent },
    workflows: {
      'merge-template': mergeTemplateWorkflow,
      'workflow-builder': workflowBuilderWorkflow,
    },
  });

  // Create and start a workflow run for routes that need existing runs
  const run = await mergeTemplateWorkflow.createRun({
    runId: 'test-run',
  });
  await run.start({ inputData: { name: 'test' } });

  // Return a function to setup WorkflowRegistry mocks
  // This needs to be called in beforeEach after vi.clearAllMocks()
  const setupMocks = () => {
    // Import WorkflowRegistry dynamically to avoid circular deps

    vi.spyOn(WorkflowRegistry, 'registerTemporaryWorkflows').mockImplementation(() => {});
    vi.spyOn(WorkflowRegistry, 'cleanup').mockImplementation(() => {});
    vi.spyOn(WorkflowRegistry, 'isAgentBuilderWorkflow').mockReturnValue(true);
    vi.spyOn(WorkflowRegistry, 'getAllWorkflows').mockReturnValue({
      'merge-template': mergeTemplateWorkflow,
      'workflow-builder': workflowBuilderWorkflow,
    });
  };

  return {
    agent,
    mergeTemplateWorkflow,
    workflowBuilderWorkflow,
    mastra,
    setupMocks,
  };
}

/**
 * Complete setup for observability routes testing
 * Creates test scorer and test trace with span
 */
export async function setupObservabilityTests() {
  // Create test scorer
  const testScorer = {
    id: 'test-scorer',
    name: 'Test Scorer',
    description: 'Test scorer for observability tests',
    executor: async () => ({ score: 0.5 }),
    config: {
      id: 'test-scorer',
      name: 'Test Scorer',
    },
  };

  // Create Mastra instance with scorer
  const mastra = createTestMastra({
    scorers: { 'test-scorer': testScorer },
  });

  // Add test trace by creating a span with that traceId
  const storage = mastra.getStorage();
  if (storage) {
    await storage.createSpan({
      spanId: 'test-span-1',
      traceId: 'test-trace',
      parentSpanId: null,
      name: 'test-span',
      scope: null,
      spanType: SpanType.GENERIC,
      attributes: {},
      metadata: null,
      links: null,
      startedAt: new Date(),
      endedAt: new Date(),
      input: null,
      output: null,
      error: null,
      isEvent: false,
    });
  }

  return { mastra, testScorer };
}

/**
 * Validate that a value matches a schema
 */
export function expectValidSchema(schema: ZodSchema, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Schema validation failed: ${JSON.stringify(result.error.issues, null, 2)}`);
  }
}

/**
 * Validate that a value does NOT match a schema
 */
export function expectInvalidSchema(schema: ZodSchema, value: unknown) {
  const result = schema.safeParse(value);
  if (result.success) {
    throw new Error(`Expected schema validation to fail, but it succeeded`);
  }
}

/**
 * Create a mock RequestContext
 */
export function createMockRequestContext(context?: Record<string, any>): RequestContext {
  const requestContext = new RequestContext();
  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      requestContext.set(key, value);
    });
  }
  return requestContext;
}

/**
 * Validate route metadata
 */
export function validateRouteMetadata(
  route: ServerRoute,
  expected: {
    method?: string;
    path?: string;
    responseType?: 'json' | 'stream';
    hasPathParams?: boolean;
    hasQueryParams?: boolean;
    hasBody?: boolean;
    hasResponse?: boolean;
    hasOpenAPI?: boolean;
  },
) {
  if (expected.method && route.method !== expected.method) {
    throw new Error(`Expected method ${expected.method} but got ${route.method}`);
  }

  if (expected.path && route.path !== expected.path) {
    throw new Error(`Expected path ${expected.path} but got ${route.path}`);
  }

  if (expected.responseType && route.responseType !== expected.responseType) {
    throw new Error(`Expected responseType ${expected.responseType} but got ${route.responseType}`);
  }

  if (expected.hasPathParams !== undefined) {
    const hasPathParams = !!route.pathParamSchema;
    if (hasPathParams !== expected.hasPathParams) {
      throw new Error(
        `Expected pathParamSchema to be ${expected.hasPathParams ? 'defined' : 'undefined'} but got ${hasPathParams ? 'defined' : 'undefined'}`,
      );
    }
  }

  if (expected.hasQueryParams !== undefined) {
    const hasQueryParams = !!route.queryParamSchema;
    if (hasQueryParams !== expected.hasQueryParams) {
      throw new Error(
        `Expected queryParamSchema to be ${expected.hasQueryParams ? 'defined' : 'undefined'} but got ${hasQueryParams ? 'defined' : 'undefined'}`,
      );
    }
  }

  if (expected.hasBody !== undefined) {
    const hasBody = !!route.bodySchema;
    if (hasBody !== expected.hasBody) {
      throw new Error(
        `Expected bodySchema to be ${expected.hasBody ? 'defined' : 'undefined'} but got ${hasBody ? 'defined' : 'undefined'}`,
      );
    }
  }

  if (expected.hasResponse !== undefined) {
    const hasResponse = !!route.responseSchema;
    if (hasResponse !== expected.hasResponse) {
      throw new Error(
        `Expected responseSchema to be ${expected.hasResponse ? 'defined' : 'undefined'} but got ${hasResponse ? 'defined' : 'undefined'}`,
      );
    }
  }

  if (expected.hasOpenAPI !== undefined) {
    const hasOpenAPI = !!route.openapi;
    if (hasOpenAPI !== expected.hasOpenAPI) {
      throw new Error(
        `Expected openapi to be ${expected.hasOpenAPI ? 'defined' : 'undefined'} but got ${hasOpenAPI ? 'defined' : 'undefined'}`,
      );
    }
  }
}

/**
 * Extract path parameters from a path pattern
 * e.g., '/api/agents/:agentId/tools/:toolId' -> ['agentId', 'toolId']
 */
export function extractPathParams(path: string): string[] {
  const matches = path.match(/:(\w+)/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1));
}
