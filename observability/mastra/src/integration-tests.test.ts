import { Agent } from '@mastra/core/agent';
import type { StructuredOutputOptions } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type {
  ObservabilityExporter,
  TracingEvent,
  ExportedSpan,
  AnyExportedSpan,
  TracingContext,
} from '@mastra/core/observability';

// Core Mastra imports
import type { Processor } from '@mastra/core/processors';
import { MockStore } from '@mastra/core/storage';
import type { OutputSchema } from '@mastra/core/stream';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { MockLanguageModelV1, simulateReadableStream } from 'ai/test';
import { MockLanguageModelV2, convertArrayToReadableStream } from 'ai-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

// Tracing imports
import { Observability } from './default';

/**
 * Test exporter for tracing events with real-time span lifecycle validation.
 *
 * Features:
 * - Captures all tracing events (SPAN_STARTED, SPAN_UPDATED, SPAN_ENDED)
 * - Real-time validation of span lifecycles using Vitest expect()
 * - Console logging of all events for debugging
 * - Automatic detection of incomplete spans
 * - Helper methods for test assertions
 *
 * Validation Rules:
 * - Normal spans must start before they end
 * - Event spans (zero duration) should only emit SPAN_ENDED
 * - No span should start twice or be left incomplete
 */
class TestExporter implements ObservabilityExporter {
  name = 'test-exporter';
  private events: TracingEvent[] = [];
  private spanStates = new Map<
    string,
    {
      hasStart: boolean;
      hasEnd: boolean;
      hasUpdate: boolean;
      events: TracingEvent[];
      isEventSpan?: boolean;
    }
  >();

  private logs: string[] = [];

  async exportTracingEvent(event: TracingEvent) {
    const logMessage = `[TestExporter] ${event.type}: ${event.exportedSpan.type} "${event.exportedSpan.name}" (trace: ${event.exportedSpan.traceId.slice(-8)}, span: ${event.exportedSpan.id.slice(-8)})`;

    // Store log for potential test failure reporting
    this.logs.push(logMessage);

    // Only log to console in verbose mode or if TRACING_VERBOSE is set
    if (process.env.TRACING_VERBOSE === 'true') {
      console.log(logMessage);
    }
    // Otherwise, logs will only appear on test failures

    const spanId = event.exportedSpan.id;
    const state = this.spanStates.get(spanId) || {
      hasStart: false,
      hasEnd: false,
      hasUpdate: false,
      events: [],
    };

    // Real-time validation as events arrive using Vitest expect
    if (event.type === TracingEventType.SPAN_STARTED) {
      expect(
        state.hasStart,
        `Span ${spanId} (${event.exportedSpan.type} "${event.exportedSpan.name}") started twice`,
      ).toBe(false);
      state.hasStart = true;
    } else if (event.type === TracingEventType.SPAN_ENDED) {
      if (event.exportedSpan.isEvent) {
        // Event spans should only emit SPAN_ENDED, no SPAN_STARTED or SPAN_UPDATED
        expect(
          state.hasStart,
          `Event span ${spanId} (${event.exportedSpan.type} "${event.exportedSpan.name}") incorrectly received SPAN_STARTED. Event spans should only emit SPAN_ENDED.`,
        ).toBe(false);
        expect(
          state.hasUpdate,
          `Event span ${spanId} (${event.exportedSpan.type} "${event.exportedSpan.name}") incorrectly received SPAN_UPDATED. Event spans should only emit SPAN_ENDED.`,
        ).toBe(false);
        state.isEventSpan = true;
      } else {
        // Normal span should have started
        expect(
          state.hasStart,
          `Normal span ${spanId} (${event.exportedSpan.type} "${event.exportedSpan.name}") ended without starting`,
        ).toBe(true);
      }
      state.hasEnd = true;
    } else if (event.type === TracingEventType.SPAN_UPDATED) {
      // We'll validate event span constraints later in SPAN_ENDED since we can't determine
      // if it's an event span until then
      state.hasUpdate = true;
    }

    state.events.push(event);
    this.spanStates.set(spanId, state);
    this.events.push(event);
  }

  async shutdown() {}

  reset() {
    this.events = [];
    this.spanStates.clear();
  }

  // Helper method to get final spans by type for test assertions
  getSpansByType<T extends SpanType>(type: T): ExportedSpan<T>[] {
    return Array.from(this.spanStates.values())
      .filter(state => {
        // Only return completed spans of the requested type
        // Check the final span's type, not the first event
        const finalEvent =
          state.events.find(e => e.type === TracingEventType.SPAN_ENDED) || state.events[state.events.length - 1];
        return state.hasEnd && finalEvent?.exportedSpan.type === type;
      })
      .map(state => {
        // Return the final span from SPAN_ENDED event
        const endEvent = state.events.find(e => e.type === TracingEventType.SPAN_ENDED);
        return endEvent!.exportedSpan;
      }) as ExportedSpan<T>[];
  }

  // Helper to get all incomplete spans (spans that started but never ended)
  getIncompleteSpans(): Array<{ spanId: string; span: AnyExportedSpan | undefined; state: any }> {
    return Array.from(this.spanStates.entries())
      .filter(([_, state]) => !state.hasEnd)
      .map(([spanId, state]) => ({
        spanId,
        span: state.events[0]?.exportedSpan,
        state: { hasStart: state.hasStart, hasUpdate: state.hasUpdate, hasEnd: state.hasEnd },
      }));
  }

  /**
   * Gets all spans from captured events for trace ID validation and general analysis.
   *
   * @returns Array of unique spans (one per span ID)
   *
   * Note: For specific span types, prefer using getSpansByType() for more precise filtering
   */
  getAllSpans(): (AnyExportedSpan | undefined)[] {
    return Array.from(this.spanStates.values()).map(state => {
      // Return the final span from SPAN_ENDED event, or latest event if not ended
      const endEvent = state.events.find(e => e.type === TracingEventType.SPAN_ENDED);
      return endEvent ? endEvent.exportedSpan : state.events[state.events.length - 1]?.exportedSpan;
    });
  }

  /**
   * Dumps all logs to help with debugging test failures.
   * Can be called from anywhere during a test.
   */
  dumpLogsOnFailure() {
    console.error('\n=== TEST FAILURE - DUMPING ALL EXPORTER LOGS ===');
    this.logs.forEach(log => console.error(log));
    console.error('=== END EXPORTER LOGS ===\n');
  }

