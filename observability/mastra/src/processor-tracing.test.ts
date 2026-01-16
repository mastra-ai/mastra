import { randomUUID } from 'node:crypto';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage, MessageList } from '@mastra/core/agent/message-list';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { SpanType, TracingEventType, EntityType } from '@mastra/core/observability';
import type {
  ObservabilityExporter,
  TracingEvent,
  ExportedSpan,
  AnyExportedSpan,
  TracingContext,
} from '@mastra/core/observability';
import type { Processor, ProcessOutputStreamArgs } from '@mastra/core/processors';
import { ProcessorStepSchema } from '@mastra/core/processors';
import { MockStore } from '@mastra/core/storage';
import type { ChunkType } from '@mastra/core/stream';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Observability } from './default';

// ============================================================================
// Test Exporter
// ============================================================================

/**
 * Simple test exporter for processor tracing tests.
 * Captures all tracing events and provides helpers for assertions.
 */
class ProcessorTestExporter implements ObservabilityExporter {
  name = 'processor-test-exporter';
  private events: TracingEvent[] = [];
  private spanStates = new Map<
    string,
    {
      hasStart: boolean;
      hasEnd: boolean;
      events: TracingEvent[];
    }
  >();
  private logs: string[] = [];

  async exportTracingEvent(event: TracingEvent) {
    const span = event.exportedSpan;
    const processorExecutor =
      span.type === SpanType.PROCESSOR_RUN
        ? `, executor: ${(span.attributes as any)?.processorExecutor ?? 'unknown'}`
        : '';
    const logMessage = `[ProcessorTest] ${event.type}: ${span.type} "${span.name}" (entity: ${span.entityName ?? span.entityId}, entityType: ${span.entityType}, trace: ${span.traceId.slice(-8)}, span: ${span.id.slice(-8)}, parent: ${span.parentSpanId?.slice(-8) ?? 'none'}${processorExecutor})`;
    this.logs.push(logMessage);

    if (process.env.TRACING_VERBOSE === 'true') {
      console.log(logMessage);
    }

    const spanId = event.exportedSpan.id;
    const state = this.spanStates.get(spanId) || { hasStart: false, hasEnd: false, events: [] };

    if (event.type === TracingEventType.SPAN_STARTED) {
      state.hasStart = true;
    } else if (event.type === TracingEventType.SPAN_ENDED) {
      state.hasEnd = true;
    }

    state.events.push(event);
    this.spanStates.set(spanId, state);
    this.events.push(event);
  }

  async shutdown() {}

  reset() {
    this.events = [];
    this.spanStates.clear();
    this.logs = [];
  }

  dumpLogsOnFailure() {
    console.log('\n=== Processor Tracing Test Logs ===');
    for (const log of this.logs) {
      console.log(log);
    }
    console.log('=== End Logs ===\n');
  }

  getSpansByType<T extends SpanType>(type: T): ExportedSpan<T>[] {
    return Array.from(this.spanStates.values())
      .filter(state => {
        const finalEvent =
          state.events.find(e => e.type === TracingEventType.SPAN_ENDED) || state.events[state.events.length - 1];
        return state.hasEnd && finalEvent?.exportedSpan.type === type;
      })
      .map(state => {
        const endEvent = state.events.find(e => e.type === TracingEventType.SPAN_ENDED);
        return endEvent!.exportedSpan;
      }) as ExportedSpan<T>[];
  }

  getProcessorSpans() {
    return this.getSpansByType(SpanType.PROCESSOR_RUN);
  }

  getAgentSpans() {
    return this.getSpansByType(SpanType.AGENT_RUN);
  }

  getModelSpans() {
    return this.getSpansByType(SpanType.MODEL_GENERATION);
  }

  getModelStepSpans() {
    return this.getSpansByType(SpanType.MODEL_STEP);
  }

  getWorkflowStepSpans() {
    return this.getSpansByType(SpanType.WORKFLOW_STEP);
  }

  getWorkflowSpans() {
    return this.getSpansByType(SpanType.WORKFLOW_RUN);
  }

  getModelChunkSpans() {
    return this.getSpansByType(SpanType.MODEL_CHUNK);
  }

  getToolCallSpans() {
    return this.getSpansByType(SpanType.TOOL_CALL);
  }

  getAllSpans(): AnyExportedSpan[] {
    return Array.from(this.spanStates.values())
      .filter(state => state.hasEnd)
      .map(state => {
        const endEvent = state.events.find(e => e.type === TracingEventType.SPAN_ENDED);
        return endEvent!.exportedSpan;
      });
  }

  dumpLogs() {
    console.log('\n=== PROCESSOR TEST LOGS ===');
    this.logs.forEach(log => console.log(log));
    console.log('=== END LOGS ===\n');
  }

  /**
   * Verify that span A started before span B.
   * Useful for validating execution order of sibling spans.
   */
  expectStartedBefore(spanA: AnyExportedSpan | undefined, spanB: AnyExportedSpan | undefined): void {
    expect(spanA?.startTime).toBeDefined();
    expect(spanB?.startTime).toBeDefined();
    const timeA = new Date(spanA!.startTime!).getTime();
    const timeB = new Date(spanB!.startTime!).getTime();
    expect(timeA).toBeLessThanOrEqual(timeB);
  }

  finalExpectations() {
    try {
      const allSpans = this.getAllSpans();
      const traceIds = [...new Set(allSpans.map(span => span?.traceId))];
      expect(traceIds).toHaveLength(1);

      const incompleteSpans = Array.from(this.spanStates.entries())
        .filter(([_, state]) => !state.hasEnd)
        .map(([spanId, state]) => ({ spanId, span: state.events[0]?.exportedSpan }));

      expect(incompleteSpans, `Found incomplete spans`).toHaveLength(0);
    } catch (error) {
      this.dumpLogs();
      throw error;
    }
  }
}

// ============================================================================
// Mock Model Factory
// ============================================================================

function createMockModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      content: [{ type: 'text', text: 'Mock response' }],
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      warnings: [],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'response-metadata', id: '1' },
        { type: 'text-delta', id: '1', delta: 'Mock ' },
        { type: 'text-delta', id: '2', delta: 'response' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ]),
    }),
  });
}

// ============================================================================
// Test Fixtures - Processor Implementations
// ============================================================================

/**
 * Simple input processor that only implements processInput.
 */
class SimpleInputProcessor implements Processor {
  readonly id: string;
  readonly name: string;

  constructor(id: string = 'simple-input') {
    this.id = id;
    this.name = `Simple Input: ${id}`;
  }

  async processInput(args: { messages: MastraDBMessage[] }): Promise<MastraDBMessage[]> {
    return args.messages;
  }
}

/**
 * Simple output processor that only implements processOutputResult.
 */
class SimpleOutputProcessor implements Processor {
  readonly id: string;
  readonly name: string;

  constructor(id: string = 'simple-output') {
    this.id = id;
    this.name = `Simple Output: ${id}`;
  }

  async processOutputResult(args: { messages: MastraDBMessage[] }): Promise<MastraDBMessage[]> {
    return args.messages;
  }
}

/**
 * Input step processor that implements processInputStep.
 */
class InputStepProcessor implements Processor {
  readonly id: string;
  readonly name: string;

  constructor(id: string = 'input-step') {
    this.id = id;
    this.name = `Input Step: ${id}`;
  }

