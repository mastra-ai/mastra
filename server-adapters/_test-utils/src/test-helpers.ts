import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core';
import { Mock, vi } from 'vitest';
import { Workflow } from '@mastra/core/workflows';
import { normalizeRoutePath } from './route-test-utils';
import { createScorer } from '@mastra/core/evals';
import { SpanType } from '@mastra/core/observability';
import { CompositeVoice } from '@mastra/core/voice';
import { MockMemory } from '@mastra/core/memory';
import { MastraVector } from '@mastra/core/vector';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import type { ZodTypeAny } from 'zod';
import { ServerRoute, WorkflowRegistry } from '@mastra/server/server-adapter';
import { BaseLogMessage, IMastraLogger, LogLevel } from '@mastra/core/logger';
import { generateValidDataFromSchema, getDefaultValidPathParams } from './route-test-utils';
import { MCPServer } from '@mastra/mcp';
import type { Tool } from '@mastra/core/tools';
import type { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Processor, ProcessInputArgs, ProcessInputResult } from '@mastra/core/processors';
vi.mock('@mastra/core/vector');

vi.mock('zod', async importOriginal => {
  const actual: {} = await importOriginal();
  return {
    ...actual,
  };
});

const z = require('zod');

/**
 * Test context for adapter integration tests
 * Convention: Create entities with IDs that match auto-generated values:
 * - agentId: 'test-agent'
 * - workflowId: 'test-workflow'
 * - toolId: 'test-tool'
 * - etc.
 */
export interface AdapterTestContext {
  mastra: Mastra;
  tools?: Record<string, Tool>;
  taskStore?: InMemoryTaskStore;
  customRouteAuthConfig?: Map<string, boolean>;
}

/**
 * HTTP request to execute through adapter
 */
export interface HttpRequest {
  method: string;
  path: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * HTTP response from adapter
 */
export interface HttpResponse {
  status: number;
  type: 'json' | 'stream';
  data?: unknown;
  stream?: ReadableStream | AsyncIterable<unknown>;
  headers: Record<string, string>;
}

/**
 * Options for adapter setup
 */
export interface AdapterSetupOptions {
  /** Route prefix (e.g., '/v2' or '/api/v2') */
  prefix?: string;
}

/**
 * Configuration for adapter integration test suite
 */
export interface AdapterTestSuiteConfig {
  /** Name for the test suite */
  suiteName?: string;

  /**
   * Setup adapter and app for testing
   * Called once before all tests
   * @param context - Test context with Mastra instance
   * @param options - Optional adapter options (e.g., prefix)
   */
  setupAdapter: (
    context: AdapterTestContext,
    options?: AdapterSetupOptions,
  ) => { adapter: any; app: any } | Promise<{ adapter: any; app: any }>;

  /**
   * Execute HTTP request through the adapter's framework (Express/Hono)
   */
  executeHttpRequest: (app: any, request: HttpRequest) => Promise<HttpResponse>;