  /**
   * Performs final test expectations that are common to all tracing tests.
   *
   * Validates:
   * - All spans share the same trace ID (context propagation)
   * - No incomplete spans remain (all spans completed properly)
   */
  finalExpectations() {
    try {
      // All spans should share the same trace ID (context propagation)
      const allSpans = this.getAllSpans();
      const traceIds = [...new Set(allSpans.map(span => span?.traceId))];
      expect(traceIds).toHaveLength(1);

      // Ensure all spans completed properly
      const incompleteSpans = this.getIncompleteSpans();
      expect(
        incompleteSpans,
        `Found incomplete spans: ${JSON.stringify(incompleteSpans.map(s => ({ type: s.span?.type, name: s.span?.name, state: s.state })))}`,
      ).toHaveLength(0);
    } catch (error) {
      // On failure, dump all logs to help with debugging
      console.error('\n=== TEST FAILURE - DUMPING ALL EXPORTER LOGS ===');
      this.logs.forEach(log => console.error(log));
      console.error('=== END EXPORTER LOGS ===\n');

      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Get all captured logs from this test
   */
  listLogs(): string[] {
    return [...this.logs];
  }

  /**
   * Clear all captured logs (useful for resetting between tests)
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Print all logs to console (useful for debugging specific tests)
   */
  dumpLogs(testName?: string): void {
    if (testName) {
      console.log(`\n=== LOGS FOR ${testName} ===`);
    } else {
      console.log('\n=== EXPORTER LOGS ===');
    }
    this.logs.forEach(log => console.log(log));
    console.log('=== END LOGS ===\n');
  }
}

// Test tools for integration testing

/**
 * Calculator tool for testing mathematical operations.
 * Supports add, multiply, subtract, and divide operations.
 * Used to test tool execution tracing within agents and workflows.
 */

const calculatorTool = createTool({
  id: 'calculator',
  description: 'Performs calculations',
  inputSchema: z.object({
    operation: z.string(),
    a: z.number(),
    b: z.number(),
  }),
  outputSchema: z.object({
    result: z.number(),
  }),
  execute: async inputData => {
    const { operation, a, b } = inputData;
    const operations = {
      add: a + b,
      multiply: a * b,
      subtract: a - b,
      divide: a / b,
    };
    return { result: operations[operation as keyof typeof operations] || 0 };
  },
});

const apiToolInputSchema = z.object({
  endpoint: z.string(),
  method: z.string().default('GET'),
});

/**
 * API tool for testing HTTP-like operations.
 * Simulates making API calls with endpoint and method parameters.
 * Used to test tool execution with custom metadata and tracing context.
 */
const apiTool = createTool({
  id: 'api-call',
  description: 'Makes API calls',
  inputSchema: apiToolInputSchema,
  outputSchema: z.object({
    status: z.number(),
    data: z.any(),
  }),
  execute: async (inputData, context?: ToolExecutionContext<typeof apiToolInputSchema>) => {
    const { endpoint, method } = inputData;
    // Example of adding custom metadata
    context?.tracingContext?.currentSpan?.update({
      metadata: {
        apiEndpoint: endpoint,
        httpMethod: method,
        timestamp: Date.now(),
      },
    });

    return { status: 200, data: { message: 'Mock API response' } };
  },
});

const workflowToolInputSchema = z.object({
  workflowId: z.string(),
  input: z.any(),
});

/**
 * Workflow execution tool for testing workflow-in-workflow scenarios.
 * Executes a workflow by ID with given input data.
 * Used to test agent tools that launch workflows and context propagation.
 */
const workflowExecutorTool = createTool({
  id: 'workflow-executor',
  description: 'Executes a workflow',
  inputSchema: workflowToolInputSchema,
  outputSchema: z.object({
    result: z.any(),
  }),
  execute: async (inputData, context?: ToolExecutionContext<typeof workflowToolInputSchema>) => {
    const { workflowId, input: workflowInput } = inputData;
    expect(context?.mastra, 'Mastra instance should be available in tool execution context').toBeTruthy();

    const workflow = context?.mastra?.getWorkflow(workflowId);
    const run = await workflow?.createRun();
    const result = await run?.start({ inputData: workflowInput });

    return { result: result?.status === 'success' ? result.result : null };
  },
});

/**
 * Creates a workflow with a single step for basic testing.
 * Used to test simple workflow execution and span generation.
 * Returns input with 'processed' suffix.
 */
const createSimpleWorkflow = () => {
  const simpleStep = createStep({
    id: 'simple-step',
    inputSchema: z.object({ input: z.string() }),
    outputSchema: z.object({ output: z.string() }),
    execute: async ({ inputData }) => ({ output: `${inputData.input} processed` }),
  });

  return createWorkflow({
    id: 'simple-workflow',
    inputSchema: z.object({ input: z.string() }),
    outputSchema: z.object({ output: z.string() }),
    steps: [simpleStep],
  })
    .then(simpleStep)
    .commit();
};

// Fast execution mocks - Combined V1 and V2 mocks that support both generate and stream

// Track which tools have been called to prevent duplicates
let toolsCalled = new Set<string>();

// Reset tool call tracking before each test
function resetToolCallTracking() {
  toolsCalled.clear();
}

/**
 * Extracts text from various prompt formats used by AI SDK models.
 * Handles both V1 (string/array) and V2 (message array) formats.
 *
 * @param prompt - The prompt in various formats
 * @returns Extracted text string
 */
function extractPromptText(prompt: any): string {
  if (typeof prompt === 'string') {
    return prompt;
  } else if (Array.isArray(prompt)) {
    return prompt
      .map(msg => {
        if (typeof msg === 'string') return msg;
        if (typeof msg === 'object' && msg && 'content' in msg) {
          return typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content.map((c: any) => c.text || c.content || '').join(' ')
              : String(msg.content);
        }
        return String(msg);
      })
      .join(' ');
  } else {
    return String(prompt);
  }
}

/**
 * Common tool calling logic for mock models.
 * Determines which tool to call based on prompt content and returns tool call info.
 *
 * @param prompt - The extracted prompt text
 * @returns Tool call info or null if no tool should be called
 */
function getToolCallFromPrompt(prompt: string): { toolName: string; toolCallId: string; args: any } | null {
  const lowerPrompt = prompt.toLowerCase();

  // Metadata tool detection - FIRST PRIORITY
  if (lowerPrompt.includes('metadata tool') || lowerPrompt.includes('process some data')) {
    if (!toolsCalled.has('metadataTool')) {
      toolsCalled.add('metadataTool');
      return {
        toolName: 'metadataTool',
        toolCallId: 'call-metadata-1',
        args: { input: 'some data' },
      };
    }
  }

  // Child span tool detection - SECOND PRIORITY
  if (lowerPrompt.includes('child span tool') || lowerPrompt.includes('process test-data')) {
    if (!toolsCalled.has('childSpanTool')) {
      toolsCalled.add('childSpanTool');
      return {
        toolName: 'childSpanTool',
        toolCallId: 'call-child-span-1',
        args: { input: 'test-data' },
      };
    }
  }

  // Calculator tool detection - more restrictive
  if (
    (lowerPrompt.includes('calculate') && (lowerPrompt.includes('+') || lowerPrompt.includes('*'))) ||
    lowerPrompt.includes('use the calculator tool')
  ) {
    if (!toolsCalled.has('calculator')) {
      toolsCalled.add('calculator');
      return {
        toolName: 'calculator',
        toolCallId: 'call-calc-1',
        args: { operation: 'add', a: 5, b: 3 },
      };
    }
  }

  // API tool detection
  if (lowerPrompt.includes('api') || lowerPrompt.includes('endpoint')) {
    if (!toolsCalled.has('apiCall')) {
      toolsCalled.add('apiCall');
      return {
        toolName: 'apiCall',
        toolCallId: 'call-api-1',
        args: { endpoint: '/test', method: 'GET' },
      };
    }
  }

  // Workflow executor tool detection
  if (lowerPrompt.includes('execute workflows using the workflow executor tool')) {
    if (!toolsCalled.has('workflowExecutor')) {
      toolsCalled.add('workflowExecutor');
      return {
        toolName: 'workflowExecutor',
        toolCallId: 'call-workflow-1',
        args: { workflowId: 'simpleWorkflow', input: { input: 'test input' } },
      };
    }
  }

  // Direct workflow detection
  if (lowerPrompt.includes('execute workflows that exist in your config')) {
    if (!toolsCalled.has('workflow-simpleWorkflow')) {
      toolsCalled.add('workflow-simpleWorkflow');
      return {
        toolName: 'workflow-simpleWorkflow',
        toolCallId: 'call-workflow-1',
        args: { input: 'test input' },
      };
    }
  }

  return null;
}

/**
 * Mock V1 language model for testing legacy generation methods.
 * Supports both generate() and stream() operations.
 * Intelligently calls tools based on prompt content or returns text responses.
 * Limits tool calls to one per test to avoid infinite loops.
 */
const mockModelV1 = new MockLanguageModelV1({
  doGenerate: async options => {
    const prompt = extractPromptText(options.prompt);
    const toolCall = getToolCallFromPrompt(prompt);

    if (toolCall) {
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'tool-calls' as const,
        usage: { promptTokens: 10, completionTokens: 5 },
        text: '',
        toolCalls: [
          {
            toolCallType: 'function',
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args: JSON.stringify(toolCall.args),
          },
        ],
      };
    }

    // Default text response
    return {
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 20 },
      text: 'Mock response',
    };
  },
  doStream: async options => {
    const prompt = extractPromptText(options.prompt);
    const toolCall = getToolCallFromPrompt(prompt);

    if (toolCall) {
      return {
        stream: simulateReadableStream({
          chunks: [
            {
              type: 'tool-call-delta',
              toolCallType: 'function',
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              argsTextDelta: JSON.stringify(toolCall.args),
            },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              args: JSON.stringify(toolCall.args),
            },
            { type: 'finish', finishReason: 'tool-calls', usage: { promptTokens: 10, completionTokens: 5 } },
          ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    }

    // Default streaming text response
    return {
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-delta', textDelta: 'Mock ' },
          { type: 'text-delta', textDelta: 'streaming ' },
          { type: 'text-delta', textDelta: 'response' },
          { type: 'finish', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 20 } },
        ],
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
    };
  },
});

/**
 * Mock V2 language model for testing new generation methods.
 * Supports both generate() and stream() operations.
 * Intelligently calls tools based on prompt content or returns structured text responses.
 * Limits tool calls to one per test to avoid infinite loops.
 * Supports structured output mode.
 */
const mockModelV2 = new MockLanguageModelV2({
  doGenerate: async options => {
    const prompt = extractPromptText(options.prompt);
    const toolCall = getToolCallFromPrompt(prompt);

    if (toolCall) {
      return {
        content: [],
        finishReason: 'tool-calls' as const,
        usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
        warnings: [],
        toolCalls: [
          {
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args: toolCall.args,
          },
        ],
      };
    }

    // Check if this is the internal structuring agent call
    const isStructuringCall = prompt.includes('Extract and structure the key information');

    // Return structured JSON for both the initial call and the structuring agent call
    if (isStructuringCall || (options as any).schemaName || (options as any).schemaDescription) {
      // Return schema-appropriate output based on the prompt
      let structuredData = { items: 'test structured output' };
      if (isStructuringCall && prompt.includes('summary') && prompt.includes('sentiment')) {
        structuredData = { summary: 'A test summary', sentiment: 'positive' } as any;
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(structuredData) }],
        finishReason: 'stop',
        usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
        warnings: [],
      };
    }

    // Default text response
    return {
      content: [{ type: 'text', text: 'Mock V2 response' }],
      finishReason: 'stop',
      usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
      warnings: [],
    };
  },
  doStream: async options => {
    const prompt = extractPromptText(options.prompt);
    const toolCall = getToolCallFromPrompt(prompt);

    if (toolCall) {
      const argsJson = JSON.stringify(toolCall.args);
      return {
        stream: convertArrayToReadableStream([
          {
            type: 'tool-input-start',
            id: toolCall.toolCallId,
            toolName: toolCall.toolName,
          },
          {
            type: 'tool-input-delta',
            id: toolCall.toolCallId,
            delta: argsJson,
          },
          {
            type: 'tool-input-end',
            id: toolCall.toolCallId,
          },
          {
            type: 'tool-call',
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args: argsJson,
            input: argsJson,
          },
          { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 } },
        ]),
      };
    }