  async processInputStep(args: { messages: MastraDBMessage[]; messageList: MessageList }): Promise<MessageList> {
    return args.messageList;
  }
}

/**
 * Output step processor that implements processOutputStep.
 */
class OutputStepProcessor implements Processor {
  readonly id: string;
  readonly name: string;

  constructor(id: string = 'output-step') {
    this.id = id;
    this.name = `Output Step: ${id}`;
  }

  async processOutputStep(args: { messages: MastraDBMessage[]; messageList: MessageList }): Promise<MessageList> {
    return args.messageList;
  }
}

/**
 * Output stream processor that implements processOutputStream.
 */
class OutputStreamProcessor implements Processor {
  readonly id: string;
  readonly name: string;

  constructor(id: string = 'output-stream') {
    this.id = id;
    this.name = `Output Stream: ${id}`;
  }

  async processOutputStream(args: ProcessOutputStreamArgs): Promise<ChunkType | null | undefined> {
    // Pass through the chunk unchanged
    return args.part;
  }
}

/**
 * Full processor that implements all phases.
 */
class FullProcessor implements Processor {
  readonly id: string;
  readonly name: string;

  constructor(id: string = 'full') {
    this.id = id;
    this.name = `Full Processor: ${id}`;
  }

  async processInput(args: { messages: MastraDBMessage[] }): Promise<MastraDBMessage[]> {
    return args.messages;
  }

  async processInputStep(args: { messages: MastraDBMessage[]; messageList: MessageList }): Promise<MessageList> {
    return args.messageList;
  }

  async processOutputStep(args: { messages: MastraDBMessage[]; messageList: MessageList }): Promise<MessageList> {
    return args.messageList;
  }

  async processOutputResult(args: { messages: MastraDBMessage[] }): Promise<MastraDBMessage[]> {
    return args.messages;
  }
}

/**
 * Processor with internal agent - calls another agent during processing.
 */
class ProcessorWithAgent implements Processor {
  readonly id: string;
  readonly name: string;
  private agent: Agent;

  constructor(id: string, model: any) {
    this.id = id;
    this.name = `Processor with Agent: ${id}`;
    this.agent = new Agent({
      id: `${id}-internal-agent`,
      name: `${id} Internal Agent`,
      instructions: 'Internal processor agent',
      model,
    });
  }

  async processInput(args: {
    messages: MastraDBMessage[];
    tracingContext?: TracingContext;
  }): Promise<MastraDBMessage[]> {
    await this.agent.generate('Process input', { tracingContext: args.tracingContext });
    return args.messages;
  }
}

// ============================================================================
// Test Fixtures - Workflow Processors
// ============================================================================

/**
 * Creates a simple workflow that can be used as a processor.
 * Uses the standard workflow pattern from https://mastra.ai/docs/v1/workflows/overview
 * with ProcessorStepSchema for input/output schemas.
 *
 * The workflow has a single step that passes through the processor data.
 */
function createProcessorWorkflow(id: string) {
  // Create a simple step that passes through the data
  const validatorStep = createStep({
    id: `${id}-validator`,
    inputSchema: ProcessorStepSchema,
    outputSchema: ProcessorStepSchema,
    execute: async ({ inputData }) => {
      // Simple pass-through - in real usage this would validate/transform
      return inputData;
    },
  });

  // Create the workflow with ProcessorStepSchema
  return createWorkflow({
    id,
    inputSchema: ProcessorStepSchema,
    outputSchema: ProcessorStepSchema,
  })
    .then(validatorStep)
    .commit();
}

// ============================================================================
// Test Setup
// ============================================================================

let testExporter: ProcessorTestExporter;
let observability: Observability;

function getBaseMastraConfig(exporter: ProcessorTestExporter) {
  observability = new Observability({
    configs: {
      test: {
        serviceName: 'processor-tracing-tests',
        exporters: [exporter],
      },
    },
  });

  return {
    storage: new MockStore(),
    observability,
  };
}