  /**
   * Create test context with Mastra instance, agents, etc.
   * Convention: Create entities with IDs matching auto-generated values
   * Optional - uses createDefaultTestContext() if not provided
   */
  createTestContext?: () => Promise<AdapterTestContext> | AdapterTestContext;
}

/**
 * Creates a test agent with all common mocks configured
 */
export function createTestAgent(
  overrides: {
    id?: string;
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
    id: overrides.id || 'test-agent',
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

  // Mock stream method - returns object with fullStream property
  vi.spyOn(agent, 'stream').mockResolvedValue({ fullStream: createMockStream() } as any);

  // Mock legacy generate - returns GenerateTextResult (JSON object, not stream)
  vi.spyOn(agent, 'generateLegacy').mockResolvedValue({
    text: 'test response',
    toolCalls: [],
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 5 },
    experimental_output: undefined,
    response: {
      id: 'test-response-id',
      timestamp: new Date(),
      modelId: 'gpt-4',
    },
    request: {},
    warnings: [],
  } as any);

  // Helper to create a mock Response object for datastream-response routes
  const createMockResponse = () => {
    const stream = createMockStream();
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  };

  // Mock streamLegacy - needs to return an object with toDataStreamResponse/toTextStreamResponse methods
  const mockStreamResult = {
    ...createMockStream(),
    toDataStreamResponse: vi.fn().mockImplementation(() => createMockResponse()),
    toTextStreamResponse: vi.fn().mockImplementation(() => createMockResponse()),
  };
  vi.spyOn(agent, 'streamLegacy').mockResolvedValue(mockStreamResult as any);

  // Mock approveToolCall method - returns object with fullStream property
  vi.spyOn(agent, 'approveToolCall').mockResolvedValue({ fullStream: createMockStream() } as any);

  // Mock declineToolCall method - returns object with fullStream property
  vi.spyOn(agent, 'declineToolCall').mockResolvedValue({ fullStream: createMockStream() } as any);

  // Mock approveToolCallGenerate method - returns same format as generate
  vi.spyOn(agent, 'approveToolCallGenerate').mockResolvedValue({ text: 'test response' } as any);

  // Mock declineToolCallGenerate method - returns same format as generate
  vi.spyOn(agent, 'declineToolCallGenerate').mockResolvedValue({ text: 'test response' } as any);

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
  // Mock OPENAI_API_KEY so that isProviderConnected('openai') returns true
  // This is needed for routes like ENHANCE_INSTRUCTIONS_ROUTE that check provider connectivity
  vi.stubEnv('OPENAI_API_KEY', 'test-api-key');

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

  // Mock Agent.prototype.generate for routes that create new Agent instances
  // (e.g., ENHANCE_INSTRUCTIONS_ROUTE creates a systemPromptAgent)
  // This needs to return both text and object for different use cases
  vi.spyOn(Agent.prototype, 'generate').mockResolvedValue({
    text: 'test response',
    object: {
      explanation: 'Enhanced the instructions for clarity and specificity.',
      new_prompt: 'You are a helpful assistant with enhanced instructions.',
    },
  } as any);

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

  // Create test processor
  const testProcessor = createTestProcessor({ id: 'test-processor' });

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

  const weatherTool = createTool({
    id: 'getWeather',
    description: 'Gets the current weather for a location',
    inputSchema: z.object({
      location: z.string().describe('The location to get weather for'),
    }),
    outputSchema: z.object({
      temperature: z.number(),
      condition: z.string(),
    }),
    execute: async ({ location }) => ({
      temperature: 72,
      condition: `Sunny in ${location}`,
    }),
  });

  const calculatorTool = createTool({
    id: 'calculate',
    description: 'Performs basic calculations',
    inputSchema: z.object({
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number(),
      b: z.number(),
    }),
    outputSchema: z.object({
      result: z.number(),
    }),
    execute: async ({ operation, a, b }) => {
      let result = 0;
      switch (operation) {
        case 'add':
          result = a + b;
          break;
        case 'subtract':
          result = a - b;
          break;
        case 'multiply':
          result = a * b;
          break;
        case 'divide':
          result = b !== 0 ? a / b : Infinity;
          break;
      }
      return { result };
    },
  });

  const failingTool = createTool({
    id: 'failingTool',
    description: 'A tool that always throws an error for testing error handling',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    execute: async () => {
      throw new Error('Tool execution failed intentionally');
    },
  });

  // Create real MCP servers with tools
  const mcpServer1 = new MCPServer({
    name: 'Test Server 1',
    version: '1.0.0',
    description: 'Test MCP Server 1',
    tools: {
      getWeather: weatherTool,
      calculate: calculatorTool,
    },
  });

  const mcpServer2 = new MCPServer({
    name: 'Test Server 2',
    version: '1.1.0',
    description: 'Test MCP Server 2',
    tools: {
      failingTool: failingTool,
    },
  });

  // Create test workspace with local filesystem and mock files
  const workspace = await createTestWorkspace();

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
    mcpServers: {
      'test-server-1': mcpServer1,
      'test-server-2': mcpServer2,
    },
    workspace,
    processors: {
      'test-processor': testProcessor,
    },
  });

  // Mock getEditor to return an object with namespaced methods for stored agents routes
  const mockToolProvider = {
    info: { id: 'test-provider', name: 'Test Provider', description: 'A test tool provider' },
    listToolkits: vi.fn().mockResolvedValue({ data: [] }),
    listTools: vi.fn().mockResolvedValue({ data: [], total: 0, page: 0, perPage: 20, hasMore: false }),
    getToolSchema: vi.fn().mockResolvedValue({ name: 'test-tool-slug', inputSchema: {}, outputSchema: {} }),
  };
  const mockProcessorProvider = {
    info: { id: 'test-provider', name: 'Test Processor Provider', description: 'A test processor provider' },
    configSchema: z.object({}),
    availablePhases: ['processInput'] as const,
    createProcessor: vi.fn(),
  };
  vi.spyOn(mastra, 'getEditor').mockReturnValue({
    prompt: {
      preview: vi.fn().mockResolvedValue('resolved instructions preview'),
      clearCache: vi.fn(),
    },
    mcp: {
      clearCache: vi.fn(),
    },
    agent: {
      list: vi.fn().mockResolvedValue({ agents: [] }),
      clearCache: vi.fn(),
      clone: vi.fn().mockResolvedValue({
        id: 'cloned-agent',
        name: 'Test Agent (Clone)',
        status: 'draft',
        description: '',
        instructions: 'test instructions',
        model: { provider: 'openai', name: 'gpt-4o' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
    scorer: {
      clearCache: vi.fn(),
    },
    getToolProviders: vi.fn().mockReturnValue({ 'test-provider': mockToolProvider }),
    getToolProvider: vi
      .fn()
      .mockImplementation((id: string) => (id === 'test-provider' ? mockToolProvider : undefined)),
    getProcessorProviders: vi.fn().mockReturnValue({ 'test-provider': mockProcessorProvider }),
    getProcessorProvider: vi
      .fn()
      .mockImplementation((id: string) => (id === 'test-provider' ? mockProcessorProvider : undefined)),
  } as any);

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
    const observability = await storage.getStore('observability');
    if (observability) {
      await observability.createSpan({
        span: {
          spanId: 'test-span-1',
          traceId: 'test-trace',
          name: 'test-span',
          spanType: SpanType.GENERIC,
          startedAt: new Date(),
          endedAt: new Date(),
          isEvent: false,
        },
      });
    }

    // Add test stored agent for stored agents routes
    const agents = await storage.getStore('agents');
    if (agents) {
      // create automatically creates version 1 with the initial config
      const storedAgent = await agents.create({
        agent: {
          id: 'test-stored-agent',
          name: 'Test Stored Agent',
          description: 'A test stored agent for integration tests',
          instructions: 'Test instructions for stored agent',
          model: { provider: 'openai', name: 'gpt-4o' },
        },
      });

      // Version 1 was auto-created by create; its ID is the activeVersionId
      const version1Id = storedAgent.activeVersionId!;

      // Version 2: Non-active version that can be deleted or used in comparisons
      // Config fields are top-level (no snapshot object)
      await agents.createVersion({
        id: 'test-version-id',
        agentId: 'test-stored-agent',
        versionNumber: 2,
        name: 'Test Stored Agent',
        instructions: 'Updated test instructions for version 2',
        model: { provider: 'openai', name: 'gpt-4o' },
        changedFields: ['instructions'],
        changeMessage: 'Second test version',
      });

      // Ensure version 1 stays active, leaving version 2 (test-version-id) as non-active and deletable
      await agents.update({
        id: 'test-stored-agent',
        activeVersionId: version1Id,
      });
    }

    // Add test stored scorer for stored scorers routes
    const scorers = await storage.getStore('scorerDefinitions');
    if (scorers) {
      const storedScorer = await scorers.create({
        scorerDefinition: {
          id: 'test-stored-scorer',
          name: 'Test Stored Scorer',
          description: 'A test stored scorer for integration tests',
          type: 'llm-judge',
          instructions: 'Evaluate the response for accuracy.',
          model: { provider: 'openai', name: 'gpt-4o' },
          scoreRange: { min: 0, max: 1 },
        },
      });
      // Version 2 with known ID for version-specific route tests
      await scorers.createVersion({
        id: 'test-version-id',
        scorerDefinitionId: 'test-stored-scorer',
        versionNumber: 2,
        name: 'Test Stored Scorer',
        type: 'llm-judge',
        instructions: 'Updated instructions for version 2.',
        model: { provider: 'openai', name: 'gpt-4o' },
        scoreRange: { min: 0, max: 1 },
        changedFields: ['instructions'],
        changeMessage: 'Second test version',
      });
    }

    // Add test stored MCP client with version 2 (version 1 is auto-created by create())
    const mcpClients = await storage.getStore('mcpClients');
    if (mcpClients) {
      await mcpClients.create({
        mcpClient: {
          id: 'test-stored-mcp-client',
          name: 'Test Stored MCP Client',
          servers: { 'test-server': { type: 'http', url: 'http://localhost:3000' } },
        },
      });
      await mcpClients.createVersion({
        id: 'test-version-id',
        mcpClientId: 'test-stored-mcp-client',
        versionNumber: 2,
        name: 'Test Stored MCP Client',
        servers: { 'test-server': { type: 'http', url: 'http://localhost:3001' } },
        changedFields: ['servers'],
        changeMessage: 'Second test version',
      });
    }

    // Add test stored prompt block with version 2
    const promptBlocks = await storage.getStore('promptBlocks');
    if (promptBlocks) {
      await promptBlocks.create({
        promptBlock: {
          id: 'test-stored-prompt-block',
          name: 'Test Stored Prompt Block',
          content: 'Hello {{name}}, this is a test prompt block.',
        },
      });
      await promptBlocks.createVersion({
        id: 'test-version-id',
        blockId: 'test-stored-prompt-block',
        versionNumber: 2,
        name: 'Test Stored Prompt Block',
        content: 'Updated content for {{name}}.',
        changedFields: ['content'],
        changeMessage: 'Second test version',
      });
    }

    // Add test stored workspace and skill (no extra versions needed)
    const workspaces = await storage.getStore('workspaces');
    if (workspaces) {
      await workspaces.create({
        workspace: { id: 'test-stored-workspace', name: 'Test Stored Workspace' },
      });
    }
    const skills = await storage.getStore('skills');
    if (skills) {
      await skills.create({
        skill: {
          id: 'test-stored-skill',
          name: 'test-stored-skill',
          description: 'A test stored skill',
          instructions: 'Test skill instructions',
        },
      });
    }

    // Add test thread and messages to Mastra's storage for memory routes without agentId
    // This is needed because when agentId is not provided, the handler falls back to storage directly
    const memoryStore = await storage.getStore('memory');
    if (memoryStore) {
      await memoryStore.saveThread({
        thread: {
          id: 'test-thread',
          resourceId: 'test-resource',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      });
      await memoryStore.saveMessages({
        messages: [
          {
            id: 'test-message-1',
            threadId: 'test-thread',
            role: 'user',
            content: {
              format: 2,
              parts: [{ type: 'text', text: 'Test message' }],
            },
            createdAt: new Date(),
          },
        ],
      });
    }
  }

  return {
    mastra,
    tools: { 'test-tool': testTool },
  };
}

async function mockWorkflowRun(workflow: Workflow) {
  // Mock getWorkflowRunById to return a mock WorkflowState object
  // This is the unified format that includes both metadata and processed execution state
  vi.spyOn(workflow, 'getWorkflowRunById').mockResolvedValue({
    runId: 'test-run',
    workflowName: 'test-workflow',
    resourceId: 'test-resource',
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'success',
    result: { output: 'test-output' },
    payload: {},
    steps: {
      step1: {
        status: 'success',
        output: { result: 'test-output' },
        startedAt: Date.now() - 1000,
        endedAt: Date.now(),
      },
    },
    activeStepsPath: {},
    serializedStepGraph: [{ type: 'step', step: { id: 'step1' } }],
  } as any);

  // Mock createRun to return a mocked run object with all required methods
  const originalCreateRun = workflow.createRun.bind(workflow);
  vi.spyOn(workflow, 'createRun').mockImplementation(async (options?: any) => {
    const run = await originalCreateRun(options);

    // Mock stream methods
    vi.spyOn(run, 'streamLegacy').mockReturnValue({
      stream: createMockWorkflowStream(),
    } as any);
    vi.spyOn(run, 'observeStreamLegacy').mockReturnValue({
      stream: createMockWorkflowStream(),
    } as any);

    // Mock start to return a successful result
    vi.spyOn(run, 'start').mockResolvedValue({
      results: {},
      status: 'success',
    } as any);

    // Mock restart to return a successful result
    vi.spyOn(run, 'restart').mockResolvedValue({
      results: {},
      status: 'success',
    } as any);

    // Mock resume to return a successful result
    vi.spyOn(run, 'resume').mockResolvedValue({
      results: {},
      status: 'success',
    } as any);

    // Mock timeTravel to return a successful result
    vi.spyOn(run, 'timeTravel').mockResolvedValue({
      results: {},
      status: 'success',
    } as any);

    return run;
  });
}

/**
 * Creates a mock voice provider
 */
export function createMockVoice() {
  return new CompositeVoice({});
}

/**
 * Creates a test workspace with a local filesystem and mock skill files.
 * Uses a temporary directory that gets cleaned up after tests.
 */
export async function createTestWorkspace(): Promise<Workspace> {
  // Create a temp directory for the test workspace
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mastra-test-workspace-'));

  // Create skills directory and a test skill
  const skillsDir = path.join(tempDir, 'skills', 'test-skill');
  fs.mkdirSync(skillsDir, { recursive: true });

  // Create SKILL.md file for the test skill
  const skillContent = `---
name: test-skill
description: A test skill for integration testing
license: MIT
compatibility: ">=1.0.0"
---

# Test Skill

This is a test skill used for integration testing.

## Instructions

Follow these instructions for the test skill.
`;
  fs.writeFileSync(path.join(skillsDir, 'SKILL.md'), skillContent);

  // Create a test reference file in the references subdirectory
  const referencesDir = path.join(skillsDir, 'references');
  fs.mkdirSync(referencesDir, { recursive: true });
  fs.writeFileSync(path.join(referencesDir, 'test-reference.md'), '# Test Reference\n\nThis is a test reference file.');

  // Create a regular test file in the workspace root
  fs.writeFileSync(path.join(tempDir, 'test-file.txt'), 'Hello from test workspace!');

  // Create a test directory for list operations
  const testDir = path.join(tempDir, 'test-dir');
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(path.join(testDir, 'nested-file.txt'), 'Nested file content');

  // Create .agents/skills/ structure for skills-sh routes (remove, check-updates, update)
  const agentSkillsDir = path.join(tempDir, '.agents', 'skills', 'test-skill');
  fs.mkdirSync(agentSkillsDir, { recursive: true });
  fs.writeFileSync(path.join(agentSkillsDir, 'SKILL.md'), skillContent);

  // Create .meta.json for the installed skill (used by update routes)
  // Use a fixed timestamp for deterministic tests
  const installedAt = new Date('2024-01-01T00:00:00.000Z').toISOString();
  const metaJson = {
    skillName: 'test-skill',
    owner: 'test-owner',
    repo: 'test-repo',
    branch: 'main',
    installedAt,
  };
  fs.writeFileSync(path.join(agentSkillsDir, '.meta.json'), JSON.stringify(metaJson, null, 2));

  // Create the workspace with local filesystem and BM25 search
  // Use 'test-workspace' as the ID to match test utilities' getDefaultValidPathParams
  const filesystem = new LocalFilesystem({ basePath: tempDir });
  const workspace = new Workspace({
    id: 'test-workspace',
    filesystem,
    skills: ['/skills'],
    bm25: true, // Enable BM25 search for index/unindex operations
  });

  // Initialize the workspace
  await workspace.init();

  return workspace;
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
 * Creates a test processor for integration tests
 */
export function createTestProcessor(
  overrides: {
    id?: string;
    name?: string;
    description?: string;
  } = {},
): Processor {
  return {
    id: overrides.id || 'test-processor',
    name: overrides.name || 'Test Processor',
    description: overrides.description || 'A test processor for integration tests',
    async processInput({ messages }: ProcessInputArgs): Promise<ProcessInputResult> {
      // Simple pass-through processor
      return messages;
    },
  };
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
/**
 * Check if a Zod schema expects a Date type at a given path
 */
function schemaExpectsDate(schema: any, path: string[] = []): boolean {
  if (!schema) return false;

  // Unwrap effects, optional, nullable, default to get to the base type
  while (
    schema._def?.typeName === 'ZodEffects' ||
    schema._def?.typeName === 'ZodOptional' ||
    schema._def?.typeName === 'ZodNullable' ||
    schema._def?.typeName === 'ZodDefault'
  ) {
    if (schema._def.typeName === 'ZodEffects') {
      schema = schema._def.schema;
    } else if (schema._def.typeName === 'ZodOptional' || schema._def.typeName === 'ZodNullable') {
      schema = schema._def.innerType;
    } else if (schema._def.typeName === 'ZodDefault') {
      schema = schema._def.innerType;
    }
  }

  // If we have a path, navigate to that field
  if (path.length > 0) {
    if (schema._def?.typeName === 'ZodObject') {
      const shape = schema._def.shape();
      const fieldSchema = shape[path[0]];
      return schemaExpectsDate(fieldSchema, path.slice(1));
    } else if (schema._def?.typeName === 'ZodArray') {
      // For arrays, check the element type (ignore the array index in path)
      return schemaExpectsDate(schema._def.type, path.slice(1));
    }
    return false;
  }

  // Check if this is a Date type
  return schema._def?.typeName === 'ZodDate';
}

export function parseDatesInResponse(data: any, schema?: any, currentPath: string[] = []): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Only parse dates if the schema expects a Date at this path
    if (schema && schemaExpectsDate(schema, currentPath)) {
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
      if (isoDateRegex.test(data)) {
        const parsed = new Date(data);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item, index) => parseDatesInResponse(item, schema, [...currentPath, String(index)]));
  }

  if (typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = parseDatesInResponse(value, schema, [...currentPath, key]);
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
      vectors: mastra.listVectors(),
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
          vectors: mastra.listVectors(),
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

export interface RouteRequestPayload {
  method: ServerRoute['method'];
  path: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
}

export interface RouteRequestOverrides {
  pathParams?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  /** Route prefix to prepend to the route path (defaults to '/api') */
  prefix?: string;
}

/**
 * Get route-specific defaults for path fields based on the route.
 * Different routes need different kinds of paths (files vs directories).
 */
function getRouteSpecificPathDefaults(route: ServerRoute): {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
} {
  const routePath = route.path;

  // File operations need file paths
  if (
    routePath.includes('/fs/read') ||
    routePath.includes('/fs/write') ||
    routePath.includes('/fs/delete') ||
    routePath.includes('/fs/stat')
  ) {
    return { query: { path: '/test-file.txt' }, body: { path: '/test-file.txt' } };
  }

  // Directory operations need directory paths
  if (routePath.includes('/fs/list')) {
    return { query: { path: '/' } };
  }

  // mkdir needs a new path to create
  if (routePath.includes('/fs/mkdir')) {
    return { body: { path: '/new-test-dir' } };
  }

  // Index/unindex operations
  if (routePath.includes('/workspace/index') || routePath.includes('/workspace/unindex')) {
    return { query: { path: '/test-file.txt' }, body: { path: '/test-file.txt' } };
  }

  return {};
}

export function buildRouteRequest(route: ServerRoute, overrides: RouteRequestOverrides = {}): RouteRequestPayload {
  const method = route.method;
  const prefix = normalizeRoutePath(overrides.prefix ?? '/api');
  let path = `${prefix}${route.path}`;

  if (route.pathParamSchema) {
    const defaults = getDefaultValidPathParams(route);
    const params = { ...defaults, ...(overrides.pathParams ?? {}) };
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`:${key}`, encodeURIComponent(String(value)));
    }
  }

  // Get route-specific path defaults
  const routeDefaults = getRouteSpecificPathDefaults(route);

  let query: Record<string, string | string[]> | undefined;
  if (route.queryParamSchema) {
    const generated = generateValidDataFromSchema(route.queryParamSchema) as Record<string, unknown>;
    query = convertQueryValues({ ...generated, ...(routeDefaults.query ?? {}), ...(overrides.query ?? {}) });
  } else if (overrides.query) {
    query = convertQueryValues(overrides.query);
  }

  let body: Record<string, unknown> | undefined;
  if (route.bodySchema) {
    const generated = generateValidDataFromSchema(route.bodySchema) as Record<string, unknown>;
    body = { ...generated, ...(routeDefaults.body ?? {}), ...(overrides.body ?? {}) };
  } else if (overrides.body) {
    body = { ...overrides.body };
  }

  return {
    method,
    path,
    query,
    body,
  };
}

export function convertQueryValues(values: Record<string, unknown>): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  const appendValue = (prefix: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      // JSON-encode arrays for complex query params (e.g., tags=["tag1","tag2"])
      // Server uses wrapSchemaForQueryParams which expects JSON strings for complex types
      query[prefix] = JSON.stringify(value);
      return;
    }
    if (value instanceof Date) {
      query[prefix] = value.toISOString();
      return;
    }
    if (typeof value === 'object') {
      // JSON-encode objects for complex query params (e.g., dateRange={"gte":"2024-01-01"})
      // Server uses wrapSchemaForQueryParams which expects JSON strings for complex types
      query[prefix] = JSON.stringify(value);
      return;
    }
    query[prefix] = convertQueryValue(value);
  };

  for (const [key, value] of Object.entries(values)) {
    appendValue(key, value);
  }
  return query;
}

function convertQueryValue(value: unknown): string {
  return String(value);
}

/**
 * Creates a ReadableStream that emits chunks with sensitive data.
 * This simulates what an agent.stream() call would return with request metadata.
 *
 * @param format - The stream format version ('v1' for legacy, 'v2' for current)
 * @returns A ReadableStream with chunks containing sensitive request data
 */
export function createStreamWithSensitiveData(format: 'v1' | 'v2' = 'v2'): ReadableStream {
  const sensitiveRequest = {
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'system', content: 'SECRET_SYSTEM_PROMPT' }],
      tools: [{ name: 'secret_tool', description: 'Internal tool' }],
    }),
  };

  const chunks =
    format === 'v2'
      ? [
          {
            type: 'step-start',
            runId: 'run-123',
            from: 'AGENT',
            payload: {
              messageId: 'msg-123',
              request: sensitiveRequest,
              warnings: [],
            },
          },
          { type: 'text-delta', textDelta: 'Hello' },
          {
            type: 'step-finish',
            runId: 'run-123',
            from: 'AGENT',
            payload: {
              messageId: 'msg-123',
              metadata: { request: sensitiveRequest },
              output: {
                text: 'Hello',
                steps: [{ request: sensitiveRequest, response: { id: 'resp-1' } }],
              },
            },
          },
          {
            type: 'finish',
            runId: 'run-123',
            from: 'AGENT',
            payload: {
              messageId: 'msg-123',
              metadata: { request: sensitiveRequest },
              output: {
                text: 'Hello',
                steps: [{ request: sensitiveRequest }],
              },
            },
          },
        ]
      : [
          {
            type: 'step-start',
            messageId: 'msg-123',
            request: sensitiveRequest,
            warnings: [],
          },
          { type: 'text-delta', textDelta: 'Hello' },
          {
            type: 'step-finish',
            finishReason: 'stop',
            request: sensitiveRequest,
          },
          {
            type: 'finish',
            finishReason: 'stop',
            request: sensitiveRequest,
          },
        ];

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

/**
 * Helper to consume a stream and parse SSE chunks.
 * Reads all chunks from a stream and parses them from SSE format.
 *
 * @param stream - The ReadableStream to consume (typically response.body)
 * @returns Array of parsed JSON objects from the SSE data lines
 */
export async function consumeSSEStream(stream: ReadableStream<Uint8Array> | null): Promise<any[]> {
  if (!stream) return [];
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: any[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    // Parse SSE format: "data: {...}\n\n"
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          chunks.push(JSON.parse(line.slice(6)));
        } catch {
          // Skip non-JSON lines
        }
      }
    }
  }

  return chunks;
}