    // Check if this is the internal structuring agent call
    const isStructuringCall = prompt.includes('Extract and structure the key information');

    // Return structured JSON for both the initial call and the structuring agent call
    if (isStructuringCall || (options as any).schemaName || (options as any).schemaDescription) {
      // Return schema-appropriate output based on the prompt
      let structuredData = { items: 'test structured output' };
      if (isStructuringCall && prompt.includes('summary') && prompt.includes('sentiment')) {
        structuredData = { summary: 'A test summary', sentiment: 'positive' } as any;
      }
      const structuredOutput = JSON.stringify(structuredData);
      return {
        stream: convertArrayToReadableStream([
          { type: 'text-delta', id: '1', delta: structuredOutput },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 } },
        ]),
      };
    }

    // Default streaming text response
    return {
      stream: convertArrayToReadableStream([
        { type: 'text-delta', id: '1', delta: 'Mock ' },
        { type: 'text-delta', id: '2', delta: 'V2 streaming ' },
        { type: 'text-delta', id: '3', delta: 'response' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 } },
      ]),
    };
  },
});

/**
 * Creates base Mastra configuration for tests with tracing enabled.
 *
 * @param testExporter - The TestExporter instance to capture tracing events
 * @returns Base configuration object with tracing configured
 *
 * Features:
 * - Mock storage for isolation
 * - tracing with TestExporter for span validation
 * - Integration tests configuration
 */
function getBaseMastraConfig(testExporter: TestExporter, options = {}) {
  return {
    storage: new MockStore(),
    observability: new Observability({
      configs: {
        test: {
          ...options,
          serviceName: 'integration-tests',
          exporters: [testExporter],
        },
      },
    }),
  };
}

// Parameterized test data for different agent generation methods
const agentMethods = [
  {
    name: 'generateLegacy',
    method: async (agent: Agent, prompt: string, options?: any) => {
      const result = await agent.generateLegacy(prompt, options);
      return { text: result.text, object: result.object, traceId: result.traceId };
    },
    model: mockModelV1,
    expectedText: 'Mock response',
  },
  {
    name: 'generate',
    method: async (agent: Agent, prompt: string, options?: any) => {
      const result = await agent.generate(prompt, options);
      return { text: result.text, object: result.object, traceId: result.traceId };
    },
    model: mockModelV2,
    expectedText: 'Mock V2 streaming response',
  },
  {
    name: 'streamLegacy',
    method: async (agent: Agent, prompt: string, options?: any) => {
      const result = await agent.streamLegacy(prompt, options);
      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }
      return { text: fullText, object: result.object, traceId: result.traceId };
    },
    model: mockModelV1,
    expectedText: 'Mock streaming response',
  },
  {
    name: 'stream',
    method: async (agent: Agent, prompt: string, options?: any) => {
      const result = await agent.stream(prompt, options);
      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }
      const object = await result.object;
      return { text: fullText, object, traceId: result.traceId };
    },
    model: mockModelV2,
    expectedText: 'Mock V2 streaming response',
  },
];

