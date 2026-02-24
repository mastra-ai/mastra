import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { StructuredOutputOptions } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import type { TracingContext } from '@mastra/core/observability';

// Core Mastra imports
import type { Processor } from '@mastra/core/processors';
import { MockStore } from '@mastra/core/storage';
import type { InferSchemaOutput } from '@mastra/core/stream';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

// Tracing imports
import { Observability } from './default';
import { JsonExporter } from './exporters';

/**
 * Performs final test expectations that are common to all tracing tests.
 *
 * Validates:
 * - All spans share the same trace ID (context propagation)
 * - No incomplete spans remain (all spans completed properly)
 *
 * @param exporter - The JsonExporter instance to validate
 */
function finalExpectations(exporter: JsonExporter): void {
  try {
    // All spans should share the same trace ID (context propagation)
    const allSpans = exporter.getAllSpans();
    const traceIds = [...new Set(allSpans.map(span => span?.traceId))];
    expect(traceIds).toHaveLength(1);

    // Ensure all spans completed properly
    const incompleteSpans = exporter.getIncompleteSpans();
    expect(
      incompleteSpans,
      `Found incomplete spans: ${JSON.stringify(incompleteSpans.map(s => ({ type: s.span?.type, name: s.span?.name, state: s.state })))}`,
    ).toHaveLength(0);
  } catch (error) {
    // On failure, dump all logs to help with debugging
    exporter.dumpLogs();
    // Re-throw the original error
    throw error;
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
        args: { inputData: { input: 'test input' } },
      };
    }
  }

  return null;
}

/**
 * Mock V2 language model for testing new generation methods.
 * Supports both generate() and stream() operations.
 * Intelligently calls tools based on prompt content or returns structured text responses.
 * Limits tool calls to one per test to avoid infinite loops.
 * Supports structured output mode.
 */
// Use a closure to track call count for unique response IDs
const createMockModelV2 = () => {
  let callCount = 0;
  const getResponseId = () => {
    callCount++;
    return `00000000-0000-0000-0000-${String(callCount).padStart(12, '0')}`;
  };

  return new MockLanguageModelV2({
    doGenerate: async options => {
      const responseId = getResponseId();
      const prompt = extractPromptText(options.prompt);
      const toolCall = getToolCallFromPrompt(prompt);

      if (toolCall) {
        // Put tool calls in the content array, not in a separate toolCalls array
        // The AISDKV5LanguageModel wrapper will convert these to stream events
        return {
          content: [
            {
              type: 'tool-call',
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              args: toolCall.args,
              input: JSON.stringify(toolCall.args),
            },
          ],
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
          warnings: [],
          response: { id: responseId, modelId: 'mock-model-id' },
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
          finishReason: 'stop' as const,
          usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
          warnings: [],
          response: { id: responseId, modelId: 'mock-model-id' },
        };
      }

      // Default text response
      return {
        content: [{ type: 'text', text: 'Mock V2 generate response' }],
        finishReason: 'stop' as const,
        usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
        warnings: [],
        response: { id: responseId, modelId: 'mock-model-id' },
      };
    },
    doStream: async options => {
      const responseId = getResponseId();
      const prompt = extractPromptText(options.prompt);
      const toolCall = getToolCallFromPrompt(prompt);

      if (toolCall) {
        const argsJson = JSON.stringify(toolCall.args);
        return {
          stream: convertArrayToReadableStream([
            { type: 'response-metadata', id: responseId, modelId: 'mock-model-id' },
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
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
            },
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
            { type: 'response-metadata', id: responseId, modelId: 'mock-model-id' },
            { type: 'text-delta', id: responseId, delta: structuredOutput },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 } },
          ]),
        };
      }

      // Default streaming text response - emit single text-delta with full text
      // This matches the chunk structure of generate (single text chunk)
      return {
        stream: convertArrayToReadableStream([
          { type: 'response-metadata', id: responseId, modelId: 'mock-model-id' },
          { type: 'text-delta', id: responseId, delta: 'Mock V2 stream response' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 } },
        ]),
      };
    },
  });
};

const mockModelV2 = createMockModelV2();