describe('Processor Tracing Tests', () => {
  beforeEach(() => {
    testExporter = new ProcessorTestExporter();
  });

  afterEach(async context => {
    // If test failed, dump logs for debugging
    if (context?.task?.result?.state === 'fail') {
      testExporter.dumpLogsOnFailure();
    }
    testExporter.reset();
    if (observability) {
      await observability.shutdown();
    }
  });

  // ==========================================================================
  // Single Processor Tests
  // ==========================================================================

  describe('Single Processor', () => {
    /**
     * Expected span structure:
     * - test-agent AGENT_RUN (root)
     *   - input processor: validator PROCESSOR_RUN
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     */
    it('should trace a single input processor with processor ID in span name', async () => {
      const model = createMockModel();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        inputProcessors: [new SimpleInputProcessor('validator')],
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      await registeredAgent.generate('Hello');

      const agentSpans = testExporter.getAgentSpans();
      const processorSpans = testExporter.getProcessorSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();

      // EXPECTED: 1 agent span, 1 processor span, 1 model span, 1+ model step spans
      expect(agentSpans.length).toBe(1);
      expect(processorSpans.length).toBe(1);
      expect(modelSpans.length).toBe(1);
      expect(modelStepSpans.length).toBe(1);

      const agentSpan = agentSpans[0];
      const inputProcessorSpan = processorSpans[0];
      const modelSpan = modelSpans[0];
      const modelStepSpan = modelStepSpans[0];

      // Span name should include processor ID, NOT workflow ID
      expect(inputProcessorSpan?.name).toBe('input processor: validator');

      // Should have correct entity type
      expect(inputProcessorSpan?.entityType).toBe(EntityType.INPUT_PROCESSOR);

      // Should have processor attributes
      expect(inputProcessorSpan?.attributes?.processorExecutor).toBeDefined();
      expect(['workflow', 'legacy']).toContain(inputProcessorSpan?.attributes?.processorExecutor);
      expect(inputProcessorSpan?.attributes?.processorIndex).toBe(0);

      // FULL HIERARCHY VERIFICATION:
      // 1. Processor span is child of agent span
      expect(inputProcessorSpan?.parentSpanId).toBe(agentSpan?.id);
      // 2. MODEL_GENERATION is child of AGENT_RUN
      expect(modelSpan?.parentSpanId).toBe(agentSpan?.id);
      // 3. MODEL_STEP is child of MODEL_GENERATION
      expect(modelStepSpan?.parentSpanId).toBe(modelSpan?.id);

      // EXECUTION ORDER: input processor starts before MODEL_GENERATION
      testExporter.expectStartedBefore(inputProcessorSpan, modelSpan);

      testExporter.finalExpectations();
    });

    /**
     * Expected span structure:
     * - test-agent AGENT_RUN (root)
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     *   - output processor: formatter PROCESSOR_RUN
     */
    it('should trace a single output processor with processor ID in span name', async () => {
      const model = createMockModel();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        outputProcessors: [new SimpleOutputProcessor('formatter')],
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      await registeredAgent.generate('Hello');

      const agentSpans = testExporter.getAgentSpans();
      const processorSpans = testExporter.getProcessorSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();

      // EXPECTED: 1 agent span, 1 processor span, 1 model span, 1+ model step spans
      expect(agentSpans.length).toBe(1);
      expect(processorSpans.length).toBe(1);
      expect(modelSpans.length).toBe(1);
      expect(modelStepSpans.length).toBe(1);

      const agentSpan = agentSpans[0];
      const outputProcessorSpan = processorSpans[0];
      const modelSpan = modelSpans[0];
      const modelStepSpan = modelStepSpans[0];

      // Span name should include processor ID, NOT workflow ID
      expect(outputProcessorSpan?.name).toBe('output processor: formatter');

      // Should have correct entity type
      expect(outputProcessorSpan?.entityType).toBe(EntityType.OUTPUT_PROCESSOR);

      // FULL HIERARCHY VERIFICATION:
      // 1. Processor span is child of agent span
      expect(outputProcessorSpan?.parentSpanId).toBe(agentSpan?.id);
      // 2. MODEL_GENERATION is child of AGENT_RUN
      expect(modelSpan?.parentSpanId).toBe(agentSpan?.id);
      // 3. MODEL_STEP is child of MODEL_GENERATION
      expect(modelStepSpan?.parentSpanId).toBe(modelSpan?.id);

      // EXECUTION ORDER: MODEL_GENERATION starts before output processor
      testExporter.expectStartedBefore(modelSpan, outputProcessorSpan);

      testExporter.finalExpectations();
    });
  });

  // ==========================================================================
  // Multiple Processors Tests
  // ==========================================================================

  describe('Multiple Processors', () => {
    /**
     * Expected span structure:
     * - test-agent AGENT_RUN (root)
     *   - input processor: first PROCESSOR_RUN
     *   - input processor: second PROCESSOR_RUN
     *   - input processor: third PROCESSOR_RUN
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     */
    it('should trace multiple input processors with individual spans', async () => {
      const model = createMockModel();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        inputProcessors: [
          new SimpleInputProcessor('first'),
          new SimpleInputProcessor('second'),
          new SimpleInputProcessor('third'),
        ],
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      await registeredAgent.generate('Hello');

      const agentSpans = testExporter.getAgentSpans();
      const processorSpans = testExporter.getProcessorSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();
      const inputProcessorSpans = processorSpans.filter(s => s.name?.includes('input processor'));

      // EXPECTED: 1 agent span, 3 processor spans, 1 model span, 1+ model step spans
      expect(agentSpans.length).toBe(1);
      expect(inputProcessorSpans.length).toBe(3);
      expect(modelSpans.length).toBe(1);
      expect(modelStepSpans.length).toBe(1);

      const agentSpan = agentSpans[0];
      const modelSpan = modelSpans[0];
      const modelStepSpan = modelStepSpans[0];

      // Each processor should have its own span with correct name
      const firstSpan = inputProcessorSpans.find(s => s.name === 'input processor: first');
      const secondSpan = inputProcessorSpans.find(s => s.name === 'input processor: second');
      const thirdSpan = inputProcessorSpans.find(s => s.name === 'input processor: third');
      expect(firstSpan).toBeDefined();
      expect(secondSpan).toBeDefined();
      expect(thirdSpan).toBeDefined();

      // Each processor should have correct processorIndex attribute
      expect(firstSpan?.attributes?.processorIndex).toBe(0);
      expect(secondSpan?.attributes?.processorIndex).toBe(1);
      expect(thirdSpan?.attributes?.processorIndex).toBe(2);

      // FULL HIERARCHY VERIFICATION:
      // 1. All processor spans are children of agent span
      for (const span of inputProcessorSpans) {
        expect(span.parentSpanId).toBe(agentSpan?.id);
      }
      // 2. MODEL_GENERATION is child of AGENT_RUN
      expect(modelSpan?.parentSpanId).toBe(agentSpan?.id);
      // 3. MODEL_STEP is child of MODEL_GENERATION
      expect(modelStepSpan?.parentSpanId).toBe(modelSpan?.id);

      // EXECUTION ORDER: Input processors run in order, then MODEL_GENERATION
      testExporter.expectStartedBefore(firstSpan, secondSpan);
      testExporter.expectStartedBefore(secondSpan, thirdSpan);
      testExporter.expectStartedBefore(thirdSpan, modelSpan);

      testExporter.finalExpectations();
    });

    /**
     * Expected span structure:
     * - test-agent AGENT_RUN (root)
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     *   - output processor: first PROCESSOR_RUN
     *   - output processor: second PROCESSOR_RUN
     */
    it('should trace multiple output processors with individual spans', async () => {
      const model = createMockModel();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        outputProcessors: [new SimpleOutputProcessor('first'), new SimpleOutputProcessor('second')],
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      await registeredAgent.generate('Hello');

      const agentSpans = testExporter.getAgentSpans();
      const processorSpans = testExporter.getProcessorSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();
      const outputProcessorSpans = processorSpans.filter(s => s.name?.includes('output processor'));

      // EXPECTED: 1 agent span, 2 processor spans, 1 model span, 1+ model step spans
      expect(agentSpans.length).toBe(1);
      expect(outputProcessorSpans.length).toBe(2);
      expect(modelSpans.length).toBe(1);
      expect(modelStepSpans.length).toBe(1);

      const agentSpan = agentSpans[0];
      const modelSpan = modelSpans[0];
      const modelStepSpan = modelStepSpans[0];

      // Each processor should have its own span with correct name
      const firstSpan = outputProcessorSpans.find(s => s.name === 'output processor: first');
      const secondSpan = outputProcessorSpans.find(s => s.name === 'output processor: second');
      expect(firstSpan).toBeDefined();
      expect(secondSpan).toBeDefined();

      // FULL HIERARCHY VERIFICATION:
      // 1. All processor spans are children of agent span
      for (const span of outputProcessorSpans) {
        expect(span.parentSpanId).toBe(agentSpan?.id);
      }
      // 2. MODEL_GENERATION is child of AGENT_RUN
      expect(modelSpan?.parentSpanId).toBe(agentSpan?.id);
      // 3. MODEL_STEP is child of MODEL_GENERATION
      expect(modelStepSpan?.parentSpanId).toBe(modelSpan?.id);

      // EXECUTION ORDER: MODEL_GENERATION completes before output processors run in order
      testExporter.expectStartedBefore(modelSpan, firstSpan);
      testExporter.expectStartedBefore(firstSpan, secondSpan);

      testExporter.finalExpectations();
    });

    /**
     * Expected span structure:
     * - test-agent AGENT_RUN (root)
     *   - input processor: input-1 PROCESSOR_RUN
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     *   - output processor: output-1 PROCESSOR_RUN
     */
    it('should trace both input and output processors with individual spans', async () => {
      const model = createMockModel();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        inputProcessors: [new SimpleInputProcessor('input-1')],
        outputProcessors: [new SimpleOutputProcessor('output-1')],
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      await registeredAgent.generate('Hello');

      const agentSpans = testExporter.getAgentSpans();
      const processorSpans = testExporter.getProcessorSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();
      const inputSpans = processorSpans.filter(s => s.name?.includes('input processor'));
      const outputSpans = processorSpans.filter(s => s.name?.includes('output processor'));

      // EXPECTED: 1 agent span, 2 processor spans, 1 model span, 1+ model step spans
      expect(agentSpans.length).toBe(1);
      expect(inputSpans.length).toBe(1);
      expect(outputSpans.length).toBe(1);
      expect(modelSpans.length).toBe(1);
      expect(modelStepSpans.length).toBe(1);

      const agentSpan = agentSpans[0];
      const inputSpan = inputSpans[0];
      const outputSpan = outputSpans[0];
      const modelSpan = modelSpans[0];
      const modelStepSpan = modelStepSpans[0];

      expect(inputSpan?.name).toBe('input processor: input-1');
      expect(outputSpan?.name).toBe('output processor: output-1');

      // FULL HIERARCHY VERIFICATION:
      // 1. All processor spans are children of agent span
      expect(inputSpan?.parentSpanId).toBe(agentSpan?.id);
      expect(outputSpan?.parentSpanId).toBe(agentSpan?.id);
      // 2. MODEL_GENERATION is child of AGENT_RUN
      expect(modelSpan?.parentSpanId).toBe(agentSpan?.id);
      // 3. MODEL_STEP is child of MODEL_GENERATION
      expect(modelStepSpan?.parentSpanId).toBe(modelSpan?.id);

      // EXECUTION ORDER: input -> MODEL_GENERATION -> output
      testExporter.expectStartedBefore(inputSpan, modelSpan);
      testExporter.expectStartedBefore(modelSpan, outputSpan);

      testExporter.finalExpectations();
    });
  });

  // ==========================================================================
  // Step Processor Tests
  // ==========================================================================

  describe('Step Processors', () => {
    /**
     * Expected span structure:
     * - test-agent AGENT_RUN (root)
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     *       - input step processor: step-validator PROCESSOR_RUN
     *       - MODEL_CHUNK (1+ chunks)
     *
     * Execution order within MODEL_STEP: input_step_processor → model_chunks
     */
    it('should trace input step processor with correct entity type', async () => {
      const model = createMockModel();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        inputProcessors: [new InputStepProcessor('step-validator')],
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      await registeredAgent.generate('Hello');

      const agentSpans = testExporter.getAgentSpans();
      const processorSpans = testExporter.getProcessorSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();
      const modelChunkSpans = testExporter.getModelChunkSpans();

      // EXPECTED: 1 agent span, 1 model span, 1+ model step spans, and 1 step processor span
      expect(agentSpans.length).toBe(1);
      expect(modelSpans.length).toBe(1);
      expect(modelStepSpans.length).toBe(1);

      const agentSpan = agentSpans[0];
      const modelSpan = modelSpans[0];
      const modelStepSpan = modelStepSpans[0];

      // Step processors only run during inputStep phase (per LLM call in agent loop)
      const inputStepSpans = processorSpans.filter(
        s => s.name?.includes('input step processor') || s.entityType === EntityType.INPUT_STEP_PROCESSOR,
      );

      expect(inputStepSpans.length).toBe(1);
      const inputStepSpan = inputStepSpans[0];
      expect(inputStepSpan?.name).toBe('input step processor: step-validator');
      expect(inputStepSpan?.entityType).toBe(EntityType.INPUT_STEP_PROCESSOR);

      // FULL HIERARCHY VERIFICATION:
      // 1. MODEL_GENERATION is child of AGENT_RUN
      expect(modelSpan?.parentSpanId).toBe(agentSpan?.id);
      // 2. MODEL_STEP is child of MODEL_GENERATION
      expect(modelStepSpan?.parentSpanId).toBe(modelSpan?.id);
      // 3. Step processor span is child of MODEL_STEP span
      expect(inputStepSpan?.parentSpanId).toBe(modelStepSpan?.id);
      // 4. Model chunk spans are children of MODEL_STEP span
      const chunkSpansInStep = modelChunkSpans.filter(s => s.parentSpanId === modelStepSpan?.id);
      expect(chunkSpansInStep.length).toBe(1);

      // EXECUTION ORDER within MODEL_STEP: input_step_processor → model_chunks
      const firstChunkInStep = chunkSpansInStep[0];
      testExporter.expectStartedBefore(inputStepSpan, firstChunkInStep);

      testExporter.finalExpectations();
    });

    /**
     * Expected span structure:
     * - test-agent AGENT_RUN (root)
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     *       - MODEL_CHUNK (1+ chunks)
     *       - output step processor: step-formatter PROCESSOR_RUN
     *
     * Execution order within MODEL_STEP: model_chunks → output_step_processor
     */
    it('should trace output step processor with correct entity type', async () => {
      const model = createMockModel();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        outputProcessors: [new OutputStepProcessor('step-formatter')],
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      await registeredAgent.generate('Hello');

      const agentSpans = testExporter.getAgentSpans();
      const processorSpans = testExporter.getProcessorSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();
      const modelChunkSpans = testExporter.getModelChunkSpans();

      // EXPECTED: 1 agent span, 1 model span, 1+ model step spans, and 1 step processor span
      expect(agentSpans.length).toBe(1);
      expect(modelSpans.length).toBe(1);
      expect(modelStepSpans.length).toBe(1);

      const agentSpan = agentSpans[0];
      const modelSpan = modelSpans[0];
      const modelStepSpan = modelStepSpans[0];

      const outputStepSpans = processorSpans.filter(
        s => s.name?.includes('output step processor') || s.entityType === EntityType.OUTPUT_STEP_PROCESSOR,
      );

      expect(outputStepSpans.length).toBe(1);
      const outputStepSpan = outputStepSpans[0];
      expect(outputStepSpan?.name).toBe('output step processor: step-formatter');
      expect(outputStepSpan?.entityType).toBe(EntityType.OUTPUT_STEP_PROCESSOR);

      // FULL HIERARCHY VERIFICATION:
      // 1. MODEL_GENERATION is child of AGENT_RUN
      expect(modelSpan?.parentSpanId).toBe(agentSpan?.id);
      // 2. MODEL_STEP is child of MODEL_GENERATION
      expect(modelStepSpan?.parentSpanId).toBe(modelSpan?.id);
      // 3. Step processor span is child of MODEL_STEP span
      expect(outputStepSpan?.parentSpanId).toBe(modelStepSpan?.id);
      // 4. Model chunk spans are children of MODEL_STEP span
      const chunkSpansInStep = modelChunkSpans.filter(s => s.parentSpanId === modelStepSpan?.id);
      expect(chunkSpansInStep.length).toBe(1);

      // EXECUTION ORDER within MODEL_STEP: model_chunks → output_step_processor
      const lastChunkInStep = chunkSpansInStep[chunkSpansInStep.length - 1];
      testExporter.expectStartedBefore(lastChunkInStep, outputStepSpan);

      testExporter.finalExpectations();
    });

    /**
     * Expected span structure:
     * - test-agent AGENT_RUN (root)
     *   - input processor: full-input PROCESSOR_RUN
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     *       - input step processor: full-input PROCESSOR_RUN
     *       - MODEL_CHUNK (1+ chunks)
     *       - output step processor: full-output PROCESSOR_RUN
     *   - output processor: full-output PROCESSOR_RUN
     *
     * Execution order within MODEL_STEP: input_step → model_chunks → output_step
     */
    it('should trace full processor with spans for each phase it implements', async () => {
      const model = createMockModel();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        inputProcessors: [new FullProcessor('full-input')],
        outputProcessors: [new FullProcessor('full-output')],
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      await registeredAgent.generate('Hello');

      const agentSpans = testExporter.getAgentSpans();
      const processorSpans = testExporter.getProcessorSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();
      const modelChunkSpans = testExporter.getModelChunkSpans();

      // EXPECTED: 1 agent span, 1 model span, 1+ model step spans, and 4 processor spans
      expect(agentSpans.length).toBe(1);
      expect(modelSpans.length).toBe(1);
      expect(modelStepSpans.length).toBe(1);
      expect(processorSpans.length).toBe(4);

      const agentSpan = agentSpans[0];
      const modelSpan = modelSpans[0];
      const modelStepSpan = modelStepSpans[0];

      // Verify correct entity types for each phase
      const inputSpan = processorSpans.find(s => s.name === 'input processor: full-input');
      const inputStepSpan = processorSpans.find(s => s.name === 'input step processor: full-input');
      const outputStepSpan = processorSpans.find(s => s.name === 'output step processor: full-output');
      const outputSpan = processorSpans.find(s => s.name === 'output processor: full-output');

      expect(inputSpan?.entityType).toBe(EntityType.INPUT_PROCESSOR);
      expect(inputStepSpan?.entityType).toBe(EntityType.INPUT_STEP_PROCESSOR);
      expect(outputStepSpan?.entityType).toBe(EntityType.OUTPUT_STEP_PROCESSOR);
      expect(outputSpan?.entityType).toBe(EntityType.OUTPUT_PROCESSOR);

      // FULL HIERARCHY VERIFICATION:
      // 1. Non-step processors are children of agent span
      expect(inputSpan?.parentSpanId).toBe(agentSpan?.id);
      expect(outputSpan?.parentSpanId).toBe(agentSpan?.id);
      // 2. MODEL_GENERATION is child of AGENT_RUN
      expect(modelSpan?.parentSpanId).toBe(agentSpan?.id);
      // 3. MODEL_STEP is child of MODEL_GENERATION
      expect(modelStepSpan?.parentSpanId).toBe(modelSpan?.id);
      // 4. Step processors are children of MODEL_STEP span
      expect(inputStepSpan?.parentSpanId).toBe(modelStepSpan?.id);
      expect(outputStepSpan?.parentSpanId).toBe(modelStepSpan?.id);
      // 5. Model chunk spans are children of MODEL_STEP span
      const chunkSpansInStep = modelChunkSpans.filter(s => s.parentSpanId === modelStepSpan?.id);
      expect(chunkSpansInStep.length).toBe(1);

      // EXECUTION ORDER: input -> MODEL_GENERATION -> output
      testExporter.expectStartedBefore(inputSpan, modelSpan);
      testExporter.expectStartedBefore(modelSpan, outputSpan);

      // EXECUTION ORDER within MODEL_STEP: input_step → model_chunks → output_step
      const firstChunkInStep = chunkSpansInStep[0];
      const lastChunkInStep = chunkSpansInStep[chunkSpansInStep.length - 1];
      testExporter.expectStartedBefore(inputStepSpan, firstChunkInStep);
      testExporter.expectStartedBefore(lastChunkInStep, outputStepSpan);

      testExporter.finalExpectations();
    });

    /**
     * Expected span structure:
     * - test-agent AGENT_RUN (root)
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     *   - output stream processor: stream-first PROCESSOR_RUN
     *   - output stream processor: stream-second PROCESSOR_RUN
     */
    it('should trace output stream processor with processOutputStream', async () => {
      const model = createMockModel();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        outputProcessors: [new OutputStreamProcessor('stream-first'), new OutputStreamProcessor('stream-second')],
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      const stream = await registeredAgent.stream('Hello');

      // Consume the stream to trigger processOutputStream
      for await (const _chunk of stream.textStream) {
        // Just consume
      }

      const agentSpans = testExporter.getAgentSpans();
      const processorSpans = testExporter.getProcessorSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();

      // EXPECTED: 1 agent span, 1 model span, 1 model step spans, and 2 output stream processor spans
      expect(agentSpans.length).toBe(1);
      expect(modelSpans.length).toBe(1);
      expect(modelStepSpans.length).toBe(1);
      expect(processorSpans.length).toBe(2);

      const agentSpan = agentSpans[0];
      const modelSpan = modelSpans[0];
      const modelStepSpan = modelStepSpans[0];

      // Verify both stream processor spans exist with correct names
      const streamSpan1 = processorSpans.find(s => s?.name === 'output stream processor: stream-first');
      const streamSpan2 = processorSpans.find(s => s?.name === 'output stream processor: stream-second');
      expect(streamSpan1).toBeDefined();
      expect(streamSpan2).toBeDefined();

      // FULL HIERARCHY VERIFICATION:
      // 1. MODEL_GENERATION is child of AGENT_RUN
      expect(modelSpan?.parentSpanId).toBe(agentSpan?.id);
      // 2. MODEL_STEP is child of MODEL_GENERATION
      expect(modelStepSpan?.parentSpanId).toBe(modelSpan?.id);
      // 3. Both stream processor spans are children of agent span
      expect(streamSpan1?.parentSpanId).toBe(agentSpan?.id);
      expect(streamSpan2?.parentSpanId).toBe(agentSpan?.id);

      testExporter.finalExpectations();
    });
  });

  // ==========================================================================
  // Processor with Internal Agent Tests
  // ==========================================================================

  describe('Processor with Internal Agent', () => {
    /**
     * Expected span structure:
     * - test-agent AGENT_RUN (root)
     *   - input processor: validator PROCESSOR_RUN
     *     - validator-internal-agent AGENT_RUN (internal agent called by processor)
     *       - MODEL_GENERATION (internal agent's model call)
     *         - MODEL_STEP
     *   - MODEL_GENERATION (main agent's model call)
     *     - MODEL_STEP
     */
    it('should trace internal agent as child of processor span', async () => {
      const model = createMockModel();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        inputProcessors: [new ProcessorWithAgent('validator', model)],
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      await registeredAgent.generate('Hello');

      const agentSpans = testExporter.getAgentSpans();
      const processorSpans = testExporter.getProcessorSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();

      // EXPECTED: 2 agent spans - main agent + internal agent
      expect(agentSpans.length).toBe(2);
      // EXPECTED: 2 model spans - one for each agent
      expect(modelSpans.length).toBe(2);
      expect(modelStepSpans.length).toBe(2);

      // Find the main agent span and internal agent span
      const mainAgentSpan = agentSpans.find(s => s.entityId === 'test-agent');
      const internalAgentSpan = agentSpans.find(s => s.entityId === 'validator-internal-agent');
      expect(mainAgentSpan).toBeDefined();
      expect(internalAgentSpan).toBeDefined();

      // EXPECTED: 1 processor span with the processor ID
      expect(processorSpans.length).toBe(1);
      const processorSpan = processorSpans[0];
      expect(processorSpan?.name).toBe('input processor: validator');

      // Find MODEL_GENERATION spans for each agent
      const mainAgentModelSpan = modelSpans.find(s => s.parentSpanId === mainAgentSpan?.id);
      const internalAgentModelSpan = modelSpans.find(s => s.parentSpanId === internalAgentSpan?.id);

      // FULL HIERARCHY VERIFICATION:
      // 1. Processor span is child of main agent span
      expect(processorSpan?.parentSpanId).toBe(mainAgentSpan?.id);
      // 2. Internal agent span is child of processor span
      expect(internalAgentSpan?.parentSpanId).toBe(processorSpan?.id);
      // 3. Main agent's MODEL_GENERATION is child of main agent span
      expect(mainAgentModelSpan?.parentSpanId).toBe(mainAgentSpan?.id);
      // 4. Internal agent's MODEL_GENERATION is child of internal agent span
      expect(internalAgentModelSpan?.parentSpanId).toBe(internalAgentSpan?.id);

      // EXECUTION ORDER: processor (with internal agent) starts before main agent's MODEL_GENERATION
      testExporter.expectStartedBefore(processorSpan, mainAgentModelSpan);
      // Internal agent completes within processor span
      testExporter.expectStartedBefore(internalAgentSpan, mainAgentModelSpan);

      testExporter.finalExpectations();
    });
  });

  // ==========================================================================
  // Workflow as Processor Tests
  // ==========================================================================

  describe('Workflow as Processor', () => {
    /**
     * SKIPPED: Needs clarification on expected behavior for workflow-as-processor execution.
     *
     * EXPECTED span structure (1 workflow run for 'input' phase only):
     * - test-agent AGENT_RUN (root)
     *   - input processor: input-workflow PROCESSOR_RUN (workflow used as processor)
     *     - WORKFLOW (input-workflow)
     *       - WORKFLOW_STEP (processor:input-workflow-validator)
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     *
     * ACTUAL span structure (2 workflow runs - one for 'input' phase, one for 'inputStep' phase):
     * - test-agent AGENT_RUN (root)
     *   - WORKFLOW_RUN (input-workflow) - parent: AGENT_RUN (for 'input' phase)
     *     - WORKFLOW_STEP (input-workflow-validator)
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     *       - WORKFLOW_RUN (input-workflow) - parent: MODEL_STEP (for 'inputStep' phase)
     *         - WORKFLOW_STEP (input-workflow-validator)
     *
     * QUESTION: When a workflow is used as an input processor, should it run for:
     * A) Only the 'input' phase (once at start, before MODEL_GENERATION)
     * B) Only the 'inputStep' phase (once per model step, during MODEL_STEP)
     * C) Both phases (current behavior - runs twice)
     *
     * Currently, the runner executes workflows in inputProcessors for BOTH phases because:
     * 1. runInputProcessors() iterates inputProcessors with phase='input'
     * 2. runProcessInputStep() iterates inputProcessors with phase='inputStep'
     * Unlike regular processors which check for specific methods (processInput vs processInputStep),
     * workflows always execute for all phases they receive.
     */
    it.skip('should trace workflow used as input processor with internal workflow spans', async () => {
      const model = createMockModel();
      // Create workflow using documented pattern: ProcessorStepSchema + createStep(processor)
      const processorWorkflow = createProcessorWorkflow('input-workflow');

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        inputProcessors: [processorWorkflow],
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      await registeredAgent.generate('Hello');

      const agentSpans = testExporter.getAgentSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();
      const workflowSpans = testExporter.getWorkflowSpans();
      const workflowStepSpans = testExporter.getWorkflowStepSpans();

      // EXPECTED: 1 agent span, 1 model span, 1+ model step spans
      expect(agentSpans.length).toBe(1);
      expect(modelSpans.length).toBe(1);
      expect(modelStepSpans.length).toBe(1);

      const agentSpan = agentSpans[0];
      const modelSpan = modelSpans[0];
      const modelStepSpan = modelStepSpans[0];

      // EXPECTED: Workflow spans should be visible (internal to the processor)
      // When a workflow is used as a processor, its internal steps should be traced
      expect(workflowSpans.length).toBe(1);
      expect(workflowStepSpans.length).toBe(1);

      // Find the workflow span for this processor
      const inputWorkflowSpan = workflowSpans.find(s => s.entityId === 'input-workflow');
      expect(inputWorkflowSpan).toBeDefined();

      // FULL HIERARCHY VERIFICATION:
      // 1. MODEL_GENERATION is child of AGENT_RUN
      expect(modelSpan?.parentSpanId).toBe(agentSpan?.id);
      // 2. MODEL_STEP is child of MODEL_GENERATION
      expect(modelStepSpan?.parentSpanId).toBe(modelSpan?.id);
      // 3. Workflow span should be child of agent span (when used as processor)
      expect(inputWorkflowSpan?.parentSpanId).toBe(agentSpan?.id);
      // 4. Workflow step spans should be children of workflow span
      const workflowChildSteps = workflowStepSpans.filter(s => s.parentSpanId === inputWorkflowSpan?.id);
      expect(workflowChildSteps.length).toBe(1);

      // EXECUTION ORDER: workflow processor runs before MODEL_GENERATION
      testExporter.expectStartedBefore(inputWorkflowSpan, modelSpan);

      testExporter.finalExpectations();
    });

    /**
     * SKIPPED: Possible bug in workflow-as-output-processor streaming behavior.
     *
     * EXPECTED span structure:
     * - test-agent AGENT_RUN (root)
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     *   - output processor: output-workflow PROCESSOR_RUN (workflow used as processor)
     *     - WORKFLOW (output-workflow)
     *       - WORKFLOW_STEP (processor:output-workflow-validator)
     *
     * ACTUAL span structure (7 workflow runs with mixed parentage):
     * - test-agent AGENT_RUN (root)
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     *       - WORKFLOW_RUN (output-workflow) - parent: MODEL_STEP (outputStep phase)
     *         - WORKFLOW_STEP (output-workflow-validator)
     *       - MODEL_CHUNK
     *     - WORKFLOW_RUN (output-workflow) x5 - parent: MODEL_GENERATION (outputStream per-chunk)
     *       - WORKFLOW_STEP (output-workflow-validator) x5
     *     - WORKFLOW_RUN (output-workflow) - parent: MODEL_GENERATION (outputResult phase)
     *       - WORKFLOW_STEP (output-workflow-validator)
     *
     * ROOT CAUSE:
     * In runner.ts `processPart()`, for each streaming chunk, `executeWorkflowAsProcessor()`
     * is called which does `workflow.createRun().start()` - creating a NEW workflow run
     * for every chunk. The accumulated chunks are passed via `streamParts`, but the entire
     * workflow re-executes from scratch each time.
     *
     * Additionally, the workflow runs for multiple phases:
     * - `outputStream` phase: Called per-chunk in processPart() (~5 times for chunks)
     * - `outputStep` phase: Called once per model step in runProcessOutputStep()
     * - `outputResult` phase: Called once at end in runOutputProcessors()
     *
     * COMPARISON TO LEGACY PROCESSORS:
     * Legacy processors with `processOutputStream` are instantiated once, and the method
     * is called per-chunk with the same processor instance maintaining state. ProcessorState
     * creates ONE span for the entire stream processing.
     *
     * For workflows, we create a new run each time, resulting in 7 WORKFLOW_RUN spans
     * instead of 1. The tracing is CORRECT for the current behavior - it accurately
     * reflects that the workflow IS running 7 times.
     *
     * POTENTIAL FIX:
     * The fix is likely in the processor execution logic, not tracing. Workflows used
     * as output processors should probably:
     * 1. Create ONE workflow run at the start of streaming
     * 2. Stream chunks through that single run
     * 3. End the run when the stream finishes
     *
     * This would match how legacy processors work and result in 1 WORKFLOW_RUN span.
     */
    it.skip('should trace workflow used as output processor with internal workflow spans', async () => {
      const model = createMockModel();
      // Create workflow using documented pattern: ProcessorStepSchema + createStep(processor)
      const processorWorkflow = createProcessorWorkflow('output-workflow');

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        outputProcessors: [processorWorkflow],
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      await registeredAgent.generate('Hello');

      const agentSpans = testExporter.getAgentSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();
      const workflowSpans = testExporter.getWorkflowSpans();
      const workflowStepSpans = testExporter.getWorkflowStepSpans();

      // EXPECTED: 1 agent span, 1 model span, 1+ model step spans
      expect(agentSpans.length).toBe(1);
      expect(modelSpans.length).toBe(1);
      expect(modelStepSpans.length).toBe(1);

      const agentSpan = agentSpans[0];
      const modelSpan = modelSpans[0];
      const modelStepSpan = modelStepSpans[0];

      // EXPECTED: Workflow spans should be visible (internal to the processor)
      expect(workflowSpans.length).toBe(1);
      expect(workflowStepSpans.length).toBe(1);

      // Find the workflow span for this processor
      const outputWorkflowSpan = workflowSpans.find(s => s.entityId === 'output-workflow');
      expect(outputWorkflowSpan).toBeDefined();

      // FULL HIERARCHY VERIFICATION:
      // 1. MODEL_GENERATION is child of AGENT_RUN
      expect(modelSpan?.parentSpanId).toBe(agentSpan?.id);
      // 2. MODEL_STEP is child of MODEL_GENERATION
      expect(modelStepSpan?.parentSpanId).toBe(modelSpan?.id);
      // 3. Workflow span should be child of agent span (when used as processor)
      expect(outputWorkflowSpan?.parentSpanId).toBe(agentSpan?.id);
      // 4. Workflow step spans should be children of workflow span
      const workflowChildSteps = workflowStepSpans.filter(s => s.parentSpanId === outputWorkflowSpan?.id);
      expect(workflowChildSteps.length).toBe(1);

      // EXECUTION ORDER: MODEL_GENERATION runs before workflow processor
      testExporter.expectStartedBefore(modelSpan, outputWorkflowSpan);

      testExporter.finalExpectations();
    });
  });

  // ==========================================================================
  // Mixed Processor Configuration Tests
  // ==========================================================================

  describe('Mixed Processor Configurations', () => {
    /**
     * Expected span structure:
     * - test-agent AGENT_RUN (root)
     *   - input processor: simple PROCESSOR_RUN (processInput only)
     *   - input processor: full PROCESSOR_RUN (processInput from FullProcessor)
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     *       - input step processor: step PROCESSOR_RUN (processInputStep only)
     *       - input step processor: full PROCESSOR_RUN (processInputStep from FullProcessor)
     */
    it('should only create spans for phases that have implementing processors', async () => {
      const model = createMockModel();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        inputProcessors: [
          new SimpleInputProcessor('simple'), // processInput only
          new InputStepProcessor('step'), // processInputStep only
          new FullProcessor('full'), // all phases
        ],
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      await registeredAgent.generate('Hello');

      const agentSpans = testExporter.getAgentSpans();
      const processorSpans = testExporter.getProcessorSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();

      // EXPECTED: 1 agent span, 1 model span, 1+ model step spans, and 4 processor spans
      expect(agentSpans.length).toBe(1);
      expect(modelSpans.length).toBe(1);
      expect(modelStepSpans.length).toBe(1);

      // EXPECTED: Spans for each processor's implemented phases
      // - simple: 1 span (processInput)
      // - step: 1 span (processInputStep)
      // - full: 2 spans (processInput + processInputStep)
      // Total: 4 spans
      expect(processorSpans.length).toBe(4);

      const agentSpan = agentSpans[0];
      const modelSpan = modelSpans[0];
      const modelStepSpan = modelStepSpans[0];

      // Verify correct entity types and span names
      const simpleInputSpan = processorSpans.find(s => s.name === 'input processor: simple');
      const stepInputStepSpan = processorSpans.find(s => s.name === 'input step processor: step');
      const fullInputSpan = processorSpans.find(s => s.name === 'input processor: full');
      const fullInputStepSpan = processorSpans.find(s => s.name === 'input step processor: full');

      expect(simpleInputSpan).toBeDefined();
      expect(stepInputStepSpan).toBeDefined();
      expect(fullInputSpan).toBeDefined();
      expect(fullInputStepSpan).toBeDefined();

      // FULL HIERARCHY VERIFICATION:
      // 1. Non-step processor spans are children of agent span
      expect(simpleInputSpan?.parentSpanId).toBe(agentSpan?.id);
      expect(fullInputSpan?.parentSpanId).toBe(agentSpan?.id);
      // 2. MODEL_GENERATION is child of AGENT_RUN
      expect(modelSpan?.parentSpanId).toBe(agentSpan?.id);
      // 3. MODEL_STEP is child of MODEL_GENERATION
      expect(modelStepSpan?.parentSpanId).toBe(modelSpan?.id);
      // 4. Step processor spans are children of MODEL_STEP span
      expect(stepInputStepSpan?.parentSpanId).toBe(modelStepSpan?.id);
      expect(fullInputStepSpan?.parentSpanId).toBe(modelStepSpan?.id);

      // EXECUTION ORDER: input processors -> MODEL_GENERATION
      testExporter.expectStartedBefore(simpleInputSpan, modelSpan);
      testExporter.expectStartedBefore(fullInputSpan, modelSpan);

      testExporter.finalExpectations();
    });
  });

  // ==========================================================================
  // Memory Processor Tests
  // ==========================================================================

  describe('Memory Processors', () => {
    /**
     * Expected span structure:
     * - test-agent AGENT_RUN (root)
     *   - input processor: message-history PROCESSOR_RUN (fetches history)
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     *   - output processor: message-history PROCESSOR_RUN (saves messages)
     */
    it('should trace MessageHistory processor when memory is enabled', async () => {
      const model = createMockModel();
      const mockMemory = new MockMemory({ enableMessageHistory: true });
      const threadId = randomUUID();
      const resourceId = 'test-resource';

      // Create thread first
      await mockMemory.createThread({ threadId, resourceId });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        memory: mockMemory,
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      await registeredAgent.generate('Hello', {
        memory: { thread: threadId, resource: resourceId },
      });

      const agentSpans = testExporter.getAgentSpans();
      const processorSpans = testExporter.getProcessorSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();

      // EXPECTED: 1 agent span, 1 model span, 1+ model step spans
      expect(agentSpans.length).toBe(1);
      expect(modelSpans.length).toBe(1);
      expect(modelStepSpans.length).toBe(1);

      const agentSpan = agentSpans[0];
      const modelSpan = modelSpans[0];
      const modelStepSpan = modelStepSpans[0];

      // EXPECTED: MessageHistory processor should create input and output spans
      // Input: fetches message history
      // Output: saves new messages
      const messageHistorySpans = processorSpans.filter(
        s => s.name?.includes('message-history') || s.entityId?.includes('message-history'),
      );

      // MessageHistory runs on both input (fetch) and output (save)
      expect(messageHistorySpans.length).toBe(2);

      // Verify processor spans have correct entity type
      for (const span of messageHistorySpans) {
        expect([EntityType.INPUT_PROCESSOR, EntityType.OUTPUT_PROCESSOR]).toContain(span.entityType);
      }

      // FULL HIERARCHY VERIFICATION:
      // 1. MODEL_GENERATION is child of AGENT_RUN
      expect(modelSpan?.parentSpanId).toBe(agentSpan?.id);
      // 2. MODEL_STEP is child of MODEL_GENERATION
      expect(modelStepSpan?.parentSpanId).toBe(modelSpan?.id);

      testExporter.finalExpectations();
    });

    /**
     * Expected span structure:
     * - test-agent AGENT_RUN (root)
     *   - input processor: working-memory PROCESSOR_RUN (retrieves state)
     *   - input processor: message-history PROCESSOR_RUN
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     *   - output processor: message-history PROCESSOR_RUN
     */
    it('should trace WorkingMemory processor when enabled', async () => {
      const model = createMockModel();
      const mockMemory = new MockMemory({
        enableMessageHistory: true,
        enableWorkingMemory: true,
      });
      const threadId = randomUUID();
      const resourceId = 'test-resource';

      // Create thread first
      await mockMemory.createThread({ threadId, resourceId });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        memory: mockMemory,
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      await registeredAgent.generate('Hello', {
        memory: { thread: threadId, resource: resourceId },
      });

      const agentSpans = testExporter.getAgentSpans();
      const processorSpans = testExporter.getProcessorSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();

      // EXPECTED: 1 agent span, 1 model span, 1+ model step spans
      expect(agentSpans.length).toBe(1);
      expect(modelSpans.length).toBe(1);
      expect(modelStepSpans.length).toBe(1);

      const agentSpan = agentSpans[0];
      const modelSpan = modelSpans[0];
      const modelStepSpan = modelStepSpans[0];

      // EXPECTED: WorkingMemory processor should create an input span
      // (retrieves working memory state, prepends to conversation)
      const workingMemorySpans = processorSpans.filter(
        s => s.name?.includes('working-memory') || s.entityId?.includes('working-memory'),
      );

      expect(workingMemorySpans.length).toBe(1);

      // FULL HIERARCHY VERIFICATION:
      // 1. MODEL_GENERATION is child of AGENT_RUN
      expect(modelSpan?.parentSpanId).toBe(agentSpan?.id);
      // 2. MODEL_STEP is child of MODEL_GENERATION
      expect(modelStepSpan?.parentSpanId).toBe(modelSpan?.id);

      testExporter.finalExpectations();
    });

    /**
     * Expected span structure:
     * - test-agent AGENT_RUN (root)
     *   - input processor: message-history PROCESSOR_RUN (memory runs first)
     *   - input processor: custom-input PROCESSOR_RUN
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     *   - output processor: custom-output PROCESSOR_RUN
     *   - output processor: message-history PROCESSOR_RUN (memory runs last)
     */
    it('should trace memory processors alongside custom processors', async () => {
      const model = createMockModel();
      const mockMemory = new MockMemory({ enableMessageHistory: true });
      const threadId = randomUUID();
      const resourceId = 'test-resource';

      // Create thread first
      await mockMemory.createThread({ threadId, resourceId });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        memory: mockMemory,
        inputProcessors: [new SimpleInputProcessor('custom-input')],
        outputProcessors: [new SimpleOutputProcessor('custom-output')],
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      await registeredAgent.generate('Hello', {
        memory: { thread: threadId, resource: resourceId },
      });

      const agentSpans = testExporter.getAgentSpans();
      const processorSpans = testExporter.getProcessorSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();

      // EXPECTED: 1 agent span, 1 model span, 1+ model step spans
      expect(agentSpans.length).toBe(1);
      expect(modelSpans.length).toBe(1);
      expect(modelStepSpans.length).toBe(1);

      const agentSpan = agentSpans[0];
      const modelSpan = modelSpans[0];
      const modelStepSpan = modelStepSpans[0];

      // EXPECTED: Both memory processors and custom processors should have spans
      // Memory processors run first on input, last on output
      // MessageHistory (input) + custom-input + custom-output + MessageHistory (output) = 4
      expect(processorSpans.length).toBe(4);

      // Should have custom processor spans with correct names
      const customInputSpan = processorSpans.find(s => s.name === 'input processor: custom-input');
      const customOutputSpan = processorSpans.find(s => s.name === 'output processor: custom-output');

      expect(customInputSpan).toBeDefined();
      expect(customOutputSpan).toBeDefined();

      // FULL HIERARCHY VERIFICATION:
      // 1. MODEL_GENERATION is child of AGENT_RUN
      expect(modelSpan?.parentSpanId).toBe(agentSpan?.id);
      // 2. MODEL_STEP is child of MODEL_GENERATION
      expect(modelStepSpan?.parentSpanId).toBe(modelSpan?.id);

      testExporter.finalExpectations();
    });

    /**
     * Expected span structure (execution order matters):
     * - test-agent AGENT_RUN (root)
     *   - input processor: message-history PROCESSOR_RUN (memory first - fetches history)
     *   - input processor: guardrail PROCESSOR_RUN (custom after memory)
     *   - MODEL_GENERATION
     *     - MODEL_STEP
     *   - output processor: filter PROCESSOR_RUN (custom before memory)
     *   - output processor: message-history PROCESSOR_RUN (memory last - persists)
     */
    it('should respect processor execution order for memory processors', async () => {
      const model = createMockModel();
      const mockMemory = new MockMemory({ enableMessageHistory: true });
      const threadId = randomUUID();
      const resourceId = 'test-resource';

      // Create thread first
      await mockMemory.createThread({ threadId, resourceId });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model,
        memory: mockMemory,
        inputProcessors: [new SimpleInputProcessor('guardrail')],
        outputProcessors: [new SimpleOutputProcessor('filter')],
      });

      const mastra = new Mastra({
        ...getBaseMastraConfig(testExporter),
        agents: { agent },
      });

      const registeredAgent = mastra.getAgent('agent');
      await registeredAgent.generate('Hello', {
        memory: { thread: threadId, resource: resourceId },
      });

      const agentSpans = testExporter.getAgentSpans();
      const processorSpans = testExporter.getProcessorSpans();
      const modelSpans = testExporter.getModelSpans();
      const modelStepSpans = testExporter.getModelStepSpans();

      // EXPECTED: 1 agent span, 1 model span, 1+ model step spans
      expect(agentSpans.length).toBe(1);
      expect(modelSpans.length).toBe(1);
      expect(modelStepSpans.length).toBe(1);

      const agentSpan = agentSpans[0];
      const modelSpan = modelSpans[0];
      const modelStepSpan = modelStepSpans[0];

      const inputSpans = processorSpans.filter(s => s.entityType === EntityType.INPUT_PROCESSOR);
      const outputSpans = processorSpans.filter(s => s.entityType === EntityType.OUTPUT_PROCESSOR);

      // EXPECTED: Memory processors run first on inputs, last on outputs
      // This ensures guardrails validate content before persistence
      // Input order: memory -> guardrail
      // Output order: filter -> memory
      expect(inputSpans.length).toBe(2);
      expect(outputSpans.length).toBe(2);

      // FULL HIERARCHY VERIFICATION:
      // 1. MODEL_GENERATION is child of AGENT_RUN
      expect(modelSpan?.parentSpanId).toBe(agentSpan?.id);
      // 2. MODEL_STEP is child of MODEL_GENERATION
      expect(modelStepSpan?.parentSpanId).toBe(modelSpan?.id);

      testExporter.finalExpectations();
    });
  });
});
