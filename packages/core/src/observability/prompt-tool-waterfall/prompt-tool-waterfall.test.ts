import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent/agent';
import { MessageList } from '../../agent/message-list';
import { MockMemory } from '../../memory/mock';
import type { Processor } from '../../processors';
import { ProcessorStepInputSchema, ProcessorStepOutputSchema } from '../../processors/step-schema';
import { createTool } from '../../tools';
import { createStep, createWorkflow } from '../../workflows';
import { PromptToolWaterfallRecorder } from './recorder';
import { summarizePromptAndTools } from './summarize';
import type { PromptToolWaterfall } from './types';

describe('PromptToolWaterfallRecorder', () => {
  it('records ordered summary-only phases and deltas', () => {
    const recorder = new PromptToolWaterfallRecorder({ runId: 'run-waterfall' });
    const initial = summarizePromptAndTools({
      prompt: [{ role: 'user', content: 'PRIVATE_USER_PROMPT' }],
      tools: {
        lookup: {
          id: 'lookup',
          name: 'lookup',
          description: 'PRIVATE_TOOL_DESCRIPTION',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'PRIVATE_SCHEMA_TEXT' },
            },
          },
        },
      },
      toolChoice: 'auto',
    });
    const processed = summarizePromptAndTools({
      prompt: [
        { role: 'system', content: 'PRIVATE_SYSTEM_PROMPT' },
        { role: 'user', content: 'PRIVATE_USER_PROMPT with context' },
      ],
      tools: {
        lookup: { id: 'lookup', name: 'lookup', parameters: { type: 'object' } },
        calculate: { id: 'calculate', name: 'calculate', inputSchema: { type: 'object' } },
      },
      toolChoice: { type: 'tool', toolName: 'calculate' },
      activeTools: ['lookup', 'calculate'],
    });
    const structured = summarizePromptAndTools({
      prompt: [
        { role: 'system', content: 'PRIVATE_SYSTEM_PROMPT structured output instruction' },
        { role: 'user', content: 'PRIVATE_USER_PROMPT with context' },
      ],
      tools: processed.toolSurface.tools.reduce<Record<string, unknown>>((acc, tool) => {
        acc[tool.name] = { id: tool.id, name: tool.name };
        return acc;
      }, {}),
      toolChoice: { type: 'tool', toolName: 'calculate' },
      activeTools: ['lookup', 'calculate'],
    });

    recorder.recordPhase({ kind: 'initial', stepIndex: 0, ...initial });
    recorder.recordPhase({ kind: 'input_processors', stepIndex: 0, ...processed });
    recorder.recordPhase({
      kind: 'structured_output',
      stepIndex: 0,
      ...structured,
      structuredOutput: { mode: 'direct', mutated: true },
    });

    const payload = recorder.finalize({ status: 'finished' });

    expect(payload).toMatchObject({
      runId: 'run-waterfall',
      status: 'finished',
      stepCount: 1,
    });
    expect(payload.phases.map(phase => phase.kind)).toEqual(['initial', 'input_processors', 'structured_output']);
    expect(payload.finalPrompt).toEqual(structured.prompt);
    expect(payload.finalToolSurface).toEqual(structured.toolSurface);
    expect(payload.phases[1].delta.promptCharsDelta).toBeGreaterThan(0);
    expect(payload.phases[1].delta.toolsAdded).toEqual(['calculate']);
    expect(payload.phases[1].delta.toolChoiceChanged).toBe(true);
    expect(payload.phases[2].delta.structuredOutput).toEqual({ mode: 'direct', mutated: true });

    const serializedPayload = JSON.stringify(payload);
    expect(serializedPayload).not.toContain('PRIVATE_USER_PROMPT');
    expect(serializedPayload).not.toContain('PRIVATE_SYSTEM_PROMPT');
    expect(serializedPayload).not.toContain('PRIVATE_TOOL_DESCRIPTION');
    expect(serializedPayload).not.toContain('PRIVATE_SCHEMA_TEXT');
  });

  it('emits one child span with the finalized payload', () => {
    const recorder = new PromptToolWaterfallRecorder({ runId: 'run-span' });
    const phase = summarizePromptAndTools({
      prompt: [{ role: 'user', content: 'hidden prompt' }],
      tools: {},
    });
    const childEnd = vi.fn();
    const createChildSpan = vi.fn(() => ({ end: childEnd }));
    const agentSpan = {
      isValid: true,
      entityId: 'agent-id',
      entityName: 'agent-name',
      createChildSpan,
    };

    recorder.recordPhase({ kind: 'pre_model', stepIndex: 0, ...phase });
    const payload = recorder.finalizeSpan({
      agentSpan: agentSpan as never,
      status: 'tripwire',
      tripwire: { reason: 'blocked' },
    });
    recorder.finalizeSpan({ agentSpan: agentSpan as never, status: 'finished' });

    expect(payload.status).toBe('tripwire');
    expect(payload.tripwire).toEqual({ reasonChars: 'blocked'.length });
    expect(createChildSpan).toHaveBeenCalledTimes(1);
    expect(createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'prompt_tool_waterfall',
        attributes: { waterfall: payload },
      }),
    );
    expect(childEnd).toHaveBeenCalledWith({ output: payload });
  });

  it('normalizes error finalization', () => {
    const recorder = new PromptToolWaterfallRecorder({ runId: 'run-error' });

    const payload = recorder.finalize({
      status: 'error',
      error: new TypeError('model failed'),
    });

    expect(payload.status).toBe('error');
    expect(payload.error).toEqual({ name: 'TypeError', messageChars: 'model failed'.length });
  });

  it('summarizes MessageList system messages and converted schema sizes without leaking schema text', () => {
    const messageList = new MessageList();
    messageList.addSystem('PRIVATE_SYSTEM_SUMMARY_TEXT');
    messageList.add([{ role: 'user', content: 'PRIVATE_USER_SUMMARY_TEXT' }], 'input');

    const summary = summarizePromptAndTools({
      prompt: messageList,
      tools: {
        lookup: {
          id: 'lookup',
          name: 'lookup',
          inputSchema: z.object({
            query: z.string().describe('PRIVATE_SCHEMA_DESCRIPTION'),
          }),
          outputSchema: z.object({
            result: z.string(),
          }),
        },
      },
    });

    expect(summary.prompt.messageCount).toBe(2);
    expect(summary.prompt.charsByRole.system).toBe('PRIVATE_SYSTEM_SUMMARY_TEXT'.length);
    expect(summary.toolSurface.tools[0]?.inputSchemaChars).toBeGreaterThan(2);
    expect(summary.toolSurface.tools[0]?.outputSchemaChars).toBeGreaterThan(2);
    expect(JSON.stringify(summary)).not.toContain('PRIVATE_SCHEMA_DESCRIPTION');
    expect(JSON.stringify(summary)).not.toContain('PRIVATE_SYSTEM_SUMMARY_TEXT');
    expect(JSON.stringify(summary)).not.toContain('PRIVATE_USER_SUMMARY_TEXT');
  });
});