/**
 * Creates base Mastra configuration for tests with tracing enabled.
 *
 * @param testExporter - The JsonExporter instance to capture tracing events
 * @returns Base configuration object with tracing configured
 *
 * Features:
 * - Mock storage for isolation
 * - tracing with JsonExporter for span validation
 * - Integration tests configuration
 */
function getBaseMastraConfig(testExporter: JsonExporter, options = {}) {
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
    name: 'generate',
    method: async (agent: Agent, prompt: string, options?: any) => {
      const result = await agent.generate(prompt, options);
      return { text: result.text, object: result.object, traceId: result.traceId };
    },
    model: mockModelV2,
    expectedText: 'Mock V2 streaming response',
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
  let testExporter: JsonExporter;

  beforeEach(() => {
    // Reset tool call tracking for each test
    resetToolCallTracking();
    // Create fresh test exporter for each test
    testExporter = new JsonExporter();
  });

  afterEach(async context => {
    // If test failed, dump logs for debugging
    if (context?.task?.result?.state === 'fail') {
      testExporter.dumpLogs();
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

    // Validate workflow execution succeeded
    expect(result.status).toBe('success');
    expect(result.traceId).toBeDefined();

    // Validate trace structure matches snapshot
    await testExporter.assertMatchesSnapshot('workflow-branching-trace.json');
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

    await testExporter.assertMatchesSnapshot('workflow-unregistered-nested-trace.json');
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

    await testExporter.assertMatchesSnapshot('workflow-registered-nested-trace.json');
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

    await testExporter.assertMatchesSnapshot('workflow-tool-as-step-trace.json');
  });

  it('should add metadata in workflow step to span', async () => {
    const customMetadataStep = createStep({
      id: 'custom-metadata',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ output: z.string() }),
      execute: async ({ inputData, tracingContext, loggerVNext }) => {
        const { value } = inputData;
        tracingContext.currentSpan?.update({
          metadata: {
            customValue: value,
            stepType: 'metadata-test',
            executionTime: new Date(),
          },
        });

        // Emit logs via loggerVNext (should be correlated to the step's span)
        loggerVNext?.info('workflow-step: processing', { value });

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

    await testExporter.assertMatchesSnapshot('workflow-metadata-in-step-trace.json');

    // Verify loggerVNext in workflow step delivers trace-correlated logs to the exporter
    const stepLog = testExporter.getLogsByLevel('info').find(l => l.message === 'workflow-step: processing');
    expect(stepLog, 'loggerVNext.info() in workflow step should be captured by the exporter').toBeDefined();
    expect(stepLog!.data).toEqual({ value: 'tacos' });
    expect(stepLog!.traceId).toBe(result.traceId);
    expect(stepLog!.spanId).toBeDefined();

    // Verify auto-extracted workflow metrics
    const workflowStarted = testExporter.getMetricsByName('mastra_workflow_runs_started');
    expect(workflowStarted).toHaveLength(1);
    expect(workflowStarted[0]!.labels.workflow).toBeDefined();

    const workflowEnded = testExporter.getMetricsByName('mastra_workflow_runs_ended');
    expect(workflowEnded).toHaveLength(1);
    expect(workflowEnded[0]!.labels.status).toBe('ok');

    const workflowDuration = testExporter.getMetricsByName('mastra_workflow_duration_ms');
    expect(workflowDuration).toHaveLength(1);
    expect(workflowDuration[0]!.value).toBeGreaterThanOrEqual(0);
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

    await testExporter.assertMatchesSnapshot('workflow-child-spans-trace.json');
  });

  describe.each(agentMethods)(
    'should trace agent with multiple tools HIDING internal spans using $name',
    ({ method, model }) => {
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
        const threadId = 'test-thread-id';
        const agent = mastra.getAgent('testAgent');
        const result = await method(agent, 'Calculate 5 + 3', {
          memory: { thread: threadId, resource: resourceId },
        });
        expect(result.text).toBeDefined();
        expect(result.traceId).toBeDefined();

        await testExporter.assertMatchesSnapshot('agent-tool-call-trace.json');

        // Verify timing (not covered by snapshot)
        const agentRunSpan = testExporter.getSpansByType(SpanType.AGENT_RUN)[0];
        const llmGenerationSpan = testExporter.getSpansByType(SpanType.MODEL_GENERATION)[0];
        expect(llmGenerationSpan?.endTime).toBeDefined();
        expect(agentRunSpan?.endTime).toBeDefined();
        expect(llmGenerationSpan?.endTime!.getTime()).toBeLessThanOrEqual(agentRunSpan?.endTime!.getTime());
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

        // Verify chunk tracking
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

        const agentRunSpan = agentRunSpans[0];
        const llmGenerationSpan = llmGenerationSpans[0];

        expect(agentRunSpan?.traceId).toBe(result.traceId);

        // verify span nesting
        const executionWorkflowSpan = workflowSpans.filter(span => span.name?.includes('execution-workflow'))[0];
        const agenticLoopWorkflowSpan = workflowSpans.filter(span => span.name?.includes('agentic-loop'))[0];
        const streamTextStepSpan = workflowSteps.filter(span => span.name?.includes('stream-text-step'))[0];
        expect(streamTextStepSpan?.parentSpanId).toEqual(executionWorkflowSpan?.id);
        expect(agenticLoopWorkflowSpan?.parentSpanId).toEqual(llmGenerationSpan?.id);

        expect(llmGenerationSpan?.name).toBe("llm: 'mock-model-id'");
        expect(llmGenerationSpan?.input.messages).toHaveLength(2);
        expect(llmGenerationSpan?.output.text).toBe(`Mock V2 ${name} response`);
        expect(agentRunSpan?.output.text).toBe(`Mock V2 ${name} response`);
        expect(llmGenerationSpan?.attributes?.usage?.inputTokens).toBeGreaterThan(0);

        finalExpectations(testExporter);
      });
    },
  );

  describe.each(agentMethods)('should trace agent using structuredOutput format using $name', ({ method, model }) => {
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

      const structuredOutput: StructuredOutputOptions<InferSchemaOutput<typeof outputSchema>> = {
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

      // Validate trace structure matches snapshot
      await testExporter.assertMatchesSnapshot(`agent-structured-output-trace.json`);

      // Verify structured output result (not covered by snapshot)
      expect(result.object).toHaveProperty('items');
      expect((result.object as any).items).toBe('test structured output');
    });
  });

  describe.each(agentMethods)('agent with input and output processors using $name', ({ method, model }) => {
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
      expect(result.traceId).toBeDefined();

      // Validate trace structure matches snapshot
      await testExporter.assertMatchesSnapshot(`agent-processors-trace.json`);
    });
  });

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

      await testExporter.assertMatchesSnapshot('workflow-agent-step-trace.json');
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

      await testExporter.assertMatchesSnapshot('agent-workflow-tool-trace.json');
    });
  });

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

      await testExporter.assertMatchesSnapshot(`agent-workflow-direct-trace.json`);
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
              timestamp: new Date(),
            },
          });

          // Emit logs via the observability loggerVNext context
          context?.loggerVNext?.info('metadata-tool: processing', { inputValue: inputData.input });

          // Emit custom metrics via the observability metrics context
          context?.metrics?.counter('metadata_tool_calls').add(1, { tool_id: 'metadata-tool' });
          context?.metrics?.histogram('metadata_tool_input_length').record(inputData.input.length);

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

      await testExporter.assertMatchesSnapshot('tool-metadata-trace.json');

      // Verify loggerVNext delivered the log to the exporter with trace correlation
      const infoLogs = testExporter.getLogsByLevel('info');
      const toolLog = infoLogs.find(l => l.message === 'metadata-tool: processing');
      expect(toolLog, 'loggerVNext.info() in tool should be captured by the exporter').toBeDefined();
      expect(toolLog!.data).toEqual({ inputValue: 'some data' });
      expect(toolLog!.traceId).toBe(result.traceId);
      expect(toolLog!.spanId).toBeDefined();

      // Verify custom metrics delivered to the exporter
      const counterMetrics = testExporter.getMetricsByName('metadata_tool_calls');
      expect(counterMetrics, 'metrics.counter() in tool should be captured by the exporter').toHaveLength(1);
      expect(counterMetrics[0]!.metricType).toBe('counter');
      expect(counterMetrics[0]!.value).toBe(1);
      expect(counterMetrics[0]!.labels.tool_id).toBe('metadata-tool');
      expect(counterMetrics[0]!.metadata?.serviceName).toBe('integration-tests');

      const histoMetrics = testExporter.getMetricsByName('metadata_tool_input_length');
      expect(histoMetrics, 'metrics.histogram() in tool should be captured by the exporter').toHaveLength(1);
      expect(histoMetrics[0]!.metricType).toBe('histogram');
      expect(histoMetrics[0]!.value).toBe('some data'.length);

      // Verify auto-extracted metrics from the agent run
      const agentStarted = testExporter.getMetricsByName('mastra_agent_runs_started');
      expect(agentStarted).toHaveLength(1);
      expect(agentStarted[0]!.labels.agent).toBe('Metadata Agent');

      const agentEnded = testExporter.getMetricsByName('mastra_agent_runs_ended');
      expect(agentEnded).toHaveLength(1);
      expect(agentEnded[0]!.labels.status).toBe('ok');

      const agentDuration = testExporter.getMetricsByName('mastra_agent_duration_ms');
      expect(agentDuration).toHaveLength(1);
      expect(agentDuration[0]!.value).toBeGreaterThanOrEqual(0);

      // Auto-extracted model metrics (token counts, duration)
      const modelStarted = testExporter.getMetricsByName('mastra_model_requests_started');
      expect(modelStarted.length).toBeGreaterThanOrEqual(1);

      const inputTokens = testExporter.getMetricsByName('mastra_model_input_tokens');
      expect(inputTokens.length).toBeGreaterThanOrEqual(1);
      expect(inputTokens[0]!.value).toBeGreaterThan(0);

      const outputTokens = testExporter.getMetricsByName('mastra_model_output_tokens');
      expect(outputTokens.length).toBeGreaterThanOrEqual(1);
      expect(outputTokens[0]!.value).toBeGreaterThan(0);

      // Auto-extracted tool call metrics
      const toolStarted = testExporter.getMetricsByName('mastra_tool_calls_started');
      expect(toolStarted).toHaveLength(1);
      expect(toolStarted[0]!.labels.tool).toBe('metadataTool');

      const toolEnded = testExporter.getMetricsByName('mastra_tool_calls_ended');
      expect(toolEnded).toHaveLength(1);
      expect(toolEnded[0]!.labels.status).toBe('ok');

      const toolDuration = testExporter.getMetricsByName('mastra_tool_duration_ms');
      expect(toolDuration).toHaveLength(1);
      expect(toolDuration[0]!.value).toBeGreaterThanOrEqual(0);
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
          // Emit a log before child span work
          context?.loggerVNext?.info('child-span-tool: starting', { input: inputData.input });

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

          // Update and end child span
          childSpan?.update({
            metadata: {
              ...childSpan.metadata,
              processedValue: `processed-${inputData.input}`,
            },
          });

          childSpan?.end({ output: `child-result-${inputData.input}` });

          // Emit a log after child span work
          context?.loggerVNext?.info('child-span-tool: finished', { output: `child-result-${inputData.input}` });

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

      await testExporter.assertMatchesSnapshot('tool-child-spans-trace.json');

      // Verify logs emitted from tool are trace-correlated and delivered to the exporter
      const allLogs = testExporter.getAllLogs();
      const startLog = allLogs.find(l => l.message === 'child-span-tool: starting');
      const finishLog = allLogs.find(l => l.message === 'child-span-tool: finished');
      expect(startLog, 'loggerVNext in tool should deliver logs to the exporter').toBeDefined();
      expect(finishLog).toBeDefined();
      expect(startLog!.traceId).toBe(result.traceId);
      expect(finishLog!.traceId).toBe(result.traceId);
      // Both logs share the same span (the tool call span)
      expect(startLog!.spanId).toBe(finishLog!.spanId);
    });
  });

  it('should propagate tracingContext to agent steps in workflows', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'response-metadata', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Test response from agent' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
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

    await testExporter.assertMatchesSnapshot('workflow-create-step-agent-trace.json');
  });

  it('should have MODEL_STEP span startTime close to MODEL_GENERATION startTime, not endTime (issue #11271)', async () => {
    // This test verifies that MODEL_STEP spans have correct startTime.
    // The span should start when the model API call begins, not when the response starts streaming.

    const delayedMockModel = new MockLanguageModelV2({
      doStream: async () => {
        // Simulate model processing delay before first token.
        // This must be a real delay (not a microtask) because the test asserts
        // that the generation span duration exceeds 50ms.
        await new Promise(resolve => setTimeout(resolve, 100));

        return {
          stream: convertArrayToReadableStream([
            { type: 'response-metadata', id: 'resp-1' },
            { type: 'text-delta', id: '1', delta: 'Hello ' },
            { type: 'text-delta', id: '2', delta: 'world' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          ]),
        };
      },
    });

    const delayedAgent = new Agent({
      id: 'delayed-agent',
      name: 'Delayed Agent',
      instructions: 'You are a test agent',
      model: delayedMockModel,
    });

    const mastra = new Mastra({
      ...getBaseMastraConfig(testExporter),
      agents: { delayedAgent },
    });

    const agent = mastra.getAgent('delayedAgent');
    const result = await agent.stream('Hello');

    // Consume the stream to trigger span lifecycle
    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }
    expect(fullText).toBe('Hello world');

    const llmGenerationSpans = testExporter.getSpansByType(SpanType.MODEL_GENERATION);
    const llmStepSpans = testExporter.getSpansByType(SpanType.MODEL_STEP);

    const generationSpan = llmGenerationSpans[0]!;
    const stepSpan = llmStepSpans[0]!;

    // Both spans should have defined times
    expect(generationSpan.startTime).toBeDefined();
    expect(generationSpan.endTime).toBeDefined();
    expect(stepSpan.startTime).toBeDefined();
    expect(stepSpan.endTime).toBeDefined();

    const generationStart = generationSpan.startTime.getTime();
    const generationEnd = generationSpan.endTime!.getTime();
    const stepStart = stepSpan.startTime.getTime();

    const generationDuration = generationEnd - generationStart;
    const stepStartOffset = stepStart - generationStart;

    // Log values for debugging (only visible in verbose mode or on failure)
    console.log('MODEL_GENERATION span:', {
      start: generationSpan.startTime.toISOString(),
      end: generationSpan.endTime!.toISOString(),
      duration: `${generationDuration}ms`,
    });
    console.log('MODEL_STEP span:', {
      start: stepSpan.startTime.toISOString(),
      end: stepSpan.endTime!.toISOString(),
      startOffset: `${stepStartOffset}ms from generation start`,
    });

    // The step should start close to when the generation started (within 50ms tolerance)
    expect(stepStartOffset).toBeLessThan(50);

    // The step should NOT start close to when the generation ended
    const stepStartToGenerationEnd = generationEnd - stepStart;
    expect(stepStartToGenerationEnd).toBeGreaterThan(50);

    await testExporter.assertMatchesSnapshot('model-step-timing-trace.json');
  });

  describe.each(agentMethods)(
    'should accumulate text from all steps in agent run span, not just last step (issue #11659) using $name',
    ({ name }) => {
      it('should include text from all steps in output', async () => {
        // This test verifies that when an agent executes multiple steps (e.g., announces tool call,
        // executes tool, then returns result), ALL text chunks are accumulated in the output,
        // not just the text from the final step.
        //
        // The bug was that onFinishPayload used baseFinishStep.text (last step only) instead of
        // self.#bufferedText.join('') (all accumulated text).

        let callCount = 0;

        const multiStepMockModel = new MockLanguageModelV2({
          doGenerate: async () => {
            callCount++;

            if (callCount === 1) {
              // First call: Agent announces it will use a tool, then calls the tool
              return {
                content: [
                  { type: 'text', text: 'Let me calculate that for you. ' },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-calc-1',
                    toolName: 'calculator',
                    args: { operation: 'add', a: 5, b: 3 },
                    input: '{"operation":"add","a":5,"b":3}',
                  },
                ],
                finishReason: 'tool-calls' as const,
                usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
                warnings: [],
                response: { id: '00000000-0000-0000-0000-000000000001', modelId: 'mock-model-id' },
              };
            } else {
              // Second call: After tool execution, agent returns the final answer
              return {
                content: [{ type: 'text', text: 'The result of 5 + 3 is 8.' }],
                finishReason: 'stop' as const,
                usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
                warnings: [],
                response: { id: '00000000-0000-0000-0000-000000000002', modelId: 'mock-model-id' },
              };
            }
          },
          doStream: async () => {
            callCount++;

            if (callCount === 1) {
              // First call: Agent announces it will use a tool, then calls the tool
              return {
                stream: convertArrayToReadableStream([
                  { type: 'response-metadata', id: '00000000-0000-0000-0000-000000000001', modelId: 'mock-model-id' },
                  { type: 'text-delta', id: '1', delta: 'Let me calculate that for you. ' },
                  {
                    type: 'tool-input-start',
                    id: 'call-calc-1',
                    toolName: 'calculator',
                  },
                  {
                    type: 'tool-input-delta',
                    id: 'call-calc-1',
                    delta: '{"operation":"add","a":5,"b":3}',
                  },
                  {
                    type: 'tool-input-end',
                    id: 'call-calc-1',
                  },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-calc-1',
                    toolName: 'calculator',
                    args: '{"operation":"add","a":5,"b":3}',
                    input: '{"operation":"add","a":5,"b":3}',
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
                  },
                ]),
              };
            } else {
              // Second call: After tool execution, agent returns the final answer
              return {
                stream: convertArrayToReadableStream([
                  { type: 'response-metadata', id: '00000000-0000-0000-0000-000000000002', modelId: 'mock-model-id' },
                  { type: 'text-delta', id: '2', delta: 'The result of 5 + 3 is 8.' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
                  },
                ]),
              };
            }
          },
        });

        const multiStepAgent = new Agent({
          id: 'multi-step-agent',
          name: 'Multi Step Agent',
          instructions: 'You are a helpful calculator assistant that announces what you will do before doing it.',
          model: multiStepMockModel,
          tools: { calculator: calculatorTool },
        });

        const mastra = new Mastra({
          ...getBaseMastraConfig(testExporter),
          agents: { multiStepAgent },
        });

        const agent = mastra.getAgent('multiStepAgent');

        // Call either stream() or generate() based on the test parameter
        let fullText: string;
        if (name === 'stream') {
          const result = await agent.stream('What is 5 + 3?');
          fullText = '';
          for await (const chunk of result.textStream) {
            fullText += chunk;
          }
        } else {
          const result = await agent.generate('What is 5 + 3?');
          fullText = result.text;
        }

        // The full text should contain text from BOTH steps
        expect(fullText).toContain('Let me calculate that for you.');
        expect(fullText).toContain('The result of 5 + 3 is 8.');

        const agentRunSpans = testExporter.getSpansByType(SpanType.AGENT_RUN);
        const llmGenerationSpans = testExporter.getSpansByType(SpanType.MODEL_GENERATION);

        const agentRunSpan = agentRunSpans[0]!;
        const llmGenerationSpan = llmGenerationSpans[0]!;

        // CRITICAL: The agent run span output should contain ALL accumulated text from all steps,
        // not just the text from the final step. This was the bug fixed in issue #11659.
        expect(agentRunSpan.output?.text).toContain('Let me calculate that for you.');
        expect(agentRunSpan.output?.text).toContain('The result of 5 + 3 is 8.');

        // The LLM generation span should also contain all accumulated text
        expect(llmGenerationSpan.output?.text).toContain('Let me calculate that for you.');
        expect(llmGenerationSpan.output?.text).toContain('The result of 5 + 3 is 8.');

        // Verify the full accumulated text matches what we received from the stream/generate
        expect(agentRunSpan.output?.text).toBe(fullText);
        expect(llmGenerationSpan.output?.text).toBe(fullText);

        await testExporter.assertMatchesSnapshot('multi-step-text-accumulation-trace.json');
      });
    },
  );

  /**
   * Tests that tags set in tracingOptions (either via defaultOptions or in generate/stream call)
   * are properly passed through to the exported spans and received by exporters.
   */
  describe('tracingOptions.tags support (Issue #12209)', () => {
    it('should pass tags from defaultOptions.tracingOptions to exported spans', async () => {
      const testAgent = new Agent({
        id: 'test-agent-with-tags',
        name: 'Test Agent With Tags',
        instructions: 'You are a test agent',
        model: mockModelV2,
        defaultOptions: {
          tracingOptions: {
            tags: ['production', 'test-tag', 'experiment-v1'],
          },
        },
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { testAgent },
      });

      const agent = mastra.getAgent('testAgent');
      // Call generate WITHOUT passing tracingOptions - should use defaultOptions
      const result = await agent.generate('Hello');

      expect(result.text).toBeDefined();
      expect(result.traceId).toBeDefined();

      await testExporter.assertMatchesSnapshot('tags-from-default-options-trace.json');
    });

    it('should pass tags from generate call tracingOptions to exported spans', async () => {
      const testAgent = new Agent({
        id: 'test-agent-tags-call',
        name: 'Test Agent Tags Call',
        instructions: 'You are a test agent',
        model: mockModelV2,
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { testAgent },
      });

      const agent = mastra.getAgent('testAgent');
      // Call generate WITH explicit tracingOptions.tags
      const result = await agent.generate('Hello', {
        tracingOptions: {
          tags: ['call-tag-1', 'call-tag-2'],
        },
      });

      expect(result.text).toBeDefined();
      expect(result.traceId).toBeDefined();

      await testExporter.assertMatchesSnapshot('tags-from-generate-call-trace.json');
    });

    it('should merge tags from defaultOptions and generate call tracingOptions', async () => {
      const testAgent = new Agent({
        id: 'test-agent-merge-tags',
        name: 'Test Agent Merge Tags',
        instructions: 'You are a test agent',
        model: mockModelV2,
        defaultOptions: {
          tracingOptions: {
            tags: ['default-tag'],
            metadata: { source: 'default' },
          },
        },
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { testAgent },
      });

      const agent = mastra.getAgent('testAgent');
      // Call generate with additional tracingOptions - call-site tags override defaults
      const result = await agent.generate('Hello', {
        tracingOptions: {
          tags: ['call-tag'],
          metadata: { source: 'call' },
        },
      });

      expect(result.text).toBeDefined();
      expect(result.traceId).toBeDefined();

      await testExporter.assertMatchesSnapshot('tags-call-overrides-defaults-trace.json');
    });

    it('should preserve defaultOptions.tracingOptions.tags when call passes other tracingOptions properties', async () => {
      const testAgent = new Agent({
        id: 'test-agent-preserve-tags',
        name: 'Test Agent Preserve Tags',
        instructions: 'You are a test agent',
        model: mockModelV2,
        defaultOptions: {
          tracingOptions: {
            tags: ['preserve-this-tag'],
          },
        },
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { testAgent },
      });

      const agent = mastra.getAgent('testAgent');
      // Call generate with tracingOptions that has metadata but NO tags
      // Tags from defaultOptions should be preserved via deep merge
      const result = await agent.generate('Hello', {
        tracingOptions: {
          metadata: { someKey: 'someValue' },
        },
      });

      expect(result.text).toBeDefined();
      expect(result.traceId).toBeDefined();

      await testExporter.assertMatchesSnapshot('tags-preserved-with-other-options-trace.json');
    });

    it('should pass tags from stream call tracingOptions to exported spans', async () => {
      const testAgent = new Agent({
        id: 'test-agent-stream-tags',
        name: 'Test Agent Stream Tags',
        instructions: 'You are a test agent',
        model: mockModelV2,
        defaultOptions: {
          tracingOptions: {
            tags: ['stream-default-tag'],
          },
        },
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { testAgent },
      });

      const agent = mastra.getAgent('testAgent');
      // Call stream without passing any options - should use defaultOptions
      const result = await agent.stream('Hello');
      // Consume stream to complete
      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }

      expect(fullText).toBeDefined();
      expect(result.traceId).toBeDefined();

      await testExporter.assertMatchesSnapshot('tags-from-stream-default-options-trace.json');
    });
  });
});
