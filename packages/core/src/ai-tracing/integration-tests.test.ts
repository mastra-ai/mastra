import { MockLanguageModelV1, simulateReadableStream } from 'ai/test';
import { MockLanguageModelV2, convertArrayToReadableStream } from 'ai-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

// Core Mastra imports
import { Agent } from '../agent';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import type { ToolExecutionContext } from '../tools';
import { createTool } from '../tools';
import { createWorkflow, createStep } from '../workflows';

// AI Tracing imports
import { clearAITracingRegistry, shutdownAITracingRegistry } from './registry';
import { AISpanType, AITracingEventType } from './types';
import type { AITracingExporter, AITracingEvent, AnyAISpan } from './types';

/**
 * Test exporter for AI tracing events with real-time span lifecycle validation.
 *
 * Features:
 * - Captures all AI tracing events (SPAN_STARTED, SPAN_UPDATED, SPAN_ENDED)
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
class TestExporter implements AITracingExporter {
  name = 'test-exporter';
  private events: AITracingEvent[] = [];
  private spanStates = new Map<
    string,
    {
      hasStart: boolean;
      hasEnd: boolean;
      hasUpdate: boolean;
      events: AITracingEvent[];
      isEventSpan?: boolean;
    }
  >();

  private logs: string[] = [];

  async exportEvent(event: AITracingEvent) {
    const logMessage = `[TestExporter] ${event.type}: ${event.span.type} "${event.span.name}" (trace: ${event.span.traceId.slice(-8)}, span: ${event.span.id.slice(-8)})`;

    // Store log for potential test failure reporting
    this.logs.push(logMessage);

    // Only log to console in verbose mode or if AI_TRACING_VERBOSE is set
    if (process.env.AI_TRACING_VERBOSE === 'true') {
      console.log(logMessage);
    }
    // Otherwise, logs will only appear on test failures

    const spanId = event.span.id;
    const state = this.spanStates.get(spanId) || {
      hasStart: false,
      hasEnd: false,
      hasUpdate: false,
      events: [],
    };

    // Real-time validation as events arrive using Vitest expect
    if (event.type === AITracingEventType.SPAN_STARTED) {
      expect(state.hasStart, `Span ${spanId} (${event.span.type} "${event.span.name}") started twice`).toBe(false);
      state.hasStart = true;
    } else if (event.type === AITracingEventType.SPAN_ENDED) {
      // Detect event spans (zero duration) - only check this in SPAN_ENDED where we have final timestamps
      const isEventSpan = event.span.startTime === event.span.endTime;
      if (isEventSpan) {
        // Event spans should only emit SPAN_ENDED, no SPAN_STARTED or SPAN_UPDATED
        expect(
          state.hasStart,
          `Event span ${spanId} (${event.span.type} "${event.span.name}") incorrectly received SPAN_STARTED. Event spans should only emit SPAN_ENDED.`,
        ).toBe(false);
        expect(
          state.hasUpdate,
          `Event span ${spanId} (${event.span.type} "${event.span.name}") incorrectly received SPAN_UPDATED. Event spans should only emit SPAN_ENDED.`,
        ).toBe(false);
        state.isEventSpan = true;
      } else {
        // Normal span should have started
        expect(
          state.hasStart,
          `Normal span ${spanId} (${event.span.type} "${event.span.name}") ended without starting`,
        ).toBe(true);
      }
      state.hasEnd = true;
    } else if (event.type === AITracingEventType.SPAN_UPDATED) {
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
  getSpansByType(type: AISpanType): AnyAISpan[] {
    return Array.from(this.spanStates.values())
      .filter(state => {
        // Only return completed spans of the requested type
        // Check the final span's type, not the first event
        const finalEvent =
          state.events.find(e => e.type === AITracingEventType.SPAN_ENDED) || state.events[state.events.length - 1];
        return state.hasEnd && finalEvent.span.type === type;
      })
      .map(state => {
        // Return the final span from SPAN_ENDED event
        const endEvent = state.events.find(e => e.type === AITracingEventType.SPAN_ENDED);
        return endEvent!.span;
      });
  }

  // Helper to get all incomplete spans (spans that started but never ended)
  getIncompleteSpans(): Array<{ spanId: string; span: AnyAISpan; state: any }> {
    return Array.from(this.spanStates.entries())
      .filter(([_, state]) => !state.hasEnd)
      .map(([spanId, state]) => ({
        spanId,
        span: state.events[0].span,
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
  getAllSpans(): AnyAISpan[] {
    return Array.from(this.spanStates.values()).map(state => {
      // Return the final span from SPAN_ENDED event, or latest event if not ended
      const endEvent = state.events.find(e => e.type === AITracingEventType.SPAN_ENDED);
      return endEvent ? endEvent.span : state.events[state.events.length - 1].span;
    });
  }

  /**
   * Performs final test expectations that are common to all AI tracing tests.
   *
   * Validates:
   * - All spans share the same trace ID (context propagation)
   * - No incomplete spans remain (all spans completed properly)
   */
  finalExpectations() {
    try {
      // All spans should share the same trace ID (context propagation)
      const allSpans = this.getAllSpans();
      const traceIds = [...new Set(allSpans.map(span => span.traceId))];
      expect(traceIds).toHaveLength(1);

      // Ensure all spans completed properly
      const incompleteSpans = this.getIncompleteSpans();
      expect(
        incompleteSpans,
        `Found incomplete spans: ${JSON.stringify(incompleteSpans.map(s => ({ type: s.span.type, name: s.span.name, state: s.state })))}`,
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
  getLogs(): string[] {
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
  execute: async ({ context }) => {
    const { operation, a, b } = context;
    const operations = {
      add: a + b,
      multiply: a * b,
      subtract: a - b,
      divide: a / b,
    };
    return { result: operations[operation as keyof typeof operations] || 0 };
  },
});

/**
 * API tool for testing HTTP-like operations.
 * Simulates making API calls with endpoint and method parameters.
 * Used to test tool execution with custom metadata and tracing context.
 */
const apiTool = createTool({
  id: 'api-call',
  description: 'Makes API calls',
  inputSchema: z.object({
    endpoint: z.string(),
    method: z.string().default('GET'),
  }),
  outputSchema: z.object({
    status: z.number(),
    data: z.any(),
  }),
  execute: async ({ context, tracingContext }) => {
    const { endpoint, method } = context;
    // Example of adding custom metadata
    tracingContext?.currentSpan?.update({
      metadata: {
        apiEndpoint: endpoint,
        httpMethod: method,
        timestamp: Date.now(),
      },
    });

    return { status: 200, data: { message: 'Mock API response' } };
  },
});

/**
 * Workflow execution tool for testing workflow-in-workflow scenarios.
 * Executes a workflow by ID with given input data.
 * Used to test agent tools that launch workflows and context propagation.
 */
const workflowToolInputSchema = z.object({
  workflowId: z.string(),
  input: z.any(),
});

const workflowExecutorTool = createTool({
  id: 'workflow-executor',
  description: 'Executes a workflow',
  inputSchema: workflowToolInputSchema,
  outputSchema: z.object({
    result: z.any(),
  }),
  execute: async ({ context, mastra }: ToolExecutionContext<typeof workflowToolInputSchema>) => {
    const { workflowId, input } = context;
    expect(mastra, 'Mastra instance should be available in tool execution context').toBeTruthy();

    const workflow = mastra?.getWorkflow(workflowId);
    const run = await workflow?.createRunAsync();
    const result = await run?.start({ inputData: input });

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

// Track tool calls per test to limit to one call per test
let testToolCallCounts = new Map<string, number>();

// Reset tool call tracking before each test
function resetToolCallTracking() {
  testToolCallCounts.clear();
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

  // Metadata tool detection - FIRST PRIORITY - allow multiple calls for parameterized tests
  if (lowerPrompt.includes('metadata tool') || lowerPrompt.includes('process some data')) {
    const currentCount = testToolCallCounts.get('metadataTool') || 0;
    if (currentCount < 10) {
      testToolCallCounts.set('metadataTool', currentCount + 1);
      return {
        toolName: 'metadataTool',
        toolCallId: `call-metadata-${currentCount + 1}`,
        args: { input: 'some data' },
      };
    }
  }

  // Child span tool detection - SECOND PRIORITY - allow multiple calls for parameterized tests
  if (lowerPrompt.includes('child span tool') || lowerPrompt.includes('process test-data')) {
    const currentCount = testToolCallCounts.get('childSpanTool') || 0;
    if (currentCount < 10) {
      testToolCallCounts.set('childSpanTool', currentCount + 1);
      return {
        toolName: 'childSpanTool',
        toolCallId: `call-child-span-${currentCount + 1}`,
        args: { input: 'test-data' },
      };
    }
  }

  // Calculator tool detection - allow multiple calls for parameterized tests
  if (lowerPrompt.includes('calculate') || lowerPrompt.includes('add') || lowerPrompt.includes('multiply')) {
    const currentCount = testToolCallCounts.get('calculator') || 0;
    if (currentCount < 10) {
      // Allow up to 10 calls for parameterized tests
      testToolCallCounts.set('calculator', currentCount + 1);
      return {
        toolName: 'calculator',
        toolCallId: `call-calc-${currentCount + 1}`,
        args: { operation: 'add', a: 5, b: 3 },
      };
    }
  }

  // API tool detection - allow multiple calls for parameterized tests
  if (lowerPrompt.includes('api') || lowerPrompt.includes('endpoint')) {
    const currentCount = testToolCallCounts.get('apiCall') || 0;
    if (currentCount < 10) {
      testToolCallCounts.set('apiCall', currentCount + 1);
      return {
        toolName: 'apiCall',
        toolCallId: `call-api-${currentCount + 1}`,
        args: { endpoint: '/test', method: 'GET' },
      };
    }
  }

  // Workflow executor tool detection - allow multiple calls for parameterized tests
  if (
    lowerPrompt.includes('execute the simpleworkflow') ||
    lowerPrompt.includes('execute workflow') ||
    lowerPrompt.includes('simpleworkflow with')
  ) {
    const currentCount = testToolCallCounts.get('workflowExecutor') || 0;
    if (currentCount < 10) {
      testToolCallCounts.set('workflowExecutor', currentCount + 1);
      return {
        toolName: 'workflowExecutor',
        toolCallId: `call-workflow-${currentCount + 1}`,
        args: { workflowId: 'simpleWorkflow', input: { input: 'test input' } },
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
 * Supports both generateVNext() and streamVNext() operations.
 * Intelligently calls tools based on prompt content or returns structured text responses.
 * Limits tool calls to one per test to avoid infinite loops.
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
      return {
        stream: convertArrayToReadableStream([
          {
            type: 'tool-call',
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args: toolCall.args,
            input: JSON.stringify(toolCall.args),
          },
          { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 } },
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
 * Creates base Mastra configuration for tests with AI tracing enabled.
 *
 * @param testExporter - The TestExporter instance to capture tracing events
 * @returns Base configuration object with telemetry disabled and AI tracing configured
 *
 * Features:
 * - Telemetry disabled for faster test execution
 * - Mock storage for isolation
 * - AI tracing with TestExporter for span validation
 * - Integration tests configuration
 */
function getBaseMastraConfig(testExporter: TestExporter) {
  return {
    telemetry: { enabled: false },
    storage: new MockStore(),
    observability: {
      instances: {
        test: {
          serviceName: 'integration-tests',
          exporters: [testExporter],
        },
      },
    },
  };
}

// Parameterized test data for different agent generation methods
const agentMethods = [
  {
    name: 'generate',
    method: async (agent: Agent, prompt: string, options?: any) => {
      const result = await agent.generateLegacy(prompt, options);
      return { text: result.text, object: result.object };
    },
    model: mockModelV1,
    expectedText: 'Mock response',
  },
  {
    name: 'generateVNext',
    method: async (agent: Agent, prompt: string, options?: any) => {
      const result = await agent.generateVNext(prompt, options);
      return { text: result.text, object: result.object };
    },
    model: mockModelV2,
    expectedText: 'Mock V2 streaming response',
  },
  {
    name: 'stream',
    method: async (agent: Agent, prompt: string, options?: any) => {
      const result = await agent.streamLegacy(prompt, options);
      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }
      return { text: fullText, object: result.object };
    },
    model: mockModelV1,
    expectedText: 'Mock streaming response',
  },
  {
    name: 'streamVNext',
    method: async (agent: Agent, prompt: string, options?: any) => {
      const result = await agent.streamVNext(prompt, options);
      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }
      return { text: fullText, object: result.object };
    },
    model: mockModelV2,
    expectedText: 'Mock V2 streaming response',
  },
];

describe('AI Tracing Integration Tests', () => {
  beforeEach(() => {
    // Clear any existing AI tracing instances to avoid conflicts
    clearAITracingRegistry();
    // Reset tool call tracking for each test
    resetToolCallTracking();
  });

  afterEach(async () => {
    // Clean up AI tracing registry after each test
    await shutdownAITracingRegistry();
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

    const testExporter = new TestExporter();
    const mastra = new Mastra({
      ...getBaseMastraConfig(testExporter),
      workflows: { branchingWorkflow },
    });

    const workflow = mastra.getWorkflow('branchingWorkflow');
    const run = await workflow.createRunAsync();
    const result = await run.start({ inputData: { value: 15 } });
    expect(result.status).toBe('success');

    const workflowRunSpans = testExporter.getSpansByType(AISpanType.WORKFLOW_RUN);
    const workflowStepSpans = testExporter.getSpansByType(AISpanType.WORKFLOW_STEP);
    const conditionalSpans = testExporter.getSpansByType(AISpanType.WORKFLOW_CONDITIONAL);

    expect(workflowRunSpans.length).toBe(1); // One workflow run
    expect(workflowStepSpans.length).toBe(2); // checkCondition + processHigh (value=15 > 10)
    expect(conditionalSpans.length).toBe(1); // One branch evaluation

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

    const testExporter = new TestExporter();
    const mastra = new Mastra({
      ...getBaseMastraConfig(testExporter),
      workflows: { mainWorkflow }, // Only register mainWorkflow, not the inner one
    });

    const workflow = mastra.getWorkflow('mainWorkflow');
    const run = await workflow.createRunAsync();
    const result = await run.start({
      inputData: { input: 'test unregistered workflow as step' },
    });
    expect(result.status).toBe('success');

    const workflowRunSpans = testExporter.getSpansByType(AISpanType.WORKFLOW_RUN);
    const workflowStepSpans = testExporter.getSpansByType(AISpanType.WORKFLOW_STEP);

    expect(workflowRunSpans.length).toBe(2); // Main + unregistered workflow
    expect(workflowStepSpans.length).toBe(3); // doWhile step + unregistered step + map step

    testExporter.finalExpectations();
  });

  it.skip('should trace registered workflow nested in step in workflow', async () => {
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
        const run = await childWorkflow.createRunAsync();
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

    const testExporter = new TestExporter();
    const mastra = new Mastra({
      ...getBaseMastraConfig(testExporter),
      workflows: { simpleWorkflow, parentWorkflow },
    });

    const workflow = mastra.getWorkflow('parentWorkflow');
    const run = await workflow.createRunAsync();
    const result = await run.start({ inputData: { input: 'nested test' } });
    expect(result.status).toBe('success');

    const workflowRunSpans = testExporter.getSpansByType(AISpanType.WORKFLOW_RUN);
    const workflowStepSpans = testExporter.getSpansByType(AISpanType.WORKFLOW_STEP);

    expect(workflowRunSpans.length).toBe(2); // Parent workflow + child workflow
    expect(workflowStepSpans.length).toBe(2); // nested-workflow-step + simple-step

    testExporter.finalExpectations();
  });

  it('should trace tool used directly as workflow step', async () => {
    // Create a workflow step that executes a tool directly
    const toolExecutorStep = createStep(calculatorTool);

    const toolWorkflow = createWorkflow({
      id: 'tool-workflow',
      inputSchema: z.object({ a: z.number(), b: z.number(), operation: z.string() }),
      outputSchema: z.object({ result: z.number() }),
      steps: [toolExecutorStep],
    })
      .then(toolExecutorStep)
      .commit();

    const testExporter = new TestExporter();
    const mastra = new Mastra({
      ...getBaseMastraConfig(testExporter),
      workflows: { toolWorkflow },
    });

    const workflow = mastra.getWorkflow('toolWorkflow');
    const run = await workflow.createRunAsync();
    const result = await run.start({
      inputData: { a: 5, b: 3, operation: 'add' },
    });
    expect(result.status).toBe('success');

    // Validate span types
    const workflowRunSpans = testExporter.getSpansByType(AISpanType.WORKFLOW_RUN);
    const workflowStepSpans = testExporter.getSpansByType(AISpanType.WORKFLOW_STEP);
    // const toolCallSpans = testExporter.getSpansByType(AISpanType.TOOL_CALL);

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

    const testExporter = new TestExporter();
    const mastra = new Mastra({
      ...getBaseMastraConfig(testExporter),
      workflows: { metadataWorkflow },
    });

    const workflow = mastra.getWorkflow('metadataWorkflow');
    const run = await workflow.createRunAsync();
    const result = await run.start({ inputData: { value: 'tacos' } });
    expect(result.status).toBe('success');

    const workflowStepSpans = testExporter.getSpansByType(AISpanType.WORKFLOW_STEP);
    expect(workflowStepSpans.length).toBe(1);

    const stepSpan = workflowStepSpans[0];
    expect(stepSpan.metadata?.customValue).toBe('tacos');
    expect(stepSpan.metadata?.stepType).toBe('metadata-test');
    expect(stepSpan.metadata?.executionTime).toBeDefined();

    testExporter.finalExpectations();
  });

  it('should add child spans in workflow step', async () => {
    const childSpanStep = createStep({
      id: 'child-span',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ output: z.string() }),
      execute: async ({ inputData, tracingContext }) => {
        const childSpan = tracingContext.currentSpan?.createChildSpan({
          type: AISpanType.GENERIC,
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

    const testExporter = new TestExporter();
    const mastra = new Mastra({
      ...getBaseMastraConfig(testExporter),
      workflows: { childSpanWorkflow },
    });

    const workflow = mastra.getWorkflow('childSpanWorkflow');
    const run = await workflow.createRunAsync();
    const result = await run.start({
      inputData: { value: 'child-span-test' },
    });

    expect(result.status).toBe('success');

    // Look for the parent step span and child span
    const allSpans = testExporter.getAllSpans();
    const childSpans = allSpans.filter(span => span.name === 'custom-child-operation');
    const stepSpans = allSpans.filter(
      span => span.type === AISpanType.WORKFLOW_STEP && span.name?.includes('child-span'),
    );

    expect(childSpans.length).toBe(1);
    expect(stepSpans.length).toBe(1);

    // Validate parent-child relationship
    if (childSpans.length > 0 && stepSpans.length > 0) {
      const childSpan = childSpans[0];
      const stepSpan = stepSpans[0];

      expect(childSpan.traceId).toBe(stepSpan.traceId);
      expect(childSpan.metadata?.childOperation).toBe('processing');
      expect(childSpan.metadata?.inputValue).toBe('child-span-test');
      expect(childSpan.metadata?.endValue).toBe('pizza');
    }

    testExporter.finalExpectations();
  });

  describe.each(agentMethods)('should trace agent with multiple tools using $name', ({ name, method, model }) => {
    it(`should trace spans correctly`, async () => {
      const testAgent = new Agent({
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model,
        tools: {
          calculator: calculatorTool,
          apiCall: apiTool,
          workflowExecutor: workflowExecutorTool,
        },
      });

      const testExporter = new TestExporter();
      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { testAgent },
      });

      const agent = mastra.getAgent('testAgent');
      const result = await method(agent, 'Calculate 5 + 3');
      expect(result.text).toBeDefined();

      // Validate span types
      const agentRunSpans = testExporter.getSpansByType(AISpanType.AGENT_RUN);
      const llmGenerationSpans = testExporter.getSpansByType(AISpanType.LLM_GENERATION);
      const toolCallSpans = testExporter.getSpansByType(AISpanType.TOOL_CALL);

      expect(agentRunSpans.length).toBe(1); // One agent run

      // Different methods have different LLM generation patterns
      if (name === 'generate' || name === 'generateVNext') {
        expect(llmGenerationSpans.length).toBeGreaterThanOrEqual(1);
      } else {
        // Streaming methods
        expect(llmGenerationSpans.length).toBeGreaterThanOrEqual(1);
      }

      expect(toolCallSpans.length).toBeGreaterThanOrEqual(1); // At least one tool call (calculator)

      testExporter.finalExpectations();
    });
  });

  describe.skip.each(agentMethods)('agent launched inside workflow step using $name', ({ method, model }) => {
    it(`should trace spans correctly`, async () => {
      const testAgent = new Agent({
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

      const testExporter = new TestExporter();
      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { testAgent },
        workflows: { agentWorkflow },
      });

      const workflow = mastra.getWorkflow('agentWorkflow');
      const run = await workflow.createRunAsync();
      const result = await run.start({ inputData: { prompt: 'Hello from workflow' } });
      expect(result.status).toBe('success');

      const workflowRunSpans = testExporter.getSpansByType(AISpanType.WORKFLOW_RUN);
      const workflowStepSpans = testExporter.getSpansByType(AISpanType.WORKFLOW_STEP);
      const agentRunSpans = testExporter.getSpansByType(AISpanType.AGENT_RUN);
      const llmGenerationSpans = testExporter.getSpansByType(AISpanType.LLM_GENERATION);

      expect(workflowRunSpans.length).toBe(1); // One workflow run
      expect(workflowStepSpans.length).toBe(1); // One step: agent-executor
      expect(agentRunSpans.length).toBe(1); // One agent run within the step
      expect(llmGenerationSpans.length).toBeGreaterThanOrEqual(1); // At least one LLM generation within the agent

      testExporter.finalExpectations();
    });
  });

  describe.skip.each(agentMethods)('workflow launched inside agent tool using $name', ({ method, model }) => {
    it(`should trace spans correctly`, async () => {
      const simpleWorkflow = createSimpleWorkflow();

      const workflowAgent = new Agent({
        name: 'Workflow Agent',
        instructions: 'You can execute workflows using the workflow executor tool',
        model,
        tools: { workflowExecutor: workflowExecutorTool },
      });

      const testExporter = new TestExporter();
      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        workflows: { simpleWorkflow },
        agents: { workflowAgent },
      });

      const agent = mastra.getAgent('workflowAgent');
      const result = await method(agent, 'Execute the simpleWorkflow with test input');
      expect(result.text).toBeDefined();

      // Validate spans were created for agent, tool call, and workflow execution
      const agentRunSpans = testExporter.getSpansByType(AISpanType.AGENT_RUN);
      const llmGenerationSpans = testExporter.getSpansByType(AISpanType.LLM_GENERATION);
      const toolCallSpans = testExporter.getSpansByType(AISpanType.TOOL_CALL);
      const workflowRunSpans = testExporter.getSpansByType(AISpanType.WORKFLOW_RUN);
      const workflowStepSpans = testExporter.getSpansByType(AISpanType.WORKFLOW_STEP);

      expect(agentRunSpans.length).toBe(1); // One agent run
      expect(llmGenerationSpans.length).toBeGreaterThanOrEqual(1); // At least one LLM generation
      expect(toolCallSpans.length).toBeGreaterThanOrEqual(1); // At least one tool call (workflowExecutor)
      expect(workflowRunSpans.length).toBe(1); // One workflow run (simpleWorkflow)
      expect(workflowStepSpans.length).toBe(1); // One step (simple-step)

      testExporter.finalExpectations();
    });
  });

  describe.each(agentMethods)('metadata added in tool call using $name', ({ method, model }) => {
    it(`should add metadata correctly`, async () => {
      // Create a tool that adds custom metadata via tracingContext
      const metadataTool = createTool({
        id: 'metadata-tool',
        description: 'A tool that adds custom metadata',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context, tracingContext }) => {
          // Add custom metadata to the current span
          tracingContext?.currentSpan?.update({
            metadata: {
              toolOperation: 'metadata-processing',
              inputValue: context.input,
              customFlag: true,
              timestamp: Date.now(),
            },
          });

          return { output: `Processed: ${context.input}` };
        },
      });

      const testAgent = new Agent({
        name: 'Metadata Agent',
        instructions: 'You use tools and add metadata',
        model,
        tools: { metadataTool },
      });

      const testExporter = new TestExporter();
      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { testAgent },
      });

      const agent = mastra.getAgent('testAgent');
      const result = await method(agent, 'Use metadata tool to process some data');
      expect(result.text).toBeDefined();

      // Validate spans were created
      const toolCallSpans = testExporter.getSpansByType(AISpanType.TOOL_CALL);
      expect(toolCallSpans.length).toBeGreaterThanOrEqual(1);

      // Find the metadata tool span and validate custom metadata
      const metadataToolSpan = toolCallSpans.find(span => span.name?.includes('metadata-tool'));
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
      const childSpanTool = createTool({
        id: 'child-span-tool',
        description: 'A tool that creates child spans',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context, tracingContext }) => {
          // Create a child span for sub-operation
          const childSpan = tracingContext?.currentSpan?.createChildSpan({
            type: AISpanType.GENERIC,
            name: 'tool-child-operation',
            input: context.input,
            metadata: {
              childOperation: 'data-processing',
              inputValue: context.input,
            },
          });

          // Simulate some processing
          await new Promise(resolve => setTimeout(resolve, 10));

          // Update and end child span
          childSpan?.update({
            metadata: {
              ...childSpan.metadata,
              processedValue: `processed-${context.input}`,
            },
          });

          childSpan?.end({ output: `child-result-${context.input}` });

          return { output: `Tool processed: ${context.input}` };
        },
      });

      const testAgent = new Agent({
        name: 'Child Span Agent',
        instructions: 'You use tools that create child spans',
        model,
        tools: { childSpanTool },
      });

      const testExporter = new TestExporter();
      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { testAgent },
      });

      const agent = mastra.getAgent('testAgent');
      const result = await method(agent, 'Use child span tool to process test-data');
      expect(result.text).toBeDefined();

      // Validate spans were created
      const toolCallSpans = testExporter.getSpansByType(AISpanType.TOOL_CALL);
      const genericSpans = testExporter.getSpansByType(AISpanType.GENERIC);

      expect(toolCallSpans.length).toBeGreaterThanOrEqual(1);
      expect(genericSpans.length).toBeGreaterThanOrEqual(1);

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
    const testExporter = new TestExporter();

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
    const result = await agent.generate('Generate a person object', {
      output: schema,
    });

    // For structured output, result has object property instead of text
    expect(result.object || result).toBeTruthy();

    // Validate span types
    const agentRunSpans = testExporter.getSpansByType(AISpanType.AGENT_RUN);
    const llmGenerationSpans = testExporter.getSpansByType(AISpanType.LLM_GENERATION);

    expect(agentRunSpans.length).toBe(1); // One agent run
    expect(llmGenerationSpans.length).toBe(1); // One LLM generation

    testExporter.finalExpectations();
  });
});