describe('PromptToolWaterfall agent integration', () => {
  function createMockModelSpanTracker(span: any) {
    return {
      getTracingContext: vi.fn(() => ({ currentSpan: span })),
      reportGenerationError: vi.fn(),
      endGeneration: vi.fn(),
      updateGeneration: vi.fn(),
      updateStep: vi.fn(),
      wrapStream: vi.fn(<T>(stream: T) => stream),
      startStep: vi.fn(),
    };
  }

  function createMockSpan(options: { type?: string; name?: string }, parentSpan?: any) {
    const children: any[] = [];
    const span: Record<string, any> = {
      id: `mock-${options.type ?? options.name ?? 'span'}-${Math.random()}`,
      traceId: 'mock-trace-id',
      name: options.name ?? options.type,
      type: options.type ?? options.name,
      entityId: 'agent-id',
      entityName: 'agent-name',
      startTime: new Date(),
      isInternal: false,
      isEvent: false,
      isValid: true,
      isRootSpan: !parentSpan,
      parent: parentSpan,
      children,
      createOptions: options,

      end: vi.fn(),
      error: vi.fn(),
      update: vi.fn(),
      exportSpan: vi.fn(),
      getParentSpanId: vi.fn(() => parentSpan?.id),
      findParent: vi.fn((type: string) => {
        let current = span;
        while (current) {
          if (current.type === type) {
            return current;
          }
          current = current.parent;
        }
        return undefined;
      }),
      executeInContext: vi.fn(async (fn: () => Promise<unknown>) => fn()),
      executeInContextSync: vi.fn((fn: () => unknown) => fn()),
      get externalTraceId() {
        return 'mock-trace-id';
      },

      createTracker: vi.fn(() => createMockModelSpanTracker(span)),
      createChildSpan: vi.fn((childOptions: { type?: string; name?: string }) => {
        const child = createMockSpan(childOptions, span);
        children.push(child);
        return child;
      }),
      createEventSpan: vi.fn((childOptions: { type?: string; name?: string }) => {
        const child = createMockSpan(childOptions, span);
        children.push(child);
        return child;
      }),
      getCorrelationContext: vi.fn(),
      observabilityInstance: {} as any,
    };

    return span;
  }

  async function mockGetOrCreateSpan() {
    let agentRunSpan: any;
    const mod = await import('../utils');
    const spy = vi.spyOn(mod, 'getOrCreateSpan').mockImplementation((options: any) => {
      const span = createMockSpan({ type: options.type, name: options.name });
      if (options.type === 'agent_run') {
        agentRunSpan = span;
      }
      return span as any;
    });

    return { spy, getAgentRunSpan: () => agentRunSpan };
  }

  function getWaterfallPayload(agentSpan: any): PromptToolWaterfall {
    const waterfallSpans = agentSpan.children.filter((span: any) => span.type === 'prompt_tool_waterfall');
    expect(waterfallSpans).toHaveLength(1);
    expect(waterfallSpans[0].createOptions.attributes.waterfall).toEqual(waterfallSpans[0].end.mock.calls[0][0].output);
    return waterfallSpans[0].end.mock.calls[0][0].output;
  }

  it('emits a summary-only waterfall span for a vNext agent run with processors, prepareStep, tools, and structured output', async () => {
    const { spy, getAgentRunSpan } = await mockGetOrCreateSpan();

    try {
      let generateCalls = 0;
      const model = new MockLanguageModelV2({
        doGenerate: async () => {
          generateCalls++;
          if (generateCalls === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
              content: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-waterfall-1',
                  toolName: 'privateLookup',
                  input: JSON.stringify({ query: 'PRIVATE_TOOL_INPUT' }),
                },
              ],
              warnings: [],
            };
          }

          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
            content: [{ type: 'text', text: JSON.stringify({ answer: 'done' }) }],
            warnings: [],
          };
        },
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: JSON.stringify({ answer: 'done' }) },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 } },
          ]),
        }),
      });

      const privateLookup = createTool({
        id: 'privateLookup',
        description: 'PRIVATE_TOOL_DESCRIPTION',
        inputSchema: z.object({
          query: z.string().describe('PRIVATE_SCHEMA_TEXT'),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
        execute: async () => ({ result: 'PRIVATE_TOOL_OUTPUT' }),
      });
      const privateArchive = createTool({
        id: 'privateArchive',
        description: 'PRIVATE_ARCHIVE_TOOL_DESCRIPTION',
        inputSchema: z.object({
          archiveId: z.string().describe('PRIVATE_ARCHIVE_SCHEMA_TEXT'),
        }),
        outputSchema: z.object({
          record: z.string(),
        }),
        execute: async () => ({ record: 'PRIVATE_ARCHIVE_OUTPUT' }),
      });

      const processor: Processor = {
        id: 'waterfall-processor',
        processInputStep: async ({ messageList }) => {
          messageList.addSystem('PRIVATE_PROCESSOR_CONTEXT');
          return {
            activeTools: ['privateLookup', 'privateArchive'],
          };
        },
      };
      const toolNarrowingProcessor: Processor = {
        id: 'tool-narrowing-processor',
        processInputStep: async () => ({
          activeTools: ['privateLookup'],
        }),
      };

      const agent = new Agent({
        id: 'waterfall-agent',
        name: 'Waterfall Agent',
        instructions: 'PRIVATE_SYSTEM_PROMPT',
        model,
        tools: { privateLookup, privateArchive },
      });

      const result = await agent.generate('PRIVATE_USER_PROMPT', {
        inputProcessors: [processor, toolNarrowingProcessor],
        prepareStep: async ({ stepNumber }) =>
          stepNumber === 1
            ? {
                toolChoice: 'none',
                structuredOutput: {
                  schema: z.object({ answer: z.string() }),
                  jsonPromptInjection: true,
                },
              }
            : {},
        modelSettings: { maxRetries: 0 },
      });

      expect(result.object).toEqual({ answer: 'done' });
      expect(result.promptWaterfall).toBeDefined();

      const waterfall = getWaterfallPayload(getAgentRunSpan());
      expect(result.promptWaterfall).toEqual(waterfall);
      const phaseKinds = waterfall.phases.map(phase => phase.kind);

      expect(waterfall.status).toBe('finished');
      expect(waterfall.stepCount).toBe(2);
      expect(waterfall.phases.map(phase => ({ kind: phase.kind, stepIndex: phase.stepIndex }))).toEqual([
        { kind: 'initial', stepIndex: 0 },
        { kind: 'input_processors', stepIndex: 0 },
        { kind: 'input_processors', stepIndex: 0 },
        { kind: 'prepare_step', stepIndex: 0 },
        { kind: 'pre_model', stepIndex: 0 },
        { kind: 'input_processors', stepIndex: 1 },
        { kind: 'input_processors', stepIndex: 1 },
        { kind: 'prepare_step', stepIndex: 1 },
        { kind: 'pre_model', stepIndex: 1 },
        { kind: 'structured_output', stepIndex: 1 },
      ]);
      expect(phaseKinds).toEqual(
        expect.arrayContaining(['initial', 'input_processors', 'prepare_step', 'pre_model', 'structured_output']),
      );
      expect(waterfall.finalPrompt?.messageCount).toBeGreaterThan(0);
      expect(waterfall.finalToolSurface?.tools.map(tool => tool.name)).toContain('privateLookup');
      const inputProcessorPhases = waterfall.phases.filter(phase => phase.kind === 'input_processors');
      expect(inputProcessorPhases.map(phase => phase.meta)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ processorId: 'waterfall-processor' }),
          expect.objectContaining({ processorId: 'tool-narrowing-processor' }),
        ]),
      );
      const processorToolPhase = inputProcessorPhases.find(
        phase => phase.meta?.processorId === 'waterfall-processor' && phase.stepIndex === 0,
      );
      const processorPromptPhase = inputProcessorPhases.find(
        phase => phase.meta?.processorId === 'waterfall-processor' && phase.delta.promptCharsDelta > 0,
      );
      const toolNarrowingPhase = inputProcessorPhases.find(
        phase => phase.meta?.processorId === 'tool-narrowing-processor',
      );
      const prepareStepPhase = waterfall.phases.find(
        phase => phase.kind === 'prepare_step' && phase.stepIndex === 1 && phase.meta?.processorId === 'prepare-step',
      );
      expect(processorPromptPhase?.delta.promptCharsDelta).toBeGreaterThan(0);
      expect(processorToolPhase?.delta.activeToolsAdded).toEqual(['privateLookup', 'privateArchive']);
      expect(toolNarrowingPhase?.delta.activeToolsRemoved).toEqual(['privateArchive']);
      expect(toolNarrowingPhase?.toolSurface.activeTools).toEqual(['privateLookup']);
      expect(prepareStepPhase?.delta.toolChoiceChanged).toBe(true);
      expect(waterfall.phases.find(phase => phase.kind === 'structured_output')?.delta.structuredOutput).toEqual({
        mode: 'direct',
        mutated: true,
      });

      const serializedPayload = JSON.stringify(waterfall);
      expect(serializedPayload).not.toContain('PRIVATE_USER_PROMPT');
      expect(serializedPayload).not.toContain('PRIVATE_SYSTEM_PROMPT');
      expect(serializedPayload).not.toContain('PRIVATE_PROCESSOR_CONTEXT');
      expect(serializedPayload).not.toContain('PRIVATE_TOOL_DESCRIPTION');
      expect(serializedPayload).not.toContain('PRIVATE_SCHEMA_TEXT');
      expect(serializedPayload).not.toContain('PRIVATE_TOOL_INPUT');
      expect(serializedPayload).not.toContain('PRIVATE_TOOL_OUTPUT');
      expect(serializedPayload).not.toContain('PRIVATE_ARCHIVE_TOOL_DESCRIPTION');
      expect(serializedPayload).not.toContain('PRIVATE_ARCHIVE_SCHEMA_TEXT');
      expect(serializedPayload).not.toContain('PRIVATE_ARCHIVE_OUTPUT');
    } finally {
      spy.mockRestore();
    }
  });

  it('records nested processor workflow steps as workflow-executed processor phases', async () => {
    const { spy, getAgentRunSpan } = await mockGetOrCreateSpan();

    try {
      const model = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 },
          content: [{ type: 'text', text: 'workflow complete' }],
          warnings: [],
        }),
      });

      const privateLookup = createTool({
        id: 'privateLookup',
        description: 'PRIVATE_WORKFLOW_TOOL_DESCRIPTION',
        inputSchema: z.object({
          query: z.string().describe('PRIVATE_WORKFLOW_SCHEMA_TEXT'),
        }),
        execute: async () => ({ result: 'PRIVATE_WORKFLOW_TOOL_OUTPUT' }),
      });
      const privateArchive = createTool({
        id: 'privateArchive',
        description: 'PRIVATE_WORKFLOW_ARCHIVE_DESCRIPTION',
        inputSchema: z.object({
          archiveId: z.string(),
        }),
        execute: async () => ({ record: 'PRIVATE_WORKFLOW_ARCHIVE_OUTPUT' }),
      });

      const workflowContextProcessor: Processor = {
        id: 'workflow-context',
        processInputStep: async ({ systemMessages }) => {
          return {
            systemMessages: [...systemMessages, { role: 'system', content: 'PRIVATE_NESTED_WORKFLOW_CONTEXT' }],
            activeTools: ['privateLookup', 'privateArchive'],
          };
        },
      };
      const workflowToolNarrowingProcessor: Processor = {
        id: 'workflow-tool-narrowing',
        processInputStep: async () => ({
          activeTools: ['privateLookup'],
        }),
      };

      const innerWorkflow = createWorkflow({
        id: 'inner-waterfall-workflow',
        inputSchema: ProcessorStepInputSchema,
        outputSchema: ProcessorStepOutputSchema,
      })
        .then(createStep(workflowContextProcessor))
        .commit();
      const outerWorkflow = createWorkflow({
        id: 'outer-waterfall-workflow',
        inputSchema: ProcessorStepInputSchema,
        outputSchema: ProcessorStepOutputSchema,
      })
        .then(createStep(innerWorkflow))
        .then(createStep(workflowToolNarrowingProcessor))
        .commit();

      const agent = new Agent({
        id: 'nested-workflow-waterfall-agent',
        name: 'Nested Workflow Waterfall Agent',
        instructions: 'PRIVATE_NESTED_WORKFLOW_SYSTEM',
        model,
        tools: { privateLookup, privateArchive },
        inputProcessors: [outerWorkflow],
      });

      const result = await agent.generate('PRIVATE_NESTED_WORKFLOW_USER', {
        modelSettings: { maxRetries: 0 },
      });

      expect(result.promptWaterfall).toBeDefined();
      const waterfall = getWaterfallPayload(getAgentRunSpan());
      expect(result.promptWaterfall).toEqual(waterfall);

      const workflowPhases = waterfall.phases.filter(phase => phase.meta?.processorExecutor === 'workflow');
      expect(workflowPhases.map(phase => phase.meta?.processorId)).toEqual([
        'workflow-context',
        'workflow-tool-narrowing',
      ]);
      expect(workflowPhases.map(phase => phase.meta)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            processorId: 'workflow-context',
            processorWorkflowId: 'outer-waterfall-workflow',
            processorStepId: 'inner-waterfall-workflow.processor:workflow-context',
            processorStepIndex: 0,
            processorStepStatus: 'success',
          }),
          expect.objectContaining({
            processorId: 'workflow-tool-narrowing',
            processorWorkflowId: 'outer-waterfall-workflow',
            processorStepId: 'processor:workflow-tool-narrowing',
          }),
        ]),
      );

      const nestedContextPhase = workflowPhases.find(
        phase => phase.meta?.processorId === 'workflow-context' && phase.delta.promptCharsDelta > 0,
      );
      const toolNarrowingPhase = workflowPhases.find(
        phase => phase.meta?.processorId === 'workflow-tool-narrowing' && phase.delta.activeToolsRemoved.length > 0,
      );

      expect(nestedContextPhase?.delta.promptCharsDelta).toBeGreaterThan(0);
      expect(nestedContextPhase?.delta.activeToolsAdded).toEqual(['privateLookup', 'privateArchive']);
      expect(toolNarrowingPhase?.delta.activeToolsRemoved).toEqual(['privateArchive']);

      const serializedPayload = JSON.stringify(waterfall);
      expect(serializedPayload).not.toContain('PRIVATE_NESTED_WORKFLOW_CONTEXT');
      expect(serializedPayload).not.toContain('PRIVATE_NESTED_WORKFLOW_SYSTEM');
      expect(serializedPayload).not.toContain('PRIVATE_NESTED_WORKFLOW_USER');
      expect(serializedPayload).not.toContain('PRIVATE_WORKFLOW_TOOL_DESCRIPTION');
      expect(serializedPayload).not.toContain('PRIVATE_WORKFLOW_SCHEMA_TEXT');
      expect(serializedPayload).not.toContain('PRIVATE_WORKFLOW_TOOL_OUTPUT');
    } finally {
      spy.mockRestore();
    }
  });

  it('records native structured output without a prompt mutation', async () => {
    const { spy, getAgentRunSpan } = await mockGetOrCreateSpan();

    try {
      const model = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
          content: [{ type: 'text', text: JSON.stringify({ answer: 'native' }) }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: JSON.stringify({ answer: 'native' }) },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 } },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'waterfall-native-structured-output-agent',
        name: 'Waterfall Native Structured Output Agent',
        instructions: 'Return structured output.',
        model,
      });

      const result = await agent.generate('Return a structured answer', {
        structuredOutput: {
          schema: z.object({ answer: z.string() }),
        },
        modelSettings: { maxRetries: 0 },
      });

      expect(result.object).toEqual({ answer: 'native' });
      expect(result.promptWaterfall).toBeDefined();
      const waterfall = getWaterfallPayload(getAgentRunSpan());
      expect(result.promptWaterfall).toEqual(waterfall);

      expect(waterfall.phases.find(phase => phase.kind === 'structured_output')?.delta.structuredOutput).toEqual({
        mode: 'native',
        mutated: false,
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('returns promptWaterfall from generate without requiring span inspection', async () => {
    const model = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
        content: [{ type: 'text', text: 'plain text' }],
        warnings: [],
      }),
    });
    const agent = new Agent({
      id: 'waterfall-public-result-agent',
      name: 'Waterfall Public Result Agent',
      instructions: 'PRIVATE_PUBLIC_RESULT_SYSTEM_PROMPT',
      model,
    });

    const result = await agent.generate('PRIVATE_PUBLIC_RESULT_USER_PROMPT', { modelSettings: { maxRetries: 0 } });

    expect(result.text).toBe('plain text');
    expect(result.promptWaterfall?.status).toBe('finished');
    expect(result.promptWaterfall?.phases.map(phase => phase.kind)).toEqual(['initial', 'pre_model']);
    expect(JSON.stringify(result.promptWaterfall)).not.toContain('PRIVATE_PUBLIC_RESULT_SYSTEM_PROMPT');
    expect(JSON.stringify(result.promptWaterfall)).not.toContain('PRIVATE_PUBLIC_RESULT_USER_PROMPT');
  });

  it('does not add promptWaterfall to legacy generate results', async () => {
    const model = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1 },
        text: 'legacy text',
      }),
    });
    const agent = new Agent({
      id: 'waterfall-legacy-agent',
      name: 'Waterfall Legacy Agent',
      instructions: 'PRIVATE_LEGACY_SYSTEM_PROMPT',
      model,
    });

    const result = await agent.generateLegacy('PRIVATE_LEGACY_USER_PROMPT');

    expect(result.text).toBe('legacy text');
    expect(result).not.toHaveProperty('promptWaterfall');
  });

  it('returns promptWaterfall from stream getFullOutput without no-op processor phases', async () => {
    const { spy, getAgentRunSpan } = await mockGetOrCreateSpan();

    try {
      const model = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-stream', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'stream text' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 } },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'waterfall-stream-agent',
        name: 'Waterfall Stream Agent',
        instructions: 'PRIVATE_STREAM_SYSTEM_PROMPT',
        model,
      });

      const stream = await agent.stream('PRIVATE_STREAM_USER_PROMPT', { modelSettings: { maxRetries: 0 } });
      const fullOutput = await stream.getFullOutput();
      const waterfall = getWaterfallPayload(getAgentRunSpan());

      expect(fullOutput.promptWaterfall).toEqual(waterfall);
      expect(stream.promptWaterfall).toEqual(waterfall);
      expect(waterfall.status).toBe('finished');
      expect(waterfall.phases.map(phase => phase.kind)).toEqual(['initial', 'pre_model']);
      expect(JSON.stringify(waterfall)).not.toContain('PRIVATE_STREAM_SYSTEM_PROMPT');
      expect(JSON.stringify(waterfall)).not.toContain('PRIVATE_STREAM_USER_PROMPT');
    } finally {
      spy.mockRestore();
    }
  });

  it('finalizes a partial waterfall when prepareStep trips the run', async () => {
    const { spy, getAgentRunSpan } = await mockGetOrCreateSpan();

    try {
      const model = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'waterfall-tripwire-agent',
        name: 'Waterfall Tripwire Agent',
        instructions: 'Trip before the model.',
        model,
      });

      const output = await agent.stream('Trip this run', {
        prepareStep: ({ abort }) => {
          abort('Blocked by waterfall test');
        },
      });

      await output.consumeStream();

      const waterfall = getWaterfallPayload(getAgentRunSpan());
      expect(output.promptWaterfall).toEqual(waterfall);
      expect(waterfall.status).toBe('tripwire');
      expect(waterfall.tripwire).toEqual({
        reasonChars: 'Blocked by waterfall test'.length,
        processorId: 'prepare-step',
      });
      expect(waterfall.phases.map(phase => phase.kind)).not.toContain('pre_model');
      expect(JSON.stringify(waterfall)).not.toContain('Blocked by waterfall test');
    } finally {
      spy.mockRestore();
    }
  });

  it('finalizes the memory branch waterfall when an initial input processor trips the run', async () => {
    const { spy, getAgentRunSpan } = await mockGetOrCreateSpan();

    try {
      const model = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        }),
      });
      const processor: Processor = {
        id: 'memory-tripwire',
        processInput: async ({ abort }) => {
          abort('PRIVATE_MEMORY_TRIPWIRE_REASON');
        },
      };
      const agent = new Agent({
        id: 'waterfall-memory-tripwire-agent',
        name: 'Waterfall Memory Tripwire Agent',
        instructions: 'PRIVATE_MEMORY_SYSTEM_PROMPT',
        model,
        memory: new MockMemory(),
        inputProcessors: [processor],
      });

      const result = await agent.generate('PRIVATE_MEMORY_USER_PROMPT', {
        memory: {
          resource: 'resource-waterfall-memory',
          thread: 'thread-waterfall-memory',
        },
      });

      expect(result.tripwire?.reason).toBe('PRIVATE_MEMORY_TRIPWIRE_REASON');
      expect(result.promptWaterfall).toBeDefined();

      const waterfall = getWaterfallPayload(getAgentRunSpan());
      expect(result.promptWaterfall).toEqual(waterfall);
      expect(waterfall.phases.map(phase => ({ kind: phase.kind, meta: phase.meta }))).toEqual([
        { kind: 'initial', meta: undefined },
        {
          kind: 'input_processors',
          meta: {
            processorExecutor: 'workflow',
            processorId: 'memory-tripwire',
            processorIndex: 0,
            processorStepId: 'processor:memory-tripwire',
            processorStepIndex: 0,
            processorStepStatus: 'tripwire',
            processorWorkflowId: 'waterfall-memory-tripwire-agent-input-processor',
          },
        },
        { kind: 'memory_added', meta: undefined },
        { kind: 'input_processors', meta: { tripwire: true } },
      ]);
      const inputProcessorPhase = waterfall.phases.find(
        phase => phase.kind === 'input_processors' && phase.meta?.tripwire,
      );

      expect(waterfall.status).toBe('tripwire');
      expect(waterfall.tripwire).toEqual({
        reasonChars: 'PRIVATE_MEMORY_TRIPWIRE_REASON'.length,
        processorId: 'memory-tripwire',
      });
      expect(inputProcessorPhase?.meta).toEqual({ tripwire: true });
      expect(waterfall.phases.map(phase => phase.kind)).not.toContain('pre_model');
      const serializedPayload = JSON.stringify(waterfall);
      expect(serializedPayload).not.toContain('PRIVATE_MEMORY_TRIPWIRE_REASON');
      expect(serializedPayload).not.toContain('PRIVATE_MEMORY_SYSTEM_PROMPT');
      expect(serializedPayload).not.toContain('PRIVATE_MEMORY_USER_PROMPT');
    } finally {
      spy.mockRestore();
    }
  });

  it('finalizes the waterfall when the model errors', async () => {
    const { spy, getAgentRunSpan } = await mockGetOrCreateSpan();

    try {
      const model = new MockLanguageModelV2({
        doStream: async () => {
          throw new TypeError('PRIVATE_MODEL_ERROR');
        },
      });

      const agent = new Agent({
        id: 'waterfall-error-agent',
        name: 'Waterfall Error Agent',
        instructions: 'Error during model call.',
        model,
      });

      const output = await agent.stream('Trigger model error', { modelSettings: { maxRetries: 0 } });
      await output.consumeStream();

      const waterfall = getWaterfallPayload(getAgentRunSpan());
      expect(waterfall.status).toBe('error');
      expect(waterfall.error).toEqual({ name: 'TypeError', messageChars: 'PRIVATE_MODEL_ERROR'.length });
      expect(waterfall.phases.map(phase => phase.kind)).toContain('pre_model');
      expect(JSON.stringify(waterfall)).not.toContain('PRIVATE_MODEL_ERROR');
    } finally {
      spy.mockRestore();
    }
  });
});
