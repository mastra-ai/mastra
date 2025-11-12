import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core';
import { Mock, vi } from 'vitest';
import type { AdapterTestContext } from './route-adapter-test-suite';
import { Workflow } from '@mastra/core/workflows';
import { createScorer } from '@mastra/core/evals';
import { SpanType } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { CompositeVoice } from '@mastra/core/voice';
import { MockMemory } from '@mastra/core/memory';
import { MastraVector } from '@mastra/core/vector';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import type { ZodTypeAny } from 'zod';
import { WorkflowRegistry } from '@mastra/server/server-adapter';
import { BaseLogMessage, IMastraLogger, LogLevel } from '@mastra/core/logger';

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
    model: overrides.model || 'openai/gpt-4o',
    tools: overrides.tools || { 'test-tool': testTool },
    voice: overrides.voice || mockVoice,
    memory: overrides.memory || mockMemory,
  });

  return agent;
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

export function mockAgentMethods(agent: Agent) {
  // Mock agent methods that would normally require API calls
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

  // Mock getVoice to return the voice object that the handler expects
  const mockVoice = createMockVoice();

  // Mock voice methods to avoid "No listener/speaker provider configured" errors
  vi.spyOn(mockVoice, 'getSpeakers').mockResolvedValue([]);
  vi.spyOn(mockVoice, 'getListener').mockResolvedValue({ enabled: false } as any);
  vi.spyOn(mockVoice, 'speak').mockResolvedValue(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('mock audio data'));
        controller.close();
      },
    }) as any,
  );
  vi.spyOn(mockVoice, 'listen').mockResolvedValue('transcribed text');

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

// Mock legacy workflow stream methods
const createMockWorkflowStream = () => {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"type":"step-result","result":"test"}\n\n'));
      controller.close();
    },
  });
};

/**
 * Create a default test context with mocked Mastra instance, agents, workflows, etc.
 * This provides everything needed for adapter integration tests.
 */
export async function createDefaultTestContext(): Promise<AdapterTestContext> {
  // Create memory and pre-populate with test thread
  const memory = createMockMemory();
  await memory.createThread({
    threadId: 'test-thread',
    resourceId: 'test-resource',
    metadata: {},
  });

  // Create vector instance
  const vector = createMockVector();

  // Create test tool
  const testTool = createTestTool({ id: 'test-tool' });

  // Create test agent with memory and mocks
  const agent = createTestAgent({ name: 'test-agent', memory });
  mockAgentMethods(agent);

  // Create test workflow with mocks
  const workflow = createTestWorkflow({ id: 'test-workflow' });
  const mergeTemplateWorkflow = createTestWorkflow({ id: 'merge-template' });
  const workflowBuilderWorkflow = createTestWorkflow({ id: 'workflow-builder' });

  // Create test scorer
  const testScorer = createScorer({
    id: 'test-scorer',
    name: 'Test Scorer',
    description: 'Test scorer for observability tests',
  });

  mockLogger.transports = new Map([
    ['console', {}],
    ['file', {}],
  ]) as unknown as Record<string, unknown>;

  const mockLogs: BaseLogMessage[] = [createLog({})];

  mockLogger.listLogsByRunId.mockResolvedValue({
    logs: mockLogs,
    total: 1,
    page: 1,
    perPage: 100,
    hasMore: false,
  });

  mockLogger.listLogs.mockResolvedValue({ logs: mockLogs, total: 1, page: 1, perPage: 100, hasMore: false });

  // Create Mastra instance with all test entities
  const mastra = new Mastra({
    logger: mockLogger as unknown as IMastraLogger,
    storage: new InMemoryStore(),
    agents: {
      'test-agent': agent,
    },
    workflows: {
      'test-workflow': workflow,
    },
    scorers: { 'test-scorer': testScorer },
    vectors: { 'test-vector': vector },
  });

  await mockWorkflowRun(workflow);
  await setupWorkflowRegistryMocks(
    {
      'merge-template': mergeTemplateWorkflow,
      'workflow-builder': workflowBuilderWorkflow,
    },
    mastra,
  );

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

  return {
    mastra,
    tools: { 'test-tool': testTool },
  };
}

async function mockWorkflowRun(workflow: Workflow) {
  const workflowBuilderRun = await workflow.createRun({
    runId: 'test-run',
  });
  vi.spyOn(workflowBuilderRun, 'streamLegacy').mockResolvedValue(createMockWorkflowStream() as any);
  // observeStreamLegacy returns an object with a stream property
  vi.spyOn(workflowBuilderRun, 'observeStreamLegacy').mockReturnValue({
    stream: createMockWorkflowStream(),
  } as any);
  await workflowBuilderRun.start({ inputData: {} }).catch(() => {});
}

/**
 * Creates a mock voice provider
 */
export function createMockVoice() {
  return new CompositeVoice({});
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
 * Recursively converts ISO date strings to Date objects in response data.
 * This is needed because HTTP responses serialize dates to strings via JSON.stringify(),
 * but schemas expect Date objects for validation.
 *
 * @param data - The response data from HTTP (with dates as ISO strings)
 * @returns The same data with ISO date strings converted to Date objects
 */
export function parseDatesInResponse(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Check if string matches ISO 8601 date format
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (isoDateRegex.test(data)) {
      const parsed = new Date(data);
      // Verify it's a valid date (not NaN)
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(parseDatesInResponse);
  }

  if (typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = parseDatesInResponse(value);
    }
    return result;
  }

  return data;
}

async function setupWorkflowRegistryMocks(workflows: Record<string, Workflow>, mastra: Mastra) {
  for (const workflow of Object.values(workflows)) {
    workflow.__registerMastra(mastra);
    workflow.__registerPrimitives({
      logger: mastra.getLogger(),
      storage: mastra.getStorage(),
      agents: mastra.listAgents(),
      tts: mastra.getTTS(),
      vectors: mastra.getVectors(),
    });
    await mockWorkflowRun(workflow);
  }

  // Mock WorkflowRegistry.registerTemporaryWorkflows to attach Mastra to workflows
  vi.spyOn(WorkflowRegistry, 'registerTemporaryWorkflows').mockImplementation(() => {
    for (const [id, workflow] of Object.entries(workflows)) {
      // Register Mastra instance with the workflow
      if (mastra) {
        workflow.__registerMastra(mastra);
        workflow.__registerPrimitives({
          logger: mastra.getLogger(),
          storage: mastra.getStorage(),
          agents: mastra.listAgents(),
          tts: mastra.getTTS(),
          vectors: mastra.getVectors(),
        });
      }
      WorkflowRegistry['additionalWorkflows'][id] = workflow;
    }
  });
}

export function createLog(args: Partial<BaseLogMessage>): BaseLogMessage {
  return {
    msg: 'test log',
    level: LogLevel.INFO,
    time: new Date(),
    ...args,
    pid: 1,
    hostname: 'test-host',
    name: 'test-name',
    runId: 'test-run',
  };
}

type MockedLogger = {
  listLogsByRunId: Mock<IMastraLogger['listLogsByRunId']>;
  listLogs: Mock<IMastraLogger['listLogs']>;
};

const mockLogger = {
  listLogsByRunId: vi.fn(),
  listLogs: vi.fn(),
  transports: new Map<string, unknown>(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  cleanup: vi.fn(),
  trackException: vi.fn(),
  getTransports: vi.fn(() => mockLogger.transports ?? new Map<string, unknown>()),
} as unknown as MockedLogger & {
  transports: Record<string, unknown>;
  getTransports: () => Map<string, unknown>;
};