describe('Tracing Integration Tests', () => {
  let testExporter: TestExporter;

  beforeEach(() => {
    // Reset tool call tracking for each test
    resetToolCallTracking();
    // Create fresh test exporter for each test
    testExporter = new TestExporter();
  });

  afterEach(async context => {
    // If test failed, dump logs for debugging
    if (context?.task?.result?.state === 'fail') {
      testExporter.dumpLogsOnFailure();
    }
  });

  it('should trace workflow with branching conditions', async () => {
    const checkCondition = createStep({
      id: 'check-condition',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ branch: z.string() }),
      execute: async ({ inputData }) => ({
        branch: inputData.value > 10 ? 'high' : 'low',
      }),
    });

    const processHigh = createStep({
      id: 'process-high',
      inputSchema: z.object({ branch: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async () => ({ result: 'high-value-processing' }),
    });

    const processLow = createStep({
      id: 'process-low',
      inputSchema: z.object({ branch: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async () => ({ result: 'low-value-processing' }),
    });

    const branchingWorkflow = createWorkflow({
      id: 'branching-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.string() }),
      steps: [checkCondition, processHigh, processLow],
    })
      .then(checkCondition)
      .branch([
        [async ({ inputData }) => inputData.branch === 'high', processHigh],
        [async ({ inputData }) => inputData.branch === 'low', processLow],
      ])
      .commit();

    const mastra = new Mastra({
      ...getBaseMastraConfig(testExporter),
      workflows: { branchingWorkflow },
    });

    const customMetadata = {
      id1: 123,
      id2: 'tacos',
    };

    const resourceId = 'test-resource-id';
    const workflow = mastra.getWorkflow('branchingWorkflow');
    const run = await workflow.createRun({ resourceId });
    const result = await run.start({ inputData: { value: 15 }, tracingOptions: { metadata: customMetadata } });
    expect(result.status).toBe('success');
    expect(result.traceId).toBeDefined();

    const workflowRunSpans = testExporter.getSpansByType(SpanType.WORKFLOW_RUN);
    const workflowStepSpans = testExporter.getSpansByType(SpanType.WORKFLOW_STEP);
    const conditionalSpans = testExporter.getSpansByType(SpanType.WORKFLOW_CONDITIONAL);

    expect(workflowRunSpans.length).toBe(1); // One workflow run
    const workflowRunSpan = workflowRunSpans[0];

    expect(workflowRunSpan?.traceId).toBe(result.traceId);
    expect(workflowRunSpan?.isRootSpan).toBe(true);
    expect(workflowRunSpan?.metadata?.runId).toBeDefined();
    expect(workflowRunSpan?.metadata?.resourceId).toBe(resourceId);
    expect(workflowRunSpan?.metadata?.id1).toBe(customMetadata.id1);
    expect(workflowRunSpan?.metadata?.id2).toBe(customMetadata.id2);

    expect(workflowStepSpans.length).toBe(2); // checkCondition + processHigh (value=15 > 10)
    expect(conditionalSpans.length).toBe(1); // One branch evaluation

    expect(workflowRunSpans[0]?.input).toMatchObject({ value: 15 });
    expect(workflowRunSpans[0]?.output).toMatchObject({ 'process-high': { result: 'high-value-processing' } });
    expect(workflowRunSpans[0]?.startTime).toBeDefined();
    expect(workflowRunSpans[0]?.endTime).toBeDefined();

    const checkConditionSpan = workflowStepSpans[0];
    expect(checkConditionSpan?.name).toBe("workflow step: 'check-condition'");
    expect(checkConditionSpan?.input).toMatchObject({ value: 15 });
    expect(checkConditionSpan?.output).toMatchObject({ branch: 'high' });

    testExporter.finalExpectations();
  });

  it('should trace unregistered workflow used directly as step in workflow', async () => {
    // Create an unregistered workflow (not in Mastra registry)
    const unregisteredWorkflow = createSimpleWorkflow();

    // Create a registered workflow that uses the unregistered workflow as a step
    const mainWorkflow = createWorkflow({
      id: 'main-workflow',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      steps: [],
    })
      .dowhile(unregisteredWorkflow, async () => {
        // Stop after one iteration
        return false;
      })
      .map(async ({ inputData }) => ({ result: inputData.output || 'processed' }))
      .commit();

    const mastra = new Mastra({
      ...getBaseMastraConfig(testExporter),
      workflows: { mainWorkflow }, // Only register mainWorkflow, not the inner one
    });

    const workflow = mastra.getWorkflow('mainWorkflow');
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: { input: 'test unregistered workflow as step' },
    });
    expect(result.status).toBe('success');
    expect(result.traceId).toBeDefined();

    const workflowRunSpans = testExporter.getSpansByType(SpanType.WORKFLOW_RUN);
    const workflowStepSpans = testExporter.getSpansByType(SpanType.WORKFLOW_STEP);
    expect(workflowRunSpans[0]?.traceId).toBe(result.traceId);

    expect(workflowRunSpans.length).toBe(2); // Main + unregistered workflow
    expect(workflowStepSpans.length).toBe(3); // doWhile step + unregistered step + map step

    testExporter.finalExpectations();
  });

  it('should trace registered workflow nested in step in workflow', async () => {
    // Create an registered workflow
    const simpleWorkflow = createSimpleWorkflow();

    // Create a parent workflow that calls the simple workflow as a step
    const nestedWorkflowStep = createStep({
      id: 'nested-workflow-step',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ output: z.string() }),
      execute: async ({ inputData, mastra }) => {
        const childWorkflow = mastra?.getWorkflow('simpleWorkflow');
        expect(childWorkflow, 'Simple workflow should be available from Mastra instance').toBeTruthy();
        const run = await childWorkflow.createRun();
        const result = await run.start({ inputData: { input: inputData.input } });

        return { output: result.status === 'success' ? result.result?.output || 'no output' : 'failed' };
      },
    });

    const parentWorkflow = createWorkflow({
      id: 'parent-workflow',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ output: z.string() }),
      steps: [nestedWorkflowStep],
    })
      .then(nestedWorkflowStep)
      .commit();

    const mastra = new Mastra({
      ...getBaseMastraConfig(testExporter),
      workflows: { simpleWorkflow, parentWorkflow },
    });

    const workflow = mastra.getWorkflow('parentWorkflow');
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { input: 'nested test' } });
    expect(result.status).toBe('success');
    expect(result.traceId).toBeDefined();

    const workflowRunSpans = testExporter.getSpansByType(SpanType.WORKFLOW_RUN);
    const workflowStepSpans = testExporter.getSpansByType(SpanType.WORKFLOW_STEP);
    expect(workflowRunSpans[0]?.traceId).toBe(result.traceId);

    expect(workflowRunSpans.length).toBe(2); // Parent workflow + child workflow
    expect(workflowStepSpans.length).toBe(2); // nested-workflow-step + simple-step

    testExporter.finalExpectations();
  });

  it('should trace tool used directly as workflow step', async () => {
    const toolExecutorStep = createStep(calculatorTool);

    const toolWorkflow = createWorkflow({
      id: 'tool-workflow',
      inputSchema: z.object({ a: z.number(), b: z.number(), operation: z.string() }),
      outputSchema: z.object({ result: z.number() }),
      steps: [toolExecutorStep],
    })
      .then(toolExecutorStep)
      .commit();

    const mastra = new Mastra({
      ...getBaseMastraConfig(testExporter),
      workflows: { toolWorkflow },
    });

    const workflow = mastra.getWorkflow('toolWorkflow');
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: { a: 5, b: 3, operation: 'add' },
    });
    expect(result.status).toBe('success');
    expect(result.traceId).toBeDefined();

    const workflowRunSpans = testExporter.getSpansByType(SpanType.WORKFLOW_RUN);
    const workflowStepSpans = testExporter.getSpansByType(SpanType.WORKFLOW_STEP);
    // const toolCallSpans = testExporter.getSpansByType(SpanType.TOOL_CALL);
    expect(workflowRunSpans[0]?.traceId).toBe(result.traceId);

    expect(workflowRunSpans.length).toBe(1); // One workflow run
    expect(workflowStepSpans.length).toBe(1); // One step: tool-executor
    // TODO: should a tool used as a step have a toolCall span?
    // Maybe not, since an agent didn't call the tool?
    // expect(toolCallSpans.length).toBe(1); // calculate tool

    testExporter.finalExpectations();
  });

  it('should add metadata in workflow step to span', async () => {
    const customMetadataStep = createStep({
      id: 'custom-metadata',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ output: z.string() }),
      execute: async ({ inputData, tracingContext }) => {
        const { value } = inputData;
        tracingContext.currentSpan?.update({
          metadata: {
            customValue: value,
            stepType: 'metadata-test',
            executionTime: Date.now(),
          },
        });

        return { output: `Processed: ${value}` };
      },
    });

    const metadataWorkflow = createWorkflow({
      id: 'metadata-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ output: z.string() }),
      steps: [customMetadataStep],
    })
      .then(customMetadataStep)
      .commit();

    const mastra = new Mastra({
      ...getBaseMastraConfig(testExporter),
      workflows: { metadataWorkflow },
    });

    const workflow = mastra.getWorkflow('metadataWorkflow');
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { value: 'tacos' } });
    expect(result.status).toBe('success');
    expect(result.traceId).toBeDefined();

    const workflowStepSpans = testExporter.getSpansByType(SpanType.WORKFLOW_STEP);

    expect(workflowStepSpans.length).toBe(1);
    const stepSpan = workflowStepSpans[0];

    expect(stepSpan?.metadata?.customValue).toBe('tacos');
    expect(stepSpan?.metadata?.stepType).toBe('metadata-test');
    expect(stepSpan?.metadata?.executionTime).toBeDefined();
    expect(stepSpan?.traceId).toBe(result.traceId);

    testExporter.finalExpectations();
  });

  it('should add child spans in workflow step', async () => {
    const childSpanStep = createStep({
      id: 'child-span',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ output: z.string() }),
      execute: async ({ inputData, tracingContext }) => {
        const childSpan = tracingContext.currentSpan?.createChildSpan({
          type: SpanType.GENERIC,
          name: 'custom-child-operation',
        });

        childSpan?.update({
          metadata: {
            childOperation: 'processing',
            inputValue: inputData.value,
          },
        });

        childSpan?.end({
          metadata: {
            endValue: 'pizza',
          },
        });

        return { output: `Child processed: ${inputData.value}` };
      },
    });

    const childSpanWorkflow = createWorkflow({
      id: 'child-span-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ output: z.string() }),
      steps: [childSpanStep],
    })
      .then(childSpanStep)
      .commit();

    const mastra = new Mastra({
      ...getBaseMastraConfig(testExporter),
      workflows: { childSpanWorkflow },
    });

    const workflow = mastra.getWorkflow('childSpanWorkflow');
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: { value: 'child-span-test' },
    });

    expect(result.status).toBe('success');
    expect(result.traceId).toBeDefined();

    const allSpans = testExporter.getAllSpans();
    const childSpans = allSpans.filter(span => span?.name === 'custom-child-operation');
    const stepSpans = allSpans.filter(
      span => span?.type === SpanType.WORKFLOW_STEP && span?.name?.includes('child-span'),
    );

    expect(childSpans.length).toBe(1);
    expect(stepSpans.length).toBe(1);
    const childSpan = childSpans[0];
    const stepSpan = stepSpans[0];

    expect(childSpan?.traceId).toBe(stepSpan?.traceId);
    expect(childSpan?.metadata?.childOperation).toBe('processing');
    expect(childSpan?.metadata?.inputValue).toBe('child-span-test');
    expect(childSpan?.metadata?.endValue).toBe('pizza');
    expect(childSpan?.traceId).toBe(result.traceId);

    testExporter.finalExpectations();
  });

  describe.each(agentMethods)(
    'should trace agent with multiple tools HIDING internal spans using $name',
    ({ name, method, model }) => {
      it(`should trace spans correctly`, async () => {
        const testAgent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a test agent',
          model,
          tools: {
            calculator: calculatorTool,
            apiCall: apiTool,
            workflowExecutor: workflowExecutorTool,
          },
        });

        const mastra = new Mastra({
          ...getBaseMastraConfig(testExporter),
          agents: { testAgent },
        });

        const resourceId = 'test-resource-id';
        const agent = mastra.getAgent('testAgent');
        const result = await method(agent, 'Calculate 5 + 3', { resourceId });
        expect(result.text).toBeDefined();
        expect(result.traceId).toBeDefined();

        const agentRunSpans = testExporter.getSpansByType(SpanType.AGENT_RUN);
        const llmGenerationSpans = testExporter.getSpansByType(SpanType.MODEL_GENERATION);
        const llmStepSpans = testExporter.getSpansByType(SpanType.MODEL_STEP);
        const llmChunkSpans = testExporter.getSpansByType(SpanType.MODEL_CHUNK);
        const toolCallSpans = testExporter.getSpansByType(SpanType.TOOL_CALL);
        const workflowSpans = testExporter.getSpansByType(SpanType.WORKFLOW_RUN);
        const workflowSteps = testExporter.getSpansByType(SpanType.WORKFLOW_STEP);

        expect(agentRunSpans.length).toBe(1); // one agent run
        expect(llmGenerationSpans.length).toBe(1); // tool call
        expect(toolCallSpans.length).toBe(1); // one tool call (calculator)
        expect(workflowSpans.length).toBe(0); // no workflows
        expect(workflowSteps.length).toBe(0); // no workflows

        // For non-legacy methods: we track all chunks including tool-call, step-start, step-finish, finish, etc.
        // For legacy methods: no chunk tracking
        if (name.includes('Legacy')) {
          expect(llmChunkSpans.length).toBe(0);
          expect(llmStepSpans.length).toBe(0); // no step tracking in legacy
        } else {
          // VNext tracks chunks - verify we have at least tool-call chunk
          expect(llmChunkSpans.length).toBeGreaterThan(0);
          const toolCallChunk = llmChunkSpans.find(s => s.name === "chunk: 'tool-call'");
          expect(toolCallChunk).toBeDefined();

          // Verify tool-call chunk output structure
          expect(toolCallChunk?.output).toBeDefined();
          expect(toolCallChunk?.output?.toolName).toBeDefined();
          expect(typeof toolCallChunk?.output?.toolName).toBe('string');
          expect(toolCallChunk?.output?.toolCallId).toBeDefined();
          expect(toolCallChunk?.output?.toolInput).toBeDefined();
          expect(typeof toolCallChunk?.output?.toolInput).toBe('object');
        }

        const agentRunSpan = agentRunSpans[0];
        const llmGenerationSpan = llmGenerationSpans[0];
        const toolCallSpan = toolCallSpans[0];

        expect(agentRunSpan?.traceId).toBe(result.traceId);
        expect(agentRunSpan?.metadata?.runId).toBeDefined();
        expect(agentRunSpan?.metadata?.resourceId).toBe(resourceId);

        // verify span nesting
        expect(llmGenerationSpan?.parentSpanId).toEqual(agentRunSpan?.id);
        if (name.includes('Legacy')) {
          expect(toolCallSpan?.parentSpanId).toEqual(agentRunSpan?.id);
        } else {
          const llmStepSpan = llmStepSpans[0];
          expect(llmStepSpan).toBeDefined();
          expect(toolCallSpan?.parentSpanId).toEqual(llmStepSpan?.id);
        }

        expect(llmGenerationSpan?.name).toBe("llm: 'mock-model-id'");
        expect(llmGenerationSpan?.input.messages).toHaveLength(2);
        switch (name) {
          case 'generateLegacy':
            expect(llmGenerationSpan?.output.text).toBe('Mock response');
            expect(agentRunSpan?.output.text).toBe('Mock response');
            break;
          case 'streamLegacy':
            expect(llmGenerationSpan?.output.text).toBe('Mock streaming response');
            expect(agentRunSpan?.output.text).toBe('Mock streaming response');
            break;
          default: // VNext generate & stream
            expect(llmGenerationSpan?.output.text).toBe('Mock V2 streaming response');
            expect(agentRunSpan?.output.text).toBe('Mock V2 streaming response');
            break;
        }
        expect(llmGenerationSpan?.attributes?.usage?.totalTokens).toBeGreaterThan(1);

        expect(llmGenerationSpan?.endTime).toBeDefined();
        expect(agentRunSpan?.endTime).toBeDefined();
        expect(llmGenerationSpan?.endTime!.getTime()).toBeLessThanOrEqual(agentRunSpan?.endTime!.getTime());

        testExporter.finalExpectations();
      });
    },
  );

  describe.each(agentMethods)(
    'should trace agent with multiple tools SHOWING internal spans using $name',
    ({ name, method, model }) => {
      it(`should trace spans correctly`, async () => {
        const testAgent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a test agent',
          model,
          tools: {
            calculator: calculatorTool,
            apiCall: apiTool,
            workflowExecutor: workflowExecutorTool,
          },
        });

        const mastra = new Mastra({
          ...getBaseMastraConfig(testExporter, { includeInternalSpans: true }),
          agents: { testAgent },
        });

        const agent = mastra.getAgent('testAgent');
        const result = await method(agent, 'Calculate 5 + 3');
        expect(result.text).toBeDefined();
        expect(result.traceId).toBeDefined();

        const agentRunSpans = testExporter.getSpansByType(SpanType.AGENT_RUN);
        const llmGenerationSpans = testExporter.getSpansByType(SpanType.MODEL_GENERATION);
        const llmChunkSpans = testExporter.getSpansByType(SpanType.MODEL_CHUNK);
        const toolCallSpans = testExporter.getSpansByType(SpanType.TOOL_CALL);
        const workflowSpans = testExporter.getSpansByType(SpanType.WORKFLOW_RUN);
        const workflowSteps = testExporter.getSpansByType(SpanType.WORKFLOW_STEP);

        expect(agentRunSpans.length).toBe(1); // one agent run
        expect(llmGenerationSpans.length).toBe(1); // tool call
        expect(toolCallSpans.length).toBe(1); // one tool call (calculator)

        // For non-legacy methods: we track all chunks including tool-call, step-start, step-finish, finish, etc.
        // For legacy methods: no chunk tracking
        if (name.includes('Legacy')) {
          expect(llmChunkSpans.length).toBe(0);
        } else {
          // VNext tracks chunks - verify we have at least tool-call chunk
          expect(llmChunkSpans.length).toBeGreaterThan(0);
          const toolCallChunk = llmChunkSpans.find(s => s.name === "chunk: 'tool-call'");
          expect(toolCallChunk).toBeDefined();

          // Verify tool-call chunk output structure
          expect(toolCallChunk?.output).toBeDefined();
          expect(toolCallChunk?.output?.toolName).toBeDefined();
          expect(typeof toolCallChunk?.output?.toolName).toBe('string');
          expect(toolCallChunk?.output?.toolCallId).toBeDefined();
          expect(toolCallChunk?.output?.toolInput).toBeDefined();
          expect(typeof toolCallChunk?.output?.toolInput).toBe('object');
        }

        const agentRunSpan = agentRunSpans[0];
        const llmGenerationSpan = llmGenerationSpans[0];
        const toolCallSpan = toolCallSpans[0];

        expect(agentRunSpan?.traceId).toBe(result.traceId);

        // verify span nesting
        if (name.includes('Legacy')) {
          expect(llmGenerationSpan?.parentSpanId).toEqual(agentRunSpan?.id);
          expect(toolCallSpan?.parentSpanId).toEqual(agentRunSpan?.id);
        } else {
          // VNext
          const executionWorkflowSpan = workflowSpans.filter(span => span.name?.includes('execution-workflow'))[0];
          const agenticLoopWorkflowSpan = workflowSpans.filter(span => span.name?.includes('agentic-loop'))[0];
          const streamTextStepSpan = workflowSteps.filter(span => span.name?.includes('stream-text-step'))[0];
          expect(streamTextStepSpan?.parentSpanId).toEqual(executionWorkflowSpan?.id);
          expect(agenticLoopWorkflowSpan?.parentSpanId).toEqual(llmGenerationSpan?.id);
        }

        expect(llmGenerationSpan?.name).toBe("llm: 'mock-model-id'");
        expect(llmGenerationSpan?.input.messages).toHaveLength(2);
        switch (name) {
          case 'generateLegacy':
            expect(llmGenerationSpan?.output.text).toBe('Mock response');
            expect(agentRunSpan?.output.text).toBe('Mock response');
            break;
          case 'streamLegacy':
            expect(llmGenerationSpan?.output.text).toBe('Mock streaming response');
            expect(agentRunSpan?.output.text).toBe('Mock streaming response');
            break;
          default: // VNext generate & stream
            expect(llmGenerationSpan?.output.text).toBe('Mock V2 streaming response');
            expect(agentRunSpan?.output.text).toBe('Mock V2 streaming response');
            break;
        }
        expect(llmGenerationSpan?.attributes?.usage?.totalTokens).toBeGreaterThan(1);

        testExporter.finalExpectations();
      });
    },
  );

  describe.each(agentMethods)(
    'should trace agent with multiple tools using aisdk output format using $name',
    ({ name, method, model }) => {
      it(`should trace spans correctly`, async () => {
        const testAgent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a test agent',
          model,
          tools: {
            calculator: calculatorTool,
            apiCall: apiTool,
            workflowExecutor: workflowExecutorTool,
          },
        });

        const mastra = new Mastra({
          ...getBaseMastraConfig(testExporter),
          agents: { testAgent },
        });

        const agent = mastra.getAgent('testAgent');
        const result = await method(agent, 'Calculate 5 + 3', { format: 'aisdk' });
        expect(result.text).toBeDefined();
        expect(result.traceId).toBeDefined();

        const agentRunSpans = testExporter.getSpansByType(SpanType.AGENT_RUN);
        const llmGenerationSpans = testExporter.getSpansByType(SpanType.MODEL_GENERATION);
        const llmStepSpans = testExporter.getSpansByType(SpanType.MODEL_STEP);
        const toolCallSpans = testExporter.getSpansByType(SpanType.TOOL_CALL);
        const workflowSpans = testExporter.getSpansByType(SpanType.WORKFLOW_RUN);
        const workflowSteps = testExporter.getSpansByType(SpanType.WORKFLOW_STEP);

        expect(agentRunSpans.length).toBe(1); // one agent run
        expect(llmGenerationSpans.length).toBe(1); // tool call
        expect(toolCallSpans.length).toBe(1); // one tool call (calculator)
        expect(workflowSpans.length).toBe(0); // no workflows
        expect(workflowSteps.length).toBe(0); // no workflows

        const agentRunSpan = agentRunSpans[0];
        const llmGenerationSpan = llmGenerationSpans[0];
        const toolCallSpan = toolCallSpans[0];

        expect(agentRunSpan?.traceId).toBe(result.traceId);

        // verify span nesting
        expect(llmGenerationSpan?.parentSpanId).toEqual(agentRunSpan?.id);
        if (name.includes('Legacy')) {
          expect(toolCallSpan?.parentSpanId).toEqual(agentRunSpan?.id);
        } else {
          const llmStepSpan = llmStepSpans[0];
          expect(llmStepSpan).toBeDefined();
          expect(toolCallSpan?.parentSpanId).toEqual(llmStepSpan?.id);
        }

        expect(llmGenerationSpan?.name).toBe("llm: 'mock-model-id'");
        expect(llmGenerationSpan?.input.messages).toHaveLength(2);
        switch (name) {
          case 'generateLegacy':
            expect(llmGenerationSpan?.output.text).toBe('Mock response');
            expect(agentRunSpan?.output.text).toBe('Mock response');
            break;
          case 'streamLegacy':
            expect(llmGenerationSpan?.output.text).toBe('Mock streaming response');
            expect(agentRunSpan?.output.text).toBe('Mock streaming response');
            break;
          default: // VNext generate & stream
            expect(llmGenerationSpan?.output.text).toBe('Mock V2 streaming response');
            expect(agentRunSpan?.output.text).toBe('Mock V2 streaming response');
            break;
        }
        expect(llmGenerationSpan?.attributes?.usage?.totalTokens).toBeGreaterThan(1);

        expect(llmGenerationSpan?.endTime).toBeDefined();
        expect(agentRunSpan?.endTime).toBeDefined();
        expect(llmGenerationSpan?.endTime!.getTime()).toBeLessThanOrEqual(agentRunSpan?.endTime!.getTime());

        testExporter.finalExpectations();
      });
    },
  );

  describe.each(agentMethods.filter(m => m.name === 'stream' || m.name === 'generate'))(
    'should trace agent using structuredOutput format using $name',
    ({ method, model }) => {
      it(`should trace spans correctly`, async () => {
        const testAgent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'Return a simple response',
          model,
        });

        const outputSchema = z.object({
          items: z.string(),
        });

        const structuredOutput: StructuredOutputOptions<OutputSchema> = {
          schema: outputSchema,
          model,
        };

        const mastra = new Mastra({
          ...getBaseMastraConfig(testExporter),
          agents: { testAgent },
        });

        const agent = mastra.getAgent('testAgent');
        const result = await method(agent, 'Return a list of items separated by commas', { structuredOutput });
        expect(result.object).toBeDefined();
        expect(result.traceId).toBeDefined();

        const agentRunSpans = testExporter.getSpansByType(SpanType.AGENT_RUN);
        const llmGenerationSpans = testExporter.getSpansByType(SpanType.MODEL_GENERATION);
        const llmChunkSpans = testExporter.getSpansByType(SpanType.MODEL_CHUNK);
        const processorRunSpans = testExporter.getSpansByType(SpanType.PROCESSOR_RUN);
        const toolCallSpans = testExporter.getSpansByType(SpanType.TOOL_CALL);
        const workflowSpans = testExporter.getSpansByType(SpanType.WORKFLOW_RUN);
        const workflowSteps = testExporter.getSpansByType(SpanType.WORKFLOW_STEP);

        // Expected span structure:
        // - Test Agent AGENT_RUN (root)
        //   - Test Agent MODEL_GENERATION (initial model call)
        //   - PROCESSOR_RUN (structuredOutputProcessor)
        //     - Internal processor agent AGENT_RUN
        //       - Internal processor agent MODEL_GENERATION

        expect(agentRunSpans.length).toBe(2); // Test Agent + internal processor agent
        expect(llmGenerationSpans.length).toBe(2); // Test Agent LLM + processor agent LLM
        expect(processorRunSpans.length).toBe(1); // one processor run for structuredOutput
        expect(toolCallSpans.length).toBe(0); // no tools
        expect(workflowSpans.length).toBe(0); // no workflows
        expect(workflowSteps.length).toBe(0); // no workflows
        // For structured output: we now track object chunks
        expect(llmChunkSpans.length).toBeGreaterThan(0);
        // Verify we have object chunks (from both Test Agent and structured-output processor agent)
        const hasObjectChunks = llmChunkSpans.some(s => s.name?.includes('object'));
        expect(hasObjectChunks).toBe(true);

        // Identify the Test Agent spans vs processor agent spans
        const testAgentSpan = agentRunSpans.find(span => span.name?.includes('test-agent'));
        const processorAgentSpan = agentRunSpans.find(span => span !== testAgentSpan);
        const processorRunSpan = processorRunSpans[0];

        // Identify LLM generation spans
        const testAgentLlmSpan = llmGenerationSpans.find(span => span.parentSpanId === testAgentSpan?.id);
        const processorAgentLlmSpan = llmGenerationSpans.find(span => span.parentSpanId === processorAgentSpan?.id);

        expect(testAgentSpan).toBeDefined();
        expect(processorAgentSpan).toBeDefined();
        expect(processorRunSpan).toBeDefined();
        expect(testAgentLlmSpan).toBeDefined();
        expect(processorAgentLlmSpan).toBeDefined();

        expect(testAgentSpan?.traceId).toBe(result.traceId);

        // Verify span nesting
        expect(testAgentLlmSpan!.parentSpanId).toEqual(testAgentSpan?.id);
        expect(processorRunSpan?.parentSpanId).toEqual(testAgentSpan?.id);
        expect(processorAgentSpan?.parentSpanId).toEqual(processorRunSpan?.id);
        expect(processorAgentLlmSpan?.parentSpanId).toEqual(processorAgentSpan?.id);

        // Verify LLM generation spans
        expect(testAgentLlmSpan!.name).toBe("llm: 'mock-model-id'");
        expect(testAgentLlmSpan!.input.messages).toHaveLength(2);
        expect(testAgentLlmSpan!.output.text).toBe('Mock V2 streaming response');

        expect(processorAgentLlmSpan?.name).toBe("llm: 'mock-model-id'");
        expect(processorAgentLlmSpan?.output.text).toBeDefined();

        // Verify Test Agent output
        expect(testAgentSpan?.output.text).toBe('Mock V2 streaming response');

        // Verify structured output
        expect(result.object).toBeDefined();
        expect(result.object).toHaveProperty('items');
        expect((result.object as any).items).toBe('test structured output');

        expect(testAgentLlmSpan!.attributes?.usage?.totalTokens).toBeGreaterThan(1);
        expect(processorAgentLlmSpan?.attributes?.usage?.totalTokens).toBeGreaterThan(1);

        expect(testAgentLlmSpan!.endTime).toBeDefined();
        expect(testAgentSpan?.endTime).toBeDefined();
        expect(testAgentLlmSpan!.endTime!.getTime()).toBeLessThanOrEqual(testAgentSpan!.endTime!.getTime());

        expect(processorAgentLlmSpan?.endTime).toBeDefined();
        expect(processorAgentSpan?.endTime).toBeDefined();
        expect(processorAgentLlmSpan?.endTime!.getTime()).toBeLessThanOrEqual(processorAgentSpan!.endTime!.getTime());

        testExporter.finalExpectations();
      });
    },
  );

  describe.each(agentMethods.filter(m => m.name === 'stream' || m.name === 'generate'))(
    'agent with input and output processors using $name',
    ({ method, model }) => {
      it('should trace all processor spans including internal agent spans', async () => {
        // Create a custom input processor that uses an agent internally
        class ValidatorProcessor implements Processor {
          readonly id = 'validator';
          readonly name = 'Validator';
          private agent: Agent;

          constructor(model: any) {
            this.agent = new Agent({
              id: 'validator-agent',
              name: 'validator-agent',
              instructions: 'You validate input messages',
              model,
            });
          }

          async processInput(args: {
            messages: MastraDBMessage[];
            abort: (reason?: string) => never;
            tracingContext?: TracingContext;
          }): Promise<MastraDBMessage[]> {
            // Call the internal agent to validate
            const lastMessage = args.messages[args.messages.length - 1];
            const text = lastMessage?.content?.content || '';

            await this.agent.generate(`Validate: ${text}`, {
              tracingContext: args.tracingContext,
            });

            // Return original messages
            return args.messages;
          }
        }

        // Create a custom output processor that uses an agent internally
        class SummarizerProcessor implements Processor {
          readonly id = 'summarizer';
          readonly name = 'Summarizer';
          private agent: Agent;

          constructor(model: any) {
            this.agent = new Agent({
              id: 'summarizer-agent',
              name: 'summarizer-agent',
              instructions: 'You summarize text concisely',
              model,
            });
          }

          async processOutputResult(args: {
            messages: MastraDBMessage[];
            abort: (reason?: string) => never;
            tracingContext?: TracingContext;
          }): Promise<MastraDBMessage[]> {
            // Call the internal agent to summarize
            const lastMessage = args.messages[args.messages.length - 1];
            const text = lastMessage?.content?.content || '';

            await this.agent.generate(`Summarize: ${text}`, {
              tracingContext: args.tracingContext,
            });

            // Return original messages
            return args.messages;
          }
        }

        const testAgent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model,
          inputProcessors: [new ValidatorProcessor(model)],
          outputProcessors: [new SummarizerProcessor(model)],
        });

        const mastra = new Mastra({
          ...getBaseMastraConfig(testExporter),
          agents: { testAgent },
        });

        const agent = mastra.getAgent('testAgent');
        const result = await method(
          agent,
          '  Hello! How are you?  ', // Extra whitespace to test input processor
        );

        // Verify the result has text (structured output may fail with mock model)
        expect(result.text).toBeDefined();

        // Get all spans
        const agentRunSpans = testExporter.getSpansByType(SpanType.AGENT_RUN);
        const llmGenerationSpans = testExporter.getSpansByType(SpanType.MODEL_GENERATION);
        const processorRunSpans = testExporter.getSpansByType(SpanType.PROCESSOR_RUN);

        // Expected span structure:
        // - Test Agent AGENT_RUN (root)
        //   - PROCESSOR_RUN (input processor: validator) - has internal agent
        //     - validator-agent AGENT_RUN
        //       - validator-agent MODEL_GENERATION
        //   - Test Agent MODEL_GENERATION (initial model call)
        //   - PROCESSOR_RUN (output processor: summarizer) - has internal agent
        //     - summarizer-agent AGENT_RUN
        //       - summarizer-agent MODEL_GENERATION

        expect(agentRunSpans.length).toBe(3); // Test Agent + validator agent + summarizer agent
        expect(llmGenerationSpans.length).toBe(3); // Test Agent LLM + validator LLM + summarizer LLM
        expect(processorRunSpans.length).toBe(2); // validator + summarizer

        // Find specific spans
        const testAgentSpan = agentRunSpans.find(s => s.name === "agent run: 'test-agent'");
        const inputProcessorSpan = processorRunSpans.find(s => s.name === 'input processor: validator');
        const summarizerProcessorSpan = processorRunSpans.find(s => s.name === 'output processor: summarizer');
        const validatorAgentSpan = agentRunSpans.find(s => s.name?.includes('validator-agent'));
        const summarizerAgentSpan = agentRunSpans.find(s => s.name?.includes('summarizer-agent'));

        // Verify all expected spans exist
        expect(testAgentSpan).toBeDefined();
        expect(inputProcessorSpan).toBeDefined();
        expect(summarizerProcessorSpan).toBeDefined();
        expect(validatorAgentSpan).toBeDefined();
        expect(summarizerAgentSpan).toBeDefined();

        // Verify span nesting - all processors should be children of Test Agent
        expect(inputProcessorSpan?.parentSpanId).toEqual(testAgentSpan?.id);
        expect(summarizerProcessorSpan?.parentSpanId).toEqual(testAgentSpan?.id);

        expect(validatorAgentSpan?.parentSpanId).toEqual(inputProcessorSpan?.id);
        expect(summarizerAgentSpan?.parentSpanId).toEqual(summarizerProcessorSpan?.id);

        testExporter.finalExpectations();
      });
    },
  );

  describe.each(agentMethods)('agent launched inside workflow step using $name', ({ method, model }) => {
    it(`should trace spans correctly`, async () => {
      const testAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model,
      });

      const agentExecutorStep = createStep({
        id: 'agent-executor',
        inputSchema: z.object({ prompt: z.string() }),
        outputSchema: z.object({ response: z.string() }),
        execute: async ({ inputData, mastra }) => {
          const agent = mastra?.getAgent('testAgent');
          expect(agent, 'Test agent should be available from Mastra instance').toBeTruthy();
          const result = await method(agent, inputData.prompt);
          return { response: result.text };
        },
      });

      const agentWorkflow = createWorkflow({
        id: 'agent-workflow',
        inputSchema: z.object({ prompt: z.string() }),
        outputSchema: z.object({ response: z.string() }),
        steps: [agentExecutorStep],
      })
        .then(agentExecutorStep)
        .commit();

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { testAgent },
        workflows: { agentWorkflow },
      });

      const workflow = mastra.getWorkflow('agentWorkflow');
      const run = await workflow.createRun();
      const result = await run.start({ inputData: { prompt: 'Hello from workflow' } });
      expect(result.status).toBe('success');
      expect(result.traceId).toBeDefined();

      const workflowRunSpans = testExporter.getSpansByType(SpanType.WORKFLOW_RUN);
      const workflowStepSpans = testExporter.getSpansByType(SpanType.WORKFLOW_STEP);
      const agentRunSpans = testExporter.getSpansByType(SpanType.AGENT_RUN);
      const llmGenerationSpans = testExporter.getSpansByType(SpanType.MODEL_GENERATION);

      expect(workflowRunSpans.length).toBe(1); // One workflow run
      expect(workflowRunSpans[0]?.traceId).toBe(result.traceId);
      expect(workflowStepSpans.length).toBe(1); // One step: agent-executor
      expect(agentRunSpans.length).toBe(1); // One agent run within the step
      expect(llmGenerationSpans.length).toBe(1); // 1 llm span inside agent

      testExporter.finalExpectations();
    });
  });

  describe.each(agentMethods)('workflow launched inside agent tool using $name', ({ method, model }) => {
    it(`should trace spans correctly`, async () => {
      const simpleWorkflow = createSimpleWorkflow();

      const workflowAgent = new Agent({
        id: 'workflow-agent',
        name: 'Workflow Agent',
        instructions: 'You can execute workflows using the workflow executor tool',
        model,
        tools: { workflowExecutor: workflowExecutorTool },
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        workflows: { simpleWorkflow },
        agents: { workflowAgent },
      });

      const customMetadata = {
        id1: 123,
        id2: 'tacos',
      };

      const agent = mastra.getAgent('workflowAgent');
      const result = await method(agent, 'Execute the simpleWorkflow with test input', {
        tracingOptions: { metadata: customMetadata },
      });
      expect(result.text).toBeDefined();
      expect(result.traceId).toBeDefined();

      const agentRunSpans = testExporter.getSpansByType(SpanType.AGENT_RUN);
      const llmGenerationSpans = testExporter.getSpansByType(SpanType.MODEL_GENERATION);
      const toolCallSpans = testExporter.getSpansByType(SpanType.TOOL_CALL);
      const workflowRunSpans = testExporter.getSpansByType(SpanType.WORKFLOW_RUN);
      const workflowStepSpans = testExporter.getSpansByType(SpanType.WORKFLOW_STEP);

      expect(agentRunSpans.length).toBe(1); // One agent run
      const agentRunSpan = agentRunSpans[0];

      expect(agentRunSpan?.traceId).toBe(result.traceId);
      expect(agentRunSpan?.isRootSpan).toBe(true);
      expect(agentRunSpan?.metadata?.id1).toBe(customMetadata.id1);
      expect(agentRunSpan?.metadata?.id2).toBe(customMetadata.id2);

      expect(llmGenerationSpans.length).toBe(1); // one llmGeneration per agent run
      expect(toolCallSpans.length).toBe(1); // tool call

      expect(workflowRunSpans.length).toBe(1); // One workflow run (simpleWorkflow)
      expect(workflowStepSpans.length).toBe(1); // One step (simple-step)

      testExporter.finalExpectations();
    });
  });

  //TODO figure out how to test this correctly
  describe.each(agentMethods)('workflow launched inside agent directly $name', ({ method, model }) => {
    it(`should trace spans correctly`, async () => {
      const simpleWorkflow = createSimpleWorkflow();

      const workflowAgent = new Agent({
        id: 'workflow-agent',
        name: 'Workflow Agent',
        instructions: 'You can execute workflows that exist in your config',
        model,
        workflows: {
          simpleWorkflow,
        },
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        workflows: { simpleWorkflow },
        agents: { workflowAgent },
      });

      const agent = mastra.getAgent('workflowAgent');
      const result = await method(agent, 'Execute the simpleWorkflow with test input');
      expect(result.text).toBeDefined();
      expect(result.traceId).toBeDefined();

      const agentRunSpans = testExporter.getSpansByType(SpanType.AGENT_RUN);
      const llmGenerationSpans = testExporter.getSpansByType(SpanType.MODEL_GENERATION);
      const toolCallSpans = testExporter.getSpansByType(SpanType.TOOL_CALL);
      const workflowRunSpans = testExporter.getSpansByType(SpanType.WORKFLOW_RUN);
      const workflowStepSpans = testExporter.getSpansByType(SpanType.WORKFLOW_STEP);

      expect(agentRunSpans.length).toBe(1); // One agent run
      expect(llmGenerationSpans.length).toBe(1); // one llm_generation span per agent run
      expect(agentRunSpans[0]?.traceId).toBe(result.traceId);
      expect(toolCallSpans.length).toBe(1); // tool call (workflow is converted into a tool dynamically)

      expect(workflowRunSpans.length).toBe(1); // One workflow run (simpleWorkflow)
      expect(workflowStepSpans.length).toBe(1); // One step (simple-step)

      testExporter.finalExpectations();
    });
  });

  describe.each(agentMethods)('metadata added in tool call using $name', ({ method, model }) => {
    it(`should add metadata correctly`, async () => {
      // Create a tool that adds custom metadata via tracingContext
      const inputSchema = z.object({ input: z.string() });

      const metadataTool = createTool({
        id: 'metadata-tool',
        description: 'A tool that adds custom metadata',
        inputSchema,
        outputSchema: z.object({ output: z.string() }),
        execute: async (inputData, context?: ToolExecutionContext<typeof inputSchema>) => {
          // Add custom metadata to the current span
          context?.tracingContext?.currentSpan?.update({
            metadata: {
              toolOperation: 'metadata-processing',
              inputValue: inputData.input,
              customFlag: true,
              timestamp: Date.now(),
            },
          });

          return { output: `Processed: ${inputData.input}` };
        },
      });

      const testAgent = new Agent({
        id: 'metadata-agent',
        name: 'Metadata Agent',
        instructions: 'You use tools and add metadata',
        model,
        tools: { metadataTool },
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { testAgent },
      });

      const agent = mastra.getAgent('testAgent');
      const result = await method(agent, 'Use metadata tool to process some data');
      expect(result.text).toBeDefined();
      expect(result.traceId).toBeDefined();

      const toolCallSpans = testExporter.getSpansByType(SpanType.TOOL_CALL);

      expect(toolCallSpans.length).toBeGreaterThanOrEqual(1);
      expect(toolCallSpans[0]?.traceId).toBe(result.traceId);

      // Find the metadata tool span and validate custom metadata
      const metadataToolSpan = toolCallSpans.find(span => span.name?.includes('metadataTool'));
      if (metadataToolSpan) {
        expect(metadataToolSpan.metadata?.toolOperation).toBe('metadata-processing');
        expect(metadataToolSpan.metadata?.customFlag).toBe(true);
        expect(metadataToolSpan.metadata?.timestamp).toBeTypeOf('number');
      }

      testExporter.finalExpectations();
    });
  });

  describe.each(agentMethods)('child spans added in tool call using $name', ({ method, model }) => {
    it(`should create child spans correctly`, async () => {
      // Create a tool that creates child spans via tracingContext
      const inputSchema = z.object({ input: z.string() });

      const childSpanTool = createTool({
        id: 'child-span-tool',
        description: 'A tool that creates child spans',
        inputSchema,
        outputSchema: z.object({ output: z.string() }),
        execute: async (inputData, context?: ToolExecutionContext<typeof inputSchema>) => {
          // Create a child span for sub-operation
          const childSpan = context?.tracingContext?.currentSpan?.createChildSpan({
            type: SpanType.GENERIC,
            name: 'tool-child-operation',
            input: inputData.input,
            metadata: {
              childOperation: 'data-processing',
              inputValue: inputData.input,
            },
          });

          // Simulate some processing
          await new Promise(resolve => setTimeout(resolve, 10));

          // Update and end child span
          childSpan?.update({
            metadata: {
              ...childSpan.metadata,
              processedValue: `processed-${inputData.input}`,
            },
          });

          childSpan?.end({ output: `child-result-${inputData.input}` });

          return { output: `Tool processed: ${inputData.input}` };
        },
      });

      const testAgent = new Agent({
        id: 'child-span-agent',
        name: 'Child Span Agent',
        instructions: 'You use tools that create child spans',
        model,
        tools: { childSpanTool },
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { testAgent },
      });

      const agent = mastra.getAgent('testAgent');
      const result = await method(agent, 'Use child span tool to process test-data');
      expect(result.text).toBeDefined();
      expect(result.traceId).toBeDefined();

      const toolCallSpans = testExporter.getSpansByType(SpanType.TOOL_CALL);
      const genericSpans = testExporter.getSpansByType(SpanType.GENERIC);

      expect(toolCallSpans.length).toBe(1);
      expect(genericSpans.length).toBe(1);
      expect(toolCallSpans[0]?.traceId).toBe(result.traceId);

      // Find the child span and validate metadata
      const childSpan = genericSpans.find(span => span.name === 'tool-child-operation');
      if (childSpan) {
        expect(childSpan.metadata?.childOperation).toBe('data-processing');
        expect(childSpan.metadata?.processedValue).toBe('processed-test-data');
      }

      testExporter.finalExpectations();
    });
  });

  it('should trace generate object (structured output)', async () => {
    // Create a mock for structured output
    const structuredMock = new MockLanguageModelV1({
      defaultObjectGenerationMode: 'json',
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: '{"name": "John", "age": 30}',
      }),
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-delta', textDelta: '{"name": "John", "age": 30}' },
            { type: 'finish', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 20 } },
          ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const structuredAgent = new Agent({
      id: 'structured-agent',
      name: 'Structured Agent',
      instructions: 'You generate structured data',
      model: structuredMock,
    });

    const mastra = new Mastra({
      ...getBaseMastraConfig(testExporter),
      agents: { structuredAgent },
    });

    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const agent = mastra.getAgent('structuredAgent');
    const result = await agent.generateLegacy('Generate a person object', {
      output: schema,
    });

    // For structured output, result has object property instead of text
    expect(result.object || result).toBeTruthy();
    expect(result.traceId).toBeDefined();

    const agentRunSpans = testExporter.getSpansByType(SpanType.AGENT_RUN);
    const llmGenerationSpans = testExporter.getSpansByType(SpanType.MODEL_GENERATION);

    expect(agentRunSpans.length).toBe(1); // One agent run
    expect(llmGenerationSpans.length).toBe(1); // One LLM generation
    expect(agentRunSpans[0]?.traceId).toBe(result.traceId);

    testExporter.finalExpectations();
  });

  it('should propagate tracingContext to agent steps in workflows', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'response-metadata', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Test response from agent' },
          {
            type: 'finish',
            id: '1',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const testAgent = new Agent({
      id: 'workflow-agent',
      name: 'Workflow Agent',
      instructions: 'You are an agent in a workflow',
      model: mockModel,
    });

    const testWorkflow = createWorkflow({
      id: 'testWorkflow',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    });

    const agentStep = createStep(testAgent);

    testWorkflow
      .map(async ({ inputData }) => ({ prompt: inputData.query }))
      .then(agentStep)
      .map(async ({ inputData }) => ({ text: inputData.text }))
      .commit();

    const mastra = new Mastra({
      ...getBaseMastraConfig(testExporter),
      agents: { testAgent },
      workflows: { testWorkflow },
    });

    const workflow = mastra.getWorkflow('testWorkflow');
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { query: 'test query' } });

    expect(result.status).toBe('success');

    // Verify spans were created
    const workflowRunSpans = testExporter.getSpansByType(SpanType.WORKFLOW_RUN);
    const workflowStepSpans = testExporter.getSpansByType(SpanType.WORKFLOW_STEP);
    const agentRunSpans = testExporter.getSpansByType(SpanType.AGENT_RUN);
    const llmGenerationSpans = testExporter.getSpansByType(SpanType.MODEL_GENERATION);

    // Should have one workflow run
    expect(workflowRunSpans.length).toBe(1);

    // Should have workflow steps (including the agent step)
    expect(workflowStepSpans.length).toBeGreaterThan(0);

    // Should have one agent run
    expect(agentRunSpans.length).toBe(1);

    // Should have one LLM generation
    expect(llmGenerationSpans.length).toBe(1);

    // Verify proper nesting: agent run should be child of workflow
    const workflowRunSpan = workflowRunSpans[0];
    const agentRunSpan = agentRunSpans[0];
    const llmGenSpan = llmGenerationSpans[0];

    expect(workflowRunSpan?.traceId).toBeDefined();
    expect(agentRunSpan?.traceId).toBe(workflowRunSpan?.traceId);
    expect(llmGenSpan?.traceId).toBe(workflowRunSpan?.traceId);

    // Verify parent-child relationship
    expect(agentRunSpan?.parentSpanId).toBeDefined();
    expect(llmGenSpan?.parentSpanId).toBe(agentRunSpan?.id);

    testExporter.finalExpectations();
  });
});
